/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Birthday System
   ───────────────────────────────────────────────────────────────────
   Originally lines 20142–20263 of index.html
═══════════════════════════════════════════════════════════════════ */

var BirthdaySystem = (() => {
  function checkBirthday() {
    try {
      const birthday = localStorage.getItem('userBirthday');
      if (!birthday) return;

      const today = new Date();
      const bday = new Date(birthday);
      
      // Compare month and day only
      if (today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()) {
        const lastShown = localStorage.getItem('birthdayShown');
        const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
        
        if (lastShown !== todayKey) {
          // Calculate age
          let age = today.getFullYear() - bday.getFullYear();
          if (today.getMonth() < bday.getMonth() || 
              (today.getMonth() === bday.getMonth() && today.getDate() < bday.getDate())) {
            age--;
          }
          
          // Show celebration
          showBirthdayCelebration(age);
          localStorage.setItem('birthdayShown', todayKey);
        }
      }
    } catch (e) {
      console.warn('[Birthday] Error:', e);
    }
  }

  function showBirthdayCelebration(age) {
    const userName = localStorage.getItem('userName') || 
                     window.Social?._state?.profile?.displayName || 
                     'صديقي';

    const celebration = document.createElement('div');
    celebration.className = 'birthday-celebration';
    celebration.innerHTML = `
      <div class="birthday-card">
        <div class="birthday-cake">🎂</div>
        <div class="birthday-title">كل عام وأنت بخير!</div>
        <div class="birthday-message">
          <strong>${escapeHTML(userName)}</strong>،<br>
          نهنيّك بيوم ميلادك الحلو!<br>
          ${age > 0 ? `<span style="color:var(--accent-2);font-weight:800">عمرك ${age} سنة 🎉</span><br>` : ''}
          نتمنى لك سنة مليانة نجاح وتوفيق في فلوسك 💚
        </div>
        <button class="birthday-btn" id="birthdayCloseBtn">شكراً 🙏</button>
      </div>
    `;
    document.body.appendChild(celebration);

    // Animate in
    requestAnimationFrame(() => celebration.classList.add('show'));

    // Confetti
    launchConfetti();

    // Close handler
    document.getElementById('birthdayCloseBtn').onclick = () => {
      celebration.classList.remove('show');
      setTimeout(() => celebration.remove(), 500);
    };

    // Vibration
    try { if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]); } catch (e) { if (window.Logger) Logger.warn('BirthdaySystem', e?.message); }
  }

  function launchConfetti() {
    const colors = ['#01dd8c', '#5dffc3', '#ffd700', '#ff6fa5', '#4fc3f7'];
    const count = 50;
    
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.cssText = `
          left: ${Math.random() * 100}vw;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          transform: rotate(${Math.random() * 360}deg);
          animation: confettiFall ${2 + Math.random() * 2}s linear;
        `;
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 4000);
      }, i * 60);
    }
  }

  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, m => 
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // Add confetti keyframe if not exists
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes confettiFall {
        to {
          top: 110vh;
          transform: rotate(720deg);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Check on load + every time user focuses
  setTimeout(checkBirthday, 2000);
  window.addEventListener('focus', checkBirthday);

  return { check: checkBirthday, celebrate: showBirthdayCelebration };
})();

window.BirthdaySystem = BirthdaySystem;
