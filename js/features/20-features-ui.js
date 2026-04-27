/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Features UI Controller
   ───────────────────────────────────────────────────────────────────
   يربط الميزات الجديدة بواجهة المستخدم:
   - يفتح dialogs للقرض، التحديات
   - يدير الـ event handlers
   - يربط Voice Input (Web Speech API)
═══════════════════════════════════════════════════════════════════ */

var FeaturesUI = (() => {
  
  /* ───────────────────────────────────────────
     LOAN SIMULATOR DIALOG
  ─────────────────────────────────────────── */
  function openLoan() {
    if (!window.LoanSimulator) {
      window.Toast?.show?.('الميزة لم تكتمل التحميل', 'warn');
      return;
    }
    
    const L = window.LoanSimulator;
    const safe = L.suggestSafe();
    
    const dialog = document.createElement('div');
    dialog.className = 'feature-overlay';
    dialog.innerHTML = `
      <div class="feature-modal">
        <div class="feature-modal-header">
          <h2>🏦 محاكي التمويل</h2>
          <button class="feature-close" aria-label="إغلاق">✕</button>
        </div>
        
        <div class="feature-modal-body">
          ${safe ? `
            <div class="loan-suggestion">
              <strong>💡 اقتراح آمن:</strong> بناءً على دخلك، أقصى قرض يُنصح به: 
              <span class="loan-suggested-amt">${safe.maxAmount.toLocaleString('ar-SA')} ﷼</span>
              (قسط ${safe.safeMonthly} ﷼ شهرياً، 5 سنوات بنسبة 5%)
            </div>
          ` : ''}
          
          <div class="loan-form">
            <label>
              <span>مبلغ القرض (﷼)</span>
              <input type="number" id="loanAmt" value="100000" min="1000" step="1000">
            </label>
            <label>
              <span>الدفعة المقدمة (﷼)</span>
              <input type="number" id="loanDown" value="0" min="0" step="1000">
            </label>
            <label>
              <span>النسبة السنوية (%)</span>
              <input type="number" id="loanRate" value="5" min="0" max="50" step="0.1">
            </label>
            <label>
              <span>المدة (شهور)</span>
              <input type="number" id="loanMonths" value="60" min="6" max="360" step="6">
            </label>
            
            <button class="loan-calc-btn" id="loanCalcBtn">احسب</button>
            
            <div id="loanResult"></div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('.feature-close').onclick = () => dialog.remove();
    
    dialog.querySelector('#loanCalcBtn').onclick = () => {
      const principal = parseFloat(dialog.querySelector('#loanAmt').value) || 0;
      const downPayment = parseFloat(dialog.querySelector('#loanDown').value) || 0;
      const rate = parseFloat(dialog.querySelector('#loanRate').value) || 0;
      const months = parseInt(dialog.querySelector('#loanMonths').value) || 12;
      
      const result = L.analyze({
        principal,
        downPayment,
        annualRate: rate / 100,
        months
      });
      
      if (result.error) {
        dialog.querySelector('#loanResult').innerHTML = 
          `<div class="loan-error">${result.error}</div>`;
        return;
      }
      
      const impact = L.impactOnBudget(result.monthlyPayment);
      
      dialog.querySelector('#loanResult').innerHTML = `
        <div class="loan-result-grid">
          <div class="loan-result-item">
            <div class="loan-result-num">${result.monthlyPayment.toFixed(0)} ﷼</div>
            <div class="loan-result-lbl">القسط الشهري</div>
          </div>
          <div class="loan-result-item">
            <div class="loan-result-num">${result.totalInterest.toFixed(0)} ﷼</div>
            <div class="loan-result-lbl">إجمالي الفوائد</div>
          </div>
          <div class="loan-result-item">
            <div class="loan-result-num">${result.totalPaid.toFixed(0)} ﷼</div>
            <div class="loan-result-lbl">إجمالي المدفوع</div>
          </div>
          <div class="loan-result-item">
            <div class="loan-result-num">${(result.simpleRate * 100).toFixed(2)}%</div>
            <div class="loan-result-lbl">النسبة السنوية البسيطة</div>
          </div>
        </div>
        
        ${!impact.error ? `
          <div class="loan-verdict" style="background:${impact.color}20; color:${impact.color}; border:1px solid ${impact.color}40;">
            ${impact.verdict}
          </div>
          <div class="loan-impact-detail">
            توفيرك بعد القسط: <strong>${impact.newSavings.toFixed(0)} ﷼</strong>
            (${impact.newSavingsPct}% من الدخل)
          </div>
        ` : ''}
      `;
    };
  }
  
  /* ───────────────────────────────────────────
     BUDGET CHALLENGES DIALOG
  ─────────────────────────────────────────── */
  function openChallenges() {
    if (!window.BudgetChallenges) return;
    
    const BC = window.BudgetChallenges;
    const active = BC.getActive();
    const available = BC.getAvailable();
    const stats = BC.getStats();
    
    const dialog = document.createElement('div');
    dialog.className = 'feature-overlay';
    dialog.innerHTML = `
      <div class="feature-modal">
        <div class="feature-modal-header">
          <h2>🎯 التحديات</h2>
          <button class="feature-close" aria-label="إغلاق">✕</button>
        </div>
        
        <div class="feature-modal-body">
          <div class="challenges-stats">
            <div class="cs-item">
              <div class="cs-num">${stats.totalCompleted}</div>
              <div class="cs-lbl">مكتمل</div>
            </div>
            <div class="cs-item">
              <div class="cs-num">${stats.successRate}%</div>
              <div class="cs-lbl">نسبة النجاح</div>
            </div>
            <div class="cs-item">
              <div class="cs-num">${stats.totalRewards}</div>
              <div class="cs-lbl">إجمالي النقاط</div>
            </div>
          </div>
          
          ${active.length > 0 ? `
            <h3 class="ch-section-title">🔥 تحديات نشطة (${active.length})</h3>
            <div class="challenges-list">
              ${active.map(c => {
                const ev = BC.evaluate(c) || c;
                return `
                  <div class="challenge-card active">
                    <div class="challenge-icon">${c.icon}</div>
                    <div class="challenge-info">
                      <div class="challenge-title">${c.title}</div>
                      <div class="challenge-desc">${ev.detailMessage || c.description}</div>
                      <div class="challenge-progress">
                        <div class="challenge-progress-bar" style="width:${ev.progress || 0}%"></div>
                      </div>
                    </div>
                    <button class="challenge-abandon" data-id="${c.id}" title="إلغاء">✕</button>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
          
          ${available.length > 0 ? `
            <h3 class="ch-section-title">💪 تحديات متاحة</h3>
            <div class="challenges-list">
              ${available.map(c => `
                <div class="challenge-card">
                  <div class="challenge-icon">${c.icon}</div>
                  <div class="challenge-info">
                    <div class="challenge-title">
                      <span class="challenge-difficulty ${c.difficulty}">${
                        c.difficulty === 'easy' ? 'سهل' : 
                        c.difficulty === 'medium' ? 'متوسط' : 'صعب'
                      }</span>
                      ${c.title}
                    </div>
                    <div class="challenge-desc">${c.description}</div>
                  </div>
                  <button class="challenge-start" data-id="${c.id}">ابدأ</button>
                  <div class="challenge-reward">+${c.reward}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('.feature-close').onclick = () => dialog.remove();
    
    dialog.querySelectorAll('.challenge-start').forEach(btn => {
      btn.onclick = () => {
        BC.start(btn.dataset.id);
        dialog.remove();
        setTimeout(openChallenges, 500); // refresh
      };
    });
    
    dialog.querySelectorAll('.challenge-abandon').forEach(btn => {
      btn.onclick = () => {
        if (confirm('هل تريد إلغاء هذا التحدي؟')) {
          BC.abandon(btn.dataset.id);
          dialog.remove();
          setTimeout(openChallenges, 500);
        }
      };
    });
  }
  
  /* ───────────────────────────────────────────
     VOICE INPUT — يستخدم Voice الموجود في smart-features
  ─────────────────────────────────────────── */
  function openVoice() {
    // Voice module الأصلي موجود في 03-smart-features.js
    // يفتح عبر الزر btnOpenVoice في HTML
    const voiceBtn = document.getElementById('btnOpenVoice');
    if (voiceBtn) {
      voiceBtn.click();
    } else {
      window.Toast?.show?.('ميزة الإدخال الصوتي غير متاحة', 'warn');
    }
  }
  
  
  /* ───────────────────────────────────────────
     SETUP BUTTONS — يربط الأزرار في HTML
  ─────────────────────────────────────────── */
  function setupButtons() {
    
    // زر القرض
    document.querySelectorAll('[data-feature="loan"]').forEach(btn => {
      btn.addEventListener('click', openLoan);
    });
    
    // زر التحديات
    document.querySelectorAll('[data-feature="challenges"]').forEach(btn => {
      btn.addEventListener('click', openChallenges);
    });
    
    // زر تصوير الفاتورة
    document.querySelectorAll('[data-feature="scan-bill"]').forEach(btn => {
      btn.addEventListener('click', () => window.BillScanner?.scanAndAdd?.());
    });
    
    // زر التقرير السنوي
    document.querySelectorAll('[data-feature="year-wrapped"]').forEach(btn => {
      btn.addEventListener('click', () => window.YearWrapped?.show?.());
    });
    
    // زر Voice Input
    document.querySelectorAll('[data-feature="voice"]').forEach(btn => {
      btn.addEventListener('click', openVoice);
      // الميزة الأصلية تتعامل مع isSupported
    });
    
    // زر Backup
    document.querySelectorAll('[data-feature="backup"]').forEach(btn => {
      btn.addEventListener('click', () => window.AdvancedExport?.exportJSON?.());
    });
    
    // زر Restore
    document.querySelectorAll('[data-feature="restore"]').forEach(btn => {
      btn.addEventListener('click', () => window.AdvancedExport?.importJSON?.());
    });
    
    // زر Export Year
    document.querySelectorAll('[data-feature="export-year"]').forEach(btn => {
      btn.addEventListener('click', () => window.AdvancedExport?.exportYearCSV?.());
    });
    
    // زر Email Summary
    document.querySelectorAll('[data-feature="email-summary"]').forEach(btn => {
      btn.addEventListener('click', () => window.AdvancedExport?.emailMonthlySummary?.());
    });
    
    // زر Custom Theme
    document.querySelectorAll('[data-feature="theme-custom"]').forEach(btn => {
      btn.addEventListener('click', () => window.ExtraThemes?.openCustomPicker?.());
    });
    
    // أزرار الثيمات الجديدة (data-theme-id)
    document.querySelectorAll('[data-theme-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const themeId = btn.dataset.themeId;
        if (themeId === 'custom') {
          window.ExtraThemes?.openCustomPicker?.();
        } else {
          window.ExtraThemes?.apply?.(themeId);
        }
      });
    });
  }
  
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupButtons, { once: true });
    } else {
      setupButtons();
    }
  }
  
  return {
    init,
    openLoan,
    openChallenges,
    openVoice,
    setupButtons
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.FeaturesUI = FeaturesUI;
window.FeaturesUI = FeaturesUI;
// VoiceInput يُحمَّل من smart-features
