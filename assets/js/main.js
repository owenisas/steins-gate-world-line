/* ==========================================================================
   main.js: boot for every page (index.html, lab.html, 404.html)
   --------------------------------------------------------------------------
   Order
     1. nav: the plate follows the ground under it (and the navigator's ink follows the ground under the middle of
        the screen); the chapter index popover gets focus handling, Lenis pause and link closing (it opens without
        JS through popovertarget, from the meter or, below 64em, the "Chapters" tab)
     2. sound (opt-in), shift orchestrator, D-mail composer: local modules with no CDN
        dependency, so a blocked CDN never takes them down
     3. motion: vendor/motion-core.js (GSAP + Lenis from the import map) and magnetic.js,
        imported dynamically inside try/catch
     4. hero (index only): ignite once per session, re-read on press, WebGL after load+idle
     5. the loom (index only, DESIGN 11): loom.js mounts once the reader scrolls into #journal (full motion,
        WebGL2, no Save-Data). Before it creates its context it releases the hero's GL meter, so the page never
        holds two live WebGL scenes; the hero keeps its DOM meter (poster) and a DOM re-read from then on.
     6. lab.html: hovering or focusing a member row shows that member's world line
     7. v3 (DESIGN 12, index): reader.js (reading mode, the spoiler gate and its confirm, one route for every jump,
        J/K, deep links, the navigator), terms.js (term explainers), primer.js (the primer's demos). All local, no CDN.
   QA and navigation hooks: window.__motion is the motion-core api (tests freeze its ticker for screenshots);
   window.__loom is the loom api (state(), highlight(), seekTo(), dispose()) once mounted; window.__journal
   ({ seekTo, scrollYFor, chapter }) and the document event 'loom:chapter' work in every mode.
   ========================================================================== */
import { initShift, loadMeter, controllerFor } from './shift.js';
import { initDmail } from './dmail.js';
import { initSound } from './sound.js';
import { initReader } from './reader.js';
import { initTerms } from './terms.js';
import { initPrimer } from './primer.js';

const root = document.documentElement;
const page = document.body.dataset.page || 'journal';
const reduced = () => root.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- 1. Nav ------------------------------------------------------------------ */
function initNavGround() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const special = [...document.querySelectorAll('[data-nav-ground]')];
  const grounds = [...document.querySelectorAll('[data-ground]')].filter((el) => !el.closest('[popover], .nav'));
  const railNodes = [...document.querySelectorAll('.wl-nav__list > li')];
  let ticking = false;

  function groundAt(y) {
    for (const el of special) {
      const r = el.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) {
        const kind = el.dataset.navGround;
        const p = (y - r.top) / Math.max(1, r.height);
        if (kind === 'fall-up') return p < 0.5 ? 'lab' : 'haze';
        if (kind === 'fall-down') return p < 0.5 ? 'haze' : 'lab';
        return kind;
      }
    }
    let hit = 'lab';
    for (const el of grounds) {
      const r = el.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) hit = el.dataset.ground; // deepest (last in document order) wins
    }
    return hit;
  }
  function update() {
    ticking = false;
    const g = groundAt(nav.offsetHeight / 2);
    if (root.dataset.nav !== g) root.dataset.nav = g;
    // The navigator spans two grounds during a fall: each node (and its length of thread) takes the ground under it.
    for (const li of railNodes) {
      const r = li.getBoundingClientRect();
      const on = groundAt(r.top + 13) === 'haze' ? 'haze' : 'lab';
      if (li.dataset.on !== on) li.dataset.on = on;
    }
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
}

