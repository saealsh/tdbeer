/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Fmt (Formatter)
   ───────────────────────────────────────────────────────────────────
   Depends on: U
   Originally lines 11745–11761 of index.html
═══════════════════════════════════════════════════════════════════ */

var Fmt = (() => {
  const ar = (() => {
    try { return new Intl.NumberFormat('ar-SA'); }
    catch { return { format: n => String(n) }; }
  })();
  return {
    /** Format a number (with sign if negative) */
    n(val) {
      const v = Math.abs(Math.round(U.num(val)));
      return (U.num(val) < 0 ? '-' : '') + ar.format(v);
    },
    /** Format currency */
    c(val) { return Fmt.n(val) + ' ﷼'; },
    /** Format percentage */
    p(val) { return U.num(val) + '٪'; }
  };
})();

window.Tdbeer.Fmt = Fmt;
window.Fmt = Fmt;
