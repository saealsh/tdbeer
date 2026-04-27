/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Quick Actions (Smart Tap Buttons)
   ───────────────────────────────────────────────────────────────────
   أزرار سريعة في Home tab تتعلم من عادات المستخدم.
   كل زر يضيف مصروف بضغطة واحدة.
═══════════════════════════════════════════════════════════════════ */

var QuickActions = (() => {
  const STORAGE_KEY = 'quickActionsCustom';
  const MAX_ACTIONS = 4;
  
  // الإجراءات الافتراضية (تظهر للمستخدم الجديد)
  const DEFAULTS = [
    { id: 'coffee',  emoji: '☕', name: 'قهوة',     amount: 15  },
    { id: 'lunch',   emoji: '🍔', name: 'غدا',      amount: 45  },
    { id: 'fuel',    emoji: '⛽', name: 'بنزين',    amount: 100 },
    { id: 'grocery', emoji: '🛒', name: 'سوبرماركت', amount: 200 }
  ];
  
  /**
   * يحسب الإجراءات السريعة بناءً على عادات المستخدم
   * (يستخدم الـ frequency analysis من البيانات المدخلة)
   */
  function computeSmartActions() {
    if (!window.App?.store) return DEFAULTS;
    
    try {
      const data = window.App.store.get('data') || {};
      const frequency = new Map(); // "name|emoji" → { count, totalAmt, name, emoji }
      
      // اجمع كل entries من آخر 3 أشهر
      const now = new Date();
      const monthsToCheck = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthsToCheck.push(`${d.getFullYear()}_m${d.getMonth()}`);
      }
      
      for (const monthKey of monthsToCheck) {
        const monthData = data[monthKey];
        if (!monthData) continue;
        
        // من daily entries (المصاريف اليومية)
        for (const arr of Object.values(monthData.daily || {})) {
          for (const entry of arr) {
            if (entry.type !== 'out') continue;
            const name = (entry.name || '').trim();
            const emoji = entry.cat || '➕';
            if (!name) continue;
            const key = `${name.toLowerCase()}|${emoji}`;
            const existing = frequency.get(key) || { count: 0, totalAmt: 0, name, emoji };
            existing.count++;
            existing.totalAmt += Number(entry.amt) || 0;
            frequency.set(key, existing);
          }
        }
      }
      
      // رتّب حسب التكرار
      const sorted = [...frequency.values()]
        .filter(item => item.count >= 2) // ظهر مرتين على الأقل
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_ACTIONS)
        .map((item, i) => ({
          id: `smart_${i}`,
          emoji: item.emoji,
          name: item.name.length > 12 ? item.name.slice(0, 12) : item.name,
          amount: Math.round(item.totalAmt / item.count),
          smart: true
        }));
      
      // لو ما طلع كافي، أضف من الـ defaults
      if (sorted.length < 4) {
        const existingIds = new Set(sorted.map(a => `${a.name.toLowerCase()}|${a.emoji}`));
        for (const def of DEFAULTS) {
          if (sorted.length >= MAX_ACTIONS) break;
          const key = `${def.name.toLowerCase()}|${def.emoji}`;
          if (!existingIds.has(key)) sorted.push(def);
        }
      }
      
      return sorted.slice(0, MAX_ACTIONS);
    } catch (e) {
      window.Logger?.warn?.('QuickActions.compute', e?.message);
      return DEFAULTS;
    }
  }
  
  /**
   * يضيف مصروف بناءً على Quick Action
   */
  function execute(action) {
    if (!window.App?.Entries) {
      window.Toast?.show?.('التطبيق لم يكتمل التحميل', 'warn');
      return;
    }
    
    try {
      window.App.Entries.addVariable({
        name: action.name,
        amt: action.amount,
        cat: action.emoji
      });
      window.Toast?.show?.(`✅ +${action.amount} ﷼ ${action.emoji} ${action.name}`, 'success');
      
      // تأثير اهتزاز خفيف على الجوال
      try { navigator.vibrate?.(10); } catch {}
      
      // تحديث UI
      window.Renderers?.scheduledAll?.();
    } catch (e) {
      window.Logger?.error?.('QuickActions.execute', e);
      window.Toast?.show?.('فشل الإضافة', 'danger');
    }
  }
  
  /**
   * يرسم/يحدّث الـ Quick Actions في الـ DOM
   */
  function render() {
    const container = document.getElementById('quickActionsGrid');
    if (!container) return;
    
    const actions = computeSmartActions();
    
    // empty container
    while (container.firstChild) container.removeChild(container.firstChild);
    
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = 'qa-btn' + (action.smart ? ' qa-btn-smart' : '');
      btn.dataset.actionId = action.id;
      btn.setAttribute('aria-label', `إضافة ${action.name} ${action.amount} ريال`);
      
      const emoji = document.createElement('span');
      emoji.className = 'qa-emoji';
      emoji.textContent = action.emoji;
      
      const name = document.createElement('span');
      name.className = 'qa-name';
      name.textContent = action.name;
      
      const amt = document.createElement('span');
      amt.className = 'qa-amt';
      amt.textContent = `+${action.amount} ﷼`;
      
      btn.appendChild(emoji);
      btn.appendChild(name);
      btn.appendChild(amt);
      
      btn.addEventListener('click', () => execute(action));
      
      // Long press للتعديل (اختياري)
      let longPressTimer;
      btn.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
          openCustomize(action);
        }, 600);
      });
      btn.addEventListener('touchend', () => clearTimeout(longPressTimer));
      btn.addEventListener('touchmove', () => clearTimeout(longPressTimer));
      
      container.appendChild(btn);
    }
  }
  
  /**
   * يفتح dialog لتخصيص quick action
   */
  function openCustomize(action) {
    const newAmt = prompt(`عدّل المبلغ لـ ${action.emoji} ${action.name}:`, action.amount);
    if (newAmt === null) return;
    const num = parseFloat(newAmt);
    if (!isNaN(num) && num > 0) {
      // حفظ مخصص
      try {
        const custom = window.Storage?.load(STORAGE_KEY, {}) || {};
        custom[action.id] = { ...action, amount: num };
        window.Storage?.save(STORAGE_KEY, custom);
        render();
        window.Toast?.show?.('تم التحديث ✓', 'success');
      } catch (e) {
        window.Logger?.error?.('QuickActions.customize', e);
      }
    }
  }
  
  function init() {
    render();
    
    // إعادة الرسم عند تغيّر البيانات
    if (window.App?.store) {
      window.App.store.subscribe('data', () => {
        // debounce: لا تعيد الرسم بكل ضغطة
        clearTimeout(init._t);
        init._t = setTimeout(render, 1000);
      });
    }
  }
  
  return { init, render, execute, computeSmartActions };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.QuickActions = QuickActions;
window.QuickActions = QuickActions;
