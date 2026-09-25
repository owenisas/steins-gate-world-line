/* ==========================================================================
   shift.js: the world-line shift orchestrator (DESIGN.md sections 3, 6)
   --------------------------------------------------------------------------
   What it does
     Every element with data-worldline (chapter sections, marked paragraphs, ledger rows)
     is a marker in document order. When a marker's top crosses the viewport centre, the
     current world line becomes its value; scrolling back above it returns to the previous
     marker's value. Each change:
       1. rolls the nav mini meter:  meter(el).shiftTo(value)  (meter/meter.js, owned by the
          meter build; it returns a Promise and dispatches `meter:lock` per tube, detail {index})
       2. at the first lock, the page takes the monochrome "Reading Steiner" blink:
          a fixed overlay with backdrop-filter: grayscale(1), 160ms in, 480ms out
       3. announces "World line shifted to 0.523299" in a polite live region, at most once
          per chapter, never during the first paint
       4. dispatches  document  `worldline:shift`  CustomEvent  { from, to, source }
   API
     const shift = initShift({ initial: '1.130426', scroll: true });
     shift.shiftTo(value, { source, announce, blink })   -> Promise
     shift.current                                       -> '0.571024'
     shift.refresh({ quiet })                            -> re-measure marker positions (quiet: no blink, no announcement)
     shift.coalesce(promise)                             -> hold every scroll shift until a jump lands, then one shift
     shift.blink()                                       -> the Reading Steiner blink on its own (rate-limited)
   v3 (DESIGN 12)
     Markers inside a closed <details> (the spoiler gate, "Read the full chapter") are not on the page: they are
     skipped until it opens. A <details> toggling re-measures at once and moves the meter quietly (no roll storm, no
     blink): a layout change is not a world-line shift. A jump (navigator, chapter menu, J/K, deep link) coalesces:
     the chapters flown past shift nothing, and the destination shifts once, with its blink and announcement.
   Contract with the meter (code only against this; the module may be absent)
     import { meter, meterAll } from '../meter/meter.js'   (dynamic, in try/catch)
     meter(rootEl) -> { shiftTo(value, { roll }) -> Promise, ignite(value), reread(), fail(), finishNow() }
     Root element: the [data-meter] inside a [data-meter-slot] wrapper, which
     tools/expand_meters.py fills between <!-- meter:SIZE VALUE [flags] --> and <!-- /meter -->.
     A blank tube is written as a space (e.g. ' .275349' for the Faris line).
   Fallbacks
     No meter.js, or the markers are not expanded yet: the nav slot shows a text stand-in
     (CSS attr(data-reading)), which this module keeps current. Everything else still runs.
     Reduced motion (OS or html[data-motion="reduce"]): instant swap, no blink.
   ========================================================================== */

const CENTRE = 0.5;               // fraction of the viewport height that counts as "centre"
const BLINK_IN = 160;             // ms, DESIGN 6
const BLINK_OUT = 480;            // ms
const BLINK_GAP = 900;            // ms between blinks: never more than ~1 flash per second
const LOCK_WAIT = 1100;           // ms to wait for a first meter:lock before blinking anyway

let meterModule = null;           // resolved module or null
let meterLoad = null;             // Promise of the module

const reduced = () =>
  document.documentElement.dataset.motion === 'reduce' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Rendered on the page: not inside a closed <details> (a closed details still shows its own summary). */
export function shown(el) {
  for (let d = el?.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])')) {
    const summary = d.querySelector(':scope > summary');
    if (!summary || !summary.contains(el)) return false;
  }
  return !!el;
}

/** First element inside a meter slot, i.e. the expanded meter root (or null). */
export function meterRoot(slot) {
  if (!slot) return null;
  return slot.querySelector('[data-meter]') || slot.firstElementChild || null;
}

/** True when at least one slot on the page holds expanded meter markup. */
export function metersExpanded() {
  return [...document.querySelectorAll('[data-meter-slot]')].some((s) => s.firstElementChild);
}

