/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Scheduler (rAF batching)
   ───────────────────────────────────────────────────────────────────
   Depends on: Logger
   Originally lines 11978–12005 of index.html
═══════════════════════════════════════════════════════════════════ */

var Scheduler = (() => {
  const queue = new Set();
  let scheduled = false;
  function flush() {
    scheduled = false;
    const tasks = Array.from(queue);
    queue.clear();
    for (const task of tasks) {
      try { task(); }
      catch (e) { Logger.error('Scheduler', e); }
    }
  }
  return {
    schedule(task) {
      queue.add(task);
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    },
    flushNow() {
      if (scheduled) { scheduled = false; flush(); }
    }
  };
})();

// ═══ DOM HELPERS ═══
var $ = (sel, root = document) => root.querySelector(sel);

window.Tdbeer.Scheduler = Scheduler;
