/* ==========================================================================
   reader.js: reading mode, the spoiler gate and every way to move through the journal (DESIGN 12.1, 12.4, 12.6)
   Last updated: 2026-09-25
   --------------------------------------------------------------------------
   What it does
     - Reader mode. <html data-reader="new|fan"> (the head script sets it before first paint from localStorage
       "reader", newcomer by default). The hero's two doors choose it, the chapter menu switches it ("Reading as:
       newcomer / fan"), and it opens or shuts the spoiler gate (#spoilers). With no choice made, the page reads as
       a newcomer: the gate shut. The choice persists (try/catch).
     - The gate. A native <details>: its own summary opens it for anyone. A jump into chapters 4-9 from anywhere
       else (the navigator, the chapter menu, a chapter's "next" link, J) asks first while it is shut: "This spoils
       the second half. Open?" (a modal <dialog>, focus on the safe answer). A deep link (a URL ending #ch-05) is an
       explicit request and opens it without asking (the inline script in index.html does that at parse time).
     - Jumps. Every in-page link marked [data-go] (doors, navigator, menu, prev/next, primer links, footer) goes
       through one route: close the menu, confirm if gated, then one 0.9 s Lenis scroll (instant under reduced
       motion) through loom.js scrollToY / seekTo, with the meter and the loom coalescing (the chapters flown past
       shift nothing and play nothing). The URL hash follows (pushState), Back and Forward work, and focus moves to
       the destination's heading so the next Tab starts there.
     - Keys. J next chapter, K previous chapter. Ignored with a modifier, in a field (input, textarea, select,
       contenteditable), or while a popover or the confirm is open.
     - Deep links on load: #primer, #lab, #dmail, #spoilers and #ch-01 ... #ch-09 land again once fonts have
       settled (the browser's own jump happens before layout is final), with no animation.
     - The navigator (.wl-nav): the node of the chapter under the viewport centre is lit (aria-current), and the
       thread above it reads stronger (data-passed on each passed node).
   Needs
     loom.js navigation helpers (seekTo, scrollToY, scrollYFor, isShown: no WebGL), shift.js (coalesce), the chapter
     menu api from main.js (close without returning focus). No CDN dependency.
   ========================================================================== */

const root = document.documentElement;
const STORE = 'reader';
const read = () => { try { return localStorage.getItem(STORE); } catch (e) { return null; } };
const write = (v) => { try { localStorage.setItem(STORE, v); } catch (e) { /* private mode */ } };
const reduced = () => root.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const TARGETS = /^(primer|lab|dmail|spoilers|ch-0[1-9])$/;
const docTop = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
const frames = (n = 2) => new Promise((r) => { const step = () => (--n <= 0 ? r() : requestAnimationFrame(step)); requestAnimationFrame(step); });

