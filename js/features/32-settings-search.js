/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Settings Search (Apr 2026)
   ───────────────────────────────────────────────────────────────────
   Live filter the redesigned Settings tab. Matches against:
   - section/row titles + descriptions
   - data-keywords attribute (manually curated synonyms)
═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Local HTML escape (defensive)
  function esc(s) {
    if (window.U?.esc) return window.U.esc(s);
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalize(s) {
    return String(s || '').toLowerCase().trim()
      // Remove Arabic diacritics so "الإعدادات" matches "الإعدادات"
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // Normalize Alef variants
      .replace(/[\u0622\u0623\u0625]/g, '\u0627')
      // Normalize Yaa
      .replace(/\u0649/g, '\u064A')
      // Normalize Hamza-Taa
      .replace(/\u0629/g, '\u0647');
  }

  function matchesQuery(haystack, query) {
    if (!query) return true;
    const h = normalize(haystack);
    const q = normalize(query);
    if (!q) return true;
    // Match each word independently (AND)
    const words = q.split(/\s+/).filter(Boolean);
    return words.every(w => h.includes(w));
  }

  function getRowSearchText(el) {
    const title = el.querySelector('.settings-row-title, .notif-setting-title')?.textContent || '';
    const desc = el.querySelector('.settings-row-desc, .notif-setting-desc')?.textContent || '';
    const kw = el.dataset.keywords || '';
    return `${title} ${desc} ${kw}`;
  }

  function getSectionSearchText(el) {
    const title = el.querySelector('.settings-section-title')?.textContent || '';
    const desc = el.querySelector('.settings-section-desc')?.textContent || '';
    const kw = el.dataset.keywords || '';
    return `${title} ${desc} ${kw}`;
  }

  function applyFilter(query) {
    const tab = document.getElementById('tab-settings');
    if (!tab) return;

    const q = String(query || '').trim();
    const sections = tab.querySelectorAll('.settings-section');
    let totalVisible = 0;

    sections.forEach(section => {
      const sectionMatches = matchesQuery(getSectionSearchText(section), q);

      // Filter rows inside the section
      const rows = section.querySelectorAll('.settings-row, .notif-setting');
      let visibleInSection = 0;

      rows.forEach(row => {
        const rowMatches = matchesQuery(getRowSearchText(row), q);
        // Show row if: no query OR section matches OR row matches
        const show = !q || sectionMatches || rowMatches;
        row.classList.toggle('settings-search-hidden', !show);
        if (show) visibleInSection++;
      });

      // Hide entire section only if query exists AND nothing matches inside
      // AND the section itself doesn't match.
      const showSection = !q || sectionMatches || visibleInSection > 0;
      section.classList.toggle('settings-search-hidden', !showSection);
      if (showSection) totalVisible++;
    });

    // Empty state
    const emptyEl = document.getElementById('settingsSearchEmpty');
    if (emptyEl) {
      emptyEl.hidden = !(q && totalVisible === 0);
    }

    // Show/hide clear button
    const clearBtn = document.getElementById('settingsSearchClear');
    if (clearBtn) clearBtn.hidden = !q;
  }

  function init() {
    const input = document.getElementById('settingsSearchInput');
    const clearBtn = document.getElementById('settingsSearchClear');
    if (!input) return;

    let timer = null;
    input.addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => applyFilter(e.target.value), 80);
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      applyFilter('');
      input.focus();
    });

    // Esc clears
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape' && input.value) {
        e.preventDefault();
        input.value = '';
        applyFilter('');
      }
    });

    // Reset filter when leaving the settings tab
    document.addEventListener('tab-changed', () => {
      input.value = '';
      applyFilter('');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for diagnostics
  window.SettingsSearch = { init, applyFilter };
})();
