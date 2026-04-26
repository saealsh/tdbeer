/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Fresh Content
   ───────────────────────────────────────────────────────────────────
   Originally lines 17926–18090 of index.html
═══════════════════════════════════════════════════════════════════ */

var FreshContent = (() => {
  const { DOM, $, Logger, Storage, U, Fmt } = Tdbeer;
  const { Pts, Toast } = App;

  // محتوى متنوع - يُختار حسب اليوم
  const TIPS = [
    { title: 'قاعدة ٥٠/٣٠/٢٠', body: '<b>٥٠٪</b> احتياجات أساسية، <b>٣٠٪</b> ترفيه ورغبات، <b>٢٠٪</b> ادخار واستثمار. جرّب هذه القاعدة هذا الشهر.' },
    { title: 'ادخر قبل أن تصرف', body: 'بمجرد وصول راتبك، <b>حوّل ٢٠٪</b> فوراً لحساب الادخار. ما ستراه هو ما ستصرفه.' },
    { title: 'قاعدة الـ ٢٤ ساعة', body: 'قبل أي شراء فوق <b>٣٠٠ ريال</b>، اصبر ٢٤ ساعة. كثير من الرغبات تختفي بعدها!' },
    { title: 'تتبّع حتى الصغير', body: 'القهوة اليومية بـ ٢٠ ريال = <b>٧٣٠٠ ريال سنوياً</b>. الأرقام الصغيرة تصنع الفرق الكبير.' },
    { title: 'اجعل أهدافك بصرية', body: 'اكتب أهدافك المالية في ورقة وعلّقها. <b>البصر أقوى من العقل</b> في تذكيرك بالهدف.' },
    { title: 'ميّز بين الحاجة والرغبة', body: 'قبل كل شراء اسأل: <b>هل أحتاج هذا فعلاً؟</b> ٨٠٪ من المشتريات الكمالية تُرمى خلال سنة.' },
    { title: 'استثمر في نفسك', body: 'أفضل استثمار هو تعلّم مهارة جديدة. الكتاب بـ ٥٠ ريال قد يضاعف دخلك!' },
    { title: 'راجع اشتراكاتك', body: 'كل ٣ أشهر، راجع اشتراكاتك الشهرية واحذف غير المستخدم. قد توفّر <b>٢٠٠+ ريال شهرياً</b>.' }
  ];

  const QUOTES = [
    { title: 'حكمة اليوم', body: '<b>"من ااحفظ ماله ااحفظ كرامته"</b><br>الإمام علي بن أبي طالب' },
    { title: 'حكمة اليوم', body: '<b>"الاقتصاد نصف المعيشة"</b><br>عمر بن الخطاب رضي الله عنه' },
    { title: 'حكمة اليوم', body: '<b>"ما عال من اقتصد"</b><br>حديث شريف - رواه أحمد' },
    { title: 'حكمة اليوم', body: '<b>"ليس الغِنى عن كثرة العَرَض، إنما الغنى غنى النفس"</b><br>حديث شريف - متفق عليه' },
    { title: 'حكمة اليوم', body: '<b>"إن الله يحب إذا عمل أحدكم عملاً أن يتقنه"</b><br>حديث شريف - الطبراني' },
    { title: 'حكمة اليوم', body: '<b>"القناعة كنز لا يفنى"</b><br>مثل عربي شهير' }
  ];

  const INSIGHTS = [
    { title: 'معلومة مالية', body: 'لو وفّرت <b>١٠ ريال يومياً</b> لمدة ٣٠ سنة (بفائدة ٥٪) = <b>٢٤٥,٠٠٠ ريال!</b> المال يصنع المال.' },
    { title: 'معلومة مالية', body: 'الشخص المتوسط يتخذ <b>٣٥,٠٠٠ قرار يومياً</b>. اجعل قراراتك المالية واعية - ليست تلقائية.' },
    { title: 'معلومة مالية', body: '<b>صندوق الطوارئ</b> المثالي = ٣-٦ أشهر من مصاريفك. يحميك من الديون عند المفاجآت.' },
    { title: 'معلومة مالية', body: 'الأثرياء يقرأون <b>متوسط ٥٢ كتاباً سنوياً</b>، بينما الفقراء يقرأون أقل من ٣. القراءة = ثروة.' },
    { title: 'معلومة مالية', body: 'كل <b>١٠٠ ريال</b> تنفقها على ترفيه غير ضروري = ساعة من راتبك الشهري (لو راتبك ١٥,٠٠٠).' }
  ];

  const CHALLENGES = [
    { title: 'تحدي اليوم 🎯', body: '<b>لا تشتري قهوة خارج البيت اليوم.</b> ستوفّر ٢٠ ريال تقريب. جمعها ٧ أيام = ١٤٠ ريال!' },
    { title: 'تحدي اليوم 🎯', body: '<b>اكتب ٣ أهداف مالية</b> تريد تحقيقها هذا العام. البدء بالكتابة يضاعف احتمالية النجاح ٤٢٪.' },
    { title: 'تحدي اليوم 🎯', body: '<b>راجع إيصالاتك اليوم.</b> كم بند ما كنت بحاجة له فعلاً؟ تعلّم من الماضي.' },
    { title: 'تحدي اليوم 🎯', body: '<b>لا تطلب طعاماً جاهزاً اليوم.</b> اطبخ أو كل من البيت. توفير ٥٠-٨٠ ريال بسهولة.' },
    { title: 'تحدي اليوم 🎯', body: '<b>ضع ٥٠ ريال جانباً الحين</b> لم تكن تنوي ادخارها. صندوق التحديات.' }
  ];

  // يعطي محتوى اليوم (ثابت لليوم نفسه)
  function getDaily() {
    const today = new Date().toISOString().slice(0, 10);
    const saved = Storage.load('fresh_today', null);
    if (saved && saved.date === today) return saved;

    // توليد محتوى جديد
    const allTypes = [
      { type: 'tip', icon: '💡', list: TIPS },
      { type: 'quote', icon: '📜', list: QUOTES },
      { type: 'insight', icon: '🔍', list: INSIGHTS },
      { type: 'challenge', icon: '🎯', list: CHALLENGES }
    ];

    // اختر نوع حسب اليوم
    const dayNum = Math.floor(new Date(today).getTime() / (1000 * 60 * 60 * 24));
    const typeIdx = dayNum % allTypes.length;
    const selectedType = allTypes[typeIdx];
    const item = selectedType.list[dayNum % selectedType.list.length];

    const result = {
      date: today,
      type: selectedType.type,
      icon: selectedType.icon,
      title: item.title,
      body: item.body,
      read: false,
      liked: false
    };
    Storage.save('fresh_today', result);
    return result;
  }

  function markRead() {
    const today = getDaily();
    if (!today.read) {
      today.read = true;
      Storage.save('fresh_today', today);
      try { Pts.add(5); } catch (e) { if (window.Logger) Logger.warn('FreshContent', e?.message); }
    }
  }

  function toggleLike() {
    const today = getDaily();
    today.liked = !today.liked;
    Storage.save('fresh_today', today);
    if (today.liked) {
      Toast.show('❤️ شكراً لملاحظاتك!', 'success');
      try { Pts.add(3); } catch (e) { if (window.Logger) Logger.warn('FreshContent', e?.message); }
    }
    render();
  }

  function share() {
    const today = getDaily();
    const text = `${today.title}\n\n${today.body.replace(/<[^>]+>/g, '')}\n\n— تـدّبير`;
    if (navigator.share) {
      navigator.share({ text, title: today.title }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        Toast.show('📋 تم النسخ!', 'success');
      }).catch(() => {});
    }
  }

  function formatDate() {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const now = new Date();
    return days[now.getDay()] + ' ' + now.getDate() + '/' + (now.getMonth() + 1);
  }

  function render() {
    const cont = $('#freshContentContainer');
    if (!cont) return;
    cont.innerHTML = '';

    const content = getDaily();
    if (!content) return;

    const card = DOM.h('div', { class: 'fresh-content-card' },
      DOM.h('div', { class: 'fresh-content-header' },
        DOM.h('span', { class: 'fresh-content-type-icon' }, content.icon),
        DOM.h('span', { class: 'fresh-content-badge' }, 'محتوى اليوم'),
        DOM.h('span', { class: 'fresh-content-date' }, formatDate())
      ),
      DOM.h('div', { class: 'fresh-content-title' }, content.title),
      DOM.h('div', {
        class: 'fresh-content-body',
        _html: content.body
      })
    );

    // Handle _html (innerHTML for body)
    const bodyDiv = card.querySelector('.fresh-content-body');
    if (bodyDiv) bodyDiv.innerHTML = content.body;

    const footer = DOM.h('div', { class: 'fresh-content-footer' },
      DOM.h('button', {
        class: 'fresh-action-btn' + (content.liked ? ' primary' : ''),
        onclick: toggleLike
      }, content.liked ? '❤️ أعجبني' : '🤍 أعجبني'),
      DOM.h('button', {
        class: 'fresh-action-btn',
        onclick: share
      }, '📤 مشاركة'),
      DOM.h('button', {
        class: 'fresh-action-btn' + (content.read ? ' primary' : ''),
        onclick: () => { markRead(); render(); }
      }, content.read ? '✓ تم' : '📖 قرأت')
    );

    card.appendChild(footer);
    cont.appendChild(card);
  }

  return { render, getDaily, markRead, toggleLike, share };
})();

window.FreshContent = FreshContent;