function initIndex() {
  const pop = document.getElementById('chapter-index');
  const trigger = document.querySelector('[data-index-trigger]');
  if (!pop || !trigger) return null;
  const native = typeof pop.showPopover === 'function';
  let leavingByLink = false;
  let invoker = trigger;                    // the meter or the "Chapters" tab: focus goes back to whichever opened it
  document.querySelectorAll('[popovertarget="chapter-index"]').forEach((b) => b.addEventListener('click', () => { invoker = b; }));

  const open = () => {
    window.__motion?.lenis?.stop();
    const target = pop.querySelector('a[aria-current="true"]') || pop.querySelector('a');
    requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  };
  const closed = () => {
    window.__motion?.lenis?.start();
    const back = invoker && invoker.offsetParent !== null ? invoker : trigger;
    if (!leavingByLink) back.focus({ preventScroll: true });
    leavingByLink = false;
  };

  if (native) {
    pop.addEventListener('toggle', (e) => {
      if (e.newState === 'open' && e.source instanceof HTMLElement) invoker = e.source;
      e.newState === 'open' ? open() : closed();
    });
  } else {
    // Old engines: a class toggle with the same focus rules, Esc included.
    pop.hidden = true;
    trigger.addEventListener('click', () => {
      const isOpen = pop.classList.toggle('is-open');
      pop.hidden = !isOpen;
      trigger.setAttribute('aria-expanded', String(isOpen));
      isOpen ? open() : closed();
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && pop.classList.contains('is-open')) trigger.click();
    });
  }
  pop.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    leavingByLink = true;
    if (native) pop.hidePopover(); else trigger.click();
  });
  return {
    /** Close the menu; reader.js closes it for a jump and moves focus to the destination itself. */
    close({ returnFocus = true } = {}) {
      const isOpen = native ? pop.matches(':popover-open') : pop.classList.contains('is-open');
      if (!isOpen) return;
      leavingByLink = !returnFocus;
      if (native) pop.hidePopover(); else trigger.click();
    },
  };
}

/* ---- 3. Motion ------------------------------------------------------------------ */
async function initMotion() {
  try {
    const mc = await import('./vendor/motion-core.js');
    window.__motion = mc.init();
    const { initMagnetic } = await import('./vendor/magnetic.js');
    initMagnetic();
  } catch (err) {
    console.warn('[main] motion layer unavailable; the page stays static.', err);
  }
}

/* ---- 4. Hero ------------------------------------------------------------------------ */
function webglOK() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch (e) { return false; }
}

// The hero's GL meter: kept so the loom can take the context from it (DESIGN 11: one active WebGL scene).
let heroGL = null;
let heroGLRelease = null;           // wires the DOM re-read once the GL layer is gone
const heroAbort = new AbortController();
function releaseHeroGL() {
  if (!heroAbort.signal.aborted) heroAbort.abort();   // cancels a meter still booting
  heroGL?.dispose?.();
  heroGL = null;
  heroGLRelease?.();
}

async function initHero() {
  const stage = document.getElementById('meter-gl');           // the full-bleed stage meter-gl.js draws into
  const slot = stage?.querySelector('[data-meter-slot="hero"]');
  if (!stage || !slot) return;
  const value = slot.dataset.reading || '1.130426';
  await loadMeter();
  const ctl = controllerFor(slot);
  if (!ctl) return;

  // Pressing the DOM meter re-reads the line (a roll that locks on the same value): the hero's control whenever
  // the WebGL layer is absent or has handed its context to the loom.
  let domReread = false;
  const wireDomReread = () => {
    if (domReread || reduced() || typeof ctl.reread !== 'function') return;
    domReread = true;
    slot.setAttribute('role', 'button');
    slot.tabIndex = 0;
    slot.setAttribute('aria-label', `Re-read the world line, ${value}`);
    slot.addEventListener('click', () => ctl.reread());
    slot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctl.reread(); }
    });
  };

  // Ignite once per session (the marker's `ignite` flag arms the digits dark until this claims them).
  let first = false;
  try { first = !sessionStorage.getItem('wl-ignited'); sessionStorage.setItem('wl-ignited', '1'); } catch (e) { first = false; }
  if (first && !reduced() && typeof ctl.ignite === 'function') {
    const skip = () => { try { ctl.finishNow?.(); } catch (e) { /* cosmetic */ } };  // skippable by scrolling
    addEventListener('scroll', skip, { once: true, passive: true });
    Promise.resolve(ctl.ignite(value)).catch((err) => console.warn('[main] ignite failed', err))
      .finally(() => removeEventListener('scroll', skip));
  } else {
    ctl.shiftTo(value, { roll: false });   // repeat visit or reduced motion: claim the armed digits now
  }

  // three.js hero meter: full motion, WebGL and no Save-Data. It adds its own re-read button over the meter.
  let glLive = false;
  const saveData = navigator.connection?.saveData === true;
  if (!reduced() && !saveData && webglOK() && !heroAbort.signal.aborted) {
    await new Promise((resolve) => {
      const go = () => {
        const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 250));
        idle(async () => {
          try {
            if (heroAbort.signal.aborted) return resolve();
            const m = await import('../meter/meter-gl.js');
            const api = typeof m.mountMeterGL === 'function' ? await m.mountMeterGL(stage, { value, signal: heroAbort.signal }) : null;
            if (heroAbort.signal.aborted) api?.dispose?.();
            else { heroGL = api; glLive = !!api?.live; }
          } catch (err) {
            console.warn('[main] WebGL meter unavailable; the DOM meter stays.', err);
          }
          resolve();
        }, { timeout: 2500 });
      };
      if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
    });
  }

  heroGLRelease = wireDomReread;
  if (!glLive || heroAbort.signal.aborted) wireDomReread();
}

