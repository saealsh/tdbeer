/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — UI Polish Manager
   ───────────────────────────────────────────────────────────────────
   Micro-interactions:
   - Number count-up animations
   - Smooth value transitions
   - Ripple effects
   - Loading state management
═══════════════════════════════════════════════════════════════════ */

var UIPolish = (() => {
  let initialized = false;
  
  /**
   * احفظ آخر قيمة لكل عنصر للمقارنة
   */
  const lastValues = new WeakMap();
  
  /**
   * Animate number change (count-up effect)
   */
  function animateNumber(element, targetValue, options = {}) {
    if (!element) return;
    
    const {
      duration = 800,
      easing = 'ease-out',
      formatter = (v) => Math.round(v).toLocaleString('ar-SA')
    } = options;
    
    const currentText = element.textContent || '0';
    const currentValue = parseFloat(currentText.replace(/[^\d.-]/g, '')) || 0;
    
    if (currentValue === targetValue) return;
    
    const startTime = performance.now();
    const diff = targetValue - currentValue;
    
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = currentValue + diff * eased;
      
      element.textContent = formatter(value);
      
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        element.textContent = formatter(targetValue);
        // Pulse effect عند الانتهاء
        element.classList.add('number-update');
        setTimeout(() => element.classList.remove('number-update'), 600);
      }
    }
    
    requestAnimationFrame(tick);
  }
  
  /**
   * Smooth value update with comparison
   */
  function updateValue(element, newValue, options = {}) {
    if (!element) return;
    
    const lastValue = lastValues.get(element);
    
    // فقط لو القيمة فعلاً تغيّرت
    if (lastValue !== newValue) {
      animateNumber(element, newValue, options);
      lastValues.set(element, newValue);
    }
  }
  
  /**
   * Ripple effect على الـ click
   */
  function attachRipple(element) {
    if (!element || element.dataset.rippleAttached) return;
    element.dataset.rippleAttached = 'true';
    element.classList.add('ripple');
  }
  
  /**
   * Confetti effect (للنجاحات)
   */
  function celebrateSuccess(originElement) {
    if (!originElement) return;
    
    const rect = originElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const colors = ['#01dd8c', '#c9a84c', '#10b981', '#f0d98a'];
    const particleCount = 12;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: fixed;
        left: ${centerX}px;
        top: ${centerY}px;
        width: 8px;
        height: 8px;
        background: ${colors[i % colors.length]};
        border-radius: 50%;
        pointer-events: none;
        z-index: 99999;
        opacity: 1;
      `;
      
      document.body.appendChild(particle);
      
      const angle = (i / particleCount) * Math.PI * 2;
      const velocity = 80 + Math.random() * 40;
      const endX = Math.cos(angle) * velocity;
      const endY = Math.sin(angle) * velocity - 20;
      
      requestAnimationFrame(() => {
        particle.style.transition = 'transform 600ms cubic-bezier(0.4, 0, 0.6, 1), opacity 600ms';
        particle.style.transform = `translate(${endX}px, ${endY}px) scale(0)`;
        particle.style.opacity = '0';
      });
      
      setTimeout(() => particle.remove(), 700);
    }
  }
  
  /**
   * Smooth scroll to element
   */
  function smoothScrollTo(element, options = {}) {
    if (!element) return;
    
    const { offset = 80, behavior = 'smooth' } = options;
    
    const rect = element.getBoundingClientRect();
    const targetY = window.pageYOffset + rect.top - offset;
    
    window.scrollTo({
      top: targetY,
      behavior
    });
  }
  
  /**
   * Highlight element مؤقتاً
   */
  function highlightElement(element, duration = 1500) {
    if (!element) return;
    
    const original = {
      transition: element.style.transition,
      boxShadow: element.style.boxShadow,
      borderColor: element.style.borderColor
    };
    
    element.style.transition = 'all 300ms ease';
    element.style.boxShadow = '0 0 0 4px var(--accent-dim), 0 0 30px var(--accent-glow)';
    element.style.borderColor = 'var(--accent)';
    
    setTimeout(() => {
      element.style.boxShadow = original.boxShadow;
      element.style.borderColor = original.borderColor;
      setTimeout(() => {
        element.style.transition = original.transition;
      }, 300);
    }, duration);
  }
  
  /**
   * Auto-attach ripple للأزرار الرئيسية
   */
  function setupRipples() {
    const selectors = [
      '.btn-primary',
      '.fab-action',
      '.search-quick-action',
      '.onb-next',
      '.me-btn-save',
      '.push-prompt-allow',
      '.year-action-btn'
    ];
    
    document.querySelectorAll(selectors.join(',')).forEach(attachRipple);
  }
  
  /**
   * Watch DOM للـ ripple (للعناصر الجديدة)
   */
  function watchForNewElements() {
    if (!('MutationObserver' in window)) return;
    
    const observer = new MutationObserver(() => {
      // Performance: استخدم runWhenIdle
      if (window.Performance?.runWhenIdle) {
        window.Performance.runWhenIdle(setupRipples);
      } else {
        setupRipples();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * Polish: عند تحديث bank balance، اعمل count-up
   */
  function setupBankBalanceAnimation() {
    if (!window.App?.store) return;
    
    let firstUpdate = true;
    window.App.store.subscribe('data', () => {
      // تأخير صغير للسماح للـ renderers بالتحديث
      setTimeout(() => {
        // فقط لو مش أول مرة
        if (firstUpdate) {
          firstUpdate = false;
          return;
        }
        
        const bankBalEl = document.getElementById('bankBalVal');
        if (bankBalEl) {
          const target = parseFloat(bankBalEl.textContent.replace(/[^\d.-]/g, '')) || 0;
          const lastVal = lastValues.get(bankBalEl) || 0;
          
          if (Math.abs(target - lastVal) > 0.5) {
            updateValue(bankBalEl, target, {
              duration: 800,
              formatter: (v) => Math.round(v).toLocaleString('ar-SA')
            });
          }
        }
      }, 100);
    });
  }
  
  /**
   * Skip-to-content link (accessibility)
   */
  function setupSkipLink() {
    if (document.querySelector('.skip-to-content')) return;
    
    const link = document.createElement('a');
    link.href = '#tab-monthly';
    link.className = 'skip-to-content';
    link.textContent = 'انتقل للمحتوى الرئيسي';
    document.body.prepend(link);
  }
  
  /**
   * Init
   */
  function init() {
    if (initialized) return;
    initialized = true;
    
    // Setup كل التحسينات
    setTimeout(() => {
      setupSkipLink();
      setupRipples();
      watchForNewElements();
      setupBankBalanceAnimation();
    }, 1000);
  }
  
  return {
    init,
    animateNumber,
    updateValue,
    attachRipple,
    celebrateSuccess,
    smoothScrollTo,
    highlightElement
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.UIPolish = UIPolish;
window.UIPolish = UIPolish;
