/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Image Handler (avatars, compression)
   ───────────────────────────────────────────────────────────────────
   Originally lines 18091–18622 of index.html
═══════════════════════════════════════════════════════════════════ */

var ImageHandler = (() => {
  const { DOM, $, $$, Logger, U, Fmt } = Tdbeer;
  const { Toast } = App;

  const state = {
    pendingImage: null, // { dataUrl, ephemeral }
    pendingProfile: null, // { dataUrl }
    viewerTimer: null,
    viewerTimeLeft: 0
  };

  // ═══ IMAGE COMPRESSION ═══
  // يضغط الصورة ويحولها إلى Base64 صغير
  async function compressImage(file, options = {}) {
    const maxWidth = options.maxWidth || 800;
    const maxHeight = options.maxHeight || 800;
    const quality = options.quality || 0.75;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('فشل قراءة الملف'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('صورة غير صالحة'));
        img.onload = () => {
          let w = img.width;
          let h = img.height;

          // احسب الأبعاد الجديدة مع الحفاظ على النسبة
          if (w > h) {
            if (w > maxWidth) {
              h = (h * maxWidth) / w;
              w = maxWidth;
            }
          } else {
            if (h > maxHeight) {
              w = (w * maxHeight) / h;
              h = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // حساب حجم Base64
  function getBase64Size(dataUrl) {
    // base64 يحسب بالتقريب: length * 0.75
    const base64 = dataUrl.split(',')[1] || '';
    return Math.ceil(base64.length * 0.75);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ═══ PROFILE PICTURE ═══
  function openProfilePicker() {
    const overlay = $('#profilePicUploadOverlay');
    if (!overlay) return;

    state.pendingProfile = null;

    // reset UI
    $('#profilePicPreviewImg').style.display = 'none';
    $('#profilePicPreviewPlaceholder').style.display = 'flex';
    $('#profilePicSaveBtn').disabled = true;

    // Load current profile pic if exists
    const social = window.Social;
    const currentPic = social?._state?.profile?.photoData;
    if (currentPic) {
      $('#profilePicPreviewImg').src = currentPic;
      $('#profilePicPreviewImg').style.display = 'block';
      $('#profilePicPreviewPlaceholder').style.display = 'none';
    }

    overlay.classList.add('open');
  }

  function closeProfilePicker() {
    $('#profilePicUploadOverlay')?.classList.remove('open');
    state.pendingProfile = null;
  }

  async function handleProfileFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
      Toast.show('لازم اختيار صورة', 'warn');
      return;
    }

    try {
      Toast.show('⏳ جاري الضغط...', 'info');
      // صورة بروفايل: 400x400، جودة 0.85
      const dataUrl = await compressImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85
      });

      const size = getBase64Size(dataUrl);

      if (size > 500 * 1024) {
        Toast.show('الصورة كبيرة جداً', 'warn');
        return;
      }

      // Preview
      $('#profilePicPreviewImg').src = dataUrl;
      $('#profilePicPreviewImg').style.display = 'block';
      $('#profilePicPreviewPlaceholder').style.display = 'none';
      $('#profilePicSaveBtn').disabled = false;
      state.pendingProfile = { dataUrl, size };

    } catch (e) {
      Logger.error('Image.profile', e);
      Toast.show('فشل معالجة الصورة', 'danger');
    }
  }

  async function saveProfilePicture() {
    if (!state.pendingProfile) return;

    const social = window.Social;
    if (!social?._state?.user) {
      Toast.show('لازم تسجيل الدخول', 'warn');
      return;
    }

    try {
      Toast.show('⏳ جاري الااحفظ...', 'info');
      const db = window.firebase.firestore();
      const uid = social._state.user.uid;

      // اااحفظ في وثيقة المستخدم
      await db.collection('users').doc(uid).update({
        photoData: state.pendingProfile.dataUrl,
        photoUpdatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });

      // حدّث الحالة المحلية
      if (social._state.profile) {
        social._state.profile.photoData = state.pendingProfile.dataUrl;
      }

      Toast.show('✅ تم ااحفظ صورة العرض', 'success');
      closeProfilePicker();

      // تحديث الواجهة
      updateProfilePicDisplay();

    } catch (e) {
      Logger.error('Image.save', e);
      Toast.show('فشل الااحفظ: ' + (e.message || ''), 'danger');
    }
  }

  // تحديث عرض صورة البروفايل في كل الأماكن
  function updateProfilePicDisplay() {
    try {
      const social = window.Social;
      const myPic = social?._state?.profile?.photoData;

      // في الإعدادات / البروفايل
      document.querySelectorAll('.user-profile-avatar, .my-profile-avatar').forEach(el => {
        renderAvatarImage(el, myPic);
      });

      // إعادة render للأصدقاء
      if (social?.renderFriendsTab) social.renderFriendsTab();

    } catch (e) { Logger.warn('Image.updateDisplay', e.message); }
  }

  // تحويل avatar عادي إلى avatar مع صورة
  function renderAvatarImage(element, dataUrl) {
    if (!element) return;
    if (dataUrl) {
      element.classList.add('has-img');
      element.innerHTML = '';
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'صورة';
      element.appendChild(img);
    } else {
      element.classList.remove('has-img');
      // Keep original content
    }
  }

  // ═══ CHAT IMAGE MESSAGES ═══
  async function handleChatImageSelect(file, ephemeral = false) {
    if (!file || !file.type.startsWith('image/')) {
      Toast.show('لازم اختيار صورة', 'warn');
      return;
    }

    try {
      Toast.show('⏳ جاري الضغط...', 'info');
      // صور الشات: 800x800، جودة 0.75
      const dataUrl = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.75
      });

      const size = getBase64Size(dataUrl);

      if (size > 700 * 1024) {
        Toast.show('الصورة كبيرة - جرّب صورة أصغر', 'warn');
        return;
      }

      // Preview
      state.pendingImage = { dataUrl, ephemeral, size };
      showImagePreview();

    } catch (e) {
      Logger.error('Image.chat', e);
      Toast.show('فشل معالجة الصورة', 'danger');
    }
  }

  function showImagePreview() {
    if (!state.pendingImage) return;
    const overlay = $('#imgPreviewOverlay');
    const img = $('#imgPreviewImg');
    const caption = $('#imgPreviewCaption');
    const sendBtn = $('#imgPreviewSendBtn');

    if (!overlay || !img) return;

    img.src = state.pendingImage.dataUrl;
    if (caption) caption.value = '';

    // Update send button label
    if (sendBtn) {
      sendBtn.textContent = state.pendingImage.ephemeral ? '👁️ إرسال مؤقتة' : '📤 إرسال';
      sendBtn.className = 'img-preview-btn ' + (state.pendingImage.ephemeral ? 'ephemeral' : 'send');
    }

    overlay.classList.add('open');
  }

  function closeImagePreview() {
    $('#imgPreviewOverlay')?.classList.remove('open');
    state.pendingImage = null;
  }

  async function sendImageMessage() {
    if (!state.pendingImage) return;

    const social = window.Social;
    if (!social?._state?.activeChat) {
      Toast.show('ما فيه محادثة نشطة', 'warn');
      return;
    }

    const chat = social._state.activeChat;

    if (chat.isBot) {
      Toast.show('🤖 البوت لا يستقبل صور', 'warn');
      return;
    }

    try {
      const user = social._state.user;
      if (!user) throw new Error('Not signed in');

      const db = window.firebase.firestore();
      const caption = $('#imgPreviewCaption')?.value?.trim() || '';

      const msgData = {
        from: user.uid,
        to: chat.peerUid,
        type: state.pendingImage.ephemeral ? 'image-ephemeral' : 'image',
        imageData: state.pendingImage.dataUrl,
        imageSize: state.pendingImage.size,
        text: caption || (state.pendingImage.ephemeral ? '👁️ صورة مؤقتة' : '🖼️ صورة'),
        at: window.firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
        viewed: false
      };

      const chatId = chat.chatId;
      await db.collection('chats').doc(chatId)
        .collection('messages').add(msgData);

      Toast.show(state.pendingImage.ephemeral ? '👁️ تم الإرسال (مؤقتة)' : '✅ تم الإرسال', 'success');
      closeImagePreview();

    } catch (e) {
      Logger.error('Image.send', e);
      Toast.show('فشل الإرسال: ' + (e.message || ''), 'danger');
    }
  }

  // ═══ IMAGE VIEWER ═══
  function openImageViewer(dataUrl, ephemeralMessage = null) {
    const overlay = $('#imgViewerOverlay');
    const img = $('#imgViewerImg');
    const timer = $('#imgViewerTimer');
    const timerText = $('#imgViewerTimerText');

    if (!overlay || !img) return;

    img.src = dataUrl;
    overlay.classList.add('open');

    // Ephemeral: show timer and auto-close
    if (ephemeralMessage) {
      state.viewerTimeLeft = 10;
      if (timer) timer.style.display = 'flex';
      if (timerText) timerText.textContent = state.viewerTimeLeft;

      state.viewerTimer = setInterval(() => {
        state.viewerTimeLeft--;
        if (timerText) timerText.textContent = state.viewerTimeLeft;

        if (state.viewerTimeLeft <= 0) {
          // احذف الصورة من Firestore
          markEphemeralViewed(ephemeralMessage);
          closeImageViewer();
        }
      }, 1000);
    } else {
      if (timer) timer.style.display = 'none';
    }
  }

  function closeImageViewer() {
    $('#imgViewerOverlay')?.classList.remove('open');
    if (state.viewerTimer) {
      clearInterval(state.viewerTimer);
      state.viewerTimer = null;
    }
  }

  async function markEphemeralViewed(msg) {
    try {
      const social = window.Social;
      if (!social?._state?.activeChat) return;

      const chatId = social._state.activeChat.chatId;
      const db = window.firebase.firestore();

      // حدّث الرسالة - احذف imageData
      await db.collection('chats').doc(chatId)
        .collection('messages').doc(msg.id)
        .update({
          imageData: null,
          viewed: true,
          viewedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });

    } catch (e) {
      console.warn('[Image] markViewed error:', e.message);
    }
  }

  // ═══ RENDER MESSAGE BUBBLE ═══
  function renderImageBubble(msg, isMine) {
    const bubble = DOM.h('div', { class: 'msg ' + (isMine ? 'mine' : 'theirs') });

    const isEphemeral = msg.type === 'image-ephemeral';
    const hasData = !!msg.imageData;

    if (isEphemeral && !hasData) {
      // Image was viewed and deleted
      const locked = DOM.h('div', { class: 'msg-img-locked' },
        DOM.h('div', { class: 'msg-img-locked-icon' }, '👁️'),
        DOM.h('div', { class: 'msg-img-locked-text' }, 'تم عرض الصورة'),
        DOM.h('div', { class: 'msg-img-locked-hint' }, 'اختفت بعد المشاهدة')
      );
      bubble.appendChild(locked);
    } else if (hasData) {
      const wrap = DOM.h('div', {
        class: 'msg-img-wrap' + (isEphemeral ? ' msg-img-ephemeral' : '')
      });

      if (isEphemeral && !isMine && !msg.viewed) {
        // Receiver sees ephemeral badge
        wrap.appendChild(DOM.h('div', { class: 'msg-img-ephemeral-badge' }, '👁️ مؤقتة'));
      } else if (isEphemeral) {
        wrap.appendChild(DOM.h('div', { class: 'msg-img-ephemeral-badge' }, '👁️'));
      }

      const img = DOM.h('img', {
        src: msg.imageData,
        alt: 'صورة',
        loading: 'lazy'
      });
      wrap.appendChild(img);

      wrap.onclick = () => {
        if (isEphemeral && !isMine && !msg.viewed) {
          // فتح مع عداد + حذف بعد المشاهدة
          openImageViewer(msg.imageData, msg);
        } else {
          openImageViewer(msg.imageData, null);
        }
      };

      bubble.appendChild(wrap);
    }

    // Caption
    if (msg.text && msg.text !== '🖼️ صورة' && msg.text !== '👁️ صورة مؤقتة') {
      bubble.appendChild(DOM.h('div', {
        class: 'msg-text',
        style: { marginTop: '6px', fontSize: '13px' }
      }, msg.text));
    }

    // Time
    const t = msg.at?.toDate ? msg.at.toDate() : (msg.createdAt ? new Date(msg.createdAt) : new Date());
    const timeStr = t.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    bubble.appendChild(DOM.h('div', { class: 'msg-time' }, timeStr));

    return bubble;
  }

  // ═══ ATTACH MENU ═══
  function toggleAttachMenu(force) {
    const menu = $('#attachMenu');
    const btn = $('#chatAttachBtn');
    if (!menu || !btn) return;

    const willOpen = force !== undefined ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', willOpen);
    btn.classList.toggle('active', willOpen);
  }

  // ═══ EVENTS ═══
  function bindEvents() {
    // Attach button
    $('#chatAttachBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAttachMenu();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      const menu = $('#attachMenu');
      if (menu?.classList.contains('open')) {
        if (!e.target.closest('#attachMenu') && !e.target.closest('#chatAttachBtn')) {
          toggleAttachMenu(false);
        }
      }
    });

    // Attach menu items
    DOM.delegate(document, 'click', '.attach-menu-item', (e, btn) => {
      toggleAttachMenu(false);
      const type = btn.dataset.attach;
      if (type === 'image') {
        $('#imgInputNormal')?.click();
      } else if (type === 'ephemeral') {
        $('#imgInputEphemeral')?.click();
      }
    });

    // File inputs
    $('#imgInputNormal')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleChatImageSelect(file, false);
      e.target.value = ''; // reset
    });

    $('#imgInputEphemeral')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleChatImageSelect(file, true);
      e.target.value = '';
    });

    $('#imgInputProfile')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleProfileFileSelect(file);
      e.target.value = '';
    });

    // Image preview buttons
    $('#imgPreviewCancelBtn')?.addEventListener('click', closeImagePreview);
    $('#imgPreviewSendBtn')?.addEventListener('click', sendImageMessage);

    // Image viewer
    $('#imgViewerCloseBtn')?.addEventListener('click', closeImageViewer);
    $('#imgViewerOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'imgViewerOverlay') closeImageViewer();
    });

    // Profile picture modal
    $('#profilePicChooseBtn')?.addEventListener('click', () => {
      $('#imgInputProfile')?.click();
    });
    $('#profilePicCancelBtn')?.addEventListener('click', closeProfilePicker);
    $('#profilePicSaveBtn')?.addEventListener('click', saveProfilePicture);
  }

  function init() {
    try { bindEvents(); } catch (e) { Logger.warn('Image.init', e.message); }
  }

  return {
    init,
    openProfilePicker, closeProfilePicker,
    renderImageBubble,
    openImageViewer, closeImageViewer,
    renderAvatarImage, updateProfilePicDisplay,
    compressImage
  };
})();

window.ImageHandler = ImageHandler;
