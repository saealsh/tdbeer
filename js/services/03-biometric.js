/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Biometric Auth (WebAuthn)
   ───────────────────────────────────────────────────────────────────
   Originally lines 20803–21203 of index.html
═══════════════════════════════════════════════════════════════════ */

var BiometricAuth = (() => {
  const STORAGE_KEY = 'tdbeer_biometric_credential';
  const USER_KEY = 'tdbeer_biometric_user';
// 🔒 SECURITY: امسح أي توكن قديم محفوظ بنص واضح من نسخ سابقة
  try {
    if (localStorage.getItem('tdbeer_biometric_auth_token')) {
      localStorage.removeItem('tdbeer_biometric_auth_token');
      if (window.Logger) window.Logger.warn('Biometric', 'تم حذف توكن قديم غير آمن');
    }
  } catch (e) { /* localStorage not available */ }
  // ═══ Check if biometrics are supported ═══
  async function isSupported() {
    if (!window.PublicKeyCredential) return false;
    try {
      // Check if platform authenticator (Face ID, Touch ID, Windows Hello) is available
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch {
      return false;
    }
  }

  // ═══ Detect the biometric type for UI ═══
  function detectBiometricType() {
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() || '';
    
    if (/iphone|ipad|ipod/.test(ua)) {
      return { icon: '👤', name: 'Face ID', arabic: 'Face ID' };
    }
    if (/mac/.test(platform)) {
      return { icon: '👆', name: 'Touch ID', arabic: 'Touch ID' };
    }
    if (/win/.test(platform)) {
      return { icon: '🔐', name: 'Windows Hello', arabic: 'Windows Hello' };
    }
    if (/android/.test(ua)) {
      return { icon: '👆', name: 'Touch ID', arabic: 'Touch ID' };
    }
    return { icon: '🔐', name: 'المصادقة البيومترية', arabic: 'بصمة الأمان' };
  }

  // ═══ Helper: ArrayBuffer <-> Base64 ═══
  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return btoa(str);
  }

  function base64ToBuffer(base64) {
    const str = atob(base64);
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // ═══ Generate random challenge ═══
  function generateChallenge() {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  // ═══ REGISTER biometric credentials ═══
  // (بعد ما يسجّل دخول بالإيميل، نربط البصمة بحسابه)
  async function register(userEmail, displayName) {
    try {
      if (!await isSupported()) {
        throw new Error('جهازك ما يدعم البصمة البيومترية');
      }

      const challenge = generateChallenge();
      const userId = new TextEncoder().encode(userEmail);

      const publicKey = {
        challenge: challenge,
        rp: {
          name: 'تـدّبير',
          id: location.hostname
        },
        user: {
          id: userId,
          name: userEmail,
          displayName: displayName || userEmail
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },    // ES256
          { type: 'public-key', alg: -257 }   // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',  // Only built-in biometrics
          userVerification: 'required',         // Must use biometric
          requireResidentKey: true
        },
        timeout: 60000,
        attestation: 'none'
      };

      const credential = await navigator.credentials.create({ publicKey });

      if (!credential) throw new Error('فشل التسجيل');

      // Store credential info locally
      const credData = {
        id: credential.id,
        rawId: bufferToBase64(credential.rawId),
        email: userEmail,
        displayName: displayName,
        createdAt: Date.now()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(credData));
      localStorage.setItem(USER_KEY, userEmail);

      return { success: true, credentialId: credential.id };
    } catch (e) {
      console.error('[Biometric] Register error:', e);
      
      let message = 'فشل تسجيل البصمة';
      if (e.name === 'NotAllowedError') message = 'تم إلغاء العملية';
      else if (e.name === 'NotSupportedError') message = 'جهازك ما يدعم البصمة';
      else if (e.message) message = e.message;
      
      return { success: false, error: message };
    }
  }

  // ═══ AUTHENTICATE using biometric ═══
  async function authenticate() {
    try {
      if (!await isSupported()) {
        throw new Error('جهازك ما يدعم البصمة');
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) throw new Error('لم يتم تسجيل بصمة بعد');

      const credData = JSON.parse(stored);
      const challenge = generateChallenge();

      const publicKey = {
        challenge: challenge,
        rpId: location.hostname,
        allowCredentials: [{
          type: 'public-key',
          id: base64ToBuffer(credData.rawId),
          transports: ['internal']
        }],
        userVerification: 'required',
        timeout: 60000
      };

      const assertion = await navigator.credentials.get({ publicKey });

      if (!assertion) throw new Error('فشل التحقق');

      return {
        success: true,
        email: credData.email,
        displayName: credData.displayName
      };
    } catch (e) {
      console.error('[Biometric] Auth error:', e);
      
      let message = 'فشل التحقق من البصمة';
      if (e.name === 'NotAllowedError') message = 'تم إلغاء العملية';
      else if (e.name === 'InvalidStateError') message = 'مشكلة في البصمة المسجلة';
      else if (e.message) message = e.message;
      
      return { success: false, error: message };
    }
  }

  // ═══ Check if user has registered biometric ═══
  function hasRegisteredCredential() {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  function getRegisteredEmail() {
    return localStorage.getItem(USER_KEY);
  }

  // ═══ Remove biometric ═══
  function remove() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ═══ Show setup prompt ═══
  function showSetupPrompt(userEmail, displayName, onSuccess) {
    const bio = detectBiometricType();
    
    // Remove existing
    const existing = document.getElementById('biometricSetupPrompt');
    if (existing) existing.remove();

    const prompt = document.createElement('div');
    prompt.id = 'biometricSetupPrompt';
    prompt.className = 'biometric-setup-prompt';
    prompt.innerHTML = `
      <div class="biometric-setup-card">
        <div class="biometric-setup-icon">${bio.icon}</div>
        <div class="biometric-setup-title">فعّل ${bio.arabic}</div>
        <div class="biometric-setup-desc">
          سجل دخولك بسرعة وبأمان باستخدام ${bio.arabic} في المرات القادمة
        </div>
        <div class="biometric-setup-features">
          <div class="biometric-setup-feature">
            <span class="biometric-setup-feature-check">✓</span>
            <span>دخول على طول بدون رقم سري</span>
          </div>
          <div class="biometric-setup-feature">
            <span class="biometric-setup-feature-check">✓</span>
            <span>أمان بالبصمة متطور</span>
          </div>
          <div class="biometric-setup-feature">
            <span class="biometric-setup-feature-check">✓</span>
            <span>بياناتك تبقى في جهازك بس</span>
          </div>
        </div>
        <div class="biometric-setup-actions">
          <button class="biometric-setup-btn secondary" id="biometricSkipBtn">بعدين</button>
          <button class="biometric-setup-btn primary" id="biometricEnableBtn">✨ شغّل الحين</button>
        </div>
      </div>
    `;

    document.body.appendChild(prompt);
    requestAnimationFrame(() => prompt.classList.add('show'));

    const close = () => {
      prompt.classList.remove('show');
      setTimeout(() => prompt.remove(), 300);
    };

    document.getElementById('biometricSkipBtn').onclick = () => {
      localStorage.setItem('biometric_dismissed', Date.now().toString());
      close();
    };

    document.getElementById('biometricEnableBtn').onclick = async () => {
      const btn = document.getElementById('biometricEnableBtn');
      btn.textContent = '⏳ قاعد يسجل...';
      btn.disabled = true;

      const result = await register(userEmail, displayName);
      
      if (result.success) {
        window.Toast?.show('✅ تم تفعيل ' + bio.arabic + ' بنجاح!', 'ok');
        close();
        if (onSuccess) onSuccess();
      } else {
        window.Toast?.show('❌ ' + result.error, 'danger');
        btn.textContent = '✨ شغّل الحين';
        btn.disabled = false;
      }
    };
  }

  // ═══ Initialize biometric button ═══
  async function initLoginButton() {
    const supported = await isSupported();
    const btn = document.getElementById('authBiometricBtn');
    
    if (!btn) return;

    if (!supported) {
      btn.style.display = 'none';
      return;
    }

    // Check if user has registered
    if (hasRegisteredCredential()) {
      const bio = detectBiometricType();
      const iconEl = document.getElementById('biometricIcon');
      const textEl = document.getElementById('biometricText');
      
      if (iconEl) iconEl.textContent = bio.icon;
      if (textEl) textEl.textContent = 'الدخول بـ ' + bio.arabic;
      
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }
  }

  // ═══ Biometric sign-in handler ═══
  async function handleSignIn() {
    const btn = document.getElementById('authBiometricBtn');
    if (btn) btn.classList.add('loading');
    const iconEl = document.getElementById('biometricIcon');
    const textEl = document.getElementById('biometricText');
    const origIcon = iconEl?.textContent;
    const origText = textEl?.textContent;
    if (iconEl) iconEl.textContent = '⏳';
    if (textEl) textEl.textContent = 'قاعد يتأكد...';

    const result = await authenticate();

    if (btn) btn.classList.remove('loading');
    if (iconEl && origIcon) iconEl.textContent = origIcon;
    if (textEl && origText) textEl.textContent = origText;

    if (!result.success) {
      window.Toast?.show('❌ ' + result.error, 'danger');
      return;
    }

    // Biometric verified - now sign in directly
    const savedAuth = localStorage.getItem('tdbeer_biometric_auth_token');
    
    if (!savedAuth) {
      window.Toast?.show('⚠️ سجل دخول بإيميلك أول عشان تربط البصمة', 'warn');
      return;
    }

    try {
      const authData = JSON.parse(savedAuth);
      
      // Verify Firebase is ready
      if (!window.FB || !window.FB.auth || !window.FB.signIn) {
        window.Toast?.show('⏳ اصبر ثانية ثم حاول مرة ثانية', 'warn');
        return;
      }

      window.Toast?.show('✅ تم التحقق - قاعد يسجل دخول...', 'ok');
      
      if (iconEl) iconEl.textContent = '⏳';
      if (textEl) textEl.textContent = 'قاعد يسجل دخول...';
      if (btn) btn.classList.add('loading');

      // Sign in directly with Firebase (bypass the form)
      try {
        await window.FB.signIn(window.FB.auth, authData.email, authData.password);
        
        // Close auth overlay
        const authOverlay = document.getElementById('authOverlay');
        if (authOverlay) authOverlay.classList.remove('open');
        
        window.Toast?.show('🎉 يا هلا بعودتك!', 'ok');
        
        // Close any open modals
        document.body.style.overflow = '';
      } catch (err) {
        console.error('[Biometric] Firebase signin error:', err);
        
        let errorMsg = 'فشل تسجيل الدخول';
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          errorMsg = '⚠️ الرقم السري تغير. سجل دخول يدوي.';
          // Clear old biometric data
          localStorage.removeItem('tdbeer_biometric_auth_token');
          BiometricAuth.remove();
          // Reset button
          initLoginButton();
        } else if (err.code === 'auth/user-not-found') {
          errorMsg = '❌ الحساب غير موجود';
          localStorage.removeItem('tdbeer_biometric_auth_token');
          BiometricAuth.remove();
        } else if (err.code === 'auth/too-many-requests') {
          errorMsg = '⚠️ محاولات كثيرة - حاول بعد قليل';
        } else if (err.code === 'auth/network-request-failed') {
          errorMsg = '📶 مشكلة في الاتصال';
        }
        
        window.Toast?.show(errorMsg, 'danger');
      }
    } catch (e) {
      console.error('[Biometric] Parse error:', e);
      window.Toast?.show('❌ خطأ في البيانات المحفوظة', 'danger');
    } finally {
      if (btn) btn.classList.remove('loading');
      if (iconEl && origIcon) iconEl.textContent = origIcon;
      if (textEl && origText) textEl.textContent = origText;
    }
  }

  // Expose sign-in globally
  window.__biometricSignIn = handleSignIn;

  // Initialize when auth form opens
  setInterval(() => {
    const overlay = document.getElementById('authOverlay');
    if (overlay && overlay.classList.contains('open')) {
      initLoginButton();
    }
  }, 1000);

  return {
    isSupported,
    register,
    authenticate,
    hasRegisteredCredential,
    remove,
    showSetupPrompt,
    detectBiometricType,
    initLoginButton
  };
})();

window.BiometricAuth = BiometricAuth;
