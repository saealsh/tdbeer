/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — U (Utilities) v2
   ───────────────────────────────────────────────────────────────────
   التحسينات:
   1. uid يستخدم crypto.randomUUID لو متاح (آمن للـ multi-tab)
   2. todayStr بصيغة ISO (YYYY-MM-DD) padded — يحل مشاكل الفرز
   3. dateKey و dayDiff helpers (يحلان bugs الـ Streak)
   4. هاش سريع لقيم primitives (للـ memoization keys)
   5. raf / nextTick helpers
═══════════════════════════════════════════════════════════════════ */

var U = (() => {
  // Pre-compile the heavy escape regex once
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const ESC_RX = /[&<>"']/g;

  // ISO date formatter without timezone surprises
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoDay(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  return {
    /** Safely parse a number with bounds */
    num(val, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
      const n = typeof val === 'number' ? val : parseFloat(val);
      if (!Number.isFinite(n)) return fallback;
      return n < min ? min : (n > max ? max : n);
    },

    /** Validate day for month/year */
    day(d, y, m) {
      const max = new Date(y, m + 1, 0).getDate();
      const n = U.num(d, { min: 1, max: 31, fallback: 1 });
      return n < 1 ? 1 : (n > max ? max : n);
    },

    /** Trim and cap string length */
    str(val, max = 120) {
      if (typeof val !== 'string') return '';
      const trimmed = val.trim();
      return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
    },

    /** Escape HTML (prevents XSS) — uses a single regex pass */
    esc(s) {
      if (s === null || s === undefined) return '';
      return String(s).replace(ESC_RX, ch => ESC_MAP[ch]);
    },

    /** Debounce with cancel + flush */
    debounce(fn, ms = 300) {
      let t, lastArgs;
      const wrapped = (...args) => {
        lastArgs = args;
        clearTimeout(t);
        t = setTimeout(() => { t = null; fn(...lastArgs); }, ms);
      };
      wrapped.cancel = () => { clearTimeout(t); t = null; };
      wrapped.flush = () => {
        if (t) { clearTimeout(t); t = null; fn(...(lastArgs || [])); }
      };
      return wrapped;
    },

    /** Throttle (leading + trailing) */
    throttle(fn, ms = 100) {
      let last = 0, timer = null, lastArgs;
      return (...args) => {
        lastArgs = args;
        const now = Date.now();
        const remaining = ms - (now - last);
        if (remaining <= 0) {
          last = now;
          if (timer) { clearTimeout(timer); timer = null; }
          fn(...args);
        } else if (!timer) {
          timer = setTimeout(() => {
            last = Date.now();
            timer = null;
            fn(...lastArgs);
          }, remaining);
        }
      };
    },

    /** Generate unique ID — prefers crypto.randomUUID */
    uid() {
      try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
      } catch {}
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    },

    /** Today as "YYYY-MM-DD" (ISO, sortable) */
    todayStr() { return isoDay(new Date()); },

    /** Any date as ISO day string */
    dateKey(d) { return isoDay(d instanceof Date ? d : new Date(d)); },

    /** Difference in days between two ISO date strings */
    dayDiff(a, b) {
      const da = new Date(a), db = new Date(b);
      // Normalize to noon to avoid DST off-by-one
      da.setHours(12, 0, 0, 0);
      db.setHours(12, 0, 0, 0);
      return Math.round((db - da) / 86400000);
    },

    /** Yesterday as ISO */
    yesterdayStr() {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return isoDay(d);
    },

    /** Month key for store paths */
    monthKey(y, m) { return `${y}_m${m}`; },

    /** Deep clone with structuredClone fallback */
    clone(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      try {
        if (typeof structuredClone === 'function') return structuredClone(obj);
      } catch {}
      try { return JSON.parse(JSON.stringify(obj)); }
      catch { return obj; }
    },

    /** Shallow equality for objects (compares keys + Object.is values) */
    shallowEqual(a, b) {
      if (a === b) return true;
      if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
      const ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (let i = 0; i < ka.length; i++) {
        const k = ka[i];
        if (!Object.is(a[k], b[k])) return false;
      }
      return true;
    },

    /** Run on next animation frame, returns cancel fn */
    raf(fn) {
      const id = requestAnimationFrame(fn);
      return () => cancelAnimationFrame(id);
    },

    /** Microtask scheduler */
    nextTick(fn) {
      Promise.resolve().then(fn);
    },

    /** Sleep for ms (Promise-based) */
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  };
})();

window.Tdbeer.U = U;
window.U = U;
