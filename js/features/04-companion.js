/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Companion (assistant)
   ───────────────────────────────────────────────────────────────────
   Originally lines 17530–17706 of index.html
═══════════════════════════════════════════════════════════════════ */

var Companion = (() => {
  const { DOM, $, Logger, Storage, U, Fmt } = Tdbeer;
  const { Toast } = App;

  const CHARACTERS = {
    fox: {
      id: 'fox', emoji: '🦊', name: 'الثعلب الذكي',
      trait: 'ذكي ومحسوب — يحب الخطط الذكية والمكر المالي',
      greeting: ['مرحى!', 'أهلاً يا ذكي!', 'يا صاحب الذكاء!'],
      happy: 'ذكاؤك يبهرني!',
      sad: 'الخطة المحكمة تحتاج صبر.',
      missing: 'أين كنت؟ افتقدت حواراتنا الذكية 🦊'
    },
    lion: {
      id: 'lion', emoji: '🦁', name: 'الأسد القوي',
      trait: 'شجاع ومواجه — يحب القرارات الحازمة والنتائج الكبيرة',
      greeting: ['هيه بطل!', 'يا ملك!', 'يا أسد!'],
      happy: 'هذه روح البطل!',
      sad: 'الأسود لا يستسلمون!',
      missing: 'عدت أخيراً! الأسود تنتظر معاركها 🦁'
    },
    bear: {
      id: 'bear', emoji: '🐻', name: 'الدب الحكيم',
      trait: 'هادئ وحكيم — يحب التفكير العميق والقرارات المحسوبة',
      greeting: ['سلام عليك', 'أهلاً يا صديقي', 'يا هلا والله'],
      happy: 'الهدوء يجلب الحكمة.',
      sad: 'العاصفة تمر دائماً.',
      missing: 'اشتقت لحديثنا الهادئ 🐻'
    },
    falcon: {
      id: 'falcon', emoji: '🦅', name: 'الصقر الرشيق',
      trait: 'سريع ودقيق — يحب القرارات السريعة والاستثمار الذكي',
      greeting: ['يا صقر!', 'أهلاً يا سريع!', 'يا رشيق!'],
      happy: 'الصقر يحلّق عالياً!',
      sad: 'الصقور لا تخاف الرياح.',
      missing: 'طال غيابك يا صقري 🦅'
    },
    turtle: {
      id: 'turtle', emoji: '🐢', name: 'السلحفاة الصبورة',
      trait: 'صبور ومنتظم — يحب الخطط طويلة المدى والثبات',
      greeting: ['يا هلا بك', 'سلام يا صديق', 'أهلاً'],
      happy: 'الصبر مفتاح الفرج.',
      sad: 'خطوة خطوة نصل.',
      missing: 'رجعت يا صاحبي 🐢 الصبر كان عناءً'
    }
  };

  let state = {
    selected: null,
    bond: 0,
    lastVisit: 0,
    daysSinceLastVisit: 0
  };

  function load() {
    state.selected = Storage.load('companion_selected', null);
    state.bond = Storage.load('companion_bond', 0);
    state.lastVisit = Storage.load('companion_lastVisit', Date.now());
    const now = Date.now();
    state.daysSinceLastVisit = Math.floor((now - state.lastVisit) / (1000 * 60 * 60 * 24));
  }

  function save() {
    Storage.save('companion_selected', state.selected);
    Storage.save('companion_bond', state.bond);
    Storage.save('companion_lastVisit', state.lastVisit);
  }

  function get() {
    if (!state.selected) return null;
    return CHARACTERS[state.selected];
  }

  function getMood() {
    if (state.daysSinceLastVisit >= 3) return 'missing';
    if (state.daysSinceLastVisit >= 1) return 'sad';
    return 'happy';
  }

  function getBondLevel() {
    if (state.bond >= 100) return { level: 5, label: 'أخوّة' };
    if (state.bond >= 50) return { level: 4, label: 'صديق مقرّب' };
    if (state.bond >= 20) return { level: 3, label: 'صديق' };
    if (state.bond >= 5) return { level: 2, label: 'متعارف' };
    return { level: 1, label: 'جديد' };
  }

  function incrementBond(amount = 1) {
    state.bond += amount;
    state.lastVisit = Date.now();
    state.daysSinceLastVisit = 0;
    save();
  }

  function markVisit() {
    state.lastVisit = Date.now();
    state.daysSinceLastVisit = 0;
    save();
  }

  function openPicker(isFirstTime = false) {
    const overlay = $('#companionPickerOverlay');
    const list = $('#companionList');
    if (!overlay || !list) return;

    list.innerHTML = '';
    let tempSelected = null;

    for (const key of Object.keys(CHARACTERS)) {
      const c = CHARACTERS[key];
      const opt = DOM.h('button', {
        class: 'companion-option',
        'data-id': c.id,
        onclick: (e) => {
          tempSelected = c.id;
          document.querySelectorAll('.companion-option').forEach(x => x.classList.remove('selected'));
          e.currentTarget.classList.add('selected');
          $('#companionConfirmBtn').classList.add('active');
        }
      },
        DOM.h('span', { class: 'companion-emoji' }, c.emoji),
        DOM.h('div', { class: 'companion-info' },
          DOM.h('div', { class: 'companion-name' }, c.name),
          DOM.h('div', { class: 'companion-trait' }, c.trait)
        )
      );
      list.appendChild(opt);
    }

    $('#companionConfirmBtn').classList.remove('active');
    $('#companionConfirmBtn').onclick = () => {
      if (!tempSelected) return;
      state.selected = tempSelected;
      save();
      overlay.classList.remove('open');
      const c = CHARACTERS[tempSelected];
      Toast.show(`✨ ${c.emoji} ${c.name} رفيقك الحين!`, 'success');
      // تحديث البوت
      if (window.Social?.renderFriendsTab) window.Social.renderFriendsTab();
    };

    overlay.classList.add('open');
  }

  function closePicker() {
    $('#companionPickerOverlay')?.classList.remove('open');
  }

  function getGreeting() {
    const c = get();
    if (!c) return null;
    const mood = getMood();
    if (mood === 'missing') return c.missing;
    const greeting = c.greeting[Math.floor(Math.random() * c.greeting.length)];
    return greeting;
  }

  function personalizeMessage(text) {
    const c = get();
    if (!c) return text;
    // أضف روح الشخصية
    return text;
  }

  return {
    load, save, get, getMood, getBondLevel, incrementBond, markVisit,
    openPicker, closePicker, getGreeting, personalizeMessage,
    CHARACTERS
  };
})();

window.Companion = Companion;
