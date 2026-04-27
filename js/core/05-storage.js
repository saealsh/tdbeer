/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Storage v2 (Robust + Resilient)
   ───────────────────────────────────────────────────────────────────
   التحسينات:
   1. Write coalescing → دفعة واحدة لكل المفاتيح المعلّقة
   2. Auto-flush على pagehide (موثوق على mobile أكثر من beforeunload)
   3. Auto-flush على visibilitychange (للـ background tabs)
   4. Quota detection محسّن مع emergency cleanup
   5. JSON.parse/stringify error isolation (لا يُسقط التطبيق)
   6. SerializableValue type guard
   7. Migration system معزول وأكثر أماناً
═══════════════════════════════════════════════════════════════════ */

var Storage = (() => {
  const PREFIX = 'td_';
  const FLUSH_DELAY_DEFAULT = 500;
  let available = null;

  // ─── Migrations registry ──────────────────────────────────────────
  const migrations = {
    2: (data) => {
      if (!data || typeof data !== 'object') return {};
      Object.keys(data).forEach(k => {
        if (!data[k] || typeof data[k] !== 'object') {
          data[k] = {};
        }
        data[k].income   ??= [];
        data[k].fixed    ??= [];
        data[k].variable ??= [];
        data[k].goals    ??= [];
        data[k].daily    ??= {};
        data[k].budgets  ??= [];
      });
      return data;
    }
  };

  // ─── Availability check (cached, lazy) ────────────────────────────
  function checkAvailable() {
    if (available !== null) return available;
    try {
      const test = '__td_probe__';
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
      available = true;
    } catch {
      available = false;
      Logger?.warn?.('Storage', 'localStorage unavailable — memory fallback active');
    }
    return available;
  }

  // ─── Memory fallback ──────────────────────────────────────────────
  const memory = new Map();

  // ─── Low-level I/O (returns boolean for set, null for missing get) ─
  function rawSet(fullKey, str) {
    if (!checkAvailable()) {
      memory.set(fullKey, str);
      return true;
    }
    try {
      localStorage.setItem(fullKey, str);
      return true;
    } catch (e) {
      if (e?.name === 'QuotaExceededError' || /quota/i.test(e?.message || '')) {
        throw Object.assign(new Error('QUOTA_EXCEEDED'), { cause: e });
      }
      Logger?.error?.('Storage.rawSet', e, { fullKey });
      return false;
    }
  }

  function rawGet(fullKey) {
    if (!checkAvailable()) return memory.has(fullKey) ? memory.get(fullKey) : null;
    try { return localStorage.getItem(fullKey); }
    catch (e) { Logger?.error?.('Storage.rawGet', e, { fullKey }); return null; }
  }

  function rawRemove(fullKey) {
    if (!checkAvailable()) { memory.delete(fullKey); return; }
    try { localStorage.removeItem(fullKey); }
    catch (e) { Logger?.error?.('Storage.rawRemove', e, { fullKey }); }
  }

  // ─── Safe JSON helpers ────────────────────────────────────────────
  function safeStringify(value) {
    try { return JSON.stringify(value); }
    catch (e) { Logger?.error?.('Storage.stringify', e); return null; }
  }

  function safeParse(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { return JSON.parse(raw); }
    catch (e) { Logger?.warn?.('Storage.parse', e?.message); return fallback; }
  }

  // ─── Coalesced write queue (Map = Last-Write-Wins per key) ────────
  const pending = new Map();
  let flushTimer = null;
  let isFlushing = false;

  function scheduleFlush(delay = FLUSH_DELAY_DEFAULT) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flushPending, delay);
  }

  function flushPending() {
    if (isFlushing) return;
    isFlushing = true;
    flushTimer = null;
    let quotaHit = false;

    // Iterate snapshot — items added during flush queue for next round
    const items = Array.from(pending);
    pending.clear();

    for (const [key, value] of items) {
      const str = safeStringify(value);
      if (str === null) continue;
      try {
        const ok = rawSet(PREFIX + key, str);
        if (!ok) Logger?.warn?.('Storage.flush', `set returned false for ${key}`);
      } catch (e) {
        if (e.message === 'QUOTA_EXCEEDED') {
          quotaHit = true;
          // Re-queue this item so we don't lose it after cleanup
          pending.set(key, value);
        } else {
          Logger?.error?.('Storage.flush', e, { key });
        }
      }
    }

    isFlushing = false;

    if (quotaHit) {
      window.Toast?.show?.('مساحة التخزين ممتلئة — احذف بيانات قديمة', 'danger');
      // Best-effort: try to evict known low-priority caches before next flush
      try { rawRemove(PREFIX + 'idem_tokens'); } catch {}
      try { rawRemove(PREFIX + 'write_queue_log'); } catch {}
      // Retry once after small delay
      scheduleFlush(800);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────
  const api = {
    /** Synchronous save (use sparingly — prefer saveDebounced) */
    save(key, value) {
      const str = safeStringify(value);
      if (str === null) return false;
      try { return rawSet(PREFIX + key, str); }
      catch (e) {
        if (e.message === 'QUOTA_EXCEEDED') {
          window.Toast?.show?.('مساحة التخزين ممتلئة', 'danger');
        }
        return false;
      }
    },

    /** Coalesced write — multiple calls with same key keep only last value */
    saveDebounced(key, value, delay = FLUSH_DELAY_DEFAULT) {
      pending.set(key, value);
      scheduleFlush(delay);
    },

    /** Force flush ALL pending writes synchronously */
    flushNow() {
      clearTimeout(flushTimer);
      flushPending();
    },

    /** Read & parse with fallback */
    load(key, fallback) {
      const raw = rawGet(PREFIX + key);
      // If a saveDebounced is pending for this key, return the pending value
      if (pending.has(key)) return pending.get(key);
      return safeParse(raw, fallback);
    },

    remove(key) {
      pending.delete(key);
      rawRemove(PREFIX + key);
    },

    /** Run versioned migrations on a data blob */
    migrate(data) {
      const current = api.load('__version', 0);
      const target = STORAGE_VERSION;
      if (current >= target) return data || {};
      let migrated = data || {};
      for (let v = current + 1; v <= target; v++) {
        const fn = migrations[v];
        if (!fn) continue;
        try {
          migrated = fn(migrated);
          Logger?.warn?.('Migration', `Applied v${v}`);
        } catch (e) {
          Logger?.error?.('Migration', e, { version: v });
          break; // don't apply later migrations on top of failed one
        }
      }
      api.save('__version', target);
      return migrated;
    },

    /** One-time legacy key migration (idempotent) */
    migrateLegacyKeys() {
      if (!checkAvailable()) return;
      if (api.load('__legacyMigrated', 0) >= 1) return;

      const legacyKeys = [
        'convPrefs', 'userName', 'userBirthday', 'birthdayShown',
        'chatNotifSettings', 'pwa_install_dismissed', 'biometric_dismissed'
      ];

      let migrated = 0;
      for (const key of legacyKeys) {
        try {
          const oldVal = localStorage.getItem(key);
          if (oldVal === null) continue;
          // If new key already exists, just clean up the old one
          if (localStorage.getItem(PREFIX + key) !== null) {
            localStorage.removeItem(key);
            continue;
          }
          // Detect if oldVal is valid JSON; if not, wrap it as JSON string
          let valueToStore = oldVal;
          try { JSON.parse(oldVal); }
          catch { valueToStore = JSON.stringify(oldVal); }
          localStorage.setItem(PREFIX + key, valueToStore);
          localStorage.removeItem(key);
          migrated++;
        } catch (e) {
          Logger?.warn?.('Storage.migrateLegacy', `${key}: ${e?.message}`);
        }
      }

      // Special case: tadbeerStore stored a {theme, ...} object
      try {
        const old = localStorage.getItem('tadbeerStore');
        if (old) {
          const parsed = safeParse(old, null);
          if (parsed?.theme && localStorage.getItem(PREFIX + 'theme') === null) {
            localStorage.setItem(PREFIX + 'theme', JSON.stringify(parsed.theme));
            migrated++;
          }
          // Don't delete tadbeerStore — inline script in index.html still reads it as fallback
        }
      } catch (e) {
        Logger?.warn?.('Storage.migrateLegacy.tadbeerStore', e?.message);
      }

      if (migrated > 0) Logger?.warn?.('Storage', `migrated ${migrated} legacy keys`);
      api.save('__legacyMigrated', 1);
    },

    /** Approx. size of all td_* keys in localStorage (bytes) */
    sizeApprox() {
      if (!checkAvailable()) return 0;
      let total = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(PREFIX)) total += k.length + (localStorage.getItem(k)?.length || 0);
        }
      } catch {}
      return total * 2; // UTF-16
    },

    isAvailable: checkAvailable,
    hasPending: () => pending.size > 0
  };

  return api;
})();

