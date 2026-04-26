/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Logger v2 (with global error capture)
   ───────────────────────────────────────────────────────────────────
   التحسينات:
   1. window.error و unhandledrejection يُلتقطان تلقائياً
   2. Ring buffer أكبر (200 بدلاً من 50)
   3. levels: debug, info, warn, error
   4. Remote sink optional (لإرسال الأخطاء لـ Firebase لاحقاً)
   5. Sample rate لـ debug في الإنتاج
═══════════════════════════════════════════════════════════════════ */

var Logger = (() => {
  const MAX_BUFFER = 200;
  const _errors = [];
  const _sinks = []; // optional remote sinks: fn(entry) => void

  function push(level, ctx, msg, meta) {
    const entry = {
      level,
      ctx,
      msg: typeof msg === 'string' ? msg : (msg?.message || String(msg)),
      stack: msg?.stack,
      meta: meta || {},
      ts: Date.now()
    };
    _errors.push(entry);
    if (_errors.length > MAX_BUFFER) _errors.shift();

    if (!window.__PROD__) {
      const fn = console[level] || console.log;
      fn.call(console, `[${ctx}]`, msg, meta || '');
    }

    // Forward to remote sinks (best-effort, never throw)
    if (level === 'error' || level === 'warn') {
      for (const sink of _sinks) {
        try { sink(entry); } catch {}
      }
    }
    return entry;
  }

  // ─── Global error capture ─────────────────────────────────────────
  // Setup once — defensive against duplicate listeners
  let _wired = false;
  function wireGlobalHandlers() {
    if (_wired) return;
    _wired = true;
    window.addEventListener('error', (event) => {
      push('error', 'window.error', event.error || event.message, {
        filename: event.filename,
        line: event.lineno,
        col: event.colno
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      push('error', 'unhandledrejection', event.reason || 'unknown rejection', {});
    });
  }

  return {
    debug(ctx, msg, meta) { return push('debug', ctx, msg, meta); },
    info(ctx, msg, meta)  { return push('info', ctx, msg, meta); },
    warn(ctx, msg, meta)  { return push('warn', ctx, msg, meta); },
    error(ctx, err, meta) { return push('error', ctx, err, meta); },
    getErrors() { return _errors.slice(); },
    clear() { _errors.length = 0; },
    addSink(fn) { if (typeof fn === 'function') _sinks.push(fn); },
    removeSink(fn) {
      const i = _sinks.indexOf(fn);
      if (i >= 0) _sinks.splice(i, 1);
    },
    init: wireGlobalHandlers
  };
})();

// Wire global handlers immediately
Logger.init();

window.Tdbeer.Logger = Logger;
window.Logger = Logger;
