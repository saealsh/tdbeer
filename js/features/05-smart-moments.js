/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Smart Moments
   ───────────────────────────────────────────────────────────────────
   Originally lines 17707–17925 of index.html
═══════════════════════════════════════════════════════════════════ */

var SmartMoments = (() => {
  const { DOM, $, Logger, Storage, U, Fmt } = Tdbeer;
  const { store, Sel, Streak } = App;

  function getDismissed() {
    const today = new Date().toISOString().slice(0, 10);
    const data = Storage.load('moments_dismissed', {});
    if (data._date !== today) return {};
    return data;
  }

  function dismiss(id) {
    const today = new Date().toISOString().slice(0, 10);
    const data = Storage.load('moments_dismissed', {});
    if (data._date !== today) Object.keys(data).forEach(k => delete data[k]);
    data._date = today;
    data[id] = true;
    Storage.save('moments_dismissed', data);
    render();
  }

  function getMoments() {
    const moments = [];
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth();
    const hour = now.getHours();
    const weekday = now.getDay(); // 0=Sunday
    const y = store.get('year'), m = store.get('month');
    const t = Sel.totals(y, m);
    const streak = Streak.calc();

    // 💰 يوم الراتب (أول ٣ أيام من الشهر)
    if (day <= 3) {
      moments.push({
        id: 'salary_day',
        icon: '💰',
        type: 'special',
        title: 'وصل راتبك؟',
        desc: 'ابدأ شهرك بتخطيط ذكي — وزّع الراتب قبل الإنفاق',
        action: () => {
          document.querySelector('[data-tab="money"]')?.click();
          setTimeout(() => Toast.show('💡 جرّب إضافة الراتب الحين', 'info'), 300);
        }
      });
    }

    // ⚠️ نهاية الشهر
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (day >= daysInMonth - 3 && day <= daysInMonth) {
      moments.push({
        id: 'month_end',
        icon: '📊',
        type: 'info',
        title: `باقي ${daysInMonth - day + 1} ${daysInMonth - day + 1 === 1 ? 'يوم' : 'أيام'} على نهاية الشهر`,
        desc: 'راجع إنجازاتك المالية واستعد للشهر القادم',
        action: () => {
          document.querySelector('[data-tab="money"]')?.click();
        }
      });
    }

    // 🔥 Streak warning - لم يسجل اليوم
    const todayStr = now.toISOString().slice(0, 10);
    const lastCheckin = Storage.load('lastCheckinDate', '');
    if (streak.current > 0 && lastCheckin !== todayStr) {
      moments.push({
        id: 'streak_warning',
        icon: '🔥',
        type: 'urgent',
        title: `احمِ سلسلتك (${streak.current} يوم)!`,
        desc: 'سجّل حضورك اليوم قبل أن تنكسر السلسلة',
        action: () => {
          document.querySelector('[data-tab="money"]')?.click();
          setTimeout(() => Toast.show('سجّل حضورك اليوم 🔥', 'warn'), 300);
        }
      });
    }

    // 🎯 صباح الخير
    if (hour >= 6 && hour < 11 && lastCheckin !== todayStr) {
      moments.push({
        id: 'morning_ritual',
        icon: '☀️',
        type: 'success',
        title: 'صباح الخير! جاهز ليوم منتج؟',
        desc: 'ابدأ بطقسك اليومي — تسجيل حضور + مراجعة ميزانيتك',
        action: () => document.querySelector('[data-tab="money"]')?.click()
      });
    }

    // 📈 تجاوز الميزانية
    if (t.spendPct >= 90) {
      moments.push({
        id: 'budget_warning',
        icon: '⚠️',
        type: 'urgent',
        title: 'تجاوزت ٩٠٪ من دخلك هذا الشهر',
        desc: 'انتبه! راجع مصاريفك قبل نهاية الشهر',
        action: () => document.querySelector('[data-tab="money"]')?.click()
      });
    }

    // 💎 إنجاز كبير
    if (t.savePct >= 30 && t.save > 0) {
      moments.push({
        id: 'great_saving',
        icon: '🎉',
        type: 'success',
        title: `رهيب! وفّرت ${t.savePct}٪ هذا الشهر`,
        desc: `أنت من أذكى الموفّرين! استمر على هذا المسار`,
        action: () => {}
      });
    }

    // 🎁 هدية يومية متاحة
    const lastGift = Storage.load('giftLastOpen', 0);
    if (Date.now() - lastGift >= 24 * 60 * 60 * 1000) {
      moments.push({
        id: 'gift_available',
        icon: '🎁',
        type: 'special',
        title: 'صندوق اليوم جاهز!',
        desc: 'افتح الصندوق واكسب مفاجأة يومية',
        action: () => window.SmartFeatures?.Gift?.open()
      });
    }

    // 👋 مستخدم جديد
    const userCreated = Storage.load('userCreatedAt', null);
    if (!userCreated) {
      Storage.save('userCreatedAt', Date.now());
    }
    const ageInDays = userCreated ? Math.floor((Date.now() - userCreated) / (1000 * 60 * 60 * 24)) : 0;
    if (ageInDays < 3) {
      moments.push({
        id: 'welcome_tour',
        icon: '👋',
        type: 'info',
        title: 'يا هلا والله في تـدّبير!',
        desc: 'جرّب ميزات الذكاء الاصطناعي وابدأ رحلتك المالية',
        action: () => {
          if (!window.Companion?.get()) window.Companion?.openPicker(true);
        }
      });
    }

    // 🔮 ما فيه بيانات
    if (t.income === 0 && t.expense === 0) {
      moments.push({
        id: 'no_data',
        icon: '📝',
        type: 'info',
        title: 'ابدأ بتسجيل بياناتك',
        desc: 'أضف راتبك أو مصاريفك الشهرية من تبويب الشهر',
        action: () => document.querySelector('[data-tab="money"]')?.click()
      });
    }

    return moments;
  }

  function render() {
    const cont = $('#smartMomentsContainer');
    if (!cont) return;
    cont.innerHTML = '';

    const dismissed = getDismissed();
    const moments = getMoments().filter(m => !dismissed[m.id]);

    if (moments.length === 0) return;

    const section = DOM.h('div', { class: 'moments-section' });
    section.appendChild(DOM.h('div', { class: 'moments-section-title' }, '✨ ', 'لحظات ذكية'));

    for (const m of moments.slice(0, 4)) {
      const card = DOM.h('div', {
        class: 'moment-card ' + (m.type || 'info'),
        onclick: () => { try { m.action(); } catch (e) { if (window.Logger) Logger.warn('SmartMoments', e?.message); } }
      },
        DOM.h('div', { class: 'moment-icon' }, m.icon),
        DOM.h('div', { class: 'moment-body' },
          DOM.h('div', { class: 'moment-title' }, m.title),
          DOM.h('div', { class: 'moment-desc' }, m.desc)
        ),
        DOM.h('button', {
          class: 'moment-dismiss',
          onclick: (e) => { e.stopPropagation(); dismiss(m.id); },
          'aria-label': 'إخفاء'
        }, '✕')
      );
      section.appendChild(card);
    }

    cont.appendChild(section);
  }

  return { render, dismiss, getMoments };
})();

window.SmartMoments = SmartMoments;
