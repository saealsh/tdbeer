/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Storage (localStorage + memory fallback)
   ───────────────────────────────────────────────────────────────────
   Depends on: Logger, U
   Originally lines 11764–11900 of index.html
═══════════════════════════════════════════════════════════════════ */

var Storage = (() => {
  const PREFIX = 'td_';
  let available = null;

  const migrations = {
    2: (data) => {
      Object.keys(data).forEach(k => {
        data[k].income ??= [];
        data[k].fixed ??= [];
        data[k].variable ??= [];
        data[k].goals ??= [];
        data[k].daily ??= {};
        data[k].budgets ??= [];
      });
      return data;
    }
  };

  function checkAvailable() {
    if (available !== null) return available;
    try {
      const test = '__td_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      available = true;
    } catch {
      available = false;
      Logger.warn('Storage', 'localStorage unavailable — using memory fallback');
    }
    return available;
  }

  // In-memory fallback
  const memory = new Map();

  function setItem(key, val) {
    const fullKey = PREFIX + key;
    if (!checkAvailable()) {
      memory.set(fullKey, val);
      return true;
    }
    try {
      localStorage.setItem(fullKey, val);
      return true;
    } catch (e) {
      Logger.error('Storage.set', e, { key });
      if (e.name === 'QuotaExceededError') {
        throw new Error('QUOTA_EXCEEDED');
      }
      return false;
    }
  }

  function getItem(key) {
    const fullKey = PREFIX + key;
    if (!checkAvailable()) return memory.get(fullKey) ?? null;
    try { return localStorage.getItem(fullKey); }
    catch (e) { Logger.error('Storage.get', e, { key }); return null; }
  }

  // Debounced batch writer
  const pendingWrites = new Map();
  let flushTimer = null;
  function flushPending() {
    for (const [key, val] of pendingWrites) {
      try { setItem(key, JSON.stringify(val)); }
      catch (e) {
        if (e.message === 'QUOTA_EXCEEDED') {
          Toast.show('مساحة التخزين ممتلئة — احذف بيانات قديمة', 'danger');
        }
      }
    }
    pendingWrites.clear();
    flushTimer = null;
  }

  return {
    save(key, value) {
      try {
        return setItem(key, JSON.stringify(value));
      } catch (e) {
        if (e.message === 'QUOTA_EXCEEDED') {
          Toast.show('مساحة التخزين ممتلئة', 'danger');
        }
        return false;
      }
    },

    saveDebounced(key, value, delay = 500) {
      pendingWrites.set(key, value);
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flushPending, delay);
    },

    flushNow() {
      clearTimeout(flushTimer);
      flushPending();
    },

    load(key, fallback) {
      try {
        const raw = getItem(key);
        return raw === null || raw === undefined ? fallback : JSON.parse(raw);
      } catch (e) {
        Logger.error('Storage.load', e, { key });
        return fallback;
      }
    },

    remove(key) {
      const fullKey = PREFIX + key;
      if (!checkAvailable()) { memory.delete(fullKey); return; }
      try { localStorage.removeItem(fullKey); }
      catch (e) { Logger.error('Storage.remove', e, { key }); }
    },

    /** Run data migrations */
    migrate(data) {
      const current = Storage.load('__version', 0);
      let migrated = data || {};
      for (let v = current + 1; v <= STORAGE_VERSION; v++) {
        if (migrations[v]) {
          try {
            migrated = migrations[v](migrated);
            Logger.warn('Migration', `Applied v${v}`);
          } catch (e) {
            Logger.error('Migration', e, { version: v });
          }
        }
      }
      Storage.save('__version', STORAGE_VERSION);
      return migrated;
    },

    isAvailable: checkAvailable
  };
})();


window.Tdbeer.Storage = Storage;
window.Storage = Storage;
