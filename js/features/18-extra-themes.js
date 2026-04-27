/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Extra Themes (ثيمات إضافية)
   ───────────────────────────────────────────────────────────────────
   إضافات للثيمات الموجودة (default, light, midnight, rose):
   - tropical: أخضر مائل لأزرق
   - sunset: برتقالي + بنفسجي
   - oled: أسود نقي (يوفّر بطارية الجوال OLED)
   - custom: المستخدم يختار accent color
═══════════════════════════════════════════════════════════════════ */

var ExtraThemes = (() => {
  
  // قائمة الثيمات الموسّعة
  const ALL_THEMES = [
    { id: 'default',  name: 'افتراضي',   icon: '🌑', accent: '#c9a84c' },
    { id: 'light',    name: 'فاتح',      icon: '☀️', accent: '#a07828' },
    { id: 'midnight', name: 'منتصف الليل', icon: '🌌', accent: '#01dd8c' },
    { id: 'rose',     name: 'وردي',      icon: '🌸', accent: '#ff6fa5' },
    { id: 'tropical', name: 'استوائي',   icon: '🏝️', accent: '#06b6d4' },
    { id: 'sunset',   name: 'غروب',      icon: '🌅', accent: '#f97316' },
    { id: 'oled',     name: 'OLED أسود',  icon: '⚫', accent: '#10b981' },
    { id: 'custom',   name: 'مخصص',      icon: '🎨', accent: 'var(--user-accent)' }
  ];
  
  /**
   * يعدّل CSS بإضافة الثيمات الجديدة
   */
  function injectExtraThemes() {
    if (document.getElementById('extra-themes-css')) return;
    
    const css = `
      /* Tropical theme */
      [data-theme="tropical"] {
        --bg:     #052e2b;
        --bg2:    #0a3d39;
        --bg3:    #0f4c47;
        --bg4:    #145a55;
        --bg5:    #1a6b65;
        --accent: #06b6d4;
        --accent-2: #67e8f9;
        --accent-dim:  rgba(6,182,212,.14);
        --accent-glow: rgba(6,182,212,.3);
        --accent-bd:   rgba(6,182,212,.35);
        --text:  #e0f2fe;
        --text2: #7dd3c0;
        --text3: #4a7c75;
        --green: #10b981;
        --green-2: #6ee7b7;
        --border:  rgba(125,211,192,.15);
        --border2: rgba(125,211,192,.28);
      }
      
      /* Sunset theme */
      [data-theme="sunset"] {
        --bg:     #1a0f1a;
        --bg2:    #2a1722;
        --bg3:    #3a1f2a;
        --bg4:    #4a2734;
        --bg5:    #5a2f3e;
        --accent: #f97316;
        --accent-2: #fdba74;
        --accent-dim:  rgba(249,115,22,.15);
        --accent-glow: rgba(249,115,22,.4);
        --accent-bd:   rgba(249,115,22,.4);
        --text:  #fef3c7;
        --text2: #fcd34d;
        --text3: #92400e;
        --green: #84cc16;
        --green-2: #bef264;
        --danger: #f43f5e;
        --border:  rgba(252,211,77,.18);
        --border2: rgba(252,211,77,.3);
      }
      
      /* OLED Black (true black للبطارية) */
      [data-theme="oled"] {
        --bg:     #000000;
        --bg2:    #050505;
        --bg3:    #0a0a0a;
        --bg4:    #101010;
        --bg5:    #181818;
        --accent: #10b981;
        --accent-2: #34d399;
        --accent-dim:  rgba(16,185,129,.1);
        --accent-glow: rgba(16,185,129,.25);
        --accent-bd:   rgba(16,185,129,.3);
        --text:  #ffffff;
        --text2: #a3a3a3;
        --text3: #525252;
        --border:  rgba(255,255,255,.06);
        --border2: rgba(255,255,255,.12);
      }
      
      /* Custom theme - uses user's accent */
      [data-theme="custom"] {
        --accent: var(--user-accent, #c9a84c);
        --accent-2: var(--user-accent-2, #f0d98a);
      }
    `;
    
    const style = document.createElement('style');
    style.id = 'extra-themes-css';
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  /**
   * تطبيق ثيم (مع دعم custom)
   */
  function apply(themeId, customColor) {
    if (themeId === 'custom' && customColor) {
      // حساب accent-2 (أفتح من الـ accent)
      const lighter = lightenColor(customColor, 25);
      document.documentElement.style.setProperty('--user-accent', customColor);
      document.documentElement.style.setProperty('--user-accent-2', lighter);
      document.documentElement.style.setProperty('--user-accent-dim', hexToRgba(customColor, 0.14));
      document.documentElement.style.setProperty('--user-accent-glow', hexToRgba(customColor, 0.3));
      window.Storage?.save('customAccentColor', customColor);
    }
    
    document.documentElement.setAttribute('data-theme', themeId);
    window.Storage?.save('theme', themeId);
    
    // Update meta theme-color
    const themeColors = {
      tropical: '#052e2b',
      sunset: '#1a0f1a',
      oled: '#000000',
      custom: customColor || '#0a0a0a'
    };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && themeColors[themeId]) {
      meta.setAttribute('content', themeColors[themeId]);
    }
    
    // Update store إذا متاح
    if (window.App?.store) {
      window.App.store.set('theme', themeId);
    }
  }
  
  /**
   * يفتح dialog لاختيار لون مخصص
   */
  function openCustomPicker() {
    const dialog = document.createElement('div');
    dialog.className = 'theme-picker-overlay';
    dialog.innerHTML = `
      <div class="theme-picker">
        <h3>اختر لونك المفضل 🎨</h3>
        <div class="theme-presets">
          ${[
            '#c9a84c','#01dd8c','#ff6fa5','#06b6d4','#f97316',
            '#8b5cf6','#ef4444','#10b981','#3b82f6','#eab308'
          ].map(color => 
            `<button class="theme-preset" style="background:${color}" data-color="${color}"></button>`
          ).join('')}
        </div>
        <div class="theme-custom-input">
          <input type="color" id="customColorInput" value="#c9a84c">
          <span>أو اختر لون آخر</span>
        </div>
        <div class="theme-actions">
          <button class="theme-cancel">إلغاء</button>
          <button class="theme-apply">تطبيق</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    let selectedColor = window.Storage?.load('customAccentColor', '#c9a84c') || '#c9a84c';
    const colorInput = dialog.querySelector('#customColorInput');
    colorInput.value = selectedColor;
    
    dialog.querySelectorAll('.theme-preset').forEach(btn => {
      btn.onclick = () => {
        selectedColor = btn.dataset.color;
        colorInput.value = selectedColor;
        // Live preview
        apply('custom', selectedColor);
      };
    });
    
    colorInput.oninput = (e) => {
      selectedColor = e.target.value;
      apply('custom', selectedColor);
    };
    
    dialog.querySelector('.theme-cancel').onclick = () => dialog.remove();
    dialog.querySelector('.theme-apply').onclick = () => {
      apply('custom', selectedColor);
      window.Toast?.show?.('تم تطبيق الثيم المخصص 🎨', 'success');
      dialog.remove();
    };
  }
  
  /**
   * Helpers
   */
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  
  function lightenColor(hex, percent) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + Math.round(255 * percent / 100));
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + Math.round(255 * percent / 100));
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.round(255 * percent / 100));
    return '#' + [r,g,b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Init: يحقن CSS الثيمات الجديدة عند تحميل الصفحة
   */
  function init() {
    injectExtraThemes();
    
    // إذا الثيم المحفوظ هو "custom"، طبّق اللون المخصص
    const savedTheme = window.Storage?.load('theme', 'midnight');
    if (savedTheme === 'custom') {
      const customColor = window.Storage?.load('customAccentColor', '#c9a84c');
      apply('custom', customColor);
    }
  }
  
  return {
    init,
    apply,
    openCustomPicker,
    ALL_THEMES,
    injectExtraThemes
  };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.ExtraThemes = ExtraThemes;
window.ExtraThemes = ExtraThemes;
