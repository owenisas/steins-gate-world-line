/* ==========================================================================
   sound.js: opt-in WebAudio synth (DESIGN.md section 8). Every sound is synthesised.
   --------------------------------------------------------------------------
   What it does
     - The nav toggle ("Sound: off") ships `hidden` and is revealed here. aria-pressed
       carries the state; the choice persists in localStorage "sound" (try/catch).
     - No AudioContext exists until the visitor turns sound on. If they turned it on in an
       earlier visit, the context is created on their first pointer or key press here.
     - Voices:
         hum     100 Hz (Tokyo's 50 Hz mains, doubled by a transformer) + 200/300 Hz, very
                 low gain, only while the tab is visible
         relay   a 4 ms filtered-noise tick plus a damped 2-4 kHz ping, per meter:lock
         swell   filtered noise that opens and closes, per worldline:shift (rate-limited)
         dtmf    the keypad pair per dmail:key (697/770/852/941 x 1209/1336/1477 Hz)
         pluck   a plucked string (Karplus-Strong, rendered offline once per pitch and cached) per loom:jump.
                 The pitch follows the divergence value it lands on, quantised to a pentatonic scale, so
                 Operation Urd's hops step up and Verthandi's step back down; the D-mail and the choice add
                 a second string an octave below. Reverse crossings (scrolling back) play softer.
         thud    a low knock (a sine falling 92 -> 38 Hz plus muffled noise) per loom:knot
   Fallback
     No Web Audio: the toggle stays hidden. Reduced motion does not affect sound; the
     toggle glyph only animates with full motion (site.css).
   ========================================================================== */

const STORE = 'sound';
const read = () => { try { return localStorage.getItem(STORE); } catch (e) { return null; } };
const write = (v) => { try { localStorage.setItem(STORE, v); } catch (e) { /* private mode */ } };

