/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — DOM helpers ($, $$, DOM)
   ───────────────────────────────────────────────────────────────────
   Originally lines 12005–12095 of index.html
═══════════════════════════════════════════════════════════════════ */

// Selector shortcuts
var $ = (sel, root = document) => root.querySelector(sel);
var $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

var DOM = {
  /** Create element with attrs and children */
  h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'dataset' && typeof v === 'object') {
        for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      } else if (k === 'html') {
        el.innerHTML = v; // ONLY for controlled content
      } else {
        el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false) continue;
      el.appendChild(
        typeof child === 'string' || typeof child === 'number'
          ? document.createTextNode(String(child))
          : child
      );
    }
    return el;
  },

  /** Event delegation */
  delegate(root, eventType, selector, handler, opts) {
    if (!root) return;
    root.addEventListener(eventType, (e) => {
      const target = e.target.closest(selector);
      if (target && root.contains(target)) handler(e, target);
    }, opts);
  },

  /** Keyed list patching — reuses DOM nodes */
  patchList(container, items, getKey, createNode, updateNode) {
    if (!container) return;
    const existing = new Map();
    for (const child of Array.from(container.children)) {
      const key = child.dataset.key;
      if (key) existing.set(key, child);
    }
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const key = String(getKey(item));
      let node = existing.get(key);
      if (node) {
        if (updateNode) updateNode(node, item);
        existing.delete(key);
      } else {
        node = createNode(item);
        node.dataset.key = key;
      }
      frag.appendChild(node);
    }
    for (const stale of existing.values()) stale.remove();
    container.appendChild(frag);
  },

  setText(el, text) {
    if (!el) return;
    if (el.textContent !== String(text)) el.textContent = String(text);
  },

  setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
  },

  show(el, visible = true) {
    if (!el) return;
    el.style.display = visible ? '' : 'none';
  }
};

// (Original code had a `return { ... }` here that exposed everything
//  back to the outer Tdbeer IIFE wrapper. We've removed that wrapper
//  and now expose individually below.)


window.Tdbeer.DOM = DOM;
window.Tdbeer.$ = $;
window.Tdbeer.$$ = $$;
window.DOM = DOM;
window.$ = $;
window.$$ = $$;
