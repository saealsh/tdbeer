/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Controllers (event handlers, user actions)
   ───────────────────────────────────────────────────────────────────
   Originally lines 13540–14386 of index.html
═══════════════════════════════════════════════════════════════════ */

var Controllers = (() => {
  const { U, Fmt, DOM, $, $$, MONTHS } = Tdbeer;
  const { store, Toast, Entries, Goals, Budgets, Notifs, Streak, Salary,
          Theme, Export, Pts } = App;
  const R = Renderers;

  function showTab(tab) {
    // ═══ NEW 5-tab structure: home, money, tools, profile (المزيد), social (legacy/sidebar)
    const valid = ['home', 'money', 'tools', 'social', 'profile'];

    // Legacy support - map old tab names to new ones
    const legacyMap = {
      'monthly': 'money:monthly',
      'yearly': 'money:yearly',
      'friends': 'profile:friends',
      'settings': 'profile:settings'
    };

    // Handle legacy or sub-tab syntax
    let mainTab = tab;
    let subTab = null;

    if (legacyMap[tab]) {
      const parts = legacyMap[tab].split(':');
      mainTab = parts[0];
      subTab = parts[1] || null;
    } else if (tab.includes(':')) {
      const parts = tab.split(':');
      mainTab = parts[0];
      subTab = parts[1];
    }

    if (!valid.includes(mainTab)) mainTab = 'home';
    store.set('tab', mainTab);
    if (subTab) store.set('subTab', subTab);

    // Update main nav (skip FAB button — it's not a tab)
    $$('.tab-btn').forEach(b => {
      if (b.classList.contains('tab-btn-fab')) return;
      const isActive = b.dataset.tab === mainTab;
      b.classList.toggle('active', isActive);
      // ARIA accessibility
      if (isActive) {
        b.setAttribute('aria-current', 'page');
      } else {
        b.removeAttribute('aria-current');
      }
    });

    // Handle sub-navigation visibility
    const moneySubNav = $('#moneySubNav');
    const profileSubNav = $('#profileSubNav');
    if (moneySubNav) moneySubNav.style.display = mainTab === 'money' ? '' : 'none';
    if (profileSubNav) profileSubNav.style.display = mainTab === 'profile' ? '' : 'none';

    // Map main tab to actual content tab to show
    let actualTab;
    if (mainTab === 'home') {
      actualTab = 'home';
    } else if (mainTab === 'money') {
      const currentSub = subTab || store.get('subTab') || 'monthly';
      actualTab = currentSub; // monthly/yearly
      if (moneySubNav) {
        moneySubNav.querySelectorAll('.sub-nav-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.sub === currentSub));
      }
    } else if (mainTab === 'tools') {
      actualTab = 'tools';
    } else if (mainTab === 'social') {
      // Legacy fallback - redirect to profile/friends
      actualTab = 'friends';
      mainTab = 'profile';
      subTab = 'friends';
      store.set('tab', 'profile');
      store.set('subTab', 'friends');
      $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'profile'));
      if (profileSubNav) profileSubNav.style.display = '';
    } else if (mainTab === 'profile') {
      const currentSub = subTab || store.get('subTab') || 'settings';

      // 🐛 BUG FIX (Apr 2026): When user taps "🏆 إنجازاتي" from the
      // profile sub-nav, the old code switched to the full Settings tab
      // and only scrolled to the achievements card. Result: the user saw
      // a stack of unrelated cards (notifications, profile picture, ...)
      // and there was no Back button — only an ✕ that closed the whole
      // app. Now: open the dedicated achievements modal instead, which
      // has its own Back button and shows ONLY the achievements.
      if (currentSub === 'achievements') {
        if (window.DedicatedPages?.open) {
          window.DedicatedPages.open('achievements');
          // Reset sub-tab back to settings so when the user closes the
          // modal they don't immediately re-trigger the achievements view.
          store.set('subTab', 'settings');
          if (profileSubNav) {
            profileSubNav.querySelectorAll('.sub-nav-btn').forEach(b =>
              b.classList.toggle('active', b.dataset.sub === 'settings'));
          }
          return; // do NOT continue with normal tab switching
        }
        // Fallback (DedicatedPages not loaded yet): treat as settings + scroll.
        actualTab = 'settings';
      } else if (currentSub === 'friends') {
        actualTab = 'friends';
      } else {
        actualTab = 'settings';
      }

      if (profileSubNav) {
        profileSubNav.querySelectorAll('.sub-nav-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.sub === currentSub));
      }
    }

    // Show/hide content
    $$('.tab-content').forEach(c => c.style.display = c.id === `tab-${actualTab}` ? '' : 'none');

    R.scheduledAll();

    // Render specific tabs
    if (mainTab === 'home') renderHome();
    if (actualTab === 'friends' && typeof Social !== 'undefined') Social.renderFriendsTab();
  }

  function renderHome() {
    try {
      // Greeting
      const hour = new Date().getHours();
      const name = store.get('userName') || '';
      let greet;
      if (hour < 12) greet = '☀️ صباح الخير';
      else if (hour < 18) greet = '🌤️ مساء الخير';
      else greet = '🌙 مساء الخير';

      const greetingEl = $('#homeGreeting');
      if (greetingEl) DOM.setText(greetingEl, greet + (name ? ' ' + name : ''));

      const subEl = $('#homeGreetingSub');
      if (subEl) {
        const daySub = ['يوم ممتاز لتخطيط مالي', 'ابدأ يومك بقرار ذكي', 'المال المدبّر أفضل', 'خطتك = نجاحك', 'كل خطوة تقربك لهدفك'];
        DOM.setText(subEl, daySub[new Date().getDate() % daySub.length]);
      }

      // Quick stats
      try {
        const y = store.get('year'), m = store.get('month');
        const t = App.Sel.totals(y, m);
        const streak = App.Streak.calc();
        const points = store.get('points') || 0;

        const saveEl = $('#homeStatSave');
        if (saveEl) DOM.setText(saveEl, t.save > 0 ? Fmt.c(t.save).replace(' ﷼', '') : '—');
        const streakEl = $('#homeStatStreak');
        if (streakEl) DOM.setText(streakEl, streak.current > 0 ? streak.current : '—');
        const xpEl = $('#homeStatXp');
        if (xpEl) DOM.setText(xpEl, points > 0 ? points : '—');
      } catch (e) { if (window.Logger) Logger.warn('Controllers', e?.message); }

      // Fresh content
      try {
        const freshCont = $('#homeFreshContent');
        if (freshCont && window.FreshContent) {
          // Temporarily swap container
          const origCont = $('#freshContentContainer');
          if (origCont) {
            freshCont.innerHTML = '';
            // Move fresh content from original to home
            window.FreshContent.render();
            const freshCard = origCont.querySelector('.fresh-content-card');
            if (freshCard) freshCont.appendChild(freshCard);
          }
        }
      } catch (e) { if (window.Logger) Logger.warn('Controllers', e?.message); }

      // Smart moments
      try {
        const momentsCont = $('#homeSmartMoments');
        if (momentsCont && window.SmartMoments) {
          const origCont = $('#smartMomentsContainer');
          if (origCont) {
            momentsCont.innerHTML = '';
            window.SmartMoments.render();
            const section = origCont.querySelector('.moments-section');
            if (section) momentsCont.appendChild(section);
          }
        }
      } catch (e) { if (window.Logger) Logger.warn('Controllers', e?.message); }

      // Bot card
      try {
        const botCont = $('#homeBotCard');
        if (botCont && window.Bot && window.Bot.renderBotCard) {
          botCont.innerHTML = '';
          window.Bot.renderBotCard(botCont);
        }
      } catch (e) { if (window.Logger) Logger.warn('Controllers', e?.message); }
    } catch (e) {
      window.Logger?.warn?.('renderHome:', e.message);
    }
  }

  function changeMonth(delta) {
    let m = store.get('month') + delta;
    let y = store.get('year');
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    store.set('month', m);
    store.set('year', y);
    R.scheduledAll();
  }

  // Selected chips for each form
  const selectedChips = {
    income: '💵',
    fixed: '🏠',
    variable: '🍔',
    goal: '⭐',
    budget: '🍔 أكل'
  };

  function bindChips() {
    DOM.delegate(document, 'click', '[data-chips] .chip', (e, btn) => {
      const wrap = btn.closest('[data-chips]');
      const type = wrap.dataset.chips;
      $$('.chip', wrap).forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      selectedChips[type] = btn.dataset.val;
    });
  }

  function bindFormToggles() {
    DOM.delegate(document, 'click', '[data-toggle-form]', (e, btn) => {
      const id = btn.dataset.toggleForm;
      const form = $('#' + id);
      if (form) form.classList.toggle('open');
    });
  }

  function bindForms() {
    $('#incomeForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameVal = $('#incName')?.value || '';
      const amtVal = $('#incAmt')?.value || '';

      try {
        // Validate first
        const name = (nameVal || '').trim();
        const amt = parseFloat(amtVal);

        if (!name) {
          Toast.show('اكتب اسم المصدر', 'warn');
          $('#incName')?.focus();
          return;
        }
        if (!amt || amt <= 0 || !isFinite(amt)) {
          Toast.show('أدخل مبلغ صحيح', 'warn');
          $('#incAmt')?.focus();
          return;
        }

        Entries.addIncome({ name, amt, cat: selectedChips.income });
        $('#incName').value = '';
        $('#incAmt').value = '';
        $('#incomeForm').classList.remove('open');
        R.scheduledAll();
        Toast.show('أُضيف الدخل ✅', 'success');
      } catch (err) {
        window.Logger?.error?.('[incomeForm] error:', err);
        Toast.show('خطأ: ' + (err.message || 'بيانات غير صحيحة'), 'danger');
      }
    });

    $('#fixedForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameVal = $('#fixName')?.value || '';
      const amtVal = $('#fixAmt')?.value || '';

      try {
        const name = (nameVal || '').trim();
        const amt = parseFloat(amtVal);

        if (!name) {
          Toast.show('اكتب اسم المصروف', 'warn');
          $('#fixName')?.focus();
          return;
        }
        if (!amt || amt <= 0 || !isFinite(amt)) {
          Toast.show('أدخل مبلغ صحيح', 'warn');
          $('#fixAmt')?.focus();
          return;
        }

        Entries.addFixed({ name, amt, cat: selectedChips.fixed });
        $('#fixName').value = '';
        $('#fixAmt').value = '';
        $('#fixedForm').classList.remove('open');
        R.scheduledAll();
        Toast.show('أُضيف المصروف الثابت ✅', 'success');
      } catch (err) {
        window.Logger?.error?.('[fixedForm] error:', err);
        Toast.show('خطأ: ' + (err.message || 'بيانات غير صحيحة'), 'danger');
      }
    });

    $('#varForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameVal = $('#varName')?.value || '';
      const amtVal = $('#varAmt')?.value || '';

      try {
        const name = (nameVal || '').trim();
        const amt = parseFloat(amtVal);

        if (!name) {
          Toast.show('اكتب ما اشتريت', 'warn');
          $('#varName')?.focus();
          return;
        }
        if (!amt || amt <= 0 || !isFinite(amt)) {
          Toast.show('أدخل مبلغ صحيح', 'warn');
          $('#varAmt')?.focus();
          return;
        }

        Entries.addVariable({ name, amt, cat: selectedChips.variable });
        $('#varName').value = '';
        $('#varAmt').value = '';
        $('#varForm').classList.remove('open');
        R.scheduledAll();
        Toast.show('أُضيف ✅', 'success');
      } catch (err) {
        window.Logger?.error?.('[varForm] error:', err);
        Toast.show('خطأ: ' + (err.message || 'بيانات غير صحيحة'), 'danger');
      }
    });

    $('#goalForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        Goals.add({
          name: $('#goalName').value,
          target: $('#goalTarget').value,
          saved: $('#goalSaved').value || 0,
          icon: selectedChips.goal
        });
        $('#goalName').value = ''; $('#goalTarget').value = ''; $('#goalSaved').value = '0';
        $('#goalForm').classList.remove('open');
        R.scheduledAll();
        Toast.show('أُضيف الهدف 🎯');
      } catch (err) {
        Toast.show('بيانات غير صحيحة', 'danger');
      }
    });

    $('#budgetForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        Budgets.add({
          name: $('#budgetName').value,
          limit: $('#budgetLimit').value
        });
        $('#budgetName').value = ''; $('#budgetLimit').value = '';
        $('#budgetForm').classList.remove('open');
        R.scheduledAll();
        Toast.show('أُضيف الحد ✅');
      } catch (err) {
        if (err.message === 'DUPLICATE') Toast.show('هذه الفئة موجودة', 'warn');
        else Toast.show('بيانات غير صحيحة', 'danger');
      }
    });
  }

  function bindItemActions() {
    DOM.delegate(document, 'click', '[data-action="delete"]', (e, btn) => {
      const { type, id } = btn.dataset;
      if (confirm('حذف هذا البند؟')) {
        Entries.delete(type, id);
        R.scheduledAll();
      }
    });
    DOM.delegate(document, 'click', '[data-action="edit"]', (e, btn) => {
      const { type, id } = btn.dataset;
      openEditModal(type, id);
    });
    DOM.delegate(document, 'click', '[data-action="toggle-paid"]', (e, btn) => {
      const { type, id } = btn.dataset;
      Entries.togglePaid(type, id);
      R.scheduledAll();
    });
    DOM.delegate(document, 'click', '[data-action="del-goal"]', (e, btn) => {
      if (confirm('حذف الهدف؟')) {
        Goals.delete(btn.dataset.id);
        R.scheduledAll();
      }
    });
    DOM.delegate(document, 'click', '[data-action="del-budget"]', (e, btn) => {
      if (confirm('حذف الحد؟')) {
        Budgets.delete(btn.dataset.id);
        R.scheduledAll();
      }
    });
    DOM.delegate(document, 'click', '[data-action="notif-paid"]', (e, btn) => {
      Notifs.togglePaid(btn.dataset.id);
      R.scheduledAll();
    });
    DOM.delegate(document, 'click', '[data-action="notif-del"]', (e, btn) => {
      if (confirm('حذف التنبيه؟')) {
        Notifs.delete(btn.dataset.id);
        R.scheduledAll();
      }
    });
  }

  function bindTheme() {
    DOM.delegate(document, 'click', '.theme-swatch[data-theme]', (e, btn) => {
      Theme.apply(btn.dataset.theme);
      $$('.theme-swatch').forEach(s => s.classList.toggle('active', s === btn));
      Toast.show('تم تغيير الثيم ✨');
    });
  }

  function bindLang() {
    DOM.delegate(document, 'click', '.lang-btn[data-lang]', (e, btn) => {
      App.Lang.apply(btn.dataset.lang);
      App.DateDisplay.update();
      Toast.show(btn.dataset.lang === 'en' ? 'Language changed ✨' : 'تم تغيير اللغة ✨');
    });
  }

  // ═══ DRAWER ═══
  const DRAWER_CATS = {
    exp: [
      { e: '🍔', n: 'أكل' },
      { e: '🚗', n: 'مواصلات' },
      { e: '🛒', n: 'تسوق' },
      { e: '☕', n: 'قهوة' },
      { e: '🎬', n: 'ترفيه' },
      { e: '⛽', n: 'بنزين' },
      { e: '💊', n: 'صحة' },
      { e: '🎁', n: 'هدايا' },
      { e: '👕', n: 'ملابس' },
      { e: '➕', n: 'أخرى' }
    ],
    inc: [
      { e: '💵', n: 'راتب' },
      { e: '💼', n: 'حر' },
      { e: '🎁', n: 'هدية' },
      { e: '📈', n: 'استثمار' },
      { e: '➕', n: 'أخرى' }
    ]
  };
  const SHORTCUTS = [10, 25, 50, 100, 200, 500];
  const drawerState = { type: 'exp', cat: '🍔' };

  function renderDrawerCats() {
    const cont = $('#drawerCats');
    if (!cont) return;
    cont.innerHTML = '';
    const cats = DRAWER_CATS[drawerState.type];
    for (const c of cats) {
      const el = DOM.h('button', {
        class: 'drawer-cat' + (c.e === drawerState.cat ? ' active' : ''),
        dataset: { dcat: c.e }
      },
        DOM.h('div', { class: 'drawer-cat-emoji' }, c.e),
        DOM.h('div', { class: 'drawer-cat-lbl' }, c.n)
      );
      cont.appendChild(el);
    }
  }

  function renderShortcuts() {
    const cont = $('#drShortcuts');
    if (!cont) return;
    cont.innerHTML = '';
    for (const v of SHORTCUTS) {
      cont.appendChild(DOM.h('button', { class: 'drawer-shortcut', dataset: { val: v } }, `${v}`));
    }
  }

  function openDrawer() {
    drawerState.type = 'exp';
    drawerState.cat = '🍔';
    renderDrawerCats();
    renderShortcuts();
    $('#drName').value = '';
    $('#drAmt').value = '';
    $$('.drawer-type-btn').forEach(b => b.classList.toggle('active', b.dataset.dtype === 'exp'));
    $('#drSubmit').textContent = '💾 ااحفظ المصروف';
    $('#drSubmit').classList.remove('inc-mode');
    // Legacy #fab button removed (Apr 2026); guard for null.
    $('#fab')?.classList.add('open');
    $('#drawerOverlay').classList.add('open');
    $('#drawer').classList.add('open');
    setTimeout(() => $('#drName')?.focus(), 300);
  }

  function closeDrawer() {
    $('#fab')?.classList.remove('open');
    $('#drawerOverlay').classList.remove('open');
    $('#drawer').classList.remove('open');
  }

  function bindDrawer() {
    // Legacy #fab is gone — but bind on tab-btn-fab in the bottom nav
    // (handled by 21-fab-controller.js). Keep defensive bind for #fab
    // in case it returns from any cached HTML.
    $('#fab')?.addEventListener('click', () => {
      if ($('#drawer').classList.contains('open')) closeDrawer();
      else openDrawer();
    });
    $('#drawerOverlay')?.addEventListener('click', closeDrawer);

    DOM.delegate(document, 'click', '.drawer-type-btn', (e, btn) => {
      drawerState.type = btn.dataset.dtype;
      drawerState.cat = DRAWER_CATS[drawerState.type][0].e;
      $$('.drawer-type-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderDrawerCats();
      const submit = $('#drSubmit');
      if (drawerState.type === 'inc') {
        submit.textContent = '💾 ااحفظ الدخل';
        submit.classList.add('inc-mode');
      } else {
        submit.textContent = '💾 ااحفظ المصروف';
        submit.classList.remove('inc-mode');
      }
    });

    DOM.delegate(document, 'click', '[data-dcat]', (e, btn) => {
      drawerState.cat = btn.dataset.dcat;
      $$('.drawer-cat').forEach(c => c.classList.toggle('active', c === btn));
    });

    DOM.delegate(document, 'click', '.drawer-shortcut', (e, btn) => {
      const val = U.num(btn.dataset.val);
      const input = $('#drAmt');
      input.value = (U.num(input.value) + val) || val;
      input.focus();
    });

    $('#drSubmit')?.addEventListener('click', () => {
      const name = U.str($('#drName').value, 60);
      const amt = U.num($('#drAmt').value);
      if (!name || amt <= 0) {
        $('#drName').classList.add('error');
        $('#drAmt').classList.add('error');
        setTimeout(() => {
          $('#drName').classList.remove('error');
          $('#drAmt').classList.remove('error');
        }, 500);
        return;
      }
      try {
        if (drawerState.type === 'exp') {
          Entries.addVariable({ name, amt, cat: drawerState.cat });
        } else {
          Entries.addIncome({ name, amt, cat: drawerState.cat });
        }
        closeDrawer();
        R.scheduledAll();
        Toast.show(`أُضيف ${drawerState.type === 'inc' ? 'الدخل' : 'المصروف'} ✅`);
      } catch (err) {
        Toast.show('فشل الااحفظ', 'danger');
      }
    });
  }

  function bindNotifs() {
    $('#bellBtn')?.addEventListener('click', () => {
      $('#notifOverlay').classList.add('open');
      $('#notifPanel').classList.add('open');
      R.notifPanel();
    });
    $('#notifClose')?.addEventListener('click', () => {
      $('#notifOverlay').classList.remove('open');
      $('#notifPanel').classList.remove('open');
    });
    $('#notifOverlay')?.addEventListener('click', () => {
      $('#notifOverlay').classList.remove('open');
      $('#notifPanel').classList.remove('open');
    });
    $('#ntfAdd')?.addEventListener('click', () => {
      try {
        Notifs.add({
          name: $('#ntfName').value,
          amt: $('#ntfAmt').value,
          day: $('#ntfDay').value
        });
        $('#ntfName').value = ''; $('#ntfAmt').value = ''; $('#ntfDay').value = '';
        R.scheduledAll();
        Toast.show('أُضيف التنبيه 🔔');
      } catch (err) {
        Toast.show('بيانات غير صحيحة', 'danger');
      }
    });
  }

  function bindPeriodTabs() {
    $$('.period-tab').forEach(t => {
      t.addEventListener('click', () => {
        store.set('period', t.dataset.period);
        $$('.period-tab').forEach(x => x.classList.toggle('active', x === t));
        R.periodChart();
      });
    });
  }

  function bindStreak() {
    $('#streakBtn')?.addEventListener('click', () => {
      Streak.checkin();
      R.scheduledAll();
      // Sync to Firestore if signed in
      if (typeof Social !== 'undefined' && Social.syncStreak) Social.syncStreak();
    });
  }

  function bindSalary() {
    $('#salarySelect')?.addEventListener('change', (e) => {
      Salary.set(e.target.value);
      R.salary();
      Toast.show('تم تحديد يوم الراتب 💼');
    });
  }

  function bindSavingSlider() {
    $('#savingSlider')?.addEventListener('input', () => R.savingPlan());
  }

  function bindExports() {
    DOM.delegate(document, 'click', '[data-export]', (e, btn) => {
      const type = btn.dataset.export;
      try {
        if (type === 'csv') Export.csv();
        else if (type === 'txt') Export.txt();
        else if (type === 'pdf') Export.pdf();
      } catch (err) {
        Toast.show('فشل التصدير', 'danger');
      }
    });
  }

  function renderReportTable() {
    // Hook for future report rendering (settings tab)
  }

  function bindUserName() {
    const input = $('#userNameInput');
    const btn = $('#saveUserNameBtn');
    const cur = $('#currentUserName');
    if (input) input.value = store.get('userName') || '';
    if (cur) {
      const n = store.get('userName');
      cur.textContent = n ? `الاسم الحالي: ${n}` : 'لم يتم تعيين اسم بعد';
    }
    btn?.addEventListener('click', () => {
      const n = U.str(input.value, 30);
      store.set('userName', n);
      Toast.show(n ? `أهلاً ${n} 👋` : 'تم حذف الاسم', 'success');
      R.greeting();
      if (cur) cur.textContent = n ? `الاسم الحالي: ${n}` : 'لم يتم تعيين اسم بعد';
    });
  }

  function bindData() {
    $('#backupBtn')?.addEventListener('click', () => {
      try {
        const snap = store.snapshot();
        const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const a = DOM.h('a', { href: url, download: `tdbeer_backup_${ts}.json` });
        a.click();
        URL.revokeObjectURL(url);
        Toast.show('نسخة احتياطية ✅');
      } catch (err) {
        Toast.show('فشل النسخ', 'danger');
      }
    });

    $('#restoreBtn')?.addEventListener('click', () => $('#restoreInput').click());
    $('#restoreInput')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data || typeof data !== 'object') throw new Error('INVALID');
          if (!confirm('استعادة هذه النسخة؟ سيتم استبدال البيانات الحالية.')) return;
          for (const k of ['data', 'pts', 'salaryDay', 'streak', 'notifs', 'theme', 'achievements', 'userName']) {
            if (k in data) store.set(k, data[k]);
          }
          Theme.apply(data.theme || 'default');
          R.scheduledAll();
          Toast.show('تم الاستعادة ✅');
        } catch (err) {
          Toast.show('ملف غير صحيح', 'danger');
        }
      };
      reader.readAsText(file);
    });

    $('#clearBtn')?.addEventListener('click', () => {
      if (!confirm('⚠️ سيتم مسح كل البيانات نهائياً. متأكد؟')) return;
      if (!confirm('آخر تأكيد — ما يمكن التراجع!')) return;
      const keys = ['data', 'pts', 'salaryDay', 'streak', 'notifs', 'achievements', 'userName'];
      for (const k of keys) Tdbeer.Storage.remove(k);
      Tdbeer.Storage.remove('__version');
      location.reload();
    });
  }

  // ═══ EDIT MODAL ═══
  let _editState = null;

  function openEditModal(type, id) {
    const item = App.Entries.findById(type, id);
    if (!item) {
      Toast.show('ما لقيت البند', 'danger');
      return;
    }
    _editState = { type, id };

    const overlay = $('#editModalOverlay');
    const nameInput = $('#editItemName');
    const amtInput = $('#editItemAmount');
    const catInput = $('#editItemCat');

    if (!overlay || !nameInput || !amtInput || !catInput) return;

    nameInput.value = item.name || '';
    amtInput.value = item.amt || '';
    catInput.value = item.cat || '';

    overlay.style.display = 'flex';
    setTimeout(() => nameInput.focus(), 50);
  }

  function closeEditModal() {
    const overlay = $('#editModalOverlay');
    if (overlay) overlay.style.display = 'none';
    _editState = null;
  }

  function saveEditModal() {
    if (!_editState) return;
    const { type, id } = _editState;
    const name = $('#editItemName')?.value.trim();
    const amt = parseFloat($('#editItemAmount')?.value);
    const cat = $('#editItemCat')?.value.trim();

    if (!name) { Toast.show('الاسم مطلوب', 'warn'); return; }
    if (!amt || amt <= 0) { Toast.show('المبلغ غير صحيح', 'warn'); return; }

    try {
      App.Entries.update(type, id, { name, amt, cat: cat || '📌' });
      Toast.show('✓ تم التعديل', 'ok');
      closeEditModal();
      R.scheduledAll();
    } catch (err) {
      if (window.handleError) window.handleError(err, { ctx: 'editItem' });
      else Toast.show('فشل التعديل', 'danger');
    }
  }

  function bindEditModal() {
    $('#editModalClose')?.addEventListener('click', closeEditModal);
    $('#editCancelBtn')?.addEventListener('click', closeEditModal);
    $('#editSaveBtn')?.addEventListener('click', saveEditModal);

    // إغلاق بالضغط خارج المودال
    $('#editModalOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'editModalOverlay') closeEditModal();
    });

    // Enter في الحقول يحفظ
    ['editItemName', 'editItemAmount', 'editItemCat'].forEach(id => {
      $(`#${id}`)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveEditModal();
        } else if (e.key === 'Escape') {
          closeEditModal();
        }
      });
    });
  }

  function init() {
    // Tab switching (exclude FAB button - handled by FabController)
    DOM.delegate(document, 'click', '.tab-btn', (e, btn) => {
      if (btn.classList.contains('tab-btn-fab')) return; // FAB له معالج خاص
      if (!btn.dataset.tab) return; // skip buttons without data-tab
      showTab(btn.dataset.tab);
    });
    // Sub-nav listener
    DOM.delegate(document, 'click', '.sub-nav-btn', (e, btn) => {
      const sub = btn.dataset.sub;
      const mainTab = store.get('tab') || 'home';
      showTab(mainTab + ':' + sub);
    });
    // Month nav
    DOM.delegate(document, 'click', '[data-nav]', (e, btn) => changeMonth(parseInt(btn.dataset.nav, 10)));
    // Landing → app
    $('#openAppBtn')?.addEventListener('click', () => {
      $('#landing').style.display = 'none';
      $('#appModal').classList.add('open');
      R.scheduledAll();
    });
    $('#closeAppBtn')?.addEventListener('click', () => {
      $('#appModal').classList.remove('open');
      $('#landing').style.display = '';
    });
    // Save button (manual flush)
    $('#saveBtn')?.addEventListener('click', () => {
      Tdbeer.Storage.flushNow();
      const wrap = $('#saveWrap');
      const btn = $('#saveBtn');
      btn.classList.add('saved');
      btn.textContent = '✓ محفوظ';
      setTimeout(() => {
        wrap.classList.remove('dirty');
        btn.classList.remove('saved');
        btn.textContent = '💾 ااحفظ';
      }, 1200);
      store.set('dirty', false);
    });

    // Wire all binders
    bindChips();
    bindFormToggles();
    bindForms();
    bindItemActions();
    bindEditModal();
    bindTheme();
    bindLang();
    bindDrawer();
    bindNotifs();
    bindPeriodTabs();
    bindStreak();
    bindSalary();
    bindSavingSlider();
    bindExports();
    bindUserName();
    // Profile picture button
    $('#changeProfilePicBtn')?.addEventListener('click', () => {
      if (window.ImageHandler) window.ImageHandler.openProfilePicker();
    });

    // Notification settings toggles
    document.querySelectorAll('[data-notif]').forEach(toggle => {
      const key = toggle.dataset.notif;
      // Load current state
      try {
        const settings = window.ChatNotifications?.getSettings() || {};
        toggle.classList.toggle('on', settings[key] !== false);
      } catch (e) { if (window.Logger) Logger.warn('Controllers', e?.message); }

      toggle.addEventListener('click', () => {
        if (!window.ChatNotifications) return;
        const newState = window.ChatNotifications.toggleSetting(key);
        toggle.classList.toggle('on', newState);

        // Play sound if enabled sound
        if (key === 'sound' && newState) {
          window.ChatNotifications.playMessageSound();
        }
      });
    });

    // Test notifications button
    $('#testNotifBtn')?.addEventListener('click', () => {
      if (!window.ChatNotifications) return;

      // Test toast
      window.ChatNotifications.showChatToast({
        peerName: 'تـدّبير',
        peerUsername: 'tdbeer',
        text: 'هذا اختبار للإشعارات 🎉',
        photoData: null
      });

      // Test sound
      window.ChatNotifications.playMessageSound();

      // Test badge
      window.ChatNotifications.updateBadge(5);
      setTimeout(() => window.ChatNotifications.updateBadge(0), 3000);

      // Test vibration
      try { if (navigator.vibrate) navigator.vibrate([50, 30, 50]); } catch (e) { if (window.Logger) Logger.warn('Controllers', e?.message); }
    });
    bindData();

    // Escape closes overlays
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $('#notifPanel')?.classList.remove('open');
        $('#notifOverlay')?.classList.remove('open');
        if ($('#drawer')?.classList.contains('open')) closeDrawer();
        $('#authOverlay')?.classList.remove('open');
      }
    });
  }

  return { init, showTab, changeMonth, renderReportTable };
})();

// Expose Controllers globally so sidebar can use it
window.Controllers = Controllers;
