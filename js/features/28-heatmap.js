/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Heatmap & Trends Manager
   ───────────────────────────────────────────────────────────────────
   GitHub-style activity heatmap + smart trends analysis
   - شبكة 7×53 خلية لكل أيام السنة
   - 5 مستويات لون حسب كثافة الإنفاق
   - tooltips تفاعلية بكل التفاصيل
   - تحليل الاتجاهات (trends)
═══════════════════════════════════════════════════════════════════ */

var Heatmap = (() => {
  let initialized = false;
  
  const MONTHS_AR = window.Tdbeer?.MONTHS || [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
  ];
  
  const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  
  /**
   * Format currency
   */
  function fmtMoney(n) {
    return Math.round(n).toLocaleString('ar-SA') + ' ﷼';
  }
  
  /**
   * Get day data — يُجمع المصاريف لكل يوم في السنة
   */
  function getYearActivity(year) {
    const activity = {}; // dateKey: { count, total, items }
    const data = window.App?.store?.get('data') || {};
    
    for (let m = 0; m < 12; m++) {
      const monthKey = `${year}_m${m}`;
      const md = data[monthKey] || {};
      const daily = md.daily || {};
      
      Object.entries(daily).forEach(([day, items]) => {
        if (!Array.isArray(items)) return;
        const dayNum = parseInt(day);
        if (isNaN(dayNum)) return;
        
        const dateKey = `${year}-${m}-${dayNum}`;
        let total = 0, count = 0;
        
        items.forEach(item => {
          if (item.type !== 'in') {
            total += (item.amt || 0);
            count++;
          }
        });
        
        if (count > 0) {
          activity[dateKey] = { count, total, items: items.filter(i => i.type !== 'in') };
        }
      });
    }
    
    return activity;
  }
  
  /**
   * احسب مستوى الـ heat (0-4) بناءً على الإنفاق
   */
  function getHeatLevel(amount, max) {
    if (amount <= 0) return 0;
    if (max <= 0) return 0;
    
    const ratio = amount / max;
    if (ratio < 0.1) return 1;
    if (ratio < 0.3) return 2;
    if (ratio < 0.6) return 3;
    return 4;
  }
  
  /**
   * Render Heatmap
   */
  function render() {
    const grid = document.getElementById('heatmapGrid');
    const monthLabels = document.getElementById('heatmapMonthLabels');
    const stats = document.getElementById('heatmapActiveDays');
    if (!grid || !monthLabels) return;
    
    const year = window.App?.store?.get('year') || new Date().getFullYear();
    const activity = getYearActivity(year);
    
    // Find max للـ scaling
    const maxAmount = Math.max(0, ...Object.values(activity).map(a => a.total));
    
    // Build grid
    grid.innerHTML = '';
    
    // اليوم الأول من السنة
    const firstDay = new Date(year, 0, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = الأحد
    
    // اليوم الأخير من السنة
    const lastDay = new Date(year, 11, 31);
    const totalDays = Math.ceil((lastDay - firstDay) / (1000 * 60 * 60 * 24)) + 1;
    
    // عدد الأسابيع المعروضة
    const totalCells = firstDayOfWeek + totalDays;
    const totalWeeks = Math.ceil(totalCells / 7);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let activeDays = 0;
    let totalSpent = 0;
    
    // إنشاء الخلايا
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < totalWeeks * 7; i++) {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      
      // حساب التاريخ لهذه الخلية
      const dayOffset = i - firstDayOfWeek;
      
      if (dayOffset < 0 || dayOffset >= totalDays) {
        // خارج السنة
        cell.classList.add('outside', 'heat-0');
        fragment.appendChild(cell);
        continue;
      }
      
      const cellDate = new Date(year, 0, dayOffset + 1);
      const month = cellDate.getMonth();
      const day = cellDate.getDate();
      const dateKey = `${year}-${month}-${day}`;
      
      // التحقق من النشاط
      const act = activity[dateKey];
      if (act) {
        const level = getHeatLevel(act.total, maxAmount);
        cell.classList.add(`heat-${level}`);
        cell.dataset.amount = act.total;
        cell.dataset.count = act.count;
        activeDays++;
        totalSpent += act.total;
      } else {
        cell.classList.add('heat-0');
      }
      
      cell.dataset.date = dateKey;
      cell.dataset.day = day;
      cell.dataset.month = month;
      cell.dataset.weekday = cellDate.getDay();
      
      // Today indicator
      cellDate.setHours(0, 0, 0, 0);
      if (cellDate.getTime() === today.getTime()) {
        cell.classList.add('today');
      }
      
      // ARIA
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${day} ${MONTHS_AR[month]}: ${act ? fmtMoney(act.total) : 'لا يوجد'}`);
      
      fragment.appendChild(cell);
    }
    
    grid.appendChild(fragment);
    
    // Update stats
    if (stats) stats.textContent = activeDays.toLocaleString('ar-SA');
    
    // Build month labels
    buildMonthLabels(year, monthLabels, firstDayOfWeek);
    
    // Bind tooltips
    bindTooltips();
    
    // Render trends
    renderTrends(year, activity, activeDays, totalSpent);
  }
  
  /**
   * Build month labels
   */
  function buildMonthLabels(year, container, firstDayOfWeek) {
    container.innerHTML = '<span></span>'; // spacer for day labels
    
    // كل شهر يأخذ ~4-5 أعمدة
    for (let m = 0; m < 12; m++) {
      const span = document.createElement('span');
      span.textContent = MONTHS_AR[m].slice(0, 3);
      container.appendChild(span);
    }
  }
  
  /**
   * Bind tooltips (تفاعلية)
   */
  function bindTooltips() {
    const tooltip = document.getElementById('heatmapTooltip');
    const grid = document.getElementById('heatmapGrid');
    if (!tooltip || !grid) return;
    
    grid.querySelectorAll('.heatmap-cell:not(.outside)').forEach(cell => {
      cell.addEventListener('mouseenter', (e) => showTooltip(cell, tooltip));
      cell.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
      
      // Mobile - tap to show
      cell.addEventListener('click', () => {
        showTooltip(cell, tooltip);
        setTimeout(() => tooltip.classList.remove('show'), 2500);
      });
    });
  }
  
  /**
   * Show tooltip
   */
  function showTooltip(cell, tooltip) {
    const day = parseInt(cell.dataset.day);
    const month = parseInt(cell.dataset.month);
    const weekday = parseInt(cell.dataset.weekday);
    const amount = parseFloat(cell.dataset.amount) || 0;
    const count = parseInt(cell.dataset.count) || 0;
    
    let html = `
      <div class="heatmap-tooltip-date">${DAYS_AR[weekday]} ${day} ${MONTHS_AR[month]}</div>
    `;
    
    if (amount > 0) {
      html += `
        <div class="heatmap-tooltip-amount">
          💸 <strong>${fmtMoney(amount)}</strong>
        </div>
        <div style="font-size:10px;color:#aaa;margin-top:2px">
          ${count} ${count === 1 ? 'عملية' : 'عمليات'}
        </div>
      `;
    } else {
      html += '<div style="color:#888;font-size:11px">لا يوجد إنفاق</div>';
    }
    
    tooltip.innerHTML = html;
    
    // Position
    const cellRect = cell.getBoundingClientRect();
    const wrapper = cell.closest('.heatmap-wrapper');
    const wrapperRect = wrapper.getBoundingClientRect();
    
    let left = cellRect.left - wrapperRect.left + cellRect.width / 2;
    let top = cellRect.top - wrapperRect.top - 70;
    
    // إذا الـ tooltip راح يطلع من الشاشة، اعرضه أسفل
    if (top < 0) {
      top = cellRect.top - wrapperRect.top + cellRect.height + 8;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.classList.add('show');
  }
  
  /**
   * Render Trends Analysis
   */
  function renderTrends(year, activity, activeDays, totalSpent) {
    const list = document.getElementById('trendsList');
    const card = document.getElementById('yearTrendsCard');
    if (!list || !card) return;
    
    const trends = computeTrends(year, activity, activeDays, totalSpent);
    
    if (trends.length === 0) {
      card.setAttribute('data-empty', 'true');
      list.innerHTML = '';
      return;
    }
    
    card.removeAttribute('data-empty');
    list.innerHTML = trends.map(t => `
      <div class="trend-item ${t.type}">
        <div class="trend-icon">${t.icon}</div>
        <div class="trend-content">
          <div class="trend-title">${t.title}</div>
          <div class="trend-desc">${t.desc}</div>
          ${t.value ? `<span class="trend-value">${t.value}</span>` : ''}
        </div>
      </div>
    `).join('');
  }
  
  /**
   * Compute Trends - تحليل ذكي
   */
  function computeTrends(year, activity, activeDays, totalSpent) {
    const trends = [];
    const totalDays = Math.ceil(((new Date(year, 11, 31) - new Date(year, 0, 1)) / (1000 * 60 * 60 * 24))) + 1;
    
    // 1. نسبة الأيام النشطة
    const activePct = (activeDays / totalDays) * 100;
    if (activePct >= 70) {
      trends.push({
        type: 'info', icon: '📊',
        title: 'تتبّع شبه يومي',
        desc: `سجّلت في ${activeDays} يوم من أصل ${totalDays} يوم في السنة`,
        value: `${activePct.toFixed(0)}% من السنة`
      });
    } else if (activePct < 30 && activeDays > 5) {
      trends.push({
        type: 'warning', icon: '📉',
        title: 'تسجيل متقطع',
        desc: 'حاول تسجيل مصاريفك بانتظام أكثر للحصول على تحليل دقيق',
        value: `فقط ${activePct.toFixed(0)}%`
      });
    }
    
    if (activeDays === 0) return trends;
    
    // 2. متوسط الإنفاق اليومي (في الأيام النشطة فقط)
    const avgPerActiveDay = totalSpent / activeDays;
    trends.push({
      type: 'info', icon: '💰',
      title: 'متوسط الإنفاق اليومي',
      desc: `في الأيام اللي صرفت فيها`,
      value: fmtMoney(avgPerActiveDay)
    });
    
    // 3. تحديد أيام الأسبوع الأكثر صرفاً
    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0]; // [sun, mon, ..., sat]
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    
    Object.entries(activity).forEach(([dateKey, act]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const dayOfWeek = new Date(y, m, d).getDay();
      weekdayTotals[dayOfWeek] += act.total;
      weekdayCounts[dayOfWeek]++;
    });
    
    const avgByWeekday = weekdayTotals.map((total, i) => 
      weekdayCounts[i] > 0 ? total / weekdayCounts[i] : 0
    );
    
    let maxDay = 0, maxAvg = 0;
    avgByWeekday.forEach((avg, i) => {
      if (avg > maxAvg) {
        maxAvg = avg;
        maxDay = i;
      }
    });
    
    if (maxAvg > 0 && weekdayCounts[maxDay] >= 4) {
      trends.push({
        type: 'info', icon: '📅',
        title: `${DAYS_AR[maxDay]} هو يومك الأكبر صرفاً`,
        desc: `بمتوسط ${fmtMoney(maxAvg)} في كل ${DAYS_AR[maxDay]}`,
        value: `${weekdayCounts[maxDay]} مرة`
      });
    }
    
    // 4. أكبر يوم صرف
    let maxDate = null, maxDateAmount = 0;
    Object.entries(activity).forEach(([dateKey, act]) => {
      if (act.total > maxDateAmount) {
        maxDateAmount = act.total;
        maxDate = dateKey;
      }
    });
    
    if (maxDate) {
      const [y, m, d] = maxDate.split('-').map(Number);
      trends.push({
        type: 'warning', icon: '🔥',
        title: 'أكبر يوم صرف',
        desc: `${d} ${MONTHS_AR[m]} ${y}`,
        value: fmtMoney(maxDateAmount)
      });
    }
    
    // 5. Streaks - أطول سلسلة من الأيام المتتالية
    const sortedDates = Object.keys(activity)
      .map(k => {
        const [y, m, d] = k.split('-').map(Number);
        return new Date(y, m, d).getTime();
      })
      .sort((a, b) => a - b);
    
    let maxStreak = 1, currentStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = sortedDates[i] - sortedDates[i - 1];
      if (diff === 86400000) { // يوم واحد
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    
    if (maxStreak >= 7) {
      trends.push({
        type: 'success', icon: '🔥',
        title: 'سلسلة تسجيل قوية',
        desc: `أطول سلسلة أيام متتالية صرفت فيها`,
        value: `${maxStreak} يوم`
      });
    }
    
    // 6. تحليل بداية/منتصف/نهاية الشهر
    let earlyMonth = 0, midMonth = 0, lateMonth = 0;
    Object.entries(activity).forEach(([dateKey, act]) => {
      const day = parseInt(dateKey.split('-')[2]);
      if (day <= 10) earlyMonth += act.total;
      else if (day <= 20) midMonth += act.total;
      else lateMonth += act.total;
    });
    
    const monthTotal = earlyMonth + midMonth + lateMonth;
    if (monthTotal > 0) {
      const earlyPct = (earlyMonth / monthTotal) * 100;
      const latePct = (lateMonth / monthTotal) * 100;
      
      if (earlyPct > 45) {
        trends.push({
          type: 'warning', icon: '📆',
          title: 'صرف مكثّف بداية الشهر',
          desc: 'تصرف معظم ميزانيتك في أول 10 أيام',
          value: `${earlyPct.toFixed(0)}% من البداية`
        });
      } else if (latePct > 45) {
        trends.push({
          type: 'info', icon: '📆',
          title: 'صرف مكثّف نهاية الشهر',
          desc: 'تصرف معظم ميزانيتك في آخر 10 أيام',
          value: `${latePct.toFixed(0)}% من النهاية`
        });
      }
    }
    
    return trends;
  }
  
  /**
   * Init
   */
  function init() {
    if (initialized) return;
    initialized = true;
    
    // Helper: تحقق إذا كنا في yearly view
    function isYearlyView() {
      const tab = window.App?.store?.get('tab');
      const sub = window.App?.store?.get('subTab');
      return tab === 'yearly' || (tab === 'money' && sub === 'yearly');
    }
    
    // Helper: render مع idle scheduling
    function scheduleRender(delay = 200) {
      if (window.Performance?.runWhenIdle) {
        window.Performance.runWhenIdle(render, { timeout: delay + 1500, label: 'heatmap-render' });
      } else {
        setTimeout(render, delay);
      }
    }
    
    // Render عند تغيير tab/subTab/year
    if (window.App?.store) {
      window.App.store.subscribe('tab', (val) => {
        if (isYearlyView()) {
          scheduleRender(300);
        }
      });
      
      window.App.store.subscribe('subTab', (val) => {
        if (val === 'yearly') {
          scheduleRender(200);
        }
      });
      
      window.App.store.subscribe('year', () => {
        if (isYearlyView()) {
          setTimeout(render, 100);
        }
      });
      
      window.App.store.subscribe('data', () => {
        if (isYearlyView()) {
          scheduleRender(500);
        }
      });
    }
    
    // أول render إذا كنا في yearly tab
    setTimeout(() => {
      if (isYearlyView()) {
        render();
      }
    }, 1200);
  }
  
  return { init, render, computeTrends, getYearActivity };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.Heatmap = Heatmap;
window.Heatmap = Heatmap;
