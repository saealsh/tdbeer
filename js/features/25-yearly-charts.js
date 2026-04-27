/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Yearly Charts Manager
   ───────────────────────────────────────────────────────────────────
   يدير:
   - Year navigation (prev/next)
   - Interactive charts (bars + line)
   - Categories breakdown
   - Highlights (best/worst months)
   - Insights generation
   - Export & quick actions
═══════════════════════════════════════════════════════════════════ */

var YearlyCharts = (() => {
  let currentChartMode = 'bars';
  let initialized = false;
  
  const MONTHS_AR = window.Tdbeer?.MONTHS || [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
  ];
  
  /**
   * احسب البيانات السنوية (إعادة استخدام Sel.yearlyTotals)
   */
  function computeYearData(year) {
    try {
      const Sel = window.App?.selectors;
      if (Sel?.yearlyTotals) {
        return Sel.yearlyTotals(year);
      }
      
      // Fallback - حساب يدوي
      const data = window.App?.store?.get('data') || {};
      const monthly = [];
      let totalIncome = 0, totalExpense = 0;
      
      for (let m = 0; m < 12; m++) {
        const monthKey = `${year}_m${m}`;
        const md = data[monthKey] || {};
        let income = 0, expense = 0;
        
        (md.income || []).forEach(i => income += (i.amt || 0));
        (md.fixed || []).forEach(f => expense += (f.amt || 0));
        
        const daily = md.daily || {};
        Object.values(daily).forEach(items => {
          if (Array.isArray(items)) {
            items.forEach(item => {
              if (item.type === 'in') income += (item.amt || 0);
              else expense += (item.amt || 0);
            });
          }
        });
        
        monthly.push({ month: m, income, expense, save: income - expense });
        totalIncome += income;
        totalExpense += expense;
      }
      
      return {
        income: totalIncome,
        expense: totalExpense,
        save: totalIncome - totalExpense,
        monthly
      };
    } catch (e) {
      if (window.Logger) window.Logger.warn('YearlyCharts.compute', e?.message);
      return { income: 0, expense: 0, save: 0, monthly: [] };
    }
  }
  
  /**
   * احسب categories من السنة كلها
   */
  function computeCategories(year) {
    const cats = new Map(); // emoji -> { name, total, count }
    const data = window.App?.store?.get('data') || {};
    
    for (let m = 0; m < 12; m++) {
      const monthKey = `${year}_m${m}`;
      const md = data[monthKey] || {};
      const daily = md.daily || {};
      
      Object.values(daily).forEach(items => {
        if (Array.isArray(items)) {
          items.forEach(item => {
            if (item.type === 'in') return; // skip income
            const cat = item.cat || '➕';
            if (!cats.has(cat)) {
              cats.set(cat, { emoji: cat, total: 0, count: 0 });
            }
            const c = cats.get(cat);
            c.total += (item.amt || 0);
            c.count += 1;
          });
        }
      });
    }
    
    // Sort by total desc
    return Array.from(cats.values()).sort((a, b) => b.total - a.total);
  }
  
  /**
   * Format currency
   */
  function fmtMoney(n) {
    const Fmt = window.Tdbeer?.Fmt;
    if (Fmt?.c) return Fmt.c(n);
    return Math.round(n).toLocaleString('ar-SA') + ' ﷼';
  }
  
  /**
   * تحديث الـ stats cards
   */
  function updateStats(yt) {
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    
    setText('yInc', fmtMoney(yt.income));
    setText('yExp', fmtMoney(yt.expense));
    setText('ySav', fmtMoney(yt.save));
    
    // متوسطات
    const monthsWithData = yt.monthly.filter(m => m.income > 0 || m.expense > 0).length || 1;
    const avgInc = yt.income / monthsWithData;
    const avgExp = yt.expense / monthsWithData;
    
    setText('yIncSub', `متوسط: ${fmtMoney(avgInc)}/شهر`);
    setText('yExpSub', `متوسط: ${fmtMoney(avgExp)}/شهر`);
    
    // نسبة التوفير
    const savPct = yt.income > 0 ? (yt.save / yt.income) * 100 : 0;
    setText('ySavSub', yt.income > 0 ? `${savPct.toFixed(0)}% من الدخل` : 'لا يوجد دخل بعد');
    
    // Trends (مقارنة بالعام الماضي)
    updateTrends(yt);
  }
  
  /**
   * احسب الـ trends (مقارنة بالعام الماضي)
   */
  function updateTrends(yt) {
    try {
      const currentYear = window.App?.store?.get('year') || new Date().getFullYear();
      const lastYear = computeYearData(currentYear - 1);
      
      const setTrend = (id, current, prev, type) => {
        const el = document.getElementById(id);
        if (!el) return;
        
        if (prev === 0) {
          el.textContent = '';
          el.className = 'ystat-trend';
          return;
        }
        
        const diff = ((current - prev) / prev) * 100;
        const isUp = diff > 0;
        const goodIfUp = type === 'income' || type === 'saving';
        const isGood = goodIfUp ? isUp : !isUp;
        
        el.textContent = (isUp ? '↑' : '↓') + ' ' + Math.abs(diff).toFixed(0) + '%';
        el.className = 'ystat-trend ' + (isGood ? 'up' : 'down');
      };
      
      setTrend('yIncTrend', yt.income, lastYear.income, 'income');
      setTrend('yExpTrend', yt.expense, lastYear.expense, 'expense');
      setTrend('ySavTrend', yt.save, lastYear.save, 'saving');
    } catch (e) {
      if (window.Logger) window.Logger.warn('YearlyCharts.trends', e?.message);
    }
  }
  
  /**
   * Render Bars Chart
   */
  function renderBarsChart(yt) {
    const container = document.getElementById('yearChartContainer');
    if (!container) return;
    
    const max = Math.max(1, ...yt.monthly.flatMap(t => [t.income, t.expense]));
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const displayedYear = window.App?.store?.get('year') || currentYear;
    const isCurrentYear = displayedYear === currentYear;
    
    let html = '<div class="ychart-bars">';
    for (let i = 0; i < 12; i++) {
      const t = yt.monthly[i];
      const incH = (t.income / max) * 100;
      const expH = (t.expense / max) * 100;
      const isCurrent = isCurrentYear && i === currentMonth;
      const hasData = t.income > 0 || t.expense > 0;
      
      html += `
        <div class="ychart-month ${isCurrent ? 'current' : ''} ${hasData ? 'has-data' : ''}"
             data-month="${i}"
             data-income="${t.income}"
             data-expense="${t.expense}"
             data-save="${t.save}">
          <div class="ychart-month-bars">
            <div class="ychart-bar-inc" style="height:${incH}%; animation-delay: ${i * 30}ms"></div>
            <div class="ychart-bar-exp" style="height:${expH}%; animation-delay: ${i * 30 + 50}ms"></div>
          </div>
          <div class="ychart-month-lbl">${MONTHS_AR[i].slice(0, 3)}</div>
        </div>
      `;
    }
    html += '</div>';
    
    // Tooltip
    html += '<div class="ychart-tooltip" id="ychartTooltip"></div>';
    
    container.innerHTML = html;
    
    // Bind tooltips
    bindTooltips(container);
  }
  
  /**
   * Render Line Chart
   */
  function renderLineChart(yt) {
    const container = document.getElementById('yearChartContainer');
    if (!container) return;
    
    const w = 320, h = 180;
    const padX = 20, padY = 20;
    const max = Math.max(1, ...yt.monthly.flatMap(t => [t.income, t.expense, Math.abs(t.save)]));
    
    const xStep = (w - padX * 2) / 11;
    const scaleY = (val) => h - padY - ((val / max) * (h - padY * 2));
    
    // Build points
    const incPts = yt.monthly.map((t, i) => `${padX + i * xStep},${scaleY(t.income)}`).join(' ');
    const expPts = yt.monthly.map((t, i) => `${padX + i * xStep},${scaleY(t.expense)}`).join(' ');
    const savPts = yt.monthly.map((t, i) => `${padX + i * xStep},${scaleY(t.save)}`).join(' ');
    
    const incPath = `M ${incPts.split(' ').join(' L ')}`;
    const expPath = `M ${expPts.split(' ').join(' L ')}`;
    const savPath = `M ${savPts.split(' ').join(' L ')}`;
    
    // Area fills
    const incArea = `${incPath} L ${padX + 11 * xStep},${h - padY} L ${padX},${h - padY} Z`;
    const expArea = `${expPath} L ${padX + 11 * xStep},${h - padY} L ${padX},${h - padY} Z`;
    
    let svg = `
      <div class="ychart-line">
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
          <!-- Income -->
          <path d="${incArea}" fill="#10b981" class="ychart-line-area"/>
          <path d="${incPath}" stroke="#10b981" class="ychart-line-path"/>
          
          <!-- Expense -->
          <path d="${expArea}" fill="#ef4444" class="ychart-line-area"/>
          <path d="${expPath}" stroke="#ef4444" class="ychart-line-path"/>
          
          <!-- Saving -->
          <path d="${savPath}" stroke="${getCSSVar('--accent') || '#01dd8c'}" class="ychart-line-path" stroke-dasharray="4,2"/>
          
          <!-- Dots للنقاط -->
          ${yt.monthly.map((t, i) => `
            <circle cx="${padX + i * xStep}" cy="${scaleY(t.income)}" r="3" fill="#10b981" class="ychart-line-dot" data-month="${i}"/>
            <circle cx="${padX + i * xStep}" cy="${scaleY(t.expense)}" r="3" fill="#ef4444" class="ychart-line-dot" data-month="${i}"/>
          `).join('')}
        </svg>
      </div>
      
      <!-- Month labels -->
      <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:2px;padding:0 16px;margin-top:4px">
        ${MONTHS_AR.map(m => `<div style="text-align:center;font-size:9px;color:var(--text2);font-weight:700">${m.slice(0, 3)}</div>`).join('')}
      </div>
    `;
    
    container.innerHTML = svg;
  }
  
  function getCSSVar(name) {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    } catch {
      return '';
    }
  }
  
  /**
   * Bind tooltips للـ bars chart
   */
  function bindTooltips(container) {
    const tooltip = document.getElementById('ychartTooltip');
    if (!tooltip) return;
    
    container.querySelectorAll('.ychart-month').forEach(month => {
      month.addEventListener('mouseenter', (e) => {
        const m = parseInt(month.dataset.month);
        const inc = parseFloat(month.dataset.income);
        const exp = parseFloat(month.dataset.expense);
        const save = parseFloat(month.dataset.save);
        
        tooltip.innerHTML = `
          <div style="font-weight:800;margin-bottom:4px">${MONTHS_AR[m]}</div>
          <div class="ychart-tooltip-line"><div class="ychart-tooltip-dot" style="background:#10b981"></div>دخل: ${fmtMoney(inc)}</div>
          <div class="ychart-tooltip-line"><div class="ychart-tooltip-dot" style="background:#ef4444"></div>صرف: ${fmtMoney(exp)}</div>
          <div class="ychart-tooltip-line" style="border-top:1px solid rgba(255,255,255,0.2);padding-top:4px;margin-top:4px"><div class="ychart-tooltip-dot" style="background:${save >= 0 ? '#10b981' : '#ef4444'}"></div>${save >= 0 ? 'وفّرت' : 'تجاوز'}: ${fmtMoney(Math.abs(save))}</div>
        `;
        
        const rect = month.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        tooltip.style.left = (rect.left - containerRect.left + rect.width / 2) + 'px';
        tooltip.style.top = (rect.top - containerRect.top - 90) + 'px';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.classList.add('show');
      });
      
      month.addEventListener('mouseleave', () => {
        tooltip.classList.remove('show');
      });
      
      // Mobile - click to show
      month.addEventListener('click', (e) => {
        month.dispatchEvent(new Event('mouseenter'));
        setTimeout(() => tooltip.classList.remove('show'), 2500);
      });
    });
  }
  
  /**
   * Render Highlights (best/worst months)
   */
  function renderHighlights(yt) {
    let bestSaveMonth = -1, bestSave = -Infinity;
    let worstExpMonth = -1, worstExp = 0;
    
    yt.monthly.forEach((t, i) => {
      if (t.income > 0 || t.expense > 0) {
        if (t.save > bestSave) {
          bestSave = t.save;
          bestSaveMonth = i;
        }
        if (t.expense > worstExp) {
          worstExp = t.expense;
          worstExpMonth = i;
        }
      }
    });
    
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    
    if (bestSaveMonth >= 0) {
      setText('yBestMonth', MONTHS_AR[bestSaveMonth]);
      setText('yBestAmount', '+' + fmtMoney(bestSave));
    } else {
      setText('yBestMonth', 'لا توجد بيانات');
      setText('yBestAmount', '');
    }
    
    if (worstExpMonth >= 0) {
      setText('yWorstMonth', MONTHS_AR[worstExpMonth]);
      setText('yWorstAmount', fmtMoney(worstExp));
    } else {
      setText('yWorstMonth', 'لا توجد بيانات');
      setText('yWorstAmount', '');
    }
  }
  
  /**
   * Render Categories Breakdown
   */
  function renderCategories(year) {
    const list = document.getElementById('yearCategoriesList');
    if (!list) return;
    
    const cats = computeCategories(year);
    
    if (cats.length === 0) {
      list.innerHTML = `
        <div class="year-categories-empty">
          <div style="font-size:32px;margin-bottom:8px">📊</div>
          <div>ما فيه مصاريف بعد</div>
        </div>
      `;
      return;
    }
    
    const total = cats.reduce((s, c) => s + c.total, 0);
    const top10 = cats.slice(0, 10);
    
    // Category names lookup
    const CAT_NAMES = {
      '🍔': 'طعام', '☕': 'قهوة', '⛽': 'بنزين', '🛒': 'سوبرماركت',
      '🛍️': 'تسوق', '🚗': 'مواصلات', '🏥': 'صحة', '📚': 'تعليم',
      '🎬': 'ترفيه', '💊': 'دواء', '👕': 'ملابس', '📱': 'اتصالات',
      '💡': 'فواتير', '🎁': 'هدايا', '🏠': 'إيجار', '⚡': 'كهرباء',
      '💧': 'ماء', '📺': 'اشتراك', '➕': 'أخرى'
    };
    
    list.innerHTML = top10.map((c, i) => {
      const pct = (c.total / total) * 100;
      const name = CAT_NAMES[c.emoji] || 'أخرى';
      return `
        <div class="ycat-item">
          <div class="ycat-icon">${c.emoji}</div>
          <div class="ycat-info">
            <div class="ycat-top">
              <div class="ycat-name">${name}</div>
              <div class="ycat-amount">${fmtMoney(c.total)}</div>
            </div>
            <div class="ycat-bar">
              <div class="ycat-bar-fill" style="width:${pct.toFixed(1)}%; transition-delay:${i * 50}ms"></div>
            </div>
            <div class="ycat-pct">${pct.toFixed(1)}% • ${c.count} ${c.count === 1 ? 'مرة' : 'مرات'}</div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  /**
   * Render Insights Strip
   */
  function renderInsights(yt) {
    const strip = document.getElementById('yearInsightsStrip');
    if (!strip) return;
    
    const insights = [];
    const monthsWithData = yt.monthly.filter(m => m.income > 0 || m.expense > 0).length;
    
    // 1. نسبة التوفير
    if (yt.income > 0) {
      const savPct = (yt.save / yt.income) * 100;
      if (savPct >= 20) {
        insights.push({
          type: 'success', icon: '🏆',
          title: `وفّرت ${savPct.toFixed(0)}% من دخلك`,
          msg: 'تجاوزت هدف 20% — أداء ممتاز!'
        });
      } else if (savPct > 0 && savPct < 10) {
        insights.push({
          type: 'warning', icon: '⚠️',
          title: 'نسبة توفير منخفضة',
          msg: `وفّرت ${savPct.toFixed(0)}% فقط، الهدف 20%`
        });
      }
    }
    
    // 2. شهور نشطة
    if (monthsWithData < 3 && monthsWithData > 0) {
      insights.push({
        type: 'info', icon: '📅',
        title: `${monthsWithData} ${monthsWithData === 1 ? 'شهر' : 'أشهر'} مسجّلة`,
        msg: 'تحتاج بيانات أكثر للتحليل'
      });
    } else if (monthsWithData >= 6) {
      insights.push({
        type: 'success', icon: '✨',
        title: `${monthsWithData} ${monthsWithData >= 11 ? 'شهر' : 'أشهر'} من البيانات`,
        msg: 'بيانات كافية لتحليل دقيق'
      });
    }
    
    // 3. اتجاه المصاريف
    if (monthsWithData >= 3) {
      const recent3 = yt.monthly.slice(-3).filter(m => m.expense > 0);
      const earlier = yt.monthly.slice(0, 9).filter(m => m.expense > 0);
      if (recent3.length > 0 && earlier.length > 0) {
        const recentAvg = recent3.reduce((s, m) => s + m.expense, 0) / recent3.length;
        const earlierAvg = earlier.reduce((s, m) => s + m.expense, 0) / earlier.length;
        if (recentAvg > earlierAvg * 1.3) {
          insights.push({
            type: 'warning', icon: '📈',
            title: 'مصاريفك ترتفع',
            msg: `زادت ${((recentAvg / earlierAvg - 1) * 100).toFixed(0)}% مؤخراً`
          });
        } else if (earlierAvg > recentAvg * 1.3) {
          insights.push({
            type: 'success', icon: '📉',
            title: 'تحسّن في الصرف',
            msg: `قلّت ${((1 - recentAvg / earlierAvg) * 100).toFixed(0)}% مؤخراً`
          });
        }
      }
    }
    
    if (insights.length === 0) {
      strip.innerHTML = '';
      return;
    }
    
    strip.innerHTML = insights.map(ins => `
      <div class="yins-card ${ins.type}">
        <div class="yins-icon">${ins.icon}</div>
        <div class="yins-text">
          <div class="yins-title">${ins.title}</div>
          <div class="yins-msg">${ins.msg}</div>
        </div>
      </div>
    `).join('');
  }
  
  /**
   * Update Year Display
   */
  function updateYearDisplay(year) {
    const text = document.getElementById('yearDisplayText');
    const sub = document.getElementById('yearDisplaySub');
    if (text) text.textContent = year;
    if (sub) {
      const currentYear = new Date().getFullYear();
      if (year === currentYear) sub.textContent = 'السنة الحالية';
      else if (year < currentYear) sub.textContent = `قبل ${currentYear - year} ${currentYear - year === 1 ? 'سنة' : 'سنوات'}`;
      else sub.textContent = `بعد ${year - currentYear} ${year - currentYear === 1 ? 'سنة' : 'سنوات'}`;
    }
    
    // Disable next button if future year
    const nextBtn = document.getElementById('yearNext');
    if (nextBtn) {
      const currentYear = new Date().getFullYear();
      nextBtn.disabled = year >= currentYear;
    }
  }
  
  /**
   * Render All
   */
  function render() {
    const year = window.App?.store?.get('year') || new Date().getFullYear();
    const yt = computeYearData(year);
    
    updateYearDisplay(year);
    updateStats(yt);
    renderInsights(yt);
    renderHighlights(yt);
    renderCategories(year);
    
    // Render chart based on mode
    if (currentChartMode === 'bars') {
      renderBarsChart(yt);
    } else {
      renderLineChart(yt);
    }
  }
  
  /**
   * Init
   */
  function init() {
    if (initialized) return;
    initialized = true;
    
    // Year navigation
    document.getElementById('yearPrev')?.addEventListener('click', () => {
      const year = window.App?.store?.get('year') || new Date().getFullYear();
      window.App?.store?.set('year', year - 1);
      // إعادة تعيين الشهر للحالي إذا كانت السنة الحالية
      setTimeout(render, 100);
    });
    
    document.getElementById('yearNext')?.addEventListener('click', (e) => {
      if (e.currentTarget.disabled) return;
      const year = window.App?.store?.get('year') || new Date().getFullYear();
      window.App?.store?.set('year', year + 1);
      setTimeout(render, 100);
    });
    
    // Chart mode toggle
    document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentChartMode = btn.dataset.chartMode;
        render();
      });
    });
    
    // Quick actions
    document.getElementById('yExportYearBtn')?.addEventListener('click', () => {
      if (window.AdvancedExport?.exportYearCSV) {
        window.AdvancedExport.exportYearCSV();
      } else {
        window.Toast?.show?.('ميزة التصدير غير متاحة', 'warn');
      }
    });
    
    document.getElementById('yWrappedBtn')?.addEventListener('click', () => {
      if (window.YearWrapped?.show) {
        window.YearWrapped.show();
      } else {
        window.Toast?.show?.('التقرير السنوي غير متاح', 'warn');
      }
    });
    
    // إعادة render عند تغيير tab
    if (window.App?.store) {
      window.App.store.subscribe('tab', (val) => {
        if (val === 'money') {
          const sub = window.App.store.get('subTab');
          if (sub === 'yearly') {
            setTimeout(render, 100);
          }
        }
      });
      window.App.store.subscribe('subTab', (val) => {
        if (val === 'yearly') {
          setTimeout(render, 100);
        }
      });
      window.App.store.subscribe('year', () => {
        setTimeout(render, 50);
      });
      window.App.store.subscribe('data', () => {
        // فقط إذا كنا في yearly tab
        const sub = window.App?.store?.get('subTab');
        if (sub === 'yearly') {
          setTimeout(render, 200);
        }
      });
    }
    
    // Render إذا كنا فيه فعلاً
    setTimeout(() => {
      const tab = window.App?.store?.get('tab');
      const sub = window.App?.store?.get('subTab');
      if ((tab === 'money' || tab === 'yearly') && (sub === 'yearly' || tab === 'yearly')) {
        render();
      }
    }, 800);
  }
  
  return { init, render, computeYearData, computeCategories };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.YearlyCharts = YearlyCharts;
window.YearlyCharts = YearlyCharts;
