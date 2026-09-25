/**
 * meter-gl.js: the hero divergence meter in WebGL (three.js 0.186.1), laid over the DOM meter (the poster).
 * Last updated: 2026-09-25
 *
 * USAGE
 *   <script type="importmap">{ "imports": {
 *     "three": "https://cdn.jsdelivr.net/npm/three@0.186.1/+esm",
 *     "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/",
 *     "gsap": "https://cdn.jsdelivr.net/npm/gsap@3.15.0/+esm",                              (optional)
 *     "gsap/ScrollTrigger": "https://cdn.jsdelivr.net/npm/gsap@3.15.0/ScrollTrigger.js/+esm" (optional)
 *   } }</script>
 *   import { mountMeterGL } from './assets/meter/meter-gl.js';
 *   const gl = await mountMeterGL(document.querySelector('.hero'), { value: '1.130426' });
 *
 *   `container` is the hero STAGE (the full-bleed section), not the meter itself: the scene needs room for the
 *   board and the 3/4 view. It must hold one [data-meter] (the DOM poster); pass { meter } to choose another.
 *   The module sets `isolation: isolate` on the container and puts the canvas at z-index -1 inside it, so every
 *   word and control in the hero paints ABOVE the canvas with no z-index work (restored on dispose).
 *
 * RETURNS (always resolves, never rejects; when WebGL is not used, the calls go straight to the DOM meter)
 *   { live, value, meter, shiftTo(value, { roll }), ignite(value), reread(), fail(opts), onLock(cb),
 *     subscribe(fn), state(), dispose() }
 *   The GL meter mirrors the DOM controller (meter.js) through controller.subscribe() and the meter:lock events,
 *   so calling shiftTo()/ignite() on either object, or on meter(el) anywhere else, drives both.
 *
 * WHAT IS IN THE SCENE (procedural only: no model files, no images)
 *   - A dark board with copper traces, silkscreen rings and header pads (canvas texture), a contact shadow round
 *     every socket, and the neon pooling on the board in front of each lit tube.
 *   - Eight tubes: glass with a fresnel rim shader (no transmission), a honeycomb anode (alpha texture drawn on a
 *     canvas, front and back halves), ten unlit cathodes stacked in depth (TubeGeometry built from the numeral
 *     paths in nixie.svg, the same data the DOM uses), the lit numeral as an HDR emissive core plus an additive
 *     sheath, and a turned socket collar.
 *   - Post: a small bloom (threshold 1.0: only the neon), then one grade pass: saturation x0.55 except the neon,
 *     grey-green midtones, lifted blacks, a haze from the top of the frame, dither. The canvas is transparent, so
 *     the page's own background shows round the object: no box, no seam.
 *   - Light: the neon itself (per-tube glow on board, wires, glass, sockets), a dim warm key and a faint cool fill.
 *
 * MOTION (render on demand: only while something moves)
 *   - First frame: straight on, framed onto the DOM meter's box, so the cross-fade does not jump. Then the camera
 *     settles into a 3/4 view (FOV 22) over 1.6s.
 *   - Pointer parallax of 2.5 degrees on fine pointers. Scroll: as the container leaves, the camera dollies back
 *     to straight on and the scene dims (GSAP ScrollTrigger scrub when the import map has it, else a passive
 *     scroll listener).
 *   - Click or Enter on the meter re-reads: a roll that locks on the same value. The target is a real <button>
 *     ("Re-read the world line") sized every frame to the tubes as drawn, placed early in the container with no
 *     z-index, so the page's own positioned copy and controls stay on top of it. The covered poster gets
 *     pointer-events: none while the canvas is live.
 *
 * BUDGET AND FALLBACKS
 *   - Starts after window load, the first LCP entry and an idle slot. DPR <= 1.5. One context. 24 scene draw
 *     calls + 7 small post passes; ~170k triangles on fine pointers, ~87k on coarse (measured); two canvas
 *     textures (board 2048 wide, honeycomb 256). Small tubes get thicker neon; narrow canvases a gentler 3/4.
 *   - Pauses offscreen (IntersectionObserver) and in hidden tabs. dispose() frees everything and releases the
 *     context; the DOM meter is shown again.
 *   - No JS, no WebGL2 (or a software renderer), reduced motion (OS or <html data-motion="reduce">, followed
 *     live), Save-Data, a CDN failure or any error: the DOM meter stays and nothing else changes. Errors are
 *     reported with console.warn through options.onError, never thrown.
 *
 * OPTIONS: meter, fov 22, view { azimuth: -18, elevation: 12 }, parallax 2.5, scroll true, settleMs 1600,
 *   fadeMs 600, maxDpr 1.5, bloom 1, failIfMajorPerformanceCaveat true, loadThree, onError, signal (an AbortSignal:
 *   aborting disposes the scene, also while it is still booting; index.html's loom uses it to take the context).
 */

import { meter as domMeter, reducedMotion, normalize } from './meter.js';

const DEFAULTS = {
  meter: '[data-meter]',
  value: null,
  fov: 22,
  view: { azimuth: -18, elevation: 12 },
  parallax: 2.5,
  scroll: true,
  settleMs: 1600,
  fadeMs: 600,
  maxDpr: 1.5,
  bloom: 1,
  failIfMajorPerformanceCaveat: true,
  loadThree: () => import('three'),
  onError: (err) => console.warn('[meter-gl] kept the DOM meter:', err),
};

/* Tube layout, in tube widths (the DOM tube is 1 x 2.2; meter.css places the numeral svg at left -4%,
   width 108%, top 7.4%). Keep these in step with meter.css so the first frame lands on the poster. */
const TUBE_H = 2.2;
const SOCKET_H = 0.207;
const GLYPH_S = 1.08 / 60;                                   // world units per sprite unit
const GLYPH_Y0 = TUBE_H - 0.074 * TUBE_H - 50 * GLYPH_S;     // world y of the sprite's centre line (y = 50)
const LAYER_Z0 = 0.13;                                       // front cathode
const LAYER_DZ = 0.029;                                      // per layer toward the back
const PULSE_MS = 120;
const GLYPH_KEY = { '.': 'dot', '?': 'q', '-': 'dash', ' ': 'blank' };
const keyOf = (c) => ('0123456789'.includes(c) ? c : GLYPH_KEY[c] || 'blank');

