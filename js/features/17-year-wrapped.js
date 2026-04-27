/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Year Wrapped + Advanced Export
   ───────────────────────────────────────────────────────────────────
   1. Year Wrapped: تقرير سنوي بصري Spotify-style
   2. Advanced Export: JSON Backup, Email summary, Excel-like CSV
═══════════════════════════════════════════════════════════════════ */

var YearWrapped = (() => {
  
  /**
   * يحلّل بيانات السنة كاملة ويرجع insights
   */
  function analyze(year) {
    if (!window.App?.store) return null;
    
    try {
      const data = window.App.store.get('data') || {};
      
      let totalIncome = 0;
      let totalExpense = 0;
      const categoryTotals = {};
      const monthlyTotals = [];
      const dayOfWeekSpending = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
      let totalEntries = 0;
      let highestDay = { date: null, amount: 0, monthName: '' };
      let highestMonth = { month: null, amount: 0, name: '' };
      let savingsMonths = 0;
      let totalNoSpendDays = 0;
      
      for (let m = 0; m < 12; m++) {
        const monthData = data[`${year}_m${m}`];
        if (!monthData) {
          monthlyTotals.push({ income: 0, expense: 0 });
          continue;
        }
        
        // Income
        const income = (monthData.income || []).reduce((s, x) => s + (Number(x.amt) || 0), 0);
        const fixed = (monthData.fixed || []).reduce((s, x) => s + (Number(x.amt) || 0), 0);
        const variable = (monthData.variable || []).reduce((s, x) => s + (Number(x.amt) || 0), 0);
        
        // Daily entries
        let dailyOut = 0;
        let dailyIn = 0;
        const daysSpent = new Set();
        
        for (const [day, arr] of Object.entries(monthData.daily || {})) {
          const dayNum = parseInt(day);
          let dayTotal = 0;
          
          for (const e of arr) {
            totalEntries++;
            const amt = Number(e.amt) || 0;
            
            if (e.type === 'out') {
              dailyOut += amt;
              dayTotal += amt;
              daysSpent.add(dayNum);
              
              // category
              const cat = e.cat || '➕';
              categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
              
              // day of week
              const date = new Date(year, m, dayNum);
              dayOfWeekSpending[date.getDay()] += amt;
            } else {
              dailyIn += amt;
            }
          }
          
          // أعلى يوم
          if (dayTotal > highestDay.amount) {
            highestDay = {
              date: new Date(year, m, dayNum),
              amount: dayTotal,
              monthName: window.Tdbeer.MONTHS[m]
            };
          }
        }
        
        const monthIncome = income + dailyIn;
        const monthExpense = fixed + variable + dailyOut;
        totalIncome += monthIncome;
        totalExpense += monthExpense;
        
        if (monthExpense > highestMonth.amount) {
          highestMonth = {
            month: m,
            amount: monthExpense,
            name: window.Tdbeer.MONTHS[m]
          };
        }
        
        if (monthIncome > monthExpense) savingsMonths++;
        
        // أيام بدون صرف
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const today = new Date();
        const lastDay = (year === today.getFullYear() && m === today.getMonth())
          ? today.getDate()
          : daysInMonth;
        totalNoSpendDays += (lastDay - daysSpent.size);
        
        monthlyTotals.push({ income: monthIncome, expense: monthExpense });
      }
      
      // Top categories
      const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, amt]) => ({
          cat,
          amount: amt,
          pct: totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0
        }));
      
      // أعلى يوم في الأسبوع
      const dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      const maxDayIdx = dayOfWeekSpending.indexOf(Math.max(...dayOfWeekSpending));
      
      // الإنجازات
      const achievements = window.App.store.get('achievements') || [];
      const totalPts = window.App.store.get('pts') || 0;
      const streak = window.App.store.get('streak') || {};
      
      return {
        year,
        totalIncome,
        totalExpense,
        totalSavings: totalIncome - totalExpense,
        savingsPct: totalIncome > 0 
          ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) 
          : 0,
        topCategories,
        highestDay,
        highestMonth,
        savingsMonths,
        totalEntries,
        totalNoSpendDays,
        monthlyTotals,
        topDayOfWeek: {
          name: dayNames[maxDayIdx],
          amount: dayOfWeekSpending[maxDayIdx]
        },
        achievementsCount: achievements.length,
        totalPts,
        maxStreak: streak.max || 0
      };
    } catch (e) {
      window.Logger?.error?.('YearWrapped.analyze', e);
      return null;
    }
  }
  
  /**
   * يولّد قائمة "story slides" للعرض البصري
   */
  function buildSlides(insights) {
    if (!insights) return [];
    
    const slides = [
      {
        title: `سنتك المالية ${insights.year}`,
        subtitle: 'لنرى ماذا أنجزت',
        icon: '🎉',
        bg: 'linear-gradient(135deg, #c9a84c, #f0d98a)'
      },
      {
        title: `صرفت ${formatNumber(insights.totalExpense)} ريال`,
        subtitle: `عبر ${insights.totalEntries} معاملة`,
        icon: '💰',
        bg: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)'
      }
    ];
    
    // الفئة الأولى
    if (insights.topCategories.length > 0) {
      const top = insights.topCategories[0];
      slides.push({
        title: `أكثر ما صرفت عليه: ${top.cat}`,
        subtitle: `${formatNumber(top.amount)} ريال (${top.pct}% من إجمالي مصاريفك)`,
        icon: top.cat,
        bg: 'linear-gradient(135deg, #ef4444, #f97316)'
      });
    }
    
    // أعلى يوم
    if (insights.highestDay.date) {
      const d = insights.highestDay.date;
      slides.push({
        title: 'أعلى يوم صرفاً',
        subtitle: `${d.getDate()} ${insights.highestDay.monthName} — ${formatNumber(insights.highestDay.amount)} ريال`,
        icon: '📅',
        bg: 'linear-gradient(135deg, #8b5cf6, #6366f1)'
      });
    }
    
    // التوفير
    if (insights.totalSavings > 0) {
      slides.push({
        title: `وفّرت ${formatNumber(insights.totalSavings)} ريال`,
        subtitle: `${insights.savingsPct}% من دخلك السنوي 🌟`,
        icon: '💎',
        bg: 'linear-gradient(135deg, #10b981, #34d399)'
      });
    } else if (insights.totalIncome > 0) {
      slides.push({
        title: 'الميزانية متوازنة',
        subtitle: 'الصرف يتناسب مع الدخل — حاول توفير أكثر العام القادم',
        icon: '⚖️',
        bg: 'linear-gradient(135deg, #f97316, #fb923c)'
      });
    }
    
    // يوم الأسبوع
    if (insights.topDayOfWeek.amount > 0) {
      slides.push({
        title: `${insights.topDayOfWeek.name} يوم الإنفاق`,
        subtitle: `أكثر يوم تصرف فيه — ${formatNumber(insights.topDayOfWeek.amount)} ريال`,
        icon: '📊',
        bg: 'linear-gradient(135deg, #06b6d4, #0891b2)'
      });
    }
    
    // أيام بدون صرف
    if (insights.totalNoSpendDays > 30) {
      slides.push({
        title: `${insights.totalNoSpendDays} يوم بدون صرف`,
        subtitle: 'إنجاز رائع 🌱',
        icon: '🌱',
        bg: 'linear-gradient(135deg, #10b981, #059669)'
      });
    }
    
    // الإنجازات
    if (insights.achievementsCount > 0) {
      slides.push({
        title: `${insights.achievementsCount} إنجاز`,
        subtitle: `${formatNumber(insights.totalPts)} نقطة | أطول سلسلة: ${insights.maxStreak} يوم`,
        icon: '🏆',
        bg: 'linear-gradient(135deg, #eab308, #facc15)'
      });
    }
    
    // النهاية
    slides.push({
      title: 'شكراً لأنك معنا',
      subtitle: 'استمر في التدبير — العام القادم أفضل!',
      icon: '✨',
      bg: 'linear-gradient(135deg, #c9a84c, #f0d98a)',
      isLast: true
    });
    
    return slides;
  }
  
  function formatNumber(n) {
    if (n >= 1000) {
      return new Intl.NumberFormat('ar-SA').format(Math.round(n));
    }
    return Math.round(n);
  }
  
  /**
   * عرض التقرير كـ stories (Instagram-style)
   */
  function show(year) {
    year = year || new Date().getFullYear();
    const insights = analyze(year);
    if (!insights || insights.totalEntries === 0) {
      window.Toast?.show?.('لا بيانات كافية لهذه السنة', 'warn');
      return;
    }
    
    const slides = buildSlides(insights);
    let currentIdx = 0;
    
    const overlay = document.createElement('div');
    overlay.className = 'wrapped-overlay';
    overlay.innerHTML = `
      <div class="wrapped-progress">
        ${slides.map((_, i) => `<div class="wrapped-bar" data-idx="${i}"></div>`).join('')}
      </div>
      <button class="wrapped-close" aria-label="إغلاق">✕</button>
      <div class="wrapped-slide-container"></div>
      <div class="wrapped-tap-prev"></div>
      <div class="wrapped-tap-next"></div>
      <button class="wrapped-share-btn">🔗 شارك إنجازك</button>
    `;
    document.body.appendChild(overlay);
    
    const slideContainer = overlay.querySelector('.wrapped-slide-container');
    const bars = overlay.querySelectorAll('.wrapped-bar');
    let advanceTimer;
    
    function showSlide(idx) {
      if (idx < 0 || idx >= slides.length) return;
      currentIdx = idx;
      
      const slide = slides[idx];
      slideContainer.style.background = slide.bg;
      slideContainer.innerHTML = `
        <div class="wrapped-slide">
          <div class="wrapped-icon">${slide.icon}</div>
          <h2 class="wrapped-title">${escapeHtml(slide.title)}</h2>
          <p class="wrapped-subtitle">${escapeHtml(slide.subtitle)}</p>
        </div>
      `;
      
      // Update progress bars
      bars.forEach((b, i) => {
        b.classList.toggle('active', i === idx);
        b.classList.toggle('done', i < idx);
      });
      
      // Auto-advance after 4 seconds (except last slide)
      clearTimeout(advanceTimer);
      if (!slide.isLast) {
        advanceTimer = setTimeout(() => showSlide(idx + 1), 4000);
      }
    }
    
    function close() {
      clearTimeout(advanceTimer);
      overlay.remove();
    }
    
    overlay.querySelector('.wrapped-close').onclick = close;
    overlay.querySelector('.wrapped-tap-prev').onclick = () => showSlide(currentIdx - 1);
    overlay.querySelector('.wrapped-tap-next').onclick = () => showSlide(currentIdx + 1);
    
    overlay.querySelector('.wrapped-share-btn').onclick = async () => {
      const text = `سنتي المالية في تـدّبير ${year}! 🎉\n` +
        `💰 وفّرت: ${formatNumber(insights.totalSavings)} ريال\n` +
        `🏆 ${insights.achievementsCount} إنجاز\n` +
        `🌱 ${insights.totalNoSpendDays} يوم بدون صرف\n\n` +
        `https://tdbeerksa.com`;
      
      if (navigator.share) {
        try { await navigator.share({ text }); } catch {}
      } else {
        try {
          await navigator.clipboard.writeText(text);
          window.Toast?.show?.('تم نسخ النص للمشاركة 📋', 'success');
        } catch {}
      }
    };
    
    showSlide(0);
  }
  
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  return { show, analyze, buildSlides };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.YearWrapped = YearWrapped;
window.YearWrapped = YearWrapped;


