/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Smart Auto-Categorization
   ───────────────────────────────────────────────────────────────────
   تصنيف تلقائي للمصاريف بناءً على الاسم.
   يستخدم نفس قاموس SMART_CATEGORIES من Budgets.calcSpent
   لكن في الاتجاه المعاكس: name → emoji.
═══════════════════════════════════════════════════════════════════ */

var SmartCategorizer = (() => {
  // قاموس موسّع: الـ emoji → keywords
  const CATEGORIES = {
    '🍔': ['أكل','طعام','مطعم','مطاعم','غدا','غداء','عشا','عشاء','فطور','وجبة',
           'برجر','بيتزا','شاورما','دجاج','كبسة','مندي','ساندوتش','بروست',
           'كنتاكي','ماك','ماكدونالدز','هرفي','كودو','البيك','الطازج','شاورمر',
           'سوشي','ايطالي','هندي','تايلندي','صيني','jollibee','steak','burger',
           'pizza','grill','مشاوي','مشوي','فروج','معكرونة'],
    
    '☕': ['قهوة','كوفي','ستاربكس','شاي','مشروب','مشروبات','كافيه','كابتشينو',
           'لاتيه','اسبريسو','موكا','dunkin','tim hortons','barns','بارنز',
           'دانكن','تيم هورتنز','نسكافيه','كرك','ليمون','عصير','مشروبات غازية',
           'بيبسي','كوكا','ميرندا','سفن','7up','redbull','رد بل'],
    
    '🚗': ['مواصلات','بنزين','وقود','سيارة','تكسي','أوبر','كريم','نقل',
           'uber','careem','indrive','jeeny','تأمين سيارة','صيانة','ورشة',
           'غسيل','زيت','tires','إطارات','كفرات','ديزل','شركة الوقود',
           'aramco','aldrees','الدريس','محطة','محطات'],
    
    '🛒': ['تسوق','شراء','سوبرماركت','بقالة','ماركت','هايبر','كارفور','دانوب',
           'بنده','tamimi','التميمي','othaim','العثيم','منتجات','نستو','lulu',
           'لولو','هايبر بنده','كروز','crouz','spinneys','سبينيس','بضاعة'],
    
    '👕': ['ملابس','زارا','ايتش اند ام','h&m','zara','ستراديفاريوس','adidas',
           'أديداس','نايك','nike','بوما','puma','حذاء','فستان','ثوب','شماغ',
           'بنطلون','قميص','جزمة','حقيبة','شنطة','عطر','ساعة','نظارة',
           'sephora','سيفورا','centerpoint','سنتربوينت'],
    
    '🎬': ['ترفيه','سينما','فيلم','مسرح','ألعاب','بلايستيشن','نادي','رحلة',
           'تذكرة','tickets','vox','ايماكس','muvi','موفي','playstation',
           'xbox','switch','steam','epic','netflix','نتفلكس','shahid','شاهد',
           'osn','disney','starz','اشتراك','subscription','spotify','apple music',
           'youtube premium','anghami','أنغامي'],
    
    '🏠': ['بيت','إيجار','ايجار','سكن','كهرباء','ماء','إنترنت','انترنت','صيانة',
           'سيك','sec','ماء وطني','ntwc','furniture','أثاث','ikea','ايكيا',
           'سرير','مكيف','ثلاجة','غسالة','أدوات منزلية','dyson','مكنسة',
           'فرن','جوال','جواله','جوالات','هوم سنتر','home center'],
    
    '📱': ['جوال','اتصالات','stc','موبايلي','زين','virgin','فيرجن','salam','سلام',
           'فاتورة','فواتير','نت','شريحة','رصيد','شحن','recharge','قوقل',
           'google','icloud','dropbox','onedrive','استضافة','hosting','domain',
           'iphone','samsung','xiaomi','شاومي','هواوي','huawei'],
    
    '💊': ['دواء','صيدلية','مستشفى','طبيب','عيادة','صحة','dr.','د.','الحبيب',
           'الموسى','المغربي','عبداللطيف','sehhaty','التأمين الطبي','بوبا',
           'tawuniya','medgulf','ميد قلف','نهدي','الدواء','الدوسري','اشاعة',
           'تحاليل','مختبر','أشعة','عملية','كشف'],
    
    '🎁': ['هدية','هدايا','عيدية','مناسبة','عرس','زواج','مولود','تخرج','عيد',
           'عيد الفطر','عيد الأضحى','رمضان','مناسبات','baby shower','بيبي شاور'],
    
    '📚': ['كتاب','كتب','مكتبة','جرير','جامعة','مدرسة','رسوم','كورس','course',
           'دورة','تدريب','udemy','coursera','udacity','يوديمي','training',
           'workshop','ورشة','شهادة','certificate','اختبار','test','imam',
           'kfupm','ksu'],
    
    '✈️': ['سفر','طيران','رحلة','تذكرة طيران','فندق','hotel','booking','airbnb',
           'الخطوط السعودية','flynas','flyadeal','اديل','ناس','almosafer','المسافر',
           'wego','expedia','agoda','اقامة','شنق','تأشيرة','visa','جواز','passport'],
    
    '💪': ['نادي','جيم','gym','رياضة','fitness','protein','بروتين','مكملات',
           'supplements','ورد','workout','crossfit','كروسفت','يوغا','yoga',
           'بيلاتس','pilates','بادل','padel','تنس','سباحة'],
    
    '👶': ['طفل','أطفال','حفاضات','حليب','رضاعة','لعبة','لعب','toys','مدرسة',
           'حضانة','daycare','بيبي','baby','مولود','منى','منوة','panda kids'],
    
    '💰': ['دخل','راتب','salary','مكافأة','bonus','عمولة','commission','استثمار',
           'investment','أرباح','profit','إيداع','deposit','حوالة','transfer',
           'تحويل','استرداد','refund','dividend'],
    
    '➕': [] // افتراضي
  };
  
  // Build reverse index for fast lookup
  const KEYWORD_TO_EMOJI = new Map();
  for (const [emoji, keywords] of Object.entries(CATEGORIES)) {
    for (const kw of keywords) {
      KEYWORD_TO_EMOJI.set(kw.toLowerCase(), emoji);
    }
  }
  
  /**
   * يحلل اسم البند ويرجع emoji مناسب.
   * @param {string} name - اسم البند (مثلاً "ستاربكس" أو "بنزين")
   * @returns {string} emoji - الإيموجي المقترح، أو ➕ إذا لا تطابق
   */
  function suggest(name) {
    if (!name || typeof name !== 'string') return '➕';
    const lower = name.toLowerCase().trim();
    
    // 1) تطابق مباشر
    if (KEYWORD_TO_EMOJI.has(lower)) {
      return KEYWORD_TO_EMOJI.get(lower);
    }
    
    // 2) substring match - الاسم يحتوي على keyword
    for (const [keyword, emoji] of KEYWORD_TO_EMOJI) {
      if (keyword.length > 2 && lower.includes(keyword)) {
        return emoji;
      }
    }
    
    // 3) reverse - keyword يحتوي على الاسم (للأسماء القصيرة)
    if (lower.length >= 3) {
      for (const [keyword, emoji] of KEYWORD_TO_EMOJI) {
        if (keyword.includes(lower)) {
          return emoji;
        }
      }
    }
    
    return '➕';
  }
  
  /**
   * يقترح عدة احتمالات (للـ UI: عرض اقتراحات للمستخدم)
   */
  function suggestMultiple(name, max = 3) {
    if (!name) return [];
    const lower = name.toLowerCase().trim();
    const matches = new Map(); // emoji → score
    
    for (const [emoji, keywords] of Object.entries(CATEGORIES)) {
      let score = 0;
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase();
        if (kwLower === lower) score += 100;
        else if (lower.includes(kwLower) && kwLower.length > 2) score += 50;
        else if (kwLower.includes(lower) && lower.length > 2) score += 30;
      }
      if (score > 0) matches.set(emoji, score);
    }
    
    return [...matches.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([emoji]) => emoji);
  }
  
  /**
   * يتعلم من اختيارات المستخدم (placeholder للتعلم المستقبلي)
   */
  function learn(name, chosenEmoji) {
    if (!name || !chosenEmoji || chosenEmoji === '➕') return;
    try {
      const learnings = window.Storage?.load('smartCatLearnings', {}) || {};
      const key = name.toLowerCase().trim();
      learnings[key] = chosenEmoji;
      // حد أقصى 200 entry
      const keys = Object.keys(learnings);
      if (keys.length > 200) {
        const toRemove = keys.slice(0, keys.length - 200);
        toRemove.forEach(k => delete learnings[k]);
      }
      window.Storage?.save('smartCatLearnings', learnings);
    } catch (e) {
      window.Logger?.warn?.('SmartCategorizer.learn', e?.message);
    }
  }
  
  /**
   * يرجع suggestion مع تفضيل للتعلم السابق
   */
  function suggestWithLearning(name) {
    if (!name) return '➕';
    try {
      const learnings = window.Storage?.load('smartCatLearnings', {}) || {};
      const key = name.toLowerCase().trim();
      if (learnings[key]) return learnings[key];
    } catch {}
    return suggest(name);
  }
  
  return {
    suggest,
    suggestMultiple,
    suggestWithLearning,
    learn,
    CATEGORIES: Object.keys(CATEGORIES)
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.SmartCategorizer = SmartCategorizer;
window.SmartCategorizer = SmartCategorizer;
