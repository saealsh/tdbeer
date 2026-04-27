# 🎁 تـدّبير v2.0 — 12 ميزة جديدة

## ✨ ما الجديد في هذه النسخة؟

أُضيفت **12 ميزة قوية** جديدة لتعزيز تجربة المستخدم وتوسيع وظائف التطبيق.

---

## 📋 قائمة الميزات الجديدة

### 1. 🔍 ماسح الفواتير (OCR Bill Scanner)
**الموقع:** زر "📸 مسح فاتورة" في الـ Home tab

**كيف يعمل:**
- اضغط الزر → افتح الكاميرا أو اختر صورة
- التطبيق يقرأ المبلغ والتاريخ واسم المتجر تلقائياً
- يقترح فئة مناسبة من Smart Categorizer
- مراجعة + تأكيد → يُحفظ في المصاريف

**الملف:** `js/features/13-bill-scanner.js`

**ملاحظة:** يحمّل Tesseract.js من CDN عند أول استخدام (~10MB، يبقى مكاش بعدها).

---

### 2. 📅 التقويم البصري (Visual Calendar)
**الموقع:** Card تحت Home tab

**كيف يعمل:**
- يعرض الشهر كـ grid ملوّن
- 🟢 أخضر = بدون مصاريف | 🟠 برتقالي = متوسط | 🔴 أحمر = مرتفع
- اضغط أي يوم لرؤية تفاصيله
- نقطة خضراء = يوم فيه دخل
- إحصائيات أسفل الـ grid

**الملف:** `js/features/15-visual-calendar.js`

---

### 3. 🎯 التحديات (Budget Challenges)
**الموقع:** زر "🎯 التحديات" في الـ Home tab

**التحديات المتوفرة:**
- ☕ أسبوع بدون قهوة بره (+100 نقطة)
- 🍔 أسبوع بدون طلبات (+200)
- ☕ شهر بدون قهوة بره (+500)
- 💰 وفّر 10% من الراتب (+300)
- 💎 وفّر 20% من الراتب (+600)
- 🌱 3 أيام بدون صرف (+100)
- 🎯 سيد الميزانية (+400)

**الملف:** `js/features/16-budget-challenges.js`

---

### 4. 🏦 محاكي القرض (Loan Simulator)
**الموقع:** زر "🏦 محاكي قرض" في الـ Home tab

**يحسب:**
- القسط الشهري
- إجمالي الفوائد
- النسبة السنوية البسيطة
- تأثيره على ميزانيتك الحالية
- اقتراح آمن (لا يتجاوز 30% من الدخل)

**الملف:** `js/features/12-loan-simulator.js`

---

### 5. 🤲 حاسبة الزكاة
**الموقع:** زر "🤲 الزكاة" في الـ Home tab

**يحسب زكاة:**
- المال (نقد + مدخرات + قروض - ديون)
- الذهب (≥ 85 جرام)
- الفضة (≥ 595 جرام)
- عروض التجارة

**ميزات إضافية:**
- تتبّع الحول (354 يوم هجري)
- سجل إخراج الزكاة
- نصاب محدّث بسعر الذهب

**الملف:** `js/features/11-zakat-calculator.js`

---

### 6. 🎉 التقرير السنوي (Year Wrapped)
**الموقع:** زر "🎉 السنة كاملة" في الـ Home tab

**يعرض (Spotify-style):**
- إجمالي الإنفاق والتوفير
- أعلى فئة إنفاق
- أعلى يوم
- أعلى يوم في الأسبوع
- أيام بدون صرف
- إنجازاتك ونقاطك
- زر "شارك" للنشر على وسائل التواصل

**الملف:** `js/features/17-year-wrapped.js`

---

### 7. 🤖 Smart Categorization (تصنيف ذكي)
**يعمل تلقائياً في الخلفية**

**كيف يعمل:**
- يحلّل اسم البند ويقترح Emoji
- يتعلّم من اختياراتك السابقة
- 200+ keyword عربي + إنجليزي
- 16 فئة (طعام، قهوة، مواصلات، إلخ)

**الاستخدام:** 
```javascript
SmartCategorizer.suggest('ستاربكس'); // → '☕'
SmartCategorizer.suggest('بنزين');   // → '🚗'
```

**الملف:** `js/features/09-smart-categorizer.js`

---

### 8. ⚡ Quick Actions
**الموقع:** Card في الـ Home tab تحت Quick Stats

**كيف يعمل:**
- 4-6 أزرار سريعة لإضافة المصاريف الشائعة
- يتعلّم من عاداتك (آخر 3 أشهر)
- ضغطة واحدة → سُجِّل المصروف
- ضغطة طويلة → تعديل المبلغ

**الملف:** `js/features/10-quick-actions.js`

---

### 9. 🌗 ثيمات إضافية (Extra Themes)
**الموقع:** Settings → Themes Card

**الثيمات الجديدة:**
- 🏝️ **Tropical** - أخضر مائل لأزرق
- 🌅 **Sunset** - برتقالي + بنفسجي
- ⚫ **OLED** - أسود نقي (يوفّر بطارية الجوال OLED)
- 🎨 **Custom** - اختر لون accent مخصص

**الملف:** `js/features/18-extra-themes.js`

---

### 10. 📱 PWA Shortcuts
**يعمل تلقائياً عند تثبيت التطبيق**

