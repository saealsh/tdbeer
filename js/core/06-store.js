/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Store v2 (Immutable + Path-Aware Memoization)
   ───────────────────────────────────────────────────────────────────
   التحسينات الجوهرية:
   1. Immutable updates (path-copy) → آمن ضد race conditions ومناسب لـ DevTools
   2. Path-aware memo invalidation → لا نمسح كل الكاش عند أي تغيير
   3. Notify دقيق (overlap detection محسّن)
   4. Batched updates عبر beginBatch/commitBatch (نتفادى N renders لـ N updates)
   5. Selectors بـ equality function اختيارية (shallow/deep/custom)
   6. Memory ceiling للـ memo (LRU خفيف)
═══════════════════════════════════════════════════════════════════ */

var Store = (() => {
  // ─── Internal helpers (immutable path setter) ─────────────────────
  function setIn(obj, keys, value) {
    if (keys.length === 0) return value;
    const [head, ...rest] = keys;
    const current = obj && typeof obj === 'object' ? obj[head] : undefined;
    if (rest.length === 0 && Object.is(current, value)) return obj;
    const next = setIn(current, rest, value);
    if (next === current && obj) return obj;
    return Array.isArray(obj)
      ? Object.assign([...obj], { [head]: next })
      : { ...(obj || {}), [head]: next };
  }

  function pathsOverlap(a, b) {
    if (a === '' || b === '') return true;
    if (a === b) return true;
    return a.startsWith(b + '.') || b.startsWith(a + '.');
  }

  // ─── LRU-ish memo (cap protects long sessions) ────────────────────
  class MemoCache {
    constructor(max = 200) { this.max = max; this.map = new Map(); }
    get(key) {
      if (!this.map.has(key)) return undefined;
      const v = this.map.get(key);
      this.map.delete(key); this.map.set(key, v); // touch
      return v;
    }
    set(key, value) {
      if (this.map.has(key)) this.map.delete(key);
      this.map.set(key, value);
      if (this.map.size > this.max) {
        // remove oldest
        const first = this.map.keys().next().value;
        this.map.delete(first);
      }
    }
    delete(key) { this.map.delete(key); }
    clear() { this.map.clear(); }
    entries() { return this.map.entries(); }
  }

  return class Store {
    #state;
    #subs = new Map();   // path → Set<fn>
    #memo = new MemoCache(200);
    #batchDepth = 0;
    #pendingNotifs = []; // {path, value} during batch

    constructor(initial = {}) {
      this.#state = U.clone(initial);
    }

    // ─── Read ─────────────────────────────────────────────────────
    get(path) {
      if (!path) return this.#state;
      const keys = path.split('.');
      let cur = this.#state;
      for (const k of keys) {
        if (cur == null) return undefined;
        cur = cur[k];
      }
      return cur;
    }

    snapshot() { return U.clone(this.#state); }

    // ─── Write (immutable, path-copy) ─────────────────────────────
    set(path, value) {
      if (!path) {
        if (Object.is(this.#state, value)) return;
        this.#state = value;
        this.#invalidate('');
        this.#queueNotify('', value);
        return;
      }
      const keys = path.split('.');
      const prev = this.get(path);
      if (Object.is(prev, value)) return;
      this.#state = setIn(this.#state, keys, value);
      this.#invalidate(path);
      this.#queueNotify(path, value);
    }

    /** Shallow-merge object at path */
    patch(path, partial) {
      const current = this.get(path);
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        // micro-optimization: skip set if partial is no-op
        let changed = false;
        for (const k in partial) {
          if (!Object.is(current[k], partial[k])) { changed = true; break; }
        }
        if (!changed) return;
      }
      this.set(path, { ...(current || {}), ...partial });
    }

    /** Update with reducer: store.update('counter', n => n + 1) */
    update(path, fn) {
      this.set(path, fn(this.get(path)));
    }

    // ─── Batching (single render for many updates) ────────────────
    beginBatch() { this.#batchDepth++; }
    commitBatch() {
      if (this.#batchDepth === 0) return;
      this.#batchDepth--;
      if (this.#batchDepth === 0) this.#flushNotifs();
    }
    /** Convenience: store.batch(() => { ...many sets... }) */
    batch(fn) {
      this.beginBatch();
      try { return fn(); }
      finally { this.commitBatch(); }
    }

    // ─── Pub/Sub ──────────────────────────────────────────────────
    subscribe(path, fn) {
      if (typeof fn !== 'function') return () => {};
      if (!this.#subs.has(path)) this.#subs.set(path, new Set());
      this.#subs.get(path).add(fn);
      return () => {
        const set = this.#subs.get(path);
        if (set) {
          set.delete(fn);
          if (set.size === 0) this.#subs.delete(path);
        }
      };
    }

    // ─── Memoized selector (path-aware invalidation) ──────────────
    /**
     * @param {string} key — unique cache key
     * @param {string[]} depPaths — store paths the compute depends on
     * @param {Function} compute — (state) => value
     * @param {Function} [equals] — optional dep equality (default Object.is)
     */
    select(key, depPaths, compute, equals) {
      const eq = equals || Object.is;
      const deps = depPaths.map(p => this.get(p));
      const cached = this.#memo.get(key);
      if (cached &&
          cached.deps.length === deps.length &&
          cached.deps.every((v, i) => eq(v, deps[i]))) {
        return cached.value;
      }
      const value = compute(this.#state);
      this.#memo.set(key, { depPaths, deps, value });
      return value;
    }

    /** Clear specific selector(s) — useful for debugging */
    invalidateSelector(key) {
      if (key == null) this.#memo.clear();
      else this.#memo.delete(key);
    }

    // ─── Internals ────────────────────────────────────────────────
    #invalidate(changedPath) {
      // Only delete memo entries whose ANY dep path overlaps changedPath
      // (vs. v1 which cleared everything)
      for (const [key, entry] of this.#memo.entries()) {
        if (!entry.depPaths) continue; // legacy entries
        if (entry.depPaths.some(dp => pathsOverlap(dp, changedPath))) {
          this.#memo.delete(key);
        }
      }
    }

    #queueNotify(path, value) {
      this.#pendingNotifs.push({ path, value });
      if (this.#batchDepth === 0) this.#flushNotifs();
    }

    #flushNotifs() {
      if (this.#pendingNotifs.length === 0) return;
      // Dedupe: keep last value per exact path; preserve order for distinct paths
      const seen = new Map();
      for (const n of this.#pendingNotifs) seen.set(n.path, n);
      this.#pendingNotifs = [];

      for (const { path, value } of seen.values()) {
        for (const [subPath, fns] of this.#subs) {
          if (pathsOverlap(subPath, path)) {
            fns.forEach(fn => {
              try { fn(value, path); }
              catch (e) {
                if (typeof Logger !== 'undefined') Logger.error('Store.subscribe', e, { path });
              }
            });
          }
        }
      }
    }

    /** For debugging: number of subscribers per path */
    _debug() {
      const subs = {};
      for (const [k, v] of this.#subs) subs[k] = v.size;
      return { subs, memoSize: this.#memo.map.size };
    }
  };
})();

window.Tdbeer.Store = Store;
window.Store = Store;
