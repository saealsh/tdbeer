/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Error Handling
   ───────────────────────────────────────────────────────────────────
   Depends on: Logger, U, Storage, Toast (loaded from window.Tdbeer)

   New module — adds comprehensive error handling on top of the
   existing Logger and Toast. Provides:
     • ErrorMap         — Arabic messages for Firebase Auth + Firestore
     • Network          — online/offline detection with auto-toast
     • withRetry        — exponential backoff + jitter
     • WriteQueue       — offline-safe write queue (persists to localStorage)
     • safeAsync/Sync   — replacements for empty `catch {}` blocks
     • Idempotency      — token-based duplicate prevention
     • ErrorReporter    — debug panel (Ctrl+Shift+E)
     • handleError      — unified error handler
═══════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // Wait for Logger and Toast — they're loaded by 02-logger.js and 01-app.js
  if (typeof window.Logger === 'undefined') {
    console.error('[ErrorHandling] Logger not loaded — load this AFTER 02-logger.js');
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 1. ErrorMap — Firebase error codes → Arabic messages
  // ═══════════════════════════════════════════════════════════════════
  const ErrorMap = {
    auth: {
      'auth/invalid-email':         'بريد غير صحيح',
      'auth/user-not-found':        'ما فيه حساب بهذا البريد',
      'auth/wrong-password':        'الرقم السري خاطئ',
      'auth/invalid-credential':    'البيانات غير صحيحة',
      'auth/email-already-in-use':  'البريد مستخدم بالفعل',
      'auth/weak-password':         'الرقم السري ضعيف',
      'auth/too-many-requests':     'محاولات كثيرة، حاول بعد قليل',
      'auth/popup-closed-by-user':  'تم إغلاق النافذة',
      'auth/popup-blocked':         'المتصفح حجب النافذة',
      'auth/network-request-failed':'مشكلة اتصال',
      'auth/user-disabled':         'الحساب موقوف',
      'auth/requires-recent-login': 'سجّل دخول من جديد للمتابعة',
      'auth/account-exists-with-different-credential':
                                    'الحساب موجود بطريقة دخول مختلفة'
    },

    firestore: {
      'permission-denied':  'ما عندك صلاحية لهذي العملية',
      'unavailable':        'الخدمة غير متاحة، حاول بعد قليل',
      'deadline-exceeded':  'الطلب أخذ وقت طويل',
      'resource-exhausted': 'تم تجاوز الحد المسموح، حاول لاحقاً',
      'unauthenticated':    'سجّل دخول من جديد',
      'not-found':          'البيانات غير موجودة',
      'already-exists':     'البيانات موجودة بالفعل',
      'cancelled':          'تم إلغاء العملية',
      'failed-precondition':'البيانات تغيّرت، حدّث الصفحة',
      'aborted':            'تعارض في البيانات، حاول مرة ثانية',
      'out-of-range':       'القيمة خارج النطاق المسموح',
      'data-loss':          'فُقد جزء من البيانات',
      'invalid-argument':   'بيانات غير صحيحة',
      'internal':           'خطأ داخلي، حاول مرة ثانية'
    },

    /** True if the error is permanent (don't retry) */
    isFinal(err) {
      const code = err?.code || '';
      return [
        'permission-denied', 'not-found', 'invalid-argument',
        'already-exists', 'unauthenticated', 'failed-precondition',
        'out-of-range',
        'auth/invalid-email', 'auth/user-not-found',
        'auth/wrong-password', 'auth/invalid-credential',
        'auth/email-already-in-use', 'auth/weak-password',
        'auth/user-disabled'
      ].includes(code);
    },

    /** True if the error is network-related (worth retrying) */
    isNetwork(err) {
      const code = err?.code || '';
      const msg = (err?.message || '').toLowerCase();
      return code === 'unavailable'
          || code === 'auth/network-request-failed'
          || msg.includes('network')
          || msg.includes('offline')
          || msg.includes('failed to fetch');
    },

    /** Returns an Arabic-friendly message for any error */
    friendly(err) {
      const code = err?.code || '';
      if (this.auth[code])      return this.auth[code];
      if (this.firestore[code]) return this.firestore[code];
      if (this.isNetwork(err))  return 'مشكلة اتصال — التغييرات محفوظة محلياً';
      return err?.message?.length < 80 ? err.message : 'صار خطأ، حاول مرة ثانية';
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 2. Network — online/offline detection
  // ═══════════════════════════════════════════════════════════════════
  const Network = (() => {
    let online = navigator.onLine;
    const subs = new Set();

    function notify(isOnline) {
      if (online === isOnline) return;
      online = isOnline;

      if (isOnline) {
        window.Toast?.show('🌐 رجع الاتصال', 'ok', 2000);
      } else {
        window.Toast?.show('📴 ما فيه اتصال — التغييرات راح تُحفظ محلياً', 'warn', 4000);
      }

      subs.forEach(fn => {
        try { fn(isOnline); }
        catch (e) { Logger.error('Network.sub', e); }
      });
    }

    window.addEventListener('online',  () => notify(true));
    window.addEventListener('offline', () => notify(false));

    return {
      isOnline:  () => online,
      subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); }
    };
  })();

  // ═══════════════════════════════════════════════════════════════════
  // 3. withRetry — exponential backoff + jitter
  // ═══════════════════════════════════════════════════════════════════
  async function withRetry(fn, options = {}) {
    const {
      ctx = 'op',
      maxAttempts = 3,
      baseMs = 500,
      onRetry = null
    } = options;

    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (ErrorMap.isFinal(err) || attempt === maxAttempts) break;

        const delay = baseMs * Math.pow(2, attempt - 1) + Math.random() * 200;
        Logger.warn(ctx, `retry ${attempt}/${maxAttempts} بعد ${Math.round(delay)}ms`);

        if (onRetry) {
          try { onRetry(err, attempt); }
          catch (e) { Logger.error(ctx + '.onRetry', e); }
        }

        await new Promise(r => setTimeout(r, delay));
      }
    }

    Logger.error(ctx, lastErr);
    throw lastErr;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. WriteQueue — offline-safe Firestore write queue
  // ═══════════════════════════════════════════════════════════════════
  const WriteQueue = (() => {
    const KEY = 'td_write_queue';
    let queue = [];
    let processing = false;

    try {
      const saved = localStorage.getItem(KEY);
      if (saved) queue = JSON.parse(saved) || [];
    } catch (e) { Logger.warn('WriteQueue.load', e?.message); }

    function persist() {
      try { localStorage.setItem(KEY, JSON.stringify(queue)); }
      catch (e) { Logger.warn('WriteQueue.persist', e?.message); }
    }

    function enqueue(op) {
      if (!op.id) op.id = (window.U?.uid?.() || (Date.now() + '_' + Math.random()));
      if (!op.ts) op.ts = Date.now();
      if (queue.some(q => q.id === op.id)) return op.id;
      queue.push(op);
      persist();
      Logger.warn('WriteQueue', `enqueued ${op.type} ${op.path} (${queue.length} pending)`);
      if (Network.isOnline()) flush();
      return op.id;
    }

    async function executeOp(op) {
      const FB = window.FB;
      if (!FB) throw new Error('Firebase غير جاهز');

      const parts = op.path.split('/').filter(Boolean);
      let ref;
      if (parts.length % 2 === 0) {
        ref = FB.doc(FB.db, ...parts);
      } else {
        ref = FB.collection(FB.db, ...parts);
      }

      switch (op.type) {
        case 'set':    return await FB.setDoc(ref, op.data);
        case 'update': return await FB.updateDoc(ref, op.data);
        case 'delete': return await FB.deleteDoc(ref);
        case 'add':    return await FB.addDoc(ref, op.data);
        default: throw new Error('نوع عملية غير معروف: ' + op.type);
      }
    }

    async function flush() {
      if (processing || queue.length === 0 || !Network.isOnline()) return;
      processing = true;

      const succeeded = [];
      for (const op of [...queue]) {
        try {
          await withRetry(() => executeOp(op), {
            ctx: `WriteQueue.${op.type}`,
            maxAttempts: 3
          });
          succeeded.push(op.id);
        } catch (err) {
          if (ErrorMap.isFinal(err)) {
            Logger.error('WriteQueue.dropped', err, { op });
            succeeded.push(op.id);
          } else {
            Logger.warn('WriteQueue', 'سيُعاد لاحقاً: ' + op.path);
          }
        }
      }

      queue = queue.filter(op => !succeeded.includes(op.id));
      persist();
      processing = false;

      if (succeeded.length > 0) {
        window.Toast?.show(`☁️ تم مزامنة ${succeeded.length} تغيير`, 'ok', 2000);
      }
    }

    Network.subscribe((isOnline) => { if (isOnline) flush(); });

    return {
      enqueue,
      flush,
      size: () => queue.length,
      clear: () => { queue = []; persist(); }
    };
  })();

  // ═══════════════════════════════════════════════════════════════════
  // 5. safeAsync / safeSync — replacements for empty catch blocks
  // ═══════════════════════════════════════════════════════════════════
  async function safeAsync(fn, { ctx = 'safeAsync', fallback = undefined, silent = false } = {}) {
    try { return await fn(); }
    catch (err) {
      if (!silent) Logger.warn(ctx, err?.message || String(err));
      return fallback;
    }
  }

  function safeSync(fn, { ctx = 'safeSync', fallback = undefined, silent = false } = {}) {
    try { return fn(); }
    catch (err) {
      if (!silent) Logger.warn(ctx, err?.message || String(err));
      return fallback;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. Idempotency — token-based duplicate prevention
  // ═══════════════════════════════════════════════════════════════════
  const Idempotency = (() => {
    const KEY = 'td_idem_tokens';
    const MAX_TOKENS = 200;
    let tokens = new Set();

    try {
      const saved = localStorage.getItem(KEY);
      if (saved) tokens = new Set(JSON.parse(saved));
    } catch (e) { Logger.warn('Idempotency.load', e?.message); }

    function persist() {
      try {
        const arr = [...tokens].slice(-MAX_TOKENS);
        tokens = new Set(arr);
        localStorage.setItem(KEY, JSON.stringify(arr));
      } catch (e) { Logger.warn('Idempotency.persist', e?.message); }
    }

    function once(token, fn) {
      if (tokens.has(token)) {
        Logger.warn('Idempotency', 'duplicate skipped: ' + token);
        return undefined;
      }
      tokens.add(token);
      persist();
      return fn();
    }

    return { once, has: (t) => tokens.has(t), clear: () => { tokens.clear(); persist(); } };
  })();

  // ═══════════════════════════════════════════════════════════════════
  // 7. ErrorReporter — debug panel
  // ═══════════════════════════════════════════════════════════════════
  const ErrorReporter = {
    show() {
      const errors = Logger.getErrors();
      const queueSize = WriteQueue.size();
      const summary = {
        ts: new Date().toISOString(),
        userAgent: navigator.userAgent,
        online: Network.isOnline(),
        queuePending: queueSize,
        errors: errors.slice(-20).map(e => ({
          ctx: e.ctx,
          msg: e.msg,
          ts: new Date(e.ts).toISOString(),
          meta: e.meta
        }))
      };

      const text = JSON.stringify(summary, null, 2);

      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.7);
        z-index:99999; display:flex; align-items:center;
        justify-content:center; padding:16px; direction:rtl;
      `;
      overlay.innerHTML = `
        <div style="background:#fff; max-width:600px; width:100%; max-height:80vh;
                    border-radius:12px; padding:20px; overflow:auto;
                    font-family:system-ui,'Segoe UI',sans-serif;">
          <h3 style="margin:0 0 12px;">تقرير الأخطاء</h3>
          <p style="font-size:13px; color:#666; margin:0 0 12px;">
            انسخ هذا النص وأرسله للدعم الفني
          </p>
          <textarea readonly style="width:100%; height:300px;
                    font-family:monospace; font-size:11px;
                    direction:ltr; padding:8px; border:1px solid #ddd;
                    border-radius:6px;">${text.replace(/</g, '&lt;')}</textarea>
          <div style="display:flex; gap:8px; margin-top:12px;">
            <button id="td-copy-err" style="flex:1; padding:10px; border:0;
                    background:#c9a84c; color:#fff; border-radius:6px;
                    cursor:pointer;">نسخ</button>
            <button id="td-close-err" style="flex:1; padding:10px; border:1px solid #ddd;
                    background:#fff; border-radius:6px; cursor:pointer;">إغلاق</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#td-copy-err').onclick = async () => {
        try {
          await navigator.clipboard.writeText(text);
          window.Toast?.show('📋 تم النسخ', 'ok');
        } catch {
          window.Toast?.show('ما قدرت أنسخ — اختار النص يدوياً', 'warn');
        }
      };
      overlay.querySelector('#td-close-err').onclick = () => overlay.remove();
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 8. handleError — unified handler
  // ═══════════════════════════════════════════════════════════════════
  function handleError(err, options = {}) {
    const {
      ctx = 'unknown',
      meta = {},
      showToast = true,
      toastType = null,
      rethrow = false
    } = options;

    Logger.error(ctx, err, meta);

    if (showToast && window.Toast) {
      const msg = ErrorMap.friendly(err);
      const type = toastType || (ErrorMap.isNetwork(err) ? 'warn' : 'danger');
      try { window.Toast.show(msg, type); } catch {}
    }

    if (rethrow) throw err;
    return ErrorMap.isFinal(err);
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════════════
  window.ErrorMap       = ErrorMap;
  window.Network        = Network;
  window.withRetry      = withRetry;
  window.WriteQueue     = WriteQueue;
  window.safeAsync      = safeAsync;
  window.safeSync       = safeSync;
  window.Idempotency    = Idempotency;
  window.ErrorReporter  = ErrorReporter;
  window.handleError    = handleError;

  // Add to Tdbeer namespace
  Object.assign(window.Tdbeer, {
    ErrorMap, Network, withRetry, WriteQueue,
    safeAsync, safeSync, Idempotency, ErrorReporter, handleError
  });

  // Keyboard shortcut: Ctrl+Shift+E opens error reporter
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      ErrorReporter.show();
    }
  });

  Logger.warn('ErrorHandling', 'module loaded ✓');

})();
