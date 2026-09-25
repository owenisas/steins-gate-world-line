/**
 * loom.js: the world-line loom (DESIGN.md section 11). three.js 0.186.1, one WebGL context.
 * Last updated: 2026-09-25
 *
 * WHAT IT IS
 *   Suzuha's yarn (research/identity.md 3.7), built procedurally and played by the nine chapters of #journal.
 *   Time runs along the cord (+x, one unit ~ one day of summer 2010). Two strands are twisted into one two-ply
 *   cord: the alpha strand (12 muted red threads round a dark fill core) and the beta strand (12 slate blue).
 *   Each thread is a world line. The pale Steins Gate thread runs down the cord's axis, in the gap between the
 *   strands, belonging to neither. Three levels of twist make it read as yarn: the plies round each other
 *   (cord.pitch), the threads round their ply (psi, solved so every jump faces the lens) and the three plies of
 *   each thread (shader). Knots pinch a whole strand to one point where the lore converges it (beta Jul 28, alpha
 *   Aug 13 and Aug 15). A neon spark (Okabe's consciousness, the only neon in the scene) rides the threads and
 *   leaves an emissive trail on what it has covered; jumps between threads are arcs, time leaps are hoops.
 *   Story threads are ordered by divergence: 0.571xxx lies nearest the 1% gap, 0.337187 furthest from it. So
 *   Operation Urd hops away from the barrier, Operation Verthandi climbs back, and the choice leaps across it.
 *
 * USAGE (main.js does this once the reader scrolls into #journal, full motion and WebGL2 only)
 *   const { mountLoom } = await import('./loom.js');
 *   const loom = await mountLoom(document.getElementById('journal'), { beforeContext: releaseHeroGL });
 *   loom.live; loom.state(); loom.highlight('0.523299'); loom.seekTo('ch-05'); loom.chapter; loom.dispose();
 *
 * NAVIGATION (for the journal's navigator; these work without WebGL too: main.js exposes window.__journal)
 *   seekTo(target, { immediate })  target: 'ch-05' | '#ch-05' | 5 | '0.409431' (the marker where that line lands,
 *                                  centred where the meter shifts) | an element. Lenis when it runs, native else.
 *   scrollYFor(target)             the scroll y seekTo would use.
 *   watchChapters(root)            dispatches document 'loom:chapter' { id, index, previous } when the chapter under
 *                                  the viewport centre changes (and once on start).
 *   The scene is a pure function of scroll (BEATS below): a deep link or a seek lands on the right state, and a
 *   jump of more than 1.2 viewports snaps instead of replaying the beats in between. 'loom:jump' { id, size,
 *   value, reverse } and 'loom:knot' { mark } fire only for a single event crossed at reading speed: a seek, a
 *   fling or a frame that crosses several events fires nothing (no queued sounds or flashes). Beats re-measure on
 *   every ScrollTrigger refresh, and the loom calls ScrollTrigger.refresh() itself when #journal changes height
 *   (a <details> toggling, a layout variant, late fonts).
 *
 * SCROLL -> STORY
 *   One ScrollTrigger on #journal (gsap/ScrollTrigger from the import map, so it shares motion-core's Lenis sync;
 *   a passive scroll listener if GSAP is missing). BEATS below key the path parameter s (and the camera) to real
 *   DOM positions: "this element's top at this fraction of the viewport". Jumps land exactly when their
 *   [data-worldline] marker crosses the viewport centre, which is when shift.js rolls the meter and blinks, so
 *   scene, meter and live region stay in sync at any viewport size. Anchors are re-measured on every
 *   ScrollTrigger refresh (fonts, resize, load).
 *
 * RENDERING
 *   All threads are one instanced tube drawn in the vertex shader from the same math as threadPos() below
 *   (twist, pinch, relax, sway are uniforms: no geometry rebuilds). Yarn shader: three-ply stripe along the tube
 *   UVs, fine fibre noise, wrap lighting from a camera-relative key, a noisy fuzz rim, the spark's warm light, the
 *   emissive trail, and the grade (desaturated, lifted blacks). No bloom anywhere. The canvas is transparent and
 *   the yarn dissolves into it with distance, so the page's own ground (haze, the dusk fall, lab night, grain)
 *   is the loom's ground: canvas and CSS can never seam.
 *
 * BUDGET AND LIFECYCLE
 *   DPR <= 1.5. Render only while scroll, pointer or a highlight changes, plus an idle sway that fades out within
 *   5 s. Paused offscreen (IntersectionObserver) and in hidden tabs; disposed on pagehide and when motion is
 *   reduced live. The tube is drawn over a window of the cord that moves with the camera (snapped to whole
 *   segments). Desktop 147,854 triangles in 4 draw calls (27 instances x 320 segments x 8 sides); the lite tier
 *   (touch, or a stage under 768px) 84,878 (9 threads a ply, 224 segments).
 *   options.beforeContext() runs before the context is created (main.js disposes the hero's GL meter there),
 *   so the page never holds two live WebGL scenes.
 *
 * FALLBACKS
 *   No JS, reduced motion, no WebGL2 / software GL, Save-Data, CDN failure or any error: the static SVG map
 *   (assets/loom/loom-map.svg, drawn by tools/render_loom_svg.py from PARAMS) stays as the stage. The canvas and
 *   its labels are aria-hidden; every word is DOM.
 */

/* The loom's parameters. tools/render_loom_svg.py reads this JSON block (between the markers) for the static map,
   so both drawings come from one source. x is story time: 0 = Jul 28 2010, 24 = Aug 21. */
export const PARAMS = /*loom-params:begin*/{
  "range": [-24, 54],
  "window": [-20, 12],
  "cord": { "d": 0.45, "pitch": 7.4, "phase": 0.0 },
  "ply": { "pitch": 2.7, "tolerance": 68 },
  "strand": { "outer": 12, "ring": 0.262, "fill": 0.2, "thread": 0.054, "phi0": 15 },
  "sg": { "thread": 0.027 },
  "knots": [
    { "strand": 1, "x": 0.0, "w": 0.62, "date": "Jul 28" },
    { "strand": 0, "x": 15.0, "w": 0.66, "date": "Aug 13" },
    { "strand": 0, "x": 20.5, "w": 0.6, "date": "Aug 15" }
  ],
  "yarn": { "a": "#9E4A3F", "b": "#4F6E8F", "sg": "#E8E6DC" },
  "threads": { "T5": [0, 0], "T4": [0, 1], "T3": [0, 2], "T2": [0, 3], "T1": [0, 4], "T0": [0, 5], "U1": [1, 1], "U0": [1, 2], "SG": [2, 0] },
  "values": {
    "1.130426": "U0", "0.571024": "T0", "0.571015": "T1", "0.571046": "T1", "0.523299": "T2", "0.523307": "T2",
    "0.456903": "T3", "0.456914": "T3", "0.409420": "T4", "0.409431": "T4", "0.337187": "T5", "1.130205": "U1", "1.048596": "SG"
  },
  "path": [
    ["ride", "U0", -4.5, 0.0, { "mark": "hit0", "knot": 0, "chapter": 1 }],
    ["jump", "U0", "T0", 0.0, 0.9, { "id": "d1", "lift": 1.25, "bulge": 0.5, "label": "0.571024", "date": "Jul 28", "size": 3, "chapter": 1 }],
    ["ride", "T0", 0.9, 6.0, { "chapter": 2 }],
    ["jump", "T0", "T1", 6.0, 6.45, { "id": "urd1", "lift": 0.5, "bulge": 0.3, "label": "0.571015", "date": "Aug 3", "size": 1, "chapter": 3 }],
    ["ride", "T1", 6.45, 7.3, { "chapter": 3 }],
    ["jump", "T1", "T2", 7.3, 7.75, { "id": "urd2", "lift": 0.5, "bulge": 0.3, "label": "0.523299", "date": "Aug 4", "size": 1, "chapter": 3 }],
    ["ride", "T2", 7.75, 9.1, { "chapter": 3 }],
    ["jump", "T2", "T3", 9.1, 9.55, { "id": "urd3", "lift": 0.5, "bulge": 0.3, "label": "0.456903", "date": "Aug 6", "size": 1, "chapter": 3 }],
    ["ride", "T3", 9.55, 10.3, { "chapter": 3 }],
    ["jump", "T3", "T4", 10.3, 10.75, { "id": "urd4", "lift": 0.5, "bulge": 0.3, "label": "0.409420", "date": "Aug 7", "size": 1, "chapter": 3 }],
    ["ride", "T4", 10.75, 12.3, { "chapter": 3 }],
    ["jump", "T4", "T5", 12.3, 12.75, { "id": "urd5", "lift": 0.5, "bulge": 0.3, "label": "0.337187", "date": "Aug 10", "size": 1, "chapter": 3 }],
    ["ride", "T5", 12.75, 15.0, { "mark": "hit1", "knot": 1, "chapter": 4 }],
    ["leap", "T5", 15.0, 12.95, { "id": "loop1", "lift": 0.95, "chapter": 5 }],
    ["ride", "T5", 12.95, 15.0, { "mark": "hit2", "knot": 1, "chapter": 5 }],
    ["leap", "T5", 15.0, 13.65, { "id": "loop2", "lift": 0.74, "chapter": 5 }],
    ["ride", "T5", 13.65, 15.0, { "mark": "hit3", "knot": 1, "chapter": 5 }],
    ["leap", "T5", 15.0, 14.25, { "id": "loop3", "lift": 0.55, "chapter": 5 }],
    ["ride", "T5", 14.25, 15.0, { "mark": "hit4", "knot": 1, "chapter": 5 }],
    ["leap", "T5", 15.0, 14.5, { "id": "loop4", "lift": 0.42, "chapter": 5 }],
    ["jump", "T5", "T4", 14.5, 15.85, { "id": "undo0", "lift": 0.8, "bulge": 0.2, "label": "0.409431", "date": "Aug 14", "size": 2, "chapter": 5 }],
    ["ride", "T4", 15.85, 16.6, { "chapter": 6 }],
    ["jump", "T4", "T3", 16.6, 17.05, { "id": "vt1", "lift": 0.5, "bulge": 0.3, "label": "0.456914", "date": "Aug 14", "size": 1, "chapter": 6 }],
    ["ride", "T3", 17.05, 17.6, { "chapter": 6 }],
    ["jump", "T3", "T2", 17.6, 18.05, { "id": "vt2", "lift": 0.5, "bulge": 0.3, "label": "0.523307", "date": "Aug 15", "size": 1, "chapter": 6 }],
    ["ride", "T2", 18.05, 18.6, { "chapter": 6 }],
    ["jump", "T2", "T1", 18.6, 19.05, { "id": "vt3", "lift": 0.5, "bulge": 0.3, "label": "0.571046", "date": "Aug 15", "size": 1, "chapter": 6 }],
    ["ride", "T1", 19.05, 19.5, { "chapter": 7 }],
    ["jump", "T1", "U1", 19.5, 21.0, { "id": "choice", "lift": 1.7, "bulge": 0.6, "label": "1.130205", "date": "Aug 17", "size": 4, "chapter": 7 }],
    ["ride", "U1", 21.0, 24.0, { "mark": "aug21", "chapter": 8 }],
    ["ride", "U1", 24.0, 1.0, { "mark": "back", "chapter": 8 }],
    ["slip", "U1", "SG", 1.0, 0.5, { "id": "skuld", "lift": 0.3, "bulge": 0.0, "label": "1.048596", "date": "Jul 28", "size": 3, "chapter": 8 }],
    ["ride", "SG", 0.5, 28.5, { "mark": "sg", "chapter": 9 }]
  ],
  "see": [["U0", -0.8], ["U0", -2.2], ["U0", -3.6], ["T0", 2.2], ["T0", 3.6], ["T0", 5.0],
          ["T5", 13.4], ["T4", 16.3], ["T1", 19.25], ["U1", 23.2], ["U1", 12.0]],
  "dates": [[-4, "Jul 24"], [0, "Jul 28"], [6, "Aug 3"], [9.1, "Aug 6"], [12.3, "Aug 10"], [15, "Aug 13"], [17.6, "Aug 15"], [19.5, "Aug 17"], [24, "Aug 21"]]
}/*loom-params:end*/;

