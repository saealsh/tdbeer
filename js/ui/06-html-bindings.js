/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — HTML Event Bindings
   ───────────────────────────────────────────────────────────────────
   يستبدل inline onclick handlers (التي كانت في index.html) بـ
   event listeners صحيحة — عشان نسمح بـ Content-Security-Policy
   صارمة وعشان فصل HTML عن سلوك JavaScript.
═══════════════════════════════════════════════════════════════════ */

(function htmlBindings() {
  'use strict';

  // ─── Helper: bind by id with safety checks ─────────────────────
  function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  function bindAll() {
    // ═══ Landing CTA (open the app) ═══
    bindClick('openAppBtn', () => {
      try {
        const landing = document.getElementById('landing');
        const modal = document.getElementById('appModal');
        if (landing) landing.style.display = 'none';
        if (modal) modal.classList.add('open');
        if (typeof Renderers !== 'undefined' && Renderers.scheduledAll) {
          Renderers.scheduledAll();
        }
      } catch (e) {
        if (window.Logger) Logger.error('openAppBtn', e);
        alert('خطأ في فتح التطبيق، أعد التحميل');
      }
    });

    // ═══ Friends sign-in trigger ═══
    bindClick('friendsSignInBtn', () => {
      const overlay = document.getElementById('authOverlay');
      if (overlay) overlay.classList.add('open');
    });

    // ═══ Auth Modal: close ═══
    bindClick('authCloseBtn', () => {
      const overlay = document.getElementById('authOverlay');
      if (overlay) overlay.classList.remove('open');
    });

    // ═══ Auth Modal: tab switching (signin/signup) ═══
    document.querySelectorAll('[data-auth-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.authMode;
        if (window.__setAuthMode) window.__setAuthMode(mode);
      });
    });

    // ═══ Auth Modal: form submit ═══
    const authForm = document.getElementById('authForm');
    if (authForm) {
      authForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (window.__authSubmit) {
          window.__authSubmit(event);
        } else {
          window.Toast?.show?.('الكود لم يُحمّل بعد — اصبر ثانية', 'warn');
        }
      });
    }

    // ═══ Auth: biometric ═══
    bindClick('authBiometricBtn', () => {
      if (window.__biometricSignIn) window.__biometricSignIn();
    });

    // ═══ Auth: Google sign-in ═══
    bindClick('authGoogleBtn', () => {
      if (window.__googleSignIn) window.__googleSignIn();
    });

    // ═══ Auth: forgot password ═══
    bindClick('authForgotBtn', () => {
      if (window.__authForgot) window.__authForgot();
    });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll, { once: true });
  } else {
    bindAll();
  }
})();
