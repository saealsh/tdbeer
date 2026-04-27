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

// 🔧 FIX: حذفنا تعريف "$" من هنا لأنه مكرر مع 08-dom.js (سطر 8).
// التعريف الصحيح موجود في 08-dom.js مع $$ ودوال DOM الأخرى.

window.Tdbeer.Scheduler = Scheduler;
