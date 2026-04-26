/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Dedicated Pages (Goals, Budgets, Recurring)
   ───────────────────────────────────────────────────────────────────
   Originally lines 19701–20141 of index.html
═══════════════════════════════════════════════════════════════════ */

var DedicatedPages = (() => {
  let modal, body, title, backBtn, isOpen = false;

  function init() {
    modal = document.getElementById('pageModal');
    body = document.getElementById('pageModalBody');
    title = document.getElementById('pageModalTitle');
    backBtn = document.getElementById('pageModalBack');

    if (!modal) return;

    if (backBtn) backBtn.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) close();
    });
  }

  function open(pageName) {
    if (!modal || !body) return;
    
    const page = PAGES[pageName];
    if (!page) {
      console.warn('Page not found:', pageName);
      return;
    }

    title.textContent = page.title;
    body.innerHTML = '';

    // Build content
    const hero = document.createElement('div');
    hero.className = 'page-hero';
    hero.innerHTML = `
      <div class="page-hero-icon">${page.icon}</div>
      <div class="page-hero-title">${page.heading}</div>
      <div class="page-hero-desc">${page.description}</div>
    `;
    body.appendChild(hero);

    // Render page-specific content
    if (page.render) page.render(body);

    // Show modal
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    isOpen = true;

    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { if (window.Logger) Logger.warn('DedicatedPages', e?.message); }
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    isOpen = false;
  }

  // ═══ PAGE DEFINITIONS ═══
  const PAGES = {
    'my-profile': {
      title: 'ملفي الشخصي',
      icon: '📝',
      heading: 'معلوماتي الشخصية',
      description: 'حدث معلوماتك الشخصية، أضف تاريخ ميلادك عشان نهنيّك',
      render: renderProfilePage
    },
    'achievements': {
      title: 'إنجازاتي',
      icon: '🏆',
      heading: 'إنجازاتي الشخصية',
      description: 'تابع تقدمك ومنجزاتك في رحلة التوفير',
      render: renderAchievementsPage
    },
    'themes': {
      title: 'شكل التطبيق',
      icon: '🎨',
      heading: 'خصص شكل التطبيق',
      description: 'اختار الشكل اللي يعجبك لديك، وغيّر ألوان التطبيق حسب ذوقك',
      render: renderThemesPage
    },
    'notif-settings': {
      title: 'التنبيهات',
      icon: '🔔',
      heading: 'إعدادات التنبيهات',
      description: 'اختر كيف توصلك التنبيهات عند استلام الرسائل والتنبيهات',
      render: renderNotifSettingsPage
    },
    'goals-budget': {
      title: 'الأهداف والميزانية',
      icon: '🎯',
      heading: 'إدارة الأهداف والميزانية',
      description: 'حدد أهدافك المالية وميزانيتك',
      render: renderGoalsBudgetPage
    }
  };

  // ═══ Profile Page (with Birthday!) ═══
  function renderProfilePage(container) {
    const profile = window.Social?._state?.profile;
    const savedBirthday = localStorage.getItem('userBirthday') || '';
    const savedName = profile?.displayName || localStorage.getItem('userName') || '';

    const section = document.createElement('div');
    section.className = 'page-section';
    section.innerHTML = `
      <div class="page-section-title">👤 المعلومات الأساسية</div>
      <div class="page-form-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <label class="page-form-label" style="flex:none">الاسم</label>
        <input type="text" class="page-form-input" id="profileNameInput" 
               value="${escapeHTML(savedName)}" 
               placeholder="اكتب اسمك" maxlength="50">
      </div>
    `;
    container.appendChild(section);

    // Birthday section
    const birthdaySection = document.createElement('div');
    birthdaySection.className = 'page-section';
    birthdaySection.innerHTML = `
      <div class="page-section-title">🎂 تاريخ الميلاد</div>
      <div class="birthday-input-wrap">
        <input type="date" class="birthday-input" id="birthdayInput" 
               value="${savedBirthday}"
               max="${new Date().toISOString().split('T')[0]}">
        <div class="birthday-hint">💝 بنرسل لك تهنئة خاصة في يوم ميلادك!</div>
      </div>
    `;
    container.appendChild(birthdaySection);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'page-save-btn';
    saveBtn.innerHTML = '💾 اااحفظ التغييرات';
    saveBtn.onclick = () => {
      const name = document.getElementById('profileNameInput')?.value.trim();
      const birthday = document.getElementById('birthdayInput')?.value;

      if (name) {
        localStorage.setItem('userName', name);
        if (window.App?.store) window.App.store.set('userName', name);
      }
      if (birthday) {
        localStorage.setItem('userBirthday', birthday);
      }

      // Update profile in Firebase
      try {
        const user = window.Social?._state?.user;
        if (user && window.FB?.db && name) {
          const ref = window.FB.doc(window.FB.db, 'users', user.uid);
          window.FB.updateDoc(ref, { 
            displayName: name,
            birthday: birthday || null
          }).catch(() => {});
        }
      } catch (e) { if (window.Logger) Logger.warn('DedicatedPages', e?.message); }

      if (window.Toast?.show) {
        window.Toast.show('✅ تم ااحفظ المعلومات بنجاح', 'ok');
      }
      close();
    };
    container.appendChild(saveBtn);
  }

  // ═══ Achievements Page ═══
  function renderAchievementsPage(container) {
    const unlocked = window.App?.store?.get('achievements') || [];
    const ACHIEVEMENTS = window.Tdbeer?.ACHIEVEMENTS || [];

    const statsSection = document.createElement('div');
    statsSection.className = 'page-section';
    statsSection.innerHTML = `
      <div class="page-section-title">📊 إجمالي الإنجازات</div>
      <div style="display:flex;justify-content:space-around;padding:16px 0;text-align:center">
        <div>
          <div style="font-size:28px;font-weight:900;color:var(--accent-2)">${unlocked.length}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">مفتوح</div>
        </div>
        <div>
          <div style="font-size:28px;font-weight:900;color:var(--text)">${ACHIEVEMENTS.length}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">الإجمالي</div>
        </div>
        <div>
          <div style="font-size:28px;font-weight:900;color:var(--accent)">${Math.round(unlocked.length / Math.max(ACHIEVEMENTS.length, 1) * 100)}%</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">اللي كملته</div>
        </div>
      </div>
    `;
    container.appendChild(statsSection);

    const gridSection = document.createElement('div');
    gridSection.className = 'page-section';
    gridSection.innerHTML = `<div class="page-section-title">🏆 شارات الإنجاز</div>`;
    
    const grid = document.createElement('div');
    grid.className = 'ach-grid';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;margin-top:8px';
    
    for (const a of ACHIEVEMENTS) {
      const isOn = unlocked.includes(a.id);
      const badge = document.createElement('div');
      badge.className = 'ach-badge ' + (isOn ? 'on' : 'off');
      badge.innerHTML = `
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-name">${a.name}</div>
        <div class="ach-pts">${a.pts}⭐</div>
      `;
      grid.appendChild(badge);
    }
    gridSection.appendChild(grid);
    container.appendChild(gridSection);
  }

  // ═══ Themes Page ═══
  function renderThemesPage(container) {
    const current = window.App?.store?.get('theme') || 'midnight';
    const themes = [
      { id: 'midnight', name: 'Midnight', desc: 'داكن أسود مع لمسات خضراء', colors: ['#05070a', '#01dd8c'] },
      { id: 'default', name: 'Classic', desc: 'الشكل الكلاسيكي مع الذهبي', colors: ['#0a0a0a', '#c9a84c'] },
      { id: 'light', name: 'Light', desc: 'فاتح ومريح للقراءة في النهار', colors: ['#fdf8f3', '#c9a84c'] },
      { id: 'rose', name: 'Rose', desc: 'وردي أنيق ومميز', colors: ['#1a0d14', '#ff6fa5'] }
    ];

    const section = document.createElement('div');
    section.className = 'page-section';
    section.innerHTML = `<div class="page-section-title">🎨 اختار الشكل اللي يعجبك</div>`;

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px';

    themes.forEach(t => {
      const card = document.createElement('button');
      const isActive = t.id === current;
      card.style.cssText = `
        background:linear-gradient(145deg, ${t.colors[0]}, ${t.colors[0]}dd);
        border:2px solid ${isActive ? t.colors[1] : 'var(--border)'};
        border-radius:14px;
        padding:16px 12px;
        cursor:pointer;
        transition:all 0.3s;
        position:relative;
        overflow:hidden;
        font-family:inherit;
        box-shadow:${isActive ? '0 0 20px ' + t.colors[1] + '66' : 'none'};
      `;
      card.innerHTML = `
        <div style="display:flex;gap:6px;margin-bottom:12px">
          <div style="width:28px;height:28px;border-radius:50%;background:${t.colors[0]};border:2px solid ${t.colors[1]}"></div>
          <div style="width:28px;height:28px;border-radius:50%;background:${t.colors[1]}"></div>
        </div>
        <div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:4px">${t.name}</div>
        <div style="font-size:10px;color:#ccc;line-height:1.4">${t.desc}</div>
        ${isActive ? '<div style="position:absolute;top:8px;left:8px;background:' + t.colors[1] + ';color:#000;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:800">✓ مختار</div>' : ''}
      `;
      card.onclick = () => {
        // ═══ CRITICAL: Apply theme multiple ways to ensure it works ═══
        
        // 1. Apply via App.Theme.apply() (preferred)
        try {
          if (window.App?.Theme?.apply) {
            window.App.Theme.apply(t.id);
          }
        } catch (e) { console.warn('[Theme] App.Theme.apply failed:', e); }
        
        // 2. Direct DOM manipulation (fallback - always works)
        try {
          if (t.id === 'default') {
            document.documentElement.removeAttribute('data-theme');
          } else {
            document.documentElement.setAttribute('data-theme', t.id);
          }
          
          // Update theme-color meta for PWA
          const meta = document.querySelector('meta[name="theme-color"]');
          if (meta) {
            const colors = { default: '#0a0a0a', light: '#fdf8f3', midnight: '#05070a', rose: '#1a0d14' };
            meta.setAttribute('content', colors[t.id] || '#05070a');
          }
        } catch (e) { console.warn('[Theme] Direct apply failed:', e); }
        
        // 3. Save to storage
        try {
          if (window.App?.store?.set) {
            window.App.store.set('theme', t.id);
          }
        } catch (e) { console.warn('[Theme] store.set failed:', e); }
        
        // 4. Save to localStorage directly (always works)
        try {
          const existingData = localStorage.getItem('tadbeerStore');
          let storeData = {};
          if (existingData) {
            try { storeData = JSON.parse(existingData); } catch (e) { if (window.Logger) Logger.warn('DedicatedPages', e?.message); }
          }
          storeData.theme = t.id;
          localStorage.setItem('tadbeerStore', JSON.stringify(storeData));
        } catch (e) { console.warn('[Theme] localStorage save failed:', e); }
        
        // Feedback
        if (window.Toast?.show) {
          window.Toast.show(`🎨 تم تطبيق شكل ${t.name}`, 'ok');
        }
        try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { if (window.Logger) Logger.warn('DedicatedPages', e?.message); }
        
        // Re-render
        container.innerHTML = '';
        // Rebuild hero
        const hero = document.createElement('div');
        hero.className = 'page-hero';
        hero.innerHTML = `
          <div class="page-hero-icon">🎨</div>
          <div class="page-hero-title">خصص شكل التطبيق</div>
          <div class="page-hero-desc">اختار الشكل اللي يعجبك</div>
        `;
        container.appendChild(hero);
        renderThemesPage(container);
      };
      grid.appendChild(card);
    });
    section.appendChild(grid);
    container.appendChild(section);
  }

  // ═══ Notif Settings Page ═══
  function renderNotifSettingsPage(container) {
    const settings = window.ChatNotifications?.getSettings?.() || {
      toast: true, sound: true, vibration: true, bar: true
    };

    const items = [
      { key: 'toast', icon: '🔔', name: 'إشعار يظهر فوق (Toast)', desc: 'إشعار حلو يطلع فوق الشاشة' },
      { key: 'sound', icon: '🎧', name: 'صوت تنبيه', desc: 'صوت خفيف إذا جت رسالة' },
      { key: 'vibration', icon: '📳', name: 'اهتزاز', desc: 'اهتزاز خفيف (للجوال)' },
      { key: 'bar', icon: '📌', name: 'شريط مستمر', desc: 'يبقى تحت الشاشة لين تفتحه' }
    ];

    const section = document.createElement('div');
    section.className = 'page-section';
    section.innerHTML = `<div class="page-section-title">🔔 كيف توصلك التنبيهات</div>`;

    items.forEach(item => {
      const isOn = settings[item.key];
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 8px;border-bottom:1px solid var(--border)';
      row.innerHTML = `
        <div style="font-size:24px;flex-shrink:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:var(--bg4);border-radius:12px">${item.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px">${item.name}</div>
          <div style="font-size:11px;color:var(--text3)">${item.desc}</div>
        </div>
        <div class="notif-toggle-btn ${isOn ? 'on' : 'off'}" data-key="${item.key}" style="
          width:48px;height:26px;border-radius:14px;
          background:${isOn ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'var(--bg5)'};
          position:relative;cursor:pointer;transition:all 0.3s;
          flex-shrink:0;
        ">
          <div style="position:absolute;top:3px;${isOn ? 'left:3px' : 'right:3px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);transition:all 0.3s"></div>
        </div>
      `;
      row.querySelector('.notif-toggle-btn').onclick = (e) => {
        const key = e.currentTarget.dataset.key;
        if (window.ChatNotifications?.toggleSetting) {
          window.ChatNotifications.toggleSetting(key);
        }
        // Re-render
        container.innerHTML = '';
        const hero = document.createElement('div');
        hero.className = 'page-hero';
        hero.innerHTML = `
          <div class="page-hero-icon">🔔</div>
          <div class="page-hero-title">إعدادات التنبيهات</div>
          <div class="page-hero-desc">اختر كيف توصلك التنبيهات</div>
        `;
        container.appendChild(hero);
        renderNotifSettingsPage(container);
      };
      section.appendChild(row);
    });
    container.appendChild(section);
  }

  // ═══ Goals & Budget Page ═══
  function renderGoalsBudgetPage(container) {
    const section = document.createElement('div');
    section.className = 'page-section';
    section.innerHTML = `
      <div class="page-section-title">🎯 الأهداف والميزانية</div>
      <p style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:16px">
        للوصول إلى الأهداف وحد الصرف، اضغط الزر أدناه لفتح الصفحة الكاملة.
      </p>
    `;
    const btn = document.createElement('button');
    btn.className = 'page-save-btn';
    btn.innerHTML = '🎯 افتح الأهداف والميزانية';
    btn.onclick = () => {
      close();
      if (window.Controllers?.showTab) {
        window.Controllers.showTab('money:monthly');
        setTimeout(() => {
          const goalsCard = Array.from(document.querySelectorAll('.card-title'))
            .find(el => el.textContent.includes('الأهداف'))?.closest('.card');
          if (goalsCard) goalsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
      }
    };
    section.appendChild(btn);
    container.appendChild(section);
  }

  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, m => 
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { open, close };
})();

window.DedicatedPages = DedicatedPages;

// Expose openDedicatedPage for sidebar
function openDedicatedPage(pageName) {
  if (window.DedicatedPages?.open) {
    window.DedicatedPages.open(pageName);
  }
}
window.openDedicatedPage = openDedicatedPage;
