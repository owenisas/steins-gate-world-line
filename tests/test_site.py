#!/usr/bin/env python3
"""
test_site.py: Playwright proof that WORLD LINE keeps every word visible and every control working.

Adapted from the awwwards-web-design skill's recipes/test_recipes.py (same self-serving http.server thread,
per-frame hidden-state monitor, rest check, wheel walk and failure scenarios), pointed at this site.

What it does
  Serves steins-gate-site/ over http (a free port, a background thread, stopped at exit) and drives
  Chromium over index.html, lab.html and 404.html, a fresh browser per run:
    normal       no console errors or failed requests; wheel-scroll the whole page; everything that carries
                 content is visible, unclipped and on the page at rest; motion-core and Lenis booted; split
                 heading masks clear every glyph; the page transition link navigates with a View Transition.
                 index: scrolling shifts the world line (worldline:shift events, the nav meter reads 1.048596
                 at the bottom and 1.130426 again at the top), the Reading Steiner blink ran, the live region
                 announced; the D-mail composer counts Shift-JIS bytes, holds 36, turns neon at the limit and
                 shifts the meter on send (El Psy Kongroo -> 1.048596); the chapter index opens from the mini
                 meter and Esc returns focus; the sound toggle creates no AudioContext until it is pressed.
                 lab: hovering a member row shows that member's world line on the mini meter.
                 404: the meter tries and fails to lock.
                 index, the loom (DESIGN 11): the WebGL loom mounts near #journal and draws non-blank frames
                 (yarn-coloured pixels on the stage), stays inside its triangle budget, releases the hero's GL
                 meter so at most one WebGL context is live, ledger rows carry no card fills (at rest, current,
                 hovered), the copy's scrim holds >= 4.5:1 (>= 3:1 for display type) against the stage, measured
                 in pixels with the copy hidden, at three scroll frames in chapters 1, 2, 3, 5, 6, 8 and 9 (and the band before each), and
                 seekTo() lands on a chapter as a pure function of scroll (no burst of loom:jump events).
    nojs         JavaScript disabled: all text visible, the composer shows its static note, JS-only controls
                 stay hidden, one h1, landmarks, title/description/OG, skip link first, headings in order.
    reduced      prefers-reduced-motion: no hidden state in any frame, no Lenis, no blink, instant shifts,
                 no View Transition animation.
    nowebgl      WebGL contexts return null: no canvas (hero or loom), meter poster and loom map stay, motion runs.
    cdn-blocked  jsDelivr, Fontshare and Google Fonts aborted: everything visible after the CSS deadline,
                 local modules (composer, sound toggle, shift) still run, no uncaught errors.
    mobile       390 x 844 touch viewport: no horizontal overflow at any scroll position, the nav items do not
                 collide, the hero meter fits inside 390 - 40px; index: the touch loom (<= 120k triangles) and the
                 scrim contrast in chapters 2, 5 and 8.
    reduced, nowebgl, nojs, cdn-blocked (index): no loom canvas, and the static loom map is visibly drawn.
    keyboard     Tab through the page: the skip link is first and moves focus into main; every stop has a
                 visible ring (>= 2px), is on screen and is not covered by the fixed nav.
    v3           DESIGN 12.8 (index; lab and 404 check their anchors and the Chapters button): newcomer by default
                 with the spoiler gate shut, the doors and the chapter menu set a reading mode that persists across
                 reloads and flips the gate; term explainers open on Enter and Space, close on Esc and give focus
                 back; J and K move chapter by chapter, ask before entering the gate, and never fire in the composer;
                 the navigator, the chapter menu and deep links land on the right chapter with the meter on that
                 chapter's line; opening a <details> keeps the loom beats and the meter in sync at the ledger rows
                 with no jump, knot or blink; the page (everything closed, 1440) is at least 35% shorter than v2.
  Reading mode: the scenarios that walk the whole story (normal, reduced, nowebgl, cdn-blocked, mobile, keyboard) run
  as a returning fan (localStorage reader=fan), so chapters 4-9 are open and every v1/v2 check still covers them;
  nojs and v3 start as a first-time newcomer (the gate shut).
  The meter (assets/meter/, tools/expand_meters.py) is built separately: when its markup or files are
  absent, the meter-specific assertions are skipped with a note instead of failing.

Options
  --scenarios normal,nojs,reduced,nowebgl,cdn-blocked,mobile,keyboard,v3   (default: all)
  --pages index,lab,404                                               (default: all)
  --out DIR     screenshots + JSON (default: .qa/ in the site folder, or $SG_QA_OUT)
  --no-shots    skip screenshots      -v  print every check      --headed  show the browser

Needs Python Playwright with Chromium (and Pillow for the pixel checks) and network access to the CDNs for every
scenario except cdn-blocked. A failed run that saw a dropped request (ERR_CONNECTION_RESET from the threaded test
server under load) is re-run once before it counts. Exits 1 on any failure.
"""
from __future__ import annotations

import argparse
import os
import atexit
import functools
import http.server
import io
import json
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import Error as PWError
from playwright.sync_api import sync_playwright

try:
    from PIL import Image, ImageChops, ImageStat
except ImportError:
    Image = ImageChops = ImageStat = None

SITE = Path(__file__).resolve().parents[1]                  # .../steins-gate-site
DEFAULT_OUT = Path(os.environ.get('SG_QA_OUT', SITE / '.qa'))   # screenshots + JSON
GPU_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
VIEWPORT = {'width': 1440, 'height': 900}
MOBILE = {'width': 390, 'height': 844}
PAGES = {'index': 'index.html', 'lab': 'lab.html', '404': '404.html'}
# The link each page's transition check clicks, and where it should land.
NAV_LINK = {'index': ('a.nav__link[href="lab.html"]', 'lab.html'),
            'lab': ('a.nav__mark', 'index.html'),
            '404': ('.lost__home a', 'index.html')}
SCENARIOS = ['normal', 'nojs', 'reduced', 'nowebgl', 'cdn-blocked', 'mobile', 'keyboard', 'v3']
# Scenarios that walk the whole story read as a returning fan: the spoiler gate opens at parse time (DESIGN 12.4).
FAN_SCENARIOS = {'normal', 'reduced', 'nowebgl', 'cdn-blocked', 'mobile', 'keyboard'}
FAN_INIT = "try { if (!sessionStorage.getItem('qa-reader-set')) { localStorage.setItem('reader', 'fan'); sessionStorage.setItem('qa-reader-set', '1'); } } catch (e) {}"
# v2's index.html height (a v2 copy at $SG_V2_BACKUP is measured live when it is there).
V2_BACKUP = Path(os.environ.get('SG_V2_BACKUP', SITE / '.qa' / 'v2-backup'))
V2_HEIGHT = {1440: 14534, 390: 16495}
CDN_HOSTS = ['https://cdn.jsdelivr.net/**', 'https://api.fontshare.com/**', 'https://cdn.fontshare.com/**',
             'https://fonts.googleapis.com/**', 'https://fonts.gstatic.com/**']
INTRO_DEADLINE_MS = 2000
DEADLINE_SLACK_MS = 900

# ---------------------------------------------------------------------------------------------
# In-page scripts (from test_recipes.py, with this site's skip rules)
# ---------------------------------------------------------------------------------------------

TRACK_SEL = ('h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,figcaption,a,button,label,pre,img,'
             '[data-reveal],[data-intro],[data-intro-item],[data-intro-media]')

HELPERS = r"""
const __desc = (el) => {
  const t = (el.getAttribute('alt') || el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
  return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.dataset.reveal ? '[reveal=' + el.dataset.reveal + ']' : '') + ' "' + t.slice(0, 44) + '"';
};
const __memo = () => {
  const op = new Map(), clip = new Map();
  const effOp = (n) => {
    if (!n || n.nodeType !== 1) return 1;
    if (op.has(n)) return op.get(n);
    const v = parseFloat(getComputedStyle(n).opacity) * effOp(n.parentElement);
    op.set(n, v); return v;
  };
  const clipOf = (n) => {
    if (!n || n.nodeType !== 1) return null;
    if (clip.has(n)) return clip.get(n);
    const cp = getComputedStyle(n).clipPath;
    const v = cp && cp !== 'none' ? cp : clipOf(n.parentElement);
    clip.set(n, v); return v;
  };
  return { effOp, clipOf };
};
const __maskedFrac = (el) => {
  let min = 1;
  for (const ln of el.querySelectorAll('.rv-line')) {
    const m = ln.parentElement, r = ln.getBoundingClientRect(), mr = m.getBoundingClientRect();
    if (r.height < 1) continue;
    const vis = Math.max(0, Math.min(r.bottom, mr.bottom) - Math.max(r.top, mr.top)) / r.height;
    min = Math.min(min, vis);
  }
  return min;
};
// Not content: closed popovers, JS-hidden controls, visually hidden text, the skip link (off screen until focused),
// SVG decoration and the meter's own internals (meter.css / meter.js own those).
// The visually-hidden pattern (absolute, clip-path inset(50%), 1px box) on the element or an ancestor: text kept
// for assistive tech on purpose (e.g. the rail labels and the table headers on phones).
const __srOnly = (el) => {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.position === 'absolute' && /inset\(50%\)/.test(cs.clipPath) && n.getBoundingClientRect().width <= 1) return true;
  }
  return false;
};
// Inside a closed <details> (the spoiler gate, "Read the full chapter"): disclosed on request, not hidden by motion.
const __closed = (el) => {
  for (let d = el.closest('details:not([open])'); d; d = d.parentElement && d.parentElement.closest('details:not([open])')) {
    const s = d.querySelector(':scope > summary');
    if (!s || !s.contains(el)) return true;
  }
  return false;
};
// A control that only exists at some widths ([data-responsive], e.g. the navigator or the Chapters tab), off here.
const __offHere = (el) => { const r = el.closest('[data-responsive]'); return !!r && getComputedStyle(r).display === 'none'; };
const __skip = (el) => !!el.closest('[hidden], [inert], .vh, .skip-link, [popover]:not(:popover-open), svg, .nx, .phone__keys[hidden], dialog:not([open])') || __srOnly(el) || __closed(el) || __offHere(el);
"""

