/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Bill Scanner (OCR)
   ───────────────────────────────────────────────────────────────────
   يستخدم Tesseract.js (يُحمّل كـ CDN عند الحاجة فقط — lazy loading)
   لتحليل صور الفواتير واستخراج المبلغ والتاريخ تلقائياً.
═══════════════════════════════════════════════════════════════════ */

var BillScanner = (() => {
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let tesseractLoaded = false;
  let tesseractLoading = null;
  
  /**
   * تحميل Tesseract.js عند الحاجة فقط (lazy)
   */
  async function ensureTesseract() {
    if (tesseractLoaded) return window.Tesseract;
    if (tesseractLoading) return tesseractLoading;
    
    tesseractLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TESSERACT_CDN;
      script.async = true;
      script.onload = () => {
        tesseractLoaded = true;
        resolve(window.Tesseract);
      };
      script.onerror = () => {
        tesseractLoading = null;
        reject(new Error('فشل تحميل OCR'));
      };
      document.head.appendChild(script);
    });
    
    return tesseractLoading;
  }
  
  /**
   * تحويل File → DataURL (preview)
   */
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('فشل قراءة الملف'));
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * استخراج المبلغ من النص
   * يبحث عن: الإجمالي/total/المجموع followed by رقم
   */
  function extractAmount(text) {
    const candidates = [];
    
    // أرقام عربية → إنجليزية
    const arabicToEng = {
      '٠':'0','١':'1','٢':'2','٣':'3','٤':'4',
      '٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
      '٫':'.', // فاصلة عشرية عربية
      '،':',' 
    };
    let normalized = text;
    for (const [ar, en] of Object.entries(arabicToEng)) {
      normalized = normalized.replace(new RegExp(ar, 'g'), en);
    }
    
    // patterns لكلمات الإجمالي
    const totalKeywords = [
      'الاجمالي','الإجمالي','المجموع','الكلي','المبلغ',
      'total','grand total','net total','amount','net amount',
      'subtotal','sum','due','to pay','المستحق','المطلوب'
    ];
    
    const lines = normalized.split('\n');
    
    // 1) ابحث عن أسطر تحتوي على keywords
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      const hasKeyword = totalKeywords.some(kw => line.includes(kw.toLowerCase()));
      if (hasKeyword) {
        // ابحث عن رقم في نفس السطر أو السطر التالي
        const numbers = (lines[i] + ' ' + (lines[i+1] || '')).match(/\d+(?:[.,]\d{1,3})?/g);
        if (numbers) {
          for (const n of numbers) {
            const val = parseFloat(n.replace(',', '.'));
            if (val > 0 && val < 1000000) {
              candidates.push({ value: val, confidence: 0.9, source: 'keyword' });
            }
          }
        }
      }
    }
    
    // 2) ابحث عن أكبر رقم له فاصلة عشرية (احتمال كبير يكون الإجمالي)
    const allDecimals = normalized.match(/\d+[.,]\d{2}/g) || [];
    for (const d of allDecimals) {
      const val = parseFloat(d.replace(',', '.'));
      if (val > 0 && val < 1000000) {
        candidates.push({ value: val, confidence: 0.5, source: 'decimal' });
      }
    }
    
    // 3) ترتيب: أكبر confidence أولاً، ثم أكبر قيمة
    candidates.sort((a, b) => {
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return b.value - a.value;
    });
    
    return candidates.slice(0, 3); // أعلى 3 احتمالات
  }
  
  /**
   * استخراج التاريخ من النص
   */
  function extractDate(text) {
    // patterns شائعة: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    const patterns = [
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,    // YYYY-MM-DD
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,     // DD-MM-YYYY
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})/      // DD-MM-YY
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          let y, m, d;
          if (match[1].length === 4) {
            [, y, m, d] = match;
          } else {
            [, d, m, y] = match;
            if (y.length === 2) y = '20' + y;
          }
          const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          if (date && !isNaN(date.getTime())) return date;
        } catch {}
      }
    }
    return null;
  }
  
  /**
   * استخراج اسم المتجر (أول سطر مفيد عادةً)
   */
  function extractMerchant(text) {
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 2 && l.length < 50)
      .filter(l => !/^[\d\s.,/-]+$/.test(l)); // ليس مجرد أرقام
    
    return lines[0] || null;
  }
  
  /**
   * Main: يأخذ صورة ويرجع البيانات المستخرجة
   */
  async function scan(file, onProgress) {
    try {
      const Tesseract = await ensureTesseract();
      onProgress?.({ status: 'loading', text: 'يحمّل المحرّك...', progress: 0.1 });
      
      const result = await Tesseract.recognize(
        file,
        'ara+eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              onProgress?.({ 
                status: 'scanning', 
                text: 'يقرأ الفاتورة...', 
                progress: 0.3 + m.progress * 0.6
              });
            }
          }
        }
      );
      
      onProgress?.({ status: 'parsing', text: 'يستخرج البيانات...', progress: 0.95 });
      
      const text = result.data.text;
      const amounts = extractAmount(text);
      const date = extractDate(text);
      const merchant = extractMerchant(text);
      const suggestedCat = merchant 
        ? (window.SmartCategorizer?.suggest(merchant) || '🛒')
        : '🛒';
      
      onProgress?.({ status: 'done', text: 'تم!', progress: 1 });
      
      return {
        success: true,
        rawText: text,
        amounts,                    // أعلى 3 احتمالات
        bestAmount: amounts[0]?.value || null,
        date,
        merchant,
        suggestedCategory: suggestedCat,
        confidence: amounts[0]?.confidence || 0
      };
    } catch (e) {
      window.Logger?.error?.('BillScanner.scan', e);
      return {
        success: false,
        error: e.message || 'فشلت قراءة الفاتورة'
      };
    }
  }
  
  /**
   * فتح camera/file picker وبدء المسح
   */
  async function startScan(onResult) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // يفتح الكاميرا الخلفية على الجوال
    
    return new Promise((resolve) => {
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        
        // عرض loading UI
        const loader = createLoaderUI();
        document.body.appendChild(loader);
        
        try {
          const result = await scan(file, (progress) => {
            const bar = loader.querySelector('.scan-progress-bar');
            const txt = loader.querySelector('.scan-progress-text');
            if (bar) bar.style.width = `${progress.progress * 100}%`;
            if (txt) txt.textContent = progress.text;
          });
          
          loader.remove();
          
          if (onResult) onResult(result);
          resolve(result);
        } catch (err) {
          loader.remove();
          window.Toast?.show?.('فشل المسح', 'danger');
          resolve(null);
        }
      };
      input.click();
    });
  }
  
  function createLoaderUI() {
    const overlay = document.createElement('div');
    overlay.className = 'scan-overlay';
    overlay.innerHTML = `
      <div class="scan-loader">
        <div class="scan-icon">📸</div>
        <div class="scan-title">جاري قراءة الفاتورة</div>
        <div class="scan-progress-text">يبدأ...</div>
        <div class="scan-progress-track">
          <div class="scan-progress-bar"></div>
        </div>
        <div class="scan-hint">قد يستغرق 10-30 ثانية أول مرة</div>
      </div>
    `;
    return overlay;
  }
  
  /**
   * UI: إظهار dialog لمراجعة البيانات المستخرجة
   */
  function showReviewDialog(result, onConfirm) {
    if (!result.success) {
      window.Toast?.show?.(result.error || 'فشل المسح', 'danger');
      return;
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'scan-review-overlay';

    // 🔒 SECURITY (Apr 2026): OCR output is user-influenced — anything
    // a printed receipt says ends up here. Previously merchant name only
    // had `"` stripped, which is insufficient (`'`, `>`, `<` still break
    // out). Now: full HTML escape on every field.
    function esc(s) {
      if (window.U?.esc) return window.U.esc(s);
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    // Numeric coercion for amounts — defense in depth.
    function num(n) {
      const v = parseFloat(n);
      return Number.isFinite(v) ? v : '';
    }

    dialog.innerHTML = `
      <div class="scan-review">
        <div class="scan-review-header">
          <span>📸</span>
          <h3>تأكيد بيانات الفاتورة</h3>
          <button class="scan-review-close" aria-label="إغلاق">✕</button>
        </div>
        
        <label class="scan-field">
          <span>المبلغ</span>
          <input type="number" id="scanAmt" value="${num(result.bestAmount)}" step="0.01">
        </label>
        
        <label class="scan-field">
          <span>الاسم/المتجر</span>
          <input type="text" id="scanName" value="${esc(result.merchant || '')}" maxlength="60">
        </label>
        
        <label class="scan-field">
          <span>التصنيف</span>
          <input type="text" id="scanCat" value="${esc(result.suggestedCategory || '➕')}" maxlength="4">
        </label>
        
        ${result.amounts.length > 1 ? `
          <div class="scan-suggestions">
            <span>اقتراحات أخرى:</span>
            ${result.amounts.slice(1).map(a => 
              `<button class="scan-amt-pick" data-amt="${num(a.value)}">${esc(num(a.value))}</button>`
            ).join('')}
          </div>
        ` : ''}
        
        <div class="scan-actions">
          <button class="scan-cancel">إلغاء</button>
          <button class="scan-confirm">✓ حفظ</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Bind events
    dialog.querySelector('.scan-review-close').onclick = 
    dialog.querySelector('.scan-cancel').onclick = () => dialog.remove();
    
    dialog.querySelectorAll('.scan-amt-pick').forEach(btn => {
      btn.onclick = () => {
        dialog.querySelector('#scanAmt').value = btn.dataset.amt;
      };
    });
    
    dialog.querySelector('.scan-confirm').onclick = () => {
      const amt = parseFloat(dialog.querySelector('#scanAmt').value);
      const name = dialog.querySelector('#scanName').value.trim();
      const cat = dialog.querySelector('#scanCat').value.trim() || '➕';
      
      if (!amt || amt <= 0 || !name) {
        window.Toast?.show?.('أكمل البيانات', 'warn');
        return;
      }
      
      if (onConfirm) onConfirm({ name, amt, cat });
      dialog.remove();
    };
  }
  
  /**
   * Public API: المسح الكامل من البداية للنهاية
   */
  async function scanAndAdd() {
    const result = await startScan();
    if (!result || !result.success) return;
    
    showReviewDialog(result, (data) => {
      try {
        window.App.Entries.addVariable(data);
        window.Toast?.show?.(`✅ +${data.amt} ﷼ ${data.cat} ${data.name}`, 'success');
        window.SmartCategorizer?.learn(data.name, data.cat);
        window.Renderers?.scheduledAll?.();
      } catch (e) {
        window.Toast?.show?.('فشل الحفظ', 'danger');
      }
    });
  }
  
  return {
    scan,
    startScan,
    scanAndAdd,
    showReviewDialog,
    extractAmount,
    extractDate,
    extractMerchant
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.BillScanner = BillScanner;
window.BillScanner = BillScanner;
