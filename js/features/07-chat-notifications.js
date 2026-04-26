/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Chat Notifications
   ───────────────────────────────────────────────────────────────────
   Originally lines 18623–19045 of index.html
═══════════════════════════════════════════════════════════════════ */

var ChatNotifications = (() => {
  const { DOM, $, Logger } = Tdbeer;

  const state = {
    audioCtx: null,
    settings: {
      sound: true,
      toast: true,
      badge: true
    },
    lastNotificationTime: 0
  };

  // ═══ SOUND GENERATOR (beautiful notification tone) ═══
  function createAudioContext() {
    if (state.audioCtx) return state.audioCtx;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      state.audioCtx = new AudioCtx();
      return state.audioCtx;
    } catch (e) {
      console.warn('[Notifications] AudioContext not supported');
      return null;
    }
  }

  function playMessageSound() {
    if (!state.settings.sound) return;

    try {
      const ctx = createAudioContext();
      if (!ctx) return;

      // Resume if suspended (Safari iOS)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Beautiful two-tone notification (like iMessage)
      const createTone = (freq, startTime, duration, volume = 0.15) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        // Smooth envelope
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Two-tone: E5 then A5 (pleasant ascending)
      createTone(659.25, now, 0.15); // E5
      createTone(880, now + 0.12, 0.2); // A5

    } catch (e) {
      console.warn('[Notifications] Sound error:', e.message);
    }
  }

  function playSentSound() {
    if (!state.settings.sound) return;
    try {
      const ctx = createAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }
  }

  // ═══ CHAT TOAST (beautiful, action-able) ═══
  function showChatToast({ peerName, peerUsername, text, photoData, onOpen }) {
    if (!state.settings.toast) return;

    // Remove existing chat toast
    const existing = document.getElementById('chatToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'chatToast';
    toast.className = 'chat-toast';

    const displayName = peerName || '@' + (peerUsername || '');
    const initial = (displayName || '?')[0].toUpperCase();

    toast.innerHTML = `
      <div class="chat-toast-avatar">
        ${photoData ? `<img src="${photoData}" alt="">` : initial}
      </div>
      <div class="chat-toast-body">
        <div class="chat-toast-name">💬 ${escapeHtml(displayName)}</div>
        <div class="chat-toast-text">${escapeHtml(text || 'رسالة جديدة')}</div>
      </div>
      <button class="chat-toast-close" aria-label="إغلاق">✕</button>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    // Close button
    toast.querySelector('.chat-toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeChatToast();
    });

    // Click to open chat
    toast.addEventListener('click', () => {
      if (onOpen) onOpen();
      closeChatToast();
    });

    // Auto-close after 5 seconds
    setTimeout(closeChatToast, 5000);
  }

  function closeChatToast() {
    const toast = document.getElementById('chatToast');
    if (!toast) return;
    toast.classList.remove('show');
    setTimeout(() => { try { toast.remove(); } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); } }, 300);
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ═══ BADGE UPDATE ═══
  function updateBadge(totalUnread) {
    if (!state.settings.badge) return;

    // Tab badge (on social tab)
    const socialTabs = document.querySelectorAll('[data-tab="social"]');
    socialTabs.forEach(tab => {
      let badge = tab.querySelector('.tab-unread-badge');
      if (totalUnread > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'tab-unread-badge';
          tab.appendChild(badge);
        }
        badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
        badge.classList.add('pulse');
        setTimeout(() => badge.classList.remove('pulse'), 600);
      } else if (badge) {
        badge.remove();
      }
    });

    // Browser title badge
    try {
      if (totalUnread > 0) {
        if (!document.title.startsWith('(')) {
          document.title = `(${totalUnread > 99 ? '99+' : totalUnread}) ${document.title.replace(/^\(\d+\+?\)\s*/, '')}`;
        } else {
          document.title = document.title.replace(/^\(\d+\+?\)/, `(${totalUnread > 99 ? '99+' : totalUnread})`);
        }
      } else {
        document.title = document.title.replace(/^\(\d+\+?\)\s*/, '');
      }
    } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }

    // Favicon badge (dot indicator) - subtle
    try {
      const favicons = document.querySelectorAll('link[rel="icon"]');
      // Could draw a red dot on canvas if needed, skipping for simplicity
    } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }
  }

  // ═══ MAIN NOTIFY FUNCTION ═══
  function notifyNewMessage({ peerName, peerUsername, text, photoData, peerUid }) {
    // Throttle: max 1 per 500ms
    const now = Date.now();
    if (now - state.lastNotificationTime < 500) return;
    state.lastNotificationTime = now;

    // Check if chat is already open with this peer
    const social = window.Social;
    if (social?._state?.activeChat?.peerUid === peerUid) {
      return; // Don't notify if already chatting
    }

    // Check if this conversation is muted
    try {
      const prefs = JSON.parse(localStorage.getItem('convPrefs') || '{}');
      if (prefs.muted && prefs.muted.includes(peerUid)) {
        // Muted - skip sound, vibration, and browser notification
        // Only show a subtle badge update (already done in badge update)
        return;
      }
    } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }

    // 1. Vibration
    try { if (navigator.vibrate) navigator.vibrate([50, 30, 50]); } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }

    // 2. Sound
    playMessageSound();

    // 3. Browser Native Notification (works even if tab is hidden!)
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        const notif = new Notification(`💬 ${peerName || peerUsername || 'رسالة جديدة'}`, {
          body: text || 'رسالة جديدة',
          icon: photoData || '/og-image.png',
          tag: `chat-${peerUid}`,
          renotify: true,
          silent: false,
          dir: 'rtl',
          lang: 'ar'
        });
        notif.onclick = () => {
          window.focus();
          try {
            if (window.Controllers?.showTab) window.Controllers.showTab('social');
            const friend = social?._state?.friends?.find(f => f.uid === peerUid)
              || { uid: peerUid, displayName: peerName, username: peerUsername };
            if (social?.openChat) social.openChat(friend);
          } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }
          notif.close();
        };
        setTimeout(() => { try { notif.close(); } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); } }, 10000);
      }
    } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }

    // 4. Persistent Message Bar (stays until opened or 30s)
    showPersistentBar({ peerName, peerUsername, text, photoData, peerUid });

    // 5. Toast (quick slide-in at top)
    showChatToast({
      peerName, peerUsername, text, photoData,
      onOpen: () => {
        try {
          if (window.Controllers?.showTab) window.Controllers.showTab('social');
          const friend = social?._state?.friends?.find(f => f.uid === peerUid)
            || { uid: peerUid, displayName: peerName, username: peerUsername };
          if (social?.openChat) social.openChat(friend);
          hidePersistentBar();
        } catch (e) { console.warn('Open chat error:', e.message); }
      }
    });
  }

  // ═══ PERSISTENT MESSAGE BAR (at bottom, stays until read) ═══
  function showPersistentBar({ peerName, peerUsername, text, photoData, peerUid }) {
    if (!state.settings.toast) return;

    const existing = document.getElementById('chatPersistBar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'chatPersistBar';
    bar.className = 'chat-persist-bar';
    bar.dataset.peerUid = peerUid;

    const displayName = peerName || '@' + (peerUsername || '');
    const initial = (displayName || '?')[0].toUpperCase();

    bar.innerHTML = `
      <div class="chat-persist-avatar">
        ${photoData ? `<img src="${photoData}" alt="">` : initial}
        <span class="chat-persist-dot"></span>
      </div>
      <div class="chat-persist-body">
        <div class="chat-persist-name">💬 ${escapeHtml(displayName)} <span class="chat-persist-label">رسالة جديدة</span></div>
        <div class="chat-persist-text">${escapeHtml(text || 'رسالة جديدة')}</div>
      </div>
      <button class="chat-persist-action">فتح</button>
      <button class="chat-persist-close" aria-label="إغلاق">✕</button>
    `;

    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('show'));

    bar.querySelector('.chat-persist-action').addEventListener('click', (e) => {
      e.stopPropagation();
      const social = window.Social;
      try {
        if (window.Controllers?.showTab) window.Controllers.showTab('social');
        const friend = social?._state?.friends?.find(f => f.uid === peerUid)
          || { uid: peerUid, displayName: peerName, username: peerUsername };
        if (social?.openChat) social.openChat(friend);
      } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }
      hidePersistentBar();
    });

    bar.querySelector('.chat-persist-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hidePersistentBar();
    });

    bar.querySelector('.chat-persist-body').addEventListener('click', () => {
      const social = window.Social;
      try {
        if (window.Controllers?.showTab) window.Controllers.showTab('social');
        const friend = social?._state?.friends?.find(f => f.uid === peerUid)
          || { uid: peerUid, displayName: peerName, username: peerUsername };
        if (social?.openChat) social.openChat(friend);
      } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }
      hidePersistentBar();
    });

    setTimeout(hidePersistentBar, 30000);
  }

  function hidePersistentBar() {
    const bar = document.getElementById('chatPersistBar');
    if (!bar) return;
    bar.classList.remove('show');
    setTimeout(() => { try { bar.remove(); } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); } }, 300);
  }

  // ═══ REQUEST BROWSER NOTIFICATION PERMISSION ═══
  function requestBrowserPermission() {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }
  }

  // ═══ SETTINGS ═══
  function loadSettings() {
    try {
      const saved = localStorage.getItem('chatNotifSettings');
      if (saved) {
        state.settings = { ...state.settings, ...JSON.parse(saved) };
      }
    } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }
  }

  function saveSettings() {
    try {
      localStorage.setItem('chatNotifSettings', JSON.stringify(state.settings));
    } catch (e) { if (window.Logger) Logger.warn('ChatNotifications', e?.message); }
  }

  function toggleSetting(key) {
    state.settings[key] = !state.settings[key];
    saveSettings();
    return state.settings[key];
  }

  function getSettings() {
    return { ...state.settings };
  }

  // ═══ INIT ═══
  async function init() {
    loadSettings();

    // Initialize audio context on first user interaction (required by browsers)
    const initAudio = () => {
      createAudioContext();
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });

    // Request browser notification permission on first interaction
    const requestPerm = () => {
      requestBrowserPermission();
      document.removeEventListener('click', requestPerm);
    };
    // Delay permission request to avoid being intrusive
    setTimeout(() => {
      document.addEventListener('click', requestPerm, { once: true });
    }, 5000);
  }

  return {
    init,
    notifyNewMessage,
    updateBadge,
    playMessageSound,
    playSentSound,
    toggleSetting,
    getSettings,
    showChatToast,
    closeChatToast,
    showPersistentBar,
    hidePersistentBar,
    requestBrowserPermission
  };
})();

window.ChatNotifications = ChatNotifications;
