/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Onboarding Manager
   ───────────────────────────────────────────────────────────────────
   تجربة مستخدم جديد:
   1. Welcome screens (3 شاشات)
   2. Setup wizard (الراتب، الأهداف)
   3. First-time tooltips
═══════════════════════════════════════════════════════════════════ */

var Onboarding = (() => {
  const STORAGE_KEY = 'onboardingDone';
  const STORAGE_VERSION = 1;
  
  let initialized = false;
  let currentScreen = 0;
  let userData = {
    name: '',
    salary: 0,
    goal: '',
    goalAmount: 0
  };
  
  // ═══ Welcome Screens Content ═══
  const SCREENS = [
    {
      id: 'welcome',
      icon: '👋',
      title: 'أهلاً بك في تـدّبير',
      subtitle: 'مخططك المالي الذكي',
      description: 'تطبيق يساعدك تنظّم فلوسك بطريقة سهلة وذكية، ويرافقك يومياً عشان توصل لأهدافك المالية.',
      features: [
        { icon: '📊', text: 'تتبّع دخلك ومصاريفك' },
        { icon: '🎯', text: 'حدّد أهداف وحقّقها' },
        { icon: '🤖', text: 'تنبيهات ذكية واقتراحات' }
      ],
      ctaText: 'يلا نبدأ →',
      skipText: ''
    },
    {
      id: 'features',
      icon: '✨',
      title: 'كل اللي تحتاجه في مكان واحد',
      subtitle: 'ميزات قوية، تجربة بسيطة',
      description: '',
      features: [
        { icon: '📸', text: 'مسح الفواتير بالكاميرا' },
        { icon: '🎤', text: 'إدخال صوتي بدون كتابة' },
        { icon: '📅', text: 'تقويم بصري لمصاريفك' },
        { icon: '🏦', text: 'محاكي القروض والأقساط' },
        { icon: '🏆', text: 'تحديات ادخارية تحفيزية' },
        { icon: '🎉', text: 'تقريرك السنوي بشكل ممتع' }
      ],
      ctaText: 'كمّل →',
      skipText: 'تخطّي'
    },
    {
      id: 'privacy',
      icon: '🔒',
      title: 'خصوصيتك أولوية',
      subtitle: 'بياناتك بياناتك فقط',
      description: 'كل بياناتك المالية محفوظة في جهازك. ما نشاركها مع أي طرف ثالث، ولا نستخدمها لإعلانات.',
      features: [
        { icon: '💾', text: 'تخزين محلي على جهازك' },
        { icon: '☁️', text: 'مزامنة اختيارية فقط' },
        { icon: '🚫', text: 'لا إعلانات، لا تتبّع' }
      ],
      ctaText: 'فهمت →',
      skipText: 'تخطّي'
    }
  ];
  
  /**
   * تحقق إذا المستخدم جديد
   */
  function isFirstRun() {
    try {
      const done = window.Storage?.load?.(STORAGE_KEY, null);
      if (!done) return true;
      // إذا فيه نسخة قديمة، اعتبره مكتمل (لتجنب إزعاجه)
      return false;
    } catch {
      return false;
    }
  }
  
  /**
   * علامة الانتهاء
   */
  function markDone(skipped = false) {
    try {
      window.Storage?.save?.(STORAGE_KEY, {
        version: STORAGE_VERSION,
        completedAt: Date.now(),
        skipped,
        userData
      });
    } catch (e) {
      if (window.Logger) window.Logger.warn('Onboarding.markDone', e?.message);
    }
  }
  
  /**
   * بناء HTML الشاشة
   */
  function buildScreenHTML(screen, index, total) {
    return `
      <div class="onb-screen" data-screen-id="${screen.id}">
        <div class="onb-progress">
          ${Array.from({length: total}, (_, i) => 
            `<div class="onb-dot ${i === index ? 'active' : i < index ? 'done' : ''}"></div>`
          ).join('')}
        </div>
        
        <div class="onb-content">
          <div class="onb-icon">${screen.icon}</div>
          <h1 class="onb-title">${screen.title}</h1>
          <div class="onb-subtitle">${screen.subtitle}</div>
          ${screen.description ? `<p class="onb-desc">${screen.description}</p>` : ''}
          
          <div class="onb-features">
            ${screen.features.map(f => `
              <div class="onb-feature">
                <span class="onb-feature-icon">${f.icon}</span>
                <span class="onb-feature-text">${f.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="onb-footer">
          ${screen.skipText ? `<button class="onb-skip">${screen.skipText}</button>` : '<div></div>'}
          <button class="onb-next">${screen.ctaText}</button>
        </div>
      </div>
    `;
  }
  
  /**
   * بناء Setup Wizard - الخطوة الأخيرة
   */
  function buildWizardHTML() {
    return `
      <div class="onb-screen onb-wizard" data-screen-id="wizard">
        <div class="onb-progress">
          <div class="onb-dot done"></div>
          <div class="onb-dot done"></div>
          <div class="onb-dot done"></div>
          <div class="onb-dot active"></div>
        </div>
        
        <div class="onb-content onb-wizard-content">
          <div class="onb-icon">🚀</div>
          <h1 class="onb-title">إعداد سريع</h1>
          <div class="onb-subtitle">3 معلومات أساسية فقط</div>
          
          <div class="onb-form">
            <!-- الاسم -->
            <div class="onb-field">
              <label class="onb-label">
                ما اسمك؟ 
                <span class="onb-hint">(اختياري)</span>
              </label>
              <input type="text" id="onbName" class="onb-input" 
                placeholder="أحمد، نورة، إلخ" maxlength="30" autocomplete="given-name">
            </div>
            
            <!-- الراتب -->
            <div class="onb-field">
              <label class="onb-label">
                دخلك الشهري التقريبي؟
                <span class="onb-hint">(اختياري - يساعدنا بالتحليل)</span>
              </label>
              <div class="onb-input-wrapper">
                <input type="number" id="onbSalary" class="onb-input" 
                  placeholder="مثل: 8000" min="0" step="500" inputmode="decimal">
                <span class="onb-input-suffix">﷼</span>
              </div>
              <div class="onb-quick-amounts">
                <button type="button" class="onb-amount-chip" data-amt="3000">3,000</button>
                <button type="button" class="onb-amount-chip" data-amt="5000">5,000</button>
                <button type="button" class="onb-amount-chip" data-amt="8000">8,000</button>
                <button type="button" class="onb-amount-chip" data-amt="12000">12,000</button>
                <button type="button" class="onb-amount-chip" data-amt="20000">20,000</button>
              </div>
            </div>
            
            <!-- الهدف -->
            <div class="onb-field">
              <label class="onb-label">
                وش هدفك المالي؟
                <span class="onb-hint">(اختياري)</span>
              </label>
              <div class="onb-goals-grid">
                <button type="button" class="onb-goal-btn" data-goal="save">
                  <span class="onb-goal-icon">💰</span>
                  <span class="onb-goal-text">ادّخر فلوس</span>
                </button>
                <button type="button" class="onb-goal-btn" data-goal="reduce">
                  <span class="onb-goal-icon">📉</span>
                  <span class="onb-goal-text">قلّل الصرف</span>
                </button>
                <button type="button" class="onb-goal-btn" data-goal="track">
                  <span class="onb-goal-icon">📊</span>
                  <span class="onb-goal-text">تتبّع المصاريف</span>
                </button>
                <button type="button" class="onb-goal-btn" data-goal="travel">
                  <span class="onb-goal-icon">✈️</span>
                  <span class="onb-goal-text">سفر/رحلة</span>
                </button>
                <button type="button" class="onb-goal-btn" data-goal="car">
                  <span class="onb-goal-icon">🚗</span>
                  <span class="onb-goal-text">شراء سيارة</span>
                </button>
                <button type="button" class="onb-goal-btn" data-goal="other">
                  <span class="onb-goal-icon">🎯</span>
                  <span class="onb-goal-text">شي آخر</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="onb-footer">
          <button class="onb-skip">تخطّي</button>
          <button class="onb-next onb-finish">يلا نبدأ! 🎉</button>
        </div>
      </div>
    `;
  }
  
  /**
   * عرض شاشة معيّنة
   */
  function showScreen(index) {
    const overlay = document.getElementById('onboardingOverlay');
    if (!overlay) return;
    
    const total = SCREENS.length + 1; // +1 for wizard
    const isWizard = index === SCREENS.length;
    
    // حدّث المحتوى
    overlay.querySelector('.onb-container').innerHTML = isWizard 
      ? buildWizardHTML() 
      : buildScreenHTML(SCREENS[index], index, total);
    
    // ربط الأزرار
    bindScreenEvents(overlay, isWizard);
    
    currentScreen = index;
    
    // animation
    const screen = overlay.querySelector('.onb-screen');
    if (screen) {
      screen.style.opacity = '0';
      screen.style.transform = 'translateX(20px)';
      setTimeout(() => {
        screen.style.transition = 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)';
        screen.style.opacity = '1';
        screen.style.transform = '';
      }, 50);
    }
  }
  
  /**
   * ربط events لكل شاشة
   */
  function bindScreenEvents(overlay, isWizard) {
    const nextBtn = overlay.querySelector('.onb-next');
    const skipBtn = overlay.querySelector('.onb-skip');
    
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (confirm('متأكد تبغى تتخطّى الإعداد؟ تقدر تعدّل لاحقاً من الإعدادات.')) {
          finish(true);
        }
      });
    }
    
    if (isWizard) {
      bindWizardEvents(overlay);
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          collectWizardData(overlay);
          finish(false);
        });
      }
    } else {
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          showScreen(currentScreen + 1);
        });
      }
    }
  }
  
  /**
   * ربط events للـ Wizard
   */
  function bindWizardEvents(overlay) {
    // Quick amount chips
    overlay.querySelectorAll('.onb-amount-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const amt = chip.dataset.amt;
        const input = overlay.querySelector('#onbSalary');
        if (input) {
          input.value = amt;
          // visual feedback
          overlay.querySelectorAll('.onb-amount-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        }
      });
    });
    
    // Salary input - clear chips selection
    overlay.querySelector('#onbSalary')?.addEventListener('input', () => {
      overlay.querySelectorAll('.onb-amount-chip').forEach(c => c.classList.remove('active'));
    });
    
    // Goal buttons
    overlay.querySelectorAll('.onb-goal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.onb-goal-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
  
  /**
   * جمع بيانات الـ Wizard
   */
  function collectWizardData(overlay) {
    userData.name = overlay.querySelector('#onbName')?.value.trim() || '';
    userData.salary = parseFloat(overlay.querySelector('#onbSalary')?.value) || 0;
    const activeGoal = overlay.querySelector('.onb-goal-btn.active');
    userData.goal = activeGoal?.dataset.goal || '';
  }
  
  /**
   * تطبيق البيانات على التطبيق
   */
  function applyUserData() {
    try {
      // 1. الاسم
      if (userData.name && window.App?.store) {
        const profile = window.App.store.get('profile') || {};
        profile.displayName = userData.name;
        window.App.store.set('profile', profile);
        
        // حدّث الـ greeting إن أمكن
        const greetingEl = document.getElementById('greetingHello');
        if (greetingEl) greetingEl.textContent = `مرحباً ${userData.name} 👋`;
      }
      
      // 2. الراتب — أضفه كمصدر دخل
      if (userData.salary > 0 && window.App?.Entries?.addIncome) {
        const today = new Date();
        const monthData = window.App.store.get('data') || {};
        const monthKey = `${today.getFullYear()}_m${today.getMonth()}`;
        
        if (!monthData[monthKey]) monthData[monthKey] = {};
        if (!monthData[monthKey].income) monthData[monthKey].income = [];
        
        // أضف فقط إذا ما فيه راتب
        const hasSalary = monthData[monthKey].income.some(i => i.cat === '💵');
        if (!hasSalary) {
          monthData[monthKey].income.push({
            id: window.Tdbeer?.U?.uid?.() || `e_${Date.now()}`,
            name: 'راتب',
            amt: userData.salary,
            cat: '💵'
          });
          window.App.store.set('data', monthData);
        }
      }
      
      // 3. الهدف
      if (userData.goal && window.App?.store) {
        const settings = window.App.store.get('settings') || {};
        settings.primaryGoal = userData.goal;
        window.App.store.set('settings', settings);
      }
      
      // 4. أضف إنجاز "أول خطوة"
      try {
        if (window.App?.Achievements?.unlock) {
          window.App.Achievements.unlock('first-setup');
        }
      } catch {}
      
      // 5. تحديث UI
      if (window.Renderers?.scheduledAll) {
        window.Renderers.scheduledAll();
      }
      
    } catch (e) {
      if (window.Logger) window.Logger.warn('Onboarding.applyUserData', e?.message);
    }
  }
  
  /**
   * إنهاء الـ Onboarding
   */
  function finish(skipped = false) {
    if (!skipped) {
      applyUserData();
    }
    
    markDone(skipped);
    
    // إخفاء الـ overlay
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
      // Polish: confetti قبل الإغلاق
      if (!skipped && window.UIPolish?.celebrateSuccess) {
        const center = overlay.querySelector('.onb-finish, .onb-next');
        if (center) window.UIPolish.celebrateSuccess(center);
      }
      
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.remove();
      }, 400);
    }
    
    // رسالة ترحيب
    if (!skipped && userData.name) {
      setTimeout(() => {
        window.Toast?.show?.(`أهلاً ${userData.name}! 🎉 اضغط ➕ في الأسفل لإضافة أي شي`, 'success', 5000);
      }, 600);
    } else if (!skipped) {
      setTimeout(() => {
        window.Toast?.show?.('🎉 يلا نبدأ! اضغط ➕ في الأسفل لإضافة أول مصروف', 'success', 5000);
      }, 600);
    }
  }
  
  /**
   * بدء Onboarding
   */
  function start() {
    // تحقق ما هو موجود مسبقاً
    if (document.getElementById('onboardingOverlay')) return;
    
    // ابني الـ overlay
    const overlay = document.createElement('div');
    overlay.id = 'onboardingOverlay';
    overlay.className = 'onb-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'إعداد التطبيق');
    overlay.innerHTML = `<div class="onb-container"></div>`;
    
    document.body.appendChild(overlay);
    
    // ابدأ من الشاشة الأولى
    showScreen(0);
    
    // منع scroll في الخلف
    document.body.style.overflow = 'hidden';
  }
  
  /**
   * إعادة التشغيل (من Settings)
   */
  function restart() {
    try {
      window.Storage?.save?.(STORAGE_KEY, null);
    } catch {}
    currentScreen = 0;
    userData = { name: '', salary: 0, goal: '', goalAmount: 0 };
    start();
  }
  
  /**
   * Init
   */
  function init() {
    if (initialized) return;
    initialized = true;
    
    // انتظر التطبيق يحمّل
    setTimeout(() => {
      if (isFirstRun()) {
        start();
      }
    }, 1500);
  }
  
  return { init, start, restart, finish, isFirstRun };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.Onboarding = Onboarding;
window.Onboarding = Onboarding;
