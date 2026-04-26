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
          // 🔧 FIX: Toast قد يكون غير معرّف لو فشل QUOTA قبل تحميل App
          window.Toast?.show?.('مساحة التخزين ممتلئة — احذف بيانات قديمة', 'danger');
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
          window.Toast?.show?.('مساحة التخزين ممتلئة', 'danger');
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

    /**
     * 🔧 ينقل المفاتيح القديمة (بدون prefix) إلى Storage module (مع td_ prefix).
     * يُستدعى مرة واحدة عند بدء التطبيق. آمن للاستدعاء أكثر من مرة.
     * المفاتيح اللي تنتقل: convPrefs, userName, userBirthday, birthdayShown,
     *                      tadbeerStore (theme), chatNotifSettings,
     *                      pwa_install_dismissed, biometric_dismissed
     */
    migrateLegacyKeys() {
      if (!checkAvailable()) return;
      // نسخة المهاجرة — لو 1، خلصنا
      if (Storage.load('__legacyMigrated', 0) >= 1) return;

      const legacyKeys = [
        'convPrefs', 'userName', 'userBirthday', 'birthdayShown',
        'chatNotifSettings', 'pwa_install_dismissed', 'biometric_dismissed'
      ];

      let migrated = 0;
      for (const key of legacyKeys) {
        try {
          const oldVal = localStorage.getItem(key);
          if (oldVal === null) continue;
          // إذا الجديد موجود (المستخدم استخدم النسخة الجديدة)، تخطّى
          if (localStorage.getItem(PREFIX + key) !== null) {
            localStorage.removeItem(key);
            continue;
          }
          // 🔧 FIX: القيم القديمة قد تكون raw strings (مثل userName="أحمد")
          // أو JSON صالح (مثل convPrefs='{"a":1}'). Storage.load يعمل JSON.parse،
          // لذلك أي raw string بدون quotes سيفشل في parse ويُفقَد.
          // الحل: نتحقق هل القيمة JSON صالح؛ إن لم تكن، نلفّها بـ JSON.stringify.
          let valueToStore = oldVal;
          try {
            JSON.parse(oldVal); // إذا parse نجح، القيمة JSON صالح — نخزّنها كما هي
          } catch {
            valueToStore = JSON.stringify(oldVal); // وإلا نلفّها (string عادي)
          }
          localStorage.setItem(PREFIX + key, valueToStore);
          localStorage.removeItem(key);
          migrated++;
        } catch (e) { Logger.warn('Storage.migrateLegacy', `${key}: ${e?.message}`); }
      }

      // tadbeerStore حالة خاصة — كان يخزّن object كامل، الـ theme مفصول الحين في Storage
      try {
        const old = localStorage.getItem('tadbeerStore');
        if (old) {
          try {
            const parsed = JSON.parse(old);
            if (parsed && parsed.theme && localStorage.getItem(PREFIX + 'theme') === null) {
              localStorage.setItem(PREFIX + 'theme', JSON.stringify(parsed.theme));
              migrated++;
            }
          } catch {}
          // ما نحذف tadbeerStore لأنه قد يحتوي بيانات أخرى تحفظ بـ inline script في index.html
        }
      } catch (e) { Logger.warn('Storage.migrateLegacy.tadbeerStore', e?.message); }

      if (migrated > 0) {
        Logger.warn('Storage', `migrated ${migrated} legacy keys`);
      }
      Storage.save('__legacyMigrated', 1);
    },

    isAvailable: checkAvailable
  };
})();


window.Tdbeer.Storage = Storage;
window.Storage = Storage;

// 🔧 Run legacy migration immediately on load
try { Storage.migrateLegacyKeys(); } catch (e) { /* defensive */ }
