/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Bootstrap (App Initialization)
   ───────────────────────────────────────────────────────────────────
   هذا الملف مفصول عن 04-pwa-install.js (الذي كان يحتوي bootstrap
   بشكل خاطئ معماري). 

   مسؤولياته فقط:
   1. تحميل الحالة من Storage (loadState)
   2. ربط الـ persistence (subscribe → saveDebounced)
   3. تشغيل modules بالترتيب الصحيح مع error isolation
   4. تسجيل Service Worker
   
   التحسينات:
   • Granular persistence (مفتاح واحد لكل subscribe)
   • Module loader مع safeRun → عزل الفشل
   • Lifecycle events موحّدة
═══════════════════════════════════════════════════════════════════ */

(function bootstrap() {
  const { U, Storage, Logger } = Tdbeer;

  // ─── 1. Load state from Storage ────────────────────────────────
  function loadState() {
    if (!window.App) {
      Logger.error('Bootstrap.loadState', 'App not loaded');
      return;
    }
    const { store, Theme } = App;

    try {
      // Migrate data first
      const rawData = Storage.load('data', {}) || {};
      const migrated = Storage.migrate(rawData);

      // Use batch to avoid N renders for N initial sets
      store.batch(() => {
        store.set('data',         migrated);
        store.set('pts',          U.num(Storage.load('pts', 0)));
        store.set('salaryDay',    U.num(Storage.load('salaryDay', 0)));
        store.set('streak',       Storage.load('streak', { days: [], current: 0, max: 0, total: 0 }));
        store.set('notifs',       Storage.load('notifs', []));
        store.set('theme',        Storage.load('theme', 'midnight'));
        store.set('achievements', Storage.load('achievements', []));
        store.set('userName',     Storage.load('userName', ''));
        store.set('tipIdx',       Math.floor(Math.random() * Tdbeer.TIPS.length));
      });

      Theme.apply(store.get('theme'));

      // Mark active swatch (idempotent — no harm in calling multiple times)
      document.querySelectorAll('.theme-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.theme === store.get('theme'));
      });

      // Apply language + start clock — wrapped to avoid breaking init
      safeRun(() => App.Lang.apply(store.get('lang') || 'ar'), 'Bootstrap.Lang');
      safeRun(() => App.DateDisplay.start(), 'Bootstrap.DateDisplay');
    } catch (e) {
      Logger.error('Bootstrap.loadState', e);
    }
  }

  // ─── 2. Granular persistence (one key per subscribe) ───────────
  function bindPersistence() {
    const { store } = App;

    // Map of state key → save delay (ms)
    const persistMap = {
      data:         600,  // larger payload, more debouncing
      pts:          200,
      salaryDay:    400,
      streak:       200,
      notifs:       400,
      theme:        100,  // user-visible — flush quickly
      achievements: 400,
      userName:     200
    };

    for (const [key, delay] of Object.entries(persistMap)) {
      store.subscribe(key, () => {
        Storage.saveDebounced(key, store.get(key), delay);
      });
    }

    // Show "save bar" when dirty (UI-only side effect)
    store.subscribe('dirty', (isDirty) => {
      const saveWrap = document.getElementById('saveWrap');
      if (saveWrap && isDirty) saveWrap.classList.add('dirty');
    });
  }

  // ─── 3. Deep linking (URL params) ──────────────────────────────
  function handleDeepLink() {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('app') === '1') {
        const landing = document.getElementById('landing');
        const modal = document.getElementById('appModal');
        if (landing) landing.style.display = 'none';
        if (modal) modal.classList.add('open');
      }
      const tab = params.get('tab');
      const validTabs = ['home', 'money', 'social', 'profile',
                         'monthly', 'yearly', 'friends', 'settings'];
      if (tab && validTabs.includes(tab) && window.Controllers?.showTab) {
        Controllers.showTab(tab);
      }
    } catch (e) { Logger.warn('Bootstrap.deepLink', e?.message); }
  }

  // ─── 4. SW registration with update check ──────────────────────
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration('./sw.js')
      .then(reg => {
        if (reg) {
          reg.update().catch(e => Logger.warn('SW.update', e?.message));
        } else {
          // First-time registration
          navigator.serviceWorker.register('./sw.js')
            .catch(e => Logger.warn('SW.register', e?.message));
        }
      })
      .catch(e => Logger.warn('SW.getRegistration', e?.message));
  }

  // ─── 5. Notify user of urgent items / budget alerts ────────────
  function checkUrgentOnLoad() {
    safeRun(() => {
      const cnt = App.Notifs.alertCount();
      if (cnt > 0) {
        setTimeout(() => {
          App.Toast.show(
            `🔔 لديك ${cnt} ${cnt === 1 ? 'فاتورة' : 'فواتير'} قريبة`,
            'warn', 4000
          );
        }, 1500);
      }
    }, 'Bootstrap.checkUrgent');
  }

  function maybeAlertBudget() {
    safeRun(() => {
      const y = App.store.get('year');
      const m = App.store.get('month');
      const d = App.Sel.monthData(y, m);
      const cats = App.Sel.categorySpending(y, m);
      let exceeded = 0;
      for (const b of d.budgets || []) {
        const sp = App.Budgets.calcSpent(b.name, cats);
        if (sp >= b.limit) exceeded++;
      }
      if (exceeded > 0) {
        setTimeout(() => {
          App.Toast.show(
            `⚠️ تجاوزت ${exceeded} ${exceeded === 1 ? 'حد' : 'حدود'} إنفاق`,
            'warn', 3500
          );
        }, 2500);
      }
    }, 'Bootstrap.maybeAlertBudget');
  }

  // ─── 6. Module loader (errors isolated per module) ─────────────
  function safeRun(fn, ctx) {
    try { return fn(); }
    catch (e) { Logger.warn(ctx, e?.message || String(e)); }
  }

  function startModules() {
    const modules = [
      ['Controllers',       () => Controllers.init()],
      ['Renderers',         () => Renderers.scheduledAll()],
      ['Social.bind',       () => window.Social?.bindEvents?.()],
      ['Social.init',       () => window.Social?.init?.()],
      ['Bot',               () => window.Bot?.init?.()],
      ['SmartFeatures',     () => window.SmartFeatures?.init?.()],
      ['Companion',         () => window.Companion?.load?.()],
      ['ImageHandler',      () => window.ImageHandler?.init?.()],
      ['ChatNotifications', () => window.ChatNotifications?.init?.()],
      ['Birthday',          () => window.Birthday?.init?.()]
    ];
    for (const [name, fn] of modules) {
      safeRun(fn, `Bootstrap.${name}`);
    }
  }

  // ─── Main init ────────────────────────────────────────────────
  function init() {
    if (!window.App) {
      Logger.error('Bootstrap.init', 'App namespace missing — load order error');
      return;
    }

    try {
      loadState();
      bindPersistence();
      startModules();
      handleDeepLink();
      checkUrgentOnLoad();
      maybeAlertBudget();
      registerSW();
      App.store.set('initialized', true);

      // Run tests if explicitly requested via URL
      if (new URLSearchParams(location.search).has('test')) {
        if (typeof Tests !== 'undefined') Tests.run();
      }

      Logger.info('Bootstrap', 'تم التحميل بنجاح');
    } catch (e) {
      Logger.error('Bootstrap.init', e);
    }
  }

  // Run init once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    // Defer to next microtask so all sync scripts finish loading
    Promise.resolve().then(init);
  }
})();