MONITOR_JS = r"""
(() => {
  if (window.__qa) return;
  const SEL = %s;
  %s
  const qa = window.__qa = { frames: 0, events: {}, vt: null, lcp: [], shifts: [], locks: 0, blinks: 0, audio: 0 };
  addEventListener('pagereveal', (e) => {
    qa.vt = { reveal: !!e.viewTransition, types: e.viewTransition && e.viewTransition.types ? [...e.viewTransition.types] : [] };
  });
  document.addEventListener('worldline:shift', (e) => qa.shifts.push([e.detail.from, e.detail.to, e.detail.source]));
  document.addEventListener('meter:lock', () => qa.locks++, true);
  qa.gl = []; qa.loomJumps = 0; qa.loomKnots = 0; qa.chapters = [];
  const getCtx = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const c = getCtx.call(this, type, ...rest);
    if (c && /webgl/.test(String(type)) && !qa.gl.includes(c)) qa.gl.push(c);
    return c;
  };
  document.addEventListener('loom:jump', () => qa.loomJumps++);
  document.addEventListener('loom:knot', () => qa.loomKnots++);
  document.addEventListener('loom:chapter', (e) => qa.chapters.push(e.detail.id));
  const anim = Element.prototype.animate;
  Element.prototype.animate = function (...a) { if (this.hasAttribute && this.hasAttribute('data-steiner')) qa.blinks++; return anim.apply(this, a); };
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const C = window[k];
    if (typeof C !== 'function') continue;
    window[k] = class extends C { constructor(...a) { super(...a); qa.audio++; } };
  }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) qa.lcp.push([Math.round(e.startTime), e.element ? e.element.tagName : null]); })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  const meta = new WeakMap();
  const inView = (r) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 0 && r.height > 0;
  function sample() {
    const now = performance.now();
    qa.frames++;
    const { effOp, clipOf } = __memo();
    for (const el of document.querySelectorAll(SEL)) {
      if (__skip(el)) continue;
      const r = el.getBoundingClientRect();
      let info = meta.get(el);
      if (!info) {
        info = { id: __desc(el), boot: now < 1500 && scrollY < 1 && inView(r), intro: !!el.closest('[data-intro]') };
        meta.set(el, info);
      }
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const reasons = [];
      const o = effOp(el);
      if (o < 0.99) reasons.push('opacity');
      if (cs.visibility !== 'visible') reasons.push('visibility');
      const c = clipOf(el);
      if (c) reasons.push('clip-path');
      if (el.querySelector('.rv-line') && __maskedFrac(el) < 0.98) reasons.push('masked-lines');
      for (const reason of reasons) {
        const key = info.id + ' | ' + reason;
        let ev = qa.events[key];
        if (!ev) ev = qa.events[key] = { id: info.id, reason, first: Math.round(now), last: 0, count: 0,
                                         boot: info.boot, intro: info.intro, detail: reason === 'clip-path' ? c : (reason === 'opacity' ? o.toFixed(2) : '') };
        ev.last = Math.round(now); ev.count++;
      }
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
})();
""" % (json.dumps(TRACK_SEL), HELPERS)

REST_JS = r"""
(opts) => {
  %s
  const bad = [];
  const docW = document.documentElement.scrollWidth, docH = document.documentElement.scrollHeight;
  const { effOp, clipOf } = __memo();
  let n = 0;
  for (const el of document.querySelectorAll(%s)) {
    if (__skip(el)) continue;
    const isImg = el.tagName === 'IMG';
    const text = (el.textContent || '').trim();
    if (!isImg && !text && !el.querySelector('img')) continue;
    n++;
    const d = __desc(el);
    const cs = getComputedStyle(el);
    if (cs.display === 'none') { bad.push(d + ': display none'); continue; }
    const o = effOp(el);
    if (o < 0.99) bad.push(d + ': opacity ' + o.toFixed(2));
    if (cs.visibility !== 'visible') bad.push(d + ': visibility ' + cs.visibility);
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) bad.push(d + ': checkVisibility() false');
    const c = clipOf(el);
    if (c) bad.push(d + ': clip-path ' + c);
    if (el.querySelector('.rv-line, .rv-line-mask')) bad.push(d + ': still split into masked lines');
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) bad.push(d + ': zero size');
    if (isImg && (!el.complete || !el.naturalWidth)) bad.push(d + ': image not loaded');
    const L = r.left + scrollX, T = r.top + scrollY;
    if (L + r.width <= 0 || L >= docW || T + r.height <= 0 || T >= docH) { bad.push(d + ': transformed off the page'); continue; }
    if (isImg) continue;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const acs = getComputedStyle(a);
      const cx = /hidden|clip/.test(acs.overflowX), cy = /hidden|clip/.test(acs.overflowY);
      if (!cx && !cy) continue;
      const ar = a.getBoundingClientRect();
      const fx = cx ? Math.max(0, Math.min(r.right, ar.right) - Math.max(r.left, ar.left)) / Math.max(r.width, 1) : 1;
      const fy = cy ? Math.max(0, Math.min(r.bottom, ar.bottom) - Math.max(r.top, ar.top)) / Math.max(r.height, 1) : 1;
      if (fx < 0.98 || fy < 0.98) { bad.push(d + ': cut by overflow of ' + __desc(a) + ' (' + fx.toFixed(2) + ', ' + fy.toFixed(2) + ')'); break; }
    }
  }
  return { checked: n, bad };
}
""" % (HELPERS, json.dumps(TRACK_SEL))

RESIDUE_JS = r"""
() => [...document.querySelectorAll('[data-reveal], [data-reveal] > *, [data-intro], [data-intro-item], [data-intro-media]')]
  .filter((el) => !el.closest('[data-pin], [data-stack]') && !el.hasAttribute('data-parallax'))
  .map((el) => { const cs = getComputedStyle(el); return [el, cs.transform, cs.translate, cs.scale]; })
  .filter(([, t, tr, s]) => (t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') || (tr !== 'none' && tr !== '0px') || (s !== 'none' && s !== '1'))
  .map(([el, t, tr, s]) => el.tagName.toLowerCase() + ' ' + (el.textContent || '').trim().slice(0, 30) + ': ' + [t, tr, s].join(' / '))
"""

STATE_JS = r"""
() => {
  const q = (s) => document.querySelector(s);
  const navMeter = q('[data-meter-slot="nav"] [data-meter]');
  return {
    motion: document.documentElement.dataset.motion || null,
    lenisClass: document.documentElement.classList.contains('lenis'),
    lenisInstance: !!(window.__motion && window.__motion.lenis),
    motionCore: !!window.__motion,
    shiftCore: !!window.__worldline,
    meterMarkup: !!q('[data-meter]'),
    navValue: navMeter ? navMeter.dataset.value : (q('[data-meter-slot="nav"]') || {}).dataset?.reading || null,
    navReading: (q('[data-meter-slot="nav"]') || {}).dataset?.reading || null,
    heroCanvas: !!q('#meter-gl canvas'),
    loomCanvas: !!q('[data-loom] canvas'),
    loomLive: (q('#journal') || {}).dataset?.loom === 'live',
    soundHidden: q('[data-sound-toggle]') ? q('[data-sound-toggle]').hidden : null,
    keypadHidden: q('[data-keypad]') ? q('[data-keypad]').hidden : null,
    noteHidden: q('[data-nojs-note]') ? q('[data-nojs-note]').hidden : null,
    motionToggleHidden: q('[data-motion-toggle]') ? q('[data-motion-toggle]').hidden : null,
    overflowX: document.scrollingElement.scrollWidth - innerWidth,
    live: (q('[data-worldline-live]') || {}).textContent || '',
  };
}
"""

NO_WEBGL_JS = r"""
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (/^(webgl2?|experimental-webgl)$/.test(String(type))) return null;
    return orig.call(this, type, ...rest);
  };
})();
"""

SEMANTICS_JS = r"""
() => {
  const out = {};
  out.lang = document.documentElement.getAttribute('lang');
  out.h1 = document.querySelectorAll('h1').length;
  const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]);
  out.headingJumps = levels.filter((l, i) => i > 0 && l > levels[i - 1] + 1).length;
  out.firstHeading = levels[0] || null;
  out.title = document.title;
  const meta = (sel) => (document.querySelector(sel) || {}).content || '';
  out.description = meta('meta[name="description"]');
  out.ogTitle = meta('meta[property="og:title"]');
  out.ogDescription = meta('meta[property="og:description"]');
  out.ogImage = meta('meta[property="og:image"]');
  out.landmarks = ['header', 'main', 'footer', 'nav'].filter((t) => document.querySelector(t));
  const focusables = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.closest('[hidden], [popover]') && !el.disabled);
  out.firstFocusable = focusables[0] ? focusables[0].className || focusables[0].tagName : null;
  out.disclaimer = /Unofficial, non-commercial fan tribute\. Not affiliated with MAGES\., Nitroplus, White Fox or any rights holder\. Steins;Gate and all related names belong to their owners\. No official assets are used on this site\./
    .test(document.body.textContent.replace(/\s+/g, ' '));
  out.emDash = document.body.textContent.includes('—');
  out.meterMarkers = [...document.querySelectorAll('[data-meter-slot]')].map((s) => s.dataset.meterSlot);
  return out;
}
"""

FOCUS_STOP_JS = r"""
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  if (el.dataset.qaSeen) return 'loop';
  el.dataset.qaSeen = '1';
  const r = el.getBoundingClientRect(), s = getComputedStyle(el);
  const nav = document.querySelector('.nav');
  const navB = nav ? nav.getBoundingClientRect().bottom : 0;
  const inNav = !!el.closest('.nav, [popover]');
  const hit = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.x + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.y + Math.min(r.height / 2, 20))));
  const covered = !!hit && !el.contains(hit) && !hit.contains(el);
  const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || s.boxShadow !== 'none';
  return { el: el.tagName + '.' + (el.className || '').toString().split(' ')[0] + ' ' + (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 34),
    inView: r.bottom > 0 && r.top < innerHeight && r.width > 0,
    underNav: covered && !!(hit.closest && hit.closest('.nav')) && !inNav,
    covered, ring, size: [Math.round(r.width), Math.round(r.height)] };
}
"""

# ---------------------------------------------------------------------------------------------
# Static server
# ---------------------------------------------------------------------------------------------

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def start_server():
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(SITE)))
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, name='site-http', daemon=True).start()
    stopped = []

    def stop():
        if stopped:
            return
        stopped.append(True)
        httpd.shutdown()
        httpd.server_close()

    atexit.register(stop)
    return httpd, stop


# ---------------------------------------------------------------------------------------------
# Run bookkeeping
# ---------------------------------------------------------------------------------------------

class Run:
    def __init__(self, scenario, page, out, shots, verbose):
        self.scenario, self.page, self.out, self.shots, self.verbose = scenario, page, out, shots, verbose
        self.checks, self.notes = [], []
        self.n = 0
        self.console, self.pageerrors, self.failed = [], [], []
        self.secs = 0.0

    def check(self, name, ok, detail=''):
        self.checks.append((name, bool(ok), detail))
        if self.verbose or not ok:
            print(f"    {'PASS' if ok else 'FAIL'} {name}" + (f'  [{detail}]' if detail not in ('', None) else ''))

    def skip(self, name, why):
        self.notes.append(f'skipped: {name} ({why})')
        if self.verbose:
            print(f'    SKIP {name}  [{why}]')

    def shot(self, pg, label=''):
        if not self.shots:
            return None
        self.n += 1
        path = self.out / f'{self.scenario}-{self.page}-{self.n}.png'
        try:
            pg.screenshot(path=str(path))
        except PWError as err:
            self.notes.append(f'screenshot {self.n} failed: {err}')
            return None
        if label:
            self.notes.append(f'{path.name}: {label}')
        return path

    @property
    def ok(self):
        return bool(self.checks) and all(ok for _, ok, _ in self.checks)

    def attach(self, pg):
        pg.on('console', lambda m: self.console.append((m.type, m.text, pg.url)))
        pg.on('pageerror', lambda e: self.pageerrors.append(f'{e} @ {pg.url}'))
        pg.on('requestfailed', lambda r: self.failed.append(f'{r.url[:120]} ({r.failure})'))
        pg.on('response', lambda r: r.status >= 400 and self.failed.append(f'{r.url[:120]} (HTTP {r.status})'))
        pg.on('crash', lambda: self.pageerrors.append('renderer crashed'))


