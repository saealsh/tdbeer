/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Store (state + observers + memoization)
   ───────────────────────────────────────────────────────────────────
   Depends on: U, Logger
   Originally lines 11903–11975 of index.html
═══════════════════════════════════════════════════════════════════ */

var Store = class {
  #state;
  #subs = new Map();  // path → Set<fn>
  #memo = new Map();  // key → {deps, value}

  constructor(initial = {}) {
    this.#state = U.clone(initial);
  }

  get(path) {
    if (!path) return this.#state;
    return path.split('.').reduce((o, k) => o?.[k], this.#state);
  }

  set(path, value) {
    if (!path) { this.#state = value; this.#invalidate(''); this.#notify('', value); return; }
    const keys = path.split('.');
    const last = keys.pop();
    let target = this.#state;
    for (const k of keys) {
      if (target[k] == null || typeof target[k] !== 'object') target[k] = {};
      target = target[k];
    }
    if (Object.is(target[last], value)) return;
    target[last] = value;
    this.#invalidate(path);
    this.#notify(path, value);
  }

  /** Patch object (shallow merge) */
  patch(path, partial) {
    const current = this.get(path);
    this.set(path, { ...(current || {}), ...partial });
  }

  subscribe(path, fn) {
    if (!this.#subs.has(path)) this.#subs.set(path, new Set());
    this.#subs.get(path).add(fn);
    return () => this.#subs.get(path)?.delete(fn);
  }

  /** Memoized selector */
  select(key, depPaths, compute) {
    const deps = depPaths.map(p => this.get(p));
    const cached = this.#memo.get(key);
    if (cached && cached.deps.length === deps.length &&
        cached.deps.every((v, i) => Object.is(v, deps[i]))) {
      return cached.value;
    }
    const value = compute(this.#state);
    this.#memo.set(key, { deps, value });
    return value;
  }

  #invalidate(changedPath) {
    // Clear cache entries whose deps overlap with changedPath
    for (const [key] of this.#memo) this.#memo.delete(key);
  }

  #notify(path, value) {
    for (const [subPath, fns] of this.#subs) {
      if (subPath === path || path === '' ||
          path.startsWith(subPath + '.') || subPath.startsWith(path + '.')) {
        fns.forEach(fn => {
          try { fn(value, path); }
          catch (e) { Logger.error('Store.subscribe', e, { path }); }
        });
      }
    }
  }

  snapshot() { return U.clone(this.#state); }
};

window.Tdbeer.Store = Store;
window.Store = Store;