/* Scroll beats: s is the path position when the element's top sits at `at` x viewport height (0.5 = centre, the
   line shift.js uses). [thread, x] means "on that thread at that x" (first time after the previous beat).
   edge: 'bottom' | 'middle' measures from the element's bottom or middle instead of its top.
   v3 (DESIGN 12): chapters 4-9 sit behind the spoiler gate, and the prose sits in closed <details>. A beat whose
   element is not rendered (inside a closed <details>) is skipped, and `gate` picks the ending: with the gate shut
   the journal ends with the spark riding toward the Aug 13 knot, short of it (nothing past chapter 3 is played);
   open, the story runs to the Steins Gate thread. Every beat is keyed to something always visible: a chapter top,
   a TL;DR, a ledger row (the shift each chapter makes), the chapter 4 poster. */
const ROWS3 = ['0.571015', '0.523299', '0.456903', '0.409420', '0.337187'];
const ROWS6 = ['0.456914', '0.523307', '0.571046'];
const rowBeats = (ch, values, ids, cam) => values.flatMap((v, i) => [
  { el: `#${ch} .ledger__row[data-worldline="${v}"]`, at: 0.64, s: `${ids[i]}:a`, cam },
  { el: `#${ch} .ledger__row[data-worldline="${v}"]`, at: 0.5, s: `${ids[i]}:b`, cam },
]);
const BEATS = [
  { el: '#journal', at: 1.0, s: ['U0', -4.4], cam: 'far' },
  { el: '#journal', at: 0.0, s: ['U0', -3.1], cam: 'far' },
  { el: '#ch-01', at: 0.5, s: ['U0', -1.7], cam: 'ride' },
  { el: '#ch-01 [data-worldline="0.571024"]', at: 0.74, s: 'hit0', cam: 'leap' },
  { el: '#ch-01 [data-worldline="0.571024"]', at: 0.5, s: 'd1:b', cam: 'leap' },
  { el: '#ch-02', at: 0.5, s: ['T0', 2.1], cam: 'ride' },
  { el: '#ch-03', at: 0.5, s: ['T0', 4.9], cam: 'close' },
  ...rowBeats('ch-03', ROWS3, ['urd1', 'urd2', 'urd3', 'urd4', 'urd5'], 'close'),
  { el: '.fall--dusk', at: 0.5, s: ['T5', 13.4], cam: 'ride' },
  // the gate shut: the journal ends here, the spark still short of the knot
  { el: '#journal', edge: 'bottom', at: 1.0, s: ['T5', 13.95], cam: 'ride', gate: 'closed' },
  // the gate open: the hinge, the loops, the undoing, the choice, the flight back, the Steins Gate line
  { el: '#ch-04', at: 0.5, s: ['T5', 14.2], cam: 'hinge' },
  { el: '#ch-04 .poster', edge: 'middle', at: 0.42, s: 'hit1', cam: 'hinge' },
  { el: '#ch-05', at: 0.85, s: 'hit1', cam: 'loop' },
  { el: '#ch-05', at: 0.5, s: 'loop1:a', cam: 'loop' },
  { el: '#ch-05 .chapter__tldr', at: 0.5, s: 'hit4', cam: 'loop' },
  { el: '#ch-05 [data-worldline="0.409431"]', at: 0.7, s: 'undo0:a', cam: 'loop' },
  { el: '#ch-05 [data-worldline="0.409431"]', at: 0.5, s: 'undo0:b', cam: 'close' },
  { el: '#ch-06', at: 0.5, s: ['T4', 16.3], cam: 'close' },
  ...rowBeats('ch-06', ROWS6, ['vt1', 'vt2', 'vt3'], 'close'),
  { el: '#ch-07', at: 0.5, s: ['T1', 19.25], cam: 'split' },
  { el: '#ch-07 .choice', edge: 'middle', at: 0.5, s: ['T1', 19.45], cam: 'split' },
  { el: '#ch-07 [data-worldline="1.130205"]', at: 0.76, s: 'choice:a', cam: 'leap' },
  { el: '#ch-07 [data-worldline="1.130205"]', at: 0.5, s: 'choice:b', cam: 'leap' },
  { el: '#ch-08', at: 0.5, s: 'aug21', cam: 'flight' },
  { el: '#ch-08 [data-worldline="1.048596"]', at: 0.78, s: 'skuld:a', cam: 'flight' },
  { el: '#ch-08 [data-worldline="1.048596"]', at: 0.5, s: 'skuld:b', cam: 'ride' },
  { el: '#ch-09', at: 0.5, s: ['SG', 2.4], cam: 'quiet' },
  { el: '#journal', edge: 'bottom', at: 1.0, s: ['SG', 25.0], cam: 'quiet', gate: 'open' },
];
/* Camera presets: distance, yaw along the cord (deg; + puts the future nearer, on the right), elevation (deg),
   and where the spark sits on screen (fx, fy: offset from the centre as a fraction of the canvas). */
const CAMS = {
  far:    { dist: 13.0, yaw: 21, elev: 9,  fx: 0.16, fy: 0.03 },
  ride:   { dist: 10.6, yaw: 24, elev: 10, fx: 0.17, fy: 0.0 },
  close:  { dist: 8.3,  yaw: 21, elev: 9,  fx: 0.16, fy: 0.0 },
  loop:   { dist: 8.8,  yaw: 15, elev: 7,  fx: 0.15, fy: 0.06 },
  leap:   { dist: 10.2, yaw: 19, elev: 8,  fx: 0.16, fy: 0.02 },
  flight: { dist: 11.6, yaw: 30, elev: 12, fx: 0.14, fy: 0.0 },
  final:  { dist: 14.5, yaw: 38, elev: 13, fx: 0.11, fy: 0.02 },
  // v3 set pieces (DESIGN 12.7): the knot centred under the chapter 4 poster; the two strands side on, apart, for the
  // choice; the Steins Gate thread low and centred under chapter 9's quiet line
  hinge:  { dist: 9.4,  yaw: 12, elev: 6,  fx: 0.0,  fy: -0.2 },
  split:  { dist: 9.6,  yaw: 9,  elev: 2,  fx: 0.2,  fy: 0.0 },
  quiet:  { dist: 13.5, yaw: 30, elev: 11, fx: 0.0,  fy: -0.26 },
};

const DEFAULTS = {
  maxDpr: 1.5,
  fov: 30,
  parallax: 2,
  idleMs: 5000,
  fadeMs: 700,
  trail: 5.5,
  failIfMajorPerformanceCaveat: true,
  beforeContext: null,
  loadThree: () => import('three'),
  loadScrollTrigger: async () => {
    const [g, s] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    const gsap = g.gsap ?? g.default;
    const ST = s.ScrollTrigger ?? s.default;
    gsap.registerPlugin(ST);
    return ST;
  },
  onError: (err) => console.warn('[loom] kept the static map:', err),
};

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const reducedMotion = () =>
  document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================================================
   Loom math. The vertex shader (YARN_COMMON below) is a line-for-line copy of these functions: change both.
   ================================================================================================ */
export function twist(x, relax = 0) {
  const c = PARAMS.cord;
  return c.phase + TAU * x / c.pitch * (1 - 0.38 * relax);
}
export function pinch(x, strand, relax = 0) {
  let p = 0;
  for (const k of PARAMS.knots) {
    if (k.strand !== strand) continue;
    const z = (x - k.x) / k.w;
    p = Math.max(p, Math.exp(-z * z));
  }
  return p * 0.93 * (1 - relax);
}
/* The within-ply twist psi(x), per strand. Each ply's threads also turn round the ply's own centre, tighter than
   the plies turn round each other: that second twist is what makes the cord read as plied yarn, not ribbons. It is
   solved once (solvePsi) so that at every jump, landing and loop the spark's thread faces the lens (within
   ply.tolerance degrees), while between events it keeps close to the nominal ply.pitch and never unwinds. The
   table is shared with the vertex shader as a float texture, so JS and GLSL read identical values. */
export const PSI = { n: 2048, x0: 0, dx: 1, table: null };
export function psi(x, strand) {
  if (!PSI.table || strand > 1) return 0;
  const f = clamp((x - PSI.x0) / PSI.dx, 0, PSI.n - 1.001), i = Math.floor(f), t = f - i, o = strand * PSI.n;
  return mix(PSI.table[o + i], PSI.table[o + i + 1], t);
}
export function solvePsi(table) {
  const [X0, X1] = PARAMS.range;
  PSI.x0 = X0; PSI.dx = (X1 - X0) / (PSI.n - 1);
  PSI.table = new Float32Array(PSI.n * 2);
  const rate = TAU / PARAMS.ply.pitch, tol = PARAMS.ply.tolerance * DEG;
  // events: [x, thread] where the spark must be seen (arc ends off the knots, plus PARAMS.see)
  const events = [[], []];
  const add = (name, x) => {
    const th = storyThread(table, name);
    if (!th || th.strand > 1 || pinch(x, th.strand) > 0.45) return;
    events[th.strand].push({ x, phi: th.phi });
  };
  for (const step of PARAMS.path) {
    if (step[0] === 'jump' || step[0] === 'slip') { add(step[1], step[3]); add(step[2], step[4]); }
    if (step[0] === 'leap') { add(step[1], step[2]); add(step[1], step[3]); }
  }
  for (const [name, x] of PARAMS.see || []) add(name, x);
  for (const strand of [0, 1]) {
    const ev = events[strand].sort((a, b) => a.x - b.x);
    // Dynamic programme over the events: each event picks psi = target + k turns + delta (|delta| <= tol), and the
    // chain minimises the squared deviation of the local twist rate from the nominal one, prices tightening
    // above 1.4x nominal steeply and forbids anything past 2x (no coils); a small local untwist (the undo hops
    // step back toward the gap) is allowed.
    const OFF = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((f) => f * tol);
    const cands = ev.map((e) => {
      const target = Math.PI / 2 - e.phi, k0 = Math.round((rate * (e.x - X0) - target) / TAU);
      const list = [];
      for (let k = k0 - 1; k <= k0 + 1; k++) for (const o of OFF) list.push(target + TAU * k + o);
      return list;
    });
    const cost = (va, vb, dx) => {
      const dv = vb - va, dev = dv - rate * dx, w = Math.max(dx, 0.05);
      if (dv / w > rate * 2.0) return 1e6 + dv;                    // never coil tighter than 2x nominal
      const over = Math.max(0, dv - rate * 1.4 * dx);              // a looser stretch reads as hand-spun; a tight
      return (dev * dev) / w + 12 * (over * over) / w              // one reads as a coil, so tightening costs more
        + (dv < 0 ? 6 * dv * dv / w : 0);                          // a small local untwist is cheap and unseen
    };
    const best = [], from = [];
    ev.forEach((e, i) => {
      best.push(cands[i].map(() => Infinity)); from.push(cands[i].map(() => -1));
      cands[i].forEach((v, j) => {
        if (i === 0) { best[0][j] = cost(0, v, e.x - X0); return; }
        const dx = e.x - ev[i - 1].x;
        cands[i - 1].forEach((u, q) => {
          const c = best[i - 1][q] + cost(u, v, dx);
          if (c < best[i][j]) { best[i][j] = c; from[i][j] = q; }
        });
      });
    });
    const chosen = new Array(ev.length);
    if (ev.length) {
      let j = best[ev.length - 1].indexOf(Math.min(...best[ev.length - 1]));
      for (let i = ev.length - 1; i >= 0; i--) { chosen[i] = cands[i][j]; j = from[i][j]; }
    }
    // Before the first and after the last event the twist runs at exactly the nominal rate (points every unit, so
    // the spline cannot ease in from a flat tangent).
    const firstX = ev.length ? ev[0].x : X0, firstV = ev.length ? chosen[0] : 0;
    const pts = [];
    for (let x = X0; x < firstX - 0.5; x += 1) pts.push([x, firstV - rate * (firstX - x)]);
    ev.forEach((e, i) => {
      if (!pts.length || e.x - pts[pts.length - 1][0] > 1e-3) pts.push([e.x, chosen[i]]);
      else pts[pts.length - 1][1] = chosen[i];
    });
    const lastX = ev.length ? ev[ev.length - 1].x : X0, lastV = ev.length ? chosen[ev.length - 1] : 0;
    for (let x = lastX + 1; x <= X1 + 1e-6; x += 1) pts.push([x, lastV + rate * (x - lastX)]);
    if (pts[pts.length - 1][0] < X1) pts.push([X1, lastV + rate * (X1 - lastX)]);
    // Linear through the chosen points, then a Gaussian smoothing (sigma ~0.35 units) so every change of rate is
    // spread evenly along the yarn instead of bunching into one short stretch.
    const row = new Float32Array(PSI.n);
    let seg = 0;
    for (let j = 0; j < PSI.n; j++) {
      const x = X0 + j * PSI.dx;
      while (seg < pts.length - 2 && x > pts[seg + 1][0]) seg++;
      const [xa, ya] = pts[seg], [xb, yb] = pts[seg + 1];
      row[j] = ya + (yb - ya) * clamp((x - xa) / Math.max(1e-6, xb - xa), 0, 1);
    }
    const sigma = 0.35 / PSI.dx, R = Math.ceil(sigma * 3), wts = [];
    for (let k = -R; k <= R; k++) wts.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
    for (let j = 0; j < PSI.n; j++) {
      let acc = 0, ws = 0;
      for (let k = -R; k <= R; k++) {
        const i = j + k;
        // beyond the ends, extend at the nominal rate so the smoothing does not bend the tails
        const v = i < 0 ? row[0] + rate * i * PSI.dx : i >= PSI.n ? row[PSI.n - 1] + rate * (i - PSI.n + 1) * PSI.dx : row[i];
        acc += v * wts[k + R]; ws += wts[k + R];
      }
      PSI.table[strand * PSI.n + j] = acc / ws;
    }
  }
  return PSI;
}

