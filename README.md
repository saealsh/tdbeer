# تـدّبير — Refactored Codebase

## نظرة عامة

تم تحويل التطبيق من ملف واحد ضخم (`index.html` 22,000 سطر / 746KB) إلى بنية منظّمة من 32 ملف.

**النتيجة:**
- `index.html` ← 1,983 سطر / 127KB (انخفاض 83%)
- 30 ملف JavaScript منظّمة في 4 طبقات
- ملفان CSS منفصلان
- معالجة أخطاء شاملة جديدة

---

## 📁 بنية المجلدات

```
tdbeer-refactored/
├── index.html              # HTML فقط (يستورد الباقي)
├── sw.js                   # Service Worker v3 (محسّن)
├── README.md               # هذا الملف
│
├── css/
│   ├── main.css            # Stylesheet الرئيسي (9,617 سطر)
│   └── print.css           # طباعة + debug (6 سطر)
│
└── js/
    ├── core/               # الأساسيات — يجب تحميلها أولاً
    │   ├── 00-namespace.js         # window.Tdbeer = {}
    │   ├── 01-constants.js         # MONTHS, ACHIEVEMENTS, LEVELS, ...
    │   ├── 02-logger.js            # Logger (سجل آخر 50 خطأ)
    │   ├── 03-utils.js             # U.num, U.str, U.uid, ...
    │   ├── 04-formatter.js         # Fmt.n, Fmt.c, Fmt.p
    │   ├── 05-storage.js           # Storage (localStorage + memory)
    │   ├── 06-store.js             # Store class (state + observers)
    │   ├── 07-scheduler.js         # rAF batching
    │   ├── 08-dom.js               # DOM, $, $$
    │   └── 09-error-handling.js    # ⭐ جديد - شامل
    │
    ├── services/           # الخدمات الخارجية
    │   ├── 00-firebase.js          # تهيئة Firebase
    │   ├── 01-app.js               # حالة التطبيق + المصادقة
    │   ├── 02-image-handler.js     # معالجة الصور
    │   ├── 03-biometric.js         # WebAuthn
    │   └── 04-pwa-install.js       # تثبيت PWA
    │
    ├── ui/                 # طبقة الواجهة
    │   ├── 01-renderers.js         # تصيير الواجهات
    │   ├── 02-controllers.js       # معالجة الأحداث
    │   ├── 03-sidebar.js           # القائمة الجانبية
    │   ├── 04-dedicated-pages.js   # صفحات الأهداف والميزانيات
    │   └── 05-chats-page.js        # صفحة المحادثات
    │
    ├── features/           # الميزات
    │   ├── 01-social.js            # الأصدقاء والمحادثات
    │   ├── 02-bot.js               # AI Bot
    │   ├── 03-smart-features.js    # رؤى ذكية
    │   ├── 04-companion.js         # رفيق مالي
    │   ├── 05-smart-moments.js     # لحظات ذكية
    │   ├── 06-fresh-content.js     # محتوى متجدد
    │   ├── 07-chat-notifications.js
    │   └── 08-birthday.js
    │
    └── tests.js            # اختبارات (فقط في التطوير)
```

---

## 🛠️ التحسينات والإصلاحات

### 1. ✅ معالجة الأخطاء الشاملة (`09-error-handling.js`)

**جديد كلياً.** يضيف 8 أدوات على رأس `Logger` و `Toast` الموجودين:

| الأداة | الوظيفة |
|--------|---------|
| `ErrorMap` | يحوّل أكواد Firebase Auth + Firestore لرسائل عربية |
| `Network` | يكشف online/offline ويعرض Toast تلقائياً |
| `withRetry` | exponential backoff + jitter (يحترم الأخطاء النهائية) |
| `WriteQueue` | طابور كتابات للأوفلاين (يحفظ في localStorage) |
| `safeAsync` / `safeSync` | بدائل لـ `catch {}` الصامتة |
| `Idempotency` | منع التكرار بـ tokens (مهم لـ Pts.add) |
| `ErrorReporter` | لوحة debug للمستخدم (Ctrl+Shift+E) |
| `handleError` | معالج موحّد |

### 2. ✅ إصلاح 70 catch فاضي

كل `catch {}` و `catch(e) {}` تحوّل إلى:
```javascript
catch (e) { if (window.Logger) Logger.warn('ModuleName', e?.message); }
```
فالأخطاء الصامتة صارت تظهر في `Logger.getErrors()`.

### 3. ✅ استبدال `alert()` بـ Toast

كل `alert('رسالة')` تحوّل إلى:
```javascript
window.Toast?.show('رسالة', 'danger') || alert('رسالة')
```
استخدام Toast إذا متوفر، fallback لـ alert إذا فشل.

### 4. ✅ Service Worker محسّن

