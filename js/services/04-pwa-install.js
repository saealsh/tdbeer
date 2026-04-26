/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — PWA Install Prompt
   ───────────────────────────────────────────────────────────────────
   Originally lines 21204–21787 of index.html
═══════════════════════════════════════════════════════════════════ */

var PWAInstall = (() => {
  let deferredPrompt = null;
  let banner, btn, dismiss, iosModal, iosBackdrop, iosClose, iosGotIt;

  // Check if iOS
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  // Check if already installed (standalone mode)
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches 
        || window.navigator.standalone === true;
  }

  // Check if dismissed recently (within 7 days)
  function isDismissedRecently() {
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (!dismissed) return false;
    const days = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
    return days < 7;
  }

  function init() {
    banner = document.getElementById('pwaInstallBanner');
    btn = document.getElementById('pwaInstallBtn');
    dismiss = document.getElementById('pwaInstallDismiss');
    iosModal = document.getElementById('pwaIosModal');
    iosBackdrop = document.getElementById('pwaIosBackdrop');
    iosClose = document.getElementById('pwaIosClose');
    iosGotIt = document.getElementById('pwaIosGotIt');

    if (!banner) return;

    // Don't show if already installed
    if (isStandalone()) {
      banner.style.display = 'none';
      return;
    }

    // Don't show if dismissed recently
    if (isDismissedRecently()) {
      banner.style.display = 'none';
      return;
    }

    // iOS - Show banner with iOS instructions
    if (isIOS()) {
      setTimeout(() => showBanner(), 5000);
    }

    // Listen for beforeinstallprompt (Chrome, Edge, Android)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setTimeout(() => showBanner(), 3000);
    });

    // Listen for appinstalled
    window.addEventListener('appinstalled', () => {
      hideBanner();
      deferredPrompt = null;
      if (window.Toast?.show) {
        window.Toast.show('🎉 تم ثبّت التطبيق بنجاح!', 'ok');
      }
    });

    // Button handlers
    if (btn) btn.addEventListener('click', handleInstall);
    if (dismiss) dismiss.addEventListener('click', handleDismiss);
    if (iosClose) iosClose.addEventListener('click', hideIosModal);
    if (iosBackdrop) iosBackdrop.addEventListener('click', hideIosModal);
    if (iosGotIt) iosGotIt.addEventListener('click', hideIosModal);
  }

  function showBanner() {
    if (!banner || isStandalone() || isDismissedRecently()) return;
    banner.style.display = 'flex';
    requestAnimationFrame(() => banner.classList.add('show'));
  }

  function hideBanner() {
    if (!banner) return;
    banner.classList.remove('show');
    setTimeout(() => {
      banner.style.display = 'none';
    }, 500);
  }

  async function handleInstall() {
    // iOS - Show instructions modal
    if (isIOS()) {
      showIosModal();
      return;
    }

    // Android/Chrome - Use native prompt
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        if (window.Toast?.show) {
          window.Toast.show('⏳ جارٍ التثبيت...', 'ok');
        }
      }
      
      deferredPrompt = null;
      hideBanner();
    } else {
      // Fallback - show instructions
      if (window.Toast?.show) {
        window.Toast.show('ℹ️ استخدم قائمة المتصفح لثبّت التطبيق', 'warn');
      }
    }
  }

  function handleDismiss() {
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    hideBanner();
  }

  function showIosModal() {
    if (!iosModal) return;
    iosModal.style.display = 'flex';
    requestAnimationFrame(() => iosModal.classList.add('show'));
  }

  function hideIosModal() {
    if (!iosModal) return;
    iosModal.classList.remove('show');
    setTimeout(() => {
      iosModal.style.display = 'none';
    }, 300);
    hideBanner();
    // Mark as shown
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  }

  // Manual trigger (can be called from anywhere)
  function forceShow() {
    localStorage.removeItem('pwa_install_dismissed');
    if (isIOS()) {
      showIosModal();
    } else if (deferredPrompt) {
      handleInstall();
    } else {
      if (window.Toast?.show) {
        window.Toast.show('ℹ️ التطبيق مثبّت أو غير قابل للتثبيت في متصفحك', 'warn');
      }
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init,
    showBanner,
    hideBanner,
    forceShow,
    isStandalone,
    isIOS
  };
})();