export async function mountMeterGL(container, options = {}) {
  const o = { ...DEFAULTS, ...options, view: { ...DEFAULTS.view, ...options.view } };
  const domEl = !container ? null
    : typeof o.meter === 'string' ? container.querySelector(o.meter) : o.meter;
  const ctrl = domEl ? domMeter(domEl) : null;
  let app = null;
  let dead = false;
  const report = (err) => { try { o.onError?.(err); } catch { /* reporting must not break the page */ } };

  const api = {
    get live() { return !!app && app.live(); },
    get value() { return ctrl?.value ?? ''; },
    meter: ctrl,
    shiftTo: (v, opts) => (ctrl ? ctrl.shiftTo(v, opts) : Promise.resolve(false)),
    ignite: (v) => (ctrl ? ctrl.ignite(v) : Promise.resolve(false)),
    reread: () => (ctrl ? ctrl.reread() : Promise.resolve(false)),
    fail: (opts) => (ctrl ? ctrl.fail(opts) : Promise.resolve(false)),
    onLock: (cb) => (ctrl ? ctrl.onLock(cb) : () => {}),
    subscribe: (fn) => (ctrl ? ctrl.subscribe(fn) : () => {}),
    state: () => (app ? app.state() : { live: false, running: false, renders: 0 }),
    dispose() { dead = true; app?.dispose(); app = null; },
  };

  // options.signal (AbortSignal): abort disposes the scene, even mid-boot (the journal's loom takes the context).
  if (o.signal?.aborted) return api;
  o.signal?.addEventListener('abort', () => api.dispose(), { once: true });

  try {
    if (!container || !ctrl) return api;
    if (o.value != null && normalize(o.value).join('') !== ctrl.value) ctrl.shiftTo(o.value, { roll: false });
    if (reducedMotion() || navigator.connection?.saveData === true) return api;
    await afterLCP();
    if (dead || reducedMotion() || !canRunWebGL2(o.failIfMajorPerformanceCaveat)) return api;
    const spriteUrl = spriteOf(domEl);
    const [THREE, glyphs] = await Promise.all([o.loadThree(), loadGlyphs(spriteUrl)]);
    if (dead || reducedMotion()) return api;
    app = await createApp(THREE, glyphs, container, domEl, ctrl, o, () => dead, report);
    if (dead) { app?.dispose(); app = null; }
  } catch (err) {
    app?.dispose();
    app = null;
    report(err);
  }
  return api;
}

/* ================================================================================================ */