/** Load meter/meter.js once, only when there is expanded markup for it to drive. */
export function loadMeter() {
  if (meterLoad) return meterLoad;
  if (!metersExpanded()) return (meterLoad = Promise.resolve(null));
  meterLoad = import('../meter/meter.js')
    .then((m) => (meterModule = m && typeof m.meter === 'function' ? m : null))
    .catch((err) => {
      console.warn('[shift] meter/meter.js did not load; the text stand-in stays.', err);
      return (meterModule = null);
    });
  return meterLoad;
}

/** A controller for one slot's meter, or null. Never throws. */
export function controllerFor(slot) {
  const root = meterRoot(slot);
  if (!root || !meterModule) return null;
  try { return meterModule.meter(root) || null; } catch (err) {
    console.warn('[shift] meter() failed', err);
    return null;
  }
}

export function initShift({ initial = '1.130426', scroll = true } = {}) {
  const navSlot = document.querySelector('[data-meter-slot="nav"]');
  const trigger = document.querySelector('[data-index-trigger]');
  const live = document.querySelector('[data-worldline-live]');
  const veil = document.querySelector('[data-steiner]');
  const indexLinks = [...document.querySelectorAll('[data-index-link]')];

  const markers = scroll ? [...document.querySelectorAll('[data-worldline]')] : [];
  let tops = [];
  let current = initial;            // what the meter shows (or is rolling to)
  let wanted = initial;             // the latest requested value
  let running = null;               // Promise of the roll in flight
  let lastBlink = -Infinity;
  let booted = false;
  const announced = new Set();

  const chapterOf = (el) => el?.closest('[data-chapter]')?.dataset.chapter || null;

  // Layout positions from the offsetTop chain: unlike getBoundingClientRect they ignore transforms, so a
  // ledger row caught mid-reveal (translated 24px) is still measured where it rests.
  const docTop = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
  function measure() {
    tops = markers.map((m) => (shown(m) ? docTop(m) : Infinity));
  }

  function activeMarker() {
    const line = scrollY + innerHeight * CENTRE;
    let hit = -1;
    for (let i = 0; i < tops.length; i++) if (tops[i] <= line) hit = i;
    return hit;
  }

  function setStandIn(value) {
    if (navSlot) navSlot.dataset.reading = value;
    if (trigger) trigger.setAttribute('aria-label', `Chapter index. World line ${value}`);
  }

  function markCurrent(markerIdx) {
    const el = markers[markerIdx] || null;
    document.querySelectorAll('.ledger__row.is-current').forEach((r) => r !== el && r.classList.remove('is-current'));
    if (el && el.classList.contains('ledger__row')) el.classList.add('is-current');
    const ch = chapterOf(el);
    indexLinks.forEach((a) => {
      if (a.dataset.indexLink === ch) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  function blink() {
    if (!veil || reduced() || typeof veil.animate !== 'function') return;
    const now = performance.now();
    if (now - lastBlink < BLINK_GAP) return;
    lastBlink = now;
    const total = BLINK_IN + BLINK_OUT;
    veil.animate(
      [
        { opacity: 0, easing: 'cubic-bezier(.32, 0, .67, 0)' },        // --ease-exit: colour drains
        { opacity: 1, offset: BLINK_IN / total, easing: 'cubic-bezier(.25, 1, .5, 1)' }, // --ease-enter: colour returns
        { opacity: 0 },
      ],
      { duration: total, fill: 'none' },
    );
  }

  function announce(value, chapter) {
    if (!live || !booted) return;
    const key = chapter || value;
    if (announced.has(key)) return;
    announced.add(key);
    live.textContent = `World line shifted to ${value}`;
  }

  /** Roll the nav meter to `value`. The latest request wins and rolls never overlap:
   *  one pump loop keeps rolling until the meter shows the most recent value. */
  function shiftTo(value, { source = 'scroll', announce: say = true, blink: flash = true, chapter = null } = {}) {
    value = String(value);
    if (value === wanted) return running || Promise.resolve(value);
    const from = wanted;
    wanted = value;
    setStandIn(value);
    document.dispatchEvent(new CustomEvent('worldline:shift', { detail: { from, to: value, source } }));
    if (say) announce(value.trim().startsWith('.') ? '-0' + value.trim() : value, chapter);
    if (!running) {
      running = (async () => {
        while (current !== wanted) await roll(wanted, flash);
        return current;
      })().finally(() => { running = null; });
    }
    return running;
  }

  async function roll(value, flash) {
    await loadMeter();
    const ctl = controllerFor(navSlot);
    const quiet = reduced();
    if (!ctl || typeof ctl.shiftTo !== 'function') {
      if (flash) blink();
      current = value;
      return value;
    }
    let locked = false;
    const root = meterRoot(navSlot);
    const onLock = () => {
      if (locked) return;
      locked = true;
      if (flash) blink();
    };
    // Capture phase: catches per-tube meter:lock events whether or not they bubble.
    root?.addEventListener('meter:lock', onLock, true);
    const timer = flash && !quiet ? setTimeout(onLock, LOCK_WAIT) : 0;
    try {
      await ctl.shiftTo(value, { roll: !quiet });
    } catch (err) {
      console.warn('[shift] shiftTo failed', err);
    } finally {
      clearTimeout(timer);
      root?.removeEventListener('meter:lock', onLock, true);
    }
    current = value;
    return value;
  }

  /** Quietly show `value` (first paint, reload mid-page): no roll, blink or announcement. */
  async function setQuiet(value) {
    wanted = current = value;
    setStandIn(value);
    await loadMeter();
    const ctl = controllerFor(navSlot);
    if (!ctl) return;
    try {
      if (typeof ctl.shiftTo === 'function') await ctl.shiftTo(value, { roll: false });
    } catch (err) { console.warn('[shift] set failed', err); }
  }

  // ---- scroll tracking ------------------------------------------------------
  let lastIdx = -2;
  let ticking = false;
  let holding = 0;                  // > 0 while a jump is in flight (coalesce)
  let quietNext = false;            // the next change comes from a layout change, not from reading
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      measure();                    // cheap (offset reads) and immune to late layout: fonts, reveals, images
      const idx = activeMarker();
      if (idx === lastIdx) { quietNext = false; return; }
      markCurrent(idx);
      if (holding) return;          // flying past: no roll, blink or announcement until the jump lands
      lastIdx = idx;
      const value = idx < 0 ? initial : markers[idx].dataset.worldline;
      const quiet = quietNext;
      quietNext = false;
      shiftTo(value, quiet
        ? { source: 'layout', announce: false, blink: false }
        : { source: 'scroll', chapter: chapterOf(markers[idx]) });
    });
  }

  /** Hold scroll shifts while `promise` (a jump) runs; then shift once to wherever it landed. */
  function coalesce(promise) {
    holding++;
    const release = () => {
      holding = Math.max(0, holding - 1);
      if (!holding) { lastIdx = -2; onScroll(); }
    };
    Promise.resolve(promise).then(release, release);
    return promise;
  }

  /** A layout change (a <details> toggling): re-measure now and follow quietly. */
  function relayout() {
    quietNext = true;
    lastIdx = -2;
    requestAnimationFrame(() => requestAnimationFrame(onScroll));
  }

  if (markers.length) {
    measure();
    const idx = activeMarker();
    lastIdx = idx;
    markCurrent(idx);
    setQuiet(idx < 0 ? initial : markers[idx].dataset.worldline);
    addEventListener('scroll', onScroll, { passive: true });
    const remeasure = () => { measure(); lastIdx = -2; onScroll(); };
    addEventListener('resize', remeasure);
    addEventListener('load', remeasure, { once: true });
    document.fonts?.ready.then(remeasure);
    if ('ResizeObserver' in window) new ResizeObserver(() => measure()).observe(document.body);
    document.addEventListener('toggle', (e) => { if (e.target instanceof HTMLDetailsElement) relayout(); }, true);
  } else {
    setQuiet(initial);
  }
  // Quiet during the first paint and the hero ignition; then announcements may speak.
  setTimeout(() => { booted = true; }, 1600);

  return {
    shiftTo,
    setQuiet,
    coalesce,
    blink,
    get current() { return wanted; },
    refresh: ({ quiet = false } = {}) => { measure(); if (quiet) quietNext = true; lastIdx = -2; onScroll(); },
  };
}