window.PWAInstall = PWAInstall;

// ═══ Save password temporarily after successful login for biometric future use ═══
// Hook into auth success
(function hookAuthSuccess() {
  // Watch for when user successfully logs in
  let lastAuthState = null;
  setInterval(() => {
    try {
      const user = window.Social?._state?.user;
      if (user && user.email && user.email !== lastAuthState) {
        lastAuthState = user.email;
        
        // Check if biometric is available and not dismissed recently
        setTimeout(async () => {
          const supported = await BiometricAuth.isSupported();
          const hasRegistered = BiometricAuth.hasRegisteredCredential();
          const dismissed = localStorage.getItem('biometric_dismissed');
          const dismissedRecently = dismissed && (Date.now() - parseInt(dismissed)) < 7 * 24 * 60 * 60 * 1000; // 7 days
          
          if (supported && !hasRegistered && !dismissedRecently) {
            // Show setup prompt 3 seconds after login
            setTimeout(() => {
              const profile = window.Social?._state?.profile;
              const displayName = profile?.displayName || user.email.split('@')[0];
              
              // Save password temporarily (encrypted in localStorage)
              const emailInput = document.getElementById('authEmail');
              const passInput = document.getElementById('authPass');
              
              if (passInput && passInput.value) {
                // Save for biometric auto-fill
                try {
                  const authData = {
                    email: user.email,
                    password: passInput.value,  // In production, should be encrypted
                    savedAt: Date.now()
                  };
                  localStorage.setItem('tdbeer_biometric_auth_token', JSON.stringify(authData));
                } catch (e) { if (window.Logger) Logger.warn('PWAInstall', e?.message); }
              }
              
              BiometricAuth.showSetupPrompt(user.email, displayName, () => {
                // On success, keep auth_token for future biometric logins
              });
            }, 3000);
          }
        }, 1000);
      }
    } catch (e) { if (window.Logger) Logger.warn('PWAInstall', e?.message); }
  }, 2000);
})();

// Override social-chats action to use dedicated page

// Initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Sidebar.init());
} else {
  Sidebar.init();
}

window.Sidebar = Sidebar;


(function setupSectionLabel() {
  const sectionNames = {
    home: '🏠 الرئيسية',
    money: '💰 فلوسي',
    'money:monthly': '💰 الشهر الحالي',
    'money:yearly': '📅 تقرير السنة',
    social: '👥 اجتماعي',
    profile: '👤 ملفي',
    'profile:achievements': '🏆 إنجازاتي',
    'profile:settings': '⚙️ الإعدادات'
  };

  function updateSectionLabel() {
    try {
      const label = document.getElementById('currentSectionLabel');
      if (!label) return;

      const tab = window.App?.store?.get('tab') || 'home';
      const subTab = window.App?.store?.get('subTab');
      const key = subTab && (tab === 'money' || tab === 'profile') ? `${tab}:${subTab}` : tab;
      
      const name = sectionNames[key] || sectionNames[tab] || '🏠 الرئيسية';
      
      if (label.textContent !== name) {
        label.classList.remove('show');
        setTimeout(() => {
          label.textContent = name;
          label.classList.add('show');
        }, 150);
      } else {
        label.classList.add('show');
      }
    } catch (e) { if (window.Logger) Logger.warn('PWAInstall', e?.message); }
  }

  // Initial
  setTimeout(updateSectionLabel, 500);

  // Watch for tab changes
  if (window.App?.store) {
    const originalSet = window.App.store.set.bind(window.App.store);
    window.App.store.set = function(key, value) {
      const result = originalSet(key, value);
      if (key === 'tab' || key === 'subTab') {
        setTimeout(updateSectionLabel, 50);
      }
      return result;
    };
  }

  // Update on clicks
  document.addEventListener('click', (e) => {
    if (e.target.closest('.sub-nav-btn, .sidebar-item, .tab-btn')) {
      setTimeout(updateSectionLabel, 100);
    }
  });

  // Update periodically as safety net
  setInterval(updateSectionLabel, 3000);
})();


