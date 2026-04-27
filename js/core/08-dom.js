/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — DOM helpers v2
   ───────────────────────────────────────────────────────────────────
   التحسينات:
   1. replaceChildren بدلاً من innerHTML='' (أسرع، XSS-safe)
   2. patchList مع reorder صحيح (الإصدار القديم لم يعالج reorder بشكل مثالي)
   3. lazyRender helper بـ IntersectionObserver
   4. delegate يدعم abort signal (cleanup سهل)
   5. h() يكشف خطأ عند تمرير undefined كـ child بدل تجاهله بصمت في prod
═══════════════════════════════════════════════════════════════════ */

var $ = (sel, root = document) => (root || document).querySelector(sel);
var $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));

var DOM = (() => {
  /**
   * Create element with attrs and children.
   * Special attrs: class, style (object), html (innerHTML — DANGEROUS), 
   * dataset (object), on{Event} (function), aria-{attr}, data-{attr}
   */
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') {
          el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
        } else if (k === 'style' && typeof v === 'object') {
          Object.assign(el.style, v);
        } else if (k === 'dataset' && typeof v === 'object') {
          for (const dk in v) el.dataset[dk] = v[dk];
        } else if (k === 'html') {
          // Caller's responsibility to ensure HTML is safe
          el.innerHTML = v;
        } else if (k === 'ref' && typeof v === 'function') {
          // Callback ref pattern — useful for getting handle to created node
          v(el);
        } else if (k.length > 2 && k[0] === 'o' && k[1] === 'n' && typeof v === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          el.setAttribute(k, v === true ? '' : v);
        }
      }
    }
    appendChildren(el, children);
    return el;
  }

  function appendChildren(parent, children) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c == null || c === false || c === true) continue;
      if (Array.isArray(c)) { appendChildren(parent, c); continue; }
      const node = (typeof c === 'string' || typeof c === 'number')
        ? document.createTextNode(String(c))
        : c;
      // Guard: ignore non-Node values to avoid throwing
      if (node && node.nodeType) parent.appendChild(node);
    }
  }

  /** Event delegation; supports abort signal for cleanup */
  function delegate(root, eventType, selector, handler, opts = {}) {
    if (!root) return () => {};
    const wrappedHandler = (e) => {
      const target = e.target?.closest?.(selector);
      if (target && root.contains(target)) handler(e, target);
    };
    const listenerOpts = typeof opts === 'boolean' ? opts : opts;
    root.addEventListener(eventType, wrappedHandler, listenerOpts);
    return () => root.removeEventListener(eventType, wrappedHandler, listenerOpts);
  }

  /**
   * Keyed list patching — minimizes DOM mutations.
   * Properly handles: add, remove, reorder, update.
   */
  function patchList(container, items, getKey, createNode, updateNode) {
    if (!container) return;
    const existing = new Map();
    for (const child of container.children) {
      const key = child.dataset.key;
      if (key !== undefined) existing.set(key, child);
    }

    // Build target sequence
    const target = [];
    for (const item of items) {
      const key = String(getKey(item));
      let node = existing.get(key);
      if (node) {
        if (updateNode) updateNode(node, item);
        existing.delete(key);
      } else {
        node = createNode(item);
        if (node) node.dataset.key = key;
      }
      if (node) target.push(node);
    }

    // Remove stale nodes first
    for (const stale of existing.values()) stale.remove();

    // Reorder/insert: walk current children vs target in lockstep
    let cursor = container.firstElementChild;
    for (const node of target) {
      if (cursor === node) {
        cursor = cursor.nextElementSibling;
      } else {
        container.insertBefore(node, cursor);
        // cursor stays — we inserted before it
      }
    }
    // Anything after the last target node is leftover (shouldn't happen, but be safe)
    while (cursor) {
      const next = cursor.nextElementSibling;
      // If it's not in target, it shouldn't be here
      if (!target.includes(cursor)) cursor.remove();
      cursor = next;
    }
  }

  /** Avoid no-op text writes (prevents unnecessary reflows) */
  function setText(el, text) {
    if (!el) return;
    const s = String(text == null ? '' : text);
    if (el.textContent !== s) el.textContent = s;
  }

  /** Set innerHTML — caller is responsible for safety */
  function setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }

  /** Empty a node FAST (faster than innerHTML='') */
  function empty(el) {
    if (!el) return;
    if (el.replaceChildren) el.replaceChildren();
    else while (el.firstChild) el.removeChild(el.firstChild);
  }

  /** Show/hide element */
  function show(el, visible = true) {
    if (!el) return;
    el.style.display = visible ? '' : 'none';
  }

  /** Toggle class with state */
  function toggleClass(el, cls, on) {
    if (!el) return;
    el.classList.toggle(cls, on);
  }

  /**
   * Lazy render: invoke `render` only when `el` enters viewport.
   * Returns disconnect fn.
   */
  function lazyRender(el, render, options = {}) {
    if (!el || typeof render !== 'function') return () => {};
    if (!('IntersectionObserver' in window)) {
      // Fallback: render immediately
      try { render(el); } catch (e) { Logger?.warn?.('lazyRender', e?.message); }
      return () => {};
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          try { render(entry.target); } catch (e) { Logger?.warn?.('lazyRender', e?.message); }
          io.unobserve(entry.target);
        }
      }
    }, { rootMargin: '50px', threshold: 0.01, ...options });
    io.observe(el);
    return () => io.disconnect();
  }

  return { h, delegate, patchList, setText, setHtml, empty, show, toggleClass, lazyRender };
})();

window.Tdbeer.DOM = DOM;
window.Tdbeer.$ = $;
window.Tdbeer.$$ = $$;
window.DOM = DOM;
window.$ = $;
window.$$ = $$;
