/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — FAB Bottom Sheet Controller
   ───────────────────────────────────────────────────────────────────
   يربط زر "+" في Bottom Nav بالـ Bottom Sheet
   ويتعامل مع كل actions (manual, voice, scan-bill, manual-income)
═══════════════════════════════════════════════════════════════════ */

var FabController = (() => {
  
  function open() {
    const overlay = document.getElementById('fabSheetOverlay');
    if (!overlay) return;
    overlay.classList.add('show');
    try { navigator.vibrate?.(10); } catch {}
  }
  
  function close() {
    const overlay = document.getElementById('fabSheetOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
  }
  
  function handleAction(action) {
    close();
    
    setTimeout(() => {
      switch (action) {
        case 'manual-expense':
          openManualEntry('out');
          break;
        case 'manual-income':
          openManualEntry('in');
          break;
        case 'scan-bill':
          if (window.BillScanner) {
            window.BillScanner.scanAndAdd();
          } else {
            window.Toast?.show?.('الميزة قيد التحميل...', 'warn');
          }
          break;
        case 'voice-input':
          // استخدم الـ Voice الموجود في التطبيق الأصلي
          const voiceBtn = document.getElementById('btnOpenVoice');
          if (voiceBtn) {
            voiceBtn.click();
          } else {
            window.Toast?.show?.('ميزة الإدخال الصوتي غير متاحة', 'warn');
          }
          break;
      }
    }, 250);
  }
  
  /**
   * Modal احترافي لإدخال يدوي مع dropdowns + visual feedback
   */
  function openManualEntry(type = 'out') {
    const isIncome = type === 'in';
    
    // Categories الجاهزة
    const expenseCats = [
      { e: '🍔', n: 'طعام' },
      { e: '☕', n: 'قهوة' },
      { e: '⛽', n: 'بنزين' },
      { e: '🛒', n: 'سوبرماركت' },
      { e: '🛍️', n: 'تسوق' },
      { e: '🚗', n: 'مواصلات' },
      { e: '🏥', n: 'صحة' },
      { e: '📚', n: 'تعليم' },
      { e: '🎬', n: 'ترفيه' },
      { e: '💊', n: 'دواء' },
      { e: '👕', n: 'ملابس' },
      { e: '📱', n: 'اتصالات' },
      { e: '💡', n: 'فواتير' },
      { e: '🎁', n: 'هدايا' },
      { e: '➕', n: 'أخرى' }
    ];
    const incomeCats = [
      { e: '💵', n: 'راتب' },
      { e: '💰', n: 'مكافأة' },
      { e: '🎁', n: 'هدية' },
      { e: '💼', n: 'عمل إضافي' },
      { e: '📈', n: 'استثمار' },
      { e: '🏦', n: 'استرداد' },
      { e: '➕', n: 'أخرى' }
    ];
    const cats = isIncome ? incomeCats : expenseCats;
    
    const dialog = document.createElement('div');
    dialog.className = 'quick-expense-overlay manual-entry-overlay';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', isIncome ? 'إضافة دخل' : 'إضافة مصروف');
    
    dialog.innerHTML = `
      <div class="quick-expense-modal manual-entry-modal">
        <div class="me-header">
          <h3>${isIncome ? '💵 إضافة دخل جديد' : '✏️ إضافة مصروف'}</h3>
          <button class="me-close" aria-label="إغلاق">✕</button>
        </div>
        
        <div class="me-body">
          <!-- اسم الإدخال -->
          <div class="me-field">
            <label class="me-label" for="meName">
              ${isIncome ? 'مصدر الدخل' : 'الاسم'}
              <span class="me-required" aria-label="مطلوب">*</span>
            </label>
            <input type="text" id="meName" class="me-input"
              placeholder="${isIncome ? 'مثل: راتب الشهر' : 'مثل: قهوة من ستاربكس'}"
              autocomplete="off" maxlength="60">
            <div class="me-hint" id="meNameHint"></div>
          </div>
          
          <!-- المبلغ -->
          <div class="me-field">
            <label class="me-label" for="meAmt">
              المبلغ (ريال)
              <span class="me-required" aria-label="مطلوب">*</span>
            </label>
            <div class="me-input-wrapper">
              <input type="number" id="meAmt" class="me-input"
                placeholder="0.00" min="0" step="0.01" inputmode="decimal">
              <span class="me-input-suffix">﷼</span>
            </div>
          </div>
          
          <!-- الفئة - Grid Selector -->
          <div class="me-field">
            <label class="me-label">
              ${isIncome ? 'النوع' : 'الفئة'}
              <span class="me-hint-inline">(اختر اللي يناسبك)</span>
            </label>
            <div class="me-cat-grid">
              ${cats.map((c, i) => `
                <button type="button" class="me-cat-btn ${i === 0 ? 'active' : ''}"
                  data-cat="${c.e}" data-name="${c.n}" aria-label="${c.n}">
                  <span class="me-cat-emoji">${c.e}</span>
                  <span class="me-cat-name">${c.n}</span>
                </button>
              `).join('')}
            </div>
          </div>
          
          ${!isIncome ? `
          <!-- خيار: تكرار الإدخال (متغيّر/ثابت) -->
          <div class="me-field me-toggle-field">
            <label class="me-toggle-label">
              <input type="checkbox" id="meIsFixed" class="me-checkbox">
              <span class="me-toggle-slider"></span>
              <span class="me-toggle-text">
                <strong>مصروف ثابت متكرر</strong>
                <small>(زي الإيجار، الاشتراكات، إلخ)</small>
              </span>
            </label>
          </div>
          ` : ''}
        </div>
        
        <div class="me-footer">
          <button class="me-btn me-btn-cancel">إلغاء</button>
          <button class="me-btn me-btn-save" disabled>
            <span class="me-btn-icon">💾</span>
            <span>حفظ</span>
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const nameInput = dialog.querySelector('#meName');
    const amtInput = dialog.querySelector('#meAmt');
    const nameHint = dialog.querySelector('#meNameHint');
    const isFixedCb = dialog.querySelector('#meIsFixed');
    const saveBtn = dialog.querySelector('.me-btn-save');
    const closeBtn = dialog.querySelector('.me-close');
    const cancelBtn = dialog.querySelector('.me-btn-cancel');
    let selectedCat = cats[0].e;
    
    // ─── Cat selection ───
    dialog.querySelectorAll('.me-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        dialog.querySelectorAll('.me-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCat = btn.dataset.cat;
        validate();
      });
    });
    
    // ─── Smart category suggestion ───
    nameInput.addEventListener('input', () => {
      if (!isIncome && window.SmartCategorizer && nameInput.value.length > 2) {
        const suggested = window.SmartCategorizer.suggest(nameInput.value);
        if (suggested && suggested !== '➕' && suggested !== selectedCat) {
          // ابحث عن الزر اللي يطابق
          const match = dialog.querySelector(`.me-cat-btn[data-cat="${suggested}"]`);
          if (match) {
            // اقترح بصرياً
            nameHint.textContent = `💡 اقتراح: ${match.dataset.name} ${suggested}`;
            nameHint.classList.add('show');
            
            match.classList.add('suggested');
            // اختر تلقائياً بعد ثانية لو ما اختار شي
            setTimeout(() => {
              if (selectedCat === cats[0].e) {
                match.click();
                nameHint.textContent = `✅ تم اختيار ${match.dataset.name} تلقائياً`;
              }
            }, 1500);
          }
        }
      }
      validate();
    });
    
    // ─── Validation ───
    function validate() {
      const name = nameInput.value.trim();
      const amt = parseFloat(amtInput.value);
      const valid = name.length >= 1 && !isNaN(amt) && amt > 0;
      saveBtn.disabled = !valid;
    }
    amtInput.addEventListener('input', validate);
    
    // ─── Save ───
    function save() {
      const name = nameInput.value.trim();
      const amt = parseFloat(amtInput.value);
      const cat = selectedCat;
      const isFixed = isFixedCb?.checked || false;
      
      if (!name || !amt || amt <= 0) {
        window.Toast?.show?.('أكمل البيانات', 'warn');
        return;
      }
      
      saveBtn.disabled = true;
      saveBtn.querySelector('span:last-child').textContent = 'جاري الحفظ...';
      
      try {
        if (isIncome) {
          const today = new Date();
          const day = today.getDate();
          const data = window.App.store.get('data') || {};
          const year = window.App.store.get('year');
          const month = window.App.store.get('month');
          const monthKey = `${year}_m${month}`;
          
          if (!data[monthKey]) data[monthKey] = {};
          if (!data[monthKey].daily) data[monthKey].daily = {};
          if (!data[monthKey].daily[day]) data[monthKey].daily[day] = [];
          
          data[monthKey].daily[day].push({
            id: window.Tdbeer?.U?.uid?.() || `e_${Date.now()}`,
            name, amt, cat,
            type: 'in'
          });
          
          window.App.store.set('data', data);
          window.Toast?.show?.(`✅ تم إضافة الدخل: ${cat} ${name} (+${amt} ﷼)`, 'success');
        } else if (isFixed) {
          // إضافة كمصروف ثابت
          window.App.Entries.addFixed({ name, amt, cat });
          window.Toast?.show?.(`✅ تمت إضافة المصروف الثابت`, 'success');
        } else {
          window.App.Entries.addVariable({ name, amt, cat });
          window.Toast?.show?.(`✅ ${cat} ${name} (-${amt} ﷼)`, 'success');
        }
        
        window.SmartCategorizer?.learn?.(name, cat);
        window.Renderers?.scheduledAll?.();
        
        // Animation success قبل الإغلاق
        dialog.querySelector('.manual-entry-modal').classList.add('me-success');
        
        // Polish: confetti effect عند الدخل
        if (isIncome && window.UIPolish?.celebrateSuccess) {
          window.UIPolish.celebrateSuccess(saveBtn);
        }
        
        setTimeout(() => dialog.remove(), 600);
      } catch (e) {
        if (window.Logger) window.Logger.warn('FabController.manual', e?.message);
        window.Toast?.show?.('فشل الحفظ - حاول مرة أخرى', 'danger');
        saveBtn.disabled = false;
        saveBtn.querySelector('span:last-child').textContent = 'حفظ';
      }
    }
    
    saveBtn.onclick = save;
    closeBtn.onclick = () => dialog.remove();
    cancelBtn.onclick = () => dialog.remove();
    
    // Click on overlay to close
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
    
    // Keyboard shortcuts
    [nameInput, amtInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!saveBtn.disabled) save();
        }
        if (e.key === 'Escape') dialog.remove();
      });
    });
    
    // Auto-focus
    setTimeout(() => nameInput.focus(), 100);
  }
  
  let initialized = false;
  
  function init() {
    if (initialized) return;
    initialized = true;
    
    // 1. زر FAB
    const fabBtn = document.getElementById('fabAddBtn');
    if (fabBtn) {
      fabBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        open();
      });
    }
    
    // 2. Overlay click → close
    const overlay = document.getElementById('fabSheetOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }
    
    // 3. Cancel button
    const cancelBtn = document.querySelector('.fab-sheet-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', close);
    }
    
    // 4. Action buttons
    document.querySelectorAll('[data-fab-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        handleAction(btn.dataset.fabAction);
      });
    });
    
    // 5. Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const ovr = document.getElementById('fabSheetOverlay');
        if (ovr?.classList.contains('show')) close();
      }
    });
  }
  
  return { init, open, close, handleAction, openManualEntry };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.FabController = FabController;
window.FabController = FabController;
