/* ==========================================================================
   primer.js: the primer's small demos (DESIGN 12.2), built from the site's own parts
   Last updated: 2026-09-25
   --------------------------------------------------------------------------
   What it does
     The figure (tools/render_primer_svg.py): three threads tied into a bundle, a spark on the beta thread.
       - Point at a thread (hover), or tab to it: it steps up and the others step back; pressing one reads it on
         the meter beside it. Three transparent row buttons are added here (no JS: hovering the yarn still works).
     The meter (a DOM meter, meter.js through shift.js's controllerFor): press it to re-read the line.
     Shift (the Reading Steiner demo): one press plays all four ideas together. The D-mail arc draws, the spark
       rides it onto the alpha thread, the meter rolls 1.130426 -> 0.571024, the page blinks monochrome (the site's
       own blink, rate-limited) and the sentence changes. Press again to go back. Reduced motion: every change is
       instant and there is no blink.
   Fallback
     No JS: the drawing, the labels, the meter reading 1.130426 and the sentence are all there; Shift, the meter
     button and the row buttons are simply not added or revealed (hidden in the HTML).
   ========================================================================== */
import { loadMeter, controllerFor } from './shift.js';

const reduced = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const VALUES = { b: '1.130426', a1: '0.571024', a2: '0.523299' };
const NAMES = { b: 'beta', a1: 'alpha', a2: 'alpha' };

export async function initPrimer({ shift = null } = {}) {
  const fig = document.querySelector('[data-lines]');
  const slot = document.querySelector('[data-meter-slot="primer"]');
  const probeBtn = document.querySelector('[data-probe]');
  const shiftBtn = document.querySelector('[data-shift-demo]');
  const swap = document.querySelector('[data-swap]');
  if (!fig) return null;

  let state = 'b';                 // which thread the spark is on
  let lit = null;                  // which thread is pointed at
  let running = null;              // the spark's travel, cancelled by the next press

  await loadMeter();
  const meter = slot ? controllerFor(slot) : null;
  const show = (value, { roll = true } = {}) => {
    if (!meter) { if (slot) slot.dataset.reading = value; return Promise.resolve(); }
    return Promise.resolve(meter.shiftTo(value, { roll: roll && !reduced() })).catch(() => {});
  };
  const label = (v) => probeBtn?.setAttribute('aria-label', `Re-read the meter, ${v}`);

  /* ---- the meter demo ---------------------------------------------------------------- */
  if (probeBtn && meter && typeof meter.reread === 'function') {
    probeBtn.hidden = false;
    document.querySelector('[data-probe-hint]')?.removeAttribute('hidden');
    probeBtn.addEventListener('click', () => (reduced() ? show(VALUES[state], { roll: false }) : meter.reread()));
  }

  /* ---- point at a thread ---------------------------------------------------------------- */
  const art = fig.querySelector('.lines__art');
  let leaveT = 0;
  const light = (name) => {
    clearTimeout(leaveT);
    if (name === lit) return;
    lit = name;
    if (name) fig.dataset.lit = name; else delete fig.dataset.lit;
    const v = VALUES[name || state];
    show(v);
    label(v);
  };
  for (const name of Object.keys(VALUES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `lines__hit lines__hit--${name}`;
    b.setAttribute('aria-label', `World line ${VALUES[name]}, ${NAMES[name]} field. Read it on the meter.`);
    b.addEventListener('pointerenter', () => light(name));
    b.addEventListener('focus', () => light(name));
    b.addEventListener('click', () => { light(name); show(VALUES[name]); });
    art?.append(b);
  }
  const leave = () => { leaveT = setTimeout(() => light(null), 90); };
  art?.addEventListener('pointerleave', leave);
  art?.addEventListener('focusout', (e) => { if (!art.contains(e.relatedTarget)) leave(); });

  /* ---- Shift: the D-mail, the thread, the meter and the sentence at once ------------------ */
  const svgs = [...fig.querySelectorAll('.lines__svg')];
  const pt = (s) => s.split(' ').map(Number);
  function travel(forward) {
    running?.cancel();
    let cancelled = false;
    const jobs = svgs.map((svg) => {
      const spark = svg.querySelector('.lines__spark');
      const arc = svg.querySelector('.lines__arc');
      const trail = svg.querySelector('.lines__trail--a');
      const from = pt(svg.dataset.spark), to = pt(svg.dataset.after);
      if (!spark || !arc || !trail) return null;
      const aLen = arc.getTotalLength(), tLen = trail.getTotalLength();
      const lead = Math.hypot(arc.getPointAtLength(0).x - from[0], arc.getPointAtLength(0).y - from[1]);
      const total = lead + aLen + tLen;
      // the spark's position at distance d along: its thread to the arc, the arc, then the alpha thread
      const at = (d) => {
        if (d <= lead) { const k = lead ? d / lead : 1, p0 = arc.getPointAtLength(0); return [from[0] + (p0.x - from[0]) * k, from[1] + (p0.y - from[1]) * k]; }
        if (d <= lead + aLen) { const p = arc.getPointAtLength(d - lead); return [p.x, p.y]; }
        const p = trail.getPointAtLength(Math.min(tLen, d - lead - aLen)); return [p.x, p.y];
      };
      return { spark, at, total, end: forward ? to : from };
    }).filter(Boolean);
    const put = (j, xy) => j.spark.setAttribute('transform', `translate(${xy[0].toFixed(1)} ${xy[1].toFixed(1)})`);
    if (reduced()) { jobs.forEach((j) => put(j, j.end)); return Promise.resolve(); }
    const dur = 760, t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    return new Promise((resolve) => {
      running = { cancel() { cancelled = true; jobs.forEach((j) => put(j, j.end)); resolve(); } };
      const frame = (now) => {
        if (cancelled) return;
        const t = Math.min(1, (now - t0) / dur), e = ease(t);
        jobs.forEach((j) => put(j, j.at((forward ? e : 1 - e) * j.total)));
        if (t < 1) requestAnimationFrame(frame); else { running = null; resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  if (shiftBtn && swap) {
    const lines = { b: swap.textContent.trim(), a: swap.dataset.alt };
    shiftBtn.hidden = false;
    shiftBtn.addEventListener('click', () => {
      const next = state === 'b' ? 'a1' : 'b';
      state = next;
      fig.dataset.state = next === 'a1' ? 'a' : 'b';
      shiftBtn.setAttribute('aria-pressed', String(next === 'a1'));
      travel(next === 'a1');
      if (!lit) { show(VALUES[next]); label(VALUES[next]); }
      // the sentence changes inside the blink, as the colour drains
      const change = () => { swap.textContent = next === 'a1' ? lines.a : lines.b; };
      if (reduced()) change();
      else { shift?.blink?.(); setTimeout(change, 150); }
    });
  }
  return { get state() { return state; } };
}
