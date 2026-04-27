/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Visual Calendar (التقويم البصري)
   ───────────────────────────────────────────────────────────────────
   يعرض الشهر كـ grid: كل يوم ملوّن حسب مستوى الإنفاق.
   - أخضر: لا مصاريف
   - أصفر: مصاريف قليلة
   - برتقالي: مصاريف متوسطة
   - أحمر: مصاريف مرتفعة
═══════════════════════════════════════════════════════════════════ */

var VisualCalendar = (() => {
  
  /**
   * يحسب احصائيات الشهر للمعايرة
   */
  function computeMonthStats(monthData) {
    const dailyTotals = [];
    for (const [day, arr] of Object.entries(monthData.daily || {})) {
      const sum = arr.reduce((s, e) => 
        s + (e.type === 'out' ? (Number(e.amt) || 0) : 0), 0);
      if (sum > 0) dailyTotals.push({ day: parseInt(day), sum });
    }
    
    const amounts = dailyTotals.map(d => d.sum);
    const max = Math.max(...amounts, 100);
    const avg = amounts.length > 0 
      ? amounts.reduce((s, a) => s + a, 0) / amounts.length 
      : 0;
    
    return { dailyTotals, max, avg };
  }
  
  /**
   * يصنّف يوم بناءً على الإنفاق
   */
  function classifyDay(spent, stats) {
    if (spent === 0) return { level: 'none', color: 'rgba(16,185,129,0.15)', label: 'بدون مصاريف' };
    if (spent < stats.avg * 0.5) return { level: 'low', color: 'rgba(16,185,129,0.45)', label: 'منخفض' };
    if (spent < stats.avg) return { level: 'mid-low', color: 'rgba(249,115,22,0.35)', label: 'متوسط' };
    if (spent < stats.avg * 1.5) return { level: 'mid-high', color: 'rgba(249,115,22,0.65)', label: 'مرتفع' };
    return { level: 'high', color: 'rgba(239,68,68,0.7)', label: 'مرتفع جداً' };
  }
  
  /**
   * Build calendar data for current month
   */
  function buildCalendarData() {
    if (!window.App?.store) return null;
    
    const year = window.App.store.get('year');
    const month = window.App.store.get('month');
    const monthData = window.App.Sel.monthData(year, month);
    const stats = computeMonthStats(monthData);
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0=Sun
    
    // مصفوفة من الأيام (مع padding في البداية)
    const cells = [];
    
    // Empty cells before first day
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ empty: true });
    }
    
    // Days
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDate = today.getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dailyArr = (monthData.daily || {})[day] || [];
      const spent = dailyArr.reduce((s, e) => 
        s + (e.type === 'out' ? (Number(e.amt) || 0) : 0), 0);
      const income = dailyArr.reduce((s, e) => 
        s + (e.type !== 'out' ? (Number(e.amt) || 0) : 0), 0);
      const cls = classifyDay(spent, stats);
      
      cells.push({
        day,
        spent,
        income,
        entries: dailyArr,
        ...cls,
        isToday: isCurrentMonth && day === todayDate,
        isFuture: isCurrentMonth && day > todayDate
      });
    }
    
    return {
      year,
      month,
      cells,
      stats,
      monthName: window.Tdbeer.MONTHS[month]
    };
  }
  
  /**
   * Render calendar في container معيّن
   */
  function render(containerId = 'calendarGrid') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const data = buildCalendarData();
    if (!data) return;
    
    // empty container
    while (container.firstChild) container.removeChild(container.firstChild);
    
    // header (أسماء الأيام)
    const dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const header = document.createElement('div');
    header.className = 'cal-header';
    for (const name of dayNames) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-name';
      cell.textContent = name.substring(0, 3);
      header.appendChild(cell);
    }
    container.appendChild(header);
    
    // grid
    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    
    for (const cell of data.cells) {
      const dayEl = document.createElement('div');
      dayEl.className = 'cal-cell';
      
      if (cell.empty) {
        dayEl.classList.add('cal-empty');
        grid.appendChild(dayEl);
        continue;
      }
      
      dayEl.classList.add(`cal-${cell.level}`);
      if (cell.isToday) dayEl.classList.add('cal-today');
      if (cell.isFuture) dayEl.classList.add('cal-future');
      dayEl.style.backgroundColor = cell.color;
      
      // Day number
      const num = document.createElement('div');
      num.className = 'cal-day-num';
      num.textContent = cell.day;
      dayEl.appendChild(num);
      
      // Amount
      if (cell.spent > 0) {
        const amt = document.createElement('div');
        amt.className = 'cal-amt';
        amt.textContent = formatCompact(cell.spent);
        dayEl.appendChild(amt);
      }
      
      // Income indicator
      if (cell.income > 0) {
        const inc = document.createElement('div');
        inc.className = 'cal-income-dot';
        inc.title = `دخل: ${cell.income}`;
        dayEl.appendChild(inc);
      }
      
      // Click to show details
      dayEl.onclick = () => showDayDetails(cell);
      
      grid.appendChild(dayEl);
    }
    
    container.appendChild(grid);
    
    // Legend
    const legend = document.createElement('div');
    legend.className = 'cal-legend';
    legend.innerHTML = `
      <span class="cal-legend-item"><span class="cal-dot cal-none"></span> بدون مصاريف</span>
      <span class="cal-legend-item"><span class="cal-dot cal-low"></span> منخفض</span>
      <span class="cal-legend-item"><span class="cal-dot cal-mid-high"></span> مرتفع</span>
      <span class="cal-legend-item"><span class="cal-dot cal-high"></span> مرتفع جداً</span>
    `;
    container.appendChild(legend);
    
    // Stats summary
    const summary = document.createElement('div');
    summary.className = 'cal-summary';
    const noSpendDays = data.cells.filter(c => !c.empty && c.spent === 0 && !c.isFuture).length;
    summary.innerHTML = `
      <div class="cal-stat">
        <div class="cal-stat-num">${noSpendDays}</div>
        <div class="cal-stat-lbl">يوم بدون صرف 🌱</div>
      </div>
      <div class="cal-stat">
        <div class="cal-stat-num">${Math.round(data.stats.avg)} ﷼</div>
        <div class="cal-stat-lbl">معدل اليوم</div>
      </div>
      <div class="cal-stat">
        <div class="cal-stat-num">${Math.round(data.stats.max)} ﷼</div>
        <div class="cal-stat-lbl">أعلى يوم</div>
      </div>
    `;
    container.appendChild(summary);
  }
  
  function formatCompact(n) {
    if (n >= 1000) return Math.round(n / 100) / 10 + 'ك';
    return Math.round(n);
  }
  
  /**
   * يعرض تفاصيل يوم معيّن
   */
  function showDayDetails(cell) {
    if (cell.empty || cell.entries.length === 0) {
      window.Toast?.show?.('لا مصاريف في هذا اليوم 🌱', 'success');
      return;
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'cal-day-details';
    dialog.innerHTML = `
      <div class="cdd-content">
        <div class="cdd-header">
          <h3>تفاصيل يوم ${cell.day}</h3>
          <button class="cdd-close" aria-label="إغلاق">✕</button>
        </div>
        <div class="cdd-summary">
          <span class="cdd-spent">صرف: ${cell.spent} ﷼</span>
          ${cell.income > 0 ? `<span class="cdd-income">دخل: ${cell.income} ﷼</span>` : ''}
        </div>
        <ul class="cdd-list">
          ${cell.entries.map(e => `
            <li class="cdd-item ${e.type === 'out' ? 'out' : 'in'}">
              <span class="cdd-cat">${escapeHtml(e.cat || '➕')}</span>
              <span class="cdd-name">${escapeHtml(e.name)}</span>
              <span class="cdd-amt">${e.type === 'out' ? '-' : '+'}${e.amt} ﷼</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    
    document.body.appendChild(dialog);
    dialog.querySelector('.cdd-close').onclick = () => dialog.remove();
    dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
  }
  
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  function init() {
    render();
    
    // Re-render when data changes
    if (window.App?.store) {
      window.App.store.subscribe('data', () => {
        clearTimeout(init._t);
        init._t = setTimeout(render, 800);
      });
      window.App.store.subscribe('month', render);
      window.App.store.subscribe('year', render);
    }
  }
  
  return { init, render, buildCalendarData };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.VisualCalendar = VisualCalendar;
window.VisualCalendar = VisualCalendar;
