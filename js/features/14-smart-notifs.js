/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Smart Notifications
   ───────────────────────────────────────────────────────────────────
   تنبيهات ذكية تعتمد على:
   1. الوقت من اليوم (مساء الجمعة → غالباً يطلب طعام)
   2. أنماط الإنفاق السابقة
   3. الميزانية المتبقية
   4. اقتراب الراتب أو الفواتير
═══════════════════════════════════════════════════════════════════ */

var SmartNotifs = (() => {
  const STORAGE_KEY = 'smartNotifsLastShown';
  const COOLDOWN = 6 * 60 * 60 * 1000; // 6 ساعات بين تنبيهات نفس النوع
  
  /**
   * يرجع تنبيه واحد ذكي بناءً على الوقت والبيانات
   */
  function getCurrentInsight() {
    if (!window.App?.store) return null;
    
    try {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();
      const dayOfMonth = now.getDate();
      
      const year = window.App.store.get('year');
      const month = window.App.store.get('month');
      const totals = window.App.Sel.totals(year, month);
      const data = window.App.Sel.monthData(year, month);
      
      const insights = [];
      
      // ─── تنبيه 1: مصروف اليوم مرتفع ───
      const todaySpent = sumDailySpent(data, dayOfMonth);
      const avgDailySpend = totals.expense / dayOfMonth;
      if (todaySpent > avgDailySpend * 2 && todaySpent > 100) {
        insights.push({
          type: 'high-spending-today',
          priority: 8,
          icon: '⚠️',
          title: 'صرف اليوم مرتفع',
          message: `صرفت اليوم ${Math.round(todaySpent)} ريال — ضعف متوسطك اليومي (${Math.round(avgDailySpend)})`,
          action: { label: 'عرض التفاصيل', tab: 'monthly' }
        });
      }
      
      // ─── تنبيه 2: ميزانية الفئة قاربت على النفاد ───
      const cats = window.App.Sel.categorySpending(year, month);
      for (const budget of (data.budgets || [])) {
        const spent = window.App.Budgets.calcSpent(budget.name, cats);
        const pct = (spent / budget.limit) * 100;
        if (pct >= 80 && pct < 100) {
          insights.push({
            type: `budget-alert-${budget.id}`,
            priority: 9,
            icon: '🚨',
            title: 'حد الإنفاق يقترب',
            message: `${budget.name}: ${Math.round(pct)}% (${Math.round(spent)} من ${budget.limit} ﷼)`,
            action: { label: 'عرض الميزانيات', tab: 'monthly' }
          });
        }
      }
      
      // ─── تنبيه 3: الجمعة مساءً → عادةً يطلب طعام ───
      if (day === 5 && hour >= 17 && hour <= 22) {
        const foodPattern = getDayPattern(data, 5, '🍔');
        if (foodPattern.avgAmount > 50) {
          const remaining = totals.income - totals.expense;
          if (remaining < foodPattern.avgAmount * 2) {
            insights.push({
              type: 'friday-food-warning',
              priority: 6,
              icon: '🍔',
              title: 'الجمعة مساءً',
              message: `عادةً تطلب طعام بـ ~${foodPattern.avgAmount} ﷼ في هذا الوقت. المتبقي: ${remaining} ﷼`,
              action: { label: 'سجّل المصروف', tab: 'monthly' }
            });
          }
        }
      }
      
      // ─── تنبيه 4: قرب يوم الراتب ───
      const salaryDay = window.App.store.get('salaryDay');
      if (salaryDay > 0) {
        const daysToSalary = computeDaysToSalary(salaryDay);
        if (daysToSalary >= 0 && daysToSalary <= 3) {
          const burnRate = totals.expense / dayOfMonth;
          const daysLeft = Math.max(0, getDaysInMonth(year, month) - dayOfMonth);
          const projectedExpense = totals.expense + (burnRate * daysLeft);
          
          if (projectedExpense > totals.income * 1.05) {
            insights.push({
              type: 'salary-coming-overspending',
              priority: 7,
              icon: '💰',
              title: `راتبك بعد ${daysToSalary} يوم`,
              message: `لكن بمعدل صرفك الحالي ستتجاوز دخلك بـ ${Math.round(projectedExpense - totals.income)} ﷼`,
              action: { label: 'راجع الميزانية', tab: 'monthly' }
            });
          } else if (totals.savePct >= 20) {
            insights.push({
              type: 'salary-coming-good',
              priority: 4,
              icon: '🌟',
              title: `راتبك بعد ${daysToSalary} يوم`,
              message: `أحسنت — وفّرت ${totals.savePct}% هذا الشهر`,
              action: { label: 'عرض إنجازاتك', tab: 'profile' }
            });
          }
        }
      }
      
      // ─── تنبيه 5: فواتير قادمة قريباً ───
      const notifs = window.App.store.get('notifs') || [];
      const upcomingBills = notifs.filter(n => {
        const status = window.App.Notifs.getStatus(n);
        return status === 'urgent' || status === 'overdue';
      });
      if (upcomingBills.length > 0) {
        insights.push({
          type: 'urgent-bills',
          priority: 10,
          icon: '🔔',
          title: 'فواتير عاجلة',
          message: `${upcomingBills.length} ${upcomingBills.length === 1 ? 'فاتورة' : 'فواتير'} مستحقة الآن`,
          action: { label: 'عرض الفواتير', tab: 'monthly' }
        });
      }
      
      // ─── تنبيه 6: يوم بدون مصروف! ───
      if (dayOfMonth > 5 && todaySpent === 0 && hour >= 20) {
        insights.push({
          type: 'no-spend-day',
          priority: 3,
          icon: '🌱',
          title: 'يوم بدون صرف!',
          message: 'لم تسجل أي مصروف اليوم — استمر! 💪',
          action: null
        });
      }
      
      // ─── تنبيه 7: تشجيع للسلسلة ───
      const streak = window.App.store.get('streak');
      if (streak?.current >= 3 && streak.current < 30) {
        const today = window.Tdbeer.U.todayStr();
        if (!streak.days.includes(today) && hour >= 20) {
          insights.push({
            type: 'streak-reminder',
            priority: 5,
            icon: '🔥',
            title: `سلسلتك ${streak.current} يوم`,
            message: 'سجّل دخولك اليوم لتحافظ على السلسلة',
            action: { label: 'سجّل', action: 'checkin' }
          });
        }
      }
      
      // اختر التنبيه الأعلى أولوية اللي ما اتعرض مؤخراً
      const lastShown = window.Storage?.load(STORAGE_KEY, {}) || {};
      const eligible = insights.filter(ins => {
        const last = lastShown[ins.type];
        return !last || (Date.now() - last) > COOLDOWN;
      });
      
      eligible.sort((a, b) => b.priority - a.priority);
      return eligible[0] || null;
      
    } catch (e) {
      window.Logger?.warn?.('SmartNotifs.insight', e?.message);
      return null;
    }
  }
  
  function sumDailySpent(monthData, day) {
    let sum = 0;
    const arr = (monthData.daily || {})[day] || [];
    for (const e of arr) {
      if (e.type === 'out') sum += Number(e.amt) || 0;
    }
    return sum;
  }
  
  function getDayPattern(monthData, weekday, category) {
    let total = 0, count = 0;
    for (const [day, arr] of Object.entries(monthData.daily || {})) {
      const date = new Date(
        window.App.store.get('year'),
        window.App.store.get('month'),
        parseInt(day)
      );
      if (date.getDay() === weekday) {
        for (const e of arr) {
          if (e.type === 'out' && (!category || e.cat === category)) {
            total += Number(e.amt) || 0;
            count++;
          }
        }
      }
    }
    return {
      total,
      count,
      avgAmount: count > 0 ? Math.round(total / count) : 0
    };
  }
  
  function computeDaysToSalary(salaryDay) {
    const now = new Date();
    let next = new Date(now.getFullYear(), now.getMonth(), salaryDay);
    if (next < now) {
      next = new Date(now.getFullYear(), now.getMonth() + 1, salaryDay);
    }
    return Math.ceil((next - now) / (24 * 60 * 60 * 1000));
  }
  
  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }
  
  /**
   * تعليم التنبيه أنه عُرض (للـ cooldown)
   */
  function markShown(type) {
    try {
      const lastShown = window.Storage?.load(STORAGE_KEY, {}) || {};
      lastShown[type] = Date.now();
      window.Storage?.save(STORAGE_KEY, lastShown);
    } catch {}
  }
  
  /**
   * عرض التنبيه كـ Toast غني (مع action button)
   */
  function showInsight(insight) {
    if (!insight) return;
    
    const banner = document.createElement('div');
    banner.className = 'smart-insight-banner';
    banner.innerHTML = `
      <div class="si-icon">${insight.icon}</div>
      <div class="si-content">
        <div class="si-title">${escapeHtml(insight.title)}</div>
        <div class="si-message">${escapeHtml(insight.message)}</div>
      </div>
      ${insight.action ? `
        <button class="si-action">${escapeHtml(insight.action.label)}</button>
      ` : ''}
      <button class="si-close" aria-label="إغلاق">✕</button>
    `;
    
    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add('show'), 10);
    
    // ربط الأحداث
    banner.querySelector('.si-close').onclick = () => closeInsight(banner);
    
    if (insight.action) {
      banner.querySelector('.si-action').onclick = () => {
        if (insight.action.tab) {
          window.Controllers?.showTab?.(insight.action.tab);
        }
        if (insight.action.action === 'checkin') {
          window.App?.Streak?.checkin?.();
        }
        closeInsight(banner);
      };
    }
    
    // auto-close after 12 seconds
    setTimeout(() => closeInsight(banner), 12000);
    
    markShown(insight.type);
  }
  
  function closeInsight(banner) {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  }
  
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  /**
   * Init: يعرض insight بعد فترة من فتح التطبيق
   */
  function init() {
    // أول insight بعد 5 ثواني من الفتح
    setTimeout(() => {
      const insight = getCurrentInsight();
      if (insight && insight.priority >= 6) {
        showInsight(insight);
      }
    }, 5000);
    
    // فحص دوري كل 30 دقيقة
    setInterval(() => {
      if (document.hidden) return;
      const insight = getCurrentInsight();
      if (insight && insight.priority >= 7) {
        showInsight(insight);
      }
    }, 30 * 60 * 1000);
  }
  
  return { init, getCurrentInsight, showInsight, markShown };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.SmartNotifs = SmartNotifs;
window.SmartNotifs = SmartNotifs;
