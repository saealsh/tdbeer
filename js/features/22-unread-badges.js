/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Unread Badges Manager
   ───────────────────────────────────────────────────────────────────
   يدير unread badges في:
   - Bottom Nav (tab "المزيد") — total unread
   - Sub-Nav profile (button "الأصدقاء") — total unread
   - Friends sub-tabs (chats, requests) — counts
═══════════════════════════════════════════════════════════════════ */

var UnreadBadges = (() => {
  let updateTimer = null;
  
  /**
   * يحسب عدد الرسائل غير المقروءة من Social state
   */
  function getUnreadCount() {
    try {
      const conversations = window.Social?._state?.conversations || [];
      const myUid = window.Social?._state?.user?.uid;
      if (!myUid) return 0;
      
      let total = 0;
      for (const conv of conversations) {
        const unread = conv.unreadByUser?.[myUid] || 0;
        total += unread;
      }
      return total;
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * يحسب عدد طلبات الصداقة المعلقة
   */
  function getRequestsCount() {
    try {
      const requests = window.Social?._state?.requests || [];
      return requests.length;
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * يحسب عدد الأصدقاء
   */
  function getFriendsCount() {
    try {
      return (window.Social?._state?.friends || []).length;
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * يحسب عدد المحادثات
   */
  function getChatsCount() {
    try {
      return (window.Social?._state?.conversations || []).length;
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * يحسب عدد المحظورين
   */
  function getBlockedCount() {
    try {
      return (window.Social?._state?.blocked || []).length;
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * يحدّث badge واحد
   */
  function updateBadge(badgeEl, count, options = {}) {
    if (!badgeEl) return;
    
    const { hideAtZero = true, max = 99, dotOnly = false } = options;
    
    if (count <= 0 && hideAtZero) {
      badgeEl.style.display = 'none';
      badgeEl.removeAttribute('data-count');
      return;
    }
    
    badgeEl.style.display = '';
    badgeEl.setAttribute('data-count', String(count));
    
    if (dotOnly) {
      badgeEl.textContent = '';
      badgeEl.classList.remove('has-count');
    } else {
      badgeEl.textContent = count > max ? `${max}+` : String(count);
      badgeEl.classList.add('has-count');
    }
  }
  
  /**
   * يحدّث كل الـ badges
   */
  function update() {
    try {
      const unread = getUnreadCount();
      const requests = getRequestsCount();
      const friends = getFriendsCount();
      const chats = getChatsCount();
      const blocked = getBlockedCount();
      
      // إجمالي الإشعارات للـ Bottom Nav
      const totalNotifs = unread + requests;
      
      // 1. Bottom Nav (tab المزيد)
      const profileBadge = document.getElementById('profileTabBadge');
      updateBadge(profileBadge, totalNotifs, { dotOnly: false, max: 9 });
      
      // 2. Sub-Nav (button الأصدقاء)
      const friendsSubNavBadge = document.getElementById('friendsSubNavBadge');
      updateBadge(friendsSubNavBadge, totalNotifs);
      
      // 3. Friends sub-tabs counters
      const cntChats = document.getElementById('cntChats');
      const cntList = document.getElementById('cntList');
      const cntReq = document.getElementById('cntReq');
      const cntBlocked = document.getElementById('cntBlocked');
      
      if (cntChats) {
        // عدد المحادثات (أو unread لو في)
        cntChats.textContent = unread > 0 ? String(unread) : (chats > 0 ? String(chats) : '');
        cntChats.style.display = (unread > 0 || chats > 0) ? '' : 'none';
        cntChats.style.background = unread > 0 ? '#ef4444' : 'var(--accent)';
        cntChats.style.color = unread > 0 ? 'white' : 'var(--bg)';
      }
      
      if (cntList) {
        cntList.textContent = friends > 0 ? String(friends) : '';
        cntList.style.display = friends > 0 ? '' : 'none';
      }
      
      if (cntReq) {
        cntReq.textContent = requests > 0 ? String(requests) : '';
        cntReq.style.display = requests > 0 ? '' : 'none';
        if (requests > 0) {
          cntReq.style.background = '#ef4444';
          cntReq.style.color = 'white';
        }
      }
      
      if (cntBlocked) {
        cntBlocked.textContent = blocked > 0 ? String(blocked) : '';
        cntBlocked.style.display = blocked > 0 ? '' : 'none';
      }
      
      // 4. Sidebar - dot على group header + sub-badges
      const sidebarDot = document.getElementById('sidebarUnreadDot');
      if (sidebarDot) {
        sidebarDot.style.display = totalNotifs > 0 ? '' : 'none';
      }
      
      // 4b. Sidebar sub-item badges (Chats, Friends, Requests)
      const sidebarChatsBadge = document.getElementById('sidebarChatsBadge');
      const sidebarFriendsBadge = document.getElementById('sidebarFriendsBadge');
      const sidebarRequestsBadge = document.getElementById('sidebarRequestsBadge');
      
      updateBadge(sidebarChatsBadge, unread, { max: 99 });
      // ما نظهر badge للأصدقاء إلا لو في طلبات
      if (sidebarFriendsBadge) sidebarFriendsBadge.style.display = 'none';
      updateBadge(sidebarRequestsBadge, requests, { max: 99 });
      
      // 5. Document title (للـ desktop)
      try {
        const baseTitle = 'تـدّبير';
        if (totalNotifs > 0) {
          document.title = `(${totalNotifs}) ${baseTitle}`;
        } else {
          document.title = baseTitle;
        }
      } catch {}
      
    } catch (e) {
      if (window.Logger) window.Logger.warn('UnreadBadges.update', e?.message);
    }
  }
  
  /**
   * يحدّث بعد debounce (لتقليل الإعادات)
   */
  function scheduleUpdate(delay = 300) {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(update, delay);
  }
  
  /**
   * Init - يبدأ المراقبة
   */
  function init() {
    // أول تحديث
    setTimeout(update, 1000);
    
    // مراقبة Social state
    const watchSocial = setInterval(() => {
      if (window.Social?._state) {
        clearInterval(watchSocial);
        // أعد التحديث بعد ما Social load
        scheduleUpdate(500);
        
        // مراقبة دورية كل 5 ثواني (مع توقف عند خفاء التطبيق)
        if (window.Performance?.scheduleEvery) {
          window.Performance.scheduleEvery(5000, scheduleUpdate, 'unread-badges');
        } else {
          setInterval(scheduleUpdate, 5000);
        }
      }
    }, 200);
    
    // تحديث عند تغيير الـ tab
    if (window.App?.store) {
      window.App.store.subscribe('tab', () => scheduleUpdate(200));
    }
    
    // تحديث عند ظهور النافذة بعد ما كانت مخفية
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleUpdate(100);
    });
  }
  
  return { init, update, scheduleUpdate, getUnreadCount, getRequestsCount };
})();

window.Tdbeer = window.Tdbeer || {};
window.Tdbeer.UnreadBadges = UnreadBadges;
window.UnreadBadges = UnreadBadges;
