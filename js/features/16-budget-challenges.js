/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Budget Challenges (التحديات الشهرية)
   ───────────────────────────────────────────────────────────────────
   تحديات تشجيعية للمستخدم لتقليل الإنفاق على فئات معيّنة.
   تتكامل مع نظام Achievements و Pts الموجود.
═══════════════════════════════════════════════════════════════════ */

var BudgetChallenges = (() => {
  const STORAGE_KEY = 'activeChallenges';
  const HISTORY_KEY = 'challengesHistory';
  
  // قائمة التحديات المتاحة
  const CHALLENGES = [
    {
      id: 'no-coffee-week',
      icon: '☕',
      title: 'أسبوع بدون قهوة بره',
      description: 'لا تشتري قهوة من المقاهي لمدة 7 أيام',
      duration: 7,
      categories: ['☕'],
      maxAmount: 0,
      reward: 100,
      difficulty: 'easy'
    },
    {
      id: 'no-delivery-week',
      icon: '🍔',
      title: 'أسبوع بدون طلبات طعام',
      description: 'لا تطلب طعام من خارج البيت لمدة أسبوع',
      duration: 7,
      categories: ['🍔'],
      maxAmount: 0,
      reward: 200,
      difficulty: 'medium'
    },
    {
      id: 'home-coffee-month',
      icon: '☕',
      title: 'قهوة المنزل لمدة شهر',
      description: 'لا تشتري قهوة من بره لمدة 30 يوم',
      duration: 30,
      categories: ['☕'],
      maxAmount: 0,
      reward: 500,
      difficulty: 'hard'
    },
    {
      id: 'limit-shopping',
      icon: '🛒',
      title: 'لا تسوّق فوق 500 ريال',
      description: 'مصاريف التسوّق تحت 500 ريال هذا الأسبوع',
      duration: 7,
      categories: ['🛒','👕'],
      maxAmount: 500,
      reward: 150,
      difficulty: 'medium'
    },
    {
      id: 'save-10-percent',
      icon: '💰',
      title: 'وفّر 10% من الراتب',
      description: 'حقق توفير 10% من دخل الشهر',
      duration: 30,
      type: 'savings',
      targetPct: 10,
      reward: 300,
      difficulty: 'medium'
    },
    {
      id: 'save-20-percent',
      icon: '💎',
      title: 'وفّر 20% من الراتب',
      description: 'حقق توفير 20% من دخل الشهر',
      duration: 30,
      type: 'savings',
      targetPct: 20,
      reward: 600,
      difficulty: 'hard'
    },
    {
      id: 'three-no-spend-days',
      icon: '🌱',
      title: '3 أيام بدون صرف',
      description: 'حقق 3 أيام كاملة بدون أي مصروف',
      duration: 14,
      type: 'no-spend',
      target: 3,
      reward: 100,
      difficulty: 'easy'
    },
    {
      id: 'budget-master',
      icon: '🎯',
      title: 'سيد الميزانية',
      description: 'لا تتجاوز أي حد إنفاق لمدة شهر',
      duration: 30,
      type: 'budget-respect',
      reward: 400,
      difficulty: 'hard'
    }
  ];
  
  /**
   * يرجع قائمة التحديات المتاحة (غير النشطة)
   */
  function getAvailable() {
    const active = window.Storage?.load(STORAGE_KEY, []) || [];
    const history = window.Storage?.load(HISTORY_KEY, []) || [];
    const activeIds = new Set(active.map(c => c.id));
    
    // امنع تكرار تحدي اكتمل في آخر 7 أيام
    const recentlyCompleted = new Set(
      history
        .filter(h => h.completedAt && (Date.now() - h.completedAt < 7 * 86400000))
        .map(h => h.id)
    );
    
    return CHALLENGES.filter(c => 
      !activeIds.has(c.id) && !recentlyCompleted.has(c.id)
    );
  }
  
  /**
   * يرجع التحديات النشطة الحالية
   */
  function getActive() {
    return window.Storage?.load(STORAGE_KEY, []) || [];
  }
  
  /**
   * بدء تحدي جديد
   */
  function start(challengeId) {
    const challenge = CHALLENGES.find(c => c.id === challengeId);
    if (!challenge) {
      window.Toast?.show?.('تحدي غير موجود', 'danger');
      return null;
    }
    
    const active = getActive();
    if (active.some(c => c.id === challengeId)) {
      window.Toast?.show?.('هذا التحدي نشط بالفعل', 'warn');
      return null;
    }
    
    const instance = {
      ...challenge,
      startedAt: Date.now(),
      endsAt: Date.now() + challenge.duration * 86400000,
      progress: 0,
      status: 'active'
    };
    
    active.push(instance);
    window.Storage?.save(STORAGE_KEY, active);
    
    window.Toast?.show?.(`🎯 بدأ التحدي: ${challenge.title}`, 'success');
    return instance;
  }
  
  /**
   * يقيّم تقدّم تحدي معيّن
   */
  function evaluate(challenge) {
    if (!window.App?.store) return null;
    
    try {
      const data = window.App.store.get('data') || {};
      const startDate = new Date(challenge.startedAt);
      const endDate = new Date(challenge.endsAt);
      const now = Date.now();
      
      // اجمع المصاريف منذ بداية التحدي
      let totalSpent = 0;
      let noSpendDays = 0;
      const daysSinceStart = Math.floor((now - challenge.startedAt) / 86400000);
      
      // تجميع البيانات (من daily entries)
      const relevantEntries = [];
      for (const [monthKey, monthData] of Object.entries(data)) {
        for (const [day, arr] of Object.entries(monthData.daily || {})) {
          // نعرف الـ year/month من monthKey: "YYYY_mM"
          const [yStr, mStr] = monthKey.split('_m');
          const date = new Date(parseInt(yStr), parseInt(mStr), parseInt(day));
          
          if (date >= startDate && date <= new Date(Math.min(now, challenge.endsAt))) {
            for (const entry of arr) {
              if (entry.type === 'out') {
                relevantEntries.push({ date, ...entry });
              }
            }
          }
        }
      }
      
      // التقييم حسب نوع التحدي
      let progressPct = 0;
      let isFailed = false;
      let isCompleted = false;
      let detailMessage = '';
      
      if (challenge.type === 'no-spend') {
        // عدّ الأيام بدون صرف
        const daySet = new Set(relevantEntries.map(e => 
          `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`
        ));
        // الأيام منذ البداية
        for (let i = 0; i <= daysSinceStart && i < challenge.duration; i++) {
          const d = new Date(startDate.getTime() + i * 86400000);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (!daySet.has(key)) noSpendDays++;
        }
        progressPct = Math.min(100, (noSpendDays / challenge.target) * 100);
        if (noSpendDays >= challenge.target) isCompleted = true;
        detailMessage = `${noSpendDays} من ${challenge.target} أيام بدون صرف`;
      } 
      else if (challenge.type === 'savings') {
        // تحقّق من نسبة التوفير الشهرية
        const year = window.App.store.get('year');
        const month = window.App.store.get('month');
        const totals = window.App.Sel.totals(year, month);
        progressPct = Math.min(100, (totals.savePct / challenge.targetPct) * 100);
        if (totals.savePct >= challenge.targetPct) isCompleted = true;
        detailMessage = `وفّرت ${totals.savePct}% من ${challenge.targetPct}%`;
      }
      else if (challenge.type === 'budget-respect') {
        // تحقّق من عدم تجاوز أي ميزانية
        const year = window.App.store.get('year');
        const month = window.App.store.get('month');
        const monthData = window.App.Sel.monthData(year, month);
        const cats = window.App.Sel.categorySpending(year, month);
        let exceeded = 0;
        for (const b of (monthData.budgets || [])) {
          const sp = window.App.Budgets.calcSpent(b.name, cats);
          if (sp > b.limit) exceeded++;
        }
        if (exceeded > 0) {
          isFailed = true;
          detailMessage = `تجاوزت ${exceeded} حد إنفاق`;
        } else {
          progressPct = Math.min(100, (daysSinceStart / challenge.duration) * 100);
          if (daysSinceStart >= challenge.duration) isCompleted = true;
          detailMessage = `${daysSinceStart} من ${challenge.duration} يوم — لم تتجاوز أي حد`;
        }
      }
      else {
        // تحدي بالفئات (no-coffee, no-delivery, ...)
        const relevantSpent = relevantEntries
          .filter(e => challenge.categories.includes(e.cat))
          .reduce((s, e) => s + (Number(e.amt) || 0), 0);
        
        totalSpent = relevantSpent;
        
        if (relevantSpent > challenge.maxAmount) {
          isFailed = true;
          detailMessage = `صرفت ${Math.round(relevantSpent)} ﷼ — تجاوزت الحد`;
        } else {
          progressPct = Math.min(100, (daysSinceStart / challenge.duration) * 100);
          if (daysSinceStart >= challenge.duration) isCompleted = true;
          detailMessage = challenge.maxAmount === 0
            ? `${daysSinceStart} من ${challenge.duration} يوم نظيف`
            : `صرفت ${Math.round(relevantSpent)} من ${challenge.maxAmount} ﷼`;
        }
      }
      
      // Update status
      if (isFailed) {
        return { ...challenge, progress: progressPct, status: 'failed', detailMessage };
      }
      if (isCompleted) {
        return { ...challenge, progress: 100, status: 'completed', detailMessage };
      }
      if (now >= challenge.endsAt) {
        // انتهى الوقت بدون اكتمال
        return { ...challenge, progress: progressPct, status: 'expired', detailMessage };
      }
      
      return { ...challenge, progress: progressPct, status: 'active', detailMessage };
    } catch (e) {
      window.Logger?.warn?.('Challenges.evaluate', e?.message);
      return { ...challenge, status: 'error' };
    }
  }
  
  /**
   * مراجعة كل التحديات النشطة وتحديث حالاتها
   */
  function updateAll() {
    const active = getActive();
    const updated = [];
    const completed = [];
    const failed = [];
    
    for (const c of active) {
      const result = evaluate(c);
      if (!result) {
        updated.push(c);
        continue;
      }
      
      if (result.status === 'completed') {
        completed.push(result);
      } else if (result.status === 'failed' || result.status === 'expired') {
        failed.push(result);
      } else {
        updated.push(result);
      }
    }
    
    // معالجة المكتمل
    for (const c of completed) {
      finishChallenge(c, true);
    }
    for (const c of failed) {
      finishChallenge(c, false);
    }
    
    window.Storage?.save(STORAGE_KEY, updated);
    return { active: updated, completed, failed };
  }
  
  /**
   * إنهاء تحدي (نجاح أو فشل)
   */
  function finishChallenge(challenge, success) {
    // أضف للسجل
    const history = window.Storage?.load(HISTORY_KEY, []) || [];
    history.push({
      id: challenge.id,
      title: challenge.title,
      icon: challenge.icon,
      success,
      completedAt: Date.now(),
      reward: success ? challenge.reward : 0
    });
    if (history.length > 50) history.shift();
    window.Storage?.save(HISTORY_KEY, history);
    
    // امنح النقاط
    if (success && challenge.reward) {
      window.App?.Pts?.add?.(challenge.reward);
    }
    
    // أخبر المستخدم
    if (success) {
      window.Toast?.show?.(
        `🏆 أكملت التحدي: ${challenge.title} (+${challenge.reward} نقطة)`,
        'success', 5000
      );
    } else {
      window.Toast?.show?.(
        `💔 فشل التحدي: ${challenge.title}`,
        'warn', 4000
      );
    }
  }
  
  /**
   * إلغاء تحدي يدوياً
   */
  function abandon(challengeId) {
    const active = getActive().filter(c => c.id !== challengeId);
    window.Storage?.save(STORAGE_KEY, active);
    window.Toast?.show?.('تم إلغاء التحدي', 'warn');
  }
  
  /**
   * احصائيات التحديات
   */
  function getStats() {
    const history = window.Storage?.load(HISTORY_KEY, []) || [];
    const totalCompleted = history.filter(h => h.success).length;
    const totalFailed = history.filter(h => !h.success).length;
    const totalRewards = history.reduce((s, h) => s + (h.reward || 0), 0);
    
    return {
      totalCompleted,
      totalFailed,
      totalRewards,
      successRate: history.length > 0 
        ? Math.round((totalCompleted / history.length) * 100) 
        : 0
    };
  }
  
  /**
   * Init: فحص دوري للتحديات
   */
  function init() {
    // تحديث فوري
    setTimeout(updateAll, 2000);
    
    // فحص كل 5 دقائق
    setInterval(() => {
      if (!document.hidden) updateAll();
    }, 5 * 60 * 1000);
    
    // عند تغيير البيانات
    if (window.App?.store) {
      window.App.store.subscribe('data', () => {
        clearTimeout(init._t);
        init._t = setTimeout(updateAll, 2000);
      });
    }
  }
  
  return {
    init,
    getAvailable,
    getActive,
    start,
    abandon,
    evaluate,
    updateAll,
    getStats,
    CHALLENGES
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.BudgetChallenges = BudgetChallenges;
window.BudgetChallenges = BudgetChallenges;
