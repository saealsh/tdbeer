/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Renderers (UI rendering functions)
   ───────────────────────────────────────────────────────────────────
   Originally lines 12881–13539 of index.html
═══════════════════════════════════════════════════════════════════ */

var Renderers = (() => {
  const { U, Fmt, DOM, $, $$, MONTHS, DAY_NAMES, TIPS, ACHIEVEMENTS, LEVELS,
          Scheduler, PIE_COLORS } = Tdbeer;
  const { store, Sel, Pts, Streak, Notifs, AI, Salary } = App;

  function greeting() {
    const hour = new Date().getHours();
    const name = U.str(store.get('userName'), 30);
    const greetMap = [
      [5, 12, 'صباح الخير', '☀️'],
      [12, 17, 'مساء الخير', '🌤️'],
      [17, 22, 'مساء الخير', '🌆'],
      [0, 24, 'مساء الخير', '🌙']
    ];
    let txt = 'مرحباً', emoji = '👋';
    for (const [s, e, t, em] of greetMap) {
      if (hour >= s && hour < e) { txt = t; emoji = em; break; }
    }
    const tipIdx = store.get('tipIdx') || 0;
    DOM.setText($('#greetingHello'), name ? `${txt} يا ${name} ${emoji}` : `${txt} ${emoji}`);
    DOM.setText($('#greetingSub'), TIPS[tipIdx % TIPS.length]);
  }

  function bankCard() {
    const y = store.get('year'), m = store.get('month');
    const t = Sel.totals(y, m);
    const balance = t.income - t.expense;
    DOM.setText($('#bankBalVal'), Fmt.n(balance));
    DOM.setText($('#bankInc'), Fmt.n(t.income));
    DOM.setText($('#bankExp'), Fmt.n(t.expense));
    DOM.setText($('#bankSav'), Fmt.n(t.save));
    DOM.setText($('#bankPct'), `${t.spendPct}%`);
    const fill = $('#bankBarFill');
    if (fill) fill.style.width = `${t.spendPct}%`;
  }

  function summary() {
    const y = store.get('year'), m = store.get('month');
    const t = Sel.totals(y, m);
    const lastM = m === 0 ? Sel.totals(y - 1, 11) : Sel.totals(y, m - 1);
    DOM.setText($('#tInc'), Fmt.c(t.income));
    DOM.setText($('#tExp'), Fmt.c(t.expense));
    DOM.setText($('#tSav'), Fmt.c(t.save));
    DOM.setText($('#tBal'), Fmt.c(t.income - t.expense));

    const incBadge = $('#incBadge');
    if (incBadge && lastM.income) {
      const diff = Math.round(((t.income - lastM.income) / lastM.income) * 100);
      incBadge.textContent = (diff >= 0 ? '+' : '') + diff + '٪';
      incBadge.style.color = diff >= 0 ? 'var(--green-2)' : 'var(--danger)';
    } else if (incBadge) incBadge.textContent = '—';

    DOM.setText($('#expBadge'), `${t.spendPct}٪`);
    DOM.setText($('#savBadge'), `${t.savePct}٪`);
    DOM.setText($('#balSub'), t.income - t.expense >= 0 ? '✓ موفّر' : '⚠ عجز');

    const max = Math.max(t.income, t.expense, 1);
    const incBar = $('#incBar'), expBar = $('#expBar');
    if (incBar) incBar.style.width = `${(t.income / max) * 100}%`;
    if (expBar) expBar.style.width = `${(t.expense / max) * 100}%`;

    DOM.setText($('#progPct'), `${t.spendPct}٪`);
    const pf = $('#progFill');
    if (pf) {
      pf.style.width = `${t.spendPct}%`;
      pf.className = 'progress-fill' + (t.spendPct >= 90 ? ' danger' : t.spendPct >= 70 ? ' warn' : '');
    }
    DOM.setText($('#spentLbl'), `صرفت: ${Fmt.c(t.expense)}`);
    DOM.setText($('#incomeLbl'), `دخلك: ${Fmt.c(t.income)}`);
  }

  function itemRow(item, type, opts = {}) {
    const isPaid = item.paid;
    const cls = 'item' + (isPaid ? ' paid' : '');
    return DOM.h('div', { class: cls, dataset: { id: item.id, type } },
      DOM.h('div', { class: 'item-emoji' }, item.cat || '📌'),
      DOM.h('div', { class: 'item-name' }, item.name),
      DOM.h('div', {
        class: 'item-amount ' + (opts.color || (type === 'income' ? 'inc' : 'exp'))
      }, Fmt.c(item.amt)),
      opts.toggle ? DOM.h('button', {
        class: 'item-del',
        dataset: { action: 'toggle-paid', type, id: item.id },
        title: isPaid ? 'إلغاء التسوية' : 'حُسبت'
      }, isPaid ? '✓' : '○') : null,
      DOM.h('button', {
        class: 'item-edit',
        dataset: { action: 'edit', type, id: item.id },
        'aria-label': 'تعديل',
        title: 'تعديل'
      }, '✏️'),
      DOM.h('button', {
        class: 'item-del',
        dataset: { action: 'delete', type, id: item.id },
        'aria-label': 'حذف'
      }, '✕')
    );
  }

  function income() {
    const y = store.get('year'), m = store.get('month');
    const d = Sel.monthData(y, m);
    const list = $('#incList');
    if (!list) return;
    if (!d.income.length) {
      list.innerHTML = '<div class="empty"><span class="empty-icon">📊</span>ما فيه دخل بعد</div>';
    } else {
      list.innerHTML = '';
      d.income.forEach(item => list.appendChild(itemRow(item, 'income', { color: 'inc', toggle: true })));
    }
    const total = d.income.reduce((s, x) => s + U.num(x.amt), 0);
    DOM.setText($('#incTotal'), Fmt.c(total));
  }

  function fixed() {
    const y = store.get('year'), m = store.get('month');
    const d = Sel.monthData(y, m);
    const list = $('#fixList');
    if (!list) return;
    if (!d.fixed.length) {
      list.innerHTML = '<div class="empty"><span class="empty-icon">🏠</span>لا توجد مصاريف ثابتة</div>';
    } else {
      list.innerHTML = '';
      d.fixed.forEach(item => list.appendChild(itemRow(item, 'fixed', { toggle: true })));
    }
    const total = d.fixed.reduce((s, x) => s + U.num(x.amt), 0);
    DOM.setText($('#fixTotal'), Fmt.c(total));
  }

  function variable() {
    const y = store.get('year'), m = store.get('month');
    const d = Sel.monthData(y, m);
    const list = $('#varList');
    if (!list) return;
    list.innerHTML = '';
    const today = new Date().getDate();
    const todayItems = (d.daily?.[today] || []).filter(e => e.type === 'out');
    let totalToday = 0, totalAll = 0;

    if (todayItems.length || d.variable.length) {
      const todaySection = DOM.h('div', { class: 'items', style: { marginBottom: '12px' } });
      if (todayItems.length) {
        todaySection.appendChild(DOM.h('div', {
          style: { fontSize: '11px', color: 'var(--text3)', fontWeight: '700', padding: '4px 0' }
        }, '🕐 اليوم'));
        todayItems.forEach(item => {
          totalToday += U.num(item.amt);
          todaySection.appendChild(itemRow(item, 'daily'));
        });
      }
      list.appendChild(todaySection);

      const otherDays = Object.keys(d.daily || {})
        .map(Number).filter(day => day !== today)
        .sort((a, b) => b - a);
      if (otherDays.length) {
        const prevSection = DOM.h('div', { class: 'items' });
        prevSection.appendChild(DOM.h('div', {
          style: { fontSize: '11px', color: 'var(--text3)', fontWeight: '700', padding: '4px 0' }
        }, '📅 أيام سابقة'));
        for (const day of otherDays) {
          const dayItems = (d.daily[day] || []).filter(e => e.type === 'out');
          if (!dayItems.length) continue;
          dayItems.forEach(item => {
            totalAll += U.num(item.amt);
            prevSection.appendChild(itemRow({ ...item, name: `يوم ${day}: ${item.name}` }, 'daily'));
          });
        }
        list.appendChild(prevSection);
      }

      if (d.variable.length) {
        const oldSection = DOM.h('div', { class: 'items', style: { marginTop: '12px' } });
        d.variable.forEach(item => oldSection.appendChild(itemRow(item, 'variable')));
        list.appendChild(oldSection);
        d.variable.forEach(x => totalAll += U.num(x.amt));
      }
    } else {
      list.innerHTML = '<div class="empty"><span class="empty-icon">📝</span>اضغط + لأضف مصروف</div>';
    }
    DOM.setText($('#varTotal'), Fmt.c(totalToday + totalAll));
  }

  function goals() {
    const y = store.get('year'), m = store.get('month');
    const d = Sel.monthData(y, m);
    const cont = $('#goalList');
    if (!cont) return;
    if (!d.goals.length) {
      cont.innerHTML = '<div class="empty"><span class="empty-icon">🎯</span>أضف هدفاً لتحقيقه</div>';
      return;
    }
    cont.innerHTML = '';
    for (const g of d.goals) {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
      cont.appendChild(DOM.h('div', { class: 'goal' },
        DOM.h('div', { class: 'goal-head' },
          DOM.h('div', { class: 'goal-name' }, `${g.icon || '⭐'} ${g.name}`),
          DOM.h('button', {
            class: 'item-del',
            dataset: { action: 'del-goal', id: g.id }
          }, '✕')
        ),
        DOM.h('div', { class: 'goal-amounts' }, `${Fmt.c(g.saved)} / ${Fmt.c(g.target)}`),
        DOM.h('div', { class: 'goal-track' },
          DOM.h('div', { class: 'goal-fill', style: { width: pct + '%' } })
        ),
        DOM.h('div', { class: 'goal-pct' }, `${pct}٪ ${pct >= 100 ? '🏆 تم!' : ''}`)
      ));
    }
  }

  function budgets() {
    const y = store.get('year'), m = store.get('month');
    const d = Sel.monthData(y, m);
    const cont = $('#budgetItems');
    const alert = $('#budgetAlert');
    if (!cont) return;
    if (!d.budgets.length) {
      cont.innerHTML = '<div class="empty"><span class="empty-icon">🛡️</span>أضف حد إنفاق لفئة</div>';
      if (alert) alert.style.display = 'none';
      return;
    }
    cont.innerHTML = '';
    const cats = Sel.categorySpending(y, m);
    let exceededCount = 0;
    for (const b of d.budgets) {
      const spent = App.Budgets.calcSpent(b.name, cats);
      const pct = b.limit > 0 ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
      const remaining = b.limit - spent;
      const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : '';
      if (pct >= 100) exceededCount++;
      cont.appendChild(DOM.h('div', { class: 'budget' },
        DOM.h('div', { class: 'budget-head' },
          DOM.h('div', { class: 'budget-cat' }, b.name),
          DOM.h('div', { class: 'budget-nums' },
            DOM.h('span', { class: 'budget-spent' }, Fmt.c(spent)),
            DOM.h('span', { class: 'budget-limit' }, ` / ${Fmt.c(b.limit)}`),
            DOM.h('button', {
              class: 'item-del', style: { marginRight: '6px' },
              dataset: { action: 'del-budget', id: b.id }
            }, '✕')
          )
        ),
        DOM.h('div', { class: 'budget-track' },
          DOM.h('div', { class: 'budget-fill ' + cls, style: { width: pct + '%' } })
        ),
        DOM.h('div', { class: 'budget-foot' },
          DOM.h('span', null, `${pct}٪`),
          DOM.h('span', { class: 'budget-remain' + (remaining < 0 ? ' over' : '') },
            remaining >= 0 ? `باقي ${Fmt.c(remaining)}` : `تجاوز ${Fmt.c(-remaining)}`)
        )
      ));
    }
    if (alert) {
      if (exceededCount > 0) {
        alert.textContent = `⚠️ تجاوزت ${exceededCount} ${exceededCount === 1 ? 'حد' : 'حدود'} إنفاق`;
        alert.style.display = 'block';
      } else {
        alert.style.display = 'none';
      }
    }
  }

  function streak() {
    const s = Streak.calc();
    DOM.setText($('#streakNum'), s.current);
    const numEl = $('#streakNum');
    if (numEl) numEl.classList.toggle('active', s.current > 0);
    DOM.setText($('#sCur'), s.current);
    DOM.setText($('#sMax'), s.max || 0);
    DOM.setText($('#sTot'), s.total || 0);

    const today = U.todayStr();
    const checkedIn = s.days?.includes(today);
    const btn = $('#streakBtn');
    if (btn) {
      btn.classList.toggle('done', checkedIn);
      btn.disabled = checkedIn;
      btn.textContent = checkedIn ? '✓ سُجِّل اليوم' : '🔥 سجّل حضورك اليوم';
    }
    const msg = $('#streakMsg');
    if (msg) {
      if (s.current === 0) msg.textContent = 'ابدأ اليوم!';
      else if (s.current < 7) msg.textContent = `${7 - s.current} أيام للأسبوع`;
      else if (s.current < 30) msg.textContent = `${30 - s.current} يوم للبرونز 🥉`;
      else if (s.current < 60) msg.textContent = `${60 - s.current} يوم للذهب 🥇`;
      else if (s.current < 90) msg.textContent = `${90 - s.current} يوم للأوبسيديان 💎`;
      else msg.textContent = '👑 أسطورة!';
    }

    const dots = $('#streakDots');
    if (dots) {
      dots.innerHTML = '';
      const now = new Date();
      const startDay = now.getDay() === 6 ? 0 : (now.getDay() + 1) % 7;
      for (let i = 6; i >= 0; i--) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - i);
        const ds = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
        const isToday = i === 0;
        const done = s.days?.includes(ds);
        const dn = (dt.getDay() + 1) % 7;
        const dotCls = 'streak-dot' + (done ? ' done' : '') + (isToday ? ' today' : '');
        dots.appendChild(DOM.h('div', { class: 'streak-day' },
          DOM.h('div', { class: dotCls }, isToday ? '◉' : (done ? '✓' : '○')),
          DOM.h('div', { class: 'streak-day-num' }, DAY_NAMES[dn])
        ));
      }
    }

    walletCards(s);
  }

  function walletCards(s) {
    const cont = $('#walletCards');
    if (!cont) return;
    cont.innerHTML = '';
    const tiers = [
      { name: 'برونز', cls: 'bronze', days: 30, icon: '🥉', text: 'أساسي • للمبتدئين' },
      { name: 'ذهب', cls: 'gold', days: 60, icon: '🥇', text: 'متقدم • للمنضبطين' },
      { name: 'أوبسيديان', cls: 'obsidian', days: 90, icon: '💎', text: 'نخبة • للأبطال' }
    ];
    for (const t of tiers) {
      if (s.current >= t.days || s.max >= t.days) {
        cont.appendChild(DOM.h('div', { class: 'wallet-card ' + t.cls },
          DOM.h('div', { class: 'wc-top' },
            DOM.h('div', { class: 'wc-badge' }, t.name.toUpperCase()),
            DOM.h('div', { style: { fontSize: '24px' } }, t.icon)
          ),
          DOM.h('div', { class: 'wc-days' }, t.days),
          DOM.h('div', { class: 'wc-days-lbl' }, 'يوم'),
          DOM.h('div', { class: 'wc-footer' }, `🎉 ${t.text}`)
        ));
      } else {
        const pct = Math.min(100, Math.round((s.current / t.days) * 100));
        const fill = t.cls === 'bronze' ? '#cd7f32'
                   : t.cls === 'gold' ? 'var(--accent)' : '#a0a0c0';
        cont.appendChild(DOM.h('div', { class: 'wc-locked' },
          DOM.h('div', { class: 'wc-locked-icon' }, t.icon),
          DOM.h('div', { class: 'wc-locked-body' },
            DOM.h('div', { class: 'wc-locked-name' }, t.name),
            DOM.h('div', { class: 'wc-locked-meta' }, `${s.current} / ${t.days} يوم`),
            DOM.h('div', { class: 'wc-locked-progress' },
              DOM.h('div', { class: 'wc-locked-fill', style: { width: pct + '%', background: fill } })
            )
          ),
          DOM.h('div', { class: 'wc-locked-pct' }, `${pct}٪`)
        ));
      }
    }
  }

  function ai() {
    DOM.setText($('#aiText'), AI.summary());
  }

  function leaks() {
    const list = AI.leaks();
    const card = $('#leakCard');
    const items = $('#leakItems');
    const tip = $('#leakTip');
    if (!card || !items) return;
    if (!list.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    items.innerHTML = '';
    for (const l of list.slice(0, 3)) {
      items.appendChild(DOM.h('div', { class: 'leak-row' },
        DOM.h('div', { style: { fontSize: '18px' } }, l.cat),
        DOM.h('div', { style: { flex: '1', minWidth: '0' } },
          DOM.h('div', { class: 'leak-row-name' }, l.cat),
          DOM.h('div', { class: 'leak-row-detail' }, `${Fmt.n(l.daily)} ﷼/يوم • ${Fmt.n(l.yearly)} ﷼/سنة`)
        ),
        DOM.h('div', { class: 'leak-row-amt' }, Fmt.c(l.monthly))
      ));
    }
    const total = list.reduce((s, x) => s + x.yearly, 0);
    if (tip) tip.textContent = `💡 لو قللت ٢٠٪ من هذي = توفير ${Fmt.c(total * 0.2)} سنوياً`;
  }

  function savingPlan() {
    const slider = $('#savingSlider');
    if (!slider) return;
    const daily = U.num(slider.value, { min: 1, fallback: 20 });
    const plan = AI.savingsPlan(daily);
    DOM.setText($('#dailySavingVal'), `${plan.daily} ﷼`);
    DOM.setText($('#sv-daily'), `${plan.daily} ﷼`);
    DOM.setText($('#sv-monthly'), `${Fmt.n(plan.monthly)} ﷼`);
    DOM.setText($('#sv-yearly'), `${Fmt.n(plan.yearly)} ﷼`);
    const tip = $('#savingTip');
    if (tip) tip.textContent = `بـ ${plan.daily} ﷼ يومياً = ${Fmt.c(plan.yearly)} في السنة 🎯`;
  }

  function pts() {
    DOM.setText($('#ptsVal'), store.get('pts'));
    DOM.setText($('#ptsLevel'), Pts.level().name);
  }

  function achievements() {
    const grids = [$('#achGrid'), $('#achGridProfile')].filter(Boolean);
    if (!grids.length) return;
    const unlocked = store.get('achievements') || [];
    
    for (const grid of grids) {
      grid.innerHTML = '';
      for (const a of ACHIEVEMENTS) {
        const isOn = unlocked.includes(a.id);
        grid.appendChild(DOM.h('div', { class: 'ach-badge ' + (isOn ? 'on' : 'off') },
          DOM.h('div', { class: 'ach-icon' }, a.icon),
          DOM.h('div', { class: 'ach-name' }, a.name),
          DOM.h('div', { class: 'ach-pts' }, `${a.pts}⭐`)
        ));
      }
    }
  }

  function periodChart() {
    const period = store.get('period') || 'daily';
    const y = store.get('year'), m = store.get('month');
    const d = Sel.monthData(y, m);
    const chart = $('#periodChart');
    if (!chart) return;
    chart.innerHTML = '';
    let buckets = [];

    if (period === 'daily') {
      const days = new Date(y, m + 1, 0).getDate();
      const today = new Date().getDate();
      const start = Math.max(1, today - 6);
      for (let i = start; i <= Math.min(start + 6, days); i++) {
        const items = d.daily?.[i] || [];
        const exp = items.filter(x => x.type === 'out').reduce((s, x) => s + U.num(x.amt), 0);
        const inc = items.filter(x => x.type !== 'out').reduce((s, x) => s + U.num(x.amt), 0);
        buckets.push({ label: String(i), exp, inc });
      }
    } else if (period === 'weekly') {
      const weeks = [0, 0, 0, 0, 0];
      const wInc = [0, 0, 0, 0, 0];
      for (const [day, arr] of Object.entries(d.daily || {})) {
        const w = Math.min(4, Math.floor((Number(day) - 1) / 7));
        for (const e of arr) {
          if (e.type === 'out') weeks[w] += U.num(e.amt);
          else wInc[w] += U.num(e.amt);
        }
      }
      buckets = weeks.map((e, i) => ({ label: `أ${i + 1}`, exp: e, inc: wInc[i] }));
    } else if (period === 'monthly') {
      for (let i = 0; i < 12; i++) {
        const t = Sel.totals(y, i);
        buckets.push({ label: MONTHS[i].slice(0, 3), exp: t.expense, inc: t.income });
      }
    } else if (period === 'yearly') {
      const yt = Sel.yearlyTotals(y);
      const ytPrev = Sel.yearlyTotals(y - 1);
      buckets = [
        { label: String(y - 1), exp: ytPrev.expense, inc: ytPrev.income },
        { label: String(y), exp: yt.expense, inc: yt.income }
      ];
    }

    const max = Math.max(1, ...buckets.flatMap(b => [b.exp, b.inc]));
    for (const b of buckets) {
      chart.appendChild(DOM.h('div', { class: 'bar-col' },
        DOM.h('div', { class: 'bar-cluster' },
          DOM.h('div', {
            class: 'bar-fill exp',
            style: { height: ((b.exp / max) * 92) + 'px' },
            title: `مصروف: ${Fmt.c(b.exp)}`
          }),
          DOM.h('div', {
            class: 'bar-fill inc',
            style: { height: ((b.inc / max) * 92) + 'px' },
            title: `دخل: ${Fmt.c(b.inc)}`
          })
        ),
        DOM.h('div', { class: 'bar-col-lbl' }, b.label)
      ));
    }
  }

  function salary() {
    const cd = Salary.countdown();
    DOM.setText($('#salaryCd'), cd.text);
    const sel = $('#salarySelect');
    if (sel) sel.value = store.get('salaryDay') || '';
  }

  function notifBell() {
    const cnt = Notifs.alertCount();
    const dot = $('#bellDot');
    if (dot) dot.style.display = cnt > 0 ? 'block' : 'none';
  }

  function notifPanel() {
    const body = $('#notifPanelBody');
    if (!body) return;
    const list = store.get('notifs');
    if (!list.length) {
      body.innerHTML = '<div class="notif-empty"><div class="notif-empty-icon">🔕</div><div class="notif-empty-text">لا توجد تنبيهات<br>أضف فاتورة من الأسفل ↓</div></div>';
      return;
    }
    body.innerHTML = '';
    const groups = { urgent: [], soon: [], upcoming: [], paid: [] };
    for (const n of list) {
      const s = Notifs.getStatus(n);
      const g = s === 'overdue' || s === 'urgent' ? 'urgent'
              : s === 'soon' ? 'soon'
              : s === 'paid' ? 'paid' : 'upcoming';
      groups[g].push({ ...n, _status: s });
    }
    const headers = {
      urgent: '🔥 عاجل',
      soon: '⚠️ قريب',
      upcoming: '📅 قادم',
      paid: '✅ مسدد'
    };
    for (const [k, items] of Object.entries(groups)) {
      if (!items.length) continue;
      body.appendChild(DOM.h('div', {
        style: { fontSize: '11px', fontWeight: '700', color: 'var(--text3)', padding: '4px 6px', marginTop: '4px' }
      }, `${headers[k]} (${items.length})`));
      for (const n of items) {
        const cls = 'notif-item' + (n._status === 'overdue' || n._status === 'urgent' ? ' urgent'
                  : n._status === 'soon' ? ' warning'
                  : n._status === 'paid' ? ' paid' : '');
        const sBadge = n._status === 'overdue' ? 'overdue'
                     : n._status === 'urgent' ? 'overdue'
                     : n._status === 'soon' ? 'soon'
                     : n._status === 'paid' ? 'paid' : 'upcoming';
        const sBadgeText = n._status === 'overdue' ? 'فات'
                         : n._status === 'urgent' ? 'اليوم'
                         : n._status === 'soon' ? 'قريب'
                         : n._status === 'paid' ? 'مسدد' : 'قادم';
        body.appendChild(DOM.h('div', { class: cls },
          DOM.h('div', { class: 'notif-icon' }, n.icon || '🔔'),
          DOM.h('div', { class: 'notif-cbody' },
            DOM.h('div', { class: 'notif-name' }, n.name),
            n.amt ? DOM.h('div', { class: 'notif-amt' }, Fmt.c(n.amt)) : null,
            DOM.h('div', { class: 'notif-meta' },
              DOM.h('span', null, `يوم ${n.day}`),
              DOM.h('span', { class: 'notif-sbadge ' + sBadge }, sBadgeText)
            )
          ),
          DOM.h('button', {
            class: 'notif-check' + (n._status === 'paid' ? ' checked' : ''),
            dataset: { action: 'notif-paid', id: n.id },
            'aria-label': 'سدّد'
          }, n._status === 'paid' ? '✓' : '○'),
          DOM.h('button', {
            class: 'item-del',
            dataset: { action: 'notif-del', id: n.id }
          }, '✕')
        ));
      }
    }
  }

  function yearly() {
    const y = store.get('year');
    const yt = Sel.yearlyTotals(y);
    DOM.setText($('#yInc'), Fmt.c(yt.income));
    DOM.setText($('#yExp'), Fmt.c(yt.expense));
    DOM.setText($('#ySav'), Fmt.c(yt.save));
    DOM.setText($('#yearChartLabel'), y);

    const bars = $('#yearBars');
    const lbls = $('#yearLbls');
    if (!bars || !lbls) return;
    bars.innerHTML = '';
    lbls.innerHTML = '';
    const max = Math.max(1, ...yt.monthly.flatMap(t => [t.income, t.expense]));
    for (let i = 0; i < 12; i++) {
      const t = yt.monthly[i];
      const col = DOM.h('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        DOM.h('div', { style: { display: 'flex', gap: '1px', alignItems: 'flex-end', height: '96px', width: '100%' } },
          DOM.h('div', {
            style: {
              flex: '1', borderRadius: '2px 2px 0 0', minHeight: '2px',
              background: 'var(--green)',
              height: ((t.income / max) * 92) + 'px'
            },
            title: Fmt.c(t.income)
          }),
          DOM.h('div', {
            style: {
              flex: '1', borderRadius: '2px 2px 0 0', minHeight: '2px',
              background: 'var(--danger)',
              height: ((t.expense / max) * 92) + 'px'
            },
            title: Fmt.c(t.expense)
          })
        )
      );
      bars.appendChild(col);
      lbls.appendChild(DOM.h('div', {
        style: { flex: '1', textAlign: 'center', fontSize: '8px', color: 'var(--text3)' }
      }, MONTHS[i].slice(0, 3)));
    }
  }

  function all() {
    const tab = store.get('tab');
    const subTab = store.get('subTab');
    greeting();

    // Support both new structure (money + subTab) and legacy (monthly/yearly)
    const effectiveTab = (tab === 'money') ? (subTab || 'monthly') : tab;

    if (effectiveTab === 'monthly' || tab === 'monthly') {
      bankCard();
      summary();
      pts();
      income();
      fixed();
      variable();
      goals();
      budgets();
      streak();
      ai();
      leaks();
      savingPlan();
      achievements();
      periodChart();
      salary();
    } else if (effectiveTab === 'yearly' || tab === 'yearly') {
      yearly();
    } else if (tab === 'home') {
      // Home tab - no heavy rendering needed
      pts();
    } else if (tab === 'profile') {
      achievements();
    }
    notifBell();
    notifPanel();

    // Update month label
    DOM.setText($('#monthLbl'), `${MONTHS[store.get('month')]} ${store.get('year')}`);
  }

  function scheduledAll() {
    Scheduler.schedule(all);
  }

  return { all, scheduledAll, greeting, bankCard, summary, income, fixed, variable,
           goals, budgets, streak, ai, leaks, savingPlan, pts, achievements,
           periodChart, salary, notifBell, notifPanel, yearly };
})();

// Expose globally for cross-file access
window.Renderers = Renderers;
