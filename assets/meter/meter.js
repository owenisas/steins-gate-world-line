/**
 * meter.js: the divergence meter controller (DOM + SVG Nixie tubes). ES module, no dependencies.
 * Last updated: 2026-09-25
 *
 * The static markup (tools/expand_meters.py) already shows the number with no JS. This module only animates it.
 *
 *   import { meter, meterAll } from './assets/meter/meter.js';
 *   const m = meter(document.querySelector('[data-meter]'));   // same controller on every call for one element
 *   await m.shiftTo('0.571024');             // roll, lock left to right, resolves true (false if superseded)
 *   await m.shiftTo('0.523299', { roll: false });   // instant swap
 *   await m.ignite('1.130426');              // loader: tubes strike from dark, cycle, lock
 *   await m.reread();                        // roll that locks on the same value
 *   await m.fail();                          // 404: cycles, flickers, never locks, stops after ~4s
 *   const off = m.onLock((d) => ...);        // per-tube lock: d = { index, char, first, last, value }
 *   m.value                                  // '0.571024' (the value being shown or rolled to)
 *
 * EVENTS (CustomEvent, bubbling, dispatched on the [data-meter] element)
 *   meter:shift   { from, to, mode }            a roll starts (mode: shift | reread | ignite | fail | instant)
 *   meter:lock    { index, char, first, last, value }   one tube locks (index 0 and 2-7; tube 1 is the decimal)
 *   meter:locked  { value, mode }               the whole meter has settled (after the last lock pulse)
 *   meter:fail    { value }                     fail() finished without locking
 *
 * TIMING (DESIGN.md section 6)
 *   Every digit tube steps through random numerals every 45-70ms. The first tube locks at 340ms (ignite: 560ms),
 *   the rest follow left to right at +40-90ms each, and each lock gets a 120ms over-bright pulse.
 *   Worst case: last lock 880ms, settled 1000ms.
 *   Reduced motion (OS or <html data-motion="reduce">), roll: false, or a hidden tab: instant swap, no per-tube
 *   lock events. fail() under reduced motion shows a static -.------.
 *
 * ALSO EXPORTED
 *   meterAll(root?) -> controllers for every [data-meter] under root
 *   meterHTML(value, { size, sprite, id, className, ignite }) -> the same markup the expander writes
 *   normalize(value) -> the 8 tube characters; reducedMotion() -> boolean
 *   controller.subscribe(fn) -> unsubscribe. fn({ chars, lit, mode }) on every visible change (meter-gl.js uses it)
 *   controller.state(), controller.el
 */

const DIGITS = '0123456789';
const KEY = { '.': 'dot', '?': 'q', '-': 'dash', ' ': 'blank' };
const LABEL_UNKNOWN = 'Divergence meter: world line unknown';
const LABEL_NONE = 'Divergence meter: no reading';
const DEFAULT_SPRITE = new URL('./nixie.svg', import.meta.url).href;
const PULSE_MS = 120;
const controllers = new WeakMap();
const live = new Set();

const rand = (a, b) => a + Math.random() * (b - a);
const keyOf = (c) => (DIGITS.includes(c) ? c : KEY[c] || 'blank');

export function reducedMotion() {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';
  } catch {
    return false;
  }
}

/** 8 display characters; index 1 is always the decimal point. Same rules as tools/expand_meters.py. */
export function normalize(value) {
  const v = String(value ?? '');
  let first, right;
  if (v.includes('.')) {
    const i = v.indexOf('.');
    first = v.slice(0, i).slice(-1) || ' ';
    right = v.slice(i + 1);
  } else {
    first = v.slice(0, 1) || ' ';
    right = v.slice(1);
  }
  const digits = (right + '      ').slice(0, 6);
  return [first, '.', ...digits].map((c) => (DIGITS.includes(c) || c in KEY ? c : ' '));
}