# ---------------------------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------------------------

STEADY_JS = r"""
() => new Promise((resolve) => {
  const g = window.__motion && window.__motion.gsap;
  if (g) g.ticker.sleep();
  let last = -1, same = 0;
  const tick = () => {
    if (scrollY === last) { if (++same >= 2) return resolve(!!g); } else { same = 0; last = scrollY; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => resolve(!!g), 1000);
})
"""


def scroll_info(pg):
    return pg.evaluate('() => [Math.round(scrollY), Math.max(0, document.scrollingElement.scrollHeight - innerHeight), innerHeight]')


def steady_shot(pg, run, label):
    frozen = False
    try:
        if run.scenario == 'nojs':
            last = None
            for _ in range(20):
                y = scroll_info(pg)[0]
                if y == last:
                    break
                last = y
                time.sleep(0.05)
        else:
            frozen = pg.evaluate(STEADY_JS)
        return run.shot(pg, label)
    finally:
        if frozen:
            pg.evaluate('() => window.__motion.gsap.ticker.wake()')


def wheel_walk(pg, run, viewport, step=260, pause=0.05, max_steps=1200, label='scroll', shots=True):
    pg.mouse.move(viewport['width'] * 0.5, viewport['height'] * 0.55)
    y, maxy, vh = scroll_info(pg)
    last_shot, still, steps = y, 0, 0
    for steps in range(1, max_steps + 1):
        pg.mouse.wheel(0, step)
        time.sleep(pause)
        y, maxy, vh = scroll_info(pg)
        if shots and y - last_shot >= vh * 0.85:
            steady_shot(pg, run, f'{label} y={y}')
            last_shot = scroll_info(pg)[0]
        if y >= maxy - 2:
            still += 1
            if still >= 10:
                break
        else:
            still = 0
    if shots and y > last_shot + 10:
        steady_shot(pg, run, f'{label} y={y} (bottom)')
    return y >= maxy - 2, steps, y, maxy


def mask_clearance_check(pg, run):
    """Clear the cut: re-split every split-able heading at rest and require identical pixels."""
    if Image is None:
        run.check('split masks clear every glyph at rest', True, 'Pillow missing: skipped')
        return
    sels = pg.evaluate("""() => [...document.querySelectorAll('h1[data-intro], h2[data-reveal="lines"], h3[data-reveal="lines"]')]
        .map((e, i) => { e.dataset.qaMask = i; return `[data-qa-mask="${i}"]`; })""")
    worst = []
    for sel in sels:
        pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{ block: 'center' }})")
        time.sleep(1.4)  # let any world-line shift (roll + blink) this scroll caused finish
        box = pg.evaluate(f"""() => {{ const r = document.querySelector('{sel}').getBoundingClientRect();
            return {{ x: Math.max(0, r.left - 10), y: Math.max(0, r.top - 30), width: Math.min(innerWidth - Math.max(0, r.left - 10), r.width + 20), height: r.height + 60 }}; }}""")
        a = Image.open(io.BytesIO(pg.screenshot(clip=box))).convert('L')
        n = pg.evaluate(f"""() => {{ window.__qaSplit = window.__motion.SplitText.create(document.querySelector('{sel}'),
            {{ type: 'lines', mask: 'lines', linesClass: 'rv-line', aria: 'auto' }}); return window.__qaSplit.lines.length; }}""")
        time.sleep(0.05)
        b = Image.open(io.BytesIO(pg.screenshot(clip=box))).convert('L')
        pg.evaluate("() => { window.__qaSplit.revert(); window.__qaSplit = null; }")
        diff = ImageChops.difference(a, b)
        worst.append((sel, n, diff.getextrema()[1], ImageStat.Stat(diff).mean[0]))
    bad = [w for w in worst if w[2] > 40 or w[3] > 0.2]
    run.check(f'split masks clear every glyph at rest ({len(worst)} headings, pixel-identical to unsplit)', not bad,
              '; '.join(f'{s} lines={n} maxdiff={m} MAD={d:.2f}' for s, n, m, d in (bad or worst)))


def rest_checks(pg, run, residue=True):
    res = pg.evaluate(REST_JS, {})
    run.check(f"all content visible, unclipped, on the page ({res['checked']} elements)", not res['bad'], '; '.join(res['bad'][:8]))
    if residue:
        left = pg.evaluate(RESIDUE_JS)
        run.check('no transforms left on revealed/intro elements', not left, '; '.join(left[:6]))
    st = pg.evaluate(STATE_JS)
    run.check('no horizontal page overflow', st['overflowX'] <= 1, f"{st['overflowX']}px")
    return st


def monitor(pg):
    return pg.evaluate('() => window.__qa ? { frames: window.__qa.frames, events: Object.values(window.__qa.events), vt: window.__qa.vt, lcp: window.__qa.lcp, shifts: window.__qa.shifts, locks: window.__qa.locks, blinks: window.__qa.blinks, audio: window.__qa.audio } : null')


def nav_value(pg):
    return pg.evaluate("""() => { const m = document.querySelector('[data-meter-slot="nav"] [data-meter]');
        return m ? m.dataset.value : document.querySelector('[data-meter-slot="nav"]').dataset.reading; }""")


def wait_value(pg, want, timeout=4.0):
    t0 = time.time()
    v = None
    while time.time() - t0 < timeout:
        v = nav_value(pg)
        if v == want:
            return v
        time.sleep(0.1)
    return v


def semantics_check(pg, run):
    s = pg.evaluate(SEMANTICS_JS)
    run.check('lang="en"', s['lang'] == 'en', s['lang'])
    run.check('exactly one h1, and it is the first heading', s['h1'] == 1 and s['firstHeading'] == 1, f"h1={s['h1']} first=h{s['firstHeading']}")
    run.check('headings never skip a level', s['headingJumps'] == 0, str(s['headingJumps']))
    run.check('title, description, og:title/description/image present',
              all([s['title'], s['description'], s['ogTitle'], s['ogDescription'], s['ogImage']]), json.dumps({k: bool(s[k]) for k in ('title', 'description', 'ogTitle', 'ogDescription', 'ogImage')}))
    run.check('landmarks: header, nav, main, footer', set(s['landmarks']) >= {'header', 'nav', 'main', 'footer'}, str(s['landmarks']))
    run.check('skip link is the first focusable element', s['firstFocusable'] == 'skip-link', str(s['firstFocusable']))
    run.check('footer carries the exact disclaimer (DESIGN 0)', s['disclaimer'])
    run.check('no em dashes in the copy', not s['emDash'])
    want = {'index': {'nav', 'hero', 'primer', 'footer'}, 'lab': {'nav', 'footer'}, '404': {'nav', '404', 'footer'}}[run.page]
    run.check(f'meter slots present: {sorted(want)}', set(s['meterMarkers']) == want, str(s['meterMarkers']))


def navigate_check(pg, run, scenario, js=True):
    sel, dest = NAV_LINK[run.page]
    link = pg.locator(sel).first
    link.scroll_into_view_if_needed()
    time.sleep(0.3)
    link.click()
    try:
        pg.wait_for_url(f'**/{dest}', timeout=10000)
        arrived = True
    except PWError:
        arrived = False
    time.sleep(0.35)
    run.shot(pg, f'after clicking {sel} (mid-transition)')
    run.check(f'page link navigates to {dest}', arrived, pg.url)
    if not arrived:
        return
    pg.wait_for_load_state('load')
    time.sleep(2.6 if scenario == 'cdn-blocked' else 1.8)
    if js:
        mon = monitor(pg) or {}
        vt = mon.get('vt')
        if scenario == 'reduced':
            run.check('no View Transition under reduced motion', not (vt and vt['reveal']), str(vt))
        elif scenario in ('normal', 'nowebgl'):
            run.check('cross-document View Transition ran', bool(vt and vt['reveal']), str(vt))
    res = pg.evaluate(REST_JS, {})
    h1 = pg.evaluate("() => { const h = document.querySelector('h1'); return { clip: getComputedStyle(h).clipPath, text: h.textContent.trim().slice(0, 40) }; }")
    run.check('destination page: h1 visible and unclipped', h1['clip'] == 'none', str(h1))
    run.check('destination page: content visible', not res['bad'], '; '.join(res['bad'][:5]))
    run.shot(pg, f'destination {dest} at rest')


# ---- site-specific interaction checks ------------------------------------------------------------

def shift_checks(pg, run, meter_ok):
    """index, normal/reduced: the scroll walk shifted the world line; top/bottom values; live region."""
    mon = monitor(pg) or {}
    shifts = mon.get('shifts', [])
    tos = [s[1] for s in shifts]
    run.check('scrolling shifted the world line (worldline:shift events)', len(shifts) >= 8,
              f'{len(shifts)} events, first {tos[:6]}')
    must = ['0.571024', '0.337187', '0.409431', '0.571046', '1.130205', '1.048596']
    run.check('every chapter value was reached while scrolling', all(v in tos for v in must), f'missing {[v for v in must if v not in tos]}')
    v = wait_value(pg, '1.048596')
    run.check('nav meter reads 1.048596 at the bottom of the journal', v == '1.048596', str(v))
    live = pg.evaluate("() => document.querySelector('[data-worldline-live]').textContent")
    run.check('live region announced a shift', live.startswith('World line shifted to '), live)
    if run.scenario == 'reduced':
        run.check('no Reading Steiner blink under reduced motion', mon.get('blinks', 0) == 0, str(mon.get('blinks')))
        run.check('no per-tube roll under reduced motion (instant swaps)', mon.get('locks', 0) == 0, str(mon.get('locks')))
    else:
        run.check('the Reading Steiner blink ran', mon.get('blinks', 0) >= 1, str(mon.get('blinks')))
        if meter_ok:
            run.check('the nav meter rolled and locked tube by tube', mon.get('locks', 0) >= 7, str(mon.get('locks')))
        else:
            run.skip('meter lock events', 'meter markup or meter.js absent')
    # Scroll back to the top: the line returns to 1.130426.
    pg.evaluate("() => (window.__motion && window.__motion.scrollTo) ? window.__motion.scrollTo(0, { immediate: true, force: true }) : window.scrollTo(0, 0)")
    time.sleep(0.4)
    pg.evaluate("() => window.scrollTo(0, 0)")
    v = wait_value(pg, '1.130426', 5)
    run.check('scrolling back to the top shifts back to 1.130426', v == '1.130426', str(v))


def ledger_walk(pg, run):
    """index: every ledger row (chapter 3 and its mirror in chapter 6) shifts the meter as it crosses the centre."""
    for chapter, rows in (('ch-03', ['0.571015', '0.523299', '0.456903', '0.409420', '0.337187']),
                          ('ch-06', ['0.456914', '0.523307', '0.571046'])):
        seen = []
        for value in rows:
            pg.evaluate(f"""() => {{ const r = document.querySelector('#{chapter} [data-worldline="{value}"]');
                const y = r.getBoundingClientRect().top + scrollY - innerHeight * 0.5 + 4;
                (window.__motion && window.__motion.scrollTo) ? window.__motion.scrollTo(y, {{ immediate: true, force: true }}) : window.scrollTo(0, y); }}""")
            got = wait_value(pg, value, 3)
            cur = pg.evaluate(f"() => document.querySelector('#{chapter} [data-worldline=\"{value}\"]').classList.contains('is-current')")
            seen.append((value, got, cur))
        run.check(f'{chapter} ledger: each row shifts the meter and is marked current as it crosses the centre',
                  all(v == g and c for v, g, c in seen), str(seen))
        if chapter == 'ch-06':
            run.shot(pg, 'mirrored ledger, last row current')


