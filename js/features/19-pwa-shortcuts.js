/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — PWA Shortcuts (اختصارات الشاشة الرئيسية)
   ───────────────────────────────────────────────────────────────────
   عند تثبيت التطبيق، المستخدم يرى shortcuts عند ضغطة طويلة على الأيقونة:
   - ➕ إضافة مصروف سريع
   - 📸 تصوير فاتورة
  
   - 📊 عرض السنة
   
   كذلك يدعم URL parameters للـ deep linking
═══════════════════════════════════════════════════════════════════ */

var PWAShortcuts = (() => {
  
  /**
   * يحدّث manifest.json بالـ shortcuts الجديدة
   * (لأن الـ manifest الحالي مدمج كـ data: URI، نولّد واحد جديد)
   */
  function buildManifest() {
    return {
      name: 'تـدّبير',
      short_name: 'تـدّبير',
      description: 'مخططك المالي الذكي',
      start_url: './',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#0a0a0a',
      theme_color: '#0a0a0a',
      lang: 'ar',
      dir: 'rtl',
      
      icons: [
        {
          src: buildIconDataURI(540, '#061a10', '#01dd8c'),
          sizes: '540x540',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }
      ],
      
      shortcuts: [
        {
          name: 'إضافة مصروف سريع',
          short_name: 'مصروف',
          description: 'سجّل مصروف بضغطة واحدة',
          url: './?action=quick-expense',
          icons: [{
            src: buildShortcutIcon('➕', '#ef4444'),
            sizes: '192x192',
            type: 'image/svg+xml'
          }]
        },
        {
          name: 'تصوير فاتورة',
          short_name: 'فاتورة',
          description: 'صوّر فاتورة وسجّلها تلقائياً',
          url: './?action=scan-bill',
          icons: [{
            src: buildShortcutIcon('📸', '#06b6d4'),
            sizes: '192x192',
            type: 'image/svg+xml'
          }]
        },
        {
          name: 'تقرير السنة',
          short_name: 'السنة',
          description: 'عرض السنة كاملة',
          url: './?tab=yearly',
          icons: [{
            src: buildShortcutIcon('📊', '#c9a84c'),
            sizes: '192x192',
            type: 'image/svg+xml'
          }]
        }
      ]
    };
  }
  
  function buildIconDataURI(size, bg, fg) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 540">
      <rect width="540" height="540" rx="108" fill="${bg}"/>
      <text x="270" y="350" font-size="220" text-anchor="middle" fill="${fg}">💰</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  
  function buildShortcutIcon(emoji, color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
      <rect width="192" height="192" rx="38" fill="${color}"/>
      <text x="96" y="130" font-size="100" text-anchor="middle">${emoji}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  
  /**
   * يبدّل الـ manifest الحالي بواحد جديد
   */
  function updateManifest() {
    const manifest = buildManifest();
    const json = JSON.stringify(manifest);
    const dataURI = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    
    // احذف الـ manifest الحالي
    const existing = document.querySelector('link[rel="manifest"]');
    if (existing) existing.remove();
    
    // أضف الجديد
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = dataURI;
    document.head.appendChild(link);
  }
  
  /**
   * معالجة action parameter من URL
   */
  function handleURLAction() {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    
    if (!action) return;
    
    // أزل الـ parameter من URL بدون reload
    const newUrl = location.pathname + location.hash;
    history.replaceState(null, '', newUrl);
    
    // تأخير قليل لضمان تحميل المكونات
    setTimeout(() => executeAction(action), 1000);
  }
  
  function executeAction(action) {
    switch (action) {
      case 'quick-expense':
        showQuickExpenseDialog();
        break;
      case 'scan-bill':
        if (window.BillScanner) {
          window.BillScanner.scanAndAdd();
        } else {
          window.Toast?.show?.('الميزة قيد التحميل...', 'warn');
        }
        break;
      case 'voice-input':
        if (window.VoiceInput) {
          window.VoiceInput.start();
        }
        break;
      default:
        window.Logger?.warn?.('PWAShortcuts', `Unknown action: ${action}`);
    }
  }
  
  /**
   * Quick expense dialog (بسيط بدون UI كاملة)
   */
  function showQuickExpenseDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'quick-expense-overlay';
    dialog.innerHTML = `
      <div class="quick-expense-modal">
        <h3>➕ إضافة مصروف سريع</h3>
        <input type="text" id="qeName" placeholder="الاسم (مثلاً: قهوة)" autofocus>
        <input type="number" id="qeAmt" placeholder="المبلغ" min="0" step="0.01">
        <input type="text" id="qeCat" placeholder="🍔" maxlength="4" value="➕">
        <div class="qe-actions">
          <button class="qe-cancel">إلغاء</button>
          <button class="qe-save">💾 حفظ</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const nameInput = dialog.querySelector('#qeName');
    const amtInput = dialog.querySelector('#qeAmt');
    const catInput = dialog.querySelector('#qeCat');
    
    // Auto-suggest category from name
    nameInput.addEventListener('input', () => {
      if (window.SmartCategorizer && nameInput.value.length > 2) {
        const suggested = window.SmartCategorizer.suggest(nameInput.value);
        if (suggested && suggested !== '➕') {
          catInput.value = suggested;
        }
      }
    });
    
    nameInput.focus();
    
    function save() {
      const name = nameInput.value.trim();
      const amt = parseFloat(amtInput.value);
      const cat = catInput.value.trim() || '➕';
      
      if (!name || !amt || amt <= 0) {
        window.Toast?.show?.('أكمل البيانات', 'warn');
        return;
      }
      
      try {
        window.App.Entries.addVariable({ name, amt, cat });
        window.Toast?.show?.(`✅ +${amt} ﷼ ${cat} ${name}`, 'success');
        window.SmartCategorizer?.learn(name, cat);
        window.Renderers?.scheduledAll?.();
        dialog.remove();
      } catch (e) {
        window.Toast?.show?.('فشل الحفظ', 'danger');
      }
    }
    
    dialog.querySelector('.qe-save').onclick = save;
    dialog.querySelector('.qe-cancel').onclick = () => dialog.remove();
    
    // Enter to save
    [nameInput, amtInput, catInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') dialog.remove();
      });
    });
  }
  
  /**
   * Init
   */
  function init() {
    updateManifest();
    handleURLAction();
  }
  
  return {
    init,
    updateManifest,
    handleURLAction,
    executeAction,
    showQuickExpenseDialog
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.PWAShortcuts = PWAShortcuts;
window.PWAShortcuts = PWAShortcuts;
