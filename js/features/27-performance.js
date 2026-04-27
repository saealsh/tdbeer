/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Performance Manager
   ───────────────────────────────────────────────────────────────────
   يدير:
   - Idle Queue: تأجيل العمليات غير الحرجة
   - Visibility-aware updates: إيقاف العمليات عند خفاء التطبيق
   - Centralized scheduler: دمج الـ setIntervals
   - Connection-aware: تقليل العمل على بطء الإنترنت
   - Lazy DOM observer
═══════════════════════════════════════════════════════════════════ */

var Performance = (() => {
  let initialized = false;
  let isVisible = true;
  let isSlowConnection = false;
  
  // Idle queue للمهام غير الحرجة
  const idleQueue = [];
  let idleHandle = null;
  
  // Scheduled tasks (للدمج)
  const scheduledTasks = new Map();
  
  /**
   * تشغيل function عند idle (browser غير مشغول)
   * يدعم requestIdleCallback أو fallback لـ setTimeout
   */
  function runWhenIdle(fn, { timeout = 2000, label = 'task' } = {}) {
    if (typeof window.requestIdleCallback === 'function') {
      return window.requestIdleCallback(fn, { timeout });
    }
    // Fallback: setTimeout بعد main thread
    return setTimeout(() => {
      try { fn({ didTimeout: false, timeRemaining: () => 50 }); } 
      catch (e) { 
        if (window.Logger) window.Logger.warn(`Performance.${label}`, e?.message); 
      }
    }, 1);
  }
  
  /**
   * أضف مهمة للـ idle queue
   */
  function queueIdle(fn, label = 'task') {
    idleQueue.push({ fn, label });
    processIdleQueue();
  }
  
  /**
   * معالجة الـ queue تدريجياً
   */
  function processIdleQueue() {
    if (idleHandle || idleQueue.length === 0) return;
    
    idleHandle = runWhenIdle((deadline) => {
      while (idleQueue.length > 0 && deadline.timeRemaining() > 5) {
        const { fn, label } = idleQueue.shift();
        try { fn(); } catch (e) {
          if (window.Logger) window.Logger.warn(`Performance.idle.${label}`, e?.message);
        }
      }
      idleHandle = null;
      
      // إذا لسه فيه مهام، استكمل
      if (idleQueue.length > 0) {
        processIdleQueue();
      }
    });
  }
  
  /**
   * Schedule مهمة دورية (مع دمج في tick واحد)
   */
  function scheduleEvery(interval, fn, label) {
    if (scheduledTasks.has(label)) {
      clearInterval(scheduledTasks.get(label).id);
    }
    
    const id = setInterval(() => {
      // لا تشغّل لو التطبيق مخفي
      if (!isVisible) return;
      
      // لا تشغّل لو الإنترنت بطيء (للمهام غير الحرجة)
      if (isSlowConnection && interval < 30000) return;
      
      try { fn(); } catch (e) {
        if (window.Logger) window.Logger.warn(`Performance.scheduled.${label}`, e?.message);
      }
    }, interval);
    
    scheduledTasks.set(label, { id, interval, fn });
    return id;
  }
  
  /**
   * إلغاء مهمة دورية
   */
  function cancelSchedule(label) {
    if (scheduledTasks.has(label)) {
      clearInterval(scheduledTasks.get(label).id);
      scheduledTasks.delete(label);
    }
  }
  
  /**
   * فحص الـ connection
   */
  function checkConnection() {
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!conn) return;
      
      // 2g أو slow-2g = بطيء
      const slowTypes = ['slow-2g', '2g'];
      isSlowConnection = slowTypes.includes(conn.effectiveType) || conn.saveData === true;
      
      if (window.Logger && isSlowConnection) {
        window.Logger.info('Performance', `Slow connection detected: ${conn.effectiveType}`);
      }
    } catch {}
  }
  
  /**
   * Lazy load CSS file (بعد load)
   */
  function lazyLoadCSS(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = 'print';
    link.onload = () => link.media = 'all';
    document.head.appendChild(link);
  }
  
  /**
   * Lazy load script (إذا احتجناه)
   */
  function lazyLoadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  /**
   * Optimize images - lazy loading
   */
  function setupLazyImages() {
    if (!('IntersectionObserver' in window)) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '50px' });
    
    // Observe كل الصور بـ data-src
    document.querySelectorAll('img[data-src]').forEach(img => {
      observer.observe(img);
    });
  }
  
  /**
   * Debounce helper (محسّن)
   */
  function debounce(fn, delay = 200) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
  
  /**
   * Throttle helper
   */
  function throttle(fn, limit = 100) {
    let lastRun = 0;
    let timer = null;
    return function (...args) {
      const now = Date.now();
      const remaining = limit - (now - lastRun);
      
      if (remaining <= 0) {
        clearTimeout(timer);
        timer = null;
        lastRun = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          lastRun = Date.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }
  
  /**
   * Pause all background tasks (للحفاظ على البطارية)
   */
  function pauseAll() {
    isVisible = false;
    if (window.Logger) window.Logger.info('Performance', 'Paused background tasks');
  }
  
  function resumeAll() {
    isVisible = true;
    if (window.Logger) window.Logger.info('Performance', 'Resumed background tasks');
  }
  
  /**
   * إحصائيات أداء
   */
  function getStats() {
    return {
      visible: isVisible,
      slowConnection: isSlowConnection,
      idleQueueSize: idleQueue.length,
      scheduledTasks: scheduledTasks.size,
      taskLabels: Array.from(scheduledTasks.keys())
    };
  }
  
  /**
   * Init
   */
  function init() {
    if (initialized) return;
    initialized = true;
    
    // 1. Visibility API
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        pauseAll();
      } else {
        resumeAll();
      }
    });
    
    // 2. Connection API
    checkConnection();
    try {
      const conn = navigator.connection;
      if (conn?.addEventListener) {
        conn.addEventListener('change', checkConnection);
      }
    } catch {}
    
    // 3. Setup lazy images
    runWhenIdle(setupLazyImages);
    
    // 4. Cleanup on page unload
    window.addEventListener('pagehide', () => {
      scheduledTasks.forEach(t => clearInterval(t.id));
      scheduledTasks.clear();
      idleQueue.length = 0;
    });
    
    // 5. Log أن الـ Performance Manager started
    if (window.Logger) {
      window.Logger.info('Performance', 'Manager initialized');
    }
  }
  
  return {
    init,
    runWhenIdle,
    queueIdle,
    scheduleEvery,
    cancelSchedule,
    lazyLoadCSS,
    lazyLoadScript,
    debounce,
    throttle,
    pauseAll,
    resumeAll,
    getStats,
    isVisible: () => isVisible,
    isSlowConnection: () => isSlowConnection
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.Performance = Performance;
window.Performance = Performance;