def dmail_checks(pg, run):
    pg.evaluate("document.getElementById('dmail').scrollIntoView({ block: 'center' })")
    time.sleep(0.8)
    count = lambda: pg.evaluate("() => +document.querySelector('[data-byte-count]').textContent")
    full = lambda: pg.evaluate("() => document.getElementById('dmail-count').classList.contains('is-full')")
    val = lambda: pg.evaluate("() => document.getElementById('dmail-msg').value")
    ta = pg.locator('#dmail-msg')
    ta.fill('ｱｲｳ')
    run.check('half-width katakana count 1 byte each', count() == 3, str(count()))
    ta.fill('日本語')
    run.check('full-width characters count 2 bytes each', count() == 6, str(count()))
    ta.fill('')
    ta.click()
    pg.keyboard.type('D' * 40, delay=4)
    run.check('typing past 36 bytes is held at 36', len(val()) == 36 and count() == 36, f'len={len(val())} count={count()}')
    run.check('the counter turns neon at 36 / 36', full())
    time.sleep(0.5)  # the colour eases in over --dur-2
    color = pg.evaluate("() => getComputedStyle(document.getElementById('dmail-count')).color")
    run.check('neon counter colour is --nx-glow', color == 'rgb(255, 106, 0)', color)
    ta.fill('あ' * 20)
    run.check('pasted full-width text is trimmed to 18 characters (36 bytes)', len(val()) == 18 and count() == 36, f'len={len(val())} count={count()}')
    pg.locator('[data-key="7"]').click()
    run.check('keypad cannot push past the limit', count() == 36, str(count()))
    ta.fill('')
    pg.locator('[data-key="4"]').click()
    pg.locator('[data-key="2"]').click()
    run.check('keypad types digits into the message', val() == '42', val())
    ta.fill('El Psy Kongroo')
    pg.select_option('#dmail-hours', '12')
    run.shot(pg, 'composer before send')
    pg.locator('.phone__send').click()
    time.sleep(0.2)
    resp = pg.evaluate("() => document.getElementById('dmail-response').textContent")
    run.check('send answers on the phone screen', resp.startswith('Sent 12h back. World line 1.048596.') and resp.endswith('Only you remember.'), resp)
    v = wait_value(pg, '1.048596', 3)
    run.check('El Psy Kongroo lands on 1.048596', v == '1.048596', str(v))
    ta.fill('tutturu')
    pg.locator('.phone__send').click()
    v = wait_value(pg, '0.337187', 3)
    run.check('sending "tutturu" shifts the nav meter to 0.337187', v == '0.337187', str(v))
    ta.fill('beta test')
    pg.locator('.phone__send').click()
    time.sleep(0.2)
    resp2 = pg.evaluate("() => document.getElementById('dmail-response').textContent")
    run.check('"beta" lands on a 1.xxxxxx line', ' World line 1.' in resp2, resp2)
    ta.fill('beta test')
    pg.locator('.phone__send').click()
    time.sleep(0.2)
    resp3 = pg.evaluate("() => document.getElementById('dmail-response').textContent")
    run.check('the hash is deterministic (same message, same line)', resp3 == resp2, f'{resp2} | {resp3}')
    ta.fill('faris')
    pg.locator('.phone__send').click()
    time.sleep(1.4)
    faris = pg.evaluate("""() => { const m = document.querySelector('[data-meter-slot="nav"] [data-meter]');
        return { resp: document.getElementById('dmail-response').textContent, value: m ? m.dataset.value : null,
                 first: m ? m.querySelector('.nx__tube').dataset.char : null }; }""")
    run.check('Faris: -0.275349 with the first tube dark', '-0.275349' in faris['resp'] and (faris['first'] in ('blank', None)), str(faris))
    run.shot(pg, 'composer after send')
    url = pg.url
    run.check('sending never navigates or submits over the network', '?' not in url.split('#')[0], url)


def index_popover_checks(pg, run):
    pg.evaluate("() => window.scrollTo(0, 0)")
    time.sleep(0.5)
    trig = pg.locator('[data-index-trigger]')
    trig.click()
    time.sleep(0.8)
    st = pg.evaluate("() => ({ open: document.getElementById('chapter-index').matches(':popover-open'), focus: document.activeElement && document.activeElement.closest('#chapter-index') ? document.activeElement.textContent.trim().slice(0, 30) : null })")
    run.check('the mini meter opens the chapter index', st['open'], str(st))
    run.check('focus moves into the chapter index', bool(st['focus']), str(st))
    run.shot(pg, 'chapter index open')
    pg.keyboard.press('Escape')
    time.sleep(0.5)
    st2 = pg.evaluate("() => ({ open: document.getElementById('chapter-index').matches(':popover-open'), back: document.activeElement === document.querySelector('[data-index-trigger]') })")
    run.check('Esc closes the index and returns focus to the meter', not st2['open'] and st2['back'], str(st2))


def sound_checks(pg, run):
    mon = monitor(pg) or {}
    run.check('no AudioContext exists before sound is switched on', mon.get('audio', 0) == 0, str(mon.get('audio')))
    btn = pg.locator('[data-sound-toggle]')
    run.check('sound toggle visible with aria-pressed=false', btn.is_visible() and btn.get_attribute('aria-pressed') == 'false')
    btn.click()
    time.sleep(0.3)
    on = pg.evaluate("() => ({ pressed: document.querySelector('[data-sound-toggle]').getAttribute('aria-pressed'), label: document.querySelector('[data-sound-state]').textContent, stored: (() => { try { return localStorage.getItem('sound'); } catch (e) { return 'n/a'; } })(), audio: window.__qa.audio })")
    run.check('pressing it turns sound on (aria-pressed, label, localStorage, one AudioContext)',
              on['pressed'] == 'true' and on['label'] == 'on' and on['stored'] == 'on' and on['audio'] == 1, str(on))
    btn.click()
    time.sleep(0.3)
    off = pg.evaluate("() => ({ pressed: document.querySelector('[data-sound-toggle]').getAttribute('aria-pressed'), stored: localStorage.getItem('sound') })")
    run.check('pressing again turns it off and remembers', off == {'pressed': 'false', 'stored': 'off'}, str(off))


def lab_member_checks(pg, run, meter_ok):
    pg.locator('#members').scroll_into_view_if_needed()
    time.sleep(0.8)
    row = pg.locator('tr[data-worldline="0.337187"]')
    row.hover()
    v = wait_value(pg, '0.337187', 3)
    run.check("hovering Mayuri's row shows 0.337187 on the mini meter", v == '0.337187', str(v))
    run.shot(pg, 'member row hovered')
    pg.mouse.move(5, 500)
    v2 = wait_value(pg, '1.048596', 3)
    run.check('leaving the table returns the meter to 1.048596', v2 == '1.048596', str(v2))
    pg.locator('tr[data-worldline="0.409420"]').focus()
    v3 = wait_value(pg, '0.409420', 3)
    run.check("focusing Faris's row (keyboard) shows 0.409420", v3 == '0.409420', str(v3))


def lost_checks(pg, run, meter_ok, reduced):
    if not meter_ok:
        run.skip('404 meter fail()', 'meter markup or meter.js absent')
        return
    want = '-.------' if reduced else '?.??????'
    time.sleep(0.3 if reduced else 4.6)
    v = pg.evaluate("() => { const m = document.querySelector('[data-meter-slot=\"404\"] [data-meter]'); return m ? m.dataset.value : null; }")
    run.check(f'the 404 meter never locks a reading (shows {want})', v == want, str(v))


# ---- the loom (DESIGN 11) -----------------------------------------------------------------------------------

def jump_to(pg, y):
    """Scroll to y at once (Lenis when it runs, native otherwise) and let the frame settle."""
    pg.evaluate(f"""() => {{ const m = window.__motion;
        if (m && m.lenis) m.scrollTo({y}, {{ immediate: true, force: true }}); else window.scrollTo(0, {y}); }}""")


def chapter_y(pg, chapter, at):
    return pg.evaluate(f"""() => {{ const el = document.getElementById('{chapter}'); let y = 0;
        for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return Math.max(0, y - innerHeight * {at}); }}""")


