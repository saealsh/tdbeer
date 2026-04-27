/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Push Notifications Manager
   ───────────────────────────────────────────────────────────────────
   نظام تنبيهات احترافي:
   - طلب الإذن بطريقة لطيفة (مع تفسير)
   - تنبيهات داخل النظام (system-level)
   - جدولة ذكية (تذكيرات يومية، نهاية الشهر، إلخ)
   - تذكيرات قابلة للتخصيص
   - SW integration
═══════════════════════════════════════════════════════════════════ */

var PushNotifs = (() => {
  const STORAGE_KEY = 'pushNotifsConfig';
  const STORAGE_VERSION = 1;
  
  // إعدادات افتراضية
  const DEFAULT_CONFIG = {
    version: STORAGE_VERSION,
    enabled: false,
    permissionAsked: false,
    
    // أنواع التنبيهات
    types: {
      dailyReminder: { enabled: true, time: '20:00', label: 'تذكير يومي' },
      monthEnd: { enabled: true, daysBefore: 3, label: 'نهاية الشهر' },
      monthStart: { enabled: true, label: 'بداية شهر جديد' },
      budgetExceeded: { enabled: true, threshold: 90, label: 'تجاوز الميزانية' },
      goalProgress: { enabled: true, label: 'تقدم الأهداف' },
      streakReminder: { enabled: true, label: 'استمرار التسجيل' }
    },
    
    // آخر مرة عُرض كل تنبيه (لتجنب التكرار)
    lastShown: {}
  };
  
  let config = null;
  let initialized = false;
  
  /**
   * تحميل/حفظ الإعدادات
   */
  function loadConfig() {
    try {
      const stored = window.Storage?.load?.(STORAGE_KEY, null);
      if (stored && stored.version === STORAGE_VERSION) {
        config = { ...DEFAULT_CONFIG, ...stored, types: { ...DEFAULT_CONFIG.types, ...(stored.types || {}) } };
      } else {
        config = { ...DEFAULT_CONFIG };
      }
    } catch {
      config = { ...DEFAULT_CONFIG };
    }
    return config;
  }
  
  function saveConfig() {
    try {
      window.Storage?.save?.(STORAGE_KEY, config);
    } catch (e) {
      if (window.Logger) window.Logger.warn('PushNotifs.save', e?.message);
    }
  }
  
  /**
   * هل المتصفح يدعم Notifications؟
   */
  function isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }
  
  /**
   * حالة الإذن الحالية
   */
  function getPermission() {
    if (!isSupported()) return 'unsupported';
    return Notification.permission; // 'granted' | 'denied' | 'default'
  }
  
  /**
   * طلب الإذن (بدون السؤال الأول مباشرة)
   */
  async function requestPermission() {
    if (!isSupported()) {
      window.Toast?.show?.('متصفحك لا يدعم التنبيهات', 'warn');
      return false;
    }
    
    const current = Notification.permission;
    
    if (current === 'granted') {
      config.enabled = true;
      config.permissionAsked = true;
      saveConfig();
      return true;
    }
    
    if (current === 'denied') {
      window.Toast?.show?.('التنبيهات معطّلة من إعدادات المتصفح', 'warn', 5000);
      return false;
    }
    
    try {
      const result = await Notification.requestPermission();
      config.permissionAsked = true;
      
      if (result === 'granted') {
        config.enabled = true;
        saveConfig();
        
        // أرسل تنبيه ترحيبي
        showNotification({
          title: '🎉 التنبيهات مفعّلة!',
          body: 'سنذكّرك بمصاريفك ونحفّزك على التوفير',
          tag: 'welcome'
        });
        
        return true;
      } else {
        config.enabled = false;
        saveConfig();
        window.Toast?.show?.('تم رفض الإذن — يمكنك تفعيله لاحقاً من الإعدادات', 'info');
        return false;
      }
    } catch (e) {
      if (window.Logger) window.Logger.warn('PushNotifs.request', e?.message);
      return false;
    }
  }
  
  /**
   * عرض تنبيه (يستخدم SW لو متاح، وإلا notification API مباشر)
   */
  async function showNotification({ title, body, icon, tag, data = {}, actions = [] }) {
    if (!isSupported() || Notification.permission !== 'granted') {
      return false;
    }
    
    const options = {
      body: body || '',
      icon: icon || './icons/icon-192.png',
      badge: './icons/badge-72.png',
      tag: tag || 'default',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [100, 50, 100],
      data: { url: '/', ...data },
      requireInteraction: false,
      silent: false
    };
    
    // أضف actions لو متاحة (chrome/edge)
    if (actions.length > 0) {
      options.actions = actions;
    }
    
    try {
      // استخدم SW إن أمكن (يدعم background)
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg) {
          await reg.showNotification(title, options);
          
          // سجّل آخر مرة
          if (config) {
            config.lastShown[tag] = Date.now();
            saveConfig();
          }
          return true;
        }
      }
      
      // Fallback: Notification API مباشر
      const notif = new Notification(title, options);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      
      if (config) {
        config.lastShown[tag] = Date.now();
        saveConfig();
      }
      return true;
    } catch (e) {
      if (window.Logger) window.Logger.warn('PushNotifs.show', e?.message);
      return false;
    }
  }
  
  /**
   * تحقق من تنبيهات اليوم وأرسلها
   */
  function checkAndSendNotifications() {
    if (!config?.enabled) return;
    if (Notification.permission !== 'granted') return;
    
    const now = Date.now();
    const today = new Date();
    const dayOfMonth = today.getDate();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const remainingDays = lastDayOfMonth - dayOfMonth;
    
    // ─── 1. تذكير يومي (في الوقت المحدد) ───
    if (config.types.dailyReminder?.enabled) {
      const [h, m] = (config.types.dailyReminder.time || '20:00').split(':').map(Number);
      const targetTime = new Date();
      targetTime.setHours(h, m, 0, 0);
      
      const diff = Math.abs(now - targetTime.getTime());
      const last = config.lastShown['dailyReminder'] || 0;
      const lastDay = new Date(last);
      const isToday = lastDay.toDateString() === today.toDateString();
      
      // في وقت التذكير (±15 دقيقة) ولم يُعرض اليوم
      if (diff <= 15 * 60 * 1000 && !isToday) {
        const data = window.App?.store?.get('data') || {};
        const monthKey = `${today.getFullYear()}_m${today.getMonth()}`;
        const todayItems = data[monthKey]?.daily?.[dayOfMonth] || [];
        
        if (todayItems.length === 0) {
          showNotification({
            title: '💸 تذكير يومي',
            body: 'هل سجّلت مصاريف اليوم؟ افتح التطبيق وسجّل بسرعة',
            tag: 'dailyReminder',
            data: { url: '/?action=add-expense' }
          });
        } else {
          const total = todayItems.reduce((s, i) => s + (i.type !== 'in' ? (i.amt || 0) : 0), 0);
          if (total > 0) {
            showNotification({
              title: `📊 ملخص اليوم: ${Math.round(total)} ﷼`,
              body: `سجّلت ${todayItems.length} عملية. استمر في التتبّع!`,
              tag: 'dailyReminder'
            });
          }
        }
      }
    }
    
    // ─── 2. نهاية الشهر ───
    if (config.types.monthEnd?.enabled) {
      const daysBefore = config.types.monthEnd.daysBefore || 3;
      const last = config.lastShown['monthEnd'] || 0;
      const lastDay = new Date(last);
      const isShownThisMonth = lastDay.getMonth() === today.getMonth() 
                            && lastDay.getFullYear() === today.getFullYear();
      
      if (remainingDays <= daysBefore && remainingDays > 0 && !isShownThisMonth) {
        showNotification({
          title: `🔔 ${remainingDays} ${remainingDays === 1 ? 'يوم' : 'أيام'} متبقية`,
          body: 'الشهر يقارب على النهاية — راجع ميزانيتك',
          tag: 'monthEnd',
          data: { url: '/?tab=monthly' }
        });
      }
    }
    
    // ─── 3. بداية شهر جديد ───
    if (config.types.monthStart?.enabled && dayOfMonth <= 2) {
      const last = config.lastShown['monthStart'] || 0;
      const lastDate = new Date(last);
      const isShownThisMonth = lastDate.getMonth() === today.getMonth() 
                            && lastDate.getFullYear() === today.getFullYear();
      
      if (!isShownThisMonth) {
        showNotification({
          title: '🗓️ شهر جديد، فرصة جديدة',
          body: 'سجّل راتبك ومصاريفك الثابتة لبداية موفقة',
          tag: 'monthStart',
          data: { url: '/?action=add-income' }
        });
      }
    }
    
    // ─── 4. تجاوز الميزانية ───
    if (config.types.budgetExceeded?.enabled) {
      const threshold = config.types.budgetExceeded.threshold || 90;
      const year = window.App?.store?.get('year');
      const month = window.App?.store?.get('month');
      
      if (window.App?.Sel?.totals) {
        try {
          const totals = window.App.Sel.totals(year, month);
          if (totals.income > 0) {
            const spentPct = (totals.expense / totals.income) * 100;
            const last = config.lastShown['budgetExceeded'] || 0;
            const hoursPassed = (now - last) / (1000 * 60 * 60);
            
            // عرض كل 24 ساعة
            if (spentPct >= threshold && hoursPassed >= 24) {
              showNotification({
                title: '⚠️ تجاوزت ميزانيتك!',
                body: `صرفت ${spentPct.toFixed(0)}% من دخل الشهر (${threshold}% الحد)`,
                tag: 'budgetExceeded',
                requireInteraction: true,
                data: { url: '/?tab=monthly' }
              });
            }
          }
        } catch {}
      }
    }
  }
  
  /**
   * بطاقة طلب الإذن (Soft prompt)
   * تظهر داخل التطبيق قبل طلب الإذن الفعلي
   */
  function showPermissionPrompt() {
    if (!isSupported()) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    if (config?.permissionAsked) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'push-prompt-overlay';
    overlay.innerHTML = `
      <div class="push-prompt-card">
        <div class="push-prompt-icon">🔔</div>
        <h3 class="push-prompt-title">فعّل التنبيهات</h3>
        <p class="push-prompt-desc">
          خلّينا نذكّرك بمصاريفك ونحفّزك على التوفير. 
          ما نرسل أكثر من ٣ تنبيهات في الأسبوع.
        </p>
        <ul class="push-prompt-list">
          <li>📅 تذكير يومي (اختياري)</li>
          <li>⚠️ تنبيه عند تجاوز الميزانية</li>
          <li>🎉 تشجيع عند تحقيق الأهداف</li>
        </ul>
        <div class="push-prompt-actions">
          <button class="push-prompt-skip">ليس الآن</button>
          <button class="push-prompt-allow">فعّل التنبيهات 🔔</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // animation
    setTimeout(() => overlay.classList.add('show'), 50);
    
    // bind
    overlay.querySelector('.push-prompt-skip').onclick = () => {
      config.permissionAsked = true;
      saveConfig();
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
    };
    
    overlay.querySelector('.push-prompt-allow').onclick = async () => {
      const granted = await requestPermission();
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
      
      if (granted) {
        window.Toast?.show?.('تم تفعيل التنبيهات بنجاح! 🎉', 'success');
      }
    };
  }
  
  /**
   * تحديث إعداد معيّن
   */
  function updateSetting(type, key, value) {
    if (!config?.types?.[type]) return;
    config.types[type][key] = value;
    saveConfig();
  }
  
  /**
   * تشغيل/إيقاف نوع كامل
   */
  function toggleType(type) {
    if (!config?.types?.[type]) return false;
    config.types[type].enabled = !config.types[type].enabled;
    saveConfig();
    return config.types[type].enabled;
  }
  
  /**
   * تشغيل/إيقاف الكل
   */
  async function toggleEnabled() {
    if (!config.enabled) {
      // محاولة تفعيل
      const granted = await requestPermission();
      return granted;
    } else {
      config.enabled = false;
      saveConfig();
      return false;
    }
  }
  
  /**
   * إرسال تنبيه تجريبي
   */
  function sendTestNotification() {
    if (Notification.permission !== 'granted') {
      window.Toast?.show?.('فعّل التنبيهات أولاً', 'warn');
      return;
    }
    
    showNotification({
      title: '🧪 تنبيه تجريبي',
      body: 'يعمل! سيصلك تنبيهات مماثلة عند الحاجة',
      tag: 'test-' + Date.now()
    });
    
    window.Toast?.show?.('تم إرسال التنبيه التجريبي', 'success');
  }
  
  /**
   * Init
   */
  function init() {
    if (initialized) return;
    initialized = true;
    
    loadConfig();
    
    // تحقق من التنبيهات كل 15 دقيقة
    if (window.Performance?.scheduleEvery) {
      window.Performance.scheduleEvery(15 * 60 * 1000, checkAndSendNotifications, 'push-notifs');
    } else {
      setInterval(checkAndSendNotifications, 15 * 60 * 1000);
    }
    
    // فحص أولي بعد 5 ثواني
    setTimeout(checkAndSendNotifications, 5000);
    
    // اعرض prompt للمستخدم بعد فترة (إذا لم يُسأل بعد)
    if (!config.permissionAsked && getPermission() === 'default') {
      // انتظر للحظة مناسبة (بعد ما يستخدم التطبيق قليلاً)
      setTimeout(() => {
        // فقط لو في بيانات (مش first-time)
        const data = window.App?.store?.get('data');
        const hasData = data && Object.keys(data).length > 0;
        if (hasData) {
          showPermissionPrompt();
        }
      }, 30000); // بعد 30 ثانية من فتح التطبيق
    }
  }
  
  return {
    init,
    isSupported,
    getPermission,
    requestPermission,
    showNotification,
    showPermissionPrompt,
    updateSetting,
    toggleType,
    toggleEnabled,
    sendTestNotification,
    checkAndSendNotifications,
    getConfig: () => ({ ...config })
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.PushNotifs = PushNotifs;
window.PushNotifs = PushNotifs;
