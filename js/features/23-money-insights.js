/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Money Insights Manager
   ───────────────────────────────────────────────────────────────────
   يدير:
   - Days remaining في الشهر (مع warning/success states)
   - Smart Insights في tab المال
   - Quick Actions (دخل/ثابت/متغيّر/ميزانية)
═══════════════════════════════════════════════════════════════════ */

var MoneyInsights = (() => {
  let updateTimer = null;
  
  /**
   * احسب عدد الأيام المتبقية في الشهر
   */
  function getDaysRemaining() {
    try {
      const today = new Date();
      const month = window.App?.store?.get('month') ?? today.getMonth();
      const year = window.App?.store?.get('year') ?? today.getFullYear();
      
      // إذا الشهر المعروض هو الحالي
      if (month === today.getMonth() && year === today.getFullYear()) {
        const lastDay = new Date(year, month + 1, 0).getDate();
        const remaining = lastDay - today.getDate();
        return { remaining, total: lastDay, isCurrent: true };
      }
      
      // شهر آخر — اعرض الكل
      const lastDay = new Date(year, month + 1, 0).getDate();
      return { remaining: 0, total: lastDay, isCurrent: false };
    } catch {
      return { remaining: 0, total: 30, isCurrent: false };
    }
  }
  
  /**
   * تحديث Days Remaining indicator
   */
  function updateDaysRemaining() {
    const indicator = document.getElementById('bankDaysRemaining');
    const text = document.getElementById('bankDaysText');
    if (!indicator || !text) return;
    
    const { remaining, total, isCurrent } = getDaysRemaining();
    
    if (!isCurrent) {
      // شهر سابق أو قادم
      text.textContent = `${total} يوم في الشهر`;
      indicator.classList.remove('warning', 'success');
      return;
    }
    
    // الشهر الحالي
    if (remaining <= 0) {
      text.textContent = 'آخر يوم في الشهر 🔚';
      indicator.classList.add('warning');
      indicator.classList.remove('success');
    } else if (remaining <= 5) {
      text.textContent = `باقي ${remaining} ${remaining === 1 ? 'يوم' : 'أيام'} في الشهر ⚠️`;
      indicator.classList.add('warning');
      indicator.classList.remove('success');
    } else if (remaining > 20) {
      text.textContent = `باقي ${remaining} يوم — بداية الشهر ✨`;
      indicator.classList.add('success');
      indicator.classList.remove('warning');
    } else {
      text.textContent = `باقي ${remaining} يوم في الشهر`;
      indicator.classList.remove('warning', 'success');
    }
  }
  
  /**
   * احسب الإحصائيات الذكية
   */
  function computeInsights() {
    const insights = [];
    
    try {
      const App = window.App;
      if (!App?.store) return insights;
      
      const data = App.store.get('data') || {};
      const year = App.store.get('year');
      const month = App.store.get('month');
      const monthKey = `${year}_m${month}`;
      const monthData = data[monthKey] || {};
      
      // 1. حساب الدخل والمصاريف
      let totalIncome = 0, totalFixed = 0, totalVar = 0;
      (monthData.income || []).forEach(i => totalIncome += (i.amt || 0));
      (monthData.fixed || []).forEach(f => totalFixed += (f.amt || 0));
      
      const daily = monthData.daily || {};
      Object.values(daily).forEach(items => {
        if (Array.isArray(items)) {
          items.forEach(item => {
            if (item.type === 'in') totalIncome += (item.amt || 0);
            else totalVar += (item.amt || 0);
          });
        }
      });
      
      const totalExp = totalFixed + totalVar;
      const balance = totalIncome - totalExp;
      const spendPct = totalIncome > 0 ? (totalExp / totalIncome) * 100 : 0;
      
      const { remaining, total, isCurrent } = getDaysRemaining();
      const dayOfMonth = total - remaining;
      
      // ─── Insight 1: نسبة الإنفاق ───
      if (totalIncome > 0) {
        if (spendPct > 90) {
          insights.push({
            type: 'warning',
            icon: '🚨',
            title: 'تجاوزت ميزانيتك',
            message: `صرفت ${spendPct.toFixed(0)}% من دخلك. خفّف الصرف!`,
            action: null
          });
        } else if (spendPct > 70 && isCurrent && remaining > 10) {
          insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'احذر من الصرف',
            message: `صرفت ${spendPct.toFixed(0)}% وباقي ${remaining} يوم. خفّف.`,
            action: null
          });
        } else if (spendPct < 50 && isCurrent && dayOfMonth > 15) {
          insights.push({
            type: 'success',
            icon: '🎯',
            title: 'صرف ممتاز!',
            message: `صرفت ${spendPct.toFixed(0)}% فقط. استمر على هذا النهج.`,
            action: null
          });
        }
      }
      
      // ─── Insight 2: متوسط الصرف اليومي ───
      if (isCurrent && dayOfMonth > 0 && totalVar > 0) {
        const avgDaily = totalVar / dayOfMonth;
        const projectedVar = avgDaily * total;
        const projectedTotal = totalFixed + projectedVar;
        
        if (totalIncome > 0 && projectedTotal > totalIncome) {
          insights.push({
            type: 'warning',
            icon: '📊',
            title: 'توقّع تجاوز',
            message: `بمعدلك الحالي رح تصرف ${projectedTotal.toFixed(0)} ﷼ — أكثر من دخلك`,
            action: null
          });
        } else {
          insights.push({
            type: 'info',
            icon: '📊',
            title: 'متوسطك اليومي',
            message: `تصرف ${avgDaily.toFixed(0)} ﷼ يومياً (متغير فقط)`,
            action: null
          });
        }
      }
      
      // ─── Insight 3: التوفير ───
      if (balance > 0 && totalIncome > 0) {
        const savingPct = (balance / totalIncome) * 100;
        if (savingPct >= 20) {
          insights.push({
            type: 'success',
            icon: '💰',
            title: 'وفّرت ' + balance.toFixed(0) + ' ﷼',
            message: `${savingPct.toFixed(0)}% من دخلك — هدف 20% محقق! 🎉`,
            action: null
          });
        } else if (savingPct > 0) {
          insights.push({
            type: 'info',
            icon: '💰',
            title: 'وفّرت ' + balance.toFixed(0) + ' ﷼',
            message: `${savingPct.toFixed(0)}% من دخلك. الهدف الأمثل 20%`,
            action: null
          });
        }
      }
      
      // ─── Insight 4: لا يوجد دخل ───
      if (totalIncome === 0 && (totalFixed > 0 || totalVar > 0)) {
        insights.push({
          type: 'warning',
          icon: '💵',
          title: 'لم تسجّل دخلك بعد',
          message: 'سجّل راتبك أو مصدر دخلك لتتمكن من التحليل',
          action: 'add-income'
        });
      }
      
      // ─── Insight 5: تذكير بداية الشهر ───
      if (isCurrent && dayOfMonth <= 3 && totalIncome === 0) {
        insights.push({
          type: 'info',
          icon: '🗓️',
          title: 'بداية شهر جديد',
          message: 'سجّل راتبك ومصاريفك الثابتة لبداية موفقة',
          action: 'add-income'
        });
      }
      
      // ─── Insight 6: نهاية الشهر ───
      if (isCurrent && remaining <= 3 && remaining > 0) {
        insights.push({
          type: 'info',
          icon: '🔔',
          title: `${remaining} ${remaining === 1 ? 'يوم' : 'أيام'} متبقية`,
          message: 'استعد للشهر الجاي — راجع ميزانيتك',
          action: null
        });
      }
      
    } catch (e) {
      if (window.Logger) window.Logger.warn('MoneyInsights.compute', e?.message);
    }
    
    return insights;
  }
  
  /**
   * عرض Insights في الـ panel
   */
  function renderInsights() {
    const panel = document.getElementById('insightsPanel');
    if (!panel) return;
    
    const scroll = panel.querySelector('.insights-scroll');
    if (!scroll) return;
    
    const insights = computeInsights();
    
    if (insights.length === 0) {
      panel.style.display = 'none';
      return;
    }
    
    panel.style.display = '';
    scroll.innerHTML = insights.map(ins => `
      <div class="insight-card ${ins.type}" ${ins.action ? `data-insight-action="${ins.action}"` : ''}>
        <div class="insight-icon">${ins.icon}</div>
        <div class="insight-content">
          <div class="insight-title">${ins.title}</div>
          <div class="insight-message">${ins.message}</div>
          ${ins.action ? `<div class="insight-action">اضغط للإضافة ←</div>` : ''}
        </div>
      </div>
    `).join('');
    
    // Bind insight actions
    scroll.querySelectorAll('[data-insight-action]').forEach(card => {
      card.addEventListener('click', () => {
        const action = card.dataset.insightAction;
        handleQuickAction(action);
      });
    });
  }
  
  /**
   * Quick Action handler
   */
  function handleQuickAction(action) {
    switch (action) {
      case 'add-income':
        // افتح بشكل مباشر في الموقع
        scrollToSection('incomeForm');
        break;
      case 'add-fixed':
        scrollToSection('fixedForm');
        break;
      case 'add-variable':
        scrollToSection('varForm');
        break;
      case 'set-budget':
        // افتح صفحة الأهداف والميزانية
        if (window.openDedicatedPage) {
          window.openDedicatedPage('goals-budget');
        }
        break;
    }
  }
  
  /**
   * Scroll لقسم معيّن وافتح الـ form
   */
  function scrollToSection(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    // افتح الـ form
    form.classList.add('open');
    
    // Scroll
    setTimeout(() => {
      const section = form.closest('.section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      // Focus على أول input
      setTimeout(() => {
        const firstInput = form.querySelector('input[type="text"], input[type="number"]');
        if (firstInput) firstInput.focus();
      }, 400);
    }, 100);
    
    // إضاءة بصرية
    setTimeout(() => {
      const section = form.closest('.section');
      if (section) {
        section.style.transition = 'box-shadow 0.4s';
        section.style.boxShadow = '0 0 30px var(--accent-glow), 0 0 0 2px var(--accent)';
        setTimeout(() => section.style.boxShadow = '', 2000);
      }
    }, 500);
  }
  
  /**
   * تحديث كل شي
   */
  function update() {
    updateDaysRemaining();
    renderInsights();
  }
  
  /**
   * Debounced update
   */
  function scheduleUpdate(delay = 300) {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(update, delay);
  }
  
  /**
   * Init
   */
  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    
    // أول تحديث
    setTimeout(update, 800);
    
    // تحديث عند تغيير الـ store
    if (window.App?.store) {
      window.App.store.subscribe('data', () => scheduleUpdate(200));
      window.App.store.subscribe('month', () => scheduleUpdate(100));
      window.App.store.subscribe('year', () => scheduleUpdate(100));
      window.App.store.subscribe('tab', (val) => {
        if (val === 'money') scheduleUpdate(100);
      });
    }
    
    // Quick Actions buttons
    document.querySelectorAll('[data-money-qa]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.moneyQa;
        handleQuickAction(action);
      });
    });
    
    // تحديث دوري كل دقيقة (للأيام المتبقية)
    // Use Performance.scheduleEvery (أوقف عند خفاء التطبيق + توفير بطارية)
    if (window.Performance?.scheduleEvery) {
      window.Performance.scheduleEvery(60000, updateDaysRemaining, 'days-remaining');
    } else {
      setInterval(updateDaysRemaining, 60000);
    }
  }
  
  return {
    init, update, scheduleUpdate,
    computeInsights, renderInsights,
    getDaysRemaining, handleQuickAction
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.MoneyInsights = MoneyInsights;
window.MoneyInsights = MoneyInsights;
