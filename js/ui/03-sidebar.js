/* ═══════════════════════════════════════════════════════════════════
  تـدّبير — Sidebar
  ───────────────────────────────────────────────────────────────────
  Originally lines 19046–19700 of index.html
═══════════════════════════════════════════════════════════════════ */

var Sidebar = (() => {
 let isOpen = false;
 let initialized = false;
 let drawer, backdrop, toggleBtn, closeBtn;

 function init() {
  // Prevent double initialization
  if (initialized) return;
  initialized = true;
  
  drawer = document.getElementById('sidebarDrawer');
  backdrop = document.getElementById('sidebarBackdrop');
  toggleBtn = document.getElementById('sidebarToggle');
  closeBtn = document.getElementById('sidebarClose');

  if (!drawer || !toggleBtn) {
   initialized = false;
   return;
  }

  // Toggle button
  toggleBtn.addEventListener('click', open);

  // Close button
  if (closeBtn) closeBtn.addEventListener('click', close);

  // Backdrop click
  if (backdrop) backdrop.addEventListener('click', close);

  // Escape key
  document.addEventListener('keydown', (e) => {
   if (e.key === 'Escape' && isOpen) close();
  });

  // Dropdown toggles
  const toggles = drawer.querySelectorAll('.sidebar-group-header[data-toggle]');
  toggles.forEach(toggle => {
   // ═══ ARIA: setup ═══
   const groupName = toggle.dataset.toggle;
   const submenuId = `submenu-${groupName}`;
   const submenu = drawer.querySelector(`[data-submenu="${groupName}"]`);
   if (submenu) {
    submenu.setAttribute('id', submenuId);
    submenu.setAttribute('role', 'region');
    submenu.setAttribute('aria-hidden', 'true');
   }
   toggle.setAttribute('aria-expanded', 'false');
   toggle.setAttribute('aria-controls', submenuId);
   
   toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const group = toggle.closest('.sidebar-group');
    if (group) {
     const isOpening = !group.classList.contains('open');
     
     // ═══ Accordion: أغلق الباقي ═══
     drawer.querySelectorAll('.sidebar-group.open').forEach(g => {
      if (g !== group) {
       g.classList.remove('open');
       const otherToggle = g.querySelector('.sidebar-group-header');
       const otherSubmenu = g.querySelector('.sidebar-submenu');
       if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
       if (otherSubmenu) otherSubmenu.setAttribute('aria-hidden', 'true');
      }
     });
     
     // Toggle current
     group.classList.toggle('open');
     toggle.setAttribute('aria-expanded', String(isOpening));
     if (submenu) submenu.setAttribute('aria-hidden', String(!isOpening));
     
     try { if (navigator.vibrate) navigator.vibrate(5); } catch (e) { if (window.Logger) Logger.warn('Sidebar', e?.message); }
    }
   });
   
   // ═══ Keyboard support ═══
   toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
     e.preventDefault();
     toggle.click();
    }
   });
  });

  // Menu items (direct actions)
  const items = drawer.querySelectorAll('.sidebar-item:not(.sidebar-group-header), .sidebar-subitem');
  items.forEach(item => {
   item.removeEventListener('click', handleItemClick);
   item.addEventListener('click', handleItemClick);
  });

  // Feature buttons (data-feature in sidebar)
  const featureItems = drawer.querySelectorAll('[data-feature]');
  featureItems.forEach(item => {
   item.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const feature = item.dataset.feature;
    
    // Visual feedback (active state)
    drawer.querySelectorAll('.sidebar-item.active, .sidebar-subitem.active')
     .forEach(el => el.classList.remove('active'));
    item.classList.add('active');
    
    // Loading state
    item.classList.add('loading');
    
    close();
    setTimeout(() => {
     try {
      switch (feature) {
       case 'loan':
        if (window.FeaturesUI?.openLoan) {
         window.FeaturesUI.openLoan();
        } else {
         window.Toast?.show?.('محاكي القرض غير متاح حالياً', 'warn');
        }
        break;
       case 'challenges':
        if (window.FeaturesUI?.openChallenges) {
         window.FeaturesUI.openChallenges();
        } else {
         window.Toast?.show?.('التحديات غير متاحة حالياً', 'warn');
        }
        break;
       case 'year-wrapped':
        if (window.YearWrapped?.show) {
         window.YearWrapped.show();
        } else {
         window.Toast?.show?.('التقرير السنوي غير متاح حالياً', 'warn');
        }
        break;
       case 'scan-bill':
        if (window.BillScanner?.scanAndAdd) {
         window.BillScanner.scanAndAdd();
        } else {
         window.Toast?.show?.('مسح الفواتير غير متاح حالياً', 'warn');
        }
        break;
       case 'voice':
        const vBtn = document.getElementById('btnOpenVoice');
        if (vBtn) {
         vBtn.click();
        } else {
         window.Toast?.show?.('الإدخال الصوتي غير متاح', 'warn');
        }
        break;
       case 'backup':
        if (window.AdvancedExport?.exportJSON) {
         window.AdvancedExport.exportJSON();
        }
        break;
       case 'restore':
        if (window.AdvancedExport?.importJSON) {
         window.AdvancedExport.importJSON();
        }
        break;
       case 'export-year':
        if (window.AdvancedExport?.exportYearCSV) {
         window.AdvancedExport.exportYearCSV();
        }
        break;
       case 'email-summary':
        if (window.AdvancedExport?.emailMonthlySummary) {
         window.AdvancedExport.emailMonthlySummary();
        }
        break;
       default:
        if (window.Logger) Logger.warn('Sidebar', 'Unknown feature: ' + feature);
      }
     } catch (err) {
      if (window.Logger) Logger.warn('Sidebar.feature', err?.message);
      window.Toast?.show?.('حدث خطأ، حاول مرة أخرى', 'danger');
     } finally {
      // Remove loading state
      setTimeout(() => item.classList.remove('loading'), 100);
     }
    }, 300);
   });
  });

  // User section click -> profile
  const userSection = document.getElementById('sidebarUser');
  if (userSection) {
   userSection.addEventListener('click', () => {
    close();
    setTimeout(() => {
     if (window.Social && window.Social.openProfile) {
      const uid = window.Social._state?.user?.uid;
      if (uid) window.Social.openProfile(uid);
     }
    }, 300);
   });
  }

  // Swipe to close (mobile)
  setupSwipeGesture();

  // Initial state update
  updateSidebarContent();

  // 🔧 PERF FIX: استبدلنا setInterval(updateSidebarContent, 2000) بـ event-driven updates.
  // الـ setInterval كان يعيد بناء innerHTML للـ avatar كل ثانيتين بدون داعي — مهدر للبطارية.
  // الآن: نحدّث فقط لما تتغير البيانات الفعلية.
  try {
    if (window.App?.store) {
      window.App.store.subscribe('streak', updateSidebarContent);
      window.App.store.subscribe('pts', updateSidebarContent);
    }
  } catch (e) { if (window.Logger) Logger.warn('Sidebar.subscribe', e?.message); }

  // تحديث عند فتح القائمة (يمسك أي تغييرات في Social state من Firestore)
  // التحديث يصير في open() الموجود تحت
 }

 function open() {
  if (isOpen) return;
  isOpen = true;
  
  updateSidebarContent();
  
  // ═══ UX BEST PRACTICE: كل القوائم الفرعية مغلقة عند فتح Sidebar ═══
  // المستخدم يفتح اللي يحتاجه فقط — يقلل التشتيت
  drawer.querySelectorAll('.sidebar-group.open').forEach(g => g.classList.remove('open'));
  
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  if (backdrop) backdrop.classList.add('show');
  
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
  
  // Vibration
  try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { if (window.Logger) Logger.warn('Sidebar', e?.message); }
 }

 function close() {
  if (!isOpen) return;
  isOpen = false;
  
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  if (backdrop) backdrop.classList.remove('show');
  
  // ═══ UX: امسح حالة الـ submenus عند الإغلاق ═══
  // عند الفتح التالي، كل شي يكون نظيف (لا submenu مفتوح)
  setTimeout(() => {
   if (drawer) {
    drawer.querySelectorAll('.sidebar-group.open').forEach(g => g.classList.remove('open'));
   }
  }, 350); // بعد ما الـ animation تخلص
  
  // Restore body scroll
  document.body.style.overflow = '';
 }

 function toggle() {
  if (isOpen) close();
  else open();
 }

 function handleItemClick(e) {
  const item = e.currentTarget;
  const action = item.dataset.action;
  const tab = item.dataset.tab;
  const sub = item.dataset.sub;
  const target = item.dataset.target;
  const page = item.dataset.page;

  if (!action) return;

  // ═══ UX: تحديث الحالة النشطة (active) ═══
  // امسح active من باقي العناصر، أضف للحالي
  if (drawer) {
   drawer.querySelectorAll('.sidebar-item.active, .sidebar-subitem.active')
    .forEach(el => el.classList.remove('active'));
   item.classList.add('active');
  }

  // For 'page' action, use page name as first arg
  const primaryArg = action === 'page' ? page : tab;

  // ═══ UX: feedback بصري قبل الإغلاق ═══
  item.style.transition = 'background 100ms';
  item.style.background = 'var(--accent-dim)';

  // Close sidebar first with animation
  setTimeout(() => close(), 100);

  // Then execute action after animation
  setTimeout(() => {
   item.style.background = '';
   executeAction(action, primaryArg, sub, target);
  }, 350);
 }

 // ═══ Scroll target keyword map ═══
 const SCROLL_TARGETS = {
  income: ['مصادر الدخل', 'الدخل', 'income'],
  fixed: ['مصاريف ثابتة', 'الثابتة'],
  variable: ['مصاريف يومية', 'المتغيرة', 'variable'],
  goals: ['الأهداف', 'هدف', 'goals'],
  budget: ['حد الصرف', 'ميزانية', 'بادجت'],
  stats: ['الإحصائيات', 'إحصائيات'],
  streak: ['سلسلة', 'متابعة'],
  salary: ['الراتب الجاي', 'راتب'],
  achievements: ['الإنجازات', 'إنجازات'],
  profile: ['الملف الشخصي', 'اسمك', 'صورة العرض'],
  themes: ['الثيم', 'ثيم', 'مظهر'],
  notifications: ['إعدادات التنبيهات', 'التنبيهات'],
  language: ['اللغة', 'Language']
 };

 function scrollToSection(targetKey) {
  if (!targetKey) return;
  const keywords = SCROLL_TARGETS[targetKey];
  if (!keywords) return;
  
  setTimeout(() => {
   let targetEl = null;
   
   // ابحث في .card-title داخل الـ tabs المرئية فقط
   const visibleTabs = document.querySelectorAll('.tab-content:not([style*="display: none"]):not([style*="display:none"])');
   
   for (const tab of visibleTabs) {
    const titles = tab.querySelectorAll('.card-title');
    for (const title of titles) {
     const text = title.textContent || '';
     if (keywords.some(k => text.includes(k))) {
      targetEl = title.closest('.card, .section');
      break;
     }
    }
    if (targetEl) break;
   }
   
   // Fallback
   if (!targetEl) {
    const allTitles = document.querySelectorAll('.card-title');
    for (const title of allTitles) {
     const card = title.closest('.card, .section');
     if (card && card.offsetParent === null) continue;
     
     const text = title.textContent || '';
     if (keywords.some(k => text.includes(k))) {
      targetEl = card;
      break;
     }
    }
   }

   if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    targetEl.style.transition = 'box-shadow 0.3s, transform 0.3s';
    const origShadow = targetEl.style.boxShadow;
    targetEl.style.boxShadow = '0 0 30px var(--accent-glow), 0 0 0 2px var(--accent)';
    targetEl.style.transform = 'scale(1.015)';
    
    setTimeout(() => {
     targetEl.style.boxShadow = origShadow;
     targetEl.style.transform = '';
    }, 2500);
   }
  }, 600);
 }

 function navigateToTab(tabPath) {
  if (!tabPath) return;
  
  if (window.Controllers?.showTab) {
   window.Controllers.showTab(tabPath);
  } else {
   const [mainTab] = tabPath.split(':');
   const btn = document.querySelector(`.tab-btn[data-tab="${mainTab}"]`);
   if (btn) btn.click();
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
 }

 function executeAction(action, tab, sub, target) {
  try {
   switch (action) {
    // ═══ Direct tab navigation ═══
    case 'tab':
     navigateToTab(tab);
     break;

    // ═══ Open dedicated page ═══
    case 'page':
     // Use window.openDedicatedPage explicitly — it's a function decl in another file
     if (window.openDedicatedPage) {
      window.openDedicatedPage(tab); // tab holds the page name here
     } else if (window.DedicatedPages?.open) {
      window.DedicatedPages.open(tab);
     } else {
      Logger.warn('Sidebar', 'openDedicatedPage not available for: ' + tab);
     }
     break;

    // ═══ Navigate to tab + scroll to specific section ═══
    case 'scroll':
     if (tab) {
      navigateToTab(sub ? `${tab}:${sub}` : tab);
      if (target) {
       scrollToSection(target);
      }
     }
     break;

    // ═══ Social: Direct to dedicated chats page ═══
    case 'social-chats':
     // Open dedicated chats page (full-screen isolated)
     if (window.ChatsPage?.open) {
      window.ChatsPage.open();
     } else {
      // Fallback to profile:friends sub-tab
      navigateToTab('profile:friends');
      setTimeout(() => {
       const chatsTab = document.querySelector('.friends-sub-tab[data-fsub="chats"]');
       if (chatsTab) chatsTab.click();
      }, 250);
     }
     break;

    // ═══ Social: Friends list ═══
    case 'social-friends':
     navigateToTab('profile:friends');
     setTimeout(() => {
      const friendsTab = document.querySelector('.friends-sub-tab[data-fsub="list"]');
      if (friendsTab) friendsTab.click();
     }, 250);
     break;

    // ═══ Social: Friend requests ═══
    case 'social-requests':
     navigateToTab('profile:friends');
     setTimeout(() => {
      const reqTab = document.querySelector('.friends-sub-tab[data-fsub="requests"]');
      if (reqTab) reqTab.click();
     }, 250);
     break;

    // ═══ Share App ═══
    case 'share':
     shareApp();
     break;

    // ═══ Install App (PWA) ═══
    case 'install-app':
     if (window.PWAInstall?.forceShow) {
      window.PWAInstall.forceShow();
     }
     break;

    // ═══ Support ═══
    case 'support':
     openSupport();
     break;

    // ═══ Logout ═══
    case 'logout':
     if (confirm('متأكد تبغى تسجل خروج؟')) {
      if (window.FB && window.FB.auth) {
       window.FB.signOut(window.FB.auth);
       window.Toast?.show('تم تسجيل الخروج. نشوفك على خير!. نشوفك على خير!', 'ok');
      }
     }
     break;

    // ═══ Login (for guests) ═══
    case 'login':
     // Open auth overlay
     const authOverlay = document.getElementById('authOverlay');
     if (authOverlay) {
      authOverlay.classList.add('open');
      // Make sure we're in signin mode
      if (window.__setAuthMode) {
       window.__setAuthMode('signin');
      }
     }
     break;

    default:
     window.Logger?.warn?.('[Sidebar] Unknown action:', action);
   }
  } catch (e) {
   window.Logger?.error?.('[Sidebar] Action error:', e);
  }
 }

 function shareApp() {
  const shareData = {
   title: 'تـدّبير - مخططك المالي الذكي',
   text: 'جرّب تـدّبير - أفضل تطبيق لإدارة الأموال بالعربية',
   url: 'https://tdbeerksa.com'
  };

  if (navigator.share) {
   navigator.share(shareData).catch(() => {});
  } else {
   // Fallback: copy to clipboard
   navigator.clipboard?.writeText(shareData.url).then(() => {
    window.Toast?.show('📋 تم نسخ الرابط!', 'ok');
   }).catch(() => {
    window.Toast?.show('الرابط: ' + shareData.url, 'ok');
   });
  }
 }

 function openSupport() {
  // Remove existing menu if any
  const existing = document.getElementById('contactMenu');
  if (existing) existing.remove();
  const existingBackdrop = document.getElementById('contactBackdrop');
  if (existingBackdrop) existingBackdrop.remove();

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'contactBackdrop';
  backdrop.className = 'contact-backdrop';
  document.body.appendChild(backdrop);

  // Create menu
  const menu = document.createElement('div');
  menu.id = 'contactMenu';
  menu.className = 'contact-menu';
  menu.innerHTML = `
   <div class="contact-handle"></div>
   <div class="contact-header">
    <div class="contact-header-icon">💬</div>
    <div class="contact-header-title">كلّمنا</div>
    <div class="contact-header-sub">نحن هنا لخدمتك، اختر طريقة التواصل المناسبة</div>
   </div>

   <div class="contact-list">
    <!-- Email -->
    <button class="contact-item" data-contact="email">
     <div class="contact-icon contact-icon-email">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
       <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
       <polyline points="22,6 12,13 2,6"/>
      </svg>
     </div>
     <div class="contact-info">
      <div class="contact-label">البريد الإلكتروني</div>
      <div class="contact-value">support@tdbeerksa.com</div>
     </div>
     <span class="contact-arrow">›</span>
    </button>

    <!-- TikTok -->
    <button class="contact-item" data-contact="tiktok">
     <div class="contact-icon contact-icon-tiktok">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
       <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.62a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.05Z"/>
      </svg>
     </div>
     <div class="contact-info">
      <div class="contact-label">تيك توك</div>
      <div class="contact-value">@tdbeerksa</div>
     </div>
     <span class="contact-arrow">›</span>
    </button>

    <!-- Instagram -->
    <button class="contact-item" data-contact="instagram">
     <div class="contact-icon contact-icon-instagram">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
       <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
       <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
       <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
      </svg>
     </div>
     <div class="contact-info">
      <div class="contact-label">إنستقرام</div>
      <div class="contact-value">@tdbeerksa</div>
     </div>
     <span class="contact-arrow">›</span>
    </button>

    <!-- X (Twitter) -->
    <button class="contact-item" data-contact="x">
     <div class="contact-icon contact-icon-x">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
       <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
     </div>
     <div class="contact-info">
      <div class="contact-label">إكس (تويتر)</div>
      <div class="contact-value">@tdbeerksa</div>
     </div>
     <span class="contact-arrow">›</span>
    </button>

    <!-- Website -->
    <button class="contact-item" data-contact="website">
     <div class="contact-icon contact-icon-website">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
       <circle cx="12" cy="12" r="10"/>
       <line x1="2" y1="12" x2="22" y2="12"/>
       <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
     </div>
     <div class="contact-info">
      <div class="contact-label">الموقع الإلكتروني</div>
      <div class="contact-value">tdbeerksa.com</div>
     </div>
     <span class="contact-arrow">›</span>
    </button>
   </div>

   <div class="contact-footer">
    <div class="contact-footer-text">نقدّر تواصلك معنا 🤝</div>
    <div class="contact-footer-sub">سنرد عليك في أقرب وقت ممكن</div>
   </div>

   <button class="contact-close" id="contactClose">إغلاق</button>
  `;
  document.body.appendChild(menu);

  // Animate in
  requestAnimationFrame(() => {
   backdrop.classList.add('show');
   menu.classList.add('show');
  });

  // Close handlers
  const closeMenu = () => {
   backdrop.classList.remove('show');
   menu.classList.remove('show');
   setTimeout(() => {
    try {
     backdrop.remove();
     menu.remove();
    } catch (e) { if (window.Logger) Logger.warn('Sidebar', e?.message); }
   }, 300);
  };

  backdrop.addEventListener('click', closeMenu);
  document.getElementById('contactClose').addEventListener('click', closeMenu);

  // Contact actions
  menu.querySelectorAll('.contact-item').forEach(item => {
   item.addEventListener('click', () => {
    const type = item.dataset.contact;
    handleContact(type);
    setTimeout(closeMenu, 200);
   });
  });

  // Escape key
  const handleEsc = (e) => {
   if (e.key === 'Escape') {
    closeMenu();
    document.removeEventListener('keydown', handleEsc);
   }
  };
  document.addEventListener('keydown', handleEsc);
 }

 function handleContact(type) {
  try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) { if (window.Logger) Logger.warn('Sidebar', e?.message); }
  
  switch (type) {
   case 'email': {
    const email = 'support@tdbeerksa.com';
    const subject = encodeURIComponent('استفسار من تطبيق تـدّبير');
    const body = encodeURIComponent('مرحباً،\n\n');
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    window.Toast?.show('📧 جاري فتح البريد الإلكتروني...', 'ok');
    break;
   }
   case 'tiktok':
    window.open('https://www.tiktok.com/@tdbeerksa', '_blank', 'noopener');
    window.Toast?.show('🎵 جاري فتح تيك توك...', 'ok');
    break;
   case 'instagram':
    window.open('https://www.instagram.com/tdbeerksa', '_blank', 'noopener');
    window.Toast?.show('📸 جاري فتح إنستقرام...', 'ok');
    break;
   case 'x':
    window.open('https://x.com/tdbeerksa', '_blank', 'noopener');
    window.Toast?.show('🐦 جاري فتح X...', 'ok');
    break;
   case 'website':
    if (navigator.clipboard) {
     navigator.clipboard.writeText('https://tdbeerksa.com')
      .then(() => window.Toast?.show('📋 تم نسخ رابط الموقع!', 'ok'))
      .catch(() => {});
    }
    break;
  }
 }

 function setupSwipeGesture() {
  let startX = 0, currentX = 0, isDragging = false;

  drawer.addEventListener('touchstart', (e) => {
   startX = e.touches[0].clientX;
   isDragging = true;
  }, { passive: true });

  drawer.addEventListener('touchmove', (e) => {
   if (!isDragging) return;
   currentX = e.touches[0].clientX;
   const diff = currentX - startX;
   // Only allow swipe right (close)
   if (diff > 0) {
    drawer.style.transform = `translateX(${diff}px)`;
   }
  }, { passive: true });

  drawer.addEventListener('touchend', () => {
   if (!isDragging) return;
   isDragging = false;
   const diff = currentX - startX;
   drawer.style.transform = '';
   
   // Close if swiped more than 80px
   if (diff > 80) {
    close();
   }
  }, { passive: true });
 }

 function updateSidebarContent() {
  // Update user info
  const social = window.Social?._state;
  const profile = social?.profile;
  const user = social?.user;

  const avatar = document.getElementById('sidebarAvatar');
  const avatarInitial = document.getElementById('sidebarAvatarInitial');
  const userName = document.getElementById('sidebarUserName');
  const userHandle = document.getElementById('sidebarUserHandle');
  const logoutBtn = document.getElementById('sidebarLogout');
  const loginBtn = document.getElementById('sidebarLogin');

  if (profile && user) {
   // ═══ Logged in ═══
   if (userName) userName.textContent = profile.displayName || 'مستخدم';
   if (userHandle) userHandle.textContent = '@' + (profile.username || 'user');
   
   // Avatar
   if (avatar) {
    if (profile.photoData) {
     avatar.innerHTML = '';
     const img = document.createElement('img');
     img.src = profile.photoData;
     img.alt = '';
     avatar.appendChild(img);
    } else {
     avatar.innerHTML = `<span id="sidebarAvatarInitial">${(profile.displayName || '؟')[0].toUpperCase()}</span>`;
    }
   }
   
   // Show logout, hide login
   if (logoutBtn) logoutBtn.style.display = 'flex';
   if (loginBtn) loginBtn.style.display = 'none';
  } else {
   // ═══ Not logged in (Guest) ═══
   if (userName) userName.textContent = 'ضيف';
   if (userHandle) userHandle.textContent = 'سجّل دخولك عشان تبدأ';
   if (avatar) avatar.innerHTML = '<span>؟</span>';
   
   // Hide logout, show login
   if (logoutBtn) logoutBtn.style.display = 'none';
   if (loginBtn) loginBtn.style.display = 'flex';
  }

  // Update stats
  try {
   const streakEl = document.getElementById('sidebarStreak');
   const pointsEl = document.getElementById('sidebarPoints');
   const friendsEl = document.getElementById('sidebarFriends');

   if (streakEl && window.App?.store) {
    const streak = window.App.store.get('streak');
    streakEl.textContent = streak?.current || 0;
   }

   if (pointsEl && window.App?.store) {
    pointsEl.textContent = window.App.store.get('pts') || 0;
   }

   if (friendsEl && social?.friends) {
    friendsEl.textContent = social.friends.length;
   }
  } catch (e) { if (window.Logger) Logger.warn('Sidebar', e?.message); }

  // Update unread dot
  try {
   const unreadDot = document.getElementById('sidebarUnreadDot');
   if (unreadDot && social?.conversations) {
    const totalUnread = social.conversations.reduce((s, c) => s + (c.unread || 0), 0);
    if (totalUnread > 0) {
     unreadDot.classList.add('show');
    } else {
     unreadDot.classList.remove('show');
    }
   }
  } catch (e) { if (window.Logger) Logger.warn('Sidebar', e?.message); }
 }

 return {
  init,
  open,
  close,
  toggle
 };
})();

// Expose globally for cross-file access
window.Sidebar = Sidebar;