/* ---- 5. The loom (DESIGN 11) ------------------------------------------------------------ */
function initLoom() {
  const journal = document.getElementById('journal');
  const stage = journal?.querySelector('[data-loom]');
  if (!journal || !stage) return;
  // Navigation hooks for every mode (no WebGL needed; loom.js has no static imports, so a blocked CDN is fine):
  // document 'loom:chapter' { id, index, previous } when the chapter under the viewport centre changes, and
  // window.__journal.seekTo('ch-05' | 5 | '0.409431', { immediate }) to go there.
  import('./loom.js').then((m) => {
    const w = m.watchChapters(journal);
    window.__journal = { seekTo: m.seekTo, scrollYFor: m.scrollYFor, get chapter() { return w?.current ?? null; } };
  }).catch((err) => console.warn('[main] journal navigation hooks unavailable.', err));
  let api = null, loading = false;
  const allowed = () => !reduced() && navigator.connection?.saveData !== true;
  const start = async () => {
    if (api?.live || loading || !allowed() || !webglOK()) return;
    loading = true;
    try {
      const m = await import('./loom.js');
      if (allowed()) {
        api = await m.mountLoom(journal, { stage, beforeContext: releaseHeroGL });
        window.__loom = api;
      }
    } catch (err) {
      console.warn('[main] loom unavailable; the static loom map stays.', err);
    }
    loading = false;
  };
  // Init once the reader has scrolled into #journal: its top 30% of a viewport into view. (The hero is exactly
  // one viewport tall, so a one-viewport margin would fire at load and retire the hero's GL meter before anyone
  // saw it. three.js is already cached from the hero, and the cord sits a dawn fall below the journal's top, so
  // the canvas is live before the rope scrolls in.) Re-armed after a live switch back to full motion and after a
  // bfcache restore, since the loom disposes itself on reduced motion and on pagehide.
  const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) start(); },
    { rootMargin: '0px 0px -30% 0px' });
  io.observe(journal);
  const rearm = () => { io.unobserve(journal); io.observe(journal); };
  addEventListener('motionchange', (e) => { if (e.detail === 'full') rearm(); });
  addEventListener('pageshow', (e) => { if (e.persisted) rearm(); });
}

/* ---- 404: the meter tries to read the line and fails to lock ------------------------------ */
async function initLost() {
  const slot = document.querySelector('[data-meter-slot="404"]');
  if (!slot) return;
  await loadMeter();
  const ctl = controllerFor(slot);
  try { await ctl?.fail?.(); } catch (err) { console.warn('[main] fail() failed', err); }
}

/* ---- 6. lab.html members ------------------------------------------------------------- */
function initMembers(shift) {
  const table = document.querySelector('[data-members]');
  if (!table || !shift) return;
  const base = shift.current;
  let timer = 0;
  const go = (v) => {
    clearTimeout(timer);
    timer = setTimeout(() => shift.shiftTo(v, { source: 'member', announce: false, blink: false }), 90);
  };
  table.querySelectorAll('tr[data-worldline]').forEach((row) => {
    row.addEventListener('pointerenter', () => go(row.dataset.worldline));
    row.addEventListener('focus', () => go(row.dataset.worldline));
  });
  table.addEventListener('pointerleave', () => go(base));
  table.addEventListener('focusout', (e) => { if (!table.contains(e.relatedTarget)) go(base); });
}

/* ---- boot ------------------------------------------------------------------------------ */
initNavGround();
const indexApi = initIndex();
initSound();
const navSlot = document.querySelector('[data-meter-slot="nav"]');
const shift = initShift({ initial: navSlot?.dataset.reading || '1.130426', scroll: page === 'journal' });
initDmail({ shift });
if (page === 'lab') initMembers(shift);
if (page === 'journal') {
  window.__reader = initReader({ shift, index: indexApi });
  initTerms();
  initPrimer({ shift }).catch((err) => console.warn('[main] primer demos unavailable.', err));
}
initMotion();
if (page === 'journal') { initHero(); initLoom(); }
if (page === 'lost') initLost();
window.__worldline = shift;
