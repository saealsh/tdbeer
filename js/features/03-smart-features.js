/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Smart Features (insights, predictions)
   ───────────────────────────────────────────────────────────────────
   Originally lines 16843–17529 of index.html
═══════════════════════════════════════════════════════════════════ */

var SmartFeatures = (() => {
  const { U, Fmt, DOM, $, $$, Logger, Storage } = Tdbeer;
  const { store, Toast, Pts, Entries } = App;

  // ═══ 1. DAILY GIFT BOX ═══
  const Gift = (() => {
    const REWARDS = [
      // Common (60%)
      { type: 'xp', icon: '⭐', weight: 15, min: 10, max: 30, label: 'نقاط خبرة' },
      { type: 'xp', icon: '💫', weight: 10, min: 30, max: 60, label: 'نقاط خبرة' },
      { type: 'tip', icon: '💡', weight: 15, label: 'نصيحة ذهبية', tips: [
        'وفّر ٢٠٪ من راتبك قبل أي مصروف',
        'القاعدة الذهبية: لا تشتري ما لا تحتاج',
        'صندوق الطوارئ = ٣ أشهر من مصاريفك',
        'استثمر في نفسك قبل أي شيء',
        'الديون تؤجل أحلامك — سددها أولاً',
        'راجع اشتراكاتك شهرياً، احذف غير المستخدم',
        'القهوة اليومية = ٥٤٠٠ ريال سنوياً',
        'اكتب قائمة قبل التسوق — توفّر ٢٠٪'
      ] },
      { type: 'quote', icon: '📜', weight: 10, label: 'حكمة اليوم', quotes: [
        '"من ااحفظ دينه ااحفظ ماله" - حديث شريف',
        '"الاقتصاد نصف المعيشة" - عمر بن الخطاب',
        '"ما عال من اقتصد" - النبي ﷺ',
        '"الدين هم الليل وذل النهار" - مثل عربي',
        '"ليس الغني عن كثرة العرض، إنما الغنى غنى النفس" - حديث شريف'
      ] },
      { type: 'blessing', icon: '🤲', weight: 10, label: 'دعاء', blessings: [
        'اللهم بارك لي فيما رزقتني',
        'اللهم اكفني بحلالك عن حرامك',
        'اللهم اغنني بفضلك عمن سواك',
        'اللهم ارزقني رزقاً حلالاً طيباً',
        'بسم الله الذي لا يضر مع اسمه شيء'
      ] },
      // Rare (25%)
      { type: 'xp', icon: '💎', weight: 15, min: 80, max: 150, label: 'نقاط خبرة' },
      { type: 'badge', icon: '🌟', weight: 10, label: 'شارة نجم اليوم' },
      // Legendary (5%)
      { type: 'jackpot', icon: '👑', weight: 5, min: 200, max: 300, label: 'جائزة كبرى!' }
    ];

    function pickReward() {
      const total = REWARDS.reduce((s, r) => s + r.weight, 0);
      let rnd = Math.random() * total;
      for (const r of REWARDS) {
        rnd -= r.weight;
        if (rnd <= 0) return r;
      }
      return REWARDS[0];
    }

    function canOpen() {
      const last = Storage.load('giftLastOpen', 0);
      const now = Date.now();
      const hoursSince = (now - last) / (1000 * 60 * 60);
      return hoursSince >= 24;
    }

    function nextOpenTime() {
      const last = Storage.load('giftLastOpen', 0);
      return last + (24 * 60 * 60 * 1000);
    }

    function formatTimeLeft(ms) {
      if (ms <= 0) return '00:00:00';
      const h = Math.floor(ms / (1000 * 60 * 60));
      const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((ms % (1000 * 60)) / 1000);
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    let timerInterval = null;

    function open() {
      const overlay = $('#giftOverlay');
      if (!overlay) return;
      overlay.classList.add('open');

      const intro = $('#giftIntro');
      const locked = $('#giftLocked');
      const result = $('#giftResult');

      intro.style.display = 'none';
      locked.style.display = 'none';
      result.classList.remove('show');

      if (canOpen()) {
        intro.style.display = 'block';
      } else {
        locked.style.display = 'block';
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
      }
    }

    function updateTimer() {
      const left = nextOpenTime() - Date.now();
      if (left <= 0) {
        clearInterval(timerInterval);
        $('#giftLocked').style.display = 'none';
        $('#giftIntro').style.display = 'block';
        return;
      }
      DOM.setText($('#giftTimer'), formatTimeLeft(left));
    }

    function close() {
      $('#giftOverlay')?.classList.remove('open');
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }

    function launchConfetti() {
      const card = document.querySelector('.gift-card');
      if (!card) return;
      const colors = ['#c9a84c', '#f0d98a', '#10b981', '#3b82f6', '#ec4899', '#f97316'];
      for (let i = 0; i < 30; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = (Math.random() * 0.5) + 's';
        piece.style.animationDuration = (2 + Math.random() * 1.5) + 's';
        card.appendChild(piece);
        setTimeout(() => piece.remove(), 3000);
      }
    }

    function openBox() {
      const box = $('#giftBox');
      const intro = $('#giftIntro');

      box.classList.remove('shaking');
      box.classList.add('opening');

      setTimeout(() => {
        const reward = pickReward();
        intro.style.display = 'none';

        // Show result
        DOM.setText($('#giftRewardIcon'), reward.icon);

        let rewardText = '';
        let detail = '';

        if (reward.type === 'xp' || reward.type === 'jackpot') {
          const amount = Math.floor(reward.min + Math.random() * (reward.max - reward.min));
          rewardText = `+${amount} XP`;
          detail = reward.type === 'jackpot'
            ? 'جائزة كبرى! حظك عالي اليوم 👑'
            : 'نقاط خبرة جديدة ⭐';
          Pts.add(amount);
        } else if (reward.type === 'tip') {
          const tip = reward.tips[Math.floor(Math.random() * reward.tips.length)];
          rewardText = 'نصيحة ذهبية';
          detail = '"' + tip + '"';
          Pts.add(20);
        } else if (reward.type === 'quote') {
          const quote = reward.quotes[Math.floor(Math.random() * reward.quotes.length)];
          rewardText = 'حكمة اليوم';
          detail = quote;
          Pts.add(15);
        } else if (reward.type === 'blessing') {
          const b = reward.blessings[Math.floor(Math.random() * reward.blessings.length)];
          rewardText = 'دعاء للبركة';
          detail = b + ' 🤲';
          Pts.add(15);
        } else if (reward.type === 'badge') {
          rewardText = 'شارة نجم اليوم';
          detail = 'اجمع ٥ من هذه الشارات لفتح مستوى خاص ⭐';
          Pts.add(50);
        }

        DOM.setText($('#giftRewardText'), rewardText);
        DOM.setText($('#giftRewardDetail'), detail);

        $('#giftResult').classList.add('show');
        launchConfetti();

        // Mark as opened
        Storage.save('giftLastOpen', Date.now());

        // Haptic feedback
        try { if (navigator.vibrate) navigator.vibrate([50, 30, 100]); } catch (e) { if (window.Logger) Logger.warn('SmartFeatures', e?.message); }
      }, 1000);
    }

    function collect() {
      close();
      Toast.show('🎉 تم استلام جائزتك!', 'success');
      // إزالة علامة الهدية من الزر
      $('#btnOpenGift')?.classList.remove('has-gift');
    }

    // Check if gift is available on startup
    function checkAvailability() {
      const btn = $('#btnOpenGift');
      if (!btn) return;
      if (canOpen()) {
        btn.classList.add('has-gift');
      } else {
        btn.classList.remove('has-gift');
      }
    }

    return { open, close, openBox, collect, canOpen, checkAvailability };
  })();

  // ═══ 2. FINANCIAL SIMULATOR ═══
  const Simulator = (() => {
    const SCENARIOS = [
      {
        id: 'daily_save',
        emoji: '💰',
        text: 'لو وفّرت مبلغاً يومياً',
        defaultAmount: 100,
        defaultYears: 1,
        label1: 'المبلغ اليومي (ريال)',
        label2: 'المدة (سنوات)',
        calc: (a, y) => a * 365 * y,
        headline: 'ستوفر',
        period: (y) => `في ${y} ${y === 1 ? 'سنة' : y === 2 ? 'سنتين' : 'سنوات'}`,
        insight: (total, a, y) => `إذا واصلت بنفس الوتيرة، ستصبح لديك ثروة صغيرة! المال الصغير المتراكم أقوى من المال الكبير المتفرق.`
      },
      {
        id: 'cancel_sub',
        emoji: '📺',
        text: 'لو ألغيت اشتراكاً شهرياً',
        defaultAmount: 45,
        defaultYears: 1,
        label1: 'قيمة الاشتراك الشهرية',
        label2: 'المدة (سنوات)',
        calc: (a, y) => a * 12 * y,
        headline: 'ستوفر',
        period: (y) => `في ${y} ${y === 1 ? 'سنة' : 'سنوات'}`,
        insight: (total) => `الاشتراكات الصغيرة تسرق ميزانيتك بصمت. راجعها كل ٣ شهور!`
      },
      {
        id: 'daily_coffee',
        emoji: '☕',
        text: 'لو تركت القهوة اليومية',
        defaultAmount: 20,
        defaultYears: 1,
        label1: 'تكلفة القهوة اليومية',
        label2: 'المدة (سنوات)',
        calc: (a, y) => a * 365 * y,
        headline: 'ستوفر',
        period: (y) => `في ${y} ${y === 1 ? 'سنة' : 'سنوات'}`,
        insight: (total) => `القهوة بـ ٢٠ ريال × ٣٦٥ يوم = ٧٣٠٠ ريال سنوياً! فكر فيها.`
      },
      {
        id: 'double_income',
        emoji: '📈',
        text: 'لو ضاعفت راتبي',
        defaultAmount: 5000,
        defaultYears: 1,
        label1: 'راتبك الحالي',
        label2: 'المدة (سنوات)',
        calc: (a, y) => a * 12 * y,
        headline: 'راتبك الإضافي',
        period: (y) => `في ${y} ${y === 1 ? 'سنة' : 'سنوات'}`,
        insight: (total) => `مضاعفة الراتب = تحقيق الأهداف أسرع بكثير. ركز على تطوير مهاراتك!`
      },
      {
        id: 'retirement',
        emoji: '🏖️',
        text: 'لو وفّرت للتقاعد',
        defaultAmount: 500,
        defaultYears: 30,
        label1: 'ادخار شهري',
        label2: 'سنوات قبل التقاعد',
        calc: (a, y) => a * 12 * y,
        headline: 'مدخراتك للتقاعد',
        period: (y) => `بعد ${y} سنة`,
        insight: (total) => `التخطيط للتقاعد يبدأ من اليوم. كل شهر تؤخره = خسارة فادحة.`
      },
      {
        id: 'hajj',
        emoji: '🕋',
        text: 'لو وفّرت للحج والعمرة',
        defaultAmount: 200,
        defaultYears: 2,
        label1: 'ادخار شهري',
        label2: 'المدة (سنوات)',
        calc: (a, y) => a * 12 * y,
        headline: 'ستجمع',
        period: (y) => `في ${y} ${y === 1 ? 'سنة' : 'سنوات'}`,
        insight: (total) => `العمرة من ٣٠٠٠-٥٠٠٠ ريال، والحج ١٥٠٠٠-٢٥٠٠٠ ريال. خطط من اليوم!`
      }
    ];

    let activeScenario = null;

    function open() {
      $('#simOverlay').classList.add('open');
      renderScenarios();
      $('#simCustomInputs').style.display = 'none';
      $('#simResult').classList.remove('show');
      activeScenario = null;
    }

    function close() {
      $('#simOverlay')?.classList.remove('open');
    }

    function renderScenarios() {
      const cont = $('#simScenarios');
      if (!cont) return;
      cont.innerHTML = '';
      for (const s of SCENARIOS) {
        const btn = DOM.h('button', {
          class: 'sim-scenario-btn',
          onclick: () => selectScenario(s)
        },
          DOM.h('span', { class: 'sim-scenario-emoji' }, s.emoji),
          DOM.h('span', { class: 'sim-scenario-text' }, s.text)
        );
        cont.appendChild(btn);
      }
    }

    function selectScenario(s) {
      activeScenario = s;
      $$('.sim-scenario-btn').forEach((b, i) => {
        b.classList.toggle('active', SCENARIOS[i].id === s.id);
      });
      DOM.setText($('#simLabel1'), s.label1);
      DOM.setText($('#simLabel2'), s.label2);
      $('#simInput1').value = s.defaultAmount;
      $('#simInput2').value = s.defaultYears;
      $('#simCustomInputs').style.display = 'block';

      // احسب مباشرة
      calculate();
    }

    function getEquivalents(total) {
      const equivs = [];
      // عمرة (تقريب 4000 ريال)
      const umrah = Math.floor(total / 4000);
      if (umrah >= 1) equivs.push({ icon: '🕋', text: `${umrah} ${umrah === 1 ? 'عمرة' : 'عمرات'}` });

      // سيارة مستعملة (30000 ريال)
      if (total >= 30000) {
        const cars = Math.floor(total / 30000);
        equivs.push({ icon: '🚗', text: `${cars} ${cars === 1 ? 'سيارة مستعملة' : 'سيارات'}` });
      }

      // آيفون (4500)
      const iphones = Math.floor(total / 4500);
      if (iphones >= 1 && iphones <= 50) equivs.push({ icon: '📱', text: `${iphones} ${iphones === 1 ? 'آيفون' : 'آيفونات'}` });

      // عطلات (8000)
      const trips = Math.floor(total / 8000);
      if (trips >= 1 && trips <= 30) equivs.push({ icon: '✈️', text: `${trips} ${trips === 1 ? 'عطلة' : 'عطلات'}` });

      // صدقة (100 ريال لأسرة محتاجة)
      const families = Math.floor(total / 1200);
      if (families >= 1 && families <= 100) equivs.push({ icon: '🤲', text: `إطعام ${families} أسرة لشهر` });

      // حج (20000)
      if (total >= 20000) {
        const hajj = Math.floor(total / 20000);
        equivs.push({ icon: '🕋', text: `${hajj} ${hajj === 1 ? 'حجة' : 'حجات'}` });
      }

      // منزل (500000+)
      if (total >= 500000) {
        equivs.push({ icon: '🏠', text: 'دفعة أولى لمنزل' });
      }

      return equivs.slice(0, 4);
    }

    function calculate() {
      if (!activeScenario) return;
      const a = U.num($('#simInput1').value);
      const y = U.num($('#simInput2').value);
      if (a <= 0 || y <= 0) return;

      const total = activeScenario.calc(a, y);

      DOM.setText($('#simResultHeadline'), activeScenario.headline);
      DOM.setText($('#simResultNumber'), Fmt.c(total));
      DOM.setText($('#simResultPeriod'), activeScenario.period(y));

      // Equivalents
      const equivCont = $('#simEquivalents');
      equivCont.innerHTML = '';
      const equivs = getEquivalents(total);
      for (const eq of equivs) {
        equivCont.appendChild(DOM.h('div', { class: 'sim-equiv' },
          DOM.h('div', { class: 'sim-equiv-icon' }, eq.icon),
          DOM.h('div', { class: 'sim-equiv-text' }, eq.text)
        ));
      }

      DOM.setText($('#simInsight'), '💡 ' + activeScenario.insight(total, a, y));

      $('#simResult').classList.add('show');
    }

    return { open, close, calculate };
  })();

  // ═══ 3. VOICE INPUT ═══
  const Voice = (() => {
    let recognition = null;
    let isListening = false;
    let parsedData = null;

    function isSupported() {
      return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    }

    function init() {
      if (!isSupported()) return false;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onresult = (e) => {
        let final = '';
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t;
          else interim += t;
        }
        const display = final || interim;
        if (display) {
          DOM.setText($('#voiceTranscript'), display);
          $('#voiceTranscript').classList.add('show');
          if (final) {
            parseTranscript(final);
          }
        }
      };

      recognition.onerror = (e) => {
        Logger.warn('Voice', e.error);
        isListening = false;
        updateUI();
        let msg = 'تعذّر التسجيل';
        if (e.error === 'no-speech') msg = 'لم أسمع شيئاً، حاول مجدداً';
        else if (e.error === 'not-allowed') msg = 'يلزم السماح بالميكروفون';
        else if (e.error === 'network') msg = 'مشكلة اتصال';
        DOM.setText($('#voiceStatus'), msg);
      };

      recognition.onend = () => {
        isListening = false;
        updateUI();
        if (!parsedData) {
          DOM.setText($('#voiceStatus'), 'اضغط الميكروفون وحاول مرة ثانية');
        }
      };

      return true;
    }

    function open() {
      if (!isSupported()) {
        Toast.show('المتصفح لا يدعم التسجيل الصوتي', 'warn');
        return;
      }
      if (!recognition) init();
      $('#voiceOverlay').classList.add('open');
      reset();
    }

    function reset() {
      isListening = false;
      parsedData = null;
      $('#voiceTranscript').classList.remove('show');
      $('#voiceParsed').classList.remove('show');
      $('#voiceActions').style.display = 'none';
      $('#voiceExamples').style.display = 'block';
      DOM.setText($('#voiceTranscript'), '');
      DOM.setText($('#voiceStatus'), 'اضغط على الميكروفون للبدء');
      updateUI();
    }

    function close() {
      if (isListening && recognition) {
        try { recognition.stop(); } catch (e) { if (window.Logger) Logger.warn('SmartFeatures', e?.message); }
      }
      $('#voiceOverlay')?.classList.remove('open');
    }

    function toggle() {
      if (!recognition) {
        if (!init()) {
          Toast.show('المتصفح لا يدعم التسجيل', 'warn');
          return;
        }
      }
      if (isListening) {
        try { recognition.stop(); } catch (e) { if (window.Logger) Logger.warn('SmartFeatures', e?.message); }
        isListening = false;
        updateUI();
      } else {
        parsedData = null;
        $('#voiceParsed').classList.remove('show');
        $('#voiceActions').style.display = 'none';
        $('#voiceExamples').style.display = 'none';
        try {
          recognition.start();
          isListening = true;
          DOM.setText($('#voiceStatus'), '🎤 أستمع إليك الحين...');
          updateUI();
        } catch (e) {
          Logger.warn('Voice.start', e.message);
        }
      }
    }

    function updateUI() {
      const btn = $('#voiceMicBtn');
      if (!btn) return;
      btn.classList.toggle('listening', isListening);
      btn.textContent = isListening ? '⏹️' : '🎤';
    }

    // ═══ Parse Arabic speech to expense/income ═══
    function parseTranscript(text) {
      // استخراج المبلغ
      const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
      if (!amountMatch) {
        DOM.setText($('#voiceStatus'), '⚠️ لم أتعرّف على مبلغ. قل رقماً واضحاً');
        return;
      }
      const amount = parseFloat(amountMatch[1]);

      // تحديد نوع المعاملة
      const lower = text.toLowerCase();
      const isIncome = /راتب|دخل|وصل|استلمت|أخذت|ربحت/.test(lower);

      // تحديد الفئة
      const categories = [
        { regex: /قهو|شاي|ستارباكس|نسكافيه/, cat: '☕', name: 'قهوة' },
        { regex: /أكل|غدا|فطور|عشا|مطعم|برجر|بيتزا|شاورما/, cat: '🍔', name: 'أكل' },
        { regex: /بنزين|وقود|محطة/, cat: '⛽', name: 'بنزين' },
        { regex: /مواصلا|تاكسي|أوبر|كريم|نقل/, cat: '🚗', name: 'مواصلات' },
        { regex: /تسوق|ملابس|حذاء|شنطة|مول/, cat: '🛒', name: 'تسوق' },
        { regex: /كهربا|ماء|اتصال|نت|فاتورة/, cat: '⚡', name: 'فاتورة' },
        { regex: /هدية|هداي/, cat: '🎁', name: 'هدية' },
        { regex: /دوا|طبيب|صيدلية|مستشفى/, cat: '💊', name: 'صحة' },
        { regex: /ترفيه|سينما|لعبة|فيلم/, cat: '🎬', name: 'ترفيه' },
        { regex: /راتب/, cat: '💵', name: 'راتب' },
        { regex: /حر|freelance|عمل حر/, cat: '💼', name: 'عمل حر' }
      ];

      let matchedCat = null;
      let catName = 'متفرقات';
      for (const c of categories) {
        if (c.regex.test(lower)) {
          matchedCat = c.cat;
          catName = c.name;
          break;
        }
      }

      if (!matchedCat) {
        matchedCat = isIncome ? '💵' : '➕';
      }

      // استخراج الاسم (بدون رقم)
      let name = text.replace(/\d+(?:\.\d+)?/g, '')
                    .replace(/ريال|ريالات|ر\.س|sr|sar/gi, '')
                    .replace(/صرفت|دفعت|اشتريت|أخذت|وصل|استلمت|على|في|من|الى|إلى/g, '')
                    .trim();
      if (!name || name.length < 2) name = catName;
      if (name.length > 40) name = name.slice(0, 40);

      parsedData = {
        name,
        amount,
        cat: matchedCat,
        type: isIncome ? 'income' : 'expense'
      };

      // عرض النتيجة
      const detail = $('#voiceParsedDetail');
      detail.innerHTML = '';
      detail.appendChild(DOM.h('span', null, `${matchedCat} ${name} — ${isIncome ? '📈 دخل' : '📉 مصروف'}`));
      detail.appendChild(DOM.h('strong', { style: { color: isIncome ? 'var(--green-2)' : 'var(--danger)' } }, Fmt.c(amount)));

      $('#voiceParsed').classList.add('show');
      $('#voiceActions').style.display = 'flex';
      DOM.setText($('#voiceStatus'), '✅ فهمت! اضغط للتأكيد');
    }

    function confirm() {
      if (!parsedData) return;
      try {
        if (parsedData.type === 'income') {
          Entries.addIncome({
            name: parsedData.name,
            amt: parsedData.amount,
            cat: parsedData.cat
          });
          Toast.show(`📈 أُضيف دخل ${Fmt.c(parsedData.amount)}`, 'success');
        } else {
          Entries.addVariable({
            name: parsedData.name,
            amt: parsedData.amount,
            cat: parsedData.cat
          });
          Toast.show(`📉 أُضيف مصروف ${Fmt.c(parsedData.amount)}`, 'success');
        }
        try { if (typeof Renderers !== 'undefined') Renderers.scheduledAll(); } catch (e) { if (window.Logger) Logger.warn('SmartFeatures', e?.message); }
        Pts.add(10); // مكافأة استخدام الصوت
        close();
      } catch (e) {
        Toast.show('فشل الإضافة', 'danger');
        Logger.error('Voice.confirm', e);
      }
    }

    return { open, close, toggle, confirm, reset, isSupported };
  })();

  // ═══ EVENTS BINDING ═══
  function bindEvents() {
    // Gift
    $('#btnOpenGift')?.addEventListener('click', Gift.open);
    $('#btnOpenGift2')?.addEventListener('click', Gift.open);
    $('#giftCloseBtn')?.addEventListener('click', Gift.close);
    $('#giftOpenBtn')?.addEventListener('click', Gift.openBox);
    $('#giftBox')?.addEventListener('click', Gift.openBox);
    $('#giftCollectBtn')?.addEventListener('click', Gift.collect);
    $('#giftOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'giftOverlay') Gift.close();
    });

    // Simulator
    $('#btnOpenSimulator')?.addEventListener('click', Simulator.open);
    $('#btnOpenSimulator2')?.addEventListener('click', Simulator.open);
    $('#simCloseBtn')?.addEventListener('click', Simulator.close);
    $('#simCalcBtn')?.addEventListener('click', Simulator.calculate);
    $('#simInput1')?.addEventListener('input', Simulator.calculate);
    $('#simInput2')?.addEventListener('input', Simulator.calculate);
    $('#simOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'simOverlay') Simulator.close();
    });

    // Voice
    $('#btnOpenVoice')?.addEventListener('click', Voice.open);
    $('#btnOpenVoice2')?.addEventListener('click', Voice.open);
    $('#voiceCloseBtn')?.addEventListener('click', Voice.close);
    $('#voiceMicBtn')?.addEventListener('click', Voice.toggle);
    $('#voiceConfirmBtn')?.addEventListener('click', Voice.confirm);
    $('#voiceCancelBtn')?.addEventListener('click', Voice.reset);
    $('#voiceOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'voiceOverlay') Voice.close();
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if ($('#giftOverlay')?.classList.contains('open')) Gift.close();
        else if ($('#simOverlay')?.classList.contains('open')) Simulator.close();
        else if ($('#voiceOverlay')?.classList.contains('open')) Voice.close();
      }
    });
  }

  function init() {
    try { bindEvents(); } catch (e) { console.warn('SmartFeatures.bindEvents failed:', e.message); }
    // تحقق من توفر الهدية بعد تحميل DOM
    try { setTimeout(() => { try { Gift.checkAvailability(); } catch (e) { if (window.Logger) Logger.warn('SmartFeatures', e?.message); } }, 500); } catch (e) { if (window.Logger) Logger.warn('SmartFeatures', e?.message); }
    // افحص كل دقيقة
    try { setInterval(() => { try { Gift.checkAvailability(); } catch (e) { if (window.Logger) Logger.warn('SmartFeatures', e?.message); } }, 60000); } catch (e) { if (window.Logger) Logger.warn('SmartFeatures', e?.message); }
  }

  return { init, Gift, Simulator, Voice };
})();

window.SmartFeatures = SmartFeatures;
