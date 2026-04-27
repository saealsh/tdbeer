/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Diagnostics & Health Check
   ───────────────────────────────────────────────────────────────────
   Production-grade utilities:
   - Health check (modules loaded, services online)
   - Error banner fallback للـ critical errors
   - Storage usage check
   - Network status monitoring
   - System info (للدعم الفني)
═══════════════════════════════════════════════════════════════════ */

var Diagnostics = (() => {
  let initialized = false;
  let errorCount = 0;
  let lastErrorTime = 0;
  
  /**
   * Health check - تحقق من حالة كل شي
   */
  function healthCheck() {
    const checks = {
      timestamp: new Date().toISOString(),
      version: window.__APP_VERSION__ || 'unknown',
      online: navigator.onLine,
      
      // Core modules
      modules: {
        Logger: !!window.Logger,
        Toast: !!window.Toast,
        Storage: !!window.Storage,
        App: !!window.App,
        Renderers: !!window.Renderers,
        Performance: !!window.Performance,
        UIPolish: !!window.UIPolish
      },
      
      // Features
      features: {
        FabController: !!window.FabController,
        UnreadBadges: !!window.UnreadBadges,
        MoneyInsights: !!window.MoneyInsights,
        Onboarding: !!window.Onboarding,
        YearlyCharts: !!window.YearlyCharts,
        SmartSearch: !!window.SmartSearch,
        Heatmap: !!window.Heatmap,
        PushNotifs: !!window.PushNotifs
      },
      
      // Browser capabilities
      capabilities: {
        serviceWorker: 'serviceWorker' in navigator,
        notifications: 'Notification' in window,
        storage: 'localStorage' in window,
        intersection: 'IntersectionObserver' in window,
        idleCallback: 'requestIdleCallback' in window,
        webShare: 'share' in navigator,
        webAuthn: 'credentials' in navigator
      },
      
      // Performance metrics (if available)
      performance: getPerformanceMetrics(),
      
      // Storage usage
      storage: getStorageInfo(),
      
      // Errors
      errors: {
        total: errorCount,
        recent: window.Logger?.getErrors?.()?.slice(-5) || []
      }
    };
    
    return checks;
  }
  
  /**
   * Performance metrics (Lighthouse-like)
   */
  function getPerformanceMetrics() {
    if (!window.performance) return null;
    
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(p => p.name === 'first-contentful-paint');
      
      return {
        loadTime: nav ? Math.round(nav.loadEventEnd - nav.fetchStart) : null,
        domReady: nav ? Math.round(nav.domContentLoadedEventEnd - nav.fetchStart) : null,
        firstContentfulPaint: fcp ? Math.round(fcp.startTime) : null,
        memory: performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + 'MB'
        } : null
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Storage info
   */
  function getStorageInfo() {
    try {
      let usedBytes = 0;
      let itemCount = 0;
      const tdbeerKeys = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (key && value) {
          usedBytes += key.length + value.length;
          itemCount++;
          if (key.startsWith('td_')) tdbeerKeys.push(key);
        }
      }
      
      return {
        usedBytes,
        usedKB: Math.round(usedBytes / 1024 * 100) / 100,
        itemCount,
        tdbeerKeys: tdbeerKeys.length,
        // Estimate quota (5MB typical)
        estimatedQuota: '~5MB',
        percentUsed: Math.round(usedBytes / (5 * 1024 * 1024) * 100)
      };
    } catch {
      return { error: 'unavailable' };
    }
  }
  
  /**
   * عرض error banner (للأخطاء الحرجة)
   */
  function showErrorBanner({ title, message, duration = 5000 }) {
    // إزالة banner سابق
    const existing = document.querySelector('.app-error-banner');
    if (existing) existing.remove();
    
    const banner = document.createElement('div');
    banner.className = 'app-error-banner';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
      <div class="app-error-icon">⚠️</div>
      <div class="app-error-content">
        <div class="app-error-title">${title || 'حدث خطأ'}</div>
        <div class="app-error-msg">${message || 'حاول مرة أخرى'}</div>
      </div>
      <button class="app-error-close" aria-label="إغلاق">✕</button>
    `;
    
    document.body.appendChild(banner);
    
    // Animation
    requestAnimationFrame(() => banner.classList.add('show'));
    
    // Close
    const close = () => {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 400);
    };
    
    banner.querySelector('.app-error-close').addEventListener('click', close);
    
    // Auto-close
    if (duration > 0) {
      setTimeout(close, duration);
    }
    
    return { close };
  }
  
  /**
   * Network status monitoring
   */
  function setupNetworkMonitor() {
    let wasOffline = !navigator.onLine;
    
    window.addEventListener('online', () => {
      if (wasOffline) {
        wasOffline = false;
        window.Toast?.show?.('🌐 عاد الاتصال بالإنترنت', 'success', 3000);
      }
    });
    
    window.addEventListener('offline', () => {
      wasOffline = true;
      window.Toast?.show?.('⚠️ لا يوجد اتصال بالإنترنت — لا تقلق، التطبيق يعمل offline', 'warn', 4000);
    });
  }
  
  /**
   * مراقبة الأخطاء وعرض banner للأخطاء المتكررة
   */
  function setupErrorMonitor() {
    if (!window.Logger?.addSink) return;
    
    window.Logger.addSink((entry) => {
      if (entry.level === 'error') {
        errorCount++;
        const now = Date.now();
        
        // 3 أخطاء في 30 ثانية → اعرض banner
        if (now - lastErrorTime < 30000 && errorCount > 3) {
          showErrorBanner({
            title: 'مشكلة في التطبيق',
            message: 'إذا استمرت، حدّث الصفحة',
            duration: 6000
          });
          errorCount = 0; // Reset
        }
        
        lastErrorTime = now;
      }
    });
  }
  
  /**
   * Storage cleanup - تنظيف القيم القديمة (لو موجودة)
   */
  function cleanupOldStorage() {
    try {
      const keys = Object.keys(localStorage);
      const oldPrefixes = ['old_', 'tmp_', 'cache_old_'];
      let cleaned = 0;
      
      keys.forEach(key => {
        if (oldPrefixes.some(p => key.startsWith(p))) {
          localStorage.removeItem(key);
          cleaned++;
        }
      });
      
      if (cleaned > 0 && window.Logger) {
        window.Logger.info('Diagnostics', `Cleaned ${cleaned} old storage keys`);
      }
    } catch {}
  }
  
  /**
   * عرض system info للمستخدم (للدعم الفني)
   */
  function showSystemInfo() {
    const info = healthCheck();
    
    const html = `
      <div style="font-family:monospace;font-size:11px;line-height:1.6;direction:ltr;text-align:left">
        <strong>Version:</strong> ${info.version}<br>
        <strong>Online:</strong> ${info.online ? '✅' : '❌'}<br>
        <strong>Modules:</strong> ${Object.values(info.modules).filter(Boolean).length}/${Object.keys(info.modules).length}<br>
        <strong>Features:</strong> ${Object.values(info.features).filter(Boolean).length}/${Object.keys(info.features).length}<br>
        <strong>Storage:</strong> ${info.storage.usedKB}KB (${info.storage.itemCount} items)<br>
        <strong>Memory:</strong> ${info.performance?.memory?.used || 'N/A'}<br>
        <strong>Errors:</strong> ${info.errors.total}<br>
      </div>
    `;
    
    return html;
  }
  
  /**
   * Export diagnostics report
   */
  function exportReport() {
    try {
      const report = healthCheck();
      const json = JSON.stringify(report, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tdbeer-diagnostics-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      window.Toast?.show?.('تم تنزيل تقرير التشخيص', 'success');
    } catch (e) {
      if (window.Logger) window.Logger.error('Diagnostics.export', e?.message);
      window.Toast?.show?.('فشل تصدير التقرير', 'danger');
    }
  }
  
  /**
   * Init
   */
  function init() {
    if (initialized) return;
    initialized = true;
    
    // Setup monitors
    setupNetworkMonitor();
    setupErrorMonitor();
    
    // Cleanup قديم بعد فترة
    if (window.Performance?.runWhenIdle) {
      window.Performance.runWhenIdle(cleanupOldStorage, { timeout: 5000 });
    } else {
      setTimeout(cleanupOldStorage, 5000);
    }
    
    // اعرض welcome في الـ console للمطورين
    if (window.console?.log) {
      const isDev = location.hostname === 'localhost' 
                 || location.hostname === '127.0.0.1';
      
      if (isDev) {
        console.log(
          '%c تـدّبير %c v5.0.0 ',
          'background:#01dd8c;color:#0a0a0a;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:bold',
          'background:#c9a84c;color:#0a0a0a;padding:4px 8px;border-radius:0 4px 4px 0;font-weight:bold'
        );
        console.log('💡 Diagnostics:', 'window.Diagnostics.healthCheck()');
        console.log('📊 Stats:', 'window.Performance.getStats()');
      }
    }
  }
  
  return {
    init,
    healthCheck,
    showErrorBanner,
    showSystemInfo,
    exportReport,
    cleanupOldStorage,
    getPerformanceMetrics,
    getStorageInfo
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.Diagnostics = Diagnostics;
window.Diagnostics = Diagnostics;
