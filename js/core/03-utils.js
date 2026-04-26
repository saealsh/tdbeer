/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — U (Utilities)
   ───────────────────────────────────────────────────────────────────
   Depends on: Logger
   Originally lines 11672–11742 of index.html
═══════════════════════════════════════════════════════════════════ */

var U = {
  /** Safely parse a number with bounds */
  num(val, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
    const n = typeof val === 'number' ? val : parseFloat(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  },
  /** Validate day for month/year */
  day(d, y, m) {
    const max = new Date(y, m + 1, 0).getDate();
    return Math.min(Math.max(1, U.num(d, { min: 1, max: 31, fallback: 1 })), max);
  },
  /** Trim and cap string length */
  str(val, max = 120) {
    return typeof val === 'string' ? val.trim().slice(0, max) : '';
  },
  /** Safely escape HTML (prevents XSS) */
  esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  /** Debounce with optional max-wait */
  debounce(fn, ms = 300) {
    let t;
    const wrapped = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
    wrapped.cancel = () => clearTimeout(t);
    wrapped.flush = () => { clearTimeout(t); fn(); };
    return wrapped;
  },
  /** Throttle */
  throttle(fn, ms = 100) {
    let last = 0, timer = null;
    return (...args) => {
      const now = Date.now();
      const remaining = ms - (now - last);
      if (remaining <= 0) {
        last = now;
        fn(...args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn(...args);
        }, remaining);
      }
    };
  },
  /** Generate unique ID based on time + random */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
  /** Today as "YYYY-M-D" */
  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  },
  /** Month key */
  monthKey(y, m) { return `${y}_m${m}`; },
  /** Clone deep (fallback if structuredClone unavailable) */
  clone(obj) {
    try { return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); }
    catch { return obj; }
  }
};

window.Tdbeer.U = U;
window.U = U;