export function initReader({ shift = null, index = null, nav = null } = {}) {
  const gate = document.getElementById('spoilers');
  const confirmBox = document.getElementById('spoiler-confirm');
  const chapters = [...document.querySelectorAll('section.chapter[id]')];
  const switchEl = document.querySelector('[data-reader-switch]');
  const keysEl = document.querySelector('[data-keys]');
  let navApi = null;                       // loom.js navigation helpers, loaded on demand (no WebGL needed)
  const navReady = import('./loom.js').then((m) => (navApi = m)).catch(() => null);

  const shown = (el) => (navApi ? navApi.isShown(el) : !el.closest('details:not([open])'));
  const gated = (el) => !!gate && el !== gate && gate.contains(el) && !gate.querySelector(':scope > summary')?.contains(el);

  /* ---- reader mode -------------------------------------------------------------------- */
  function applyMode(mode, { persist = false } = {}) {
    root.dataset.reader = mode;
    if (persist) { write(mode); root.dataset.readerChosen = ''; }
    switchEl?.querySelectorAll('[data-reader-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.readerSet === mode)));
  }
  function setMode(mode, { moveTo = true } = {}) {
    applyMode(mode, { persist: true });
    if (!gate) return;
    if (mode === 'fan' && !gate.open) gate.open = true;
    if (mode === 'new' && gate.open) {
      const inside = gate.contains(document.activeElement) || (moveTo && scrollY > docTop(gate) + 40);
      gate.open = false;
      if (inside && moveTo) {
        // the reader was inside the second half: land on the shut gate rather than wherever the page collapsed to
        requestAnimationFrame(() => {
          const summary = gate.querySelector(':scope > summary');
          scrollTo({ top: Math.max(0, docTop(summary) - innerHeight * 0.3), behavior: 'instant' });
          summary?.focus({ preventScroll: true });
        });
      }
    }
  }
  if (read()) root.dataset.readerChosen = '';
  applyMode(root.dataset.reader === 'fan' ? 'fan' : 'new');
  if (switchEl) {
    switchEl.hidden = false;
    switchEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-reader-set]');
      if (b) setMode(b.dataset.readerSet);
    });
  }
  if (keysEl) keysEl.hidden = false;

  /* ---- the confirm ---------------------------------------------------------------------- */
  function askSpoilers() {
    if (!confirmBox || typeof confirmBox.showModal !== 'function') return Promise.resolve(window.confirm('This spoils the second half. Open?'));
    return new Promise((resolve) => {
      confirmBox.returnValue = '';
      const done = () => { confirmBox.removeEventListener('close', done); resolve(confirmBox.returnValue === 'open'); };
      confirmBox.addEventListener('close', done);
      window.__motion?.lenis?.stop();
      confirmBox.showModal();
      confirmBox.querySelector('[value="stay"]')?.focus();
    }).finally(() => window.__motion?.lenis?.start());
  }

  /* ---- the route every jump takes ------------------------------------------------------ */
  let busy = null;
  let landingY = null;                       // where the jump in flight will land: J and K count from there
  function focusTarget(el, focusSel) {
    const f = (focusSel && document.querySelector(focusSel)) ||
      (el.matches('section.chapter') ? el.querySelector('h2') : null) ||
      (el === gate ? gate.querySelector(':scope > summary') : null) ||
      el.querySelector('h2, h3') || el;
    if (!f) return;
    if (!f.matches('a[href], button, input, textarea, select, summary, [tabindex]')) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  }
  async function go(id, { confirm = true, push = true, focus = true, focusSel = null, immediate = false } = {}) {
    const el = document.getElementById(id);
    if (!el) return false;
    await navReady;
    if (gated(el) && !gate.open) {
      if (confirm && !(await askSpoilers())) return false;
      gate.open = true;
      await frames(2);                                  // let the gate lay out; the loom and the meter re-measure
    }
    if (push && location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    const loom = window.__loom;
    const isChapter = el.matches('section.chapter');
    let y;
    if (isChapter && navApi) y = navApi.scrollYFor(el);
    if (y == null) {
      const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
      y = Math.max(0, docTop(el === gate ? gate.querySelector(':scope > summary') : el) - pad);
    }
    loom?.coalesce?.();                                 // the loom flies past every beat without a sound or a flash
    const jump = navApi
      ? (isChapter && loom?.live ? loom.seekTo(el, { immediate }) : navApi.scrollToY(y, { immediate, target: el }))
      : new Promise((r) => { scrollTo({ top: y, behavior: immediate || reduced() ? 'instant' : 'smooth' }); setTimeout(r, 700); });
    shift?.coalesce?.(jump);
    busy = jump;
    landingY = y;
    await jump;
    if (busy === jump) { busy = null; landingY = null; }
    if (focus) focusTarget(el, focusSel);
    return true;
  }

  // One click route for every in-page jump link. Capture phase, so Lenis's own anchor handling never runs for these.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href^="#"][data-go], a[href^="#"][data-index-link]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!TARGETS.test(id) || !document.getElementById(id)) return;
    e.preventDefault();
    e.stopPropagation();
    if (a.closest('[popover]')) index?.close({ returnFocus: false });
    const door = a.dataset.door;
    if (door) setMode(door, { moveTo: false });
    go(id, { focusSel: a.dataset.focus || null });
  }, true);

  addEventListener('popstate', () => {
    const id = location.hash.slice(1);
    if (TARGETS.test(id)) go(id, { push: false, confirm: false, focus: false });
  });

  /* ---- J and K --------------------------------------------------------------------------- */
  function neighbour(dir) {
    const y = landingY ?? scrollY;
    if (dir > 0) {
      for (const ch of chapters) {
        if (!shown(ch)) return ch;                        // the first chapter behind the shut gate comes next
        const cy = navApi?.scrollYFor(ch);
        if (cy != null && cy > y + 8) return ch;
      }
      return null;
    }
    let prev = null;
    for (const ch of chapters) {
      if (!shown(ch)) break;
      const cy = navApi?.scrollYFor(ch);
      if (cy != null && cy < y - 8) prev = ch; else break;
    }
    return prev;
  }
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    const k = e.key;
    if (k !== 'j' && k !== 'k' && k !== 'J' && k !== 'K') return;
    const t = e.target;
    if (t instanceof Element && (t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') || t.isContentEditable)) return;
    if (document.querySelector(':popover-open') || confirmBox?.open || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    const target = neighbour(k.toLowerCase() === 'j' ? 1 : -1);
    if (target) go(target.id, { push: false, focus: false });
  });

  /* ---- deep links on load ------------------------------------------------------------------ */
  const landing = location.hash.slice(1);
  if (TARGETS.test(landing)) {
    const land = async () => {
      await navReady;
      await (document.fonts?.ready ?? Promise.resolve());
      await frames(2);
      go(landing, { push: false, confirm: false, focus: false, immediate: true });
    };
    if (document.readyState === 'complete') land(); else addEventListener('load', land, { once: true });
  }

  /* ---- the navigator ------------------------------------------------------------------------- */
  const wl = document.querySelector('[data-wl-nav]');
  if (wl) {
    const links = [...wl.querySelectorAll('a[href^="#ch-"]')];
    const journal = document.getElementById('journal');
    const mark = (id) => {
      let idx = links.findIndex((a) => a.getAttribute('href') === '#' + id);
      links.forEach((a, i) => (i === idx ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      if (idx < 0 && journal) {
        // between chapters (the dusk, the gate) or outside the journal: the trail holds where the reader is
        const mid = scrollY + innerHeight / 2;
        const passed = links.filter((a) => {
          const ch = document.getElementById(a.getAttribute('href').slice(1));
          return ch && shown(ch) && docTop(ch) < mid;
        }).length;
        idx = passed - 1;
      }
      links.forEach((a, i) => { const li = a.parentElement; if (i < idx) li.dataset.passed = ''; else delete li.dataset.passed; });
    };
    document.addEventListener('loom:chapter', (e) => mark(e.detail?.id || null));
    mark(window.__journal?.chapter ?? null);
  }

  return { go, setMode, askSpoilers, get mode() { return root.dataset.reader; } };
}