def yarn_fraction(png, box, dsf):
    """Share of pixels in box that are yarn-coloured (muted red or slate blue), far from either ground."""
    if Image is None:
        return None
    im = Image.open(io.BytesIO(png)).convert('RGB')
    x0, y0, x1, y1 = [int(v * dsf) for v in box]
    im = im.crop((x0, y0, x1, y1)).resize((max(1, (x1 - x0) // 3), max(1, (y1 - y0) // 3)))
    px = list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata())
    yarn = sum(1 for r, g, b in px if (r - b > 28 and r - g > 18) or (b - r > 16 and b - g > 2 and b > 40))
    return yarn / max(1, len(px))


def loom_checks(pg, run, touch=False):
    """index, normal and mobile: the WebGL loom mounts, draws, keeps its budget and owns the only context."""
    # desktop: chapter 3 on screen; phones: the window between chapters 2 and 3, where the cord rides about a quarter
    # of the way down (each chapter's backing hides the stage elsewhere)
    jump_to(pg, chapter_y(pg, 'ch-03', 0.46 if touch else 0.3))
    try:
        pg.wait_for_function('() => !!(window.__loom && window.__loom.live)', timeout=15000)
        live = True
    except PWError:
        live = False
    st = pg.evaluate('() => window.__loom ? window.__loom.state() : null') or {}
    run.check('the WebGL loom mounted when #journal came near (canvas in [data-loom], #journal[data-loom=live])',
              live and pg.evaluate("() => !!document.querySelector('[data-loom] canvas') && document.getElementById('journal').dataset.loom === 'live'"),
              json.dumps(st)[:240])
    if not live:
        return
    time.sleep(1.4)
    st = pg.evaluate('() => window.__loom.state()')
    run.check('the loom renders frames (render on change + idle sway)', st['renders'] > 3, f"renders={st['renders']}")
    budget = 120000 if touch else 250000
    run.check(f"triangle budget: {st['triangles']} <= {budget} ({'touch' if touch else 'desktop'}; {st['threads']} threads x {st['segments']} segments)",
              st['triangles'] <= budget and st['coarse'] == touch, json.dumps(st)[:240])
    run.check('loom DPR <= 1.5', st['dpr'] <= 1.5, str(st['dpr']))
    vw, vh = pg.evaluate('() => [innerWidth, innerHeight]')
    dsf = pg.evaluate('() => devicePixelRatio')
    box = (vw * (0.02 if touch else 0.5), vh * 0.12, vw * 0.98, vh * (0.55 if touch else 0.85))
    frac = yarn_fraction(pg.screenshot(), box, dsf)
    run.check('the loom frame is not blank (yarn-coloured pixels on the stage)', frac is None or frac > 0.02,
              'Pillow missing' if frac is None else f'{frac:.1%} of the stage region')
    gl = pg.evaluate('() => window.__qa ? window.__qa.gl.map((g) => g.isContextLost()) : null')
    active = sum(1 for lost in (gl or []) if not lost)
    run.check('at most one active WebGL context after the loom starts', gl is not None and active <= 1,
              f'{active} active of {len(gl or [])} created')
    run.check("the hero's GL meter was released when the loom started", not pg.evaluate("() => !!document.querySelector('#meter-gl canvas')"))
    run.shot(pg, 'loom live, chapter 3')


def map_checks(pg, run, js=True):
    """index, reduced / nowebgl / nojs / cdn-blocked: no loom canvas; the static loom map is the stage."""
    y = chapter_y(pg, 'ch-02', 0.3)
    if js:
        jump_to(pg, y)
    else:
        pg.evaluate(f'() => window.scrollTo(0, {y})')
    time.sleep(1.2)
    st = pg.evaluate("""() => { const svg = document.querySelector('.run--day .loom-map svg'); const cs = svg && getComputedStyle(svg.parentElement);
        const r = svg ? svg.getBoundingClientRect() : null;
        return { canvas: !!document.querySelector('[data-loom] canvas'), live: document.getElementById('journal').dataset.loom === 'live',
                 vis: cs ? cs.visibility : null, op: cs ? +cs.opacity : null, box: r ? [r.left, r.top, r.right, r.bottom] : null }; }""")
    run.check('no loom canvas (the WebGL loom stays off)', not st['canvas'] and not st['live'], str(st))
    ok_box = bool(st['box']) and st['box'][2] - st['box'][0] > 100 and st['box'][3] - st['box'][1] > 300
    run.check('the static loom map is the visible stage', st['vis'] == 'visible' and (st['op'] or 0) > 0.99 and ok_box, str(st))
    if ok_box:
        dsf = pg.evaluate('() => devicePixelRatio')
        b = st['box']
        frac = yarn_fraction(pg.screenshot(), (max(0, b[0]), max(0, b[1]), b[2], min(b[3], pg.evaluate('innerHeight'))), dsf)
        run.check('the loom map is drawn (its <use> resolved: yarn-coloured strands on screen)', frac is None or frac > 0.03,
                  'Pillow missing' if frac is None else f'{frac:.1%} of the map box')
    run.shot(pg, 'static loom map, chapter 2')


LEDGER_JS = r"""() => [...document.querySelectorAll('.ledger__row')].map((r) => { const cs = getComputedStyle(r);
    return { v: r.dataset.worldline, bg: cs.backgroundColor, img: cs.backgroundImage, shadow: cs.boxShadow,
             border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join(' '),
             cur: r.classList.contains('is-current') }; })"""


def ledger_card_check(pg, run):
    """Ledger rows are annotations: no filled backgrounds, no boxes, at rest, when current, and when hovered."""
    def bad_rows():
        rows = pg.evaluate(LEDGER_JS)
        clear = lambda c: c in ('transparent', 'rgba(0, 0, 0, 0)') or c.replace(' ', '').endswith(',0)')
        return rows, [r for r in rows if not clear(r['bg']) or r['img'] != 'none' or r['shadow'] != 'none' or r['border'] != '0px 0px 0px 0px']
    jump_to(pg, chapter_y(pg, 'ch-03', -0.2))
    time.sleep(0.8)
    row = pg.locator('#ch-03 .ledger__row[data-worldline="0.456903"]')
    row.hover()
    time.sleep(0.5)
    rows, bad = bad_rows()
    cur = sum(1 for r in rows if r['cur'])
    run.check(f'ledger rows have no card backgrounds or boxes ({len(rows)} rows, {cur} current, one hovered)', rows and not bad,
              '; '.join(f"{r['v']}: bg={r['bg']} img={r['img'][:30]} shadow={r['shadow'][:30]} border={r['border']}" for r in bad[:4]))
    lit = pg.evaluate("""() => window.__loom && window.__loom.live ? !!document.querySelector('#ch-03 .ledger__row.is-lit[data-worldline="0.456903"]') : null""")
    if lit is not None:
        run.check("hovering a ledger row lights that row's thread (row marked is-lit, loom highlight on)", lit)
    pg.mouse.move(5, 5)


TEXT_RECTS_JS = r"""(sel) => {
    const root = document.querySelector(sel); const out = [];
    // any CSS colour (oklab(), color(), color-mix results) -> sRGB bytes, through a 1x1 canvas
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
    // the chapter and the shift band just before it (it sits on the same scrim)
    const band = root.previousElementSibling && root.previousElementSibling.matches('.band') ? root.previousElementSibling : null;
    for (const scope of [band, root].filter(Boolean)) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (el.closest('.vh, [hidden]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible') continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const b of r.getClientRects()) {
        if (b.top < 64 || b.bottom > innerHeight - 2 || b.width < 3 || b.height < 6) continue;
        out.push({ x: b.left, y: b.top, w: b.width, h: b.height, color: rgb(cs.color), size: parseFloat(cs.fontSize), weight: +cs.fontWeight || 400,
                   text: n.textContent.trim().slice(0, 24) });
      }
    }
    }
    return out; }"""
HIDE_COPY = "#journal .chapter__grid, #journal .band > * { visibility: hidden !important; }"


def _lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def _ratio(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def contrast_checks(pg, run, chapters, positions=(0.62, 0.32, 0.02), touch=False):
    """Scrim contrast, in pixels: for each chapter and scroll frame, record the copy's line boxes and colours, hide
    the copy, screenshot the stage and scrim behind it, and take the worst ratio over every sampled pixel."""
    if Image is None:
        run.check('scrim contrast (Pillow missing: skipped)', True)
        return
    dsf = pg.evaluate('() => devicePixelRatio')
    for ch in chapters:
        worst = (99.0, '')
        for at in positions:
            jump_to(pg, chapter_y(pg, ch, at))
            time.sleep(1.1)
            rects = pg.evaluate(TEXT_RECTS_JS, f'#{ch}')
            if not rects:
                continue
            pg.add_style_tag(content=HIDE_COPY)
            pg.evaluate('() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
            im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
            pg.evaluate("() => document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('#journal .chapter__grid, #journal .band > *')) s.remove(); })")
            W, H = im.size
            for r in rects:
                rgb = r['color']
                large = r['size'] >= 24 or (r['size'] >= 18.66 and r['weight'] >= 700)
                need = 3.0 if large else 4.5
                for yy in range(int((r['y'] + 1) * dsf), int((r['y'] + r['h'] - 1) * dsf), max(2, int(3 * dsf))):
                    for xx in range(int((r['x'] + 1) * dsf), int((r['x'] + r['w'] - 1) * dsf), max(2, int(4 * dsf))):
                        if 0 <= xx < W and 0 <= yy < H:
                            q = _ratio(rgb, im.getpixel((xx, yy))) / need * 4.5    # normalised to the 4.5 scale
                            if q < worst[0]:
                                worst = (q, f"'{r['text']}' {r['size']:.0f}px at frame {at}: {_ratio(rgb, im.getpixel((xx, yy))):.2f}:1 (needs {need})")
        run.check(f'{ch}: copy over the loom holds contrast on the worst sampled frame ({"390" if touch else "1440"})',
                  worst[0] >= 4.5, worst[1])


def nav_checks(pg, run):
    """The loom is a pure function of scroll: seekTo lands on the destination state without replaying beats."""
    has = pg.evaluate('() => !!(window.__journal && window.__loom && window.__loom.live)')
    if not has:
        run.skip('seekTo / loom:chapter', 'loom or navigation hooks not live')
        return
    jump_to(pg, 0)
    time.sleep(0.8)
    pg.evaluate('() => { window.__qa.loomJumps = 0; window.__qa.loomKnots = 0; }')
    pg.evaluate("() => window.__journal.seekTo('ch-08', { immediate: true })")
    time.sleep(1.6)
    got = pg.evaluate('() => ({ ch: window.__journal.chapter, jumps: window.__qa.loomJumps, knots: window.__qa.loomKnots, s: window.__loom.state().s, seen: window.__qa.chapters.slice(-3) })')
    run.check('seekTo("ch-08") lands on chapter 8, announces it (loom:chapter) and coalesces (no burst of jump/knot events)',
              got['ch'] == 'ch-08' and 'ch-08' in got['seen'] and got['jumps'] + got['knots'] <= 1, str(got))
    jump_to(pg, pg.evaluate('() => document.scrollingElement.scrollHeight'))
    time.sleep(1.0)
    pg.evaluate("() => window.__journal.seekTo('ch-08', { immediate: true })")
    time.sleep(1.6)
    s2 = pg.evaluate('() => window.__loom.state().s')
    run.check('the scene is a pure function of scroll (same state reached from above and from below)', abs(s2 - got['s']) < 0.02,
              f"from above s={got['s']}, from below s={s2}")


# ---- v3 (DESIGN 12.8): newcomers, less scrolling, more ways in ----------------------------------------------

V3_STATE_JS = r"""() => {
  const nav = document.querySelector('[data-meter-slot="nav"]');
  const m = nav && nav.querySelector('[data-meter]');
  const gate = document.getElementById('spoilers');
  let stored = null; try { stored = localStorage.getItem('reader'); } catch (e) {}
  const a = document.activeElement;
  return { y: Math.round(scrollY), reader: document.documentElement.dataset.reader || null, gate: gate ? gate.open : null,
           stored, chapter: window.__journal ? window.__journal.chapter : null, meter: m ? m.dataset.value : (nav ? nav.dataset.reading : null),
           hash: location.hash, confirm: !!(document.getElementById('spoiler-confirm') || {}).open,
           popover: [...document.querySelectorAll(':popover-open')].map((e) => e.id),
           active: a ? (a.id || a.className || a.tagName) : null, loom: !!(window.__loom && window.__loom.live) };
}"""


def v3_state(pg):
    return pg.evaluate(V3_STATE_JS)


def section_value(pg, ch):
    return pg.evaluate(f"() => document.getElementById('{ch}').dataset.worldline")


def wait_chapter(pg, ch, timeout=4.0):
    t0 = time.time()
    got = None
    while time.time() - t0 < timeout:
        got = pg.evaluate('() => window.__journal ? window.__journal.chapter : null')
        if got == ch:
            break
        time.sleep(0.1)
    return got


def page_height(pg):
    pg.evaluate('() => document.fonts.ready')
    time.sleep(0.4)
    return pg.evaluate('() => document.scrollingElement.scrollHeight')


def v2_heights(p):
    """v2's index.html height at 1440 and 390, measured live from the backup when it exists."""
    if not (V2_BACKUP / 'index.html').exists():
        return dict(V2_HEIGHT), 'recorded constant (backup not found)'
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(V2_BACKUP)))
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    out = {}
    try:
        browser = p.chromium.launch(channel='chromium', args=GPU_ARGS)
        try:
            for w, h in ((1440, 900), (390, 844)):
                ctx = browser.new_context(viewport={'width': w, 'height': h})
                pg = ctx.new_page()
                pg.goto(f'http://127.0.0.1:{httpd.server_address[1]}/index.html', wait_until='load')
                time.sleep(2.0)
                out[w] = page_height(pg)
                ctx.close()
        finally:
            browser.close()
    finally:
        httpd.shutdown(); httpd.server_close()
    return out, f'measured live from {V2_BACKUP.name}/'


def chapters_button_check(pg, run):
    """Phones: the navigator is off and the Chapters tab beside the meter opens the chapter menu."""
    if not pg.evaluate("() => !!document.querySelector('.nav__chapters')"):
        return
    st = pg.evaluate("""() => { const b = document.querySelector('.nav__chapters'), r = b.getBoundingClientRect(), wl = document.querySelector('.wl-nav');
        return { shown: getComputedStyle(b).display !== 'none' && r.width > 30 && r.height >= 24, box: [Math.round(r.left), Math.round(r.right), Math.round(r.height)],
                 inside: r.left >= 0 && r.right <= innerWidth, navigator: wl ? getComputedStyle(wl).display : 'absent' }; }""")
    run.check('390px: the "Chapters" button is visible beside the meter (the navigator is off)',
              st['shown'] and st['inside'] and st['navigator'] in ('none', 'absent'), str(st))
    pg.evaluate('() => window.scrollTo(0, 0)')
    time.sleep(0.3)
    pg.locator('.nav__chapters').tap() if pg.evaluate("() => matchMedia('(pointer: coarse)').matches") else pg.locator('.nav__chapters').click()
    time.sleep(0.8)
    opened = pg.evaluate("() => document.getElementById('chapter-index').matches(':popover-open')")
    run.check('390px: the "Chapters" button opens the chapter menu', opened)
    run.shot(pg, 'Chapters menu open at 390')
    pg.keyboard.press('Escape')
    time.sleep(0.4)


def nojs_v3_checks(pg, run):
    """No JS: every term is a plain link to the lab page, and every anchor it names exists there; the gate is shut."""
    terms = pg.evaluate("() => [...document.querySelectorAll('.term')].map((t) => [t.tagName, t.getAttribute('href')])")
    lab = (SITE / 'lab.html').read_text(encoding='utf-8')
    missing = sorted({h for tag, h in terms if not h or not h.startswith('lab.html#') or f'id="{h.split("#", 1)[1]}"' not in lab})
    run.check(f'no JS: all {len(terms)} terms are links into the lab glossary or member list, and each anchor exists',
              len(terms) >= 20 and all(tag == 'A' for tag, _ in terms) and not missing, f'missing/invalid: {missing[:6]}')
    gate = pg.evaluate("() => { const g = document.getElementById('spoilers'); return g ? g.open : null; }")
    run.check('no JS: the spoiler gate starts shut (newcomer by default)', gate is False, str(gate))


def v3_checks(p, pg, run, base, ctx):
    if run.page == 'lab':
        ids = pg.evaluate("() => [...document.querySelectorAll('[id^=\"member-\"], [id^=\"term-\"]')].map((e) => e.id)")
        need = [f'member-00{i}' for i in range(1, 9)] + ['term-d-mail', 'term-phonewave', 'term-sern', 'term-ibn-5100', 'term-john-titor',
                'term-reading-steiner', 'term-world-line', 'term-divergence', 'term-attractor-field', 'term-time-leap', 'term-rounders', 'term-operations']
        run.check('lab.html carries the anchors the journal links to (members 001-008, the glossary terms)', all(n in ids for n in need),
                  f'missing {[n for n in need if n not in ids]}')
    if run.page in ('lab', '404'):
        run.check('the nav carries the Chapters button for phones (it opens the same menu)',
                  pg.evaluate("() => document.querySelector('.nav__chapters')?.getAttribute('popovertarget') === 'chapter-index'"))
        return
    # ---- defaults: a first visit reads as a newcomer, the gate shut, the gated chapters marked ------------------
    st = v3_state(pg)
    run.check('first visit: reader mode is newcomer and nothing is stored', st['reader'] == 'new' and st['stored'] is None, str(st))
    marks = pg.evaluate("""() => ({ gate: document.getElementById('spoilers').open,
        ch5: document.getElementById('ch-05').checkVisibility(),
        index: [...document.querySelectorAll('#chapter-index [data-gated] .index__spoiler')].filter((s) => getComputedStyle(s).display !== 'none').length,
        nav: [...document.querySelectorAll('.wl-nav__link[data-gated] .wl-nav__node')].filter((n) => getComputedStyle(n).backgroundImage === 'none').length })""")
    run.check('the spoiler gate starts shut: chapters 4-9 are not rendered, and the menu and the navigator mark all six',
              marks['gate'] is False and marks['ch5'] is False and marks['index'] == 6 and marks['nav'] == 6, str(marks))
    run.shot(pg, 'v3: hero doors, newcomer')
    # ---- page height (DESIGN 12.5): everything closed at 1440, against v2 ------------------------------------------
    h3 = page_height(pg)
    v2, how = v2_heights(p)
    cut = 1 - h3 / v2[1440]
    run.notes.append(f'page height at 1440, everything closed: v2 {v2[1440]}px ({how}), v3 {h3}px, {cut:.1%} shorter')
    run.check(f'page height at 1440 (everything closed): v3 {h3}px vs v2 {v2[1440]}px, {cut:.1%} shorter (needs >= 35%)', cut >= 0.35,
              f'v2 {how}')
    # ---- terms: Enter and Space open, Esc closes and gives focus back ---------------------------------------------
    jump_to(pg, chapter_y(pg, 'ch-01', 0.15))
    time.sleep(1.2)
    term = pg.locator('#ch-01 .chapter__tldr button.term').first
    term.focus()
    pg.keyboard.press('Enter')
    time.sleep(0.5)
    tip = pg.evaluate("""() => { const b = document.activeElement, t = document.getElementById(b.getAttribute('popovertarget'));
        const br = b.getBoundingClientRect(), tr = t.getBoundingClientRect();
        return { open: t.matches(':popover-open'), id: t.id, near: Math.abs(tr.top - br.bottom) < 24 || Math.abs(br.top - tr.bottom) < 24,
                 overlapX: tr.right > br.left && tr.left < br.right, text: t.textContent.trim().slice(0, 40) }; }""")
    run.check('a term opens its explainer on Enter, placed at the term', tip['open'] and tip['near'] and tip['overlapX'], str(tip))
    run.shot(pg, 'v3: term explainer open (chapter 1)')
    pg.keyboard.press('Escape')
    time.sleep(0.3)
    back = pg.evaluate("() => ({ open: [...document.querySelectorAll('.tip')].some((t) => t.matches(':popover-open')), focus: document.activeElement && document.activeElement.classList.contains('term') })")
    run.check('Esc closes the explainer and focus is back on the term', not back['open'] and back['focus'], str(back))
    pg.keyboard.press(' ')
    time.sleep(0.4)
    sp = pg.evaluate("() => [...document.querySelectorAll('.tip')].some((t) => t.matches(':popover-open'))")
    run.check('Space opens it too', sp)
    pg.keyboard.press('Escape')
    time.sleep(0.3)
    # ---- the doors and the persisted choice ------------------------------------------------------------------------
    jump_to(pg, 0)
    time.sleep(0.6)
    pg.locator('.door[data-door="fan"]').click()
    got = wait_chapter(pg, 'ch-01')
    time.sleep(0.6)
    st = v3_state(pg)
    run.check('"I\'ve seen it" sets fan mode, stores it, opens the gate and lands on chapter 1',
              st['reader'] == 'fan' and st['stored'] == 'fan' and st['gate'] is True and got == 'ch-01' and st['hash'] == '#ch-01', str(st))
    pg.reload(wait_until='load')
    time.sleep(2.2)
    st = v3_state(pg)
    run.check('the choice persists across a reload (fan: the gate opens at parse time)', st['reader'] == 'fan' and st['gate'] is True, str(st))
    jump_to(pg, 0)
    time.sleep(0.5)
    pg.locator('[data-index-trigger]').click()
    time.sleep(0.7)
    run.shot(pg, 'v3: chapter menu with the reading mode')
    pg.locator('[data-reader-set="new"]').click()
    time.sleep(0.4)
    st = v3_state(pg)
    run.check('the chapter menu switches to newcomer and the gate shuts', st['reader'] == 'new' and st['stored'] == 'new' and st['gate'] is False, str(st))
    pg.keyboard.press('Escape')
    time.sleep(0.3)
    pg.reload(wait_until='load')
    time.sleep(2.2)
    st = v3_state(pg)
    run.check('...and that persists too (newcomer: the gate stays shut after a reload)', st['reader'] == 'new' and st['gate'] is False, str(st))
    # ---- the navigator ----------------------------------------------------------------------------------------------
    try:
        pg.wait_for_function('() => !!window.__journal', timeout=8000)
    except PWError:
        pass
    pg.locator('.wl-nav__link[href="#ch-02"]').click()
    got = wait_chapter(pg, 'ch-02')
    v = wait_value(pg, section_value(pg, 'ch-02'), 3)
    cur = pg.evaluate("() => document.querySelector('.wl-nav__link[href=\"#ch-02\"]').getAttribute('aria-current')")
    run.check('the navigator lands on chapter 2, lights its node, and the meter reads the chapter\'s line',
              got == 'ch-02' and v == section_value(pg, 'ch-02') and cur == 'true', f'chapter={got} meter={v} current={cur}')
    run.shot(pg, 'v3: navigator on chapter 2')
    pg.locator('.wl-nav__link[href="#ch-03"]').click()
    got = wait_chapter(pg, 'ch-03')
    v = wait_value(pg, section_value(pg, 'ch-03'), 3)
    run.check('...chapter 3 too: it lands before its first ledger row, so the meter reads 0.571024', got == 'ch-03' and v == '0.571024', f'{got} {v}')
    # ---- J and K ---------------------------------------------------------------------------------------------------
    pg.evaluate('() => document.activeElement && document.activeElement.blur()')
    pg.keyboard.press('k')
    a = wait_chapter(pg, 'ch-02')
    pg.keyboard.press('j')
    b = wait_chapter(pg, 'ch-03')
    run.check('K and J move one chapter back and one forward', a == 'ch-02' and b == 'ch-03', f'K->{a} J->{b}')
    time.sleep(0.4)
    pg.keyboard.press('j')
    time.sleep(0.7)
    st = v3_state(pg)
    run.check('J into the shut gate asks first ("This spoils the second half. Open?")', st['confirm'] and st['chapter'] == 'ch-03', str(st))
    run.shot(pg, 'v3: the spoiler confirm')
    pg.keyboard.press('Escape')
    time.sleep(0.5)
    st = v3_state(pg)
    run.check('declining keeps the gate shut and the reader where they were', not st['confirm'] and st['gate'] is False and st['chapter'] == 'ch-03', str(st))
    pg.locator('.wl-nav__link[href="#ch-05"]').click()
    time.sleep(0.7)
    asked = v3_state(pg)['confirm']
    pg.locator('#spoiler-confirm button[value="open"]').click()
    got = wait_chapter(pg, 'ch-05', 5)
    v = wait_value(pg, section_value(pg, 'ch-05'), 3)
    st = v3_state(pg)
    run.check('a gated navigator node asks, then opens the gate and lands on chapter 5 with the meter on its line',
              asked and st['gate'] is True and got == 'ch-05' and v == section_value(pg, 'ch-05'), f'asked={asked} {st} meter={v}')
    # J never fires in the composer
    pg.evaluate("() => { const t = document.getElementById('dmail-msg'); t.value = ''; t.scrollIntoView({ block: 'center' }); t.focus(); }")
    time.sleep(0.6)
    y0 = pg.evaluate('scrollY')
    pg.keyboard.type('jkJK')
    time.sleep(1.0)
    typed = pg.evaluate("() => ({ v: document.getElementById('dmail-msg').value, dy: Math.abs(scrollY - %d), confirm: document.getElementById('spoiler-confirm').open })" % y0)
    run.check('J and K type into the composer and move nothing', typed['v'] == 'jkJK' and typed['dy'] < 2 and not typed['confirm'], str(typed))
    pg.evaluate("() => { document.getElementById('dmail-msg').value = ''; document.activeElement.blur(); }")
    # ---- details: opening prose keeps the loom and the meter in sync at the ledger rows ------------------------------
    details_sync_checks(pg, run)
    # ---- deep links, fresh visitor --------------------------------------------------------------------------------------
    deep_link_checks(p, run, base)


LEDGER_ROWS3 = ['0.571015', '0.523299', '0.456903', '0.409420', '0.337187']


def centre_row(pg, value):
    y = pg.evaluate(f"""() => {{ const r = document.querySelector('#ch-03 [data-worldline="{value}"]'); let y = 0;
        for (let n = r; n; n = n.offsetParent) y += n.offsetTop; return Math.max(0, y - innerHeight * 0.5 + 4); }}""")
    jump_to(pg, y)
    got = wait_value(pg, value, 3)
    time.sleep(0.9)
    return pg.evaluate(f"""() => ({{ s: window.__loom && window.__loom.live ? window.__loom.state().s : null,
        cur: document.querySelector('#ch-03 [data-worldline="{value}"]').classList.contains('is-current') }})""") | {'meter': got}


def details_sync_checks(pg, run):
    centre_row(pg, LEDGER_ROWS3[0])                      # into the journal: the loom mounts here (full motion, WebGL)
    try:
        pg.wait_for_function('() => !!(window.__loom && window.__loom.live)', timeout=15000)
    except PWError:
        run.notes.append('details sync: the WebGL loom did not go live; checking the meter only')
    time.sleep(1.0)
    before = [centre_row(pg, v) for v in LEDGER_ROWS3]
    pg.evaluate('() => { window.__qa.loomJumps = 0; window.__qa.loomKnots = 0; window.__qa.blinks = 0; }')
    shift_h = pg.evaluate("""() => { const d = document.querySelector('#ch-02 .chapter__more'), h0 = document.getElementById('journal').offsetHeight;
        d.open = true; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(document.getElementById('journal').offsetHeight - h0)))); }""")
    time.sleep(1.0)
    quiet = pg.evaluate('() => ({ jumps: window.__qa.loomJumps, knots: window.__qa.loomKnots, blinks: window.__qa.blinks })')
    run.check(f'opening "Read the full chapter" (+{shift_h}px) fires no loom jump, knot or blink', shift_h > 50 and quiet == {'jumps': 0, 'knots': 0, 'blinks': 0}, str(quiet))
    after = [centre_row(pg, v) for v in LEDGER_ROWS3]
    ok_meter = all(a['meter'] == v and a['cur'] for a, v in zip(after, LEDGER_ROWS3))
    run.check('after it opens, each chapter 3 ledger row still shifts the meter and is marked current at the centre', ok_meter,
              str([(v, a['meter'], a['cur']) for a, v in zip(after, LEDGER_ROWS3)]))
    if before[0]['s'] is not None and after[0]['s'] is not None:
        drift = max(abs(a['s'] - b['s']) for a, b in zip(after, before))
        run.check(f'...and the loom is at the same beat at every row (max drift {drift:.3f} in path units)', drift < 0.05,
                  str([(round(b['s'], 3), round(a['s'], 3)) for a, b in zip(after, before)]))
    else:
        run.skip('loom beat drift', 'WebGL loom not live')
    pg.evaluate("() => { document.querySelector('#ch-02 .chapter__more').open = false; }")
    time.sleep(0.8)
    last = centre_row(pg, LEDGER_ROWS3[2])
    run.check('closing it again keeps them in sync', last['meter'] == LEDGER_ROWS3[2] and last['cur'] and
              (last['s'] is None or abs(last['s'] - before[2]['s']) < 0.05), str(last))


def deep_link_checks(p, run, base):
    browser = p.chromium.launch(channel='chromium', args=GPU_ARGS)
    try:
        for target, want in (('ch-07', 'ch-07'), ('ch-02', 'ch-02'), ('primer', None), ('lab', None), ('dmail', None)):
            ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
            ctx.add_init_script(MONITOR_JS)
            pg = ctx.new_page()
            pg.goto(base + f'index.html#{target}', wait_until='load')
            time.sleep(3.0)
            st = v3_state(pg)
            if want:
                v = wait_value(pg, section_value(pg, want), 3)
                gated = target in ('ch-04', 'ch-05', 'ch-06', 'ch-07', 'ch-08', 'ch-09')
                run.check(f'deep link #{target} lands on {want} with the meter on {section_value(pg, want)}' + (' (and opens the gate)' if gated else ''),
                          wait_chapter(pg, want) == want and v == section_value(pg, want) and (st['gate'] is True or not gated), f'{st} meter={v}')
                if target == 'ch-07':
                    run.shot(pg, 'v3: deep link to chapter 7 (the choice)')
            else:
                top = pg.evaluate(f"() => Math.round(document.getElementById('{target}').getBoundingClientRect().top)")
                run.check(f'deep link #{target} lands with it at the top of the screen', -4 <= top <= 140, f'top={top}')
            ctx.close()
    finally:
        browser.close()


# ---------------------------------------------------------------------------------------------
# One scenario on one page
# ---------------------------------------------------------------------------------------------

def run_one(p, base, scenario, page, out, shots, verbose, headed):
    run = Run(scenario, page, out, shots, verbose)
    js = scenario != 'nojs'
    vp = MOBILE if scenario == 'mobile' else VIEWPORT
    launch = {'args': GPU_ARGS, 'headless': not headed}
    try:
        browser = p.chromium.launch(channel='chromium', **launch)
    except PWError:
        browser = p.chromium.launch(**launch)
        run.notes.append('channel "chromium" unavailable: used the default headless shell')
    try:
        ctx_opts = {'viewport': vp, 'device_scale_factor': 1}
        if scenario == 'mobile':
            ctx_opts.update(is_mobile=True, has_touch=True, device_scale_factor=2)
        if scenario == 'nojs':
            ctx_opts['java_script_enabled'] = False
        if scenario == 'reduced':
            ctx_opts['reduced_motion'] = 'reduce'
        ctx = browser.new_context(**ctx_opts)
        if js:
            ctx.add_init_script(MONITOR_JS)
        if scenario in FAN_SCENARIOS:
            ctx.add_init_script(FAN_INIT)
        if scenario == 'nowebgl':
            ctx.add_init_script(NO_WEBGL_JS)
        if scenario == 'cdn-blocked':
            for host in CDN_HOSTS:
                ctx.route(host, lambda route: route.abort())
        pg = ctx.new_page()
        run.attach(pg)
        pg.goto(base + PAGES[page], wait_until='load')

        # ---- boot ------------------------------------------------------------------------------
        if scenario == 'cdn-blocked':
            time.sleep((INTRO_DEADLINE_MS + DEADLINE_SLACK_MS) / 1000)
        elif js:
            try:
                pg.wait_for_function('() => !!window.__motion', timeout=15000)
            except PWError:
                pass
            if scenario in ('normal', 'nowebgl', 'keyboard'):
                try:
                    pg.wait_for_function("() => document.documentElement.classList.contains('lenis')", timeout=10000)
                except PWError:
                    pass
            time.sleep(1.8)
        else:
            time.sleep(0.5)

        st = pg.evaluate(STATE_JS)
        meter_ok = st['meterMarkup'] and not any('/assets/meter/' in f for f in run.failed)
        if not st['meterMarkup']:
            run.notes.append('meter markup not expanded yet (run tools/expand_meters.py): meter checks skipped')
        run.shot(pg, 'boot, top of page')

        if scenario == 'keyboard':
            keyboard_walk(pg, run)
            return run
        if scenario == 'v3':
            v3_checks(p, pg, run, base, ctx)
            errs = [f'{t}: {m}' for t, m, _ in run.console if t == 'error']
            run.check('no console errors', not errs, '; '.join(errs[:5]))
            run.check('no uncaught page errors', not run.pageerrors, '; '.join(run.pageerrors[:5]))
            return run

        if scenario in ('normal', 'nowebgl'):
            run.check('motion-core booted (data-motion=full)', st['motionCore'] and st['motion'] == 'full', f"motion={st['motion']}")
            run.check('Lenis active (html.lenis + instance)', st['lenisClass'] and st['lenisInstance'])
        if scenario == 'reduced':
            run.check('data-motion=reduce from the OS setting', st['motion'] == 'reduce')
            run.check('no Lenis smoothing', not st['lenisClass'] and not st['lenisInstance'])
        if scenario in ('nojs',):
            run.check('JS-only controls stay hidden (sound toggle, keypad, motion toggle)',
                      st['soundHidden'] in (True, None) and st['keypadHidden'] in (True, None) and st['motionToggleHidden'] in (True, None), str(st))
            if page == 'index':
                run.check('composer shows its static no-JS note', st['noteHidden'] is False, str(st['noteHidden']))
                nojs_v3_checks(pg, run)
            semantics_check(pg, run)
        if scenario == 'cdn-blocked':
            run.check('no Lenis without the CDN', not st['lenisClass'])
            run.check('local modules still ran (sound toggle revealed, shift orchestrator up)', st['soundHidden'] is False and st['shiftCore'], str(st))
            if page == 'index':
                run.check('composer is live without the CDN (static note swapped out)', st['noteHidden'] is True, str(st['noteHidden']))
        if scenario in ('nowebgl', 'reduced', 'nojs', 'cdn-blocked') and page == 'index':
            run.check('no WebGL canvas in the hero', not st['heroCanvas'])
        if page == 'index' and scenario == 'normal':
            run.notes.append(f"hero WebGL canvas mounted: {st['heroCanvas']} (needs a GPU renderer; meter-gl.js refuses software GL)")

        # ---- scroll the whole page ----------------------------------------------------------
        bottom, steps, y, maxy = wheel_walk(pg, run, vp, shots=scenario != 'mobile')
        run.check('wheel scroll reached the bottom', bottom, f'y={y} max={maxy} steps={steps}')
        time.sleep(2.4)
        pg.mouse.move(8, 8)
        time.sleep(0.4)

        if scenario == 'mobile':
            mobile_checks(pg, run, meter_ok)
            if page == 'index':
                loom_checks(pg, run, touch=True)
                contrast_checks(pg, run, ['ch-02', 'ch-05', 'ch-08'], touch=True)
                jump_to(pg, pg.evaluate('() => document.scrollingElement.scrollHeight'))
                time.sleep(0.8)

        # ---- at rest --------------------------------------------------------------------------
        st2 = rest_checks(pg, run, residue=js)

        if js:
            mon = monitor(pg)
            if mon is None:
                run.check('frame monitor ran', False, 'window.__qa missing')
            else:
                ev = mon['events']
                fmt = lambda es: '; '.join(f"{e['id']} {e['reason']}{'=' + e['detail'] if e['detail'] else ''} @{e['first']}-{e['last']}ms x{e['count']}" for e in es[:6])
                if scenario == 'reduced':
                    run.check(f"no hidden state in any of {mon['frames']} frames", not ev, fmt(ev))
                elif scenario == 'cdn-blocked':
                    stuck = [e for e in ev if not e['intro'] or e['last'] > INTRO_DEADLINE_MS + DEADLINE_SLACK_MS]
                    run.check(f"nothing stuck hidden without the CDN ({mon['frames']} frames)", not stuck, fmt(stuck))
                else:
                    boot = [e for e in ev if e['boot'] and not e['intro']]
                    run.check(f"nothing on screen at boot was re-hidden ({mon['frames']} frames)", not boot, fmt(boot))
                    if scenario == 'normal':
                        run.notes.append('hidden-while-animating (lazy-armed, expected): ' + fmt([e for e in ev if not e['boot']])[:600])
                if mon.get('lcp'):
                    run.notes.append(f"LCP entries: {mon['lcp']}")

        # ---- page extras ------------------------------------------------------------------------
        if page == 'index' and scenario == 'normal':
            loom_checks(pg, run)
            ledger_card_check(pg, run)
            contrast_checks(pg, run, ['ch-01', 'ch-02', 'ch-03', 'ch-05', 'ch-06', 'ch-08', 'ch-09'])
            nav_checks(pg, run)
        if page == 'index' and scenario in ('reduced', 'nowebgl', 'cdn-blocked', 'nojs'):
            map_checks(pg, run, js=js)
        if page == 'index' and scenario in ('normal', 'reduced', 'nowebgl', 'cdn-blocked', 'nojs'):
            # hand the page back at the bottom, where the checks below expect it
            bottom_y = pg.evaluate('() => document.scrollingElement.scrollHeight')
            if js:
                jump_to(pg, bottom_y)
            else:
                pg.evaluate(f'() => window.scrollTo(0, {bottom_y})')
            time.sleep(1.6)
        if page == 'index' and scenario in ('normal', 'reduced', 'nowebgl'):
            shift_checks(pg, run, meter_ok)
            ledger_walk(pg, run)
        if page == 'index' and scenario in ('normal', 'reduced', 'cdn-blocked'):
            dmail_checks(pg, run)
        if page == 'index' and scenario == 'normal':
            index_popover_checks(pg, run)
            sound_checks(pg, run)
        if page == 'lab' and scenario in ('normal', 'reduced'):
            lab_member_checks(pg, run, meter_ok)
        if page == '404' and scenario in ('normal', 'reduced'):
            lost_checks(pg, run, meter_ok, scenario == 'reduced')
        if scenario == 'normal' and st['motionCore'] and pg.evaluate("() => !!document.querySelector('[data-reveal=\"lines\"]')"):
            mask_clearance_check(pg, run)

        # ---- errors -------------------------------------------------------------------------------
        errs = [f'{t}: {m}' for t, m, _ in run.console if t == 'error' and '/assets/meter/' not in m]
        failed = [f for f in run.failed if '/assets/meter/' not in f]
        if scenario in ('normal', 'reduced', 'nowebgl', 'mobile'):
            run.check('no console errors', not errs, '; '.join(errs[:5]))
            run.check('no failed requests', not failed, '; '.join(failed[:5]))
        if any('/assets/meter/' in f for f in run.failed):
            run.notes.append('meter files missing (tolerated until the meter build lands): ' + '; '.join(f for f in run.failed if '/assets/meter/' in f)[:300])
        if js:
            run.check('no uncaught page errors', not run.pageerrors, '; '.join(run.pageerrors[:5]))
        warns = [f'{t}: {m}' for t, m, _ in run.console if t in ('warning', 'error')]
        if warns:
            run.notes.append('console: ' + ' | '.join(w[:200] for w in warns[:6]))

        # ---- page transition (last: it leaves the page) -------------------------------------------
        if scenario != 'mobile':
            navigate_check(pg, run, scenario, js=js)
            if js:
                run.check('no uncaught page errors after navigating', not run.pageerrors, '; '.join(run.pageerrors[:5]))
        return run
    finally:
        try:
            browser.close()
        except PWError:
            pass


def mobile_checks(pg, run, meter_ok):
    widths = pg.evaluate("""async () => {
        const out = []; const H = document.scrollingElement.scrollHeight;
        for (let y = 0; y < H; y += 700) { window.scrollTo(0, y); await new Promise(r => requestAnimationFrame(r));
          out.push(document.scrollingElement.scrollWidth - innerWidth); }
        window.scrollTo(0, 0); return Math.max(...out); }""")
    run.check('390px: no horizontal overflow at any scroll position', widths <= 1, f'{widths}px')
    time.sleep(0.6)
    run.shot(pg, '390 first screen')
    boxes = pg.evaluate("""() => ['.nav__mark', '.nav__meter', '.nav__chapters', '.nav__end'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, r.left, r.right]; })""")
    overlap = [(a[0], b[0]) for a, b in zip(boxes, boxes[1:]) if a[2] > b[1] + 0.5]
    run.check('390px: nav wordmark, meter, Chapters and links do not collide', not overlap and all(b[1] >= 0 and b[2] <= 390 for b in boxes), str(boxes))
    chapters_button_check(pg, run)
    if pg.evaluate("() => !!document.querySelector('.nx--hero')"):
        w = pg.evaluate("() => document.querySelector('.nx--hero').getBoundingClientRect().width")
        run.check('390px: the hero meter fits in 390 - 40px', w <= 350.5, f'{w:.1f}px')
    tiny = pg.evaluate("""() => [...document.querySelectorAll('p, a, li, dd, dt, td, th, button, label, span')]
        .filter((el) => !el.closest('[hidden], .vh, [popover]:not(:popover-open), .nx, svg') && el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .map((el) => [el.tagName + '.' + el.className, parseFloat(getComputedStyle(el).fontSize)]).filter(([, s]) => s < 12)""")
    run.check('390px: no text under 12px', not tiny, str(tiny[:5]))


def keyboard_walk(pg, run):
    pg.evaluate("() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); }")
    time.sleep(0.3)
    pg.keyboard.press('Tab')
    time.sleep(0.15)
    first = pg.evaluate("() => document.activeElement && document.activeElement.className")
    run.check('first Tab stop is the skip link', first == 'skip-link', str(first))
    vis = pg.evaluate("() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }")
    run.check('the skip link is on screen when focused', vis)
    run.shot(pg, 'skip link focused')
    pg.keyboard.press('Enter')
    time.sleep(0.4)
    inmain = pg.evaluate("() => { const a = document.activeElement; return !!a && (a.id === 'main' || !!a.closest('main')); }")
    run.check('Enter on the skip link moves focus into main', inmain)
    pg.evaluate("() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); document.querySelectorAll('[data-qa-seen]').forEach((e) => delete e.dataset.qaSeen); }")
    time.sleep(0.3)
    stops, bad, shots = 0, [], 0
    for i in range(260):
        pg.keyboard.press('Tab')
        time.sleep(0.12)
        st = pg.evaluate(FOCUS_STOP_JS)
        if st in (None, 'loop'):
            break
        stops += 1
        problems = [k for k, v in (('off-screen', not st['inView']), ('under the fixed nav', st['underNav']), ('covered', st['covered'] and not st['underNav']), ('no ring', not st['ring'])) if v]
        if problems:
            bad.append(f"{i}:{st['el']} ({', '.join(problems)})")
        if shots < 4 and i in (1, 3, 12, 30):
            run.shot(pg, f"focus stop {i}: {st['el']}")
            shots += 1
    run.check(f'keyboard walk: {stops} stops, each visible, ringed and clear of the fixed nav', stops > 5 and not bad, '; '.join(bad[:6]))
    run.check('no uncaught page errors', not run.pageerrors, '; '.join(run.pageerrors[:5]))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--scenarios', default=','.join(SCENARIOS))
    ap.add_argument('--pages', default=','.join(PAGES))
    ap.add_argument('--out', default=str(DEFAULT_OUT))
    ap.add_argument('--no-shots', action='store_true')
    ap.add_argument('--headed', action='store_true')
    ap.add_argument('-v', '--verbose', action='store_true')
    args = ap.parse_args()
    scenarios = [s for s in args.scenarios.split(',') if s]
    pages = [p for p in args.pages.split(',') if p]
    bad = [s for s in scenarios if s not in SCENARIOS] + [p for p in pages if p not in PAGES]
    if bad:
        ap.error(f'unknown scenario/page: {bad}')
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    httpd, stop = start_server()
    base = f'http://127.0.0.1:{httpd.server_address[1]}/'
    print(f'serving {SITE} at {base}')
    runs = []
    try:
        with sync_playwright() as p:
            for scenario in scenarios:
                for page in pages:
                    for old in out.glob(f'{scenario}-{page}-*.png'):
                        old.unlink()
                    print(f'-- {scenario} / {page}')
                    t0 = time.time()
                    attempt, run = 0, None
                    while attempt < 2:
                        attempt += 1
                        try:
                            run = run_one(p, base, scenario, page, out, not args.no_shots, args.verbose, args.headed)
                            break
                        except PWError as err:
                            msg = str(err).splitlines()[0]
                            if attempt < 2 and any(k in msg.lower() for k in ('closed', 'disconnected', 'crash')):
                                print(f'    browser went away ({msg}); retrying once')
                                continue
                            run = Run(scenario, page, out, False, args.verbose)
                            run.check('run completed without a driver error', False, msg)
                            break
                    if attempt > 1:
                        run.notes.append('retried once after the browser disconnected')
                    # The threaded test server occasionally drops a request under load, and a dropped module
                    # (main.js, say) takes everything after it down. A failed run that saw ERR_CONNECTION_RESET
                    # is re-run once; only a second failure counts.
                    dropped = [f for f in run.failed if 'ERR_CONNECTION_RESET' in f]
                    if not run.ok and dropped:
                        print(f'    dropped request ({dropped[0][:70]}); re-running the scenario once')
                        run = run_one(p, base, scenario, page, out, not args.no_shots, args.verbose, args.headed)
                        run.notes.append(f're-run after a dropped request: {dropped[:2]}')
                    run.secs = time.time() - t0
                    runs.append(run)
    finally:
        stop()

    print('\n' + '=' * 100)
    print(f"{'scenario':<12} {'page':<6} {'result':<6} {'checks':>7} {'secs':>5}  failures")
    print('-' * 100)
    for r in runs:
        passed = sum(1 for _, ok, _ in r.checks if ok)
        fails = [n for n, ok, _ in r.checks if not ok]
        print(f"{r.scenario:<12} {r.page:<6} {'PASS' if r.ok else 'FAIL':<6} {passed:>3}/{len(r.checks):<3} {r.secs:>5.0f}  {'; '.join(fails)[:64]}")
    print('=' * 100)
    total_fail = sum(1 for r in runs if not r.ok)
    print(f'{len(runs) - total_fail}/{len(runs)} scenario-page runs passed; screenshots in {out}')
    (out / 'test_site_results.json').write_text(json.dumps([
        {'scenario': r.scenario, 'page': r.page, 'ok': r.ok, 'secs': round(r.secs, 1),
         'checks': [{'name': n, 'ok': ok, 'detail': d} for n, ok, d in r.checks], 'notes': r.notes}
        for r in runs], indent=1))
    return 1 if total_fail else 0


if __name__ == '__main__':
    sys.exit(main())