**عند الضغط الطويل على أيقونة التطبيق على الشاشة الرئيسية:**
- ➕ إضافة مصروف سريع
- 📸 تصوير فاتورة
- 🤲 احسب الزكاة
- 📊 عرض السنة

**يدعم URL parameters:**
- `?action=quick-expense`
- `?action=scan-bill`
- `?action=zakat`

**الملف:** `js/features/19-pwa-shortcuts.js`

---

### 11. 📤 Advanced Export
**الموقع:** Settings → Export

**ميزات جديدة:**
- 💾 **JSON Backup** - نسخة احتياطية كاملة (data + settings)
- 📥 **JSON Restore** - استرجاع من ملف
- 📅 **Year CSV Export** - السنة كاملة في ملف واحد
- 📧 **Email Summary** - يفتح mail client مع تقرير جاهز

**الملف:** `js/features/17-year-wrapped.js` (في `AdvancedExport`)

---

### 12. 🔔 Smart Notifications
**يعمل تلقائياً في الخلفية**

**أنواع التنبيهات:**
- ⚠️ صرف اليوم مرتفع (ضعف المتوسط)
- 🚨 ميزانية فئة قاربت على النفاد (≥80%)
- 🍔 تحذير الجمعة المساء (أنماط الطلبات)
- 💰 قرب يوم الراتب
- 🔔 فواتير عاجلة
- 🌱 يوم بدون صرف!
- 🤲 وقت الزكاة (مرّ الحول)
- 🔥 تذكير السلسلة

**ذكي:** 6 ساعات cooldown بين تنبيهات نفس النوع

**الملف:** `js/features/14-smart-notifs.js`

---

## 🎁 ميزة إضافية: Voice Input (#16)

كنا لا نخطط لها لكن أضفناها كـ bonus!

**الموقع:** زر "🎤 إدخال صوتي" في الـ Home tab

**كيف يعمل:**
- اضغط الزر → "تكلّم الآن"
- قل: "صرفت ٤٠ ريال على القهوة"
- التطبيق يستخرج المبلغ والاسم ويحفظ
- يستخدم Web Speech API (مجاني، لا يحتاج تنزيل)

**موجود في:** `js/features/20-features-ui.js`

---

## 🔧 ملاحظات تقنية

### Lazy Loading
- **Tesseract.js** (لـ Bill Scanner) يُحمّل فقط عند أول استخدام
- لا تأثير على سرعة التحميل الأولية

### Storage Keys جديدة
- `td_smartCatLearnings` — تعلّم Smart Categorizer
- `td_quickActionsCustom` — Quick Actions مخصصة
- `td_zakatHawlStart` — بداية الحول
- `td_zakatHistory` — سجل الزكاة
- `td_activeChallenges` — التحديات النشطة
- `td_challengesHistory` — سجل التحديات
- `td_smartNotifsLastShown` — cooldown التنبيهات
- `td_customAccentColor` — لون مخصص

### Service Worker
- نسخة جديدة: **3.3.0**
- 12 ملف feature جديد + 1 CSS مكاش
- يبدّل تلقائياً عند التحديث

### بنية الكود
- كل ميزة = IIFE module مستقل
- نفس النمط: `window.Tdbeer.X = X; window.X = X`
- لا dependencies خارجية (عدا Tesseract LAZY)

---

## 🚀 تثبيت

نفس طريقة التثبيت السابقة:

```bash
# 1. نسخة احتياطية
mv tdbeer-main tdbeer-main-OLD-backup

# 2. فك ضغط tdbeer-features.zip
unzip tdbeer-features.zip

# 3. ضع المجلد الجديد
# (يحتوي على كل الميزات + التحسينات السابقة)
```

---

## 🧪 اختبار سريع

```javascript
// في Console بعد تحميل التطبيق:

// 1. Smart Categorizer
SmartCategorizer.suggest('ستاربكس');  // → '☕'

// 2. Zakat
ZakatCalculator.calculateMoney({ cash: 50000 });

// 3. Loan
LoanSimulator.analyze({ principal: 100000, annualRate: 0.05, months: 60 });

// 4. Year Wrapped
YearWrapped.show(2026);

// 5. Smart Notifs
SmartNotifs.getCurrentInsight();

// 6. Voice
VoiceInput.start(); // اختبر بالميكروفون

// 7. Bill Scanner
BillScanner.scanAndAdd();

// 8. Calendar refresh
VisualCalendar.render();

// 9. Quick Actions
QuickActions.computeSmartActions();

// 10. Challenges
BudgetChallenges.getAvailable();
BudgetChallenges.start('no-coffee-week');

// 11. Themes
ExtraThemes.apply('oled');

// 12. Backup
AdvancedExport.exportJSON();
```

---

## 📊 إحصائيات الإصدار

| البند | قبل | بعد |
|---|---|---|
| ملفات JS | 32 | **45** |
| ملفات CSS | 2 | **3** |
| الميزات الكبرى | ~10 | **22** |
| إجمالي SLOC | ~24,000 | **~28,000** |
| Cache assets | 38 | **51** |

---

## 🎯 الخطوات القادمة المقترحة

1. **اختبار شامل** على Mobile + Desktop
2. **Translation** - دعم لغات أخرى
3. **Family Mode** - حسابات عائلية مشتركة
4. **Bank API** - ربط مع البنوك السعودية
5. **AI Insights** - تحسين Bot الموجود

---

🎉 **مبروك! التطبيق الآن في إصدار 2.0**
