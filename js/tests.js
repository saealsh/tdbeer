/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Tests (debug-only)
   ───────────────────────────────────────────────────────────────────
   Originally lines 21788–21884 of index.html
═══════════════════════════════════════════════════════════════════ */

const Tests = (() => {
  const { U, Fmt, Store, Storage, ACHIEVEMENTS } = Tdbeer;
  const { Budgets } = App;

  let pass = 0, fail = 0;

  function assert(cond, label) {
    if (cond) { pass++; console.log('✓', label); }
    else { fail++; console.error('✗', label); }
  }

  function testUtils() {
    assert(U.num('123.4') === 123.4, 'U.num parses string');
    assert(U.num('abc', { fallback: 7 }) === 7, 'U.num fallback');
    assert(U.num(-5, { min: 0 }) === 0, 'U.num min clamp');
    assert(U.num(999, { max: 100 }) === 100, 'U.num max clamp');
    assert(U.str('  hello  ') === 'hello', 'U.str trims');
    assert(U.str('a'.repeat(200), 10).length === 10, 'U.str caps length');
    assert(U.esc('<b>x</b>') === '&lt;b&gt;x&lt;/b&gt;', 'U.esc escapes HTML');
    assert(U.day(35, 2024, 1) === 29, 'U.day clamps to month max');
  }

  function testFmt() {
    assert(typeof Fmt.n(1234) === 'string', 'Fmt.n returns string');
    assert(Fmt.c(0).includes('﷼'), 'Fmt.c has currency');
    assert(Fmt.p(50) === '50٪', 'Fmt.p arabic percent');
  }

  function testStore() {
    const s = new Store({ a: { b: 1 } });
    assert(s.get('a.b') === 1, 'Store nested get');
    s.set('a.b', 2);
    assert(s.get('a.b') === 2, 'Store nested set');
    let called = 0;
    const unsub = s.subscribe('a.b', () => called++);
    s.set('a.b', 3);
    assert(called === 1, 'Store subscribe fires');
    unsub();
    s.set('a.b', 4);
    assert(called === 1, 'Store unsubscribe works');

    let computeCount = 0;
    const sel = (key) => s.select(key, ['a.b'], () => { computeCount++; return s.get('a.b') * 2; });
    sel('test');
    sel('test');
    assert(computeCount === 1, 'Store memoization');
    s.set('a.b', 5);
    sel('test');
    assert(computeCount === 2, 'Store memo invalidation');
  }

    function testBudgetMatching() {
    const cats = { '🍔 أكل': 100, '🚗 مواصلات': 50, '🛒 تسوق': 200 };
    assert(Budgets.calcSpent('🍔 أكل', cats) === 100, 'Budget matches by exact name');
    assert(Budgets.calcSpent('🍔', cats) === 100, 'Budget matches by emoji');
    assert(Budgets.calcSpent('أكل', cats) === 100, 'Budget matches by text');
  }

  function run() {
    pass = 0; fail = 0;
    try {
      testUtils();
      testFmt();
      testStore();
      testBudgetMatching();
    } catch (e) {
      console.error('Test crashed:', e);
      fail++;
    }
    const total = pass + fail;
    if (fail === 0) {
      App.Toast.show(`✅ كل الاختبارات نجحت (${pass}/${total})`, 'success', 4000);
    } else {
      App.Toast.show(`⚠️ ${fail} اختبار فشل من ${total}`, 'warn', 4000);
    }
    return { pass, fail, total };
  }

  return { run };
})();