/** Centre of a thread at story time x. th = { strand, phi (rad), ring, seed }. sway = { t, amp }. */
export function threadPos(x, th, relax = 0, sway = null, out = [0, 0, 0]) {
  let sy = 0, sz = 0;
  if (sway && sway.amp) {
    sy = sway.amp * 0.028 * Math.sin(sway.t * 0.83 + x * 0.41 + th.seed);
    sz = sway.amp * 0.022 * Math.sin(sway.t * 0.61 + x * 0.29 + th.seed * 1.7);
  }
  if (th.strand === 2) {
    out[0] = x; out[1] = 0.016 * Math.sin(0.61 * x + 1.3) + sy; out[2] = 0.016 * Math.cos(0.47 * x) + sz;
    return out;
  }
  const t = twist(x, relax);
  const sa = t + th.strand * Math.PI;
  const d = PARAMS.cord.d * (1 + 0.75 * relax);
  const r = th.ring * (1 - pinch(x, th.strand, relax)) * (1 + 0.3 * relax) * (1 + 0.05 * Math.sin(1.7 * x + th.seed * 6.1));
  const ta = t + psi(x, th.strand) * (1 - 0.5 * relax) + th.phi + 0.05 * Math.sin(0.9 * x + th.seed * 4.3);
  out[0] = x;
  out[1] = d * Math.cos(sa) + r * Math.cos(ta) + sy;
  out[2] = d * Math.sin(sa) + r * Math.sin(ta) + sz;
  return out;
}

/** The thread table: instance order is alpha ring, alpha core, beta ring, beta core, Steins Gate. */
export function threadTable({ outer = PARAMS.strand.outer } = {}) {   // outer: ring threads per ply (fewer on touch)
  const S = PARAMS.strand;
  const list = [];
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  for (const strand of [0, 1]) {
    const ringR = S.ring * Math.sqrt(outer / S.outer);            // fewer threads sit on a tighter ring
    const rad = S.thread * Math.sqrt(S.outer / outer) * 0.92;
    for (let k = 0; k < outer; k++) {
      list.push({ strand, ring: ringR, phi: (S.phi0 + k * 360 / outer) * DEG, seed: hash(strand * 50 + k) * 6.28, radius: outer === S.outer ? S.thread : rad, k, core: false });
    }
    // The ply's dark interior: one fat tube on the ply's centre line, pinched with it, so the gaps between threads
    // read as depth and never as holes. It is not a world line (no index in PARAMS.threads).
    list.push({ strand, ring: 0, phi: 0, seed: hash(strand * 50 + 20) * 6.28, radius: S.fill, k: -1, core: true, fill: true });
  }
  list.push({ strand: 2, ring: 0, phi: 0, seed: 1.7, radius: PARAMS.sg.thread, k: 0, core: false });
  list.forEach((t, i) => { t.index = i; });
  return list;
}
export function storyThread(table, name) {
  const [strand, k] = PARAMS.threads[name];
  return table.find((t) => t.strand === strand && t.k === k && !t.core) || null;
}

