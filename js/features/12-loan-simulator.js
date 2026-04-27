/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Loan/Finance Simulator (محاكي التمويل)
   ───────────────────────────────────────────────────────────────────
   يحسب:
   - القسط الشهري
   - إجمالي الفوائد
   - جدول السداد الكامل (Amortization)
   - تأثيره على الميزانية الحالية
═══════════════════════════════════════════════════════════════════ */

var LoanSimulator = (() => {
  
  /**
   * يحسب القسط الشهري بصيغة الفائدة المتناقصة (الأكثر شيوعاً)
   * @param {number} principal - المبلغ الأساسي
   * @param {number} annualRate - النسبة السنوية (مثلاً 0.05 لـ 5%)
   * @param {number} months - عدد الأشهر
   * @returns {number} القسط الشهري
   */
  function calculateMonthlyPayment(principal, annualRate, months) {
    if (months <= 0) return 0;
    if (annualRate === 0) return principal / months;
    
    const monthlyRate = annualRate / 12;
    const factor = Math.pow(1 + monthlyRate, months);
    const payment = principal * (monthlyRate * factor) / (factor - 1);
    
    return payment;
  }
  
  /**
   * يحسب نسبة السبا (Simple Annual Profit Rate / APR Equivalent)
   * كثير بنوك سعودية تعرض "نسبة سنوية" بسيطة
   */
  function calculateSimpleRate({ principal, monthlyPayment, months }) {
    const totalPaid = monthlyPayment * months;
    const totalInterest = totalPaid - principal;
    const years = months / 12;
    const simpleRate = (totalInterest / principal) / years;
    return simpleRate;
  }
  
  /**
   * يولّد جدول السداد الكامل
   * @returns {Array} شهر شهر مع تفاصيل كل قسط
   */
  function amortizationSchedule({ principal, annualRate, months }) {
    const monthlyRate = annualRate / 12;
    const payment = calculateMonthlyPayment(principal, annualRate, months);
    const schedule = [];
    let balance = principal;
    
    for (let i = 1; i <= months; i++) {
      const interest = balance * monthlyRate;
      const principalPaid = payment - interest;
      balance -= principalPaid;
      
      schedule.push({
        month: i,
        payment,
        interest: Math.max(0, interest),
        principal: principalPaid,
        balance: Math.max(0, balance)
      });
    }
    
    return schedule;
  }
  
  /**
   * تحليل شامل لقرض
   */
  function analyze({ principal, annualRate, months, downPayment = 0 }) {
    const actualPrincipal = principal - downPayment;
    if (actualPrincipal <= 0) {
      return {
        error: 'الدفعة المقدمة تغطي المبلغ كاملاً'
      };
    }
    
    const monthlyPayment = calculateMonthlyPayment(actualPrincipal, annualRate, months);
    const totalPaid = monthlyPayment * months;
    const totalInterest = totalPaid - actualPrincipal;
    const totalCost = totalPaid + downPayment;
    const simpleRate = calculateSimpleRate({ 
      principal: actualPrincipal, 
      monthlyPayment, 
      months 
    });
    
    return {
      principal: actualPrincipal,
      downPayment,
      annualRate,
      months,
      years: months / 12,
      
      monthlyPayment,
      totalPaid,
      totalInterest,
      totalCost,
      
      // النسبة "البسيطة" اللي تظهرها البنوك
      simpleRate,
      
      // Effective ratio: total interest / principal
      interestRatio: totalInterest / actualPrincipal,
      
      // كم سيدفع زيادة عن المبلغ الأصلي
      extraPayment: totalInterest
    };
  }
  
  /**
   * يحسب تأثير القرض على الميزانية الحالية للمستخدم
   */
  function impactOnBudget(monthlyPayment) {
    if (!window.App?.store || !window.App?.Sel) {
      return { error: 'لا يمكن قراءة الميزانية' };
    }
    
    try {
      const year = window.App.store.get('year');
      const month = window.App.store.get('month');
      const totals = window.App.Sel.totals(year, month);
      
      const currentSavings = totals.save;
      const newSavings = currentSavings - monthlyPayment;
      const newSavingsPct = totals.income > 0 
        ? Math.round((Math.max(0, newSavings) / totals.income) * 100) 
        : 0;
      const newSpendPct = totals.income > 0
        ? Math.round(((totals.expense + monthlyPayment) / totals.income) * 100)
        : 0;
      
      let verdict, color;
      if (newSavings < 0) {
        verdict = 'لن تستطيع تحمّل هذا القسط — سيؤدي لعجز شهري';
        color = '#ef4444';
      } else if (newSpendPct > 90) {
        verdict = 'القسط سيستهلك أكثر من 90% من دخلك';
        color = '#ef4444';
      } else if (newSpendPct > 70) {
        verdict = 'القسط مرتفع — راجع أولوياتك المالية';
        color = '#f97316';
      } else if (newSavingsPct >= 20) {
        verdict = 'مناسب — لا يزال بإمكانك التوفير 20%+ شهرياً';
        color = '#10b981';
      } else if (newSavingsPct >= 10) {
        verdict = 'مقبول — لكن قلل من النفقات الترفيهية';
        color = '#f97316';
      } else {
        verdict = 'محدود — لن تتمكن من التوفير الكافي';
        color = '#f97316';
      }
      
      return {
        currentIncome: totals.income,
        currentExpense: totals.expense,
        currentSavings,
        newSavings,
        newSavingsPct,
        newSpendPct,
        affordable: newSavings >= 0,
        verdict,
        color
      };
    } catch (e) {
      return { error: e.message };
    }
  }
  
  /**
   * يقارن بين سيناريوهين (مثلاً: مدة 5 سنوات vs 10 سنوات)
   */
  function compare(scenarioA, scenarioB) {
    const a = analyze(scenarioA);
    const b = analyze(scenarioB);
    
    return {
      a, b,
      monthlyDiff: b.monthlyPayment - a.monthlyPayment,
      totalInterestDiff: b.totalInterest - a.totalInterest,
      betterTotal: a.totalInterest < b.totalInterest ? 'A' : 'B',
      betterMonthly: a.monthlyPayment < b.monthlyPayment ? 'A' : 'B'
    };
  }
  
  /**
   * يحسب أقصى قرض يمكن للمستخدم تحمله بناءً على ميزانيته
   * @param {number} maxMonthlyPayment - أقصى قسط شهري مقبول
   * @param {number} annualRate
   * @param {number} months
   */
  function maxLoanAmount(maxMonthlyPayment, annualRate, months) {
    if (annualRate === 0) return maxMonthlyPayment * months;
    const monthlyRate = annualRate / 12;
    const factor = Math.pow(1 + monthlyRate, months);
    return maxMonthlyPayment * (factor - 1) / (monthlyRate * factor);
  }
  
  /**
   * اقتراح قرض ذكي بناءً على الميزانية
   */
  function suggestSafe() {
    if (!window.App?.store) return null;
    
    try {
      const year = window.App.store.get('year');
      const month = window.App.store.get('month');
      const totals = window.App.Sel.totals(year, month);
      
      // اقتراح آمن: 30% من الدخل كأقصى قسط
      const safeMonthly = Math.floor(totals.income * 0.30);
      
      // افتراض: نسبة 5%، مدة 5 سنوات
      const maxAmount = maxLoanAmount(safeMonthly, 0.05, 60);
      
      return {
        safeMonthly,
        maxAmount: Math.floor(maxAmount),
        annualRate: 0.05,
        months: 60,
        rule: 'لا ينصح بأن يتجاوز القسط 30% من دخلك'
      };
    } catch (e) {
      return null;
    }
  }
  
  return {
    calculateMonthlyPayment,
    calculateSimpleRate,
    amortizationSchedule,
    analyze,
    impactOnBudget,
    compare,
    maxLoanAmount,
    suggestSafe
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.LoanSimulator = LoanSimulator;
window.LoanSimulator = LoanSimulator;
