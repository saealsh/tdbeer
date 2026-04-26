/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Logger
   ───────────────────────────────────────────────────────────────────
   Originally lines 11657–11669 of index.html
═══════════════════════════════════════════════════════════════════ */

var Logger = {
  _errors: [],
  error(ctx, err, meta = {}) {
    const entry = { ctx, msg: err?.message || String(err), stack: err?.stack, meta, ts: Date.now() };
    this._errors.push(entry);
    if (this._errors.length > 50) this._errors.shift();
    if (!window.__PROD__) console.error(`[${ctx}]`, err, meta);
  },
  warn(ctx, msg, meta = {}) {
    if (!window.__PROD__) console.warn(`[${ctx}]`, msg, meta);
  },
  getErrors() { return [...this._errors]; }
};

// Expose globally + on namespace
window.Tdbeer.Logger = Logger;
window.Logger = Logger;