/* ---- the spark's path: rides along threads and arcs between them ---------------------------------------- */
function cubic(p0, p1, p2, p3, t, out) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  for (let i = 0; i < 3; i++) out[i] = a * p0[i] + b * p1[i] + c * p2[i] + d * p3[i];
  return out;
}
function outward(th, x) {
  // Unit vector from the thread's strand centre (or the axis) to the thread: the arc lifts along it.
  if (th.strand === 2) return null;
  const t = twist(x) + psi(x, th.strand) + th.phi;
  return [0, Math.cos(t), Math.sin(t)];
}
export function buildPath(table) {
  const segs = [];
  const marks = {};
  const arcs = [];
  let s = 0;
  const tp = (name) => storyThread(table, name);
  for (const step of PARAMS.path) {
    const [type] = step;
    if (type === 'ride') {
      const [, name, x0, x1, opt = {}] = step;
      const len = Math.abs(x1 - x0);
      segs.push({ type, thread: tp(name), name, x0, x1, s0: s, s1: s + len, opt });
      s += len;
      if (opt.mark) marks[opt.mark] = s;
      continue;
    }
    const leap = type === 'leap';
    const [, a, b, xa, xb, opt] = leap ? [step[0], step[1], step[1], step[2], step[3], step[4]] : step;
    const A = tp(a), B = tp(b);
    const p0 = threadPos(xa, A), p3 = threadPos(xb, B);
    const pinchA = A.strand < 2 ? pinch(xa, A.strand) : 1;
    const pinchB = B.strand < 2 ? pinch(xb, B.strand) : 1;
    const side = (x) => { const t = twist(x) + Math.PI / 2; return [0, Math.cos(t), Math.sin(t)]; };
    // Jumps always lift toward the lens (blended with the thread's own outward direction), so an arc reads even
    // when its end threads sit round the side of their ply.
    const lens = (th, x, pinched) => {
      const sd = side(x), o = pinched ? sd : outward(th, x) || sd;
      const v = [0, 0.8 * sd[1] + 0.55 * o[1], 0.8 * sd[2] + 0.55 * o[2]], l = Math.hypot(v[1], v[2]) || 1;
      return [0, v[1] / l, v[2] / l];
    };
    const nA = lens(A, xa, pinchA > 0.5), nB = lens(B, xb, pinchB > 0.5);
    const lift = opt.lift ?? 0.4;
    let p1, p2;
    if (leap) {
      // A time leap: a hoop that rises off the cord (away from its axis, a little toward the lens) and comes
      // down earlier on the same thread.
      const up = (x) => { const t = twist(x) + A.strand * Math.PI, sd = side(x); const v = [0, 0.85 * Math.cos(t) + 0.4 * sd[1], 0.85 * Math.sin(t) + 0.4 * sd[2]]; const l = Math.hypot(v[1], v[2]); return [0, v[1] / l, v[2] / l]; };
      const ua = up(xa), ub = up(xb);
      p1 = [p0[0] + 0.3, p0[1] + ua[1] * lift * 1.4, p0[2] + ua[2] * lift * 1.4];
      p2 = [p3[0] - 0.3, p3[1] + ub[1] * lift * 1.4, p3[2] + ub[2] * lift * 1.4];
    } else if ((opt.size || 1) >= 3) {
      // The two jumps across the gap (the first D-mail, the choice): the arc first rises off its ply away from
      // the cord (above alpha, below beta), then sweeps across the front of the cord to land, so on screen it
      // spans the cord's whole height: the longest arcs in the story.
      const t0 = twist(xa) + A.strand * Math.PI, sa = side(xa), sb = side(xb);
      const bx = (opt.bulge ?? 0.5), dx = xb - xa;
      p1 = [p0[0] + dx * 0.25 + bx, p0[1] + (Math.cos(t0) * 1.1 + sa[1] * 0.55) * lift, p0[2] + (Math.sin(t0) * 1.1 + sa[2] * 0.55) * lift];
      p2 = [p3[0] - dx * 0.2 + bx * 0.5, p3[1] + sb[1] * lift * 1.05, p3[2] + sb[2] * lift * 1.05];
    } else {
      const bx = (opt.bulge ?? 0.2);
      const dx = xb - xa;
      p1 = [p0[0] + dx * 0.3 + bx, p0[1] + nA[1] * lift, p0[2] + nA[2] * lift];
      p2 = [p3[0] - dx * 0.3 + bx, p3[1] + nB[1] * lift, p3[2] + nB[2] * lift];
    }
    // arc-length table for uniform speed
    const N = 64, pts = [], acc = [0];
    for (let i = 0; i <= N; i++) pts.push(cubic(p0, p1, p2, p3, i / N, [0, 0, 0]));
    for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    const len = acc[N];
    const arc = { type: 'arc', kind: type, a, b, A, B, xa, xb, p: [p0, p1, p2, p3], pts, acc, len, s0: s, s1: s + len, opt };
    segs.push(arc);
    arcs.push(arc);
    if (opt.id) { marks[opt.id + ':a'] = s; marks[opt.id + ':b'] = s + len; }
    s += len;
  }
  return { segs, marks, arcs, length: s };
}
function arcPoint(arc, u, out) {
  // u in [0,1] of arc length -> point
  const L = u * arc.len, acc = arc.acc, N = acc.length - 1;
  let i = 1;
  while (i < N && acc[i] < L) i++;
  const f = (L - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
  const a = arc.pts[i - 1], b = arc.pts[i];
  out[0] = mix(a[0], b[0], f); out[1] = mix(a[1], b[1], f); out[2] = mix(a[2], b[2], f);
  return out;
}
/** The spark at path position s: { pos, x, seg }. */
export function sparkAt(path, s, relax = 0, sway = null, out = { pos: [0, 0, 0], x: 0, seg: null }) {
  s = clamp(s, 0, path.length);
  let seg = path.segs[path.segs.length - 1];
  for (const g of path.segs) { if (s <= g.s1) { seg = g; break; } }
  const f = (s - seg.s0) / Math.max(1e-6, seg.s1 - seg.s0);
  out.seg = seg;
  if (seg.type === 'ride') {
    out.x = mix(seg.x0, seg.x1, f);
    threadPos(out.x, seg.thread, relax, sway, out.pos);
  } else {
    arcPoint(seg, f, out.pos);
    out.x = out.pos[0];
  }
  return out;
}
/** First s >= after where the spark rides `name` at x. */
function sOn(path, name, x, after) {
  for (const g of path.segs) {
    if (g.type !== 'ride' || g.name !== name || g.s1 < after) continue;
    const lo = Math.min(g.x0, g.x1), hi = Math.max(g.x0, g.x1);
    if (x < lo - 1e-6 || x > hi + 1e-6) continue;
    const s = g.s0 + Math.abs(x - g.x0);
    if (s >= after - 1e-6) return s;
  }
  return after;
}

/* ================================================================================================
   Shaders
   ================================================================================================ */
const YARN_COMMON = /* glsl */`
  uniform float uPhase, uPitch, uD, uRelax, uSwayT, uSwayAmp;
  uniform vec3 uKnots[4];
  uniform int uKnotN;
  uniform highp sampler2D uPsi;
  uniform vec2 uPsiX;      // x0, dx
  float psi(float x, float strand) {
    if (strand > 1.5) return 0.0;
    float f = clamp((x - uPsiX.x) / uPsiX.y, 0.0, float(${PSI.n - 2}));
    int i = int(floor(f));
    float t = f - float(i);
    int row = int(strand + 0.5);
    return mix(texelFetch(uPsi, ivec2(i, row), 0).r, texelFetch(uPsi, ivec2(i + 1, row), 0).r, t);
  }
  float twist(float x) { return uPhase + 6.28318530718 * x / uPitch * (1.0 - 0.38 * uRelax); }
  float pinch(float x, float strand) {
    float p = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i >= uKnotN) break;
      vec3 k = uKnots[i];
      if (abs(k.z - strand) > 0.5) continue;
      float z = (x - k.x) / k.y;
      p = max(p, exp(-z * z));
    }
    return p * 0.93 * (1.0 - uRelax);
  }
  vec3 threadPos(float x, float strand, float phi, float ring, float seed) {
    vec3 sw = uSwayAmp * vec3(0.0, 0.028 * sin(uSwayT * 0.83 + x * 0.41 + seed), 0.022 * sin(uSwayT * 0.61 + x * 0.29 + seed * 1.7));
    if (strand > 1.5) return vec3(x, 0.016 * sin(0.61 * x + 1.3), 0.016 * cos(0.47 * x)) + sw;
    float th = twist(x);
    float sa = th + strand * 3.14159265359;
    float d = uD * (1.0 + 0.75 * uRelax);
    float r = ring * (1.0 - pinch(x, strand)) * (1.0 + 0.3 * uRelax) * (1.0 + 0.05 * sin(1.7 * x + seed * 6.1));
    float ta = th + psi(x, strand) * (1.0 - 0.5 * uRelax) + phi + 0.05 * sin(0.9 * x + seed * 4.3);
    return vec3(x, d * cos(sa) + r * cos(ta), d * sin(sa) + r * sin(ta)) + sw;
  }
`;

const YARN_VERT = /* glsl */`
  ${YARN_COMMON}
  attribute vec4 aThread;   // strand, phi, ring, seed
  attribute vec3 aThread2;  // radius, index, fill (1 = the ply's dark interior)
  attribute vec3 aColor;
  uniform vec2 uRange;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vX;
  varying float vV;
  varying float vIdx;
  varying float vStrand;
  varying float vSeed;
  varying vec3 vCol;
  varying float vAO;
  varying vec3 vT;
  void main() {
    float strand = aThread.x, phi = aThread.y, ring = aThread.z, seed = aThread.w;
    float x = mix(uRange.x, uRange.y, position.x);
    vec3 c = threadPos(x, strand, phi, ring, seed);
    vec3 T = normalize(threadPos(x + 0.03, strand, phi, ring, seed) - threadPos(x - 0.03, strand, phi, ring, seed));
    float th = twist(x) + psi(x, strand) * (1.0 - 0.5 * uRelax) + phi;
    vec3 R = strand > 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, cos(th), sin(th));
    // occlusion: the side of a thread that faces into its ply, and the side of a ply that faces the other ply
    float sa = twist(x) + strand * 3.14159265359;
    vec3 P = strand > 1.5 ? vec3(0.0) : vec3(0.0, cos(sa), sin(sa));
    vec3 N = normalize(R - T * dot(R, T));
    vec3 B = cross(T, N);
    float a = position.y * 6.28318530718;
    vec3 n = cos(a) * N + sin(a) * B;
    float fillK = aThread2.z;
    float rad = aThread2.x * (1.0 + 0.07 * sin(x * 2.3 + seed * 9.1) + 0.04 * sin(x * 7.7 + seed * 3.3));
    if (fillK > 0.5) rad = aThread2.x * (1.0 - pinch(x, strand)) * (1.0 + 0.3 * uRelax) + 0.012;
    vec3 p = c + n * rad;
    float inPly = fillK > 0.5 ? 0.25 : smoothstep(-0.8, 0.55, dot(n, R));
    float inCord = smoothstep(-0.95, 0.2, dot(n, P));
    vAO = mix(0.42, 1.0, inPly * inPly * (3.0 - 2.0 * inPly)) * mix(0.7, 1.0, inCord);
    if (strand > 1.5) vAO = 0.86 + 0.14 * max(dot(n, R), 0.0);
    vT = T;
    vWorld = p; vN = n; vX = x; vV = position.y; vIdx = aThread2.y; vStrand = strand; vSeed = seed; vCol = aColor;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const FRAG_COMMON = /* glsl */`
  uniform vec4 uFall;      // dawn top, dawn bottom, dusk top, dusk bottom, in canvas CSS px from the top
  uniform vec3 uCanvas;    // css width, css height, dpr
  uniform float uFogNear, uFogFar;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float nightHere() {
    float y = uCanvas.y - gl_FragCoord.y / uCanvas.z;
    if (y < uFall.x) return 1.0;
    if (y < uFall.y) return 1.0 - smoothstep(uFall.x, uFall.y, y);
    if (y < uFall.z) return 0.0;
    if (y < uFall.w) return smoothstep(uFall.z, uFall.w, y);
    return 1.0;
  }
  float fogAlpha(vec3 w) { return 1.0 - smoothstep(uFogNear, uFogFar, distance(cameraPosition, w)); }
`;

const YARN_FRAG = /* glsl */`
  ${FRAG_COMMON}
  #define MAX_SEG 32
  uniform vec3 uKey;
  uniform vec3 uFill;
  uniform vec3 uSparkPos;
  uniform float uSparkI;
  uniform vec4 uSeg[MAX_SEG];
  uniform int uSegN;
  uniform float uSparkS;
  uniform float uTrail;
  uniform float uHi, uHiAmt;
  uniform float uFlash, uFlashIdx, uFlashX;
  uniform vec3 uSG;        // lit amount, back edge x, front edge x
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vX;
  varying float vV;
  varying float vIdx;
  varying float vStrand;
  varying float vSeed;
  varying vec3 vCol;
  varying float vAO;
  varying vec3 vT;

  float trail() {
    float g = 0.0;
    for (int i = 0; i < MAX_SEG; i++) {
      if (i >= uSegN) break;
      vec4 sg = uSeg[i];
      if (abs(sg.x - vIdx) > 0.5) continue;
      float lo = min(sg.y, sg.z), hi = max(sg.y, sg.z);
      if (vX < lo - 0.03 || vX > hi + 0.03) continue;
      float d = uSparkS - (sg.w + abs(clamp(vX, lo, hi) - sg.y));
      if (d < -0.02) continue;
      float dd = max(d, 0.0);
      g = max(g, (exp(-dd / uTrail) * 0.62 + exp(-dd / 0.55) * 0.55) * smoothstep(-0.02, 0.06, d));
    }
    return g;
  }

  void main() {
    float night = nightHere();
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 T = normalize(vT);
    bool sg = vStrand > 1.5;

    // three plies twisted along each thread (two on the thinner Steins Gate thread), fine fibres, slubs
    float plies = sg ? 2.0 : 3.0;
    float ph = vV * plies - vX / 0.21;
    float ply = abs(sin(3.14159265 * ph));
    float crown = pow(ply, 0.7);
    // fibres run along the plies: noise that changes fast across a ply and slowly along it
    float fib = vnoise(vec2(ph * 7.0 + vSeed * 3.0, vX * 2.2 + vSeed));
    float aa2 = 1.0 - smoothstep(0.35, 0.9, fwidth(ph * 23.0));
    float fib2 = mix(0.5, vnoise(vec2(ph * 23.0 + vSeed * 5.0, vX * 5.0)), aa2);
    // the finest fibres fade out where they would fall below a pixel (no shimmer at a distance)
    float aa3 = 1.0 - smoothstep(0.35, 0.9, fwidth(ph * 71.0));
    float fib3 = mix(0.5, vnoise(vec2(ph * 71.0 + vSeed * 2.0, vX * 16.0 + vV * 9.0)), aa3);
    float groove = mix(0.64, 1.0, crown) * (0.88 + 0.16 * fib) * (0.93 + 0.1 * fib2) * (0.9 + 0.16 * fib3);
    if (sg) groove = mix(0.9, 1.0, crown) * (0.96 + 0.06 * fib2);

    // soft wrap lighting from a camera-relative key, a dim fill, the ground's own light, and occlusion
    float wrap = 0.55;
    float dif = clamp((dot(N, uKey) + wrap) / (1.0 + wrap), 0.0, 1.0);
    float fill = clamp(dot(N, uFill) * 0.5 + 0.5, 0.0, 1.0);
    vec3 amb = mix(vec3(0.98, 0.99, 0.95), vec3(0.44, 0.45, 0.43), night);
    vec3 key = mix(vec3(0.62, 0.6, 0.55), vec3(0.5, 0.48, 0.44), night);
    vec3 base = vCol;
    if (sg) base *= mix(1.0, 0.52, night);
    vec3 col = base * (amb * (0.7 + 0.3 * fill) + key * dif) * groove * vAO;
    // fibre sheen: an anisotropic highlight that runs along the thread (Kajiya-Kay), broken by the plies
    vec3 H = normalize(uKey + V);
    float th = dot(T, H);
    float sheen = pow(sqrt(max(0.0, 1.0 - th * th)), 9.0) * crown * vAO * (0.7 + 0.3 * fib3);
    col += vec3(0.95, 0.93, 0.88) * sheen * mix(0.1, 0.07, night);

    // fuzz: loose fibres catching light at the silhouette
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float rim = pow(1.0 - ndv, 2.4) * vAO;
    vec3 fuzz = mix(base * 1.35 + 0.05, vec3(0.86, 0.85, 0.8), 0.18);
    col = mix(col, fuzz, rim * (0.2 + 0.5 * fib3) * mix(0.6, 0.95, night));

    // a row hovered: its thread steps up, every other thread steps down
    float isHi = 1.0 - step(0.5, abs(vIdx - uHi));
    col *= mix(1.0, mix(0.8, 1.3, isHi), uHiAmt);

    // the grade: desaturate, grey-green mids, lifted blacks
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 0.78);
    col *= vec3(0.99, 1.0, 0.965);
    col = col * 0.93 + vec3(0.086, 0.094, 0.071) * 0.07;

    // light that bypasses the grade: the spark's glow on nearby yarn, its trail, a knot flash, the lit SG thread
    vec3 dl = uSparkPos - vWorld;
    float d2 = dot(dl, dl);
    float lam = clamp(dot(N, dl * inversesqrt(max(d2, 1e-5))) * 0.6 + 0.4, 0.0, 1.0);
    col += vec3(1.0, 0.44, 0.1) * uSparkI * lam * (0.03 / (d2 + 0.03)) * mix(0.5, 1.0, night);
    // light inside the rope: when the spark is behind a few fibres, the yarn around it glows from within
    col += vec3(1.0, 0.42, 0.08) * uSparkI * exp(-d2 / 0.022) * mix(0.55, 0.8, night);
    col += vec3(1.0, 0.4, 0.05) * trail() * mix(0.42, 0.55, night) * (0.55 + 0.45 * crown) * (0.4 + 0.6 * ndv);
    float isF = 1.0 - step(0.5, abs(vIdx - uFlashIdx));
    float fl = uFlash * exp(-abs(vX - uFlashX) / 1.3) * mix(0.25, 1.0, isF);
    col = mix(col, vec3(1.0, 0.95, 0.86), clamp(fl, 0.0, 0.8));
    if (sg) {
      float lit = uSG.x * smoothstep(uSG.y - 0.4, uSG.y + 0.4, vX) * (1.0 - smoothstep(uSG.z - 0.4, uSG.z + 0.4, vX));
      col = mix(col, vec3(1.0, 0.975, 0.92) * (0.9 + 0.1 * crown), lit * 0.9);
    }

    float a = fogAlpha(vWorld);
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col * a, a);
  }
