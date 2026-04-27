/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Social (friends, chat, requests)
   ───────────────────────────────────────────────────────────────────
   Originally lines 14387–16277 of index.html
═══════════════════════════════════════════════════════════════════ */

var Social = (() => {
  const { U, Fmt, DOM, $, $$, Logger } = Tdbeer;
  const { store, Toast, Streak } = App;

  // 🔧 STORAGE FIX: helpers لـ convPrefs (تستخدم Storage module مع fallback)
  // كان الكود يستخدم localStorage مباشرة في 11 مكان — هذي توحيد المنطق.
  function loadConvPrefs() {
    try {
      if (window.Storage) return window.Storage.load('convPrefs', {}) || {};
      return JSON.parse(localStorage.getItem('convPrefs') || '{}');
    } catch { return {}; }
  }
  function saveConvPrefs(prefs) {
    try {
      if (window.Storage) window.Storage.save('convPrefs', prefs);
      else localStorage.setItem('convPrefs', JSON.stringify(prefs));
    } catch (e) { if (window.Logger) Logger.warn('Social.saveConvPrefs', e?.message); }
  }

  const state = {
    user: null,
    profile: null,
    friends: [],
    incomingReqs: [],
    outgoingReqs: [],
    blocked: [],
    conversations: [],
    activeChat: null,
    activeChatMessages: [],
    authMode: 'signin',
    fbReady: false,
    subs: [],
    chatMsgUnsub: null,
    currentSubTab: 'chats'
  };

  function chatIdOf(uid1, uid2) { return [uid1, uid2].sort().join('_'); }

  function formatMsgTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'الأمس';
    const daysDiff = Math.floor((now - d) / 86400000);
    if (daysDiff < 7) return ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][d.getDay()];
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  function init() {
    if (window.FB && window.FB.ready) {
      state.fbReady = true;
      attachAuthListener();
    } else {
      window.addEventListener('fb-ready', () => {
        state.fbReady = true;
        attachAuthListener();
      }, { once: true });
    }
  }

  function attachAuthListener() {
    try {
      window.FB.onAuthStateChanged(window.FB.auth, async (user) => {
        cleanupSubs();
        state.user = user;
        if (user) {
          // تأكد أن token وصل قبل أي عملية Firestore
          try { if (user.getIdToken) await user.getIdToken(false); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
          // اصبر قليلاً لضمان أن Firestore سيعرف token
          await new Promise(r => setTimeout(r, 300));

          await loadProfile(user);

          // تأخير بسيط بين الاشتراكات لتفادي race conditions
          subscribeToFriends();
          await new Promise(r => setTimeout(r, 100));
          subscribeToRequests();
          await new Promise(r => setTimeout(r, 100));
          subscribeToBlocked();
          await new Promise(r => setTimeout(r, 100));
          subscribeToConversations();
        } else {
          Object.assign(state, {
            profile: null, friends: [], incomingReqs: [],
            outgoingReqs: [], blocked: [], conversations: [], activeChat: null
          });
          closeChat();
        }
        renderFriendsTab();
      });
    } catch (e) { Logger.error('Social.attachAuth', e); }
  }

  function cleanupSubs() {
    for (const unsub of state.subs) { try { unsub(); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); } }
    state.subs = [];
    if (state.chatMsgUnsub) { try { state.chatMsgUnsub(); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); } state.chatMsgUnsub = null; }
  }

  async function loadProfile(user) {
    try {
      // أنشئ ملفاً افتراضياً فوراً (لتجنب null حتى لو فشلت القراءة)
      const fallbackUsername = user.email
        ? user.email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 15)
        : 'user';
      const fallbackDisplay = user.displayName || fallbackUsername || 'مستخدم';

      state.profile = {
        uid: user.uid,
        email: user.email || '',
        username: fallbackUsername,
        displayName: fallbackDisplay,
        streak: 0,
        maxStreak: 0
      };

      // تأكد من token قبل أي عملية
      try { if (user.getIdToken) await user.getIdToken(true); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }

      // حاول قراءة الملف من قاعدة البيانات
      const ref = window.FB.doc(window.FB.db, 'users', user.uid);
      let snap;
      try {
        snap = await window.FB.getDoc(ref);
      } catch (readErr) {
        Logger.warn('Social.loadProfile.read', readErr.message);
        // أعد المحاولة بعد ثانية
        await new Promise(r => setTimeout(r, 1000));
        try { snap = await window.FB.getDoc(ref); } catch {
          // ما عاد تقدر تقرأ — استخدم الافتراضي
          return;
        }
      }

      if (snap && snap.exists && snap.exists()) {
        const data = snap.data() || {};
        // حدّث الملف من قاعدة البيانات
        state.profile = {
          uid: data.uid || user.uid,
          email: data.email || user.email || '',
          username: data.username || fallbackUsername,
          displayName: data.displayName || fallbackDisplay,
          streak: typeof data.streak === 'number' ? data.streak : 0,
          maxStreak: typeof data.maxStreak === 'number' ? data.maxStreak : 0,
          photoData: data.photoData || null,
          createdAt: data.createdAt || window.FB.serverTimestamp()
        };

        // تحديث صورة البروفايل في الإعدادات
        try {
          const settingsAvatar = document.getElementById('settingsProfileAvatar');
          if (settingsAvatar && data.photoData && window.ImageHandler) {
            window.ImageHandler.renderAvatarImage(settingsAvatar, data.photoData);
          } else if (settingsAvatar && state.profile.displayName) {
            settingsAvatar.textContent = state.profile.displayName[0].toUpperCase();
          }
        } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
        // صحّح الملف إن كانت فيه حقول ناقصة
        if (!data.displayName || !data.username) {
          try {
            await window.FB.updateDoc(ref, {
              displayName: state.profile.displayName,
              username: state.profile.username
            });
          } catch (e) { /* ignore */ }
        }
      } else {
        // الملف غير موجود — أنشئه
        try {
          const username = await generateUniqueUsername(user.email || 'user@a.com');
          const profile = {
            uid: user.uid,
            email: user.email || '',
            username: username,
            displayName: fallbackDisplay,
            createdAt: window.FB.serverTimestamp(),
            streak: 0,
            maxStreak: 0
          };
          await window.FB.setDoc(ref, profile);
          state.profile = profile;
        } catch (e) {
          Logger.warn('Social.loadProfile.create', e.message);
          // استخدم الافتراضي
        }
      }

      try { syncStreak(); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
    } catch (e) {
      Logger.error('Social.loadProfile', e);
      // الملف الافتراضي موجود، لا مشكلة
    }
  }

  async function generateUniqueUsername(email) {
    const base = (email.split('@')[0] || 'user').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12) || 'user';
    for (let i = 0; i < 20; i++) {
      const candidate = i === 0 ? base : base + Math.floor(Math.random() * 9999);
      try {
        const q = window.FB.query(
          window.FB.collection(window.FB.db, 'users'),
          window.FB.where('username', '==', candidate),
          window.FB.limit(1)
        );
        const snap = await window.FB.getDocs(q);
        if (snap.empty) return candidate;
      } catch (e) { return base + Date.now().toString(36).slice(-4); }
    }
    return base + Date.now().toString(36).slice(-4);
  }

  function subscribeWithRetry(name, subFn, maxRetries = 3) {
    let retries = 0;
    const tryOnce = () => {
      try {
        return subFn((err) => {
          const msg = (err && err.message) || '';
          const isPermsError = msg.includes('permissions') || msg.includes('insufficient');
          if (isPermsError && retries < maxRetries) {
            retries++;
            Logger.warn('Social.' + name, 'retry #' + retries);
            setTimeout(tryOnce, 800 * retries);
          } else {
            Logger.error('Social.' + name, err);
          }
        });
      } catch (e) { Logger.error('Social.' + name + '.init', e); }
    };
    return tryOnce();
  }

  function subscribeToFriends() {
    if (!state.user) return;
    const sub = subscribeWithRetry('friendsSnap', (errCb) => {
      const ref = window.FB.collection(window.FB.db, 'users', state.user.uid, 'friends');
      return window.FB.onSnapshot(ref, (snap) => {
        const friends = [];
        snap.forEach(doc => friends.push({ id: doc.id, ...doc.data() }));
        state.friends = friends.sort((a, b) => (b.streak || 0) - (a.streak || 0));
        renderFriendsTab();
      }, errCb);
    });
    if (sub) state.subs.push(sub);
  }

  function subscribeToRequests() {
    if (!state.user) return;
    const subIn = subscribeWithRetry('incomingSnap', (errCb) => {
      const inRef = window.FB.collection(window.FB.db, 'users', state.user.uid, 'incomingRequests');
      return window.FB.onSnapshot(inRef, (snap) => {
        state.incomingReqs = [];
        snap.forEach(doc => state.incomingReqs.push({ id: doc.id, ...doc.data() }));
        renderFriendsTab();
      }, errCb);
    });
    if (subIn) state.subs.push(subIn);

    const subOut = subscribeWithRetry('outgoingSnap', (errCb) => {
      const outRef = window.FB.collection(window.FB.db, 'users', state.user.uid, 'outgoingRequests');
      return window.FB.onSnapshot(outRef, (snap) => {
        state.outgoingReqs = [];
        snap.forEach(doc => state.outgoingReqs.push({ id: doc.id, ...doc.data() }));
        renderFriendsTab();
      }, errCb);
    });
    if (subOut) state.subs.push(subOut);
  }

  function subscribeToBlocked() {
    if (!state.user) return;
    const sub = subscribeWithRetry('blockedSnap', (errCb) => {
      const ref = window.FB.collection(window.FB.db, 'users', state.user.uid, 'blocked');
      return window.FB.onSnapshot(ref, (snap) => {
        state.blocked = [];
        snap.forEach(doc => state.blocked.push({ id: doc.id, ...doc.data() }));
        renderFriendsTab();
      }, errCb);
    });
    if (sub) state.subs.push(sub);
  }

  function subscribeToConversations() {
    if (!state.user) return;
    let isFirstSnapshot = true;
    const myUid = state.user.uid;
    
    const sub = subscribeWithRetry('convsSnap', (errCb) => {
      const ref = window.FB.query(
        window.FB.collection(window.FB.db, 'users', state.user.uid, 'conversations'),
        window.FB.orderBy('lastMessageAt', 'desc'),
        window.FB.limit(50)
      );
      return window.FB.onSnapshot(ref, (snap) => {
        // اااحفظ نسخة سابقة قبل التحديث
        const prevConvsMap = new Map(state.conversations.map(c => [c.peerUid, {...c}]));
        
        const newConversations = [];
        snap.forEach(doc => newConversations.push({ id: doc.id, ...doc.data() }));
        
        const newUnreadTotal = newConversations.reduce((s, c) => s + (c.unread || 0), 0);

        // Update tab badge دائماً
        if (window.ChatNotifications) {
          window.ChatNotifications.updateBadge(newUnreadTotal);
        }

        // التحقق من التنبيهات (بعد أول snapshot)
        if (!isFirstSnapshot) {
          for (const conv of newConversations) {
            const prev = prevConvsMap.get(conv.peerUid);
            
            const isCompletelyNew = !prev;
            const prevUnread = prev?.unread || 0;
            const nowUnread = conv.unread || 0;
            const unreadIncreased = nowUnread > prevUnread;
            
            const prevTime = prev?.lastMessageAt?.seconds || prev?.lastMessageAt?._seconds || 0;
            const nowTime = conv.lastMessageAt?.seconds || conv.lastMessageAt?._seconds || 0;
            const timestampChanged = nowTime > prevTime;
            
            const isFromPeer = conv.lastMessageFrom && conv.lastMessageFrom !== myUid;
            
            const shouldNotify = isFromPeer && (isCompletelyNew || unreadIncreased || timestampChanged);
            
            if (shouldNotify) {
              const isCurrentlyOpen = state.activeChat && state.activeChat.peerUid === conv.peerUid;
              
              if (!isCurrentlyOpen) {
                const friend = state.friends.find(f => f.uid === conv.peerUid);
                const photoData = friend?.photoData || conv.peerPhotoData || null;

                if (window.ChatNotifications && typeof window.ChatNotifications.notifyNewMessage === 'function') {
                  try {
                    window.ChatNotifications.notifyNewMessage({
                      peerUid: conv.peerUid,
                      peerName: conv.peerName || friend?.displayName || 'مستخدم',
                      peerUsername: conv.peerUsername || friend?.username || '',
                      text: conv.lastMessage || 'رسالة جديدة',
                      photoData
                    });
                  } catch (e) {
                    // silent fail
                  }
                }
              }
            }
          }
        }
        
        // حدّث state بعد التحقق
        state.conversations = newConversations;
        isFirstSnapshot = false;

        renderFriendsTab();
      }, errCb);
    });
    if (sub) state.subs.push(sub);
  }

  async function openChat(peer) {
    if (!state.user || !state.profile) {
      Toast.show('لازم تسجيل الدخول أولاً', 'warn');
      return;
    }
    if (state.blocked.some(b => b.uid === peer.uid)) {
      Toast.show('هذا المستخدم محظور. ألغِ الحظر أولاً', 'warn');
      return;
    }
    state.activeChat = {
      peerUid: peer.uid,
      peerName: peer.displayName || peer.username,
      peerUsername: peer.username,
      chatId: chatIdOf(state.user.uid, peer.uid)
    };
    state.activeChatMessages = [];
    const initial = (state.activeChat.peerName || '?')[0].toUpperCase();
    const avatarEl = $('#chatPeerAvatar');
    if (avatarEl) {
      avatarEl.classList.remove('has-img');
      avatarEl.innerHTML = '';
      DOM.setText(avatarEl, initial);
    }
    DOM.setText($('#chatPeerName'), state.activeChat.peerName);
    DOM.setText($('#chatPeerStatus'), '@' + state.activeChat.peerUsername);
    $('#chatOverlay').classList.add('open');
    $('#chatPanel').classList.add('open');
    $('#chatInput').value = '';
    $('#chatSendBtn').disabled = true;

    // تحميل صورة البروفايل للصديق
    (async () => {
      try {
        const peerDoc = await window.firebase.firestore().collection('users').doc(peer.uid).get();
        if (peerDoc.exists) {
          const peerData = peerDoc.data();
          if (peerData.photoData && avatarEl && window.ImageHandler) {
            window.ImageHandler.renderAvatarImage(avatarEl, peerData.photoData);
          }
        }
      } catch (e) { window.Logger?.warn?.('Failed to load peer avatar:', e.message); }
    })();

    if (state.chatMsgUnsub) { try { state.chatMsgUnsub(); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); } }
    try {
      const q = window.FB.query(
        window.FB.collection(window.FB.db, 'chats', state.activeChat.chatId, 'messages'),
        window.FB.orderBy('at', 'asc'),
        window.FB.limit(200)
      );
      state.chatMsgUnsub = window.FB.onSnapshot(q, (snap) => {
        state.activeChatMessages = [];
        snap.forEach(doc => state.activeChatMessages.push({ id: doc.id, ...doc.data() }));
        renderChatMessages();
        markChatRead();
      }, (err) => Logger.error('Social.chatMsgs', err));
    } catch (e) { Logger.error('Social.openChat', e); }

    setTimeout(() => $('#chatInput')?.focus(), 400);
  }

  function closeChat() {
    $('#chatOverlay')?.classList.remove('open');
    $('#chatPanel')?.classList.remove('open');
    if (state.chatMsgUnsub) { try { state.chatMsgUnsub(); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); } state.chatMsgUnsub = null; }
    state.activeChat = null;
    state.activeChatMessages = [];
  }

  function renderChatMessages() {
    const cont = $('#chatMessages');
    if (!cont) return;
    const empty = $('#chatEmptyState');
    const chips = $('#chatQuickChips');
    if (!state.activeChatMessages.length) {
      cont.innerHTML = '';
      if (empty) cont.appendChild(empty);
      // اعرض Quick Chips للبدء
      if (chips) chips.style.display = '';
      if (empty) empty.style.display = '';
      return;
    }
    // أخفِ Quick Chips إذا في رسائل
    if (chips) chips.style.display = 'none';
    cont.innerHTML = '';
    let lastDate = '';
    for (const m of state.activeChatMessages) {
      if (m.at) {
        const d = m.at.toDate ? m.at.toDate() : new Date(m.at);
        const ds = d.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' });
        if (ds !== lastDate) {
          cont.appendChild(DOM.h('div', { class: 'chat-date-sep' }, ds));
          lastDate = ds;
        }
      }
      const isMine = m.from === state.user.uid;

      // Image messages
      if ((m.type === 'image' || m.type === 'image-ephemeral') && window.ImageHandler) {
        const imgBubble = window.ImageHandler.renderImageBubble(m, isMine);
        cont.appendChild(imgBubble);
        continue;
      }

      const bubble = DOM.h('div', { class: 'msg ' + (isMine ? 'mine' : 'theirs') });
      bubble.appendChild(DOM.h('div', { class: 'msg-text' }, m.text || ''));
      const timeRow = DOM.h('div', { class: 'msg-time' }, formatMsgTime(m.at));
      if (isMine) {
        timeRow.appendChild(DOM.h('span', { class: 'msg-check' + (m.read ? ' read' : '') }, m.read ? '✓✓' : '✓'));
      }
      bubble.appendChild(timeRow);
      cont.appendChild(bubble);
    }
    requestAnimationFrame(() => { cont.scrollTop = cont.scrollHeight; });
  }

  async function sendMessage() {
    if (!state.user || !state.profile || !state.activeChat) return;
    const input = $('#chatInput');
    const text = U.str(input.value, 1000);
    if (!text) return;
    const peer = state.activeChat;
    const chatId = peer.chatId;

    $('#chatSendBtn').disabled = true;
    input.value = '';
    autoResizeInput();

    // 🔧 RELIABILITY FIX: استخدام withRetry للمحاولات السريعة، WriteQueue للأوفلاين/الفشل النهائي.
    // قبل: لو فشل الإرسال (شبكة ضعيفة)، الرسالة تضيع تماماً.
    // بعد: 3 محاولات مع backoff؛ ولو فشل، الرسالة تُحفظ في WriteQueue وتُرسل لما يرجع النت.

    const isOnline = window.Network?.isOnline?.() ?? navigator.onLine;
    const senderProfile = {
      uid: state.user.uid,
      name: state.profile.displayName,
      username: state.profile.username
    };
    const preview = text.slice(0, 80);

    // Helper: نفذ كل العمليات الـ 3 (رسالة + محادثتي + محادثة الطرف الآخر)
    async function executeWrites() {
      const now = window.FB.serverTimestamp();

      // 1) أضف الرسالة
      const msgRef = window.FB.collection(window.FB.db, 'chats', chatId, 'messages');
      await window.FB.addDoc(msgRef, {
        from: senderProfile.uid, to: peer.peerUid,
        text, at: now, read: false
      });

      // 2) حدّث محادثتي
      const myConvRef = window.FB.doc(window.FB.db, 'users', senderProfile.uid, 'conversations', peer.peerUid);
      await window.FB.setDoc(myConvRef, {
        peerUid: peer.peerUid, peerName: peer.peerName, peerUsername: peer.peerUsername,
        lastMessage: preview, lastMessageAt: now,
        lastMessageFrom: senderProfile.uid, unread: 0
      });

      // 3) حدّث محادثة الطرف الآخر مع زيادة unread
      const theirConvRef = window.FB.doc(window.FB.db, 'users', peer.peerUid, 'conversations', senderProfile.uid);
      try {
        const snap = await window.FB.getDoc(theirConvRef);
        const prevUnread = snap.exists() ? (snap.data().unread || 0) : 0;
        await window.FB.setDoc(theirConvRef, {
          peerUid: senderProfile.uid,
          peerName: senderProfile.name,
          peerUsername: senderProfile.username,
          lastMessage: preview, lastMessageAt: now,
          lastMessageFrom: senderProfile.uid, unread: prevUnread + 1
        });
      } catch (e) { Logger.error('Social.updatePeerConv', e); }
    }

    // Helper: حفظ في WriteQueue للإرسال لاحقاً (fallback أوفلاين أو فشل)
    function queueForLater() {
      if (!window.WriteQueue) return false;

      const fallbackTs = Date.now();
      try {
        // الرسالة نفسها — نولّد ID محلي
        const msgId = U.uid();
        window.WriteQueue.enqueue({
          type: 'set',
          path: `chats/${chatId}/messages/${msgId}`,
          data: {
            from: senderProfile.uid, to: peer.peerUid,
            text, at: fallbackTs, read: false
          }
        });

        // محادثتي
        window.WriteQueue.enqueue({
          type: 'set',
          path: `users/${senderProfile.uid}/conversations/${peer.peerUid}`,
          data: {
            peerUid: peer.peerUid, peerName: peer.peerName, peerUsername: peer.peerUsername,
            lastMessage: preview, lastMessageAt: fallbackTs,
            lastMessageFrom: senderProfile.uid, unread: 0
          }
        });

        // محادثة الطرف الآخر — ما نقدر نزيد unread بدون قراءة، نضع 1 افتراضياً
        // (في حالة الأوفلاين، الحل المثالي يحتاج Firestore Cloud Function)
        window.WriteQueue.enqueue({
          type: 'set',
          path: `users/${peer.peerUid}/conversations/${senderProfile.uid}`,
          data: {
            peerUid: senderProfile.uid,
            peerName: senderProfile.name,
            peerUsername: senderProfile.username,
            lastMessage: preview, lastMessageAt: fallbackTs,
            lastMessageFrom: senderProfile.uid, unread: 1
          }
        });

        return true;
      } catch (err) {
        Logger.error('Social.sendMsg.queue', err);
        return false;
      }
    }

    try {
      if (!isOnline) {
        // أوفلاين — احفظ مباشرة في الطابور
        if (queueForLater()) {
          Toast.show('📴 الرسالة محفوظة — راح تُرسل لما يرجع النت', 'warn', 3000);
        } else {
          throw new Error('فشل الحفظ');
        }
      } else {
        // أونلاين — جرّب مع retry
        if (window.withRetry) {
          await window.withRetry(executeWrites, { ctx: 'Social.sendMsg', maxAttempts: 3 });
        } else {
          // fallback لو error-handling module ما تحمّل
          await executeWrites();
        }
      }

      try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
      try { if (window.ChatNotifications) window.ChatNotifications.playSentSound(); }
      catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
    } catch (e) {
      Logger.error('Social.sendMsg', e);
      // محاولة أخيرة: ضع في الطابور
      if (queueForLater()) {
        Toast.show('⚠️ فشل الإرسال — راح يُعاد المحاولة لاحقاً', 'warn', 3000);
      } else {
        Toast.show('❌ فشل الإرسال', 'danger');
        input.value = text; // أرجع النص للمستخدم ليحاول مرة ثانية
      }
    } finally {
      $('#chatSendBtn').disabled = !input.value.trim();
      input.focus();
    }
  }

  async function markChatRead() {
    if (!state.user || !state.activeChat) return;
    try {
      const myConvRef = window.FB.doc(window.FB.db, 'users', state.user.uid, 'conversations', state.activeChat.peerUid);
      const snap = await window.FB.getDoc(myConvRef);
      if (snap.exists() && (snap.data().unread || 0) > 0) {
        await window.FB.updateDoc(myConvRef, { unread: 0 });
      }
      const unreadMine = state.activeChatMessages.filter(m => m.from === state.activeChat.peerUid && !m.read);
      for (const m of unreadMine) {
        try {
          const mRef = window.FB.doc(window.FB.db, 'chats', state.activeChat.chatId, 'messages', m.id);
          await window.FB.updateDoc(mRef, { read: true });
        } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
      }
    } catch (e) { Logger.error('Social.markRead', e); }
  }

  async function sendFriendRequest(target) {
    if (!state.user || !state.profile) { Toast.show('سجّل دخول أولاً', 'warn'); return; }
    try {
      let t = target;
      if (typeof target === 'string') {
        const cleaned = target.replace(/^@/, '').trim().toLowerCase();
        if (!cleaned) { Toast.show('أدخل كود صحيح', 'danger'); return; }
        if (cleaned === state.profile.username) { Toast.show('ما يمكنك إضافة نفسك 🙃', 'warn'); return; }
        const q = window.FB.query(
          window.FB.collection(window.FB.db, 'users'),
          window.FB.where('username', '==', cleaned),
          window.FB.limit(1)
        );
        const snap = await window.FB.getDocs(q);
        if (snap.empty) { Toast.show('ما لقيت هالكود', 'danger'); return; }
        snap.forEach(doc => { t = { uid: doc.id, ...doc.data() }; });
      }
      if (!t || !t.uid) { Toast.show('خطأ', 'danger'); return; }
      if (state.blocked.some(b => b.uid === t.uid)) { Toast.show('ألغِ الحظر أولاً', 'warn'); return; }
      const fCheck = await window.FB.getDoc(window.FB.doc(window.FB.db, 'users', state.user.uid, 'friends', t.uid));
      if (fCheck.exists()) { Toast.show('أنتم أصدقاء بالفعل ✓', 'warn'); return; }
      const sentCheck = await window.FB.getDoc(window.FB.doc(window.FB.db, 'users', state.user.uid, 'outgoingRequests', t.uid));
      if (sentCheck.exists()) { Toast.show('أرسلت طلب مسبقاً', 'warn'); return; }

      // 🔧 RELIABILITY: استخدم withRetry لمقاومة فشل الشبكة المؤقت
      const writeRequests = async () => {
        await window.FB.setDoc(
          window.FB.doc(window.FB.db, 'users', state.user.uid, 'outgoingRequests', t.uid),
          {
            uid: t.uid,
            username: t.username || '',
            displayName: t.displayName || t.username || 'مستخدم',
            sentAt: window.FB.serverTimestamp()
          }
        );
        await window.FB.setDoc(
          window.FB.doc(window.FB.db, 'users', t.uid, 'incomingRequests', state.user.uid),
          {
            uid: state.user.uid,
            username: state.profile.username || '',
            displayName: state.profile.displayName || state.profile.username || 'مستخدم',
            sentAt: window.FB.serverTimestamp()
          }
        );
      };

      if (window.withRetry) {
        await window.withRetry(writeRequests, { ctx: 'Social.sendReq', maxAttempts: 3 });
      } else {
        await writeRequests();
      }
      Toast.show('تم إرسال الطلب 📤', 'success');
      const input = $('#userSearchInput'); if (input) input.value = '';
      const results = $('#searchResults'); if (results) results.style.display = 'none';
    } catch (e) {
      Logger.error('Social.sendReq', e);
      Toast.show('فشل الإرسال', 'danger');
    }
  }

  async function acceptFriendRequest(req) {
    if (!state.user || !state.profile) return;
    try {
      // 🔧 RELIABILITY: withRetry لمقاومة فشل الشبكة
      const acceptOps = async () => {
        await window.FB.setDoc(
          window.FB.doc(window.FB.db, 'users', state.user.uid, 'friends', req.uid),
          {
            uid: req.uid,
            username: req.username || '',
            displayName: req.displayName || req.username || 'مستخدم',
            streak: 0,
            maxStreak: 0,
            friendsSince: window.FB.serverTimestamp()
          }
        );
        await window.FB.setDoc(
          window.FB.doc(window.FB.db, 'users', req.uid, 'friends', state.user.uid),
          {
            uid: state.user.uid,
            username: state.profile.username || '',
            displayName: state.profile.displayName || state.profile.username || 'مستخدم',
            streak: state.profile.streak || 0,
            maxStreak: state.profile.maxStreak || 0,
            friendsSince: window.FB.serverTimestamp()
          }
        );
        await window.FB.deleteDoc(window.FB.doc(window.FB.db, 'users', state.user.uid, 'incomingRequests', req.uid));
        await window.FB.deleteDoc(window.FB.doc(window.FB.db, 'users', req.uid, 'outgoingRequests', state.user.uid));
      };

      if (window.withRetry) {
        await window.withRetry(acceptOps, { ctx: 'Social.accept', maxAttempts: 3 });
      } else {
        await acceptOps();
      }

      Toast.show(`أهلاً ${req.displayName || '@' + req.username} 🎉`, 'success');
      App.Pts.add(25);
    } catch (e) { Logger.error('Social.accept', e); Toast.show('فشل', 'danger'); }
  }

  async function removeRequest(req, direction) {
    if (!state.user) return;
    try {
      if (direction === 'incoming') {
        await window.FB.deleteDoc(window.FB.doc(window.FB.db, 'users', state.user.uid, 'incomingRequests', req.uid));
        await window.FB.deleteDoc(window.FB.doc(window.FB.db, 'users', req.uid, 'outgoingRequests', state.user.uid));
        Toast.show('تم الرفض');
      } else {
        await window.FB.deleteDoc(window.FB.doc(window.FB.db, 'users', state.user.uid, 'outgoingRequests', req.uid));
        await window.FB.deleteDoc(window.FB.doc(window.FB.db, 'users', req.uid, 'incomingRequests', state.user.uid));
        Toast.show('تم الإلغاء');
      }
    } catch (e) { Logger.error('Social.removeReq', e); }
  }

  async function removeFriend(friend) {
    if (!state.user) return;
    if (!confirm(`حذف ${friend.displayName || '@' + friend.username} من أصدقائك؟`)) return;
    try {
      await window.FB.deleteDoc(window.FB.doc(window.FB.db, 'users', state.user.uid, 'friends', friend.uid));
      await window.FB.deleteDoc(window.FB.doc(window.FB.db, 'users', friend.uid, 'friends', state.user.uid));
      Toast.show('تم الحذف');
    } catch (e) { Logger.error('Social.removeFriend', e); }
  }

  async function blockUser(user) {
    if (!state.user) return;
    if (!confirm(`حظر ${user.displayName || '@' + user.username}؟\nلن يستطيع مراسلتك أو إرسال طلبات.`)) return;
    try {
      await window.FB.setDoc(
        window.FB.doc(window.FB.db, 'users', state.user.uid, 'blocked', user.uid),
        { uid: user.uid, username: user.username, displayName: user.displayName,
          blockedAt: window.FB.serverTimestamp() }
      );
      const cleanupPaths = [
        ['users', state.user.uid, 'friends', user.uid],
        ['users', user.uid, 'friends', state.user.uid],
        ['users', state.user.uid, 'incomingRequests', user.uid],
        ['users', state.user.uid, 'outgoingRequests', user.uid],
        ['users', user.uid, 'incomingRequests', state.user.uid],
        ['users', user.uid, 'outgoingRequests', state.user.uid],
        ['users', state.user.uid, 'conversations', user.uid]
      ];
      for (const path of cleanupPaths) {
        try { await window.FB.deleteDoc(window.FB.doc(window.FB.db, ...path)); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
      }
      Toast.show('🚫 تم الحظر');
    } catch (e) { Logger.error('Social.block', e); Toast.show('فشل الحظر', 'danger'); }
  }

  async function unblockUser(user) {
    if (!state.user) return;
    try {
      await window.FB.deleteDoc(window.FB.doc(window.FB.db, 'users', state.user.uid, 'blocked', user.uid));
      Toast.show('✓ ألغي الحظر');
    } catch (e) { Logger.error('Social.unblock', e); }
  }

  const searchUsersDebounced = U.debounce(async (q) => {
    if (!state.user || !q) { $('#searchResults').style.display = 'none'; return; }
    const cleaned = q.replace(/^@/, '').trim().toLowerCase();
    if (cleaned.length < 2) { $('#searchResults').style.display = 'none'; return; }
    try {
      const qs = window.FB.query(
        window.FB.collection(window.FB.db, 'users'),
        window.FB.orderBy('username'),
        window.FB.where('username', '>=', cleaned),
        window.FB.where('username', '<=', cleaned + '\uf8ff'),
        window.FB.limit(15)
      );
      const snap = await window.FB.getDocs(qs);
      const results = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.uid !== state.user.uid && !state.blocked.some(b => b.uid === d.uid)) results.push(d);
      });
      renderSearchResults(results);
    } catch (e) { Logger.error('Social.search', e); }
  }, 350);

  function renderSearchResults(results) {
    const cont = $('#searchResults');
    if (!cont) return;
    cont.innerHTML = '';
    if (!results.length) {
      cont.appendChild(DOM.h('div', {
        style: { padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }
      }, '🔍 ما لقيت أحد بهذا الاسم'));
      cont.style.display = '';
      return;
    }
    for (const u of results) {
      const isFriend = state.friends.some(f => f.uid === u.uid);
      const isSent = state.outgoingReqs.some(r => r.uid === u.uid);
      const initial = (u.displayName || u.username || '?')[0].toUpperCase();
      cont.appendChild(DOM.h('div', { class: 'search-result' },
        DOM.h('div', {
          class: 'search-avatar',
          style: { cursor: 'pointer' },
          onclick: () => openProfile(u)
        }, initial),
        DOM.h('div', {
          class: 'search-name',
          style: { cursor: 'pointer' },
          onclick: () => openProfile(u)
        },
          DOM.h('div', { class: 'search-name-top' }, u.displayName || u.username),
          DOM.h('div', { class: 'search-name-handle' }, '@' + u.username)
        ),
        DOM.h('button', {
          class: 'search-add-btn',
          disabled: isFriend || isSent,
          onclick: () => { if (!isFriend && !isSent) sendFriendRequest(u); }
        }, isFriend ? '✓ صديق' : isSent ? 'مُرسل' : '+ إضافة')
      ));
    }
    cont.style.display = '';
  }

  const syncStreak = U.debounce(async () => {
    if (!state.user || !state.profile) return;
    try {
      const s = Streak.calc();
      const ref = window.FB.doc(window.FB.db, 'users', state.user.uid);
      await window.FB.updateDoc(ref, {
        streak: s.current, maxStreak: s.max,
        lastUpdate: window.FB.serverTimestamp()
      });
      for (const friend of state.friends) {
        try {
          const fRef = window.FB.doc(window.FB.db, 'users', friend.uid, 'friends', state.user.uid);
          await window.FB.updateDoc(fRef, { streak: s.current, maxStreak: s.max });
        } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
      }
    } catch (e) { Logger.error('Social.syncStreak', e); }
  }, 1500);

  function switchSubTab(which) {
    state.currentSubTab = which;
    $$('.friends-sub-tab').forEach(t => {
      const isActive = t.dataset.fsub === which;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', String(isActive));
    });
    $$('.fsub-panel').forEach(p => {
      const isVisible = p.id === 'fsub-' + which;
      p.style.display = isVisible ? '' : 'none';
      p.setAttribute('aria-hidden', String(!isVisible));
    });
    renderFriendsTab();
    
    // تحديث الـ badges بعد التبديل
    if (window.UnreadBadges?.scheduleUpdate) {
      window.UnreadBadges.scheduleUpdate(100);
    }
  }

  function renderFriendsTab() {
    const signedOut = $('#friendsSignedOut');
    const signedIn = $('#friendsSignedIn');
    if (!signedOut || !signedIn) return;
    if (!state.user) {
      signedOut.style.display = ''; signedIn.style.display = 'none';
      return;
    }
    signedOut.style.display = 'none'; signedIn.style.display = '';
    if (!state.profile) return;

    DOM.setText($('#myUsername'), '@' + state.profile.username);
    const myStreak = Streak.calc();
    DOM.setText($('#myStreakNum'), myStreak.current);
    DOM.setText($('#myFriendsCount'), state.friends.length);

    const all = [
      { uid: state.user.uid, streak: myStreak.current, isMe: true },
      ...state.friends.map(f => ({ uid: f.uid, streak: f.streak || 0 }))
    ].sort((a, b) => b.streak - a.streak);
    const myRank = all.findIndex(x => x.isMe) + 1;
    DOM.setText($('#myRankVal'), myRank > 0 ? '#' + myRank : '—');

    DOM.setText($('#cntList'), state.friends.length);
    const totalUnread = state.conversations.reduce((s, c) => s + (c.unread || 0), 0);
    DOM.setText($('#cntChats'), totalUnread > 0 ? totalUnread : state.conversations.length);
    DOM.setText($('#cntReq'), state.incomingReqs.length + state.outgoingReqs.length);
    DOM.setText($('#cntBlocked'), state.blocked.length);

    if (state.currentSubTab === 'list') renderFriendsList(myStreak);
    else if (state.currentSubTab === 'chats') renderConversations();
    else if (state.currentSubTab === 'requests') renderRequestsPanel();
    else if (state.currentSubTab === 'blocked') renderBlockedPanel();

    // تحديث المحتوى الذكي
    try { if (window.FreshContent) window.FreshContent.render(); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
    try { if (window.SmartMoments) window.SmartMoments.render(); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
  }

  function renderFriendsList(myStreak) {
    const fList = $('#friendsList');
    if (!fList) return;
    const board = [
      { uid: state.user.uid, displayName: state.profile.displayName,
        username: state.profile.username, streak: myStreak.current,
        maxStreak: myStreak.max, isMe: true },
      ...state.friends.map(f => ({ ...f, isMe: false }))
    ].sort((a, b) => (b.streak || 0) - (a.streak || 0));

    fList.innerHTML = '';

    if (board.length === 1) {
      fList.appendChild(DOM.h('div', { class: 'friends-empty' },
        DOM.h('div', { class: 'friends-empty-icon' }, '👥'),
        DOM.h('div', null, 'ما عندك أصدقاء بعد'),
        DOM.h('div', { style: { fontSize: '11px', marginTop: '4px' } }, 'ابحث بالاسم أو اطلب الكود من صديقك')
      ));
      return;
    }

    board.forEach((person, idx) => {
      const rank = idx + 1;
      const initial = (person.displayName || person.username || '?')[0].toUpperCase();
      let avCls = 'friend-avatar';
      if (person.streak >= 90) avCls += ' obsidian';
      else if (person.streak >= 60) avCls += ' gold';
      else if (person.streak >= 30) avCls += ' bronze';
      let rankCls = 'friend-rank';
      if (rank === 1) rankCls += ' gold';
      else if (rank === 2) rankCls += ' silver';
      else if (rank === 3) rankCls += ' bronze';
      const rankText = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;

      const conv = state.conversations.find(c => c.peerUid === person.uid);
      const unreadCount = conv?.unread || 0;

      const card = DOM.h('div', {
        class: 'friend-card',
        style: person.isMe ? { borderColor: 'var(--accent-bd)', background: 'var(--accent-dim)' } : {}
      },
        DOM.h('div', { class: rankCls }, rankText),
        DOM.h('div', {
          class: avCls,
          style: { cursor: 'pointer' },
          onclick: () => openProfile(person)
        }, initial),
        DOM.h('div', {
          class: 'friend-body',
          style: { cursor: 'pointer' },
          onclick: () => openProfile(person)
        },
          DOM.h('div', { class: 'friend-name' },
            (person.displayName || person.username) + (person.isMe ? ' (أنت)' : '')),
          DOM.h('div', { class: 'friend-username' }, '@' + person.username)
        ),
        DOM.h('div', { class: 'friend-streak' },
          DOM.h('div', { class: 'friend-streak-num' }, '🔥', person.streak || 0),
          DOM.h('div', { class: 'friend-streak-lbl' }, 'يوم')
        ),
        !person.isMe ? DOM.h('div', { class: 'friend-card-actions' },
          DOM.h('button', {
            class: 'friend-msg-btn',
            'aria-label': 'رسالة',
            onclick: () => openChat(person)
          },
            '💬',
            unreadCount > 0 ? DOM.h('span', { class: 'msg-dot' },
              unreadCount > 9 ? '9+' : String(unreadCount)) : null
          ),
          DOM.h('button', {
            class: 'friend-menu-btn',
            'aria-label': 'خيارات',
            onclick: (e) => showFriendMenu(e.currentTarget, person)
          }, '⋯')
        ) : null
      );
      fList.appendChild(card);
    });
  }

  function renderConversations() {
    const cont = $('#convsList');
    if (!cont) return;
    cont.innerHTML = '';

    // ═══ Helper: Format time smartly ═══
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

    // ═══ Helper: Smart message preview ═══
    function getMessagePreview(conv) {
      const msg = conv.lastMessage || '';
      const isMine = conv.lastMessageFrom === state.user.uid;
      const prefix = isMine ? 'أنت: ' : '';
      
      // Detect content type
      if (msg.match(/https?:\/\//i)) return prefix + '🔗 رابط';
      if (msg.match(/\.(jpg|jpeg|png|gif|webp)/i)) return prefix + '🖼️ صورة';
      if (msg.match(/\.(mp4|mov|avi)/i)) return prefix + '🎥 فيديو';
      if (msg.match(/\.(mp3|wav|ogg)/i)) return prefix + '🎵 ملف صوتي';
      if (msg.match(/\.pdf/i)) return prefix + '📄 PDF';
      
      return prefix + (msg || 'رسالة');
    }

    // ═══ Load user preferences ═══
    const prefs = loadConvPrefs();
    const pinnedUids = prefs.pinned || [];
    const mutedUids = prefs.muted || [];
    const archivedUids = prefs.archived || [];
    const currentFilter = prefs.filter || 'all';

    // ═══ Current Filter State ═══
    if (!window._convFilter) window._convFilter = currentFilter;

    // ═══ Search Bar ═══
    const searchBar = DOM.h('div', { class: 'conv-search-bar' },
      DOM.h('div', { class: 'conv-search-icon' }, '🔍'),
      DOM.h('input', {
        type: 'text',
        class: 'conv-search-input',
        placeholder: 'ابحث في الدردشات...',
        value: window._convSearchQuery || '',
        oninput: (e) => {
          window._convSearchQuery = e.target.value;
          renderConversations();
          // focus
          setTimeout(() => {
            const input = cont.querySelector('.conv-search-input');
            if (input) {
              input.focus();
              input.setSelectionRange(e.target.value.length, e.target.value.length);
            }
          }, 0);
        }
      }),
      window._convSearchQuery ? DOM.h('button', {
        class: 'conv-search-clear',
        onclick: () => {
          window._convSearchQuery = '';
          renderConversations();
        }
      }, '✕') : null
    );
    cont.appendChild(searchBar);

    // ═══ Filter Tabs ═══
    const totalUnread = state.conversations.reduce((s, c) => s + (c.unread || 0), 0);
    const archivedCount = state.conversations.filter(c => archivedUids.includes(c.peerUid)).length;
    
    const filters = [
      { id: 'all', label: 'الكل', count: state.conversations.filter(c => !archivedUids.includes(c.peerUid)).length, icon: '💬' },
      { id: 'unread', label: 'ما انقرت', count: totalUnread, icon: '🔴' },
      { id: 'pinned', label: 'مثبتة', count: pinnedUids.length, icon: '📌' },
      { id: 'archived', label: 'مؤرشف', count: archivedCount, icon: '📦' }
    ];

    const filterBar = DOM.h('div', { class: 'conv-filters' });
    filters.forEach(f => {
      if (f.id === 'archived' && f.count === 0) return; // hide archived if empty
      const tab = DOM.h('button', {
        class: 'conv-filter' + (window._convFilter === f.id ? ' active' : ''),
        onclick: () => {
          window._convFilter = f.id;
          prefs.filter = f.id;
          saveConvPrefs(prefs);
          renderConversations();
        }
      },
        DOM.h('span', { class: 'conv-filter-icon' }, f.icon),
        DOM.h('span', { class: 'conv-filter-label' }, f.label),
        f.count > 0 ? DOM.h('span', { class: 'conv-filter-count' }, f.count > 99 ? '99+' : String(f.count)) : null
      );
      filterBar.appendChild(tab);
    });
    cont.appendChild(filterBar);

    // ═══ Bot card (only in "all" view, not filtered) ═══
    if (window._convFilter === 'all' && !window._convSearchQuery && window.Bot && window.Bot.renderBotCard) {
      window.Bot.renderBotCard(cont);
    }

    // ═══ Apply filters ═══
    let filtered = [...state.conversations];
    const query = (window._convSearchQuery || '').trim().toLowerCase();
    
    // Filter by type
    if (window._convFilter === 'unread') {
      filtered = filtered.filter(c => (c.unread || 0) > 0 && !archivedUids.includes(c.peerUid));
    } else if (window._convFilter === 'pinned') {
      filtered = filtered.filter(c => pinnedUids.includes(c.peerUid) && !archivedUids.includes(c.peerUid));
    } else if (window._convFilter === 'archived') {
      filtered = filtered.filter(c => archivedUids.includes(c.peerUid));
    } else {
      // all - exclude archived
      filtered = filtered.filter(c => !archivedUids.includes(c.peerUid));
    }
    
    // Apply search
    if (query) {
      filtered = filtered.filter(c => {
        const name = (c.peerName || '').toLowerCase();
        const username = (c.peerUsername || '').toLowerCase();
        const msg = (c.lastMessage || '').toLowerCase();
        return name.includes(query) || username.includes(query) || msg.includes(query);
      });
    }

    // ═══ Sort: pinned first, then by time ═══
    filtered.sort((a, b) => {
      const aPinned = pinnedUids.includes(a.peerUid);
      const bPinned = pinnedUids.includes(b.peerUid);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const aTime = a.lastMessageAt?.seconds || 0;
      const bTime = b.lastMessageAt?.seconds || 0;
      return bTime - aTime;
    });

    // ═══ Empty state ═══
    if (!filtered.length) {
      const emptyMessages = {
        all: { icon: '💬', title: 'ابدأ أول سواليفك!', desc: 'اذهب إلى تبويب "👥 ربعي" وسولف مع أي صديق' },
        unread: { icon: '✅', title: 'كل الدردشات مقروءة', desc: 'ما فيه رسايل جديدة حالياً' },
        pinned: { icon: '📌', title: 'ما فيه سواليف مثبتة', desc: 'اضغط ضغطة طويلة على أي سوالف عشان تثبتها' },
        archived: { icon: '📦', title: 'الأرشيف فاضي', desc: 'الدردشات المؤرشفة ستظهر هنا' }
      };
      const empty = emptyMessages[window._convFilter] || emptyMessages.all;
      
      if (query) {
        empty.title = 'ما لقينا شي';
        empty.desc = `لم نجد محادثات تطابق "${query}"`;
        empty.icon = '🔍';
      }
      
      cont.appendChild(DOM.h('div', { class: 'conv-empty' },
        DOM.h('div', { class: 'conv-empty-icon' }, empty.icon),
        DOM.h('div', { class: 'conv-empty-title' }, empty.title),
        DOM.h('div', { class: 'conv-empty-desc' }, empty.desc)
      ));
      return;
    }

    // ═══ Render conversations ═══
    for (const conv of filtered) {
      const isPinned = pinnedUids.includes(conv.peerUid);
      const isMuted = mutedUids.includes(conv.peerUid);
      const isArchived = archivedUids.includes(conv.peerUid);
      const hasUnread = (conv.unread || 0) > 0;
      const isMine = conv.lastMessageFrom === state.user.uid;
      const initial = (conv.peerName || conv.peerUsername || '?')[0].toUpperCase();
      
      const friend = state.friends.find(f => f.uid === conv.peerUid);
      const photoData = friend?.photoData || null;

      // Avatar
      const avatarEl = DOM.h('div', { class: 'conv-avatar' + (photoData ? ' has-img' : '') });
      if (photoData) {
        const img = document.createElement('img');
        img.src = photoData;
        img.alt = '';
        avatarEl.appendChild(img);
      } else {
        avatarEl.textContent = initial;
      }
      
      // Online indicator (placeholder - can be enhanced later)
      const onlineDot = DOM.h('span', { class: 'conv-online-dot' });
      avatarEl.appendChild(onlineDot);

      // Read status icon (for own messages)
      const readIcon = isMine ? DOM.h('span', { 
        class: 'conv-read-icon' + ((conv.unread || 0) === 0 ? ' seen' : '')
      }, (conv.unread || 0) === 0 ? '✓✓' : '✓') : null;

      // Card body
      const card = DOM.h('div', {
        class: 'conv-card' + 
               (hasUnread ? ' unread' : '') + 
               (isPinned ? ' pinned' : '') +
               (isMuted ? ' muted' : ''),
        'data-peer-uid': conv.peerUid,
        onclick: (e) => {
          // Don't open if clicking on action buttons
          if (e.target.closest('.conv-actions-menu')) return;
          const friendObj = state.friends.find(f => f.uid === conv.peerUid) || {
            uid: conv.peerUid, displayName: conv.peerName, username: conv.peerUsername
          };
          openChat(friendObj);
        }
      },
        avatarEl,
        DOM.h('div', { class: 'conv-body' },
          DOM.h('div', { class: 'conv-top-row' },
            DOM.h('div', { class: 'conv-name-wrap' },
              isPinned ? DOM.h('span', { class: 'conv-pin-icon' }, '📌') : null,
              DOM.h('div', { class: 'conv-name' }, conv.peerName || '@' + conv.peerUsername)
            ),
            DOM.h('div', { class: 'conv-time' }, formatSmartTime(conv.lastMessageAt))
          ),
          DOM.h('div', { class: 'conv-bottom-row' },
            DOM.h('div', { class: 'conv-last' },
              readIcon,
              DOM.h('span', { class: 'conv-last-text' }, getMessagePreview(conv))
            ),
            DOM.h('div', { class: 'conv-indicators' },
              isMuted ? DOM.h('span', { class: 'conv-muted-icon', title: 'مكتومة' }, '🔕') : null,
              hasUnread ? DOM.h('div', { 
                class: 'conv-badge' + (isMuted ? ' muted' : '')
              }, conv.unread > 99 ? '99+' : String(conv.unread)) : null
            )
          )
        ),
        // Menu button (3 dots)
        DOM.h('button', {
          class: 'conv-menu-btn',
          'aria-label': 'خيارات',
          onclick: (e) => {
            e.stopPropagation();
            showConvActionsMenu(conv, e.currentTarget);
          }
        }, '⋮')
      );
      
      // Long press support for mobile
      let pressTimer = null;
      card.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
          if (navigator.vibrate) navigator.vibrate(50);
          showConvActionsMenu(conv, card);
        }, 500);
      });
      card.addEventListener('touchend', () => clearTimeout(pressTimer));
      card.addEventListener('touchmove', () => clearTimeout(pressTimer));
      
      cont.appendChild(card);
    }
  }

  // ═══ Conversation Actions Menu (Pin, Mute, Archive, Delete) ═══
  function showConvActionsMenu(conv, anchorEl) {
    // Remove existing menu
    const existing = document.getElementById('convActionsMenu');
    if (existing) existing.remove();

    const prefs = loadConvPrefs();
    const pinnedUids = prefs.pinned || [];
    const mutedUids = prefs.muted || [];
    const archivedUids = prefs.archived || [];
    
    const isPinned = pinnedUids.includes(conv.peerUid);
    const isMuted = mutedUids.includes(conv.peerUid);
    const isArchived = archivedUids.includes(conv.peerUid);

    const menu = DOM.h('div', { 
      id: 'convActionsMenu',
      class: 'conv-actions-menu'
    });
    
    // Backdrop
    const backdrop = DOM.h('div', {
      class: 'conv-menu-backdrop',
      onclick: () => {
        menu.remove();
        backdrop.remove();
      }
    });
    document.body.appendChild(backdrop);

    // Header
    menu.appendChild(DOM.h('div', { class: 'conv-menu-header' },
      DOM.h('div', { class: 'conv-menu-name' }, conv.peerName || '@' + conv.peerUsername),
      DOM.h('div', { class: 'conv-menu-sub' }, 'اختر إجراء')
    ));

    // Actions
    const actions = [
      {
        icon: isPinned ? '📍' : '📌',
        label: isPinned ? 'شيل التثبيت' : 'ثبّتها فوق',
        color: 'var(--accent)',
        action: () => togglePin(conv.peerUid)
      },
      {
        icon: isMuted ? '🔔' : '🔕',
        label: isMuted ? 'تفعيل التنبيهات' : 'كتم التنبيهات',
        color: 'var(--warn)',
        action: () => toggleMute(conv.peerUid)
      },
      {
        icon: isArchived ? '📤' : '📦',
        label: isArchived ? 'اطلعها من الأرشيف' : 'حطها في الأرشيف',
        color: 'var(--text2)',
        action: () => toggleArchive(conv.peerUid)
      }
    ];

    if ((conv.unread || 0) > 0) {
      actions.splice(1, 0, {
        icon: '✓',
        label: 'علّمها كـ "انقرت"',
        color: 'var(--green-2)',
        action: () => markConvRead(conv.peerUid)
      });
    }

    actions.push({
      icon: '🗑️',
      label: 'ااحذف المحادثة',
      color: 'var(--danger)',
      action: () => deleteConv(conv.peerUid, conv.peerName)
    });

    actions.forEach(a => {
      menu.appendChild(DOM.h('button', {
        class: 'conv-menu-action',
        onclick: () => {
          menu.remove();
          backdrop.remove();
          a.action();
        }
      },
        DOM.h('span', { class: 'conv-menu-icon', style: { color: a.color } }, a.icon),
        DOM.h('span', { class: 'conv-menu-label' }, a.label)
      ));
    });

    document.body.appendChild(menu);
    requestAnimationFrame(() => {
      menu.classList.add('show');
      backdrop.classList.add('show');
    });
  }

  // ═══ Toggle Pin ═══
  function togglePin(peerUid) {
    const prefs = loadConvPrefs();
    prefs.pinned = prefs.pinned || [];
    const idx = prefs.pinned.indexOf(peerUid);
    if (idx >= 0) {
      prefs.pinned.splice(idx, 1);
      Toast.show('✅ تم شيل التثبيت', 'ok');
    } else {
      if (prefs.pinned.length >= 5) {
        Toast.show('⚠️ حدك الأقصى 5 سواليف مثبتة', 'warn');
        return;
      }
      prefs.pinned.push(peerUid);
      Toast.show('📌 تم الثبّتها فوق', 'ok');
    }
    saveConvPrefs(prefs);
    renderConversations();
  }

  // ═══ Toggle Mute ═══
  function toggleMute(peerUid) {
    const prefs = loadConvPrefs();
    prefs.muted = prefs.muted || [];
    const idx = prefs.muted.indexOf(peerUid);
    if (idx >= 0) {
      prefs.muted.splice(idx, 1);
      Toast.show('🔔 تم تفعيل التنبيهات', 'ok');
    } else {
      prefs.muted.push(peerUid);
      Toast.show('🔕 تم كتم التنبيهات', 'ok');
    }
    saveConvPrefs(prefs);
    renderConversations();
  }

  // ═══ Toggle Archive ═══
  function toggleArchive(peerUid) {
    const prefs = loadConvPrefs();
    prefs.archived = prefs.archived || [];
    const idx = prefs.archived.indexOf(peerUid);
    if (idx >= 0) {
      prefs.archived.splice(idx, 1);
      Toast.show('📤 تم إخراج المحادثة من الأرشيف', 'ok');
    } else {
      prefs.archived.push(peerUid);
      Toast.show('📦 تم حطها في الأرشيف المحادثة', 'ok');
    }
    saveConvPrefs(prefs);
    renderConversations();
  }

  // ═══ Mark as Read ═══
  async function markConvRead(peerUid) {
    try {
      const ref = window.FB.doc(window.FB.db, 'users', state.user.uid, 'conversations', peerUid);
      await window.FB.updateDoc(ref, { unread: 0 });
      Toast.show('✓ تم وضع علامة "انقرت"', 'ok');
    } catch (e) {
      Logger.warn('markConvRead', e.message);
    }
  }

  // ═══ Delete Conversation ═══
  async function deleteConv(peerUid, peerName) {
    if (!confirm(`ااحذف المحادثة مع ${peerName || 'هذا المستخدم'}؟\nلن تستطيع استرجاعها.`)) return;
    try {
      const ref = window.FB.doc(window.FB.db, 'users', state.user.uid, 'conversations', peerUid);
      await window.FB.deleteDoc(ref);
      
      // Also remove from prefs
      const prefs = loadConvPrefs();
      ['pinned', 'muted', 'archived'].forEach(key => {
        if (prefs[key]) {
          const idx = prefs[key].indexOf(peerUid);
          if (idx >= 0) prefs[key].splice(idx, 1);
        }
      });
      saveConvPrefs(prefs);
      
      Toast.show('🗑️ تم ااحذف المحادثة', 'ok');
    } catch (e) {
      Logger.warn('deleteConv', e.message);
      Toast.show('❌ فشل الحذف', 'err');
    }
  }

  function renderRequestsPanel() {
    const inList = $('#friendReqIncomingList');
    const outList = $('#friendReqOutgoingList');
    if (!inList || !outList) return;
    inList.innerHTML = ''; outList.innerHTML = '';

    if (state.incomingReqs.length) {
      inList.appendChild(DOM.h('div', { class: 'friends-section-title' },
        '🔔 طلبات جديدة ',
        DOM.h('span', { class: 'count' }, state.incomingReqs.length)
      ));
      for (const req of state.incomingReqs) {
        const initial = (req.displayName || req.username || '?')[0].toUpperCase();
        inList.appendChild(DOM.h('div', { class: 'friend-req-card' },
          DOM.h('div', { class: 'friend-avatar' }, initial),
          DOM.h('div', { class: 'friend-body' },
            DOM.h('div', { class: 'friend-name' }, req.displayName || req.username),
            DOM.h('div', { class: 'friend-username' }, '@' + req.username)
          ),
          DOM.h('div', { class: 'friend-req-actions' },
            DOM.h('button', {
              class: 'friend-req-btn accept',
              onclick: () => acceptFriendRequest(req)
            }, '✓ قبول'),
            DOM.h('button', {
              class: 'friend-req-btn reject',
              onclick: () => removeRequest(req, 'incoming')
            }, '✕')
          )
        ));
      }
    }

    if (state.outgoingReqs.length) {
      outList.appendChild(DOM.h('div', { class: 'friends-section-title' },
        '📤 طلبات مُرسلة ',
        DOM.h('span', { class: 'count' }, state.outgoingReqs.length)
      ));
      for (const req of state.outgoingReqs) {
        const initial = (req.displayName || req.username || '?')[0].toUpperCase();
        outList.appendChild(DOM.h('div', { class: 'friend-card', style: { opacity: '.75' } },
          DOM.h('div', { class: 'friend-avatar' }, initial),
          DOM.h('div', { class: 'friend-body' },
            DOM.h('div', { class: 'friend-name' }, req.displayName || req.username),
            DOM.h('div', { class: 'friend-username' }, '@' + req.username)
          ),
          DOM.h('button', {
            class: 'friend-del-btn',
            onclick: () => removeRequest(req, 'outgoing')
          }, 'إلغاء')
        ));
      }
    }

    if (!state.incomingReqs.length && !state.outgoingReqs.length) {
      inList.appendChild(DOM.h('div', { class: 'friends-empty' },
        DOM.h('div', { class: 'friends-empty-icon' }, '🔔'),
        DOM.h('div', null, 'لا توجد طلبات حالياً')
      ));
    }
  }

  function renderBlockedPanel() {
    const cont = $('#blockedList');
    if (!cont) return;
    cont.innerHTML = '';
    if (!state.blocked.length) {
      cont.appendChild(DOM.h('div', { class: 'friends-empty' },
        DOM.h('div', { class: 'friends-empty-icon' }, '🚫'),
        DOM.h('div', null, 'ما فيه محظورون')
      ));
      return;
    }
    for (const u of state.blocked) {
      const initial = (u.displayName || u.username || '?')[0].toUpperCase();
      cont.appendChild(DOM.h('div', { class: 'blocked-card' },
        DOM.h('div', { class: 'search-avatar' }, initial),
        DOM.h('div', { class: 'search-name' },
          DOM.h('div', { class: 'search-name-top' }, u.displayName || u.username),
          DOM.h('div', { class: 'search-name-handle' }, '@' + u.username)
        ),
        DOM.h('button', {
          class: 'unblock-btn',
          onclick: () => unblockUser(u)
        }, '✓ إلغاء الحظر')
      ));
    }
  }

  function tierOf(streak) {
    if (streak >= 90) return { name: 'أوبسيديان', icon: '🖤', cls: 'obsidian', next: null };
    if (streak >= 60) return { name: 'ذهبي', icon: '🥇', cls: 'gold', next: { name: 'أوبسيديان', at: 90 } };
    if (streak >= 30) return { name: 'برونزي', icon: '🥉', cls: 'bronze', next: { name: 'ذهبي', at: 60 } };
    return { name: 'مبتدئ', icon: '🌱', cls: '', next: { name: 'برونزي', at: 30 } };
  }

  function formatMemberSince(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return `📅 عضو قبل ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  async function openProfile(user) {
    if (!state.user || !user) return;
    const overlay = $('#profileOverlay');
    if (!overlay) { Logger.warn('Social.openProfile', 'overlay not found'); return; }
    const isMe = user.uid === state.user.uid;
    const isFriend = state.friends.some(f => f.uid === user.uid);
    const isBlocked = state.blocked.some(b => b.uid === user.uid);
    const isReqSent = state.outgoingReqs.some(r => r.uid === user.uid);
    const isReqReceived = state.incomingReqs.some(r => r.uid === user.uid);

    // إذا كانت بيانات ناقصة (مثلاً من نتيجة بحث)، اجلب الملف الكامل
    let fullProfile = user;
    let friendCount = 0;
    let memberSinceTs = null;

    // 1) جلب الملف الكامل (يعمل دائماً لأن القواعد تسمح)
    try {
      const ref = window.FB.doc(window.FB.db, 'users', user.uid);
      const snap = await window.FB.getDoc(ref);
      if (snap.exists()) {
        fullProfile = { ...user, ...snap.data() };
        memberSinceTs = fullProfile.createdAt;
      }
    } catch (e) { Logger.warn('Social.openProfile.getUser', e.message); }

    // 2) محاولة جلب عدد الأصدقاء (قد يفشل إذا ليس الملف الخاص بك - وهذا طبيعي)
    if (isMe) {
      friendCount = state.friends.length;
    } else if (isFriend) {
      // لو صديق، نحن نقرأ الصداقة من ملفنا — اعرض عدد من ملفنا
      friendCount = 0; // ما يمكن معرفته بدقة بدون قراءة ملفه
    } else {
      try {
        const frSnap = await window.FB.getDocs(
          window.FB.collection(window.FB.db, 'users', user.uid, 'friends')
        );
        friendCount = frSnap.size;
      } catch (e) {
        // permissions error متوقع — اكتبه warning فقط
        Logger.warn('Social.openProfile.friends', 'cannot count friends (expected)');
        friendCount = 0;
      }
    }

    const displayName = fullProfile.displayName || fullProfile.username || '?';
    const username = fullProfile.username || '';
    const streak = fullProfile.streak || 0;
    const maxStreak = fullProfile.maxStreak || 0;
    const tier = tierOf(streak);

    // رأس البطاقة
    const avatar = $('#profileBigAvatar');
    avatar.className = 'profile-big-avatar ' + tier.cls;
    avatar.innerHTML = '';
    avatar.appendChild(document.createTextNode(displayName[0].toUpperCase()));
    if (tier.cls) {
      const badge = DOM.h('span', { class: 'profile-tier-badge' }, tier.icon + ' ' + tier.name);
      avatar.appendChild(badge);
    }
    DOM.setText($('#profileBigName'), displayName + (isMe ? ' (أنت)' : ''));
    DOM.setText($('#profileBigHandle'), '@' + username);
    DOM.setText($('#profileMemberSince'), formatMemberSince(memberSinceTs));

    // شارة العلاقة
    const relBadge = $('#profileRelBadge');
    relBadge.innerHTML = '';
    if (isMe) {
      relBadge.appendChild(DOM.h('span', { class: 'profile-relationship-badge' }, '👤 هذا ملفك'));
    } else if (isBlocked) {
      relBadge.appendChild(DOM.h('span', { class: 'profile-relationship-badge blocked' }, '🚫 محظور'));
    } else if (isFriend) {
      relBadge.appendChild(DOM.h('span', { class: 'profile-relationship-badge friend' }, '✓ صديق'));
    } else if (isReqSent) {
      relBadge.appendChild(DOM.h('span', { class: 'profile-relationship-badge pending' }, '⏳ طلب مُرسل'));
    } else if (isReqReceived) {
      relBadge.appendChild(DOM.h('span', { class: 'profile-relationship-badge pending' }, '🔔 أرسل لك طلب'));
    }

    // الإحصائيات
    DOM.setText($('#profileStreakNum'), streak);
    DOM.setText($('#profileMaxStreakNum'), maxStreak);
    DOM.setText($('#profileFriendsNum'), friendCount);

    // قسم المستوى
    DOM.setText($('#profileTierIcon'), tier.icon);
    DOM.setText($('#profileTierName'), tier.name);
    if (tier.next) {
      const remaining = tier.next.at - streak;
      DOM.setText($('#profileNextTier'), `${remaining} يوم للوصول لـ ${tier.next.name}`);
    } else {
      DOM.setText($('#profileNextTier'), 'وصلت لأعلى مستوى 👑');
    }

    // الأزرار
    const actions = $('#profileActions');
    actions.innerHTML = '';
    if (isMe) {
      actions.appendChild(DOM.h('div', { class: 'pa-row' },
        DOM.h('button', {
          class: 'profile-action-btn secondary',
          onclick: () => closeProfile()
        }, 'إغلاق')
      ));
    } else if (isBlocked) {
      actions.appendChild(DOM.h('div', { class: 'pa-row' },
        DOM.h('button', {
          class: 'profile-action-btn primary',
          onclick: () => { unblockUser(fullProfile); closeProfile(); }
        }, '✓ إلغاء الحظر')
      ));
    } else if (isReqReceived) {
      const req = state.incomingReqs.find(r => r.uid === user.uid);
      actions.appendChild(DOM.h('div', { class: 'pa-row' },
        DOM.h('button', {
          class: 'profile-action-btn accept',
          onclick: () => { acceptFriendRequest(req); closeProfile(); }
        }, '✓ قبول الطلب'),
        DOM.h('button', {
          class: 'profile-action-btn danger',
          onclick: () => { removeRequest(req, 'incoming'); closeProfile(); }
        }, '✕ رفض')
      ));
    } else if (isFriend) {
      actions.appendChild(DOM.h('div', { class: 'pa-row' },
        DOM.h('button', {
          class: 'profile-action-btn primary',
          onclick: () => { closeProfile(); openChat(fullProfile); }
        }, '💬 إرسال رسالة')
      ));
      actions.appendChild(DOM.h('div', { class: 'pa-row' },
        DOM.h('button', {
          class: 'profile-action-btn danger',
          onclick: () => { closeProfile(); blockUser(fullProfile); }
        }, '🚫 حظر'),
        DOM.h('button', {
          class: 'profile-action-btn secondary',
          onclick: () => { closeProfile(); removeFriend(fullProfile); }
        }, '✕ حذف')
      ));
    } else if (isReqSent) {
      const req = state.outgoingReqs.find(r => r.uid === user.uid);
      actions.appendChild(DOM.h('div', { class: 'pa-row' },
        DOM.h('button', {
          class: 'profile-action-btn secondary',
          onclick: () => { removeRequest(req, 'outgoing'); closeProfile(); }
        }, 'إلغاء الطلب')
      ));
    } else {
      actions.appendChild(DOM.h('div', { class: 'pa-row' },
        DOM.h('button', {
          class: 'profile-action-btn primary',
          onclick: () => { sendFriendRequest(fullProfile); closeProfile(); }
        }, '➕ إرسال طلب صداقة')
      ));
      actions.appendChild(DOM.h('div', { class: 'pa-row' },
        DOM.h('button', {
          class: 'profile-action-btn danger',
          onclick: () => { closeProfile(); blockUser(fullProfile); }
        }, '🚫 حظر')
      ));
    }

    overlay.classList.add('open');
  }

  function closeProfile() {
    $('#profileOverlay')?.classList.remove('open');
  }

  function showFriendMenu(anchor, friend) {
    const overlay = $('#friendMenuOverlay');
    const popup = $('#friendMenuPopup');
    if (!overlay || !popup) return;
    popup.innerHTML = '';
    popup.appendChild(DOM.h('button', {
      class: 'friend-menu-item',
      onclick: () => { hideFriendMenu(); openProfile(friend); }
    }, DOM.h('span', { class: 'friend-menu-item-icon' }, '👤'), 'عرض الملف الشخصي'));
    popup.appendChild(DOM.h('button', {
      class: 'friend-menu-item',
      onclick: () => { hideFriendMenu(); openChat(friend); }
    }, DOM.h('span', { class: 'friend-menu-item-icon' }, '💬'), 'إرسال رسالة'));
    popup.appendChild(DOM.h('button', {
      class: 'friend-menu-item danger',
      onclick: () => { hideFriendMenu(); removeFriend(friend); }
    }, DOM.h('span', { class: 'friend-menu-item-icon' }, '✕'), 'حذف من الأصدقاء'));
    popup.appendChild(DOM.h('button', {
      class: 'friend-menu-item danger',
      onclick: () => { hideFriendMenu(); blockUser(friend); }
    }, DOM.h('span', { class: 'friend-menu-item-icon' }, '🚫'), 'حظر المستخدم'));

    const rect = anchor.getBoundingClientRect();
    const popupW = 200;
    let left = rect.right - popupW;
    if (left < 10) left = 10;
    if (left + popupW > window.innerWidth - 10) left = window.innerWidth - popupW - 10;
    popup.style.left = left + 'px';
    popup.style.top = (rect.bottom + 6) + 'px';
    overlay.classList.add('open');
  }

  function hideFriendMenu() {
    $('#friendMenuOverlay')?.classList.remove('open');
  }

  function autoResizeInput() {
    const input = $('#chatInput');
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(100, input.scrollHeight) + 'px';
  }

  async function signOut() {
    if (!confirm('تسجيل الخروج؟')) return;
    try {
      await window.FB.signOut(window.FB.auth);
      Toast.show('تم تسجيل الخروج. نشوفك على خير!. نشوفك على خير! 👋');
    } catch (e) { Logger.error('Social.signOut', e); }
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.authMode === mode));
    const isSignup = mode === 'signup';
    DOM.show($('#authName'), isSignup);
    DOM.show($('#authUsername'), isSignup);
    $('#authTitle').textContent = isSignup ? 'فتح فتح حساب' : 'تسجيل الدخول';
    $('#authSub').textContent = isSignup ? 'أنشئ حسابك للتواصل مع الأصدقاء' : 'حط بياناتك عشان نكمل';
    $('#authSubmitBtn').textContent = isSignup ? '✨ سوي حساب' : '🔐 ادخل';
    showAuthError('');
  }
  function showAuthError(msg) {
    const el = $('#authError'); if (!el) return;
    if (msg) { el.textContent = msg; el.classList.add('show'); }
    else el.classList.remove('show');
  }
  function friendlyAuthError(err) {
    const map = {
      'auth/invalid-email': 'بريد غير صحيح',
      'auth/user-not-found': 'ما فيه حساب بهذا البريد',
      'auth/wrong-password': 'الرقم السري خاطئة',
      'auth/invalid-credential': 'البيانات غير صحيحة',
      'auth/email-already-in-use': 'البريد مستخدم بالفعل',
      'auth/weak-password': 'الرقم السري ضعيفة',
      'auth/too-many-requests': 'محاولات كثيرة، حاول بعد قليل',
      'auth/popup-closed-by-user': 'تم إغلاق النافذة',
      'auth/popup-blocked': 'المتصفح حجب النافذة',
      'auth/network-request-failed': 'مشكلة اتصال'
    };
    return map[err?.code] || err?.message || 'صار خطأ';
  }
  async function handleAuthSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!state.fbReady) { showAuthError('اصبر شوي...'); return; }
    const email = $('#authEmail')?.value?.trim();
    const pass = $('#authPass')?.value;
    if (!email || !pass) { showAuthError('كمّل البيانات اللي ناقصة'); return; }
    if (pass.length < 6) { showAuthError('الرقم السري لازم ٦ حروف أو أكثر'); return; }
    const btn = $('#authSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    try {
      if (state.authMode === 'signup') {
        const cred = await window.FB.signUp(window.FB.auth, email, pass);
        const displayName = U.str($('#authName')?.value, 30);
        const customUsername = U.str($('#authUsername')?.value, 20)
          .replace(/[^a-z0-9]/gi, '').toLowerCase();
        if (displayName) {
          try { await window.FB.updateProfile(cred.user, { displayName }); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
        }
        if (customUsername) {
          const qq = window.FB.query(
            window.FB.collection(window.FB.db, 'users'),
            window.FB.where('username', '==', customUsername),
            window.FB.limit(1)
          );
          const s = await window.FB.getDocs(qq);
          if (!s.empty) {
            showAuthError('اسم المستخدم مستخدم من قبل — اختار غيره');
            try { await cred.user.delete(); } catch (e) { if (window.Logger) Logger.warn('Social', e?.message); }
            return;
          }
          const ref = window.FB.doc(window.FB.db, 'users', cred.user.uid);
          await window.FB.setDoc(ref, {
            uid: cred.user.uid, email: cred.user.email,
            username: customUsername,
            displayName: displayName || cred.user.email.split('@')[0],
            createdAt: window.FB.serverTimestamp(), streak: 0, maxStreak: 0
          });
        }
        Toast.show('يا هلا بك! 🎉', 'success');
      } else {
        await window.FB.signIn(window.FB.auth, email, pass);
        Toast.show('أهلاً بعودتك 👋', 'success');
      }
      $('#authOverlay').classList.remove('open');
    } catch (err) { showAuthError(friendlyAuthError(err)); }
    finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = state.authMode === 'signup' ? '✨ سوي حساب' : '🔐 ادخل';
      }
    }
  }
  async function handleGoogleSignIn() {
    if (!state.fbReady) return;
    try {
      await window.FB.signInWithPopup(window.FB.auth, window.FB.googleProvider);
      $('#authOverlay').classList.remove('open');
      Toast.show('أهلاً 🎉', 'success');
    } catch (err) { showAuthError(friendlyAuthError(err)); }
  }
  async function handleForgot() {
    const email = $('#authEmail')?.value?.trim();
    if (!email) { showAuthError('أدخل بريدك أولاً'); return; }
    if (!state.fbReady) return;
    try {
      await window.FB.sendPasswordResetEmail(window.FB.auth, email);
      Toast.show('أُرسل رابط الاستعادة 📧', 'success');
    } catch (err) { showAuthError(friendlyAuthError(err)); }
  }

  function bindEvents() {
    window.__setAuthMode = setAuthMode;
    window.__authSubmit = handleAuthSubmit;
    window.__googleSignIn = handleGoogleSignIn;
    window.__authForgot = handleForgot;

    DOM.delegate(document, 'click', '.friends-sub-tab', (e, btn) => switchSubTab(btn.dataset.fsub));

    $('#userSearchInput')?.addEventListener('input', (e) => searchUsersDebounced(e.target.value));
    $('#userSearchBtn')?.addEventListener('click', () => {
      const v = $('#userSearchInput').value;
      if (v) searchUsersDebounced(v);
    });
    $('#userSearchInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = e.target.value;
        if (v) searchUsersDebounced(v);
      }
    });

    $('#copyMyCodeBtn')?.addEventListener('click', () => {
      const code = state.profile?.username ? '@' + state.profile.username : '';
      if (!code) return;
      try {
        navigator.clipboard.writeText(code);
        Toast.show('تم نسخ الكود 📋', 'success');
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); Toast.show('تم النسخ 📋', 'success'); }
        catch { Toast.show('فشل النسخ', 'danger'); }
        document.body.removeChild(ta);
      }
    });

    $('#signOutBtn')?.addEventListener('click', signOut);

    $('#chatBackBtn')?.addEventListener('click', closeChat);
    $('#chatOverlay')?.addEventListener('click', closeChat);
    $('#chatInput')?.addEventListener('input', (e) => {
      autoResizeInput();
      $('#chatSendBtn').disabled = !e.target.value.trim();
      // أخفِ Quick Chips إذا بدأ بالكتابة
      const chips = $('#chatQuickChips');
      if (chips && e.target.value.trim()) {
        chips.style.display = 'none';
      }
    });
    $('#chatInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!$('#chatSendBtn').disabled) sendMessage();
      }
    });
    $('#chatSendBtn')?.addEventListener('click', sendMessage);
    
    // Quick Reply Chips
    $$('.chat-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const reply = chip.dataset.reply;
        if (!reply) return;
        const input = $('#chatInput');
        if (input) {
          input.value = reply;
          $('#chatSendBtn').disabled = false;
          input.focus();
          // أخفِ Quick Chips
          const chips = $('#chatQuickChips');
          if (chips) chips.style.display = 'none';
        }
      });
    });
    $('#chatMenuBtn')?.addEventListener('click', (e) => {
      if (state.activeChat) {
        const friend = state.friends.find(f => f.uid === state.activeChat.peerUid) || {
          uid: state.activeChat.peerUid,
          displayName: state.activeChat.peerName,
          username: state.activeChat.peerUsername
        };
        showFriendMenu(e.currentTarget, friend);
      }
    });

    $('#friendMenuOverlay')?.addEventListener('click', hideFriendMenu);

    // رأس الدردشة: الضغط على اسم/صورة الشخص يفتح ملفه
    $('#chatPeerAvatar')?.addEventListener('click', () => {
      if (!state.activeChat) return;
      const peer = state.friends.find(f => f.uid === state.activeChat.peerUid) || {
        uid: state.activeChat.peerUid,
        displayName: state.activeChat.peerName,
        username: state.activeChat.peerUsername
      };
      openProfile(peer);
    });
    $('#chatPeerName')?.addEventListener('click', () => {
      if (!state.activeChat) return;
      const peer = state.friends.find(f => f.uid === state.activeChat.peerUid) || {
        uid: state.activeChat.peerUid,
        displayName: state.activeChat.peerName,
        username: state.activeChat.peerUsername
      };
      openProfile(peer);
    });
    if ($('#chatPeerAvatar')) $('#chatPeerAvatar').style.cursor = 'pointer';
    if ($('#chatPeerName')) $('#chatPeerName').style.cursor = 'pointer';

    // إغلاق نافذة البروفايل
    $('#profileCloseBtn')?.addEventListener('click', closeProfile);
    $('#profileOverlay')?.addEventListener('click', (e) => {
      if (e.target === $('#profileOverlay')) closeProfile();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if ($('#profileOverlay')?.classList.contains('open')) closeProfile();
        else if ($('#chatPanel')?.classList.contains('open')) closeChat();
        if ($('#friendMenuOverlay')?.classList.contains('open')) hideFriendMenu();
      }
    });
  }

  return {
    init, bindEvents, renderFriendsTab, syncStreak,
    openChat, closeChat, sendMessage,
    blockUser, unblockUser, setAuthMode,
    openProfile, closeProfile,
    // Debug exposure
    _state: state
  };
})();

// expose for debugging
window.Social = Social;

/* ═══════════════════════════════════════════════════
   TDBEER — AI Bot (تـدّبير AI)
   بوت ذكي يحلل بياناتك + شخصية متكيفة
═══════════════════════════════════════════════════ */