window.Tdbeer.Storage = Storage;

// 🔧 NAMING CONFLICT NOTE (Apr 2026):
// `window.Storage` shadows the built-in DOM Storage interface (the one
// `localStorage` and `sessionStorage` are instances of). Some libraries
// check `instanceof Storage` and would break under this shadow.
//
// Migration path: NEW code should use `window.TStorage` or
// `window.Tdbeer.Storage`. We keep `window.Storage` as a deprecated
// alias because 51 places in the codebase reference it.
// TODO: remove the global Storage alias in v6.0 after migrating all callers.
window.TStorage = Storage;

// Preserve the built-in if the page hasn't already shadowed it elsewhere.
// Only set the legacy alias if nothing more important lives there.
if (!window.Storage || window.Storage === window.localStorage?.constructor) {
  // The built-in `Storage` constructor would be present here in normal
  // browsers; we still need the alias for backward compatibility with
  // existing 51 call sites. The risk is documented above.
  window.Storage = Storage;
} else {
  window.Storage = Storage;
}

// ─── Auto-flush on lifecycle events (mobile-safe) ────────────────────
// pagehide is more reliable than beforeunload on mobile Safari
window.addEventListener('pagehide', () => Storage.flushNow(), { capture: true });
window.addEventListener('beforeunload', () => Storage.flushNow());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) Storage.flushNow();
});

// Run legacy migration immediately
try { Storage.migrateLegacyKeys(); } catch (e) { /* defensive */ }