const ROWS = [697, 770, 852, 941];
const COLS = [1209, 1336, 1477];
const PAD = ['123', '456', '789', '*0#'];
const LETTERS = { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz' };

function keyToPad(ch) {
  const c = String(ch).toLowerCase();
  if (/[0-9*#]/.test(c)) return c;
  for (const [digit, set] of Object.entries(LETTERS)) if (set.includes(c)) return digit;
  return c === ' ' ? '0' : '#';
}

export function initSound() {
  const btn = document.querySelector('[data-sound-toggle]');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!btn || !AC) return null;
  const state = btn.querySelector('[data-sound-state]');

  let on = read() === 'on';
  let ctx = null, master = null, humGain = null, noise = null;
  let lastSwell = 0, lastKey = 0, lastPluck = 0, lastThud = 0;
  const strings = new Map();          // Karplus-Strong buffers by rounded pitch

  function render() {
    btn.setAttribute('aria-pressed', String(on));
    if (state) state.textContent = on ? 'on' : 'off';
  }

  function build() {
    if (ctx) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Mains hum: three sines through a gentle low-pass, far below the rest of the mix.
    humGain = ctx.createGain();
    humGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    [[100, 1], [200, 0.35], [300, 0.12]].forEach(([f, g]) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = f; og.gain.value = g;
      o.connect(og).connect(lp);
      o.start();
    });
    lp.connect(humGain).connect(master);

    // One second of white noise, reused by the relay tick and the swell.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function hum(level) {
    if (!ctx) return;
    const t = ctx.currentTime;
    humGain.gain.cancelScheduledValues(t);
    humGain.gain.setTargetAtTime(level, t, 0.25);
  }

  async function start() {
    build();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* needs a gesture */ } }
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(0.9, t, 0.08);
    hum(document.visibilityState === 'visible' ? 0.018 : 0);
  }

  function stop() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(0, t, 0.06);
    setTimeout(() => { if (!on && ctx.state === 'running') ctx.suspend(); }, 400);
  }

  const live = () => on && ctx && ctx.state === 'running';
  const jitter = (v, amt = 0.1) => v * (1 + (Math.random() * 2 - 1) * amt);

  function relay() {
    if (!live()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = jitter(3200); bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.0012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + jitter(0.005));
    src.connect(bp).connect(g).connect(master);
    src.start(t, Math.random() * 0.5, 0.02);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.frequency.value = jitter(2600, 0.25);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.05, t + 0.002);
    og.gain.exponentialRampToValueAtTime(0.0001, t + jitter(0.045));
    o.connect(og).connect(master);
    o.start(t); o.stop(t + 0.07);
  }

  function swell() {
    if (!live()) return;
    const now = performance.now();
    if (now - lastSwell < 700) return;
    lastSwell = now;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(260, t);
    lp.frequency.exponentialRampToValueAtTime(1900, t + 0.38);
    lp.frequency.exponentialRampToValueAtTime(300, t + 1.0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.32);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
    src.connect(lp).connect(g).connect(master);
    src.start(t); src.stop(t + 1.1);
  }

  function dtmf(ch) {
    if (!live()) return;
    const now = performance.now();
    if (now - lastKey < 40) return;
    lastKey = now;
    const k = keyToPad(ch);
    const r = PAD.findIndex((row) => row.includes(k));
    if (r < 0) return;
    const c = PAD[r].indexOf(k);
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.006);
    g.gain.setValueAtTime(0.045, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    g.connect(master);
    [ROWS[r], COLS[c]].forEach((f) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(g);
      o.start(t); o.stop(t + 0.12);
    });
  }

  // Karplus-Strong: a burst of softened noise circulates in a delay line one period long; each pass averages
  // neighbouring samples (a low-pass) and loses a little energy, which is exactly how a plucked string decays.
  function stringBuffer(freq) {
    const key = Math.round(freq * 10);
    if (strings.has(key)) return strings.get(key);
    const sr = ctx.sampleRate, n = Math.floor(sr * 1.8);
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq));
    const line = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { prev += 0.45 * ((Math.random() * 2 - 1) - prev); line[i] = prev; } // a finger, not a pick
    const loss = freq < 200 ? 0.9975 : 0.996;
    let j = 0;
    for (let i = 0; i < n; i++) {
      const a = line[j], b = line[(j + 1) % N];
      d[i] = a;
      line[j] = loss * 0.5 * (a + b);
      j = (j + 1) % N;
    }
    strings.set(key, buf);
    return buf;
  }
  const PENTA = [0, 2, 4, 7, 9];
  function pitchFor(value) {
    const v = parseFloat(value);
    if (!Number.isFinite(v)) return 330;
    const semi = Math.round(v * 14);                                 // 0.337 -> 5, 0.571 -> 8, 1.130 -> 16
    const oct = Math.floor(semi / 12), deg = semi % 12;
    const q = PENTA.reduce((best, p) => (Math.abs(p - deg) < Math.abs(best - deg) ? p : best), 0);
    return 196 * Math.pow(2, oct + q / 12);                          // from G3
  }
  function pluck({ size = 1, value = null, reverse = false } = {}) {
    if (!live()) return;
    const now = performance.now();
    if (now - lastPluck < 110) return;
    lastPluck = now;
    const t = ctx.currentTime;
    const f = pitchFor(value);
    const voices = size >= 3 ? [[f, 1], [f / 2, 0.8]] : [[f, 1]];
    for (const [freq, k] of voices) {
      const src = ctx.createBufferSource();
      src.buffer = stringBuffer(freq);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
      const g = ctx.createGain();
      g.gain.value = (size >= 3 ? 0.2 : 0.13) * k * (reverse ? 0.45 : 1);
      src.connect(lp).connect(g).connect(master);
      src.start(t);
    }
  }
  function thud() {
    if (!live()) return;
    const now = performance.now();
    if (now - lastThud < 250) return;
    lastThud = now;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(92, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.32);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.3, t + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(og).connect(master);
    o.start(t); o.stop(t + 0.55);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 170;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.22, t + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(lp).connect(ng).connect(master);
    src.start(t, Math.random() * 0.5, 0.15);
  }

  btn.hidden = false;
  render();
  btn.addEventListener('click', () => {
    on = !on;
    write(on ? 'on' : 'off');
    render();
    if (on) start(); else stop();
  });

  // Saved "on" from an earlier visit: wait for this visit's first gesture (autoplay policy).
  if (on) {
    const wake = (e) => {
      if (e.target.closest && e.target.closest('[data-sound-toggle]')) return; // the click handler decides
      removeEventListener('pointerdown', wake, true);
      removeEventListener('keydown', wake, true);
      if (on) start();
    };
    addEventListener('pointerdown', wake, true);
    addEventListener('keydown', wake, true);
  }

  document.addEventListener('meter:lock', relay, true);
  document.addEventListener('worldline:shift', swell);
  document.addEventListener('dmail:key', (e) => dtmf(e.detail?.key));
  document.addEventListener('loom:jump', (e) => pluck(e.detail || {}));
  document.addEventListener('loom:knot', () => thud());
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    hum(document.visibilityState === 'visible' ? 0.018 : 0);
  });

  return { get on() { return on; }, get context() { return ctx; }, pluck, thud };
}