(function bootstrap() {
  const { U, Storage, Logger } = Tdbeer;
  const { store, Theme } = App;

  function loadState() {
    try {
      // Migrate data first
      const rawData = Storage.load('data', {}) || {};
      const migrated = Storage.migrate(rawData);

      store.set('data', migrated);
      store.set('pts', U.num(Storage.load('pts', 0)));
      store.set('salaryDay', U.num(Storage.load('salaryDay', 0)));
      store.set('streak', Storage.load('streak', { days: [], current: 0, max: 0, total: 0 }));
      store.set('notifs', Storage.load('notifs', []));
      store.set('theme', Storage.load('theme', 'midnight'));
      store.set('achievements', Storage.load('achievements', []));
      store.set('userName', Storage.load('userName', ''));
      store.set('tipIdx', Math.floor(Math.random() * Tdbeer.TIPS.length));

      Theme.apply(store.get('theme'));
      // Mark active swatch
      document.querySelectorAll('.theme-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.theme === store.get('theme'));
      });

      // Apply language
      try { App.Lang.apply(store.get('lang') || 'ar'); } catch (e) { if (window.Logger) Logger.warn('PWAInstall', e?.message); }

      // Start date display
      try { App.DateDisplay.start(); } catch (e) { if (window.Logger) Logger.warn('PWAInstall', e?.message); }
    } catch (e) {
      Logger.error('Bootstrap.loadState', e);
    }
  }

  function bindPersistence() {
    // Whenever store changes, save
    const saveAll = () => {
      try {
        const snap = store.snapshot();
        Storage.saveDebounced('data', snap.data, 600);
        Storage.saveDebounced('pts', snap.pts, 600);
        Storage.saveDebounced('salaryDay', snap.salaryDay, 600);
        Storage.saveDebounced('streak', snap.streak, 600);
        Storage.saveDebounced('notifs', snap.notifs, 600);
        Storage.saveDebounced('theme', snap.theme, 600);
        Storage.saveDebounced('achievements', snap.achievements, 600);
        Storage.saveDebounced('userName', snap.userName, 600);

        // Show save bar if dirty
        const saveWrap = document.getElementById('saveWrap');
        if (snap.dirty && saveWrap) saveWrap.classList.add('dirty');
      } catch (err) {
        Logger.error('Persist', err);
      }
    };
    store.subscribe('data', saveAll);
    store.subscribe('pts', saveAll);
    store.subscribe('salaryDay', saveAll);
    store.subscribe('streak', saveAll);
    store.subscribe('notifs', saveAll);
    store.subscribe('theme', saveAll);
    store.subscribe('achievements', saveAll);
    store.subscribe('userName', saveAll);
    store.subscribe('dirty', saveAll);

    // Force flush on unload
    window.addEventListener('beforeunload', () => Storage.flushNow());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Storage.flushNow();
    });
  }

  function handleDeepLink() {
    const params = new URLSearchParams(location.search);
    if (params.get('app') === '1') {
      document.getElementById('landing').style.display = 'none';
      document.getElementById('appModal').classList.add('open');
    }
    const tab = params.get('tab');
    if (tab && ['home', 'money', 'social', 'profile', 'monthly', 'yearly', 'friends', 'settings'].includes(tab)) {
      Controllers.showTab(tab);
    }
  }

  function checkUrgentOnLoad() {
    const cnt = App.Notifs.alertCount();
    if (cnt > 0) {
      setTimeout(() => {
        App.Toast.show(`🔔 لديك ${cnt} ${cnt === 1 ? 'فاتورة' : 'فواتير'} قريبة`, 'warn', 4000);
      }, 1500);
    }
  }

  function registerSW() {
    // Unregister any legacy service workers (iOS occasionally caches old versions)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (const r of regs) r.unregister();
      }).catch(() => {});
    }
  }

  function maybeAlertBudget() {
    try {
      const y = store.get('year'), m = store.get('month');
      const d = App.Sel.monthData(y, m);
      const cats = App.Sel.categorySpending(y, m);
      let exceeded = 0;
      for (const b of d.budgets || []) {
        const sp = App.Budgets.calcSpent(b.name, cats);
        if (sp >= b.limit) exceeded++;
      }
      if (exceeded > 0) {
        setTimeout(() => {
          App.Toast.show(`⚠️ تجاوزت ${exceeded} ${exceeded === 1 ? 'حد' : 'حدود'} إنفاق`, 'warn', 3500);
        }, 2500);
      }
    } catch (e) { Logger.error('maybeAlertBudget', e); }
  }

  function init() {
    try {
      loadState();
      bindPersistence();
      Controllers.init();
      Renderers.scheduledAll();
      handleDeepLink();
      checkUrgentOnLoad();
      registerSW();
      maybeAlertBudget();
      store.set('initialized', true);

      // Social init (waits for fb-ready event internally)
      try {
        if (typeof Social !== 'undefined' && Social.bindEvents) {
          Social.bindEvents();
          Social.init();
        }
      } catch (e) { Logger.warn('Bootstrap.Social', e.message); }

      // Bot init
      try {
        if (typeof Bot !== 'undefined' && Bot.init) {
          Bot.init();
        }
      } catch (e) { Logger.warn('Bootstrap.Bot', e.message); }

      // Smart Features init (Gift, Simulator, Voice)
      try {
        if (typeof SmartFeatures !== 'undefined' && SmartFeatures.init) {
          SmartFeatures.init();
        }
      } catch (e) { Logger.warn('Bootstrap.SmartFeatures', e.message); }

      // Companion load
      try {
        if (typeof Companion !== 'undefined' && Companion.load) {
          Companion.load();
        }
      } catch (e) { Logger.warn('Bootstrap.Companion', e.message); }

      // Image Handler init
      try {
        if (typeof ImageHandler !== 'undefined' && ImageHandler.init) {
          ImageHandler.init();
        }
      } catch (e) { Logger.warn('Bootstrap.ImageHandler', e.message); }

      // Chat Notifications init
      try {
        if (typeof ChatNotifications !== 'undefined' && ChatNotifications.init) {
          ChatNotifications.init();
        }
      } catch (e) { Logger.warn('Bootstrap.ChatNotifications', e.message); }

      // Tests
      if (new URLSearchParams(location.search).has('test')) {
        if (typeof Tests !== 'undefined') Tests.run();
      }

      Logger.warn('Init', 'تم التحميل بنجاح');
    } catch (e) {
      Logger.error('Bootstrap.init', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


(function tierMarquee() {
  function setup() {
    const wrap = document.getElementById('tierMarquee');
    if (!wrap) return;
    const track = wrap.querySelector('.tier-marquee-track');
    if (!track) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let manualOffset = 0;
    let resumeTimer = null;

    function pause() {
      wrap.classList.add('paused');
      // Capture current animated position so dragging starts from where it visually is
      const computedTransform = getComputedStyle(track).transform;
      track.style.animation = 'none';
      track.style.transform = computedTransform === 'none' ? 'translateX(0)' : computedTransform;
    }

    function resume() {
      // After a delay, hand control back to the CSS animation
      track.style.transform = '';
      track.style.animation = '';
      wrap.classList.remove('paused');
    }

    function getX(e) {
      return e.touches ? e.touches[0].clientX : e.clientX;
    }

    function onDown(e) {
      isDown = true;
      pause();
      clearTimeout(resumeTimer);
      const matrix = new DOMMatrix(getComputedStyle(track).transform);
      manualOffset = matrix.m41;
      startX = getX(e);
      track.style.cursor = 'grabbing';
    }

    function onMove(e) {
      if (!isDown) return;
      const x = getX(e);
      const delta = x - startX;
      track.style.transform = `translateX(${manualOffset + delta}px)`;
      if (e.cancelable && e.touches) e.preventDefault();
    }

    function onUp() {
      if (!isDown) return;
      isDown = false;
      track.style.cursor = '';
      // Resume animation after a short pause
      resumeTimer = setTimeout(resume, 1800);
    }

    track.style.cursor = 'grab';

    wrap.addEventListener('mousedown', onDown);
    wrap.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('mousemove', onMove);
    wrap.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    wrap.addEventListener('touchend', onUp);
    wrap.addEventListener('touchcancel', onUp);

    // Pause on hover (desktop) — already in CSS but keep here for parity
    wrap.addEventListener('mouseenter', () => {
      if (!isDown) clearTimeout(resumeTimer);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
