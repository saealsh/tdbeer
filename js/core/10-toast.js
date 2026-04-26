/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Toast v2 (Bounded + Queueable)
   ───────────────────────────────────────────────────────────────────
   التحسينات:
   1. حد أقصى للـ toasts المتزامنة (يمنع spam)
   2. إزالة آمنة (مع cancellation عند overflow)
   3. textContent بدلاً من innerHTML داخلياً (XSS-safe)
   4. ARIA live region للـ accessibility
   5. Auto-dismiss يحترم prefers-reduced-motion
═══════════════════════════════════════════════════════════════════ */

var Toast = (() => {
  const MAX_VISIBLE = 3;
  const FADE_MS = 300;

  let wrap = null;
  const active = []; // { el, timerId }

  function getWrap() {
    if (wrap && document.contains(wrap)) return wrap;
    wrap = document.getElementById('toastWrap');
    if (!wrap) {
      // Create on demand if missing — defensive
      wrap = document.createElement('div');
      wrap.id = 'toastWrap';
      wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      wrap.setAttribute('aria-atomic', 'false');
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function removeToast(entry) {
    if (!entry || !entry.el || !entry.el.parentNode) return;
    clearTimeout(entry.timerId);
    entry.el.classList.add('fade');
    setTimeout(() => {
      entry.el.remove();
      const idx = active.indexOf(entry);
      if (idx >= 0) active.splice(idx, 1);
    }, FADE_MS);
  }

  function show(msg, type = 'success', duration = 2800) {
    const w = getWrap();
    if (!w) return;

    // Enforce max visible — drop oldest
    while (active.length >= MAX_VISIBLE) {
      removeToast(active[0]);
    }

    const validTypes = new Set(['success', 'ok', 'warn', 'danger', 'info']);
    const safeType = validTypes.has(type) ? type : 'info';

    const el = document.createElement('div');
    el.className = `toast ${safeType}`;
    el.setAttribute('role', safeType === 'danger' || safeType === 'warn' ? 'alert' : 'status');
    // textContent → XSS-safe (msg might come from error messages or user content)
    el.textContent = String(msg || '');

    const entry = { el, timerId: null };
    active.push(entry);
    w.appendChild(el);

    // Honor prefers-reduced-motion: shorter duration if user prefers
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const safeDuration = reduced ? Math.max(1500, duration / 2) : duration;

    entry.timerId = setTimeout(() => removeToast(entry), safeDuration);
    return entry;
  }

  function clear() {
    while (active.length) removeToast(active[0]);
  }

  return { show, clear };
})();

// Expose globally — and re-bind to window.Toast in App
window.Tdbeer.Toast = Toast;
window.Toast = Toast;