`;

const ARC_VERT = /* glsl */`
  attribute float aS;
  varying float vS;
  varying vec3 vWorld;
  varying vec3 vN;
  void main() {
    vS = aS; vWorld = position; vN = normal;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;
const ARC_FRAG = /* glsl */`
  ${FRAG_COMMON}
  uniform float uSparkS;
  uniform float uTrail;
  uniform float uFade;
  varying float vS;
  varying vec3 vWorld;
  varying vec3 vN;
  void main() {
    float g = uSparkS - vS;
    if (g < 0.0) discard;
    float night = nightHere();
    float hot = exp(-g / 0.45);
    float glow = (exp(-g / (uTrail * 0.8)) * 0.55 + hot * 0.9) * uFade;
    vec3 V = normalize(cameraPosition - vWorld);
    float edge = pow(abs(dot(normalize(vN), V)), 0.6);
    vec3 col = mix(vec3(1.0, 0.4, 0.02), vec3(1.0, 0.82, 0.58), hot * edge);
    float a = clamp(glow * edge, 0.0, 1.0) * fogAlpha(vWorld);
    // Premultiplied: alpha paints the orange over a light haze; at night it is nearly pure light.
    gl_FragColor = vec4(col * a, a * mix(0.85, 0.25, night));
  }
`;

const BEAD_VERT = /* glsl */`
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const BEAD_FRAG = /* glsl */`
  varying vec3 vN;
  varying vec3 vWorld;
  uniform float uI;
  void main() {
    float f = clamp(dot(normalize(vN), normalize(cameraPosition - vWorld)), 0.0, 1.0);
    vec3 col = mix(vec3(1.0, 0.36, 0.0), vec3(1.0, 0.86, 0.66), pow(f, 1.6));
    gl_FragColor = vec4(col * uI, 1.0);
  }
`;
const HALO_VERT = /* glsl */`
  uniform vec3 uPos;
  uniform float uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = viewMatrix * vec4(uPos, 1.0);
    mv.xy += position.xy * uSize;
    gl_Position = projectionMatrix * mv;
  }
`;
const HALO_FRAG = /* glsl */`
  ${FRAG_COMMON}
  uniform float uI;
  varying vec2 vUv;
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float r2 = dot(q, q);
    float g = exp(-r2 * 7.0) * 0.75 + exp(-r2 * 26.0) * 0.6;
    float night = nightHere();
    vec3 col = mix(vec3(1.0, 0.38, 0.0), vec3(1.0, 0.7, 0.4), exp(-r2 * 30.0));
    float a = clamp(g * uI, 0.0, 1.0);
    gl_FragColor = vec4(col * a, a * mix(0.8, 0.2, night));
  }
`;

/* ================================================================================================
   Navigation helpers (no WebGL needed): the journal's navigator can use these in every mode.
   ================================================================================================ */
const CHAPTER_SEL = 'section.chapter[id]';
const docTopOf = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
/** Rendered: not inside a closed <details> (whose own summary still shows). Chapters 4-9 and the prose use them. */
export function isShown(el) {
  for (let d = el?.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])')) {
    const summary = d.querySelector(':scope > summary');
    if (!summary || !summary.contains(el)) return false;
  }
  return !!el;
}
function resolveTarget(root, target) {
  if (target == null) return null;
  if (typeof target === 'number') return root.querySelector(`#ch-${String(target).padStart(2, '0')}`);
  if (target instanceof Element) return target;
  const t = String(target).trim();
  if (/^#?ch-\d\d$/.test(t)) return root.querySelector(t.startsWith('#') ? t : `#${t}`);
  if (/^\d\.\d{6}$/.test(t)) return root.querySelector(`[data-worldline="${t}"]:not(section)`) || root.querySelector(`[data-worldline="${t}"]`);
  try { return root.querySelector(t); } catch { return null; }
}
/** Scroll y that shows `target`: a chapter id ('ch-05', '#ch-05'), a chapter number (5), a world-line value
 *  ('0.409431': the marker where that line lands, placed on the viewport centre where the meter shifts), or any
 *  element/selector inside #journal. Chapters land at the top, clear of the fixed nav (like an anchor link). */
export function scrollYFor(target, root = document.getElementById('journal')) {
  const el = root && resolveTarget(root, target);
  if (!el || !isShown(el)) return null;           // behind the shut gate: the caller opens it first
  const top = docTopOf(el);
  if (el.matches(CHAPTER_SEL)) {
    // A chapter lands at its top, clear of the fixed nav, and never past its own first shift: the meter reads the
    // line the chapter starts on (its data-worldline), not the first ledger row below the title.
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    let y = top - pad;
    const first = [...el.querySelectorAll('[data-worldline]')].find(isShown);
    if (first) y = Math.min(y, docTopOf(first) - innerHeight * 0.5 - 6);
    return Math.max(0, y);
  }
  return Math.max(0, top - innerHeight * 0.5 + 2);
}
/** Scroll to a chapter or world line (see scrollYFor). Uses Lenis when it runs, native scroll otherwise.
 *  { immediate: true } jumps without the smooth scroll; otherwise the jump takes `duration` seconds (0.9 by default,
 *  DESIGN 12.6), and reduced motion always jumps. Resolves with the y it went to (or null). */
export function seekTo(target, { immediate = false, duration = 0.9 } = {}) {
  const y = scrollYFor(target);
  if (y == null) return Promise.resolve(null);
  return scrollToY(y, { immediate, duration, target });
}
/** The one smooth jump every navigation uses: Lenis with a fixed duration, or an instant jump under reduced motion. */
export function scrollToY(y, { immediate = false, duration = 0.9, target = null } = {}) {
  const reduce = reducedMotion();
  const now = immediate || reduce;
  const mc = window.__motion;
  document.dispatchEvent(new CustomEvent('loom:seek', { detail: { target, y, immediate: now } }));
  if (mc?.scrollTo && mc.lenis) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(y); } };
      mc.scrollTo(y, now ? { immediate: true, force: true, onComplete: finish }
        : { duration, easing: (t) => 1 - Math.pow(1 - t, 4), force: true, onComplete: finish });
      setTimeout(finish, now ? 60 : duration * 1000 + 250);       // never hang on a missed onComplete
    });
  }
  window.scrollTo({ top: y, behavior: now ? 'instant' : 'smooth' });
  return new Promise((resolve) => setTimeout(() => resolve(y), now ? 30 : Math.min(900, duration * 1000)));
}
/** Watch which chapter holds the viewport centre and dispatch document 'loom:chapter'
 *  { id, index, previous } when it changes (also on start). Works with or without the WebGL loom. */
