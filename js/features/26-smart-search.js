/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Smart Search Manager
   ───────────────────────────────────────────────────────────────────
   يدعم:
   - بحث في كل البيانات (مصاريف، دخل، أهداف، فئات)
   - بحث في الميزات (محاكي قرض، تحديات، إلخ)
   - فلاتر: type + time range
   - Keyboard shortcuts (Cmd+K, ↑↓, Enter, Esc)
   - Highlights للنص المطابق
   - Debounced search
═══════════════════════════════════════════════════════════════════ */

var SmartSearch = (() => {
  let initialized = false;
  let isOpen = false;
  let currentFilter = 'all';
  let currentTimeFilter = 'all';
  let currentResults = [];
  let selectedIndex = -1;
  let searchTimer = null;
  
  const MONTHS_AR = window.Tdbeer?.MONTHS || [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
  ];
  
  // ═══ Performance: Cache للبحث (memoization) ═══
  const searchCache = new Map();
  const CACHE_MAX = 20;
  
  function getCacheKey(query) {
    return `${query}|${currentFilter}|${currentTimeFilter}`;
  }
  
  function clearSearchCache() {
    searchCache.clear();
  }
  
  // ═══ Features Catalog (للبحث في الميزات) ═══
  const FEATURES = [
    { id: 'add-expense', icon: '✏️', title: 'إضافة مصروف', desc: 'سجّل مصروف جديد', keywords: ['مصروف', 'صرف', 'إضافة', 'سجّل'], action: 'add-expense' },
    { id: 'add-income', icon: '💵', title: 'إضافة دخل', desc: 'سجّل دخل جديد', keywords: ['دخل', 'راتب', 'مكافأة', 'إضافة'], action: 'add-income' },
    { id: 'scan-bill', icon: '📸', title: 'مسح فاتورة', desc: 'مسح فاتورة بالكاميرا', keywords: ['مسح', 'فاتورة', 'كاميرا', 'صورة', 'OCR'], action: 'scan-bill' },
    { id: 'voice', icon: '🎤', title: 'إدخال صوتي', desc: 'سجّل بصوتك', keywords: ['صوت', 'صوتي', 'تسجيل', 'voice'], action: 'voice' },
    { id: 'goals', icon: '🎯', title: 'الأهداف والميزانية', desc: 'إدارة أهدافك', keywords: ['أهداف', 'هدف', 'ميزانية', 'بادجت'], action: 'goals' },
    { id: 'loan', icon: '🏦', title: 'محاكي القرض', desc: 'احسب القسط الشهري', keywords: ['قرض', 'تمويل', 'قسط', 'فائدة', 'بنك'], action: 'loan' },
    { id: 'challenges', icon: '🎯', title: 'التحديات', desc: 'تحديات ادخارية', keywords: ['تحدي', 'تحديات', 'ادخار', 'توفير'], action: 'challenges' },
    { id: 'year-wrapped', icon: '🎉', title: 'تقريرك السنوي', desc: 'كل السنة في تقرير', keywords: ['تقرير', 'سنوي', 'wrapped', 'ملخص'], action: 'year-wrapped' },
    { id: 'achievements', icon: '🏆', title: 'الإنجازات', desc: 'شارات وإنجازات', keywords: ['إنجاز', 'إنجازات', 'شارات', 'ميداليات'], action: 'achievements' },
    { id: 'themes', icon: '🎨', title: 'شكل التطبيق', desc: 'الثيمات والألوان', keywords: ['ثيم', 'لون', 'شكل', 'مظهر', 'theme'], action: 'themes' },
    { id: 'backup', icon: '💾', title: 'النسخ الاحتياطي', desc: 'حفظ واستعادة البيانات', keywords: ['نسخ', 'احتياطي', 'حفظ', 'استعادة', 'backup'], action: 'backup' },
    { id: 'notif-settings', icon: '🔔', title: 'إعدادات التنبيهات', desc: 'تخصيص التنبيهات', keywords: ['تنبيه', 'تنبيهات', 'إشعار', 'إشعارات', 'بنق'], action: 'notif-settings' },
    { id: 'profile', icon: '📝', title: 'ملفي الشخصي', desc: 'معلوماتي', keywords: ['ملف', 'شخصي', 'معلومات', 'profile'], action: 'profile' },
    { id: 'friends', icon: '👥', title: 'الأصدقاء', desc: 'الأصدقاء والمحادثات', keywords: ['أصدقاء', 'صديق', 'محادثات', 'دردشة'], action: 'friends' },
    { id: 'monthly', icon: '📊', title: 'تقرير الشهر', desc: 'الشهر الحالي', keywords: ['شهر', 'شهري', 'monthly'], action: 'monthly' },
    { id: 'yearly', icon: '📅', title: 'تقرير السنة', desc: 'السنة كاملة', keywords: ['سنة', 'سنوي', 'yearly'], action: 'yearly' }
  ];
  
  /**
   * Format currency
   */
  function fmtMoney(n) {
    return Math.round(n).toLocaleString('ar-SA') + ' ﷼';
  }
  
  /**
   * Format date
   */
  function fmtDate(year, month, day) {
    return `${day} ${MONTHS_AR[month]} ${year}`;
  }
  
  /**
   * 🔒 SECURITY: HTML escape helper.
   * Defensive — uses U.esc if available, otherwise local fallback.
   */
  function escHtml(s) {
    if (window.U?.esc) return window.U.esc(s);
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Highlight matching text — XSS-SAFE.
   * 🔒 SECURITY FIX (Apr 2026):
   *    Previously injected raw user-controlled text into innerHTML.
   *    Attacker could inject <script> or <img onerror=...> via expense
   *    names. Now escapes BOTH text and query before regex matching.
   */
  function highlight(text, query) {
    const escapedText = escHtml(String(text || ''));
    if (!query) return escapedText;
    const q = String(query).trim();
    if (!q) return escapedText;

    try {
      // Escape the query for HTML first (so it matches the escaped text),
      // then escape regex metacharacters.
      const queryHtml = escHtml(q);
      const queryForRegex = queryHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${queryForRegex})`, 'gi');
      return escapedText.replace(regex, '<mark>$1</mark>');
    } catch {
      return escapedText;
    }
  }
  
  /**
   * Check if string matches query (fuzzy)
   */
  function matches(text, query) {
    if (!text || !query) return false;
    const t = String(text).toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return false;
    
    // Direct match
    if (t.includes(q)) return true;
    
    // Word match
    const words = q.split(/\s+/);
    return words.every(w => t.includes(w));
  }
  
  /**
   * Get time range filter
   */
  function getTimeRange() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    
    switch (currentTimeFilter) {
      case 'today':
        return { from: new Date(y, m, d), to: new Date(y, m, d, 23, 59, 59) };
      case 'week': {
        const start = new Date(y, m, d - 7);
        return { from: start, to: now };
      }
      case 'month':
        return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59) };
      case 'year':
        return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59) };
      default:
        return null;
    }
  }
  
  /**
   * Check if item is in time range
   */
  function inTimeRange(year, month, day) {
    const range = getTimeRange();
    if (!range) return true;
    
    const itemDate = new Date(year, month, day || 1);
    return itemDate >= range.from && itemDate <= range.to;
  }
  
  /**
   * Search in all data
   */
  function search(query) {
    const results = {
      expenses: [],
      income: [],
      features: [],
      total: 0
    };
    
    if (!query || query.trim().length < 1) return results;
    
    // ═══ Cache check (memoization) ═══
    const cacheKey = getCacheKey(query);
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }
    
    try {
      const data = window.App?.store?.get('data') || {};
      
      // Search في data
      Object.entries(data).forEach(([monthKey, monthData]) => {
        // Parse year_mX
        const match = monthKey.match(/^(\d+)_m(\d+)$/);
        if (!match) return;
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        
        // Income (monthly)
        if (currentFilter === 'all' || currentFilter === 'income') {
          (monthData.income || []).forEach(item => {
            if (matches(item.name, query) || matches(item.cat, query)) {
              if (inTimeRange(year, month, 1)) {
                results.income.push({
                  type: 'income',
                  item,
                  year, month, day: 1,
                  date: fmtDate(year, month, 1).replace(/^1 /, '')
                });
              }
            }
          });
        }
        
        // Fixed expenses
        if (currentFilter === 'all' || currentFilter === 'expenses') {
          (monthData.fixed || []).forEach(item => {
            if (matches(item.name, query) || matches(item.cat, query)) {
              if (inTimeRange(year, month, 1)) {
                results.expenses.push({
                  type: 'fixed',
                  item,
                  year, month, day: 1,
                  date: fmtDate(year, month, 1).replace(/^1 /, '') + ' (ثابت)'
                });
              }
            }
          });
        }
        
        // Daily entries
        const daily = monthData.daily || {};
        Object.entries(daily).forEach(([day, items]) => {
          if (!Array.isArray(items)) return;
          const dayNum = parseInt(day);
          if (!inTimeRange(year, month, dayNum)) return;
          
          items.forEach(item => {
            if (matches(item.name, query) || matches(item.cat, query)) {
              const isIncome = item.type === 'in';
              const filterMatch = currentFilter === 'all' 
                || (currentFilter === 'income' && isIncome)
                || (currentFilter === 'expenses' && !isIncome);
              
              if (filterMatch) {
                const target = isIncome ? results.income : results.expenses;
                target.push({
                  type: isIncome ? 'income' : 'expense',
                  item,
                  year, month, day: dayNum,
                  date: fmtDate(year, month, dayNum)
                });
              }
            }
          });
        });
      });
      
      // Search في الميزات
      if (currentFilter === 'all' || currentFilter === 'features') {
        FEATURES.forEach(f => {
          const matchTitle = matches(f.title, query);
          const matchDesc = matches(f.desc, query);
          const matchKeywords = f.keywords.some(k => matches(k, query));
          
          if (matchTitle || matchDesc || matchKeywords) {
            results.features.push(f);
          }
        });
      }
      
      // Goals من state
      if (currentFilter === 'all' || currentFilter === 'goals') {
        const goals = window.App?.store?.get('goals') || [];
        goals.forEach((g, idx) => {
          if (matches(g.name, query)) {
            results.features.push({
              id: 'goal-' + idx,
              icon: '🎯',
              title: g.name,
              desc: `هدف: ${fmtMoney(g.target || 0)}`,
              action: 'goals',
              isGoal: true
            });
          }
        });
      }
      
      // Sort expenses/income by date desc
      const sortByDate = (a, b) => {
        const dateA = new Date(a.year, a.month, a.day);
        const dateB = new Date(b.year, b.month, b.day);
        return dateB - dateA;
      };
      results.expenses.sort(sortByDate);
      results.income.sort(sortByDate);
      
      // Limit
      results.expenses = results.expenses.slice(0, 30);
      results.income = results.income.slice(0, 30);
      results.features = results.features.slice(0, 10);
      
      results.total = results.expenses.length + results.income.length + results.features.length;
    } catch (e) {
      if (window.Logger) window.Logger.warn('SmartSearch.search', e?.message);
    }
    
    // ═══ احفظ في cache (مع limit) ═══
    if (searchCache.size >= CACHE_MAX) {
      // امسح أقدم إدخال
      const firstKey = searchCache.keys().next().value;
      searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, results);
    
    return results;
  }
  
  /**
   * Render results
   */
  function renderResults(query) {
    const empty = document.getElementById('searchEmpty');
    const noResults = document.getElementById('searchNoResults');
    const list = document.getElementById('searchResultsList');
    const count = document.getElementById('searchResultsCount');
    
    if (!query.trim()) {
      empty.style.display = '';
      noResults.style.display = 'none';
      list.innerHTML = '';
      currentResults = [];
      selectedIndex = -1;
      if (count) count.textContent = '';
      return;
    }
    
    empty.style.display = 'none';
    
    const results = search(query);
    
    if (results.total === 0) {
      noResults.style.display = '';
      list.innerHTML = '';
      currentResults = [];
      selectedIndex = -1;
      if (count) count.textContent = '';
      return;
    }
    
    noResults.style.display = 'none';
    
    // Build flat array لـ keyboard navigation
    currentResults = [];
    let html = '';
    
    // Features section
    if (results.features.length > 0) {
      html += `<div class="search-result-group">
        <div class="search-result-group-title">⚙️ ميزات (${results.features.length})</div>`;
      
      results.features.forEach((f, idx) => {
        const globalIdx = currentResults.length;
        currentResults.push({ kind: 'feature', data: f });
        
        // 🔒 escape feature metadata defensively (these are static today,
        //    but defending against future contamination is cheap).
        html += `
          <div class="search-result-item" data-idx="${globalIdx}" data-kind="feature">
            <div class="search-result-icon">${escHtml(f.icon)}</div>
            <div class="search-result-info">
              <div class="search-result-title">${highlight(f.title, query)}</div>
              <div class="search-result-sub">${escHtml(f.desc)}</div>
            </div>
            <span class="search-result-action-icon">←</span>
          </div>
        `;
      });
      
      html += '</div>';
    }
    
    // Income section
    if (results.income.length > 0) {
      html += `<div class="search-result-group">
        <div class="search-result-group-title">💵 دخل (${results.income.length})</div>`;
      
      results.income.forEach(r => {
        const globalIdx = currentResults.length;
        currentResults.push({ kind: 'data', data: r });
        
        const cat = r.item.cat || '💵';
        // 🔒 r.item.cat is USER INPUT — must escape.
        //    r.item.name routed through highlight() which now escapes.
        //    fmtMoney() returns a string but defensive escape anyway.
        html += `
          <div class="search-result-item" data-idx="${globalIdx}" data-kind="data">
            <div class="search-result-icon">${escHtml(cat)}</div>
            <div class="search-result-info">
              <div class="search-result-title">${highlight(r.item.name, query)}</div>
              <div class="search-result-sub">${escHtml(r.date)}</div>
            </div>
            <div class="search-result-amount income">+${escHtml(fmtMoney(r.item.amt))}</div>
          </div>
        `;
      });
      
      html += '</div>';
    }
    
    // Expenses section
    if (results.expenses.length > 0) {
      html += `<div class="search-result-group">
        <div class="search-result-group-title">💸 مصاريف (${results.expenses.length})</div>`;
      
      results.expenses.forEach(r => {
        const globalIdx = currentResults.length;
        currentResults.push({ kind: 'data', data: r });
        
        const cat = r.item.cat || '➕';
        // 🔒 same protections as income section above
        html += `
          <div class="search-result-item" data-idx="${globalIdx}" data-kind="data">
            <div class="search-result-icon">${escHtml(cat)}</div>
            <div class="search-result-info">
              <div class="search-result-title">${highlight(r.item.name, query)}</div>
              <div class="search-result-sub">${escHtml(r.date)}</div>
            </div>
            <div class="search-result-amount expense">-${escHtml(fmtMoney(r.item.amt))}</div>
          </div>
        `;
      });
      
      html += '</div>';
    }
    
    list.innerHTML = html;
    
    // Update count
    if (count) {
      count.textContent = `${results.total} نتيجة`;
    }
    
    // Bind click
    list.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        selectResult(idx);
      });
      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.dataset.idx);
        setSelected(idx);
      });
    });
    
    // Auto-select first
    selectedIndex = 0;
    updateSelection();
  }
  
  /**
   * Update visual selection
   */
  function updateSelection() {
    const items = document.querySelectorAll('.search-result-item');
    items.forEach((el, i) => {
      el.classList.toggle('selected', parseInt(el.dataset.idx) === selectedIndex);
    });
    
    // Scroll to selected
    const selected = document.querySelector('.search-result-item.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  
  function setSelected(idx) {
    selectedIndex = idx;
    updateSelection();
  }
  
  /**
   * Select & open result
   */
  function selectResult(idx) {
    const result = currentResults[idx];
    if (!result) return;
    
    if (result.kind === 'feature') {
      handleFeatureAction(result.data.action);
    } else if (result.kind === 'data') {
      // افتح الشهر اللي فيه العنصر
      const r = result.data;
      window.App?.store?.set('year', r.year);
      window.App?.store?.set('month', r.month);
      
      // Navigate to monthly tab
      const showTab = window.App?.Controllers?.showTab || window.Controllers?.showTab;
      if (showTab) {
        showTab('money:monthly');
      }
      
      window.Toast?.show?.(`📍 ${r.date}`, 'info', 2000);
    }
    
    close();
  }
  
  /**
   * Handle feature action
   */
  function handleFeatureAction(action) {
    setTimeout(() => {
      switch (action) {
        case 'add-expense':
          window.FabController?.openManualEntry?.('out');
          break;
        case 'add-income':
          window.FabController?.openManualEntry?.('in');
          break;
        case 'scan-bill':
          window.BillScanner?.scanAndAdd?.();
          break;
        case 'voice':
          document.getElementById('btnOpenVoice')?.click();
          break;
        case 'loan':
          window.FeaturesUI?.openLoan?.();
          break;
        case 'challenges':
          window.FeaturesUI?.openChallenges?.();
          break;
        case 'year-wrapped':
          window.YearWrapped?.show?.();
          break;
        case 'goals':
          window.openDedicatedPage?.('goals-budget');
          break;
        case 'achievements':
          window.openDedicatedPage?.('achievements');
          break;
        case 'themes':
          window.openDedicatedPage?.('themes');
          break;
        case 'backup':
          window.openDedicatedPage?.('backup');
          break;
        case 'notif-settings':
          window.openDedicatedPage?.('notif-settings');
          break;
        case 'profile':
          window.openDedicatedPage?.('my-profile');
          break;
        case 'friends': {
          const showTab = window.App?.Controllers?.showTab || window.Controllers?.showTab;
          if (showTab) showTab('profile:friends');
          break;
        }
        case 'monthly': {
          const showTab = window.App?.Controllers?.showTab || window.Controllers?.showTab;
          if (showTab) showTab('money:monthly');
          break;
        }
        case 'yearly': {
          const showTab = window.App?.Controllers?.showTab || window.Controllers?.showTab;
          if (showTab) showTab('money:yearly');
          break;
        }
      }
    }, 200);
  }
  
  /**
   * Open search overlay
   */
  function open() {
    if (isOpen) return;
    isOpen = true;
    
    const overlay = document.getElementById('searchOverlay');
    const input = document.getElementById('searchInput');
    
    if (!overlay) return;
    
    overlay.classList.add('show');
    overlay.classList.remove('closing');
    
    // Reset
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }
    
    selectedIndex = -1;
    currentResults = [];
    
    // Reset filters
    setFilter('all');
    setTimeFilter('all');
    
    // Show empty state
    document.getElementById('searchEmpty').style.display = '';
    document.getElementById('searchNoResults').style.display = 'none';
    document.getElementById('searchResultsList').innerHTML = '';
    document.getElementById('searchResultsCount').textContent = '';
    document.getElementById('searchClear').style.display = 'none';
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Vibrate
    try { navigator.vibrate?.(8); } catch {}
  }
  
  /**
   * Close search overlay
   */
  function close() {
    if (!isOpen) return;
    isOpen = false;
    
    const overlay = document.getElementById('searchOverlay');
    if (!overlay) return;
    
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    }, 200);
  }
  
  /**
   * Set filter
   */
  function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.search-filter').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    
    // Re-search
    const input = document.getElementById('searchInput');
    if (input?.value) {
      renderResults(input.value);
    }
  }
  
  /**
   * Set time filter
   */
  function setTimeFilter(time) {
    currentTimeFilter = time;
    document.querySelectorAll('.search-time-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.time === time);
    });
    
    // Re-search
    const input = document.getElementById('searchInput');
    if (input?.value) {
      renderResults(input.value);
    }
  }
  
  /**
   * Init
   */
  function init() {
    if (initialized) return;
    initialized = true;
    
    const overlay = document.getElementById('searchOverlay');
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');
    const closeBtn = document.getElementById('searchClose');
    const searchBtn = document.getElementById('searchBtn');
    
    // Open from button
    if (searchBtn) {
      searchBtn.addEventListener('click', open);
    }
    
    // Close events
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }
    
    // Input events (debounced)
    if (input) {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        
        // Clear button visibility
        if (clearBtn) clearBtn.style.display = val ? '' : 'none';
        
        // ARIA
        input.setAttribute('aria-expanded', val ? 'true' : 'false');
        
        // Debounced search
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          renderResults(val);
        }, 150);
      });
    }
    
    // Clear button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (input) {
          input.value = '';
          input.focus();
          renderResults('');
          clearBtn.style.display = 'none';
        }
      });
    }
    
    // Filters
    document.querySelectorAll('.search-filter').forEach(btn => {
      btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });
    
    // Time filters
    document.querySelectorAll('.search-time-btn').forEach(btn => {
      btn.addEventListener('click', () => setTimeFilter(btn.dataset.time));
    });
    
    // Suggestions
    document.querySelectorAll('.search-suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (input) {
          input.value = chip.dataset.suggest;
          input.focus();
          renderResults(input.value);
          if (clearBtn) clearBtn.style.display = '';
        }
      });
    });
    
    // Quick actions
    document.querySelectorAll('.search-quick-action').forEach(btn => {
      btn.addEventListener('click', () => {
        handleFeatureAction(btn.dataset.quick);
        close();
      });
    });
    
    // Keyboard shortcuts (Cmd+K / Ctrl+K)
    document.addEventListener('keydown', (e) => {
      // Open with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) close();
        else open();
        return;
      }
      
      // ESC, ↑↓, Enter (only when search is open)
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      
      if (currentResults.length === 0) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
        updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectResult(selectedIndex);
        }
      }
    });
    
    // ═══ Performance: امسح cache عند تغيير البيانات ═══
    if (window.App?.store) {
      window.App.store.subscribe('data', () => clearSearchCache());
    }
  }
  
  return { init, open, close, search };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.SmartSearch = SmartSearch;
window.SmartSearch = SmartSearch;