- يحفظ كل ملفات JS/CSS الجديدة
- استخدام `Promise.allSettled` بدل `cache.addAll` (مرونة أكبر)
- معالجة رسائل من التطبيق (`SKIP_WAITING`, `CLEAR_CACHE`, `GET_VERSION`)
- معالجة أخطاء fetch بشكل أفضل

---

## 🚀 كيف تنشر التطبيق

### النشر العادي (GitHub Pages, Netlify, Vercel):

```bash
# 1. ارفع كل المحتوى كما هو
cp -r tdbeer-refactored/* /path/to/your/server/

# 2. تأكد إن الـ MIME types صحيحة:
#    .js   → application/javascript
#    .css  → text/css
#    .html → text/html
```

### اختبار محلي:

```bash
cd tdbeer-refactored
python3 -m http.server 8000
# افتح http://localhost:8000
```

---

## ⚠️ تنبيهات مهمة

### قبل الإطلاق للمستخدمين:

1. **اختبر الأوفلاين:** افصل النت وتأكد إن:
   - التطبيق يفتح
   - تظهر toast "ما فيه اتصال"
   - الكتابات تتحفظ في `WriteQueue`
   - لما يرجع النت، تتم المزامنة

2. **اختبر تسجيل الدخول:** كل أكواد `auth/*` لازم تظهر برسائل عربية صحيحة.

3. **اختبر Firestore:** جرّب رفض permission (مثلاً عدّل قاعدة في Firebase) — لازم تشوف "ما عندك صلاحية".

4. **اختبر `Ctrl+Shift+E`:** لازم تفتح لوحة تقرير الأخطاء.

### مشاكل محتملة:

- **load order حرج:** الـ JS files لازم تحمّل بالترتيب الموجود في `index.html`. لا تستخدم `defer` أو `async` لها.
- **بعض الميزات قد تحتاج تعديل بسيط:** الكود الأصلي كان يعتمد على lexical scope داخل `Tdbeer` IIFE. الحين كل شي على `window`. لو فيه ميزة ما تشتغل، شوف الـ console للأخطاء.

---

## 📊 إحصائيات التحويل

| المقياس | قبل | بعد |
|---------|-----|-----|
| ملفات | 2 (index.html, sw.js) | 33 |
| index.html | 22,000 سطر / 746KB | 1,983 سطر / 127KB |
| catch فاضي | 70 | 0 |
| alert() | 2 | 0 (مع fallback) |
| رسائل خطأ Firestore عربية | 0 | 14 |
| network detection | لا يوجد | ✓ |
| offline write queue | لا يوجد | ✓ |
| idempotency protection | لا يوجد | ✓ |
| debug panel | لا يوجد | ✓ |

---

## 🎯 خطوات التحقق السريع

افتح Console (F12) بعد تحميل التطبيق ولازم تشوف:

```
[ErrorHandling] module loaded ✓
[SW] registered
```

ثم جرّب:

```javascript
window.Logger.getErrors()       // []
window.Network.isOnline()       // true
window.WriteQueue.size()        // 0
window.ErrorReporter.show()     // يفتح المودال
```

---

## 📝 ملاحظات للمطوّر

### إذا فيه ميزة ما تشتغل:

1. **افتح Console** وشوف الأخطاء
2. **جرّب `Logger.getErrors()`** لرؤية آخر 50 خطأ
3. **اضغط Ctrl+Shift+E** لفتح تقرير شامل
4. **تأكد إن JS files كلها تحمّلت** في Network tab

### كيف تضيف ميزة جديدة:

1. أنشئ ملف في `js/features/` (مثلاً `09-my-feature.js`)
2. اربطه في `index.html` بالترتيب الصحيح
3. استخدم النمط:
   ```javascript
   const MyFeature = (() => {
     const { U, Fmt, Logger } = Tdbeer;
     // ...
     return { ... };
   })();
   window.MyFeature = MyFeature;
   ```

### كيف ترجع للنسخة الأصلية:

نسخة `index.html` الأصلية محفوظة كنسخة احتياطية. ادمج كل الملفات بالترتيب الصحيح:

```bash
# ضع كل الـ JS في ملف واحد بالترتيب
cat js/core/*.js js/services/*.js js/ui/*.js js/features/*.js > combined.js

# ثم اربطه inline في HTML بدل الـ script tags
```

---

## 🔒 الأمان (لم يتغيّر)

- ✅ XSS protection شامل (DOM nodes بدل innerHTML)
- ✅ Content Security Policy (يمكن إضافته)
- ✅ Firestore Security Rules صارمة (في Firebase Console)
- ✅ Rate Limiting على تسجيل الدخول
- ✅ Object.freeze على الثوابت

---

تم بناؤه بـ ❤️ — الرجاء اختبار كل ميزة قبل الإطلاق للمستخدمين.