let watcher = null;
export function watchChapters(root = document.getElementById('journal')) {
  if (watcher || !root) return watcher;
  const chapters = [...root.querySelectorAll(CHAPTER_SEL)];
  let current = null, ticking = false;
  const check = () => {
    ticking = false;
    const line = scrollY + innerHeight * 0.5;
    let hit = null;
    for (const c of chapters) {
      if (!isShown(c)) continue;
      const t = docTopOf(c);
      if (line >= t && line < t + c.offsetHeight) { hit = c; break; }
    }
    const id = hit ? hit.id : null;
    if (id === current) return;
    const previous = current;
    current = id;
    document.dispatchEvent(new CustomEvent('loom:chapter', { detail: { id, index: id ? Number(id.slice(3)) : 0, previous } }));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
  const onToggle = (e) => { if (e.target instanceof HTMLDetailsElement) requestAnimationFrame(onScroll); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  document.addEventListener('toggle', onToggle, true);
  check();
  watcher = {
    get current() { return current; },
    refresh: check,
    stop() { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); document.removeEventListener('toggle', onToggle, true); watcher = null; },
  };
  return watcher;
}

/* ================================================================================================
   mount
   ================================================================================================ */
export async function mountLoom(root, options = {}) {
  const o = { ...DEFAULTS, ...options };
  let app = null;
  let dead = false;
  const report = (err) => { try { o.onError?.(err); } catch { /* never break the page */ } };
  const api = {
    get live() { return !!app && app.live(); },
    state: () => (app ? app.state() : { live: false, renders: 0 }),
    highlight: (v) => app?.highlight(v),
    /** Scroll to a chapter or world line; the scene coalesces straight to that state (no replayed jumps). */
    seekTo: (target, opts) => { app?.coalesce(); return seekTo(target, opts); },
    /** Coalesce the next 1.6 s: a jump that is not a seekTo (to the primer, the composer) flies past silently too. */
    coalesce: () => app?.coalesce(),
    get chapter() { return watcher?.current ?? null; },
    dispose() { dead = true; app?.dispose(); app = null; },
  };
  try {
    const stage = o.stage || root?.querySelector('[data-loom]');
    if (!root || !stage) return api;
    if (reducedMotion() || navigator.connection?.saveData === true) return api;
    if (!canRunWebGL2(o.failIfMajorPerformanceCaveat)) return api;
    const THREE = await o.loadThree();
    if (dead || reducedMotion()) return api;
    let ST = null;
    try { ST = await o.loadScrollTrigger(); } catch { ST = null; }
    if (dead || reducedMotion()) return api;
    try { o.beforeContext?.(); } catch (err) { report(err); }
    app = await createApp(THREE, ST, root, stage, o, () => dead, report);
    if (dead) { app?.dispose(); app = null; }
  } catch (err) {
    app?.dispose();
    app = null;
    report(err);
  }
  return api;
}

async function createApp(THREE, ST, root, stage, o, isCancelled, report) {
  const cleanups = [];
  const listen = (t, type, fn, opts) => { t.addEventListener(type, fn, opts); cleanups.push(() => t.removeEventListener(type, fn, opts)); };
  // The lite tier (fewer threads and segments): touch devices and phone-width stages (the skill's tier table).
  const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches) ||
    stage.clientWidth < 768;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const table = threadTable({ outer: coarse ? 9 : PARAMS.strand.outer });
  solvePsi(table);
  const path = buildPath(table);
  const marks = path.marks;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-loom-canvas', '');
  canvas.style.opacity = '0';
  canvas.style.transition = `opacity ${o.fadeMs}ms cubic-bezier(.25,1,.5,1)`;
  const labelsEl = document.createElement('div');
  labelsEl.className = 'loom__labels';
  labelsEl.setAttribute('aria-hidden', 'true');

  let renderer = null, scene = null, camera = null;
  let dead = false, lost = false, running = false, inView = true, shown = false, renders = 0;
  let io = null, ro = null, st = null;
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const rows = [...root.querySelectorAll('.ledger__row[data-worldline]')];

  function dispose() {
    if (dead) return;
    dead = true;
    running = false;
    renderer?.setAnimationLoop(null);
    io?.disconnect(); ro?.disconnect(); st?.kill?.();
    for (const off of cleanups) off();
    for (const d of disposables) d.dispose?.();
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
    canvas.remove(); labelsEl.remove();
    rows.forEach((r) => { r.removeAttribute('tabindex'); r.classList.remove('is-lit'); });
    if (root.dataset.loom) delete root.dataset.loom;
  }

  try {
    stage.append(canvas, labelsEl);
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: o.failIfMajorPerformanceCaveat,
    });
    renderer.setClearColor(0x000000, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.sortObjects = true;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(o.fov, 1, 0.1, 200);

    /* ---- the threads: one instanced tube -------------------------------------------------------------- */
    // The tube covers a window around the camera (PARAMS.window), snapped to whole segments so vertices never
    // swim along the thread as it moves; the fog has dissolved the yarn well before either end.
    const [W0, W1] = PARAMS.window;
    const perUnit = coarse ? 7 : 10;
    const segsX = Math.round((W1 - W0) * perUnit);
    const X0 = W0, X1 = W1;
    const radial = 8;
    const tube = new THREE.InstancedBufferGeometry();
    {
      const pos = new Float32Array((segsX + 1) * (radial + 1) * 3);
      let i = 0;
      for (let a = 0; a <= segsX; a++) for (let b = 0; b <= radial; b++) { pos[i++] = a / segsX; pos[i++] = b / radial; pos[i++] = 0; }
      const idx = [];
      for (let a = 0; a < segsX; a++) for (let b = 0; b < radial; b++) {
        const p = a * (radial + 1) + b, q = p + radial + 1;
        idx.push(p, q, p + 1, p + 1, q, q + 1);
      }
      tube.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      tube.setIndex(idx);
      const n = table.length;
      const aThread = new Float32Array(n * 4), aThread2 = new Float32Array(n * 3), aColor = new Float32Array(n * 3);
      // Colours stay display sRGB end to end (these ShaderMaterials do no colour management), so the hexes are
      // read raw, never through THREE.Color's sRGB-to-linear conversion.
      const raw = (hex) => new THREE.Color().setHex(parseInt(hex.slice(1), 16), THREE.LinearSRGBColorSpace);
      const cA = raw(PARAMS.yarn.a), cB = raw(PARAMS.yarn.b), cS = raw(PARAMS.yarn.sg);
      const hash = (k) => { const v = Math.sin(k * 91.7 + 17.3) * 43758.5453; return v - Math.floor(v); };
      table.forEach((t, j) => {
        aThread.set([t.strand, t.phi, t.ring, t.seed], j * 4);
        aThread2.set([t.radius, t.index, t.fill ? 1 : 0], j * 3);
        const c = (t.strand === 0 ? cA : t.strand === 1 ? cB : cS).clone();
        if (t.strand < 2) {
          const h = hash(j), h2 = hash(j + 40);
          c.offsetHSL((h - 0.5) * 0.045, (h2 - 0.5) * 0.12, (h - 0.5) * 0.16);
          if (t.fill) c.multiplyScalar(0.5);
        }
        aColor.set([c.r, c.g, c.b], j * 3);
      });
      tube.setAttribute('aThread', new THREE.InstancedBufferAttribute(aThread, 4));
      tube.setAttribute('aThread2', new THREE.InstancedBufferAttribute(aThread2, 3));
      tube.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));
      tube.instanceCount = n;
      tube.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e4);
    }
    keep(tube);

    const psiTex = keep(new THREE.DataTexture(PSI.table, PSI.n, 2, THREE.RedFormat, THREE.FloatType));
    psiTex.minFilter = psiTex.magFilter = THREE.NearestFilter;
    psiTex.needsUpdate = true;
    const common = {
      uPsi: { value: psiTex }, uPsiX: { value: new THREE.Vector2(PSI.x0, PSI.dx) },
      uPhase: { value: PARAMS.cord.phase }, uPitch: { value: PARAMS.cord.pitch }, uD: { value: PARAMS.cord.d },
      uRelax: { value: 0 }, uSwayT: { value: 0 }, uSwayAmp: { value: 0 },
      uKnots: { value: PARAMS.knots.map((k) => new THREE.Vector3(k.x, k.w, k.strand)).concat([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]).slice(0, 4) },
      uKnotN: { value: PARAMS.knots.length },
      uFall: { value: new THREE.Vector4(-1e5, -1e5, 1e5, 1e5) },
      uCanvas: { value: new THREE.Vector3(1, 1, dpr) },
      uFogNear: { value: 12 }, uFogFar: { value: 26 },
      uSparkS: { value: 0 }, uTrail: { value: o.trail },
    };
    const segUniform = [];
    for (const g of path.segs) if (g.type === 'ride') segUniform.push(new THREE.Vector4(g.thread.index, g.x0, g.x1, g.s0));
    while (segUniform.length < 32) segUniform.push(new THREE.Vector4(-9, 0, 0, 0));
    const yarnMat = keep(new THREE.ShaderMaterial({
      vertexShader: YARN_VERT, fragmentShader: YARN_FRAG,
      uniforms: {
        ...common,
        uRange: { value: new THREE.Vector2(X0, X1) },   // moved with the camera every frame
        uKey: { value: new THREE.Vector3(0, 1, 0) }, uFill: { value: new THREE.Vector3(0, -1, 0) },
        uSparkPos: { value: new THREE.Vector3() }, uSparkI: { value: 1 },
        uSeg: { value: segUniform.slice(0, 32) }, uSegN: { value: Math.min(32, path.segs.filter((g) => g.type === 'ride').length) },
        uHi: { value: -9 }, uHiAmt: { value: 0 },
        uFlash: { value: 0 }, uFlashIdx: { value: -9 }, uFlashX: { value: 0 },
        uSG: { value: new THREE.Vector3(0, 0, 0) },
      },
      premultipliedAlpha: true,
    }));
    const threads = new THREE.Mesh(tube, yarnMat);
    threads.frustumCulled = false;
    threads.renderOrder = 0;
    scene.add(threads);

    /* ---- jump arcs: thin emissive tubes, lit only once the spark has passed along them -------------------- */
    const arcGeo = (() => {
      const R = PARAMS.strand.thread * 0.42, RS = 6, NS = 48;
      const pos = [], nor = [], sAt = [], idx = [];
      let base = 0;
      for (const arc of path.arcs) {
        const frames = [];
        for (let i = 0; i <= NS; i++) {
          const u = i / NS, p = arcPoint(arc, u, [0, 0, 0]);
          const q = arcPoint(arc, Math.min(1, u + 0.01), [0, 0, 0]), r = arcPoint(arc, Math.max(0, u - 0.01), [0, 0, 0]);
          const T = new THREE.Vector3(q[0] - r[0], q[1] - r[1], q[2] - r[2]).normalize();
          const ref = Math.abs(T.x) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
          const N = ref.clone().sub(T.clone().multiplyScalar(ref.dot(T))).normalize();
          const B = new THREE.Vector3().crossVectors(T, N);
          frames.push({ p, N, B, s: arc.s0 + u * arc.len });
        }
        for (const f of frames) for (let k = 0; k <= RS; k++) {
          const a = (k / RS) * TAU, n = f.N.clone().multiplyScalar(Math.cos(a)).add(f.B.clone().multiplyScalar(Math.sin(a)));
          pos.push(f.p[0] + n.x * R, f.p[1] + n.y * R, f.p[2] + n.z * R);
          nor.push(n.x, n.y, n.z);
          sAt.push(f.s);
        }
        for (let i = 0; i < NS; i++) for (let k = 0; k < RS; k++) {
          const p = base + i * (RS + 1) + k, q = p + RS + 1;
          idx.push(p, q, p + 1, p + 1, q, q + 1);
        }
        base += (NS + 1) * (RS + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('aS', new THREE.Float32BufferAttribute(sAt, 1));
      g.setIndex(idx);
      return keep(g);
    })();
    const premulBlend = {
      transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    };
    const arcMat = keep(new THREE.ShaderMaterial({
      vertexShader: ARC_VERT, fragmentShader: ARC_FRAG,
      uniforms: { ...common, uFade: { value: 1 } }, ...premulBlend,
    }));
    const arcs = new THREE.Mesh(arcGeo, arcMat);
    arcs.frustumCulled = false;
    arcs.renderOrder = 2;
    scene.add(arcs);

    /* ---- the spark: a neon bead with a tight glow ---------------------------------------------------------- */
    const beadGeo = keep(new THREE.SphereGeometry(PARAMS.strand.thread * 1.25, 18, 12));
    const beadMat = keep(new THREE.ShaderMaterial({ vertexShader: BEAD_VERT, fragmentShader: BEAD_FRAG, uniforms: { uI: { value: 1 } } }));
    const bead = new THREE.Mesh(beadGeo, beadMat);
    bead.renderOrder = 1;
    scene.add(bead);
    const haloGeo = keep(new THREE.PlaneGeometry(1, 1));
    const haloMat = keep(new THREE.ShaderMaterial({
      vertexShader: HALO_VERT, fragmentShader: HALO_FRAG,
      uniforms: { ...common, uPos: { value: new THREE.Vector3() }, uSize: { value: 0.5 }, uI: { value: 1 } },
      ...premulBlend, depthTest: false,
    }));
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.frustumCulled = false;
    halo.renderOrder = 3;
    scene.add(halo);

    let tris = (tube.index.count / 3) * tube.instanceCount + arcGeo.index.count / 3 + beadGeo.index.count / 3 + 2;

    /* ---- labels at jump points (projected DOM, aria-hidden duplicates of the in-flow values) ------------- */
    // Each label is an annotation: the value set just clear of the cord (above alpha, below beta and the Steins
    // Gate thread) with a hairline leader down (or up) to the point it names. Same device as the ledger rows.
    const labels = [];
    const makeLabel = (text, cls) => {
      const el = document.createElement('span');
      el.className = 'loom__label' + (cls ? ' ' + cls : '');
      const t = document.createElement('span');
      t.className = 'loom__value';
      t.textContent = text;
      const lead = document.createElement('span');
      lead.className = 'loom__leader';
      el.append(t, lead);
      labelsEl.append(el);
      return { el, lead };
    };
    for (const arc of path.arcs) {
      if (!arc.opt.label) continue;
      labels.push({ ...makeLabel(arc.opt.label), arc, anchor: arc.p[3], kind: 'jump', below: arc.B.strand !== 0, shown: -1 });
    }
    for (const k of PARAMS.knots) {
      const th = { strand: k.strand, phi: 0, ring: 0, seed: 0 };
      labels.push({ ...makeLabel(k.date, 'loom__label--knot'), knot: k, anchor: threadPos(k.x, th), kind: 'knot', below: k.strand !== 0, shown: -1 });
    }

    /* ---- scroll -> s ------------------------------------------------------------------------------------ */
    const docTop = docTopOf;
    let beats = [];
    function measure() {
      const vh = innerHeight;
      let prevS = 0, prevY = -Infinity;
      const out = [];
      const gate = root.querySelector('details.spoiler-gate');
      const gateState = gate && !gate.open ? 'closed' : 'open';
      for (const b of BEATS) {
        if (b.gate && b.gate !== gateState) continue;
        const el = root.matches(b.el) ? root : root.querySelector(b.el);
        if (!el || !isShown(el)) continue;
        const h = el.offsetHeight;
        let y = docTop(el) + (b.edge === 'bottom' ? h : b.edge === 'middle' ? h / 2 : 0) - vh * b.at;
        y = Math.max(y, prevY + 1);
        let s = typeof b.s === 'string' ? (marks[b.s] ?? prevS) : sOn(path, b.s[0], b.s[1], prevS);
        s = Math.max(s, prevS);
        out.push({ y, s, cam: CAMS[b.cam] || CAMS.ride });
        prevS = s; prevY = y;
      }
      beats = out;
    }
    function beatAt(y) {
      if (!beats.length) return { s: 0, cam: CAMS.far };
      if (y <= beats[0].y) return { s: beats[0].s, cam: beats[0].cam };
      for (let i = 1; i < beats.length; i++) {
        const a = beats[i - 1], b = beats[i];
        if (y <= b.y) {
          const t = (y - a.y) / (b.y - a.y);
          const e = t * t * (3 - 2 * t);
          const cam = {};
          for (const k in a.cam) cam[k] = mix(a.cam[k], b.cam[k], e);
          return { s: mix(a.s, b.s, t), cam };
        }
      }
      const last = beats[beats.length - 1];
      return { s: last.s, cam: last.cam };
    }

    /* ---- the camera's x: the spark's x, smoothed along the path (so hops and loops never jerk it) ------ */
    const STEP = 0.02;
    const camX = (() => {
      const n = Math.ceil(path.length / STEP) + 1, raw = new Float32Array(n), out = new Float32Array(n);
      const tmp = { pos: [0, 0, 0], x: 0, seg: null };
      for (let i = 0; i < n; i++) raw[i] = sparkAt(path, i * STEP, 0, null, tmp).x;
      const sigma = 0.7 / STEP, R = Math.ceil(sigma * 3), w = [];
      for (let k = -R; k <= R; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
      for (let i = 0; i < n; i++) {
        let acc = 0, ws = 0;
        for (let k = -R; k <= R; k++) { const j = clamp(i + k, 0, n - 1); acc += raw[j] * w[k + R]; ws += w[k + R]; }
        out[i] = acc / ws;
      }
      return (s) => { const f = clamp(s / STEP, 0, n - 1), i = Math.floor(f), t = f - i; return mix(out[i], out[Math.min(n - 1, i + 1)], t); };
    })();
    // ...and the camera's drift round the cord: a smooth sine of where the spark's thread sits on its ply, so the
    // lens leans toward the spark as it spirals (never more than ORBIT), and rests square-on at knots, on the
    // Steins Gate thread and mid-arc.
    const ORBIT = 32 * DEG;
    const camOrbit = (() => {
      const n = Math.ceil(path.length / STEP) + 1, raw = new Float32Array(n), out = new Float32Array(n);
      const tmp = { pos: [0, 0, 0], x: 0, seg: null };
      for (let i = 0; i < n; i++) {
        sparkAt(path, i * STEP, 0, null, tmp);
        const g = tmp.seg, th = g && g.type === 'ride' ? g.thread : null;
        if (!th || th.strand > 1) { raw[i] = 0; continue; }
        const a = psi(tmp.x, th.strand) + th.phi - Math.PI / 2;
        raw[i] = ORBIT * Math.sin(a) * (1 - pinch(tmp.x, th.strand));
      }
      const sigma = 0.45 / STEP, R = Math.ceil(sigma * 3), w = [];
      for (let k = -R; k <= R; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
      for (let i = 0; i < n; i++) {
        let acc = 0, ws = 0;
        for (let k = -R; k <= R; k++) { const j = clamp(i + k, 0, n - 1); acc += raw[j] * w[k + R]; ws += w[k + R]; }
        out[i] = acc / ws;
      }
      return (s) => { const f = clamp(s / STEP, 0, n - 1), i = Math.floor(f), t = f - i; return mix(out[i], out[Math.min(n - 1, i + 1)], t); };
    })();

    /* ---- state ---------------------------------------------------------------------------------------- */
    const phones = () => stage.clientWidth < 768;
    // right edge of the copy column (grid columns 1-5), read from the layout so labels never cover the copy
    let textEndCache = { w: -1, v: 0 };
    const textEdge = () => {
      if (textEndCache.w === S.w) return textEndCache.v;
      const body = root.querySelector('.chapter__body');
      const r = body ? body.getBoundingClientRect() : null;
      textEndCache = { w: S.w, v: r ? r.right - stage.getBoundingClientRect().left : 0 };
      return textEndCache.v;
    };
    const S = {
      y: scrollY, yt: scrollY,          // damped and target scroll
      px: 0, py: 0, pxt: 0, pyt: 0,     // pointer parallax
      hi: -9, hiAmt: 0, hiT: 0,
      lastInput: performance.now(),
      swayT: 0, swayAmp: 0,
      s: 0, lastS: null,
      flash: 0, flashIdx: -9, flashX: 0, flashAt: -1e9, quietUntil: 0,
      w: 1, h: 1,
    };
    const hits = Object.entries(marks).filter(([k]) => /^hit\d/.test(k)).map(([k, s]) => ({ k, s }));
    const jumps = path.arcs.filter((a) => a.opt.id).map((a) => ({ id: a.opt.id, s: a.s0, size: a.opt.size || 1, value: a.opt.label || null }));
    const spark = { pos: [0, 0, 0], x: 0, seg: null };
    const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const tmpV = new THREE.Vector3();
    const sgMark = marks.sg ?? path.length;
    const sgS0 = path.segs.find((g) => g.type === 'ride' && g.name === 'SG')?.s0 ?? path.length;
    const inkDay = [0x4A, 0x4D, 0x47], inkNight = [0xAC, 0xAF, 0xA6];
    const groundDay = [0xC9, 0xCC, 0xC3], groundNight = [0x0E, 0x0F, 0x0D];
    let fall = { dawnTop: -1e5, dawnBot: -1e5, duskTop: 1e5, duskBot: 1e5 };
    const dawnEl = root.querySelector('.fall--dawn'), duskEl = root.querySelector('.fall--dusk');
    const nightAt = (y) => {
      if (y < fall.dawnTop) return 1;
      if (y < fall.dawnBot) return 1 - smooth(fall.dawnTop, fall.dawnBot, y);
      if (y < fall.duskTop) return 0;
      if (y < fall.duskBot) return smooth(fall.duskTop, fall.duskBot, y);
      return 1;
    };

    function resize() {
      const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
      S.w = w; S.h = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Portrait phones keep a long lens across the width: widen the vertical FOV until ~28 deg fit horizontally.
      const hfovMin = 28 * DEG;
      const v = 2 * Math.atan(Math.tan(hfovMin / 2) / camera.aspect);
      camera.fov = Math.max(o.fov, v / DEG);
      camera.updateProjectionMatrix();
      common.uCanvas.value.set(w, h, renderer.getPixelRatio());
    }

    function highlight(value) {
      const name = value != null ? PARAMS.values[String(value)] : null;
      const th = name ? storyThread(table, name) : null;
      if (th) { S.hi = th.index; S.hiT = 1; } else { S.hiT = 0; }
      rows.forEach((r) => r.classList.toggle('is-lit', value != null && r.dataset.worldline === String(value)));
      bump();
    }

    function update(now, dt) {
      // damp the scroll and pointer. A jump further than 1.2 viewports (a deep link, the chapter index, a seek)
      // snaps straight to the destination state instead of replaying every beat in between.
      let quiet = now < S.quietUntil;
      if (Math.abs(S.yt - S.y) > innerHeight * 1.2) { S.y = S.yt; quiet = true; }
      const ky = 1 - Math.exp(-dt * 10);
      const y0 = S.y;
      S.y += (S.yt - S.y) * ky;
      if (Math.abs(S.yt - S.y) < 0.25) S.y = S.yt;
      if (Math.abs(S.y - y0) > innerHeight * 0.3) quiet = true;          // a fling: no sounds, no flashes
      const kp = 1 - Math.exp(-dt * 4);
      S.px += (S.pxt - S.px) * kp; S.py += (S.pyt - S.py) * kp;
      S.hiAmt += (S.hiT - S.hiAmt) * (1 - Math.exp(-dt * 7));
      if (Math.abs(S.hiT - S.hiAmt) < 0.004) S.hiAmt = S.hiT;
      const idle = now - S.lastInput;
      const swayTarget = idle < o.idleMs ? Math.sin(Math.PI * clamp(idle / o.idleMs, 0, 1)) : 0;
      S.swayAmp += (swayTarget - S.swayAmp) * (1 - Math.exp(-dt * 2));
      if (idle >= o.idleMs && S.swayAmp < 0.002) S.swayAmp = 0;
      S.swayT += dt;

      const { s, cam: c } = beatAt(S.y);
      S.s = s;
      const relax = smooth(sgS0 + 0.6, sgS0 + 11, s);
      const sway = { t: S.swayT, amp: S.swayAmp };
      sparkAt(path, s, relax, sway, spark);

      // sound and flash on crossings: never on the first frame, and coalesced: a frame that crosses more than
      // one event, or belongs to a fling or a seek, fires nothing (the scene simply shows the destination)
      if (S.lastS != null && Math.abs(s - S.lastS) > 1e-5) {
        const lo = Math.min(S.lastS, s), hi = Math.max(S.lastS, s);
        const crossedJ = jumps.filter((j) => j.s > lo && j.s <= hi);
        const crossedH = s > S.lastS ? hits.filter((h) => h.s > lo && h.s <= hi) : [];
        if (!quiet && crossedJ.length + crossedH.length === 1) {
          if (crossedJ.length) { const j = crossedJ[0]; document.dispatchEvent(new CustomEvent('loom:jump', { detail: { id: j.id, size: j.size, value: j.value, reverse: s < S.lastS } })); }
          if (crossedH.length) {
            S.flashAt = now; S.flashIdx = spark.seg?.thread?.index ?? -9; S.flashX = spark.x;
            document.dispatchEvent(new CustomEvent('loom:knot', { detail: { mark: crossedH[0].k } }));
          }
        }
      }
      S.lastS = s;
      S.flash = Math.exp(-(now - S.flashAt) / 380) * (now - S.flashAt < 2400 ? 1 : 0);

      // camera: follow the cord's twist at the smoothed x so the alpha strand sits above, beta below, the
      // gap between them facing the lens; yaw puts the future nearer on the right
      const phone = phones();
      const textEnd = textEdge();
      const xc = camX(s);
      const th = twist(xc, relax) + camOrbit(s) * (1 - relax);
      const up = new THREE.Vector3(0, Math.cos(th), Math.sin(th));
      const side = new THREE.Vector3(0, -Math.sin(th), Math.cos(th));
      const X = new THREE.Vector3(1, 0, 0);
      const yaw = (c.yaw + S.px * o.parallax) * DEG, elev = (c.elev - S.py * o.parallax) * DEG;
      const dist = c.dist * (phone ? 0.72 : 1);
      const dir = side.clone().multiplyScalar(Math.cos(yaw) * Math.cos(elev)).addScaledVector(X, Math.sin(yaw) * Math.cos(elev)).addScaledVector(up, Math.sin(elev));
      const target = new THREE.Vector3(xc, 0, 0).addScaledVector(up, -0.05);
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.up.copy(up);
      camera.lookAt(target);
      // lens shift: put the spark where the composition wants it (right of the copy on desktop, centred on phones)
      // phones: the copy runs full width over the stage, so the cord rides high (about a quarter down) where the
      // gaps between chapters show it longest
      const fx = phone ? 0 : c.fx, fy = phone ? 0.23 : c.fy;
      camera.setViewOffset(S.w, S.h, -fx * S.w, fy * S.h, S.w, S.h);
      camera.updateMatrixWorld();
      common.uFogNear.value = dist + 1.2;
      common.uFogFar.value = dist + 10.5;
      const w0 = Math.floor((xc + W0) * perUnit) / perUnit;
      yarnMat.uniforms.uRange.value.set(w0, w0 + (W1 - W0));

      // lights relative to the camera: a key from upper left and in front, a dim fill from below
      const right = new THREE.Vector3().crossVectors(dir.clone().negate(), up).normalize();
      yarnMat.uniforms.uKey.value.copy(right.clone().multiplyScalar(-0.45).addScaledVector(up, 0.8).addScaledVector(dir, 0.55).normalize());
      yarnMat.uniforms.uFill.value.copy(up.clone().multiplyScalar(-0.7).addScaledVector(right, 0.4).addScaledVector(dir, 0.3).normalize());

      // grounds: where the dawn and dusk falls are on the canvas right now
      const sr = stage.getBoundingClientRect();
      if (dawnEl) { const r = dawnEl.getBoundingClientRect(); fall.dawnTop = r.top - sr.top; fall.dawnBot = r.bottom - sr.top; }
      if (duskEl) { const r = duskEl.getBoundingClientRect(); fall.duskTop = r.top - sr.top; fall.duskBot = r.bottom - sr.top; }
      common.uFall.value.set(fall.dawnTop, fall.dawnBot, fall.duskTop, fall.duskBot);

      // uniforms
      common.uRelax.value = relax;
      common.uSwayT.value = S.swayT;
      common.uSwayAmp.value = S.swayAmp;
      common.uSparkS.value = s;
      const sparkPos = V3(spark.pos);
      // the bead rides on the lens side of its thread
      const lift = PARAMS.strand.thread * 0.85;
      const toCam = tmpV.copy(camera.position).sub(sparkPos).normalize();
      bead.position.copy(sparkPos).addScaledVector(toCam, lift);
      yarnMat.uniforms.uSparkPos.value.copy(bead.position);
      haloMat.uniforms.uPos.value.copy(bead.position);
      const th0 = spark.seg?.type === 'ride' ? spark.seg.thread : null;
      const facing = th0 && th0.strand < 2 && pinch(spark.x, th0.strand, relax) < 0.5 ? (() => {
        const o2 = outward(th0, spark.x);
        return o2[1] * toCam.y + o2[2] * toCam.z;
      })() : 1;
      haloMat.uniforms.uI.value = mix(0.4, 1, smooth(-0.45, 0.1, facing));
      yarnMat.uniforms.uHi.value = S.hi;
      yarnMat.uniforms.uHiAmt.value = S.hiAmt;
      yarnMat.uniforms.uFlash.value = S.flash;
      yarnMat.uniforms.uFlashIdx.value = S.flashIdx;
      yarnMat.uniforms.uFlashX.value = S.flashX;
      const sgT = s - sgS0;
      yarnMat.uniforms.uSG.value.set(smooth(0, 0.8, sgT), 0.5 - Math.max(0, sgT) * 2.2, 0.5 + Math.max(0, sgT) * 2.6);
      arcMat.uniforms.uFade.value = 1 - relax;

      // labels: place every visible annotation, let the older of two colliding ones yield, then write styles
      const placed = [];
      for (const L of labels) {
        let op = 0;
        if (L.kind === 'jump') {
          const g = s - L.arc.s1;
          op = g < -0.02 ? 0 : smooth(-0.02, 0.12, g) * (1 - smooth(5, 10, g)) * (1 - relax);
        } else {
          op = (1 - smooth(3.5, 7, Math.abs(spark.x - L.knot.x))) * 0.8 * (1 - relax) * (L.knot.strand === 0 || s < sgMark ? 1 : 0);
        }
        if (op < 0.01) { if (L.shown !== 0) { L.el.style.opacity = '0'; L.shown = 0; } continue; }
        const v = V3(L.anchor);
        const d = v.distanceTo(camera.position);
        v.project(camera);
        if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) { L.el.style.opacity = '0'; L.shown = 0; continue; }
        op *= 1 - smooth(common.uFogNear.value - 1, common.uFogFar.value * 0.75, d);
        const sx = (v.x * 0.5 + 0.5) * S.w, sy = (-v.y * 0.5 + 0.5) * S.h;
        // the cord's outer edge above (or below) this x, in the camera's own up direction
        const edge = new THREE.Vector3(L.anchor[0], 0, 0).addScaledVector(camera.up, (L.below ? -1 : 1) * (PARAMS.cord.d * (1 + 0.75 * relax) + PARAMS.strand.ring + 0.16)).project(camera);
        const ey = (-edge.y * 0.5 + 0.5) * S.h;
        const TXT = 16;
        let ly = L.below ? Math.max(ey, sy) + 12 : Math.min(ey, sy) - 12 - TXT;
        ly = clamp(ly, 72, S.h - 40);
        if (!phone) op *= smooth(textEnd + 24, textEnd + 120, sx);
        const lx = phone ? clamp(sx - 1, 12, S.w - 80) : sx - 1;
        if (!L.w) L.w = L.el.firstChild.offsetWidth || 64;
        placed.push({ L, op, sx, sy, lx, ly, age: L.kind === 'jump' ? L.arc.s1 : L.knot.x });
      }
      // v3 set pieces carry their own words over the stage (the chapter 4 poster, the chapter 7 split, chapter 9's
      // centred line): a label never sits on them ([data-loom-clear], measured in stage coordinates).
      if (placed.length) {
        const clear = [...root.querySelectorAll('[data-loom-clear]')].filter(isShown).map((el) => el.getBoundingClientRect())
          .filter((r) => r.bottom > sr.top && r.top < sr.bottom && r.width > 0)
          .map((r) => ({ l: r.left - sr.left - 12, r: r.right - sr.left + 12, t: r.top - sr.top - 10, b: r.bottom - sr.top + 10 }));
        if (clear.length) {
          for (const P of placed) {
            const w = P.L.w || 64;
            if (clear.some((c) => P.lx < c.r && P.lx + w > c.l && P.ly < c.b && P.ly + 18 > c.t)) P.op = 0;
          }
        }
      }
      placed.sort((a, b) => a.lx - b.lx);
      for (let i = 1; i < placed.length; i++) {
        const a = placed[i - 1], b = placed[i];
        if (a.op < 0.02 || b.op < 0.02 || Math.abs(a.ly - b.ly) > 18) continue;
        if (b.lx < a.lx + a.L.w + 10) {
          const older = a.age < b.age ? a : b;
          older.op *= smooth(a.lx + a.L.w + 10, a.lx + a.L.w - 20, b.lx);   // fades as they close in
        }
      }
      for (const P of placed) {
        const { L, op, sx, sy, lx, ly } = P;
        const TXT = 16, GAP = 7;
        const n = nightAt(ly + TXT / 2);
        const ink = inkDay.map((cv, i) => Math.round(mix(cv, inkNight[i], n)));
        const gr = groundDay.map((cv, i) => Math.round(mix(cv, groundNight[i], n)));
        L.el.style.color = `rgb(${ink[0]} ${ink[1]} ${ink[2]})`;
        L.el.style.setProperty('--halo', `rgb(${gr[0]} ${gr[1]} ${gr[2]})`);
        L.el.style.opacity = op.toFixed(3);
        L.el.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        L.lead.style.left = `${(sx - 1 - lx).toFixed(1)}px`;
        // leader: from the text to a few px short of the point
        const top = L.below ? -(ly - sy) + GAP : TXT + 3;
        const bottom = L.below ? -4 : (sy - ly) - GAP;
        const hgt = Math.max(0, bottom - top);
        L.lead.style.transform = `translate3d(0, ${top.toFixed(1)}px, 0)`;
        L.lead.style.height = `${hgt.toFixed(1)}px`;
        L.shown = 1;
      }
      return Math.abs(S.yt - S.y) > 0.25 || Math.abs(S.pxt - S.px) > 1e-3 || Math.abs(S.pyt - S.py) > 1e-3 ||
        Math.abs(S.hiT - S.hiAmt) > 0.004 || idle < o.idleMs || S.swayAmp > 0.002 || now - S.flashAt < 2400;
    }

    let last = performance.now();
    function frame(now) {
      if (dead) return;
      try {
        const t = now ?? performance.now();
        const dt = Math.min(Math.max((t - last) / 1000, 1 / 240), 1 / 30);
        last = t;
        const busy = update(t, dt);
        renderer.render(scene, camera);
        renders++;
        if (!busy) stop();
      } catch (err) {
        dispose();
        report(err);
      }
    }
    function request() {
      if (running || dead || lost || !inView || document.hidden || !shown) return;
      running = true;
      last = performance.now();
      renderer.setAnimationLoop(frame);
    }
    function stop() { running = false; renderer?.setAnimationLoop(null); }
    function bump() { S.lastInput = performance.now(); request(); }

    /* ---- input ---------------------------------------------------------------------------------------- */
    const onScroll = () => { S.yt = scrollY; request(); };
    if (ST) {
      st = ST.create({
        trigger: root, start: 'top bottom', end: 'bottom top',
        onUpdate: onScroll,
        onRefresh: () => { measure(); S.yt = scrollY; request(); },
      });
    }
    listen(window, 'scroll', onScroll, { passive: true });
    listen(window, 'pointermove', (e) => {
      if (!fine.matches || e.pointerType === 'touch') return;
      S.pxt = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
      S.pyt = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
      bump();
    }, { passive: true });
    listen(document.documentElement, 'pointerleave', () => { S.pxt = S.pyt = 0; request(); });
    listen(document, 'visibilitychange', () => (document.hidden ? stop() : request()));
    const onMotion = () => { if (reducedMotion()) dispose(); };
    listen(matchMedia('(prefers-reduced-motion: reduce)'), 'change', onMotion);
    listen(window, 'motionchange', onMotion);
    listen(window, 'pagehide', () => dispose());
    listen(canvas, 'webglcontextlost', (e) => {
      e.preventDefault();
      lost = true; stop();
      canvas.style.opacity = '0';
      delete root.dataset.loom;
    });
    listen(canvas, 'webglcontextrestored', () => {
      lost = false;
      update(performance.now(), 1 / 60);
      renderer.render(scene, camera);
      requestAnimationFrame(() => { if (!dead && !lost) { canvas.style.opacity = '1'; root.dataset.loom = 'live'; } });
    });
    // Ledger rows: hover or focus lights the row's thread; the rows join the tab order only while the loom is live.
    for (const r of rows) {
      r.tabIndex = 0;
      const on = () => highlight(r.dataset.worldline), off = () => highlight(null);
      listen(r, 'pointerenter', on);
      listen(r, 'pointerleave', off);
      listen(r, 'focus', on);
      listen(r, 'blur', off);
    }
    listen(window, 'resize', () => { resize(); if (!ST) measure(); request(); });
    // Layout changes inside the journal (a <details> opening, late fonts, a layout variant) move every beat:
    // re-measure (through ScrollTrigger.refresh, so the rest of the page's triggers follow) once it settles.
    let lastH = root.offsetHeight, remeasureT = 0;
    const remeasure = () => {
      clearTimeout(remeasureT);
      remeasureT = setTimeout(() => {
        if (dead) return;
        const h = root.offsetHeight;
        if (Math.abs(h - lastH) < 1) return;
        lastH = h;
        if (ST) ST.refresh(); else { measure(); }
        S.yt = scrollY; request();
      }, 120);
    };
    const ro2 = new ResizeObserver(remeasure);
    ro2.observe(root);
    cleanups.push(() => { ro2.disconnect(); clearTimeout(remeasureT); });
    // A <details> toggling is a layout change, not reading: whatever it moves past plays no sound and no flash.
    listen(root, 'toggle', () => {
      S.quietUntil = performance.now() + 900;
      requestAnimationFrame(() => {
        if (dead) return;
        lastH = root.offsetHeight;
        if (ST) ST.refresh(); else measure();
        S.yt = scrollY; request();
      });
    }, true);
    ro = new ResizeObserver(() => { resize(); if (!running && inView && shown && !lost) { update(performance.now(), 1 / 60); renderer.render(scene, camera); } });
    ro.observe(stage);

    /* ---- first frame, then reveal --------------------------------------------------------------------- */
    resize();
    measure();
    S.y = S.yt = scrollY;
    update(performance.now(), 1 / 60);
    await renderer.compileAsync(scene, camera);
    if (isCancelled() || dead) { dispose(); return null; }
    renderer.render(scene, camera);
    renders++;
    await new Promise((r) => requestAnimationFrame(r));
    if (dead) return null;
    shown = true;
    canvas.style.opacity = '1';
    root.dataset.loom = 'live';
    bump();

    io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (!inView) stop(); else request(); }, { rootMargin: '64px' });
    io.observe(root);

    const calls = 4;
    return {
      live: () => shown && !dead && !lost,
      dispose,
      highlight,
      coalesce: () => { S.quietUntil = performance.now() + 1600; },
      state: () => ({
        live: shown && !dead && !lost, running, renders, dpr: renderer.getPixelRatio(), triangles: Math.round(tris), drawCalls: calls,
        threads: table.length, segments: segsX, radial, coarse, s: +S.s.toFixed(3), x: +spark.x.toFixed(3), pathLength: +path.length.toFixed(2),
        scroll: st ? 'scrolltrigger' : 'listener', beats: beats.length,
        // where the spark is on the canvas (CSS px), for QA
        sparkPx: (() => { const v = bead.position.clone().project(camera); return [Math.round((v.x * 0.5 + 0.5) * S.w), Math.round((-v.y * 0.5 + 0.5) * S.h)]; })(),
        axisPx: (() => { const v = new THREE.Vector3(spark.x, 0, 0).project(camera); return [Math.round((v.x * 0.5 + 0.5) * S.w), Math.round((-v.y * 0.5 + 0.5) * S.h)]; })(),
        camUpDeg: Math.round(((Math.atan2(camera.up.z, camera.up.y) * 180 / Math.PI) + 360) % 360),
      }),
    };
  } catch (err) {
    dispose();
    throw err;
  }
}

function canRunWebGL2(failIfMajorPerformanceCaveat) {
  try {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat });
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