/* ═══════════════════════════════════════════════════════════════════
   Advanced Export
═══════════════════════════════════════════════════════════════════ */

var AdvancedExport = (() => {
  
  /**
   * Export شامل بصيغة JSON (نسخة احتياطية كاملة)
   */
  function exportJSON() {
    if (!window.App?.store) return;
    
    const snapshot = window.App.store.snapshot();
    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      app: 'tdbeer',
      data: snapshot
    };
    
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `tdbeer_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    window.Toast?.show?.('تم حفظ النسخة الاحتياطية ✅', 'success');
  }
  
  /**
   * استيراد من ملف JSON
   * 🔒 SECURITY (Apr 2026): added schema validation + name sanitization.
   *    Previously a malicious backup file could inject XSS payloads via
   *    expense names that would later trigger via the search highlight()
   *    bug. Even with that bug fixed, defense in depth: clean inputs.
   */
  function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    
    // Whitelist of state keys we'll accept from a backup.
    // Anything else is silently dropped.
    const ALLOWED_KEYS = new Set([
      'data', 'pts', 'salaryDay', 'streak', 'notifs',
      'theme', 'achievements', 'userName'
    ]);

    // Strip control chars and trim. Keep emoji and Arabic.
    function cleanStr(s, max) {
      if (typeof s !== 'string') return '';
      // Remove ASCII control chars 0x00-0x1F except \n \t, plus 0x7F.
      // eslint-disable-next-line no-control-regex
      return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, max || 200);
    }
    function cleanNum(n) {
      const v = parseFloat(n);
      return Number.isFinite(v) ? v : 0;
    }
    function cleanItem(item) {
      if (!item || typeof item !== 'object') return null;
      return {
        id: cleanStr(item.id, 64) || (window.U?.uid ? window.U.uid() : Date.now() + ''),
        name: cleanStr(item.name, 60),
        amt: cleanNum(item.amt),
        cat: cleanStr(item.cat, 8),
        paid: !!item.paid,
        recurring: !!item.recurring,
        type: item.type === 'in' ? 'in' : (item.type === 'out' ? 'out' : undefined)
      };
    }
    function cleanMonthData(md) {
      if (!md || typeof md !== 'object') return {};
      const out = { income: [], fixed: [], variable: [], goals: [], daily: {}, budgets: [] };
      for (const k of ['income', 'fixed', 'variable']) {
        if (Array.isArray(md[k])) {
          out[k] = md[k].map(cleanItem).filter(Boolean);
        }
      }
      if (Array.isArray(md.goals)) {
        out.goals = md.goals.filter(g => g && typeof g === 'object').map(g => ({
          id: cleanStr(g.id, 64),
          name: cleanStr(g.name, 60),
          target: cleanNum(g.target),
          saved: cleanNum(g.saved)
        }));
      }
      if (Array.isArray(md.budgets)) {
        out.budgets = md.budgets.filter(b => b && typeof b === 'object').map(b => ({
          name: cleanStr(b.name, 30),
          limit: cleanNum(b.limit)
        }));
      }
      if (md.daily && typeof md.daily === 'object') {
        for (const day of Object.keys(md.daily)) {
          const dayNum = parseInt(day, 10);
          if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) continue;
          if (!Array.isArray(md.daily[day])) continue;
          out.daily[dayNum] = md.daily[day].map(cleanItem).filter(Boolean);
        }
      }
      return out;
    }

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reject suspiciously huge files (10 MB ceiling).
      if (file.size > 10 * 1024 * 1024) {
        window.Toast?.show?.('الملف كبير جداً', 'danger');
        return;
      }
      
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        
        if (backup.app !== 'tdbeer' || !backup.data) {
          throw new Error('ملف غير صحيح');
        }
        
        // تأكيد من المستخدم
        if (!confirm('هل تريد استبدال البيانات الحالية بالنسخة الاحتياطية؟ سيتم فقدان البيانات الحالية.')) {
          return;
        }

        // Build a sanitized payload — only whitelisted keys, cleaned values.
        const safe = {};
        for (const [key, value] of Object.entries(backup.data)) {
          if (!ALLOWED_KEYS.has(key)) continue;
          if (key === 'data' && value && typeof value === 'object') {
            // Each child key is a month bucket like "2026_m3".
            const cleanedData = {};
            for (const monthKey of Object.keys(value)) {
              if (!/^\d{4}_m([0-9]|1[0-1])$/.test(monthKey)) continue;
              cleanedData[monthKey] = cleanMonthData(value[monthKey]);
            }
            safe[key] = cleanedData;
          } else if (key === 'userName' || key === 'theme') {
            safe[key] = cleanStr(value, 60);
          } else if (key === 'pts' || key === 'salaryDay') {
            safe[key] = cleanNum(value);
          } else if (key === 'streak' && value && typeof value === 'object') {
            safe[key] = {
              days: Array.isArray(value.days) ? value.days.filter(d => typeof d === 'string').slice(0, 1000) : [],
              current: cleanNum(value.current),
              max: cleanNum(value.max),
              total: cleanNum(value.total)
            };
          } else if (key === 'notifs' && Array.isArray(value)) {
            safe[key] = value.slice(0, 100).filter(n => n && typeof n === 'object').map(n => ({
              id: cleanStr(n.id, 64),
              text: cleanStr(n.text, 200),
              ts: cleanNum(n.ts),
              read: !!n.read
            }));
          } else if (key === 'achievements' && Array.isArray(value)) {
            safe[key] = value.filter(a => typeof a === 'string').slice(0, 50).map(a => cleanStr(a, 64));
          }
        }
        
        // استعادة الحالة (sanitized)
        const store = window.App.store;
        store.batch(() => {
          for (const [key, value] of Object.entries(safe)) {
            store.set(key, value);
          }
        });
        
        window.Toast?.show?.('تم استرجاع النسخة الاحتياطية 🎉', 'success');
        
        // re-render
        setTimeout(() => location.reload(), 1500);
      } catch (e) {
        window.Logger?.error?.('AdvancedExport.import', e);
        window.Toast?.show?.('فشل استيراد الملف: ' + (e.message || ''), 'danger');
      }
    };
    
    input.click();
  }
  
  /**
   * CSV متقدم بكل تفاصيل السنة
   */
  function exportYearCSV(year) {
    year = year || new Date().getFullYear();
    if (!window.App?.store) return;
    
    const data = window.App.store.get('data') || {};
    const rows = [['التاريخ', 'الشهر', 'البند', 'الفئة', 'النوع', 'المبلغ', 'حالة']];
    
    for (let m = 0; m < 12; m++) {
      const monthData = data[`${year}_m${m}`];
      if (!monthData) continue;
      const monthName = window.Tdbeer.MONTHS[m];
      
      // الدخل الثابت
      for (const item of (monthData.income || [])) {
        rows.push([
          `${m+1}/${year}`, monthName, item.name, item.cat || '💵',
          'دخل', item.amt, item.paid ? 'مستلم' : 'متوقع'
        ]);
      }
      
      // المصاريف الثابتة
      for (const item of (monthData.fixed || [])) {
        rows.push([
          `${m+1}/${year}`, monthName, item.name, item.cat || '🏠',
          'ثابت', item.amt, item.paid ? 'مدفوع' : 'مستحق'
        ]);
      }
      
      // المصاريف المتغيرة
      for (const item of (monthData.variable || [])) {
        rows.push([
          `${m+1}/${year}`, monthName, item.name, item.cat || '➕',
          'متغير', item.amt, ''
        ]);
      }
      
      // اليومية
      for (const [day, arr] of Object.entries(monthData.daily || {})) {
        for (const e of arr) {
          rows.push([
            `${day}/${m+1}/${year}`, monthName, e.name, e.cat || '➕',
            e.type === 'out' ? 'مصروف يومي' : 'دخل يومي',
            e.amt, ''
          ]);
        }
      }
    }
    
    const csv = rows.map(r => 
      r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tdbeer_year_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    window.Toast?.show?.('تم تصدير السنة كاملة ✅', 'success');
  }
  
  /**
   * Email summary - يفتح mail client مع نص جاهز
   */
  function emailMonthlySummary() {
    if (!window.App?.store) return;
    
    const year = window.App.store.get('year');
    const month = window.App.store.get('month');
    const totals = window.App.Sel.totals(year, month);
    const monthData = window.App.Sel.monthData(year, month);
    const monthName = window.Tdbeer.MONTHS[month];
    
    const subject = `تقرير ${monthName} ${year} — تـدّبير`;
    
    let body = `تقرير شهري — ${monthName} ${year}\n`;
    body += `${'─'.repeat(40)}\n\n`;
    body += `📊 ملخّص:\n`;
    body += `الدخل: ${totals.income} ريال\n`;
    body += `المصاريف: ${totals.expense} ريال\n`;
    body += `التوفير: ${totals.save} ريال (${totals.savePct}%)\n\n`;
    
    if (monthData.income.length > 0) {
      body += `\n💵 الدخل (${monthData.income.length} بنود):\n`;
      for (const item of monthData.income) {
        body += `  ${item.cat} ${item.name}: ${item.amt} ريال\n`;
      }
    }
    
    if (monthData.fixed.length > 0) {
      body += `\n🏠 المصاريف الثابتة (${monthData.fixed.length}):\n`;
      for (const item of monthData.fixed) {
        body += `  ${item.cat} ${item.name}: ${item.amt} ريال\n`;
      }
    }
    
    body += `\n${'─'.repeat(40)}\n`;
    body += `صادر من تـدّبير — https://tdbeerksa.com`;
    
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }
  
  return {
    exportJSON,
    importJSON,
    exportYearCSV,
    emailMonthlySummary
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.AdvancedExport = AdvancedExport;
window.AdvancedExport = AdvancedExport;