const display = (chars) => chars.join('');
function labelOf(chars) {
  const rest = chars.filter((_, i) => i !== 1);
  if (rest.every((c) => c === '?')) return LABEL_UNKNOWN;
  if (rest.every((c) => c === '-')) return LABEL_NONE;
  return `Divergence meter reading ${display(chars).trim()}`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function tubeHTML(c, sprite) {
  const key = keyOf(c);
  const svg = 'viewBox="0 0 60 100" aria-hidden="true" focusable="false"';
  const href = `${sprite}#nx-${key}`;
  return `<span class="nx__tube" data-char="${key}">` +
    `<svg class="nx__stack" ${svg}><use href="${sprite}#nx-stack"/></svg>` +
    `<svg class="nx__lit" ${svg}><use class="nx__sheath" href="${href}"/><use class="nx__core" href="${href}"/></svg>` +
    `<svg class="nx__front" ${svg}><use href="${sprite}#nx-f-${key}"/></svg></span>`;
}

/** The markup tools/expand_meters.py writes, for meters created at runtime. */
export function meterHTML(value, { size = 'hero', sprite = DEFAULT_SPRITE, id = '', className = '', ignite = false } = {}) {
  const chars = normalize(value);
  const shown = display(chars);
  const cls = ['nx', `nx--${size}`, ...String(className).split(/[\s,]+/).filter(Boolean)].join(' ');
  return `<div class="${esc(cls)}"${id ? ` id="${esc(id)}"` : ''} data-meter data-size="${esc(size)}" ` +
    `data-value="${esc(shown)}"${ignite ? ' data-ignite' : ''} role="img" aria-label="${esc(labelOf(chars))}">` +
    chars.map((c) => tubeHTML(c, sprite)).join('') +
    `<span class="nx__text">${esc(shown.trim())}</span></div>`;
}

export function meterAll(root = document) {
  return [...root.querySelectorAll('[data-meter]')].map((el) => meter(el));
}

export function meter(el) {
  if (!el) return null;
  if (controllers.has(el)) return controllers.get(el);

  // Build the tubes if the page shipped an empty [data-meter] (the expander normally writes them).
  if (el.querySelectorAll('.nx__tube').length !== 8) {
    const size = el.dataset.size || [...el.classList].find((c) => c.startsWith('nx--'))?.slice(4) || 'hero';
    const tpl = document.createElement('template');
    tpl.innerHTML = meterHTML(el.dataset.value ?? '', { size });
    const fresh = tpl.content.firstElementChild;
    el.classList.add(...fresh.classList);
    for (const a of ['data-size', 'data-value', 'role', 'aria-label']) {
      if (!el.hasAttribute(a)) el.setAttribute(a, fresh.getAttribute(a));
    }
    el.replaceChildren(...fresh.childNodes);
  }

  const firstUse = el.querySelector('.nx__core, use');
  const sprite = (firstUse?.getAttribute('href') || firstUse?.getAttribute('xlink:href') || DEFAULT_SPRITE).split('#')[0];
  const tubes = [...el.querySelectorAll('.nx__tube')].slice(0, 8).map((t) => ({
    el: t,
    uses: [...t.querySelectorAll('.nx__lit use')],
    core: t.querySelector('.nx__core'),
    sheath: t.querySelector('.nx__sheath'),
    front: t.querySelector('.nx__front use'),
    char: null,
    lit: 1,
  }));
  const text = el.querySelector('.nx__text');

  let target = normalize(el.dataset.value ?? '');
  const shown = target.slice();
  tubes.forEach((t, i) => { t.char = shown[i]; });

  let token = 0;         // bumps on every run, so an older run knows it was superseded
  let current = null;    // { resolve, finish } of the running animation
  let mode = 'idle';
  const lockCbs = new Set();
  const subs = new Set();
  let dirty = false;

  /* ---------- DOM writes ---------- */

  function setChar(i, c) {
    const t = tubes[i];
    if (!t || t.char === c) return;
    t.char = c;
    shown[i] = c;
    const key = keyOf(c);
    for (const u of t.uses) u.setAttribute('href', `${sprite}#nx-${key}`);
    t.front?.setAttribute('href', `${sprite}#nx-f-${key}`);
    t.el.dataset.char = key;
    dirty = true;
  }

  function setLit(i, level) { // 1 on, 0.38 browning out, 0 dark
    const t = tubes[i];
    if (!t || t.lit === level) return;
    t.lit = level;
    t.el.classList.toggle('is-off', level === 0);
    t.el.classList.toggle('is-dim', level > 0 && level < 1);
    dirty = true;
  }

  function pulse(i) {
    const t = tubes[i];
    if (!t?.core?.animate) return;
    try {
      const cs = getComputedStyle(t.core);
      const w = parseFloat(cs.strokeWidth) || 1.15;
      const ws = parseFloat(getComputedStyle(t.sheath).strokeWidth) || 2.9;
      const opts = { duration: PULSE_MS, easing: 'cubic-bezier(.33, 1, .68, 1)' };
      t.core.animate([{ strokeWidth: `${w * 1.9}px`, color: '#FFF3E0' }, { strokeWidth: `${w}px`, color: cs.color }], opts);
      t.sheath.animate([{ strokeWidth: `${ws * 1.3}px` }, { strokeWidth: `${ws}px` }], opts);
    } catch { /* a missing pulse is cosmetic */ }
  }

  function flush() {
    if (!dirty) return;
    dirty = false;
    if (!subs.size) return;
    const snap = { chars: shown.slice(), lit: tubes.map((t) => t.lit), mode };
    for (const fn of subs) { try { fn(snap); } catch (err) { console.warn('[meter] subscriber failed:', err); } }
  }

  function emit(type, detail) {
    el.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  }

  function announce(chars) {
    const s = display(chars);
    el.dataset.value = s;
    el.setAttribute('aria-label', labelOf(chars));
    if (text) text.textContent = s.trim();
  }

  function lockTube(i, first, last) {
    setChar(i, target[i]);
    setLit(i, target[i] === ' ' ? 0 : 1);
    pulse(i);
    const detail = { index: i, char: target[i], first, last, value: display(target) };
    for (const cb of lockCbs) { try { cb(detail); } catch (err) { console.warn('[meter] onLock callback failed:', err); } }
    emit('meter:lock', detail);
  }

  /* ---------- runs ---------- */

  function instant(next, m = 'instant') {
    cancel();
    const from = display(shown);
    target = next;
    announce(target);
    mode = m;
    el.toggleAttribute('data-ignite-owned', true);
    emit('meter:shift', { from, to: display(target), mode: m });
    target.forEach((c, i) => { setChar(i, c); setLit(i, c === ' ' ? 0 : 1); });
    mode = 'idle';
    dirty = true;
    flush();
    emit('meter:locked', { value: display(target), mode: m });
    return Promise.resolve(true);
  }

  function cancel() {
    if (!current) return;
    const c = current;
    current = null;
    token++;
    c.resolve(false);
  }

  /**
   * One rAF-driven animation. `plan` decides, per tube, when it cycles, strikes, browns out and locks.
   * Resolves true when it completes, false when a newer run replaced it.
   */
  function run(next, m, opts = {}) {
    if (opts.roll === false || reducedMotion() || document.hidden) return instant(next, m === 'fail' ? 'fail' : 'instant');
    cancel();
    const my = ++token;
    const from = display(shown);
    target = next;
    announce(target);
    mode = m;
    el.toggleAttribute('data-ignite-owned', true);
    emit('meter:shift', { from, to: display(target), mode: m });

    const t0 = performance.now();
    const rolling = [0, 2, 3, 4, 5, 6, 7];
    const plan = tubes.map((_, i) => ({
      rolls: i !== 1,
      next: 0,
      lockAt: Infinity,
      locked: i === 1 && m !== 'ignite',
      strikeAt: m === 'ignite' ? rand(0, 230) : 0,
      struck: m !== 'ignite',
      dropAt: m === 'fail' ? rand(250, 900) : Infinity,
      dropEnd: 0,
      holdUntil: 0,
    }));

    if (m === 'fail') {
      // never locks
    } else {
      let at = m === 'ignite' ? 560 : 340;
      for (const i of rolling) { plan[i].lockAt = at; at += rand(40, 90); }
      if (m === 'ignite') plan[1].lockAt = 0; // the decimal tube simply stays lit once struck
    }
    const failEnd = m === 'fail' ? (opts.duration ?? 4000) : 0;
    const lastLock = Math.max(...rolling.map((i) => plan[i].lockAt));

    if (m === 'ignite') tubes.forEach((_, i) => setLit(i, 0));
    flush();

    return new Promise((resolve) => {
      const finish = () => { // jump to the end (tab hidden mid-run)
        if (token !== my) return;
        current = null;
        rolling.forEach((i, k) => { if (!plan[i].locked && m !== 'fail') { plan[i].locked = true; lockTube(i, k === 0, k === rolling.length - 1); } });
        target.forEach((c, i) => { setChar(i, c); setLit(i, c === ' ' ? 0 : 1); });
        done();
      };
      const done = () => {
        mode = 'idle';
        dirty = true;
        flush();
        if (m === 'fail') emit('meter:fail', { value: display(target) });
        emit('meter:locked', { value: display(target), mode: m });
        resolve(true);
      };
      current = { resolve, finish };

      const step = (now) => {
        if (token !== my) return;
        const t = now - t0;
        let lockedCount = 0;

        for (let i = 0; i < 8; i++) {
          const p = plan[i];
          // strike (ignite): dark until strikeAt, then on-off-on over ~70ms, the way neon catches
          if (!p.struck) {
            if (t < p.strikeAt) continue;
            const s = t - p.strikeAt;
            if (s < 22) setLit(i, 1);
            else if (s < 48) setLit(i, 0);
            else { setLit(i, 1); p.struck = true; }
            if (!p.rolls) setChar(i, '.');
          }
          if (i === 1) { if (p.struck) { setChar(1, '.'); p.locked = true; } continue; }
          if (p.locked) { lockedCount++; continue; }

          if (t >= p.lockAt) {
            p.locked = true;
            lockedCount++;
            const k = rolling.indexOf(i);
            lockTube(i, k === 0, k === rolling.length - 1);
            continue;
          }
          if (m === 'fail') { // brown-outs and hesitations: it tries, and fails, to hold a digit
            if (t >= p.dropAt) {
              setLit(i, Math.random() < 0.5 ? 0 : 0.38);
              p.dropEnd = t + rand(30, 60);
              p.dropAt = t + rand(600, 1600);
            } else if (p.dropEnd && t >= p.dropEnd) {
              setLit(i, 1);
              p.dropEnd = 0;
            }
            if (t < p.holdUntil) continue;
          }
          if (t >= p.next) {
            let d;
            do { d = DIGITS[(Math.random() * 10) | 0]; } while (d === shown[i]);
            setChar(i, d);
            if (tubes[i].lit === 0 && m !== 'fail' && p.struck) setLit(i, 1);
            p.next = t + rand(45, 70);
            if (m === 'fail' && Math.random() < 0.08) p.holdUntil = t + rand(180, 420);
          }
        }
        flush();

        const settled = m === 'fail'
          ? t >= failEnd
          : lockedCount >= rolling.length && plan[1].locked && t >= lastLock + PULSE_MS;
        if (settled) {
          current = null;
          if (m === 'fail') target.forEach((c, i) => { setChar(i, c); setLit(i, c === ' ' ? 0 : 1); });
          done();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  const api = {
    el,
    get value() { return display(target); },
    shiftTo(value, { roll = true } = {}) { return run(normalize(value), 'shift', { roll }); },
    ignite(value) { return run(normalize(value ?? display(target)), 'ignite'); },
    reread() { return run(target.slice(), 'reread'); },
    fail({ duration = 4000 } = {}) {
      if (reducedMotion()) return instant(normalize('-.------'), 'fail');
      return run(target.slice(), 'fail', { duration });
    },
    onLock(cb) { lockCbs.add(cb); return () => lockCbs.delete(cb); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    state: () => ({ chars: shown.slice(), lit: tubes.map((t) => t.lit), mode, value: display(target) }),
    finishNow() { current?.finish(); },
    destroy() { cancel(); lockCbs.clear(); subs.clear(); controllers.delete(el); live.delete(api); },
  };
  controllers.set(el, api);
  live.add(api);
  return api;
}

// A backgrounded tab stops rAF: finish every running roll at once rather than resume a stale one later.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const m of live) m.finishNow();
  });
}
