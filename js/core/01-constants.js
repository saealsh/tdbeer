/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Constants
   ───────────────────────────────────────────────────────────────────
   Originally lines 11623–11654 of index.html
═══════════════════════════════════════════════════════════════════ */

var MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
var DAY_NAMES = ['أح','إث','ثل','أر','خم','جم','سب'];
var TIPS = [
  'قاعدة ٥٠/٣٠/٢٠: احتياجات، رغبات، ادخار 💡',
  'وفّر صندوق طوارئ بـ ١٠٠٠ ﷼ أولاً 🆘',
  'ألغِ الاشتراكات غير المستخدمة 📺',
  'اكتب قائمة قبل التسوق — توفر ٢٠٪ 🛒',
  'أول الراتب: حوّل للتوفير فوراً 🏦',
  'قبل أي شراء: احتاجه أو بس خاطري؟ 🤔',
  'استثمر في نفسك — كورس أو كتاب 📚',
  'وفّر أولاً ثم أنفق — مو العكس 💰'
];
var ACHIEVEMENTS = [
  {id:'first_save', icon:'🌱', name:'أول توفير', pts:50},
  {id:'no_exceed', icon:'🛡️', name:'ما تجاوزت', pts:100},
  {id:'save_20', icon:'💎', name:'وفّرت ٢٠٪', pts:200},
  {id:'daily_log', icon:'📅', name:'تسجيل يومي', pts:75},
  {id:'goal_done', icon:'🏆', name:'حققت هدف', pts:300},
  {id:'three_months', icon:'🔥', name:'٣ شهور', pts:500}
];
var LEVELS = [
  {min:0, name:'مبتدئ 🌱'},
  {min:100, name:'ذكي 💡'},
  {min:300, name:'محترف 💼'},
  {min:700, name:'خبير 🏆'},
  {min:1500, name:'ماهر 💎'},
  {min:3000, name:'أسطورة ⭐'}
];
var PIE_COLORS = ['#c9a84c','#10b981','#3b82f6','#ef4444','#8b5cf6','#f97316','#06b6d4','#84cc16','#ec4899','#14b8a6'];
var STORAGE_VERSION = 2;

// Freeze for safety (original code did this)
[MONTHS, DAY_NAMES, TIPS, ACHIEVEMENTS, LEVELS, PIE_COLORS].forEach(Object.freeze);

// Expose to namespace
Object.assign(window.Tdbeer, {
  MONTHS, DAY_NAMES, TIPS, ACHIEVEMENTS, LEVELS, PIE_COLORS,
  STORAGE_VERSION
});