async function createApp(THREE, glyphs, container, domEl, ctrl, o, isCancelled, report) {
  const cleanups = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const rad = THREE.MathUtils.degToRad;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-meter-canvas', '');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;' +
    `z-index:-1;opacity:0;transition:opacity ${o.fadeMs}ms cubic-bezier(.33,1,.68,1)`;
  const hit = document.createElement('button');
  hit.type = 'button';
  hit.className = 'nx-gl-hit';
  hit.setAttribute('aria-label', 'Re-read the world line');
  hit.hidden = true;
  // Inline, so a page's generic button:hover / button styles cannot paint a box over the meter.
  hit.style.cssText = 'position:absolute;margin:0;padding:0;border:0;background:transparent;box-shadow:none;' +
    'color:transparent;appearance:none;-webkit-appearance:none;cursor:pointer;-webkit-tap-highlight-color:transparent';

  const prev = { position: container.style.position, isolation: container.style.isolation };
  let renderer = null, dead = false, lost = false, running = false, inView = true, shown = false, renders = 0;
  let io = null, ro = null, st = null, unsub = null;
  const mm = [];

  function dispose() {
    if (dead) return;
    dead = true;
    running = false;
    renderer?.setAnimationLoop(null);
    unsub?.();
    io?.disconnect();
    ro?.disconnect();
    st?.kill?.();
    for (const off of cleanups) off();
    for (const d of disposables) d.dispose?.();
    scene?.traverse((obj) => {
      obj.geometry?.dispose();
      for (const m of [].concat(obj.material || [])) m.dispose();
    });
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
    domEl.removeAttribute('data-gl-live');
    canvas.remove();
    hit.remove();
    container.style.position = prev.position;
    container.style.isolation = prev.isolation;
  }

  // Anything going wrong after boot: drop the canvas, keep the DOM meter. A null error is a planned exit.
  const bail = (err) => { dispose(); if (err) report(err); };

  let scene = null;
  try {
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.style.isolation = 'isolate';
    container.prepend(canvas);
    canvas.after(hit);  // early in DOM order, no z-index: the page's own positioned content stays on top of it

    renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: o.failIfMajorPerformanceCaveat,
    });
    renderer.setClearColor(0x000000, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr);
    renderer.setPixelRatio(dpr);
    const hdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    const rtType = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;

    /* ---------- layout from the DOM poster ---------- */
    const tubesDom = [...domEl.querySelectorAll('.nx__tube')];
    const r0 = tubesDom[0].getBoundingClientRect(), r1 = tubesDom[1].getBoundingClientRect();
    const pitch = r0.width > 0 ? (r1.left - r0.left) / r0.width : 1.16;
    const xs = Array.from({ length: 8 }, (_, i) => (i - 3.5) * pitch);
    const rowW = 7 * pitch + 1;
    // Small tubes get thicker neon (a 38px tube would otherwise draw a sub-pixel core), and the board's
    // overhang shrinks to the room the container actually has, so it never runs off the canvas edge.
    const tubePx = Math.max(1, r0.width);
    const thick = Math.min(2.4, Math.max(1, 70 / tubePx));
    const cw = container.getBoundingClientRect().width, mw0 = domEl.getBoundingClientRect().width;
    const overhang = Math.min(0.55, Math.max(0.12, (((cw - mw0) / 2) / tubePx) * 0.6));

    scene = new THREE.Scene();
    const C = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
    const keyDir = new THREE.Vector3(-0.45, 0.85, 0.5).normalize();
    const common = {
      uKeyDir: { value: keyDir },
      uKeyCol: { value: C('#FFD2A6', 0.5) },
      uFill: { value: C('#9FB3A8', 0.09) },
      uWarm: { value: C('#FF6A00', 1) },
    };

    /* ---------- geometry from nixie.svg ---------- */
    const sampled = sampleGlyphs(glyphs, coarse ? 2.2 : 1.2);
    const Polyline = polylineCurveClass(THREE);
    const radial = coarse ? 4 : 6;
    const layerZ = (key) => {
      const l = sampled[key]?.layer ?? -1;
      return l < 0 ? LAYER_Z0 + LAYER_DZ : LAYER_Z0 - l * LAYER_DZ;
    };
    const glyphGeometry = (key, radius, radialSegs, z = layerZ(key)) => {
      const g = sampled[key];
      if (!g) return null;
      const parts = [];
      for (const line of g.lines) {
        const pts = line.pts.map(([x, y]) => new THREE.Vector3((x - 30) * GLYPH_S, GLYPH_Y0 + (50 - y) * GLYPH_S, z));
        const segs = Math.max(4, line.closed ? pts.length : pts.length - 1);
        parts.push(new THREE.TubeGeometry(new Polyline(pts, line.closed), segs, radius, radialSegs, line.closed));
      }
      for (const [cx, cy, r] of g.dots) {
        const s = new THREE.SphereGeometry(r * GLYPH_S + radius, 16, 12);
        s.translate((cx - 30) * GLYPH_S, GLYPH_Y0 + (50 - cy) * GLYPH_S, z);
        parts.push(s);
      }
      return parts.length ? keep(mergeIndexed(THREE, parts)) : null;
    };
    const DIG = '0123456789'.split('');
    const stackGeo = keep(mergeIndexed(THREE, DIG.map((k) => glyphGeometry(k, 0.0085 * Math.sqrt(thick), coarse ? 3 : 5)).filter(Boolean)));
    const coreGeo = {}, sheathGeo = {};
    for (const k of [...DIG, 'dot', 'q', 'dash']) {
      coreGeo[k] = glyphGeometry(k, 0.0115 * thick, radial);
      sheathGeo[k] = glyphGeometry(k, 0.026 * thick, radial);
    }

    /* ---------- materials ---------- */
    const instVert = /* glsl */`
      varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vGlow; varying vec2 vUv;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = m * instanceMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vW = wp.xyz; vL = position; vUv = uv;
        vN = normalize(mat3(m) * normal);
        #ifdef USE_INSTANCING_COLOR
          vGlow = instanceColor.r;
        #else
          vGlow = 0.0;
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`;
    const head = /* glsl */`
      uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uFill; uniform vec3 uWarm;
      varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vGlow; varying vec2 vUv;`;

    const stackMat = keep(new THREE.ShaderMaterial({
      uniforms: { ...common, uWire: { value: C('#5E5A52', 0.45) } },
      vertexShader: instVert,
      fragmentShader: head + /* glsl */`
        uniform vec3 uWire;
        void main() {
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vW);
          float ndl = max(dot(n, uKeyDir), 0.0);
          float spec = pow(max(dot(n, normalize(uKeyDir + v)), 0.0), 28.0);
          float rim = pow(1.0 - abs(dot(n, v)), 2.0);
          vec3 c = uWire * (uFill * 1.1 + uKeyCol * ndl * 0.45) + uKeyCol * spec * 0.03;
          c += uWarm * vGlow * (0.002 + 0.012 * rim); // nickel wire catching its neighbour's neon
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));

    const socketMat = keep(new THREE.ShaderMaterial({
      uniforms: { ...common, uMetal: { value: C('#1A1A17') } },
      vertexShader: instVert,
      fragmentShader: head + /* glsl */`
        uniform vec3 uMetal;
        void main() {
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vW);
          float ndl = max(dot(n, uKeyDir), 0.0);
          float spec = pow(max(dot(n, normalize(uKeyDir + v)), 0.0), 24.0);
          float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          float top = step(0.2, vL.y) * step(0.9, n.y);        // the insulating disc the glass stands on
          vec3 c = uMetal * (uFill * 1.2 + uKeyCol * ndl * 0.5) * (1.0 - 0.7 * top) + uKeyCol * spec * 0.07 * (1.0 - top) + uFill * rim * 0.35;
          c += uWarm * vGlow * smoothstep(0.1, 0.21, vL.y) * 0.012;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));

    const glassMat = (front) => keep(new THREE.ShaderMaterial({
      uniforms: { ...common, uTint: { value: C('#D8E0E6', 0.55) }, uFront: { value: front ? 1 : 0 } },
      vertexShader: instVert,
      fragmentShader: head + /* glsl */`
        uniform vec3 uTint; uniform float uFront;
        void main() {
          vec3 n = normalize(vN);
          if (uFront < 0.5) n = -n;
          vec3 v = normalize(cameraPosition - vW);
          float ndv = clamp(dot(n, v), 0.0, 1.0);
          float fres = pow(1.0 - ndv, 3.0);
          vec3 nv = normalize((viewMatrix * vec4(n, 0.0)).xyz);
          float body = smoothstep(0.2, 0.34, vL.y);
          float stripe = exp(-pow((nv.x + 0.6) / 0.075, 2.0)) * body;
          float stripe2 = exp(-pow((nv.x - 0.74) / 0.06, 2.0)) * 0.35 * body;
          float dome = smoothstep(1.78, 2.05, vL.y);
          float domeHi = exp(-pow((nv.x + 0.3) / 0.2, 2.0) - pow((nv.y - 0.7) / 0.22, 2.0)) * dome;
          float warm = vGlow * exp(-pow((vL.y - 1.14) / 0.6, 2.0));
          vec3 col = uTint * (fres * 0.36 + (stripe + stripe2) * 0.85 + domeHi * 1.1) + uWarm * warm * (0.06 + fres * 0.5);
          float a = clamp(0.03 + fres * 0.2 + (stripe + stripe2) * 0.2 + domeHi * 0.24, 0.0, 0.85);
          if (uFront < 0.5) { col *= 0.45; a *= 0.45; }
          gl_FragColor = vec4(col, a);
        }`,
      transparent: true, premultipliedAlpha: true, depthWrite: false, side: front ? THREE.FrontSide : THREE.BackSide,
    }));

    const hexTex = keep(hexTexture(THREE));
    const anodeMat = keep(new THREE.ShaderMaterial({
      uniforms: { ...common, uHex: { value: hexTex }, uRep: { value: new THREE.Vector2(6.5, 7.5) }, uMetal: { value: C('#3A3833') } },
      vertexShader: instVert,
      fragmentShader: head + /* glsl */`
        uniform sampler2D uHex; uniform vec2 uRep; uniform vec3 uMetal;
        void main() {
          float m = texture2D(uHex, vUv * uRep).r;
          if (m < 0.04) discard;
          vec3 n = normalize(vN);
          if (!gl_FrontFacing) n = -n;
          vec3 c = uMetal * (uFill * 1.5 + uKeyCol * max(dot(n, uKeyDir), 0.0)) + uWarm * vGlow * 0.06;
          float a = m * 0.7;
          gl_FragColor = vec4(c * a, a);
        }`,
      transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide,
    }));

    /* ---------- the board ---------- */
    const bw = rowW + 2 * overhang, bz0 = -0.8, bd = 2.0;
    const boardTex = keep(boardTexture(THREE, { bw, bd, bz0, xs }));
    const tubeU = Array.from({ length: 8 }, (_, i) => new THREE.Vector4(xs[i], 0, 0, 0));
    const boardMat = keep(new THREE.ShaderMaterial({
      uniforms: {
        ...common, uMap: { value: boardTex }, uTubes: { value: tubeU },
        uMask: { value: C('#171913') }, uCopper: { value: C('#9A6A40') }, uSilk: { value: C('#8C8E86') },
      },
      vertexShader: /* glsl */`
        varying vec3 vW; varying vec2 vUv;
        void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vUv = uv; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uFill; uniform vec3 uWarm;
        uniform sampler2D uMap; uniform vec4 uTubes[8]; uniform vec3 uMask; uniform vec3 uCopper; uniform vec3 uSilk;
        varying vec3 vW; varying vec2 vUv;
        void main() {
          vec3 m = texture2D(uMap, vUv).rgb;                 // r: trace under mask, g: silkscreen, b: bare copper
          vec3 base = mix(uMask, uMask * 0.7 + uCopper * 0.18, m.r);
          base = mix(base, uSilk, m.g * 0.4);
          base = mix(base, uCopper, m.b);
          vec3 v = normalize(cameraPosition - vW);
          float ndl = max(uKeyDir.y, 0.0);
          float spec = pow(max(normalize(uKeyDir + v).y, 0.0), 70.0) * (0.15 + m.r * 0.6 + m.b * 1.6);
          vec3 c = base * (uFill * 2.0 + uKeyCol * ndl) + uKeyCol * spec * 0.3;
          float ao = 1.0;
          vec3 warm = vec3(0.0);
          for (int i = 0; i < 8; i++) {
            vec2 d = vW.xz - uTubes[i].xz;
            ao *= 1.0 - 0.62 * (1.0 - smoothstep(0.5, 1.0, length(d)));        // contact shadow round the socket
            vec2 q = vec2(d.x / 0.62, (d.y - 0.34) / 0.9);                     // the pool spills forward, out of the glass
            warm += uWarm * exp(-dot(q, q) * 1.7) * uTubes[i].w;
          }
          c *= ao;
          c += warm * (base * 2.5 + 0.035 + m.r * 0.05 + m.b * 0.35);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    const boardTop = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), boardMat);
    boardTop.rotation.x = -Math.PI / 2;
    boardTop.position.set(0, 0, bz0 + bd / 2);
    scene.add(boardTop);
    const boardBody = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.06, bd), new THREE.MeshBasicMaterial({ color: C('#0B0C0A') }));
    boardBody.position.set(0, -0.0305, bz0 + bd / 2);
    scene.add(boardBody);

    /* ---------- tubes (instanced) ---------- */
    const place = (mesh) => {
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 8; i++) {
        mesh.setMatrixAt(i, m4.makeTranslation(xs[i], 0, 0));
        mesh.setColorAt(i, new THREE.Color(0, 0, 0));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      return mesh;
    };
    const glassGeo = glassGeometry(THREE);
    const socketGeo = socketGeometry(THREE);
    const anodeH = 1.36;
    const anodeFront = new THREE.CylinderGeometry(0.43, 0.43, anodeH, 28, 1, true, -Math.PI / 2, Math.PI);
    const anodeBack = new THREE.CylinderGeometry(0.43, 0.43, anodeH, 28, 1, true, Math.PI / 2, Math.PI);
    for (const g of [anodeFront, anodeBack]) g.translate(0, GLYPH_Y0, 0);

    const inst = {
      stack: place(new THREE.InstancedMesh(stackGeo, stackMat, 8)),
      socket: place(new THREE.InstancedMesh(socketGeo, socketMat, 8)),
      glassBack: place(new THREE.InstancedMesh(glassGeo, glassMat(false), 8)),
      anodeBack: place(new THREE.InstancedMesh(anodeBack, anodeMat, 8)),
      anodeFront: place(new THREE.InstancedMesh(anodeFront, anodeMat, 8)),
      glassFront: place(new THREE.InstancedMesh(glassGeo, glassMat(true), 8)),
    };
    inst.glassBack.renderOrder = 1;
    inst.anodeBack.renderOrder = 2;
    inst.anodeFront.renderOrder = 4;
    inst.glassFront.renderOrder = 5;

    const CORE = new THREE.Color().setRGB(3.2, 0.64, 0.33);   // clips to about #FFD7A0 after the grade
    const SHEATH = C('#FF6A00', 1.5);
    const tubes = xs.map((x) => {
      const core = new THREE.Mesh(coreGeo['0'], new THREE.MeshBasicMaterial({ color: CORE.clone(), toneMapped: false }));
      const sheath = new THREE.Mesh(sheathGeo['0'], new THREE.MeshBasicMaterial({
        color: SHEATH.clone(), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      core.position.x = sheath.position.x = x;
      sheath.renderOrder = 3;
      scene.add(core, sheath);
      return { core, sheath, key: null, lit: 1, pulseAt: -1e9 };
    });

    /* ---------- post ---------- */
    const rtOpts = { type: rtType, depthBuffer: false };
    const rtScene = keep(new THREE.WebGLRenderTarget(1, 1, { type: rtType, samples: 4 }));
    const rtA1 = keep(new THREE.WebGLRenderTarget(1, 1, rtOpts)), rtB1 = keep(new THREE.WebGLRenderTarget(1, 1, rtOpts));
    const rtA2 = keep(new THREE.WebGLRenderTarget(1, 1, rtOpts)), rtB2 = keep(new THREE.WebGLRenderTarget(1, 1, rtOpts));
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = keep(new THREE.BufferGeometry());
    quadGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    quadGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
    const quad = new THREE.Mesh(quadGeo);
    quad.frustumCulled = false;
    const passVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const passMat = (fragmentShader, uniforms) => keep(new THREE.ShaderMaterial({
      uniforms, vertexShader: passVert, fragmentShader, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    }));
    const brightMat = passMat(/* glsl */`
      uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      vec3 pick(vec2 uv) { vec3 c = texture2D(tSrc, uv).rgb; float m = max(c.r, max(c.g, c.b)); return c * smoothstep(1.0, 1.6, m); }
      void main() {
        vec3 c = pick(vUv + uTexel * vec2(-1.0, -1.0)) + pick(vUv + uTexel * vec2(1.0, -1.0))
               + pick(vUv + uTexel * vec2(-1.0, 1.0)) + pick(vUv + uTexel * vec2(1.0, 1.0));
        gl_FragColor = vec4(c * 0.25 * vec3(1.0, 0.5, 0.22), 1.0);   // bloom in the neon's own orange
      }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    const blurMat = passMat(/* glsl */`
      uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
        c += (texture2D(tSrc, vUv + uDir * 1.3846153846).rgb + texture2D(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
        c += (texture2D(tSrc, vUv + uDir * 3.2307692308).rgb + texture2D(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
        gl_FragColor = vec4(c, 1.0);
      }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    const copyMat = passMat('uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }',
      { tSrc: { value: null } });
    const finalMat = passMat(/* glsl */`
      uniform sampler2D tScene; uniform sampler2D tB1; uniform sampler2D tB2;
      uniform float uBloom; uniform float uDim; uniform float uHaze;
      uniform vec3 uLift; uniform vec3 uTint; uniform vec3 uHazeCol;
      varying vec2 vUv;
      vec3 shoulder(vec3 c) { vec3 k = 0.75 + 0.25 * (1.0 - exp(-(c - 0.75) / 0.25)); return mix(c, k, step(0.75, c)); }
      vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      float hash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
      void main() {
        vec4 s = texture2D(tScene, vUv);
        vec3 bloom = (texture2D(tB1, vUv).rgb + texture2D(tB2, vUv).rgb * 0.9) * uBloom;
        float a = clamp(s.a, 0.0, 1.0);
        vec3 c = a > 1e-4 ? s.rgb / a : vec3(0.0);
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = (mx - mn) / max(mx, 1e-4);
        float neon = smoothstep(0.55, 0.85, sat) * smoothstep(0.2, 0.55, mx) * step(c.b, c.r);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 g = mix(vec3(l), c, 0.55);                   // the anime grade: colour drained to 55 percent
        g = mix(g, g * uTint, 0.12);                      // grey-green midtones
        g = uLift + g * (1.0 - uLift);                    // lifted blacks
        g = mix(g, uHazeCol, uHaze * smoothstep(0.62, 1.0, vUv.y));   // haze from the top of the frame
        c = mix(g, c, neon);                              // the neon alone keeps its colour
        vec3 prem = (c * a + bloom) * (1.0 - uDim);
        float outA = clamp(max(a, max(prem.r, max(prem.g, prem.b))), 0.0, 1.0);
        vec3 col = outA > 1e-4 ? prem / outA : vec3(0.0);
        col = toSRGB(shoulder(col)) + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0) * outA, outA);
      }`, {
      tScene: { value: rtScene.texture }, tB1: { value: rtA1.texture }, tB2: { value: rtA2.texture },
      uBloom: { value: 0.75 * o.bloom }, uDim: { value: 0 }, uHaze: { value: 0.14 },
      uLift: { value: C('#0E0F0D') }, uTint: { value: new THREE.Vector3(0.96, 1.0, 0.86) }, uHazeCol: { value: C('#D6D9CF', 0.5) },
    });
    const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quad, quadCam); };

    /* ---------- camera ---------- */
    const camera = new THREE.PerspectiveCamera(o.fov, 1, 0.1, 200);
    const target = new THREE.Vector3(0, TUBE_H / 2, 0);
    let W = 1, H = 1, dist = 20, narrow = 1;
    const az0 = rad(o.view.azimuth), el0 = rad(o.view.elevation), par = rad(o.parallax);
    const pose = { entry: 0, entryAt: -1, pTx: 0, pTy: 0, pCx: 0, pCy: 0, sT: 0, sC: 0 };

    function frameOnPoster() {
      W = Math.max(1, canvas.clientWidth);
      H = Math.max(1, canvas.clientHeight);
      renderer.setSize(W, H, false);
      const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
      rtScene.setSize(pw, ph);
      const w1 = Math.max(1, Math.round(pw / 4)), h1 = Math.max(1, Math.round(ph / 4));
      rtA1.setSize(w1, h1); rtB1.setSize(w1, h1);
      const w2 = Math.max(1, Math.round(pw / 8)), h2 = Math.max(1, Math.round(ph / 8));
      rtA2.setSize(w2, h2); rtB2.setSize(w2, h2);
      brightMat.uniforms.uTexel.value.set(1 / pw, 1 / ph);
      camera.aspect = W / H;
      narrow = Math.min(1, Math.max(0.35, (W - 300) / 700));
      // distance so the tube row spans the DOM meter's width; principal point on the meter's centre
      const cr = canvas.getBoundingClientRect(), mr = domEl.getBoundingClientRect();
      const mw = Math.max(1, mr.width);
      dist = (rowW * H) / (2 * Math.tan(rad(o.fov) / 2) * mw);
      const cx = mr.left + mr.width / 2 - cr.left, cy = mr.top + mr.height / 2 - cr.top;
      camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
      camera.near = dist / 20;
      camera.far = dist * 4;
      camera.updateProjectionMatrix();
    }

    // The real button that re-reads sits over the tubes as drawn (their projected bounds), so the click area
    // and the keyboard focus ring follow the 3/4 view, not the flat poster's box.
    const corners = [];  // each tube's silhouette on its axis plane: tight, unlike a projected 3D box
    for (const x of xs) for (const dx of [-0.5, 0.5]) for (const y of [0.05, TUBE_H]) corners.push(new THREE.Vector3(x + dx, y, 0));
    const v3 = new THREE.Vector3();
    let hitKey = '';
    function fitHit() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of corners) {
        v3.copy(c).project(camera);
        const x = ((v3.x + 1) / 2) * W, y = ((1 - v3.y) / 2) * H;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const key = [x0, y0, x1, y1].map(Math.round).join();
      if (key === hitKey) return;
      hitKey = key;
      Object.assign(hit.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    }

    function placeCamera() {
      const e = 1 - Math.pow(1 - pose.entry, 4);               // settle: quart out
      const s = pose.sC * pose.sC * (3 - 2 * pose.sC);
      const az = az0 * narrow * (1 - s) * e + pose.pCx * par * e;
      const el = (el0 * (1 - s) + rad(2) * s) * e - pose.pCy * par * 0.6 * e;
      const d = dist * (1 - 0.05 * s * e);
      camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d).add(target);
      camera.lookAt(target);
      finalMat.uniforms.uDim.value = 0.5 * s * e;
    }

    /* ---------- mirror the DOM meter ---------- */
    const glowOf = (i) => {
      const t = tubes[i];
      const p = Math.max(0, 1 - (performance.now() - t.pulseAt) / PULSE_MS);
      return { level: t.key === 'blank' ? 0 : t.lit, boost: 1 + 0.9 * p * p };
    };
    function applyTubes() {
      let pulsing = false;
      for (let i = 0; i < 8; i++) {
        const t = tubes[i];
        const { level, boost } = glowOf(i);
        if (boost > 1) pulsing = true;
        const on = level > 0 && !!coreGeo[t.key];
        t.core.visible = t.sheath.visible = on;
        if (on) {
          t.core.geometry = coreGeo[t.key];
          t.sheath.geometry = sheathGeo[t.key];
          t.core.material.color.copy(CORE).multiplyScalar(level * boost);
          t.sheath.material.color.copy(SHEATH).multiplyScalar(level * (0.85 + 0.35 * boost));
        }
        const g = on ? level * (0.8 + 0.2 * boost) : 0;
        tubeU[i].w = g * 0.75;
        for (const m of [inst.stack, inst.socket, inst.glassBack, inst.glassFront, inst.anodeBack, inst.anodeFront]) {
          m.instanceColor.setX(i, g);
        }
      }
      for (const m of Object.values(inst)) m.instanceColor.needsUpdate = true;
      return pulsing;
    }
    function mirror(snap) {
      for (let i = 0; i < 8; i++) {
        tubes[i].key = keyOf(snap.chars[i]);
        tubes[i].lit = snap.lit[i];
      }
      request();
    }
    mirror(ctrl.state());
    unsub = ctrl.subscribe(mirror);
    listen(domEl, 'meter:lock', (e) => {
      const t = tubes[e.detail?.index];
      if (t) { t.pulseAt = performance.now(); request(); }
    });

    /* ---------- render loop (on demand) ---------- */
    function draw() {
      applyTubes();
      placeCamera();
      camera.updateMatrixWorld();
      fitHit();
      renderer.setRenderTarget(rtScene);
      renderer.clear();
      renderer.render(scene, camera);
      brightMat.uniforms.tSrc.value = rtScene.texture;
      pass(brightMat, rtA1);
      blurMat.uniforms.tSrc.value = rtA1.texture; blurMat.uniforms.uDir.value.set(1 / rtA1.width, 0); pass(blurMat, rtB1);
      blurMat.uniforms.tSrc.value = rtB1.texture; blurMat.uniforms.uDir.value.set(0, 1 / rtA1.height); pass(blurMat, rtA1);
      copyMat.uniforms.tSrc.value = rtA1.texture; pass(copyMat, rtA2);
      blurMat.uniforms.tSrc.value = rtA2.texture; blurMat.uniforms.uDir.value.set(1 / rtA2.width, 0); pass(blurMat, rtB2);
      blurMat.uniforms.tSrc.value = rtB2.texture; blurMat.uniforms.uDir.value.set(0, 1 / rtA2.height); pass(blurMat, rtA2);
      pass(finalMat, null);
      renders++;
    }

    let last = 0;
    function frame(now) {
      if (dead) return;
      try {
        const t = now ?? performance.now();
        const dt = Math.min(Math.max((t - last) / 1000, 1 / 240), 1 / 30);
        last = t;
        let busy = false;
        if (pose.entryAt >= 0 && pose.entry < 1) {
          pose.entry = Math.min(1, (t - pose.entryAt) / o.settleMs);
          busy = true;
        }
        const kp = 1 - Math.exp(-dt * 5), ks = 1 - Math.exp(-dt * 7);
        pose.pCx += (pose.pTx - pose.pCx) * kp;
        pose.pCy += (pose.pTy - pose.pCy) * kp;
        pose.sC += (pose.sT - pose.sC) * ks;
        const moving = Math.abs(pose.pTx - pose.pCx) > 5e-4 || Math.abs(pose.pTy - pose.pCy) > 5e-4 || Math.abs(pose.sT - pose.sC) > 5e-4;
        if (!moving) { pose.pCx = pose.pTx; pose.pCy = pose.pTy; pose.sC = pose.sT; }
        const rolling = ctrl.state().mode !== 'idle';
        draw();
        const pulsing = tubes.some((tb) => t - tb.pulseAt < PULSE_MS + 20);
        if (!busy && !moving && !rolling && !pulsing) stop();
      } catch (err) {
        bail(err);
      }
    }
    function request() {
      if (running || dead || lost || !inView || document.hidden || !shown) return;
      running = true;
      last = performance.now();
      renderer.setAnimationLoop(frame);
    }
    function stop() {
      running = false;
      renderer?.setAnimationLoop(null);
    }

    /* ---------- input ---------- */
    listen(window, 'pointermove', (e) => {
      if (!o.parallax || !fine.matches || e.pointerType === 'touch') return;
      pose.pTx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1));
      pose.pTy = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
      request();
    }, { passive: true });
    listen(document.documentElement, 'pointerleave', () => { pose.pTx = pose.pTy = 0; request(); });
    listen(hit, 'click', () => { ctrl.reread(); });
    listen(container, 'keydown', (e) => {
      if (e.target === container && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ctrl.reread(); }
    });
    listen(document, 'visibilitychange', () => (document.hidden ? stop() : request()));
    const onMotion = () => { if (reducedMotion()) bail(null); };  // the DOM meter takes over, no animation
    const rq = matchMedia('(prefers-reduced-motion: reduce)');
    listen(rq, 'change', onMotion);
    listen(window, 'motionchange', onMotion);
    listen(canvas, 'webglcontextlost', (e) => {
      e.preventDefault();
      lost = true;
      stop();
      canvas.style.opacity = '0';
      domEl.removeAttribute('data-gl-live');
      hit.hidden = true;
    });
    listen(canvas, 'webglcontextrestored', () => {
      lost = false;
      for (const tex of [hexTex, boardTex]) tex.needsUpdate = true;
      draw();
      requestAnimationFrame(() => {
        if (dead || lost) return;
        canvas.style.opacity = '1';
        domEl.setAttribute('data-gl-live', '');
        hit.hidden = false;
      });
    });

    /* ---------- scroll: straight-on and dim as the stage leaves ---------- */
    const scrollProgress = () => {
      const r = container.getBoundingClientRect();
      return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    };
    if (o.scroll) {
      const ST = await loadScrollTrigger();
      if (ST) {
        st = ST.create({
          trigger: container, start: 'top top', end: 'bottom top',
          onUpdate: (self) => { pose.sT = self.progress; request(); },
          onRefresh: (self) => { pose.sT = self.progress; request(); },
        });
        pose.sT = st.progress;
      } else {
        listen(window, 'scroll', () => { pose.sT = scrollProgress(); request(); }, { passive: true });
        pose.sT = scrollProgress();
      }
      pose.sC = pose.sT;
    }

    /* ---------- first frame, then reveal ---------- */
    frameOnPoster();
    placeCamera();
    await renderer.compileAsync(scene, camera);
    if (isCancelled() || dead) { dispose(); return null; }
    draw();
    await new Promise((r) => requestAnimationFrame(r));
    if (dead) return null;
    shown = true;
    canvas.style.opacity = '1';
    domEl.setAttribute('data-gl-live', '');  // meter.css fades the poster out under the canvas
    hit.hidden = false;
    setTimeout(() => { if (!dead) { pose.entryAt = performance.now(); request(); } }, o.fadeMs * 0.5);

    io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (!inView) stop(); else request();
    }, { rootMargin: '80px' });
    io.observe(container);
    ro = new ResizeObserver(() => {
      frameOnPoster();
      if (!running && inView && !lost) draw();
    });
    ro.observe(container);
    ro.observe(domEl);

    let tris = 0;
    scene.traverse((m) => {
      if (!m.isMesh || !m.geometry.index) return;
      tris += (m.geometry.index.count / 3) * (m.isInstancedMesh ? m.count : 1);
    });

    return {
      live: () => shown && !dead && !lost,
      dispose,
      state: () => ({ live: shown && !dead && !lost, running, renders, dpr: renderer.getPixelRatio(), triangles: tris,
        hdr, scroll: st ? 'scrolltrigger' : o.scroll ? 'listener' : 'off' }),
    };
  } catch (err) {
    dispose();
    throw err;
  }
}

/* ================================================================================================ */
/* geometry and textures                                                                             */

function glassGeometry(THREE) {
  const pts = [new THREE.Vector2(0.5, SOCKET_H - 0.02)];
  const top = TUBE_H - 0.34;
  for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector2(0.5, SOCKET_H + ((top - SOCKET_H) * i) / 10));
  for (let i = 1; i <= 14; i++) {
    const t = (i / 14) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.0005, 0.5 * Math.cos(t)), top + 0.34 * Math.sin(t)));
  }
  return new THREE.LatheGeometry(pts, 48);
}

function socketGeometry(THREE) {
  const p = [[0.001, 0], [0.505, 0], [0.515, 0.012], [0.515, 0.17], [0.52, 0.182], [0.516, SOCKET_H], [0.49, SOCKET_H + 0.004], [0.001, SOCKET_H + 0.004]];
  return new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 48);
}

// Pointy-top honeycomb, 4 x 4 cells per tile, white wire on black (the r channel is the alpha).
function hexTexture(THREE) {
  const W = 256, H = 222, w = W / 4, r = w / Math.sqrt(3);
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff';
  g.lineWidth = 4.5;
  g.lineJoin = 'round';
  for (let row = -1; row <= 5; row++) {
    for (let col = -1; col <= 5; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * 1.5 * r;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Board artwork: r = copper trace under solder mask, g = silkscreen, b = bare copper (pads, header).
function boardTexture(THREE, { bw, bd, bz0, xs }) {
  const ppu = Math.min(170, 2048 / bw);
  const W = Math.round(bw * ppu), H = Math.round(bd * ppu);
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = c.getContext('2d');
  const X = (x) => (x + bw / 2) * ppu, Z = (z) => (z - bz0) * ppu;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalCompositeOperation = 'lighter';
  const trace = (pts, width = 0.014) => {
    g.strokeStyle = '#f00';
    g.lineWidth = width * ppu;
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.stroke();
  };
  const pad = (x, z, rr, color = '#00f') => { g.fillStyle = color; g.beginPath(); g.arc(X(x), Z(z), rr * ppu, 0, Math.PI * 2); g.fill(); };
  const lane = 0.032, laneZ0 = 0.62, left = -bw / 2 + 0.22, right = bw / 2 - 0.22;
  xs.forEach((x, i) => {
    const toLeft = i < 4, rank = toLeft ? i : 7 - i;
    for (let k = 0; k < 3; k++) {
      const x0 = x + (toLeft ? -1 : 1) * (0.05 * (1 - k)) + (toLeft ? 0.02 : -0.02);
      const z1 = laneZ0 + (rank * 3 + k) * lane;
      const dz = z1 - 0.46;
      const xb = x0 + (toLeft ? -dz : dz);                  // 45-degree bend toward the nearest edge
      trace([[x0, 0.3], [x0, 0.46], [xb, z1], [toLeft ? left : right, z1]]);
      pad(xb, z1, 0.013, '#f00');                            // a via at every bend
    }
    trace([[x, -0.3], [x, -0.52]], 0.02);                    // power, to the rails at the back
    g.strokeStyle = '#0f0';                                  // silkscreen ring round the footprint
    g.lineWidth = 0.012 * ppu;
    g.beginPath();
    g.arc(X(x), Z(0), 0.6 * ppu, Math.PI * 0.62, Math.PI * 2.38);
    g.stroke();
  });
  trace([[left, -0.52], [right, -0.52]], 0.04);
  trace([[left, -0.6], [right, -0.6]], 0.04);
  for (const ex of [left - 0.08, right + 0.08]) {             // header pads at both ends
    for (let k = 0; k < 13; k++) pad(ex + (k % 2) * 0.05 * Math.sign(ex), laneZ0 + k * lane * 1.5, 0.017);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function polylineCurveClass(THREE) {
  return class PolylineCurve extends THREE.Curve {
    constructor(points, closed) {
      super();
      this.path = closed ? [...points, points[0]] : points;
      this.cum = [0];
      for (let i = 1; i < this.path.length; i++) this.cum.push(this.cum[i - 1] + this.path[i].distanceTo(this.path[i - 1]));
      this.total = this.cum[this.cum.length - 1] || 1;
    }
    getPoint(t, target = new THREE.Vector3()) {
      const d = Math.min(Math.max(t, 0), 1) * this.total;
      let lo = 0, hi = this.cum.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.cum[mid] <= d) lo = mid; else hi = mid; }
      const seg = this.cum[hi] - this.cum[lo];
      return target.copy(this.path[lo]).lerp(this.path[hi], seg > 0 ? (d - this.cum[lo]) / seg : 0);
    }
    getPointAt(u, target) { return this.getPoint(u, target); }
    getTangentAt(u, target) { return this.getTangent(u, target); }
  };
}

function mergeIndexed(THREE, geoms) {
  let vc = 0, ic = 0;
  for (const g of geoms) { vc += g.attributes.position.count; ic += g.index.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const g of geoms) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    const src = g.index.array;
    for (let k = 0; k < src.length; k++) idx[io + k] = src[k] + vo;
    vo += g.attributes.position.count;
    io += src.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/* ================================================================================================ */
/* the numeral paths, straight from nixie.svg                                                        */

function spriteOf(domEl) {
  const use = domEl.querySelector('.nx__core, use');
  const href = use?.getAttribute('href') || use?.getAttribute('xlink:href') || '';
  return new URL(href.split('#')[0] || './nixie.svg', href ? document.baseURI : import.meta.url).href;
}

async function loadGlyphs(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`nixie.svg: HTTP ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('nixie.svg did not parse');
  const out = {};
  for (const el of doc.querySelectorAll('[data-nx]')) {
    const key = el.getAttribute('data-nx');
    const g = (out[key] ||= { parts: [], layer: Number(el.closest('[data-layer]')?.getAttribute('data-layer') ?? -1) });
    if (el.localName === 'circle') g.parts.push({ dot: ['cx', 'cy', 'r'].map((a) => Number(el.getAttribute(a))) });
    else g.parts.push({ d: el.getAttribute('d') });
  }
  if (!out['0'] || !out['9']) throw new Error('nixie.svg has no numeral paths');
  return out;
}

// Sample each subpath by arc length with the browser's own path engine (arcs included).
function sampleGlyphs(glyphs, step) {
  const NS = 'http://www.w3.org/2000/svg';
  const host = document.createElementNS(NS, 'svg');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  document.body.appendChild(host);
  const res = {};
  try {
    for (const [key, g] of Object.entries(glyphs)) {
      const item = (res[key] = { lines: [], dots: [], layer: g.layer });
      for (const part of g.parts) {
        if (part.dot) { item.dots.push(part.dot); continue; }
        for (const sub of part.d.split(/(?=M)/).map((s) => s.trim()).filter(Boolean)) {
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', sub);
          host.appendChild(p);
          const len = p.getTotalLength();
          const closed = /z\s*$/i.test(sub);
          const n = Math.max(6, Math.ceil(len / step));
          const pts = [];
          for (let i = 0; i < (closed ? n : n + 1); i++) {
            const q = p.getPointAtLength((len * i) / n);
            pts.push([q.x, q.y]);
          }
          item.lines.push({ pts, closed });
        }
      }
    }
  } finally {
    host.remove();
  }
  return res;
}

/* ================================================================================================ */
/* boot helpers (after three-hero.js)                                                                */

async function loadScrollTrigger() {
  try {
    if (window.ScrollTrigger?.create) return window.ScrollTrigger;
    const map = JSON.parse(document.querySelector('script[type="importmap"]')?.textContent || '{}').imports || {};
    if (!map.gsap || !map['gsap/ScrollTrigger']) return null;
    const [g, s] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    const gsap = g.gsap ?? g.default;
    const ST = s.ScrollTrigger ?? s.default;
    gsap.registerPlugin(ST);
    return ST;
  } catch {
    return null; // the passive listener takes over
  }
}

function canRunWebGL2(failIfMajorPerformanceCaveat) {
  try {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat });
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // do not hold one of the ~16 context slots
    return !!gl;
  } catch {
    return false;
  }
}

function afterLCP(timeout = 2500) {
  return new Promise((resolve) => {
    const idle = () => ('requestIdleCallback' in window
      ? requestIdleCallback(() => resolve(), { timeout: 2000 })
      : setTimeout(resolve, 200));
    const afterLoad = () => {
      if (!PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) { idle(); return; }
      let done = false;
      const go = () => { if (done) return; done = true; po.disconnect(); idle(); };
      const po = new PerformanceObserver((list) => { if (list.getEntries().length) go(); });
      po.observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(go, timeout);
    };
    if (document.readyState === 'complete') afterLoad();
    else addEventListener('load', afterLoad, { once: true });
  });
}
