/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Cloud Sync
   ───────────────────────────────────────────────────────────────────
   مزامنة البيانات المالية بين الأجهزة عبر Firestore.

   البيانات تُحفظ في: /users/{uid}/financialData/main
   مع دمج ذكي عند تسجيل الدخول (cloud overrides local إذا أحدث).

   Depends on: Firebase, App, store, Logger, Toast,
               withRetry, WriteQueue, ErrorMap, Network
═══════════════════════════════════════════════════════════════════ */

var CloudSync = (() => {
  const SYNC_KEYS = ['data', 'pts', 'salaryDay', 'streak', 'notifs',
                     'theme', 'achievements', 'userName'];
  const DOC_PATH = ['users', null, 'financialData', 'main']; // [1] filled with uid
  const DEBOUNCE_MS = 1500;

  let isLoading = false;
  let isSyncing = false;
  let saveTimer = null;
  let lastSyncedSnapshot = null;
  let currentUid = null;
  let unsubAuthListener = null;
  let storeUnsubs = [];

  /**
   * يجلب مرجع الـ document الخاص بالمستخدم الحالي.
   */
  function getUserDocRef(uid) {
    if (!window.FB || !window.FB.db) return null;
    return window.FB.doc(window.FB.db, 'users', uid, 'financialData', 'main');
  }

  /**
   * يحوّل الـ store snapshot لـ object يمكن حفظه في Firestore.
   */
  function pickSyncableState() {
    if (!window.App?.store) return null;
    const snap = window.App.store.snapshot();
    const result = {};
    for (const key of SYNC_KEYS) {
      if (snap[key] !== undefined) result[key] = snap[key];
    }
    return result;
  }

  /**
   * يقارن كائنين للتحقق من أنهما متطابقين.
   */
  function deepEqual(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch { return false; }
  }

  /**
   * تحميل البيانات من السحابة عند تسجيل الدخول.
   * Strategy:
   *   • إذا السحابة فيها بيانات → استخدمها (تستبدل localStorage)
   *   • إذا السحابة فاضية → ارفع بيانات localStorage الحالية
   */
  async function loadFromCloud(uid) {
    if (!uid || !window.FB) return false;
    if (isLoading) return false;
    isLoading = true;

    try {
      const ref = getUserDocRef(uid);
      if (!ref) throw new Error('Firebase غير جاهز');

      const snap = await window.withRetry(
        () => window.FB.getDoc(ref),
        { ctx: 'CloudSync.load', maxAttempts: 3 }
      );

      if (snap && snap.exists && snap.exists()) {
        const cloudData = snap.data() || {};
        Logger.warn('CloudSync', 'تحميل بيانات من السحابة');

        // طبّق البيانات على الـ store
        const store = window.App.store;
        for (const key of SYNC_KEYS) {
          if (cloudData[key] !== undefined) {
            store.set(key, cloudData[key]);
          }
        }

        // احفظ snapshot للمقارنة لاحقاً (نمنع upload فوري)
        lastSyncedSnapshot = pickSyncableState();

        // أعد التصيير
        if (window.Renderers?.scheduledAll) {
          window.Renderers.scheduledAll();
        }

        window.Toast?.show('☁️ تم تحميل بياناتك', 'ok', 2000);
        return true;
      } else {
        // ما فيه بيانات في السحابة — ارفع الحالية (إذا فيها شي)
        Logger.warn('CloudSync', 'لا توجد بيانات في السحابة، رفع الحالية');
        const local = pickSyncableState();
        if (local && hasMeaningfulData(local)) {
          await uploadToCloud(uid, local);
          lastSyncedSnapshot = local;
        } else {
          lastSyncedSnapshot = local;
        }
        return false;
      }
    } catch (err) {
      Logger.error('CloudSync.load', err);
      if (window.handleError) {
        window.handleError(err, { ctx: 'CloudSync.load', showToast: true });
      }
      return false;
    } finally {
      isLoading = false;
    }
  }

  /**
   * يفحص هل البيانات تستحق الرفع (مش فاضية).
   */
  function hasMeaningfulData(state) {
    if (!state) return false;
    const data = state.data || {};
    // أي شهر فيه دخل أو مصاريف
    for (const monthKey of Object.keys(data)) {
      const m = data[monthKey] || {};
      if ((m.income || []).length > 0) return true;
      if ((m.fixed || []).length > 0) return true;
      if ((m.variable || []).length > 0) return true;
      if (Object.keys(m.daily || {}).length > 0) return true;
      if ((m.goals || []).length > 0) return true;
      if ((m.budgets || []).length > 0) return true;
    }
    if ((state.pts || 0) > 0) return true;
    if (state.userName) return true;
    return false;
  }

  /**
   * رفع البيانات للسحابة (مع retry).
   */
  async function uploadToCloud(uid, state) {
    if (!uid || !state) return false;
    if (!window.FB) return false;

    const ref = getUserDocRef(uid);
    if (!ref) return false;

    try {
      isSyncing = true;
      // أضف timestamp للسجل
      const payload = {
        ...state,
        _updatedAt: window.FB.serverTimestamp ? window.FB.serverTimestamp() : Date.now(),
        _device: navigator.userAgent.substring(0, 100)
      };

      await window.withRetry(
        () => window.FB.setDoc(ref, payload, { merge: true }),
        { ctx: 'CloudSync.upload', maxAttempts: 3 }
      );

      lastSyncedSnapshot = state;
      Logger.warn('CloudSync', 'تم الرفع');
      return true;
    } catch (err) {
      // فشل — استخدم WriteQueue للأوفلاين
      if (window.WriteQueue && window.ErrorMap?.isNetwork(err)) {
        window.WriteQueue.enqueue({
          type: 'set',
          path: `users/${uid}/financialData/main`,
          data: { ...state, _updatedAt: Date.now() }
        });
        Logger.warn('CloudSync', 'فشل الرفع — أُضيف للطابور');
      } else {
        Logger.error('CloudSync.upload', err);
      }
      return false;
    } finally {
      isSyncing = false;
    }
  }

  /**
   * يجدول رفع البيانات بـ debounce.
   */
  function scheduleUpload() {
    if (!currentUid) return;
    if (saveTimer) clearTimeout(saveTimer);

    saveTimer = setTimeout(async () => {
      const current = pickSyncableState();
      if (!current) return;

      // لا ترفع لو نفس الـ snapshot الأخير (يمنع loops)
      if (lastSyncedSnapshot && deepEqual(current, lastSyncedSnapshot)) {
        return;
      }

      await uploadToCloud(currentUid, current);
    }, DEBOUNCE_MS);
  }

  /**
   * بدء المزامنة (يُستدعى عند تسجيل الدخول).
   */
  async function start(uid) {
    if (currentUid === uid) return; // already started for this user
    currentUid = uid;

    Logger.warn('CloudSync', 'بدء المزامنة للمستخدم: ' + uid.substring(0, 8));

    // 1. حمّل من السحابة (يستبدل localStorage إذا فيه بيانات)
    await loadFromCloud(uid);

    // 2. اشترك في تغييرات الـ store ليرفع تلقائياً
    if (window.App?.store) {
      const store = window.App.store;
      // امسح الاشتراكات السابقة
      stopStoreListeners();

      for (const key of SYNC_KEYS) {
        const unsub = store.subscribe(key, () => {
          // لا ترفع أثناء التحميل
          if (!isLoading) scheduleUpload();
        });
        if (unsub) storeUnsubs.push(unsub);
      }
    }

    // 3. عند العودة من offline، ارفع آخر نسخة
    if (window.Network) {
      window.Network.subscribe((online) => {
        if (online && currentUid) {
          scheduleUpload();
        }
      });
    }
  }

  /**
   * يوقف المزامنة (عند تسجيل الخروج).
   */
  function stop() {
    Logger.warn('CloudSync', 'إيقاف المزامنة');
    currentUid = null;
    lastSyncedSnapshot = null;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    stopStoreListeners();
  }

  function stopStoreListeners() {
    for (const unsub of storeUnsubs) {
      try { if (typeof unsub === 'function') unsub(); }
      catch (e) { Logger.warn('CloudSync', e?.message); }
    }
    storeUnsubs = [];
  }

  /**
   * يربط نفسه بـ Firebase Auth — يبدأ/يوقف تلقائياً.
   */
  function init() {
    if (!window.firebase || !window.firebase.auth) {
      Logger.warn('CloudSync', 'Firebase Auth غير جاهز، انتظار fb-ready');
      window.addEventListener('fb-ready', init, { once: true });
      return;
    }

    // اشترك في تغييرات تسجيل الدخول
    const auth = window.firebase.auth();
    unsubAuthListener = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await start(user.uid);
      } else {
        stop();
      }
    });

    Logger.warn('CloudSync', 'module loaded ✓');
  }

  /**
   * يجبر الرفع الفوري (مفيد عند beforeunload).
   */
  async function flushNow() {
    if (!currentUid) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const state = pickSyncableState();
    if (state && lastSyncedSnapshot && !deepEqual(state, lastSyncedSnapshot)) {
      await uploadToCloud(currentUid, state);
    }
  }

  // اربط beforeunload لرفع آخر تغييرات
  window.addEventListener('beforeunload', () => {
    if (currentUid && saveTimer) {
      // sync attempt — قد لا يكتمل لكن نحاول
      const state = pickSyncableState();
      if (state && lastSyncedSnapshot && !deepEqual(state, lastSyncedSnapshot)) {
        // استخدم navigator.sendBeacon لو ممكن (لكن Firestore ما يدعمه)
        // الحل: WriteQueue يحفظ في localStorage فيُرفع لاحقاً
        if (window.WriteQueue) {
          window.WriteQueue.enqueue({
            type: 'set',
            path: `users/${currentUid}/financialData/main`,
            data: { ...state, _updatedAt: Date.now() }
          });
        }
      }
    }
  });

  return {
    init,
    start,
    stop,
    flushNow,
    loadFromCloud,
    isActive: () => currentUid !== null,
    getCurrentUid: () => currentUid
  };
})();

// Expose globally
window.CloudSync = CloudSync;

// Auto-init when loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CloudSync.init());
} else {
  CloudSync.init();
}
