/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Chats Page
   ───────────────────────────────────────────────────────────────────
   Originally lines 20264–20802 of index.html
═══════════════════════════════════════════════════════════════════ */

var ChatsPage = (() => {
  let page, body, emptyState, backBtn, newChatBtn;
  let searchInput, searchClear, subtitle;
  let filterBtns;
  let isOpen = false;
  let currentFilter = 'all';
  let currentSearch = '';

  function init() {
    page = document.getElementById('chatsPage');
    body = document.getElementById('chatsPageBody');
    emptyState = document.getElementById('chatsPageEmpty');
    backBtn = document.getElementById('chatsPageBack');
    newChatBtn = document.getElementById('chatsPageNewChat');
    searchInput = document.getElementById('chatsPageSearchInput');
    searchClear = document.getElementById('chatsPageSearchClear');
    subtitle = document.getElementById('chatsPageSubtitle');
    filterBtns = document.querySelectorAll('.chats-page-filter');

    if (!page) return;

    // Back button
    if (backBtn) backBtn.addEventListener('click', close);

    // New chat button
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        close();
        setTimeout(() => {
          if (window.Controllers?.showTab) {
            window.Controllers.showTab('social');
            setTimeout(() => {
              const friendsTab = document.querySelector('.friends-sub-tab[data-fsub="list"]');
              if (friendsTab) friendsTab.click();
            }, 200);
          }
        }, 300);
      });
    }

    // Empty state button
    const emptyBtn = document.getElementById('chatsPageEmptyBtn');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => {
        if (newChatBtn) newChatBtn.click();
      });
    }

    // Search
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim().toLowerCase();
        if (searchClear) searchClear.style.display = currentSearch ? 'flex' : 'none';
        render();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        currentSearch = '';
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchInput.focus();
        render();
      });
    }

    // Filters
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        filterBtns.forEach(b => b.classList.toggle('active', b === btn));
        render();
      });
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) close();
    });

    // Listen to conversation changes
    setInterval(() => {
      if (isOpen) render();
    }, 3000);
  }

  function open() {
    if (!page) return;
    
    page.classList.add('open');
    page.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    isOpen = true;

    // Reset state
    currentSearch = '';
    currentFilter = 'all';
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));

    // Render
    render();

    // Focus search on desktop
    if (window.matchMedia('(hover: hover)').matches && searchInput) {
      setTimeout(() => searchInput.focus(), 400);
    }

    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { if (window.Logger) Logger.warn('ChatsPage', e?.message); }
  }

  function close() {
    if (!page) return;
    page.classList.remove('open');
    page.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    isOpen = false;
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  // ═══ Smart formatters ═══
  function formatSmartTime(ts) {
    if (!ts) return '';
    try {
      const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      const now = new Date();
      const diff = now - d;
      const diffMin = Math.floor(diff / 60000);
      const diffHour = Math.floor(diff / 3600000);
      const diffDay = Math.floor(diff / 86400000);
      
      if (diffMin < 1) return 'الحين';
      if (diffMin < 60) return `${diffMin} د`;
      if (diffHour < 24 && d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return 'أمس';
      if (diffDay < 7) {
        const days = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
        return days[d.getDay()];
      }
      return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'numeric' });
    } catch { return ''; }
  }

  function getMessagePreview(conv, myUid) {
    const msg = conv.lastMessage || '';
    const isMine = conv.lastMessageFrom === myUid;
    const prefix = isMine ? 'أنت: ' : '';
    
    if (msg.match(/https?:\/\//i)) return prefix + '🔗 رابط';
    if (msg.match(/\.(jpg|jpeg|png|gif|webp)/i)) return prefix + '🖼️ صورة';
    if (msg.match(/\.(mp4|mov|avi)/i)) return prefix + '🎥 فيديو';
    if (msg.match(/\.(mp3|wav|ogg)/i)) return prefix + '🎵 صوت';
    if (msg.match(/\.pdf/i)) return prefix + '📄 PDF';
    
    return prefix + (msg || 'رسالة');
  }

  // 🔧 DRY FIX: استخدام U.esc من core بدل تعريف محلي مكرر.
  const escapeHTML = (s) => (window.Tdbeer?.U?.esc || ((x) => String(x ?? '')))(s);

  // ═══ Main render function ═══
  function render() {
    if (!body) return;

    const social = window.Social?._state;
    if (!social) {
      body.innerHTML = '';
      showEmpty('لازم تسجيل الدخول أولاً', 'سجّل دخولك لعرض محادثاتك', '🔐');
      return;
    }

    const myUid = social.user?.uid;
    const conversations = social.conversations || [];
    const friends = social.friends || [];

    // Load preferences
    const prefs = JSON.parse(localStorage.getItem('convPrefs') || '{}');
    const pinnedUids = prefs.pinned || [];
    const mutedUids = prefs.muted || [];
    const archivedUids = prefs.archived || [];

    // Update counts
    updateFilterCounts(conversations, pinnedUids, archivedUids);

    // Apply filter
    let filtered = [...conversations];
    
    if (currentFilter === 'unread') {
      filtered = filtered.filter(c => (c.unread || 0) > 0 && !archivedUids.includes(c.peerUid));
    } else if (currentFilter === 'pinned') {
      filtered = filtered.filter(c => pinnedUids.includes(c.peerUid) && !archivedUids.includes(c.peerUid));
    } else if (currentFilter === 'archived') {
      filtered = filtered.filter(c => archivedUids.includes(c.peerUid));
    } else {
      filtered = filtered.filter(c => !archivedUids.includes(c.peerUid));
    }

    // Apply search
    if (currentSearch) {
      filtered = filtered.filter(c => {
        const name = (c.peerName || '').toLowerCase();
        const username = (c.peerUsername || '').toLowerCase();
        const msg = (c.lastMessage || '').toLowerCase();
        return name.includes(currentSearch) || username.includes(currentSearch) || msg.includes(currentSearch);
      });
    }

    // Sort: pinned first, then by time
    filtered.sort((a, b) => {
      const aPinned = pinnedUids.includes(a.peerUid);
      const bPinned = pinnedUids.includes(b.peerUid);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const aTime = a.lastMessageAt?.seconds || 0;
      const bTime = b.lastMessageAt?.seconds || 0;
      return bTime - aTime;
    });

    // Update subtitle
    if (subtitle) {
      const total = conversations.length;
      const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0);
      if (currentSearch) {
        subtitle.textContent = `${filtered.length} نتيجة للبحث`;
      } else if (currentFilter === 'unread') {
        subtitle.textContent = totalUnread > 0 ? `${totalUnread} رسالة جديدة` : 'لا رسائل جديدة';
      } else if (currentFilter === 'pinned') {
        subtitle.textContent = `${pinnedUids.length} محادثة مثبتة`;
      } else if (currentFilter === 'archived') {
        subtitle.textContent = `${archivedUids.length} في الأرشيف`;
      } else {
        subtitle.textContent = total > 0 ? `${total} محادثة` : 'كل رسايلك الخاصة';
      }
    }

    // Render
    body.innerHTML = '';
    
    if (!filtered.length) {
      const emptyMessages = {
        all: { icon: '💬', title: 'لا محادثات بعد', desc: 'ابدأ التواصل مع أصدقائك' },
        unread: { icon: '✅', title: 'كل شي مقري!', desc: 'ما فيه رسايل جديدة' },
        pinned: { icon: '📌', title: 'ما فيه سواليف مثبتة', desc: 'اضغط ضغطة طويلة على أي سوالف عشان تثبتها' },
        archived: { icon: '📦', title: 'الأرشيف فاضي', desc: 'الدردشات المؤرشفة ستظهر هنا' }
      };
      const empty = currentSearch 
        ? { icon: '🔍', title: 'ما لقينا شي', desc: `لم نجد محادثات تطابق "${currentSearch}"` }
        : emptyMessages[currentFilter] || emptyMessages.all;
      
      showEmpty(empty.title, empty.desc, empty.icon);
      return;
    }

    hideEmpty();

    // Render each conversation
    filtered.forEach(conv => {
      const card = createConversationCard(conv, myUid, friends, pinnedUids, mutedUids);
      body.appendChild(card);
    });
  }

  function createConversationCard(conv, myUid, friends, pinnedUids, mutedUids) {
    const isPinned = pinnedUids.includes(conv.peerUid);
    const isMuted = mutedUids.includes(conv.peerUid);
    const hasUnread = (conv.unread || 0) > 0;
    const isMine = conv.lastMessageFrom === myUid;
    const initial = (conv.peerName || conv.peerUsername || '?')[0].toUpperCase();
    
    const friend = friends.find(f => f.uid === conv.peerUid);
    const photoData = friend?.photoData || null;

    const card = document.createElement('div');
    card.className = 'conv-card' + 
                     (hasUnread ? ' unread' : '') + 
                     (isPinned ? ' pinned' : '') +
                     (isMuted ? ' muted' : '');
    card.dataset.peerUid = conv.peerUid;

    const displayName = escapeHTML(conv.peerName || '@' + (conv.peerUsername || ''));
    const preview = escapeHTML(getMessagePreview(conv, myUid));
    const time = formatSmartTime(conv.lastMessageAt);

    card.innerHTML = `
      <div class="conv-avatar ${photoData ? 'has-img' : ''}">
        ${photoData ? `<img src="${photoData}" alt="">` : initial}
      </div>
      <div class="conv-body">
        <div class="conv-top-row">
          <div class="conv-name-wrap">
            ${isPinned ? '<span class="conv-pin-icon">📌</span>' : ''}
            <div class="conv-name">${displayName}</div>
          </div>
          <div class="conv-time">${time}</div>
        </div>
        <div class="conv-bottom-row">
          <div class="conv-last">
            ${isMine ? `<span class="conv-read-icon ${(conv.unread || 0) === 0 ? 'seen' : ''}">${(conv.unread || 0) === 0 ? '✓✓' : '✓'}</span>` : ''}
            <span class="conv-last-text">${preview}</span>
          </div>
          <div class="conv-indicators">
            ${isMuted ? '<span class="conv-muted-icon" title="مكتومة">🔕</span>' : ''}
            ${hasUnread ? `<div class="conv-badge ${isMuted ? 'muted' : ''}">${conv.unread > 99 ? '99+' : conv.unread}</div>` : ''}
          </div>
        </div>
      </div>
      <button class="conv-menu-btn" aria-label="خيارات">⋮</button>
    `;

    // Click to open chat
    card.addEventListener('click', (e) => {
      if (e.target.closest('.conv-menu-btn')) return;
      
      const social = window.Social;
      if (!social) return;
      
      const friendObj = friends.find(f => f.uid === conv.peerUid) || {
        uid: conv.peerUid, displayName: conv.peerName, username: conv.peerUsername
      };
      
      if (social.openChat) {
        social.openChat(friendObj);
      }
    });

    // Menu button
    const menuBtn = card.querySelector('.conv-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showActionsMenu(conv);
      });
    }

    // Long press for mobile
    let pressTimer = null;
    card.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => {
        try { if (navigator.vibrate) navigator.vibrate(50); } catch (e) { if (window.Logger) Logger.warn('ChatsPage', e?.message); }
        showActionsMenu(conv);
      }, 500);
    });
    card.addEventListener('touchend', () => clearTimeout(pressTimer));
    card.addEventListener('touchmove', () => clearTimeout(pressTimer));

    return card;
  }

  function showActionsMenu(conv) {
    // Remove existing
    const existing = document.getElementById('convActionsMenu');
    if (existing) existing.remove();
    const existingBackdrop = document.querySelector('.conv-menu-backdrop');
    if (existingBackdrop) existingBackdrop.remove();

    const prefs = JSON.parse(localStorage.getItem('convPrefs') || '{}');
    const isPinned = (prefs.pinned || []).includes(conv.peerUid);
    const isMuted = (prefs.muted || []).includes(conv.peerUid);
    const isArchived = (prefs.archived || []).includes(conv.peerUid);

    const backdrop = document.createElement('div');
    backdrop.className = 'conv-menu-backdrop';
    document.body.appendChild(backdrop);

    const menu = document.createElement('div');
    menu.id = 'convActionsMenu';
    menu.className = 'conv-actions-menu';

    const closeMenu = () => {
      backdrop.classList.remove('show');
      menu.classList.remove('show');
      setTimeout(() => {
        try { backdrop.remove(); menu.remove(); } catch (e) { if (window.Logger) Logger.warn('ChatsPage', e?.message); }
      }, 300);
    };

    backdrop.addEventListener('click', closeMenu);

    menu.innerHTML = `
      <div class="conv-menu-header">
        <div class="conv-menu-name">${escapeHTML(conv.peerName || conv.peerUsername || '')}</div>
        <div class="conv-menu-sub">اختر إجراء</div>
      </div>
    `;

    const actions = [
      {
        icon: isPinned ? '📍' : '📌',
        label: isPinned ? 'شيل التثبيت' : 'ثبّتها فوق',
        color: 'var(--accent)',
        action: () => togglePref('pinned', conv.peerUid, isPinned ? 'تم شيل التثبيت' : 'تم التثبيت')
      },
      {
        icon: isMuted ? '🔔' : '🔕',
        label: isMuted ? 'تفعيل التنبيهات' : 'كتم التنبيهات',
        color: 'var(--warn)',
        action: () => togglePref('muted', conv.peerUid, isMuted ? 'تم تفعيل التنبيهات' : 'تم الكتم')
      },
      {
        icon: isArchived ? '📤' : '📦',
        label: isArchived ? 'اطلعها من الأرشيف' : 'حطها في الأرشيف',
        color: 'var(--text2)',
        action: () => togglePref('archived', conv.peerUid, isArchived ? 'تم الإخراج' : 'تم الحطها في الأرشيف')
      }
    ];

    if ((conv.unread || 0) > 0) {
      actions.splice(1, 0, {
        icon: '✓',
        label: 'علّمها كـ "انقرت"',
        color: 'var(--green-2)',
        action: async () => {
          try {
            const ref = window.FB.doc(window.FB.db, 'users', window.Social._state.user.uid, 'conversations', conv.peerUid);
            await window.FB.updateDoc(ref, { unread: 0 });
            window.Toast?.show('✓ تم وضع علامة "انقرت"', 'ok');
          } catch (e) { if (window.Logger) Logger.warn('ChatsPage', e?.message); }
        }
      });
    }

    actions.push({
      icon: '🗑️',
      label: 'ااحذف المحادثة',
      color: 'var(--danger)',
      action: async () => {
        if (!confirm(`ااحذف المحادثة مع ${conv.peerName}؟`)) return;
        try {
          const ref = window.FB.doc(window.FB.db, 'users', window.Social._state.user.uid, 'conversations', conv.peerUid);
          await window.FB.deleteDoc(ref);
          window.Toast?.show('🗑️ تم الحذف', 'ok');
        } catch (e) { if (window.Logger) Logger.warn('ChatsPage', e?.message); }
      }
    });

    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'conv-menu-action';
      btn.innerHTML = `
        <span class="conv-menu-icon" style="color:${a.color}">${a.icon}</span>
        <span class="conv-menu-label">${a.label}</span>
      `;
      btn.onclick = () => {
        closeMenu();
        a.action();
        setTimeout(render, 100);
      };
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    requestAnimationFrame(() => {
      backdrop.classList.add('show');
      menu.classList.add('show');
    });
  }

  function togglePref(key, uid, successMsg) {
    const prefs = JSON.parse(localStorage.getItem('convPrefs') || '{}');
    prefs[key] = prefs[key] || [];
    const idx = prefs[key].indexOf(uid);
    if (idx >= 0) {
      prefs[key].splice(idx, 1);
      if (key === 'pinned') prefs[key].length && prefs[key].length >= 5;
    } else {
      if (key === 'pinned' && prefs[key].length >= 5) {
        window.Toast?.show('⚠️ حدك الأقصى 5 سواليف مثبتة', 'warn');
        return;
      }
      prefs[key].push(uid);
    }
    localStorage.setItem('convPrefs', JSON.stringify(prefs));
    window.Toast?.show('✅ ' + successMsg, 'ok');
  }

  function updateFilterCounts(conversations, pinnedUids, archivedUids) {
    const all = document.getElementById('filterCountAll');
    const unread = document.getElementById('filterCountUnread');
    const pinned = document.getElementById('filterCountPinned');
    const archived = document.getElementById('filterCountArchived');

    const allCount = conversations.filter(c => !archivedUids.includes(c.peerUid)).length;
    const unreadCount = conversations.reduce((s, c) => s + (c.unread || 0), 0);
    const pinnedCount = pinnedUids.length;
    const archivedCount = archivedUids.length;

    if (all) all.textContent = allCount > 99 ? '99+' : allCount;
    if (unread) unread.textContent = unreadCount > 99 ? '99+' : unreadCount;
    if (pinned) pinned.textContent = pinnedCount;
    if (archived) archived.textContent = archivedCount;
  }

  function showEmpty(title, desc, icon) {
    if (!emptyState) return;
    const iconEl = emptyState.querySelector('.chats-page-empty-icon');
    const titleEl = emptyState.querySelector('.chats-page-empty-title');
    const descEl = emptyState.querySelector('.chats-page-empty-desc');
    
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    
    emptyState.style.display = 'flex';
    body.style.display = 'none';
  }

  function hideEmpty() {
    if (emptyState) emptyState.style.display = 'none';
    if (body) body.style.display = '';
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { open, close, toggle, render };
})();

window.ChatsPage = ChatsPage;

// ═══════════════════════════════════════════════════════
// BIOMETRIC AUTHENTICATION (WebAuthn)
// Face ID / Touch ID / Windows Hello / Android Biometrics
// ═══════════════════════════════════════════════════════
