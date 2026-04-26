/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — App (state, auth, achievements, theme)
   ───────────────────────────────────────────────────────────────────
   Depends on: Tdbeer namespace, Firebase
   Originally lines 12097–12880 of index.html
═══════════════════════════════════════════════════════════════════ */

var App = (() => {
  const { Logger, U, Fmt, Storage, Store, Scheduler, DOM, $, $$,
          MONTHS, DAY_NAMES, TIPS, ACHIEVEMENTS, LEVELS, PIE_COLORS,
          GOLD_PRICE, SILVER_PRICE } = Tdbeer;

  // ═══ STATE ═══
  const store = new Store({
    data: {},
    pts: 0,
    salaryDay: 0,
    streak: { days: [], current: 0, max: 0, total: 0 },
    notifs: [],
    customCats: [],
    theme: 'midnight',
    achievements: [],
    userName: '',
    // UI state
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    tab: 'home',
    period: 'daily',

    tipIdx: 0,
    dirty: false,
    initialized: false
  });

  // ═══ SELECTORS (memoized) ═══
  const Sel = {
    monthData(y, m) {
      const key = U.monthKey(y, m);
      const data = store.get(`data.${key}`);
      if (!data) {
        const empty = { income: [], fixed: [], variable: [], goals: [], daily: {}, budgets: [] };
        store.set(`data.${key}`, empty);
        return empty;
      }
      return data;
    },

    totals(y, m) {
      const key = `totals_${y}_${m}`;
      return store.select(key, [`data.${U.monthKey(y, m)}`], () => {
        const d = Sel.monthData(y, m);
        const sum = (arr) => (arr || []).reduce((s, x) => s + U.num(x.amt), 0);
        let dI = 0, dO = 0;
        for (const arr of Object.values(d.daily || {})) {
          for (const e of arr) {
            if (e.type === 'out') dO += U.num(e.amt);
            else dI += U.num(e.amt);
          }
        }
        const income = sum(d.income) + dI;
        const expense = sum(d.fixed) + sum(d.variable) + dO;
        const save = income - expense;
        return {
          income, expense, save,
          spendPct: income > 0 ? Math.min(100, Math.round((expense / income) * 100)) : 0,
          savePct: income > 0 ? Math.round((Math.max(0, save) / income) * 100) : 0
        };
      });
    },

    categorySpending(y, m) {
      const key = `cats_${y}_${m}`;
      return store.select(key, [`data.${U.monthKey(y, m)}`], () => {
        const d = Sel.monthData(y, m);
        const cats = {};
        for (const item of [...(d.variable || []), ...(d.fixed || [])]) {
          const c = item.cat || '➕';
          cats[c] = (cats[c] || 0) + U.num(item.amt);
        }
        for (const arr of Object.values(d.daily || {})) {
          for (const e of arr) {
            if (e.type === 'out') {
              const c = e.cat || '➕';
              cats[c] = (cats[c] || 0) + U.num(e.amt);
            }
          }
        }
        return cats;
      });
    },

    yearlyTotals(y) {
      const key = `year_${y}`;
      return store.select(key, ['data'], () => {
        let income = 0, expense = 0;
        const monthly = [];
        for (let m = 0; m < 12; m++) {
          const t = Sel.totals(y, m);
          income += t.income;
          expense += t.expense;
          monthly.push(t);
        }
        return { income, expense, save: income - expense, monthly };
      });
    }
  };

  // ═══ TOAST (تم نقله إلى 10-toast.js — هنا مجرد reference) ═══
  // Tdbeer.Toast يُحمَّل قبل هذا الملف ويوفّر:
  //   - حد أقصى 3 toasts متزامنة (يمنع spam)
  //   - ARIA live region (accessibility)
  //   - يحترم prefers-reduced-motion
  //   - textContent بدلاً من innerHTML (XSS-safe)
  const Toast = Tdbeer.Toast || {
    // Fallback لو ما تحمّل الملف الجديد لأي سبب
    show(msg, type = 'success', duration = 2800) {
      const wrap = document.getElementById('toastWrap');
      if (!wrap) return;
      const el = DOM.h('div', { class: `toast ${type}` }, msg);
      wrap.appendChild(el);
      setTimeout(() => {
        el.classList.add('fade');
        setTimeout(() => el.remove(), 300);
      }, duration);
    }
  };
  // Make Toast globally available for Storage
  window.Toast = Toast;

  // ═══ POINTS + ACHIEVEMENTS ═══
  const Pts = {
    add(n) {
      store.set('pts', store.get('pts') + U.num(n));
      Achievements.check();
    },
    level() {
      const p = store.get('pts');
      return LEVELS.reduce((a, l) => p >= l.min ? l : a, LEVELS[0]);
    }
  };

  const Achievements = {
    check() {
      const year = store.get('year'), month = store.get('month');
      const t = Sel.totals(year, month);
      const m = Sel.monthData(year, month);
      const dataAll = store.get('data');
      const unlocked = store.get('achievements') || [];

      const conds = {
        first_save: Object.values(dataAll).some(d => d.goals?.length > 0),
        no_exceed: t.income > 0 && t.expense <= t.income,
        save_20: t.income > 0 && t.savePct >= 20,
        daily_log: Object.keys(m.daily || {}).length >= 7,
        goal_done: Object.values(dataAll).some(d =>
          d.goals?.some(g => g.target > 0 && g.saved >= g.target)),
        three_months: (() => {
          let c = 0;
          for (let i = 0; i < 12; i++) {
            const d = dataAll[U.monthKey(year, i)];
            if (d && (d.income?.length || d.variable?.length)) {
              c++;
              if (c >= 3) return true;
            } else c = 0;
          }
          return false;
        })()
      };

      for (const a of ACHIEVEMENTS) {
        if (!unlocked.includes(a.id) && conds[a.id]) {
          unlocked.push(a.id);
          store.set('achievements', [...unlocked]);
          store.set('pts', store.get('pts') + a.pts);
          Toast.show(`🏆 إنجاز: ${a.name} (+${a.pts} نقطة)`, 'warn');
        }
      }
    }
  };

  // ═══ STREAK ═══
  const Streak = {
    calc() {
      const s = store.get('streak');
      if (!s.days?.length) return { ...s, current: 0 };
      const sorted = [...s.days].sort().reverse();
      const today = U.todayStr();
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yesterday = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
      if (sorted[0] !== today && sorted[0] !== yesterday) {
        return { ...s, current: 0 };
      }
      let cnt = 0;
      let check = sorted[0] === today ? today : yesterday;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] === check) {
          cnt++;
          const dt = new Date(check);
          dt.setDate(dt.getDate() - 1);
          check = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
        } else break;
      }
      const max = Math.max(s.max || 0, cnt);
      return { ...s, current: cnt, max, total: s.days.length };
    },

    checkin() {
      const today = U.todayStr();
      const s = store.get('streak');
      if (s.days.includes(today)) {
        Toast.show('سجّلت حضورك اليوم بالفعل 🔥', 'warn');
        return;
      }
      const newDays = [...s.days, today];
      store.set('streak', { ...s, days: newDays });
      const updated = Streak.calc();
      store.set('streak', updated);
      Pts.add(20);

      const cur = updated.current;
      if (cur === 7) { Pts.add(50); Toast.show('🏆 أسبوع كامل! +٥٠ نقطة', 'warn'); }
      if (cur === 30) { Pts.add(200); Toast.show('🥉 ٣٠ يوم — بطاقة البرونز! +٢٠٠', 'warn'); }
      if (cur === 60) { Pts.add(500); Toast.show('🥇 ٦٠ يوم — بطاقة الذهب! +٥٠٠', 'warn'); }
      if (cur === 90) { Pts.add(1000); Toast.show('💎 ٩٠ يوم — أوبسيديان! +١٠٠٠', 'warn'); }

      Toast.show('تم التسجيل 🔥 +٢٠ نقطة', 'success');
    }
  };

  // ═══ INCOME/EXPENSE operations ═══
  const Entries = {
    addVariable({ name, amt, cat = '➕' }) {
      name = U.str(name, 60);
      amt = U.num(amt);
      if (!name || amt <= 0) throw new Error('INVALID_INPUT');
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);
      const td = new Date().getDate();
      const daily = { ...d.daily };
      if (!daily[td]) daily[td] = [];
      daily[td] = [...daily[td], { id: U.uid(), name, amt, cat, type: 'out' }];
      store.patch(`data.${key}`, { daily });
      store.set('dirty', true);
      Pts.add(10);
    },

    addIncome({ name, amt, cat = '💵', recurring = false }) {
      name = U.str(name, 60);
      amt = U.num(amt);
      if (!name || amt <= 0) throw new Error('INVALID_INPUT');
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);
      const income = [...d.income, { id: U.uid(), name, amt, cat, paid: false, recurring }];
      store.patch(`data.${key}`, { income });
      store.set('dirty', true);
      Pts.add(15);
    },

    addFixed({ name, amt, cat = '🏠', recurring = true }) {
      name = U.str(name, 60);
      amt = U.num(amt);
      if (!name || amt <= 0) throw new Error('INVALID_INPUT');
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);
      const fixed = [...d.fixed, { id: U.uid(), name, amt, cat, paid: false, recurring }];
      store.patch(`data.${key}`, { fixed });
      store.set('dirty', true);
      Pts.add(15);
    },

    delete(type, id) {
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);

      if (type === 'daily') {
        const daily = { ...d.daily };
        for (const day of Object.keys(daily)) {
          daily[day] = daily[day].filter(x => x.id !== id);
          if (!daily[day].length) delete daily[day];
        }
        store.patch(`data.${key}`, { daily });
      } else {
        const arr = d[type] || [];
        store.patch(`data.${key}`, { [type]: arr.filter(x => x.id !== id) });
      }
      store.set('dirty', true);
    },

    /**
     * تعديل بند موجود (دخل/ثابت/متغير).
     * @param {string} type - 'income' | 'fixed' | 'variable' | 'daily'
     * @param {string} id - معرّف البند
     * @param {object} patch - الحقول المراد تحديثها (name/amt/cat)
     */
    update(type, id, patch = {}) {
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);

      // sanitize patch
      const clean = {};
      if (patch.name !== undefined) {
        clean.name = U.str(patch.name, 60);
        if (!clean.name) throw new Error('INVALID_NAME');
      }
      if (patch.amt !== undefined) {
        clean.amt = U.num(patch.amt);
        if (clean.amt <= 0) throw new Error('INVALID_AMOUNT');
      }
      if (patch.cat !== undefined) clean.cat = patch.cat;

      if (type === 'daily') {
        const daily = { ...d.daily };
        let found = false;
        for (const day of Object.keys(daily)) {
          daily[day] = daily[day].map(x => {
            if (x.id === id) { found = true; return { ...x, ...clean }; }
            return x;
          });
        }
        if (!found) throw new Error('ITEM_NOT_FOUND');
        store.patch(`data.${key}`, { daily });
      } else {
        const arr = d[type] || [];
        const idx = arr.findIndex(x => x.id === id);
        if (idx === -1) throw new Error('ITEM_NOT_FOUND');
        const updated = [...arr];
        updated[idx] = { ...updated[idx], ...clean };
        store.patch(`data.${key}`, { [type]: updated });
      }
      store.set('dirty', true);
    },

    /**
     * يجلب بند معيّن (للتعديل).
     */
    findById(type, id) {
      const year = store.get('year'), month = store.get('month');
      const d = Sel.monthData(year, month);
      if (type === 'daily') {
        for (const day of Object.keys(d.daily || {})) {
          const item = d.daily[day].find(x => x.id === id);
          if (item) return item;
        }
        return null;
      }
      return (d[type] || []).find(x => x.id === id) || null;
    },

    togglePaid(type, id) {
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);
      const arr = d[type] || [];
      const updated = arr.map(x => x.id === id ? { ...x, paid: !x.paid } : x);
      store.patch(`data.${key}`, { [type]: updated });
      if (updated.find(x => x.id === id)?.paid) Pts.add(5);
      store.set('dirty', true);
    }
  };

  // ═══ GOALS ═══
  const Goals = {
    add({ name, target, saved = 0, icon = '⭐' }) {
      name = U.str(name, 60);
      target = U.num(target);
      saved = U.num(saved);
      if (!name || target <= 0) throw new Error('INVALID_INPUT');
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);
      store.patch(`data.${key}`, {
        goals: [...d.goals, { id: U.uid(), name, target, saved, icon }]
      });
      store.set('dirty', true);
      Pts.add(50);
    },

    delete(id) {
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);
      store.patch(`data.${key}`, {
        goals: d.goals.filter(g => g.id !== id)
      });
      store.set('dirty', true);
    }
  };

  // ═══ BUDGETS ═══
  const Budgets = {
    add({ name, limit }) {
      name = U.str(name, 60);
      limit = U.num(limit);
      if (!name || limit <= 0) throw new Error('INVALID_INPUT');
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);
      if (d.budgets.some(b => b.name === name)) throw new Error('DUPLICATE');
      store.patch(`data.${key}`, {
        budgets: [...d.budgets, { id: U.uid(), name, limit }]
      });
      store.set('dirty', true);
      Pts.add(10);
    },

    delete(id) {
      const year = store.get('year'), month = store.get('month');
      const key = U.monthKey(year, month);
      const d = Sel.monthData(year, month);
      store.patch(`data.${key}`, {
        budgets: d.budgets.filter(b => b.id !== id)
      });
      store.set('dirty', true);
    },

    calcSpent(budgetName, catSpend) {
      // Regex دقيق للإيموجي
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F100}-\u{1F1FF}]/u;
      
      const extractEmoji = (s) => {
        if (!s) return '';
        const m = s.match(emojiRegex);
        return m ? m[0] : '';
      };
      const extractText = (s) => {
        if (!s) return '';
        return s.replace(new RegExp(emojiRegex.source, 'gu'), '').trim();
      };
      
      // 🧠 تصنيفات ذكية: مطابقات معنوية عربية-إيموجي
      const SMART_CATEGORIES = {
        // أكل وطعام → 🍔
        '🍔': ['أكل', 'طعام', 'مطعم', 'مطاعم', 'غداء', 'عشاء', 'فطور', 'وجبة', 'برجر', 'بيتزا', 'شاورما', 'دجاج', 'كبسة'],
        // مواصلات → 🚗
        '🚗': ['مواصلات', 'بنزين', 'وقود', 'سيارة', 'تكسي', 'أوبر', 'كريم', 'نقل'],
        // تسوق → 🛒
        '🛒': ['تسوق', 'شراء', 'سوبرماركت', 'بقالة', 'ماركت', 'هايبر', 'كارفور', 'دانوب', 'بنده', 'ملابس'],
        // قهوة → ☕
        '☕': ['قهوة', 'كوفي', 'ستاربكس', 'شاي', 'مشروب', 'مشروبات', 'كافيه', 'كابتشينو'],
        // ترفيه → 🎬
        '🎬': ['ترفيه', 'سينما', 'فيلم', 'مسرح', 'العاب', 'ألعاب', 'بلايستيشن', 'نادي', 'رحلة'],
        // سكن → 🏠
        '🏠': ['بيت', 'إيجار', 'ايجار', 'سكن', 'كهرباء', 'ماء', 'إنترنت', 'انترنت', 'صيانة'],
        // جوال/فواتير → 📱
        '📱': ['جوال', 'اتصالات', 'stc', 'موبايلي', 'زين', 'فاتورة', 'فواتير', 'نت'],
        // صحة → 💊
        '💊': ['دواء', 'صيدلية', 'مستشفى', 'طبيب', 'عيادة', 'صحة'],
        // هدية → 🎁
        '🎁': ['هدية', 'هدايا', 'عيدية', 'مناسبة'],
      };
      
      // دالة: هل هذا اسم budget يتطابق مع هذا cat؟
      const categoriesMatch = (bName, cName) => {
        // 1) مطابقة مباشرة
        if (bName === cName) return true;
        
        const bE = extractEmoji(bName);
        const bT = extractText(bName).toLowerCase();
        const cE = extractEmoji(cName);
        const cT = extractText(cName).toLowerCase();
        
        // 2) إيموجي نفسه
        if (bE && cE && bE === cE) return true;
        
        // 3) نص مشابه (في كل الاتجاهين)
        if (bT && cT && bT.length > 1 && cT.length > 1) {
          if (bT.includes(cT) || cT.includes(bT)) return true;
        }
        
        // 4) تصنيفات ذكية - نص البادجت يطابق إيموجي المصروف
        if (bT && cE && SMART_CATEGORIES[cE]) {
          for (const keyword of SMART_CATEGORIES[cE]) {
            if (bT.includes(keyword) || keyword.includes(bT)) return true;
          }
        }
        
        // 5) تصنيفات ذكية - إيموجي البادجت يطابق نص المصروف
        if (bE && cT && SMART_CATEGORIES[bE]) {
          for (const keyword of SMART_CATEGORIES[bE]) {
            if (cT.includes(keyword) || keyword.includes(cT)) return true;
          }
        }
        
        return false;
      };
      
      let total = 0;
      for (const [cat, amt] of Object.entries(catSpend)) {
        if (!cat || cat === '➕') continue;
        if (categoriesMatch(budgetName, cat)) {
          total += amt;
        }
      }
      return total;
    }
  };

  // ═══ NOTIFICATIONS / DUES ═══
  const Notifs = {
    getStatus(item) {
      const today = new Date().getDate();
      const k = `${store.get('year')}-${store.get('month')}`;
      if (item.paidMonths?.[k]) return 'paid';
      const day = U.day(item.day, store.get('year'), store.get('month'));
      const diff = day - today;
      if (diff < 0) return 'overdue';
      if (diff === 0) return 'urgent';
      if (diff <= (item.alertDays || 5)) return 'soon';
      return 'upcoming';
    },

    add({ name, amt, icon = '🔔', day, alertDays = 5, recurring = true }) {
      name = U.str(name, 60);
      amt = U.num(amt);
      day = U.num(day, { min: 1, max: 31 });
      if (!name || !day) throw new Error('INVALID_INPUT');
      store.set('notifs', [
        ...store.get('notifs'),
        { id: U.uid(), name, amt, icon, day, alertDays, recurring, paidMonths: {} }
      ]);
    },

    togglePaid(id) {
      const k = `${store.get('year')}-${store.get('month')}`;
      const notifs = store.get('notifs').map(n => {
        if (n.id !== id) return n;
        const pm = { ...(n.paidMonths || {}) };
        if (pm[k]) delete pm[k]; else pm[k] = true;
        return { ...n, paidMonths: pm };
      });
      store.set('notifs', notifs);
    },

    delete(id) {
      store.set('notifs', store.get('notifs').filter(n => n.id !== id));
    },

    alertCount() {
      return store.get('notifs').filter(n => {
        const s = Notifs.getStatus(n);
        return s === 'overdue' || s === 'urgent' || s === 'soon';
      }).length;
    }
  };

  

  // ═══ SALARY ═══
  const Salary = {
    set(day) {
      store.set('salaryDay', U.num(day, { min: 0, max: 31 }));
    },
    countdown() {
      const d = store.get('salaryDay');
      if (!d) return { text: 'اختر يوم', today: false };
      const now = new Date();
      const td = now.getDate();
      let next = new Date(now.getFullYear(), now.getMonth(), d);
      if (next.getDate() !== d || next < now) {
        next = new Date(now.getFullYear(), now.getMonth() + 1, d);
      }
      const diff = Math.ceil((next - now) / 86400000);
      if (diff <= 0 || td === d) return { text: 'اليوم 🎉', today: true };
      if (diff === 1) return { text: 'بكرة ⏰', today: true };
      return { text: `باقي ${diff} يوم`, today: false };
    }
  };

  // ═══ AI / LEAKS / SAVINGS ═══
  const AI = {
    summary() {
      const y = store.get('year'), m = store.get('month');
      const t = Sel.totals(y, m);
      if (!t.income) return 'أضف دخلك أولاً عشان أحللها لك ✨';
      if (t.expense > t.income) return '⚠️ مصاريفك تتجاوز دخلك — راجع الإنفاق!';
      if (t.savePct >= 20) return `🌟 ممتاز! توفيرك ${t.savePct}٪ — على الطريق الصح`;
      if (t.savePct >= 10) return `📊 توفيرك ${t.savePct}٪ — زين، حاول تصل ٢٠٪`;
      return `⚡ توفيرك ${t.savePct}٪ — خطة ادخار يومية قد تساعد`;
    },

    leaks(threshold = 200) {
      const cats = Sel.categorySpending(store.get('year'), store.get('month'));
      const list = [];
      for (const [cat, m] of Object.entries(cats)) {
        if (m >= threshold) {
          list.push({ cat, monthly: m, yearly: m * 12, daily: Math.round(m / 30) });
        }
      }
      return list.sort((a, b) => b.monthly - a.monthly);
    },

    savingsPlan(dailyAmt) {
      const daily = U.num(dailyAmt, { min: 1, fallback: 20 });
      return {
        daily,
        monthly: Math.round(daily * 30.4),
        yearly: Math.round(daily * 365)
      };
    }
  };

  // ═══ SEARCH ═══
  const Search = {
    query(q) {
      q = U.str(q, 50).toLowerCase();
      if (!q) return [];
      const y = store.get('year'), m = store.get('month');
      const d = Sel.monthData(y, m);
      const results = [];
      for (const item of d.income) {
        if (item.name.toLowerCase().includes(q)) results.push({ ...item, typeLabel: 'دخل', type: 'income' });
      }
      for (const item of d.fixed) {
        if (item.name.toLowerCase().includes(q)) results.push({ ...item, typeLabel: 'ثابت', type: 'fixed' });
      }
      for (const item of d.variable) {
        if (item.name.toLowerCase().includes(q)) results.push({ ...item, typeLabel: 'متغير', type: 'variable' });
      }
      for (const [day, arr] of Object.entries(d.daily || {})) {
        for (const e of arr) {
          if (e.name.toLowerCase().includes(q)) {
            results.push({ ...e, typeLabel: `يوم ${day}`, type: e.type === 'out' ? 'daily-out' : 'daily-in' });
          }
        }
      }
      return results.slice(0, 30);
    }
  };

  // ═══ THEME ═══
  const Theme = {
    apply(theme) {
      const valid = ['default', 'light', 'midnight', 'rose'];
      const t = valid.includes(theme) ? theme : 'default';
      if (t === 'default') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', t);
      store.set('theme', t);
      // Also update theme-color meta for PWA
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        const colors = { default: '#0a0a0a', light: '#fdf8f3', midnight: '#05070a', rose: '#1a0d14' };
        meta.setAttribute('content', colors[t]);
      }
    }
  };

  const Lang = {
    apply(lang) {
      const valid = ['ar', 'en'];
      const l = valid.includes(lang) ? lang : 'ar';
      store.set('lang', l);
      document.documentElement.setAttribute('lang', l);
      document.documentElement.setAttribute('dir', l === 'en' ? 'ltr' : 'rtl');
      document.body.style.direction = l === 'en' ? 'ltr' : 'rtl';

      // Translate key UI elements
      const translations = {
        ar: {
          home: 'الرئيسية', money: 'فلوسي', social: 'اجتماعي', profile: 'الملف',
          appName: 'تـدّبير',
          monthly: '📊 هالشهر', yearly: '📅 هالسنة',
          achievements: '🏆 إنجازاتي', settings: '⚙️ الإعدادات',
          welcomeText: 'مخططك المالي الذكي'
        },
        en: {
          home: 'Home', money: 'My Money', social: 'Social', profile: 'Profile',
          appName: 'Tdbeer',
          monthly: '📊 Month', yearly: '📅 Year',
          achievements: '🏆 Achievements', settings: '⚙️ Settings',
          welcomeText: 'Your smart financial planner'
        }
      };

      const T = translations[l];

      // Update main nav
      const tabs = [
        { tab: 'home', key: 'home', icon: '🏠' },
        { tab: 'money', key: 'money', icon: '💰' },
        { tab: 'social', key: 'social', icon: '👥' },
        { tab: 'profile', key: 'profile', icon: '👤' }
      ];
      tabs.forEach(t => {
        const btn = document.querySelector(`[data-tab="${t.tab}"] .tab-label`);
        if (btn) btn.textContent = T[t.key];
      });

      // Update sub-navs
      const subMap = [
        { sub: 'monthly', key: 'monthly' },
        { sub: 'yearly', key: 'yearly' },
        { sub: 'achievements', key: 'achievements' },
        { sub: 'settings', key: 'settings' }
      ];
      subMap.forEach(s => {
        const btn = document.querySelector(`[data-sub="${s.sub}"]`);
        if (btn) btn.textContent = T[s.key];
      });

      // App name
      const logoName = document.getElementById('appLogoName');
      if (logoName) logoName.textContent = T.appName;

      // Header greeting
      const greetingEl = document.getElementById('headerGreeting');
      if (greetingEl) greetingEl.textContent = T.welcomeText;

      // Update lang buttons active state
      document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === l);
      });
    },

    current() {
      return store.get('lang') || 'ar';
    }
  };

  // Date/Time display
  const DateDisplay = {
    update() {
      const el = document.getElementById('headerDate');
      if (!el) return;
      const lang = store.get('lang') || 'ar';
      const now = new Date();
      const days = lang === 'en'
        ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        : ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const months = lang === 'en'
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        : ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const dayName = days[now.getDay()];
      const day = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();

      const prefix = lang === 'en' ? 'Today: ' : 'تاريخ اليوم: ';
      el.textContent = `${prefix}${dayName} ${day} ${monthName} ${year}`;
    },
    start() {
      this.update();
      // Update every minute
      setInterval(() => this.update(), 60000);
    }
  };

  // ═══ EXPORTS ═══
  const Export = {
    csv() {
      const y = store.get('year'), m = store.get('month');
      const d = Sel.monthData(y, m);
      const t = Sel.totals(y, m);
      const rows = [['البند', 'الفئة', 'النوع', 'المبلغ']];
      d.income.forEach(x => rows.push([x.name, x.cat, 'دخل', x.amt]));
      d.fixed.forEach(x => rows.push([x.name, x.cat, 'ثابت', x.amt]));
      d.variable.forEach(x => rows.push([x.name, x.cat, 'متغير', x.amt]));
      for (const arr of Object.values(d.daily || {})) {
        for (const e of arr) rows.push([e.name, e.cat, e.type === 'out' ? 'مصروف' : 'دخل', e.amt]);
      }
      rows.push([]);
      rows.push(['المجموع', '', 'دخل', t.income]);
      rows.push(['المجموع', '', 'مصروف', t.expense]);
      rows.push(['المجموع', '', 'توفير', t.save]);
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = DOM.h('a', { href: url, download: `tdbeer_${MONTHS[m]}_${y}.csv` });
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('تم تصدير CSV ✅', 'success');
    },

    txt() {
      const y = store.get('year'), m = store.get('month');
      const d = Sel.monthData(y, m);
      const t = Sel.totals(y, m);
      let out = `تقرير تـدّبير\n${MONTHS[m]} ${y}\n${'─'.repeat(36)}\n`;
      out += `الدخل: ${Fmt.c(t.income)}\nالمصاريف: ${Fmt.c(t.expense)}\nالتوفير: ${Fmt.c(t.save)}\n${'─'.repeat(36)}\n`;
      d.income.forEach(x => out += `[دخل] ${x.cat} ${x.name}: ${Fmt.c(x.amt)}\n`);
      d.fixed.forEach(x => out += `[ثابت] ${x.cat} ${x.name}: ${Fmt.c(x.amt)}\n`);
      d.variable.forEach(x => out += `[متغير] ${x.cat} ${x.name}: ${Fmt.c(x.amt)}\n`);
      const blob = new Blob([out], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = DOM.h('a', { href: url, download: `tdbeer_${MONTHS[m]}_${y}.txt` });
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('تم تصدير التقرير 📄', 'success');
    },

    pdf() {
      const y = store.get('year'), m = store.get('month');
      const d = Sel.monthData(y, m);
      const t = Sel.totals(y, m);
      const items = [
        ...d.income.map(x => ({ ...x, type: 'دخل', color: '#10b981' })),
        ...d.fixed.map(x => ({ ...x, type: 'ثابت', color: '#ef4444' })),
        ...d.variable.map(x => ({ ...x, type: 'متغير', color: '#ef4444' }))
      ];

      const win = window.open('about:blank', '_blank');
      if (!win) { Toast.show('المتصفح يحجب النوافذ', 'warn'); return; }

      // ─── XSS-safe DOM construction (لا document.write، لا template strings) ───
      const doc = win.document;

      // ─── Document setup ───
      doc.documentElement.lang = 'ar';
      doc.documentElement.dir = 'rtl';
      doc.title = `تقرير تـدّبير — ${MONTHS[m]} ${y}`;

      // Charset meta
      const charsetMeta = doc.createElement('meta');
      charsetMeta.setAttribute('charset', 'UTF-8');
      doc.head.appendChild(charsetMeta);

      // Inline styles (safe — controlled content)
      const style = doc.createElement('style');
      style.textContent = [
        'body { font-family: Arial, sans-serif; padding: 32px; direction: rtl; }',
        'h1 { color: #a07828; }',
        'table { width: 100%; border-collapse: collapse; margin-top: 20px; }',
        'th, td { padding: 8px; border-bottom: 1px solid #eee; text-align: right; }',
        'th { background: #f8f8f8; }',
        '.amt { font-weight: 700; }'
      ].join('\n');
      doc.head.appendChild(style);

      // ─── Heading ───
      const h1 = doc.createElement('h1');
      h1.textContent = `تقرير تـدّبير — ${MONTHS[m]} ${y}`;
      doc.body.appendChild(h1);

      // ─── Summary paragraph (using DOM nodes, not innerHTML) ───
      const summary = doc.createElement('p');
      const makeBold = (text, color) => {
        const b = doc.createElement('b');
        b.style.color = color;
        b.textContent = text;
        return b;
      };
      summary.appendChild(doc.createTextNode('الدخل: '));
      summary.appendChild(makeBold(Fmt.c(t.income), '#10b981'));
      summary.appendChild(doc.createTextNode(' | المصاريف: '));
      summary.appendChild(makeBold(Fmt.c(t.expense), '#ef4444'));
      summary.appendChild(doc.createTextNode(' | التوفير: '));
      summary.appendChild(makeBold(Fmt.c(t.save), '#a07828'));
      doc.body.appendChild(summary);

      // ─── Items table ───
      const table = doc.createElement('table');
      const thead = doc.createElement('thead');
      const headerRow = doc.createElement('tr');
      ['البند', 'الفئة', 'النوع', 'المبلغ'].forEach(label => {
        const th = doc.createElement('th');
        th.textContent = label;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = doc.createElement('tbody');
      const makeCell = (text, opts = {}) => {
        const td = doc.createElement('td');
        td.textContent = String(text == null ? '' : text);
        if (opts.color) td.style.color = opts.color;
        if (opts.bold) td.classList.add('amt');
        return td;
      };

      for (const r of items) {
        const tr = doc.createElement('tr');
        tr.appendChild(makeCell(r.name));
        tr.appendChild(makeCell(r.cat));
        tr.appendChild(makeCell(r.type));
        tr.appendChild(makeCell(Fmt.c(r.amt), { color: r.color, bold: true }));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      doc.body.appendChild(table);

      // ─── Trigger print ───
      setTimeout(() => {
        try { win.print(); }
        catch (e) { Logger?.warn?.('Export.pdf.print', e?.message); }
      }, 500);
      Toast.show('جاري فتح الطباعة 🖨️', 'warn');
    }
  };

  return { store, Sel, Toast, Pts, Achievements, Streak, Entries, Goals, Budgets,
           Notifs, Salary, AI, Search, Theme, Export, Lang, DateDisplay };
})();

// ═══ CRITICAL: Export App to window for use by other modules ═══
window.App = App;
window.Toast = App.Toast;
