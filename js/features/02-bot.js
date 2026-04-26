/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — AI Financial Bot
   ───────────────────────────────────────────────────────────────────
   Originally lines 16278–16842 of index.html
═══════════════════════════════════════════════════════════════════ */

var Bot = (() => {
  const { U, Fmt, DOM, $, $$, Logger } = Tdbeer;
  const { store, Sel, Toast, AI, Streak } = App;

  const BOT_ID = '__tdbeer_bot__';
  const BOT_INFO = {
    uid: BOT_ID,
    username: 'tdbeer_bot',
    displayName: 'تـدّبير AI',
    isBot: true
  };

  const state = {
    messages: [],
    isOpen: false,
    isTyping: false,
    suggestions: []
  };

  // ═══ BOT BRAIN - Pattern matching + context awareness ═══
  const RESPONSES = {
    // تحيات
    greeting: [
      'أهلاً {name}! 👋 كيفك اليوم؟',
      'مرحباً {name}! 😊 ش أخبارك المالية؟',
      'هلا والله! {name}، كيف يومك؟',
      'يا هلا {name}! 🌟 وش الجديد؟'
    ],
    greetingMorning: [
      'صباح الخير {name}! ☀️ يوم مبارك',
      'صباحو! {name} 🌅 جاهز ليوم منتج؟'
    ],
    greetingEvening: [
      'مساء الخير {name}! 🌆 كيف كان يومك؟',
      'مساء النور! {name} ✨ وش آخر الأخبار؟'
    ],

    // شكر
    thanks: [
      'العفو! 😊 دايماً بخدمتك',
      'تسلم! هذا واجبي 🌟',
      'الله يسلمك! أنا هنا عشانك',
      'ما سويت شي! 💛'
    ],

    // وداع
    bye: [
      'مع السلامة {name}! 👋 نراك قريب',
      'بالتوفيق! 🌟 خلك متابع أهدافك',
      'تصبح على خير! 🌙',
      'الله معك! ارجع لي وقت ما تحتاج 💛'
    ],

    // لم يفهم
    unknown: [
      'ما فهمت تماماً 🤔 تقدر توضح أكثر؟',
      'مو متأكد من سؤالك. جرب صيغة ثانية؟',
      'هذي المعلومة ما عندي 😅 لكن أقدر أساعدك في:\n💰 تحليل مصاريفك\n🎯 الأهداف\n🔥 السلسلة اليومية'
    ],

    // تشجيع
    encouragement: [
      'أنت تقدر {name}! 💪',
      'استمر، نتائجك ممتازة! 🌟',
      'فخور فيك! 🎉',
      'الطريق طويل لكنك على الصح ✨'
    ]
  };

  // ═══ التحليل الذكي للبيانات ═══
  function analyzeFinances() {
    const y = store.get('year'), m = store.get('month');
    const t = Sel.totals(y, m);
    const d = Sel.monthData(y, m);
    const cats = Sel.categorySpending(y, m);
    const s = Streak.calc();

    return {
      income: t.income,
      expense: t.expense,
      save: t.save,
      spendPct: t.spendPct,
      savePct: t.savePct,
      topCat: Object.entries(cats).sort((a, b) => b[1] - a[1])[0],
      goalsCount: d.goals?.length || 0,
      budgetsCount: d.budgets?.length || 0,
      streak: s.current,
      maxStreak: s.max,
      leaks: AI.leaks(200)
    };
  }

  // ═══ منطق التوجيه - أي نوع سؤال؟ ═══
  function classifyIntent(text) {
    const t = text.toLowerCase().trim();

    // Helper: Arabic-aware word match (Arabic doesn't work with \b in JS regex)
    // We use anchors: start of string, whitespace, or punctuation
    const arMatch = (regex) => regex.test(t);

    // تحيات — order matters: more specific first
    // "صباح الخير" قبل غيره
    if (arMatch(/(صباح|صبحو|صباحو)/)) return 'greetingMorning';
    if (arMatch(/(مساء|مسا الخير|مسا النور)/)) return 'greetingEvening';
    // bye يجي قبل greeting لأن "مع السلامة" يحتوي "السلام"
    if (arMatch(/(مع السلامة|الى اللقاء|الى لقاء|تصبح على خير|باي باي|^باي$|^bye$|^goodbye$|وداع)/)) return 'bye';
    // greeting: السلام عليكم، السلام، هلا، هاي، مرحبا
    if (arMatch(/(السلام|^سلام$|^سلام عليكم|هلا|هاي|^hi$|^hello$|مرحب|اهلا|أهلا|^heyy?$)/)) return 'greeting';
    if (arMatch(/(شكر|مشكور|تسلم|يعطيك العاف|ثانك)/)) return 'thanks';
    if (arMatch(/(كيفك|وشخبارك|كيف حالك|how are you)/)) return 'howAreYou';

    // تحليل مالي
    if (arMatch(/(كم صرفت|مصاريف|صرف|اصرف|انفق)/)) return 'expenses';
    if (arMatch(/(كم دخلي|الدخل|راتب|دخل الشهر)/)) return 'income';
    if (arMatch(/(توفير|وفرت|ادخار|مدخرات)/)) return 'savings';
    if (arMatch(/(رصيد|كم معي|كم باقي)/)) return 'balance';
    if (arMatch(/(تقرير|ملخص|تحليل|احصائي)/)) return 'report';

    // ميزات
    if (arMatch(/(هدف|اهداف|توفير ل|ابي اوفر)/)) return 'goals';
    if (arMatch(/(ميزاني|حد انفاق|حد صرف)/)) return 'budget';
    if (arMatch(/(سلسلة|streak|متتالي|كم يوم)/)) return 'streak';
    if (arMatch(/(تسرب|اين تذهب|اين تروح فلوسي)/)) return 'leaks';

    // مساعدة
    if (arMatch(/(ساعد|كيف|احتاج|how|help|ممكن)/)) return 'help';
    if (arMatch(/(من انت|مين انت|ايش انت|who are you)/)) return 'whoami';

    // عواطف
    if (arMatch(/(مبسوط|فرحان|سعيد|happy)/)) return 'happy';
    if (arMatch(/(زعلان|حزين|تعبان|مكتئب|sad)/)) return 'sad';
    if (arMatch(/(قلقان|خايف|stress|متوتر)/)) return 'worried';

    // تشجيع
    if (arMatch(/(ما اقدر|فاشل|صعب|محبط)/)) return 'needEncouragement';

    return 'unknown';
  }

  // ═══ توليد رد ذكي ═══
  function generateResponse(text) {
    const intent = classifyIntent(text);
    const name = store.get('userName') || 'صديقي';
    const fin = analyzeFinances();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].replace(/\{name\}/g, name);

    switch (intent) {
      case 'greeting': return pick(RESPONSES.greeting);
      case 'greetingMorning': return pick(RESPONSES.greetingMorning);
      case 'greetingEvening': return pick(RESPONSES.greetingEvening);
      case 'thanks': return pick(RESPONSES.thanks);
      case 'bye': return pick(RESPONSES.bye);

      case 'howAreYou':
        return `الحمدلله بخير! 😊\nأنا جاهز أساعدك دايماً.\nأنت كيفك ${name}؟`;

      case 'whoami':
        return `أنا **تـدّبير AI** 🤖✨\nمساعدك المالي الذكي!\n\nأقدر أساعدك في:\n💰 تحليل دخلك ومصاريفك\n🎯 وضع أهداف مالية\n🔥 متابعة سلسلتك اليومية\n💬 الحديث عن أي شي يخص أموالك\n\nاسألني أي شي! 🌟`;

      case 'expenses':
        if (fin.expense === 0) return `لسّا ما سجّلت مصاريف هذا الشهر.\nاضغط ➕ من تبويب الشهر عشان تبدأ 📝`;
        let resp = `📉 **مصاريفك هذا الشهر:**\n${Fmt.c(fin.expense)}\n\n`;
        if (fin.topCat) {
          resp += `🔝 أكثر فئة صرفت فيها:\n${fin.topCat[0]} → ${Fmt.c(fin.topCat[1])}\n\n`;
        }
        if (fin.spendPct >= 90) resp += '⚠️ تجاوزت ٩٠٪ من دخلك! احذر!';
        else if (fin.spendPct >= 70) resp += '🟡 قارب التجاوز، راقب أكثر';
        else resp += '✅ أداؤك زين!';
        return resp;

      case 'income':
        if (fin.income === 0) return `ما سجّلت دخل بعد.\nأضف راتبك من تبويب الشهر 💰`;
        return `📈 **دخلك هذا الشهر:**\n${Fmt.c(fin.income)}\n\n💡 نصيحة: وفّر ٢٠٪ = ${Fmt.c(fin.income * 0.2)}`;

      case 'savings':
        if (fin.save <= 0) return `🔴 ما عندك توفير هذا الشهر — مصاريفك أكبر من دخلك\n\nجرّب:\n• راجع الاشتراكات\n• ألغِ الكماليات\n• ضع حد إنفاق`;
        return `💰 **توفيرك هذا الشهر:**\n${Fmt.c(fin.save)} (${fin.savePct}٪)\n\n${fin.savePct >= 20 ? '🌟 ممتاز! على الطريق الصح' : fin.savePct >= 10 ? '🟢 زين، حاول تصل ٢٠٪' : '🟡 تحتاج تحسين - ابدأ بـ ٥٪'}`;

      case 'balance':
        const bal = fin.income - fin.expense;
        return `⚖️ **رصيدك الحالي:**\n${Fmt.c(bal)}\n\n📊 دخل: ${Fmt.c(fin.income)}\n📉 مصاريف: ${Fmt.c(fin.expense)}`;

      case 'report':
        return `📊 **تقرير شامل:**\n\n📈 الدخل: ${Fmt.c(fin.income)}\n📉 المصاريف: ${Fmt.c(fin.expense)} (${fin.spendPct}٪)\n💰 التوفير: ${Fmt.c(fin.save)} (${fin.savePct}٪)\n\n🎯 الأهداف: ${fin.goalsCount}\n🛡️ الميزانيات: ${fin.budgetsCount}\n🔥 السلسلة: ${fin.streak} يوم\n\n${AI.summary()}`;

      case 'goals':
        if (fin.goalsCount === 0) return `🎯 ما عندك أهداف بعد!\n\nأمثلة:\n🚗 سيارة: ٥٠,٠٠٠ ريال\n✈️ سفر: ٥,٠٠٠ ريال\n🏠 منزل: ٢٠٠,٠٠٠ ريال\n\nأضف هدفك من تبويب الشهر → 🎯 الأهداف`;
        return `🎯 عندك ${fin.goalsCount} هدف!\n\nنصيحة: اجعل هدف واحد هو الأولوية، وخصص له مبلغ شهري ثابت من دخلك 💪`;

      case 'budget':
        if (fin.budgetsCount === 0) return `🛡️ ما حطيت حدود إنفاق بعد!\n\nمثال: حد ٥٠٠ ريال للأكل شهرياً\n\nيساعدك تتحكم بمصاريفك\n\nاذهب لتبويب الشهر → 🛡️ حد الصرف`;
        return `🛡️ عندك ${fin.budgetsCount} حد إنفاق!\n\nتابعهم بانتظام عشان ما تتجاوز 💡`;

      case 'streak':
        if (fin.streak === 0) return `🔥 سلسلتك صفر!\n\nسجّل حضورك كل يوم عشان تفتح:\n🥉 ٣٠ يوم = برونز\n🥇 ٦٠ يوم = ذهب\n💎 ٩٠ يوم = أوبسيديان\n\nاضغط "سجّل حضورك اليوم" في تبويب الشهر!`;
        if (fin.streak >= 90) return `💎 أوبسيديان! أنت أسطورة ${name}!\n${fin.streak} يوم متتالي 👑`;
        if (fin.streak >= 60) return `🥇 ذهبي! ممتاز ${name}!\n${fin.streak} يوم\n${90 - fin.streak} يوم للأوبسيديان 💎`;
        if (fin.streak >= 30) return `🥉 برونز! رهيب ${name}!\n${fin.streak} يوم\n${60 - fin.streak} يوم للذهبي 🥇`;
        return `🔥 ${fin.streak} يوم متتالي!\n${30 - fin.streak} يوم للبرونز 🥉\nواصل ${name}!`;

      case 'leaks':
        if (!fin.leaks.length) return `✅ ما عندك تسربات مالية كبيرة!\nإدارتك ممتازة 🌟`;
        let r = `💧 **تسربات مالية محتملة:**\n\n`;
        fin.leaks.slice(0, 3).forEach(l => {
          r += `${l.cat} → ${Fmt.c(l.monthly)}/شهر\n`;
        });
        const totalYearly = fin.leaks.reduce((s, x) => s + x.yearly, 0);
        r += `\n💡 لو قللت ٢٠٪ = توفير ${Fmt.c(totalYearly * 0.2)} سنوياً!`;
        return r;

      case 'help':
        return `🌟 **أستطيع مساعدتك في:**\n\n💰 "كم صرفت هذا الشهر؟"\n📊 "أعطني تقرير شامل"\n🎯 "كيف أضع هدف؟"\n\n🔥 "كم سلسلتي؟"\n💧 "أين تذهب فلوسي؟"\n\nجرّب أسئلة طبيعية وأنا أفهمها! 😊`;

      case 'happy':
        return `${pick(RESPONSES.encouragement)}\nعاش الفرح ${name}! 🎉✨`;

      case 'sad':
        return `أنا معك ${name} 💛\nالأيام تمر، والحلو جاي.\nركّز على شي تحبه، والمستقبل يصير أحلى ✨`;

      case 'worried':
        return `خذ نفس عميق ${name} 🌊\nكل شي بيكون تمام إن شاء الله.\nلو القلق بسبب الفلوس، راجع ميزانيتك معي وبنخطط سوا 💪`;

      case 'needEncouragement':
        return `${pick(RESPONSES.encouragement)}\n\n🌟 كل خطوة صغيرة مهمة!\nلا تقارن نفسك بغيرك، قارنها بـ "أنت" أمس 💎`;

      default:
        return pick(RESPONSES.unknown);
    }
  }

  // ═══ اقتراحات ذكية حسب السياق ═══
  function getSuggestions() {
    const fin = analyzeFinances();
    const suggestions = [];

    if (fin.income === 0) suggestions.push('كيف أضيف راتبي؟');
    if (fin.expense > 0) suggestions.push('كم صرفت هذا الشهر؟');
    if (fin.save > 0) suggestions.push('كم وفرت؟');
    if (fin.leaks.length > 0) suggestions.push('أين تذهب فلوسي؟');
    if (fin.streak === 0) suggestions.push('ما هي السلسلة اليومية؟');
    suggestions.push('أعطني تقرير شامل');
    suggestions.push('من أنت؟');

    return suggestions.slice(0, 4);
  }

  // ═══ فتح محادثة البوت ═══
  function open() {
    // استخدم واجهة الشات الموجودة لكن للبوت
    state.isOpen = true;

    const social = window.Social;
    if (!social || !social._state) return;

    // تحقق من الرفيق المختار
    const companion = window.Companion?.get();
    const mood = window.Companion?.getMood();
    const avatarEmoji = companion ? companion.emoji : '🤖';
    const displayName = companion ? companion.name : BOT_INFO.displayName;

    // سجّل الزيارة وزد الرابطة
    if (window.Companion) {
      window.Companion.incrementBond(2);
    }

    social._state.activeChat = {
      peerUid: BOT_ID,
      peerName: displayName,
      peerUsername: BOT_INFO.username,
      chatId: 'bot_' + (social._state.user?.uid || 'guest'),
      isBot: true
    };
    social._state.activeChatMessages = state.messages;

    // تعبئة الواجهة
    DOM.setText($('#chatPeerAvatar'), avatarEmoji);
    DOM.setText($('#chatPeerName'), displayName);
    DOM.setText($('#chatPeerStatus'), '🟢 متصل الحين • @' + BOT_INFO.username);
    $('#chatOverlay').classList.add('open');
    $('#chatPanel').classList.add('open');
    $('#chatInput').value = '';
    $('#chatSendBtn').disabled = true;

    // رسالة ترحيب إذا أول مرة أو إذا الرفيق اشتاق
    const needsGreeting = state.messages.length === 0 || (companion && mood === 'missing');

    if (needsGreeting) {
      setTimeout(() => {
        const name = store.get('userName') || 'صديقي';
        const hour = new Date().getHours();
        let welcomeText;

        if (companion) {
          // ترحيب من الرفيق حسب شخصيته
          const greeting = window.Companion.getGreeting();
          if (mood === 'missing') {
            welcomeText = `${greeting}\n\n${name}، ${companion.missing}\n\nاحكِ لي، كيفك؟ 💛`;
          } else {
            let timeGreet;
            if (hour < 12) timeGreet = '☀️ صباح الخير';
            else if (hour < 18) timeGreet = '🌤️ مساء الخير';
            else timeGreet = '🌙 مساء الخير';

            welcomeText = `${greeting} يا ${name}!\n${timeGreet}\n\nأنا ${companion.emoji} ${companion.name}، رفيقك في رحلتك المالية.\n\n${companion.trait.split('—')[1]?.trim() || 'جاهز للحوار'}\n\nاسألني أي شي 👇`;
          }
        } else {
          // ترحيب عادي
          let greet;
          if (hour < 12) greet = `صباح الخير ${name}! ☀️`;
          else if (hour < 18) greet = `مساء الخير ${name}! 🌤️`;
          else greet = `مساء الخير ${name}! 🌆`;

          welcomeText = `${greet}\n\nأنا **تـدّبير AI** 🤖\nمساعدك المالي الذكي.\n\nأقدر أساعدك تحلل مصاريفك، تحقق أهدافك، وتكون أذكى مالياً 💰\n\nاسألني أي شي! 👇`;
        }

        addMessage({
          from: BOT_ID,
          text: welcomeText,
          at: new Date(),
          isBot: true
        });
        renderSuggestions();
      }, 500);
    } else {
      renderChatMessages();
      renderSuggestions();
    }

    setTimeout(() => $('#chatInput')?.focus(), 400);
  }

  function close() {
    state.isOpen = false;
    $('#chatOverlay')?.classList.remove('open');
    $('#chatPanel')?.classList.remove('open');
    clearSuggestions();
  }

  function addMessage(msg) {
    state.messages.push(msg);
    renderChatMessages();
  }

  function renderChatMessages() {
    const cont = $('#chatMessages');
    if (!cont) return;
    cont.innerHTML = '';

    if (!state.messages.length) {
      const empty = DOM.h('div', { class: 'chat-empty' },
        DOM.h('div', { class: 'chat-empty-icon' }, '🤖'),
        DOM.h('div', { class: 'chat-empty-title' }, 'ابدأ المحادثة'),
        DOM.h('div', { class: 'chat-empty-desc' }, 'اسألني عن مصاريفك، أهدافك، أو أي شي مالي!')
      );
      cont.appendChild(empty);
      return;
    }

    for (const m of state.messages) {
      const isMine = m.from !== BOT_ID;
      const bubble = DOM.h('div', { class: 'msg ' + (isMine ? 'mine' : 'bot') });

// ⚠️ XSS FIX: escape أولاً، ثم حوّل markdown لعلامات HTML آمنة فقط
      const safe = U.esc(m.text)
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')   // bold
        .replace(/\n/g, '<br>');                    // line breaks
      const textDiv = document.createElement('div');
      textDiv.className = 'msg-text';
      textDiv.innerHTML = safe;

      const t = m.at ? new Date(m.at) : new Date();
      const timeStr = t.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      bubble.appendChild(DOM.h('div', { class: 'msg-time' }, timeStr));
      cont.appendChild(bubble);
    }

    if (state.isTyping) {
      const typing = DOM.h('div', { class: 'bot-typing', id: 'botTypingIndicator' },
        DOM.h('span'), DOM.h('span'), DOM.h('span')
      );
      cont.appendChild(typing);
    }

    requestAnimationFrame(() => { cont.scrollTop = cont.scrollHeight; });
  }

  function renderSuggestions() {
    clearSuggestions();
    if (state.messages.length > 6) return; // أخفي بعد فترة

    const suggestions = getSuggestions();
    const wrap = DOM.h('div', { class: 'bot-suggestions', id: 'botSuggestions' });
    for (const s of suggestions) {
      wrap.appendChild(DOM.h('button', {
        class: 'bot-suggestion-chip',
        onclick: () => {
          $('#chatInput').value = s;
          sendMessage();
        }
      }, s));
    }
    const inputBar = document.querySelector('.chat-input-bar');
    if (inputBar) inputBar.parentNode.insertBefore(wrap, inputBar);
  }

  function clearSuggestions() {
    $('#botSuggestions')?.remove();
  }

  async function sendMessage() {
    const input = $('#chatInput');
    const text = U.str(input.value, 1000);
    if (!text) return;

    input.value = '';
    $('#chatSendBtn').disabled = true;
    clearSuggestions();

    // أضف رسالة المستخدم
    addMessage({
      from: 'user',
      text,
      at: new Date()
    });

    // إظهار "جاري الكتابة"
    state.isTyping = true;
    renderChatMessages();

    // محاكاة التفكير
    const thinkTime = 600 + Math.random() * 800;
    await new Promise(r => setTimeout(r, thinkTime));

    // توليد الرد
    const response = generateResponse(text);

    state.isTyping = false;
    addMessage({
      from: BOT_ID,
      text: response,
      at: new Date(),
      isBot: true
    });

    // أظهر اقتراحات جديدة أحياناً
    if (state.messages.length < 8) {
      setTimeout(renderSuggestions, 200);
    }

    input.focus();
  }

  // ═══ بطاقة البوت في القائمة ═══
  function renderBotCard(container) {
    if (!container) return;

    // تحقق من الرفيق المختار
    const companion = window.Companion?.get();
    const mood = window.Companion?.getMood();
    const bondLevel = window.Companion?.getBondLevel();

    const avatarEmoji = companion ? companion.emoji : '🤖';
    const displayName = companion ? companion.name : BOT_INFO.displayName;
    const statusText = companion
      ? (mood === 'missing' ? '💔 اشتاق لك' : mood === 'sad' ? '😔 يفتقدك' : '😊 ' + companion.trait.split('—')[0].trim())
      : 'مساعدك المالي الذكي';

    const card = DOM.h('div', {
      class: 'bot-card',
      onclick: open
    },
      DOM.h('div', { class: 'bot-avatar' }, avatarEmoji),
      DOM.h('div', { class: 'bot-body' },
        DOM.h('div', { class: 'bot-name-row' },
          DOM.h('span', { class: 'bot-name' }, displayName),
          DOM.h('span', { class: 'bot-badge' }, companion ? '✨' : 'AI')
        ),
        DOM.h('div', { class: 'bot-username' }, '@' + BOT_INFO.username),
        DOM.h('div', { class: 'bot-status' }, statusText),
        companion && bondLevel ? DOM.h('div', { class: 'companion-bond' },
          '💛 ' + bondLevel.label
        ) : null
      ),
      DOM.h('button', {
        class: 'bot-chat-btn',
        onclick: (e) => { e.stopPropagation(); open(); },
        'aria-label': 'محادثة'
      }, '💬')
    );
    container.appendChild(card);

    // زر إعدادات الرفيق (لتغييره)
    if (!companion) {
      // إذا ما في رفيق، اعرض زر اختيار
      const pickBtn = DOM.h('button', {
        class: 'btn-primary',
        style: { marginTop: '8px', width: '100%', fontSize: '13px' },
        onclick: () => window.Companion?.openPicker(true)
      }, '🎭 اختر رفيقك الذكي');
      container.appendChild(pickBtn);
    }
  }

  // ═══ اعتراض الشات العادي للبوت ═══
  function interceptSendMessage() {
    // عندما يكتب المستخدم للبوت في الشات العادي، نحن نتكفل
    const origSend = $('#chatSendBtn')?.onclick;
    $('#chatSendBtn')?.addEventListener('click', (e) => {
      const social = window.Social;
      if (social?._state?.activeChat?.isBot) {
        e.stopImmediatePropagation();
        e.preventDefault();
        sendMessage();
      }
    }, true);

    // Enter key
    $('#chatInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const social = window.Social;
        if (social?._state?.activeChat?.isBot) {
          e.stopImmediatePropagation();
          e.preventDefault();
          if ($('#chatInput').value.trim()) sendMessage();
        }
      }
    }, true);

    // Back button
    $('#chatBackBtn')?.addEventListener('click', (e) => {
      if (state.isOpen) {
        e.stopImmediatePropagation();
        close();
      }
    }, true);

    // Overlay click
    $('#chatOverlay')?.addEventListener('click', (e) => {
      if (state.isOpen) {
        e.stopImmediatePropagation();
        close();
      }
    }, true);
  }

  function init() {
    // ربط الأحداث بعد تحميل DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', interceptSendMessage);
    } else {
      interceptSendMessage();
    }
  }

  return { init, open, close, renderBotCard, sendMessage, BOT_INFO };
})();

window.Bot = Bot;

/* ═══════════════════════════════════════════════════
   TDBEER — Smart Features
   1. 🎁 Daily Gift Box
   2. 🔮 Financial Simulator
   3. 🎙️ Voice Input
   4. 🔊 Text-to-Speech
═══════════════════════════════════════════════════ */
