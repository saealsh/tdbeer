/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Namespace Initializer
   ───────────────────────────────────────────────────────────────────
   MUST load FIRST. Creates window.Tdbeer that subsequent core
   modules populate, and from which feature modules destructure
   their dependencies (e.g. `const { U, Fmt } = Tdbeer;`).
═══════════════════════════════════════════════════════════════════ */

window.Tdbeer = window.Tdbeer || {};

// Production flag (preserved from original)
if (typeof window.__PROD__ === 'undefined') {
  try {
    window.__PROD__ = window.location.hostname !== 'localhost'
                   && !window.location.hostname.includes('127.0.0.1');
  } catch (e) { window.__PROD__ = true; }
}
