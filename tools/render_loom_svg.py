#!/usr/bin/env python3
"""
render_loom_svg.py: draw the static loom map (assets/loom/loom-map.svg) from the loom's own parameters.

Last updated: 2026-09-25

What it does
  Reads the PARAMS JSON block from assets/js/loom.js (between /*loom-params:begin*/ and /*loom-params:end*/),
  so the map and the WebGL loom share one source: the same two strands, knots, story threads, spark path, jump
  values and dates. It writes one <g id="loom-map"> that index.html shows twice through
  <svg viewBox="0 0 400 1000"><use href="assets/loom/loom-map.svg#loom-map"/></svg>, once sticky in each run of
  the journal. That map is the stage for no JS, reduced motion and no WebGL (DESIGN 11, Fallbacks).

The drawing (a schematic of the same loom: time runs down the page, the twist is drawn, not rotated)
  - The alpha and beta strands as two rope bands (hatched plies, slightly bumpy edges) that pinch to a point at
    their knots (beta Jul 28; alpha Aug 13 and Aug 15). The pale Steins Gate thread runs between them.
  - The spark's path as one orange line: down beta into the Jul 28 knot, the D-mail arc across the gap to alpha,
    the Operation Urd hops outward, the time-leap hoops back from the Aug 13 knot, the hop over it, the Verthandi
    hops back, the choice leap across the gap, the ride to Aug 21, the flight back up beta (dashed, with
    chevrons), the slip onto the Steins Gate thread, and that thread lit to the end.
  - Every jump value and knot date as an annotation with a short leader, like the projected labels of the WebGL
    loom and the ledger rows in the copy.
  Colours are CSS custom properties set by site.css per run (day haze or lab night): --loom-a, --loom-a-2,
  --loom-b, --loom-b-2, --loom-sg, --loom-sg-2, --loom-path; the labels use currentColor and the page's fonts
  (var(--font-mono), var(--font-display)). Presentation attributes cannot take var(), so every styled element
  carries a short style="" instead; custom properties inherit into the <use> shadow tree.

Usage
  python3 tools/render_loom_svg.py            write assets/loom/loom-map.svg
  python3 tools/render_loom_svg.py --check    exit 1 if the file on disk differs from a fresh render
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
LOOM_JS = SITE / 'assets' / 'js' / 'loom.js'
OUT = SITE / 'assets' / 'loom' / 'loom-map.svg'

W, H = 400, 1000
# Story time x -> map y: piecewise linear, with more room where the story is dense (Operation Urd, the loops,
# Operation Verthandi).
Y_OF_X = [(-4.8, 58), (0.0, 150), (6.0, 282), (12.75, 452), (15.0, 552), (15.85, 594), (19.5, 758),
          (21.0, 800), (24.0, 866), (28.5, 948)]
BAND = {0: 172.0, 1: 268.0}      # strand centre lines (alpha left, beta right)
SG_X = 220.0
HALF = 21.0                      # band half-width
LEFT_LABEL_X = 132.0             # alpha annotations end here (text-anchor end)
RIGHT_LABEL_X = 308.0            # beta and Steins Gate annotations start here
FONT = 16                        # label size in map units (>= 12px at the scales the page draws it)


def load_params() -> dict:
    src = LOOM_JS.read_text()
    m = re.search(r'/\*loom-params:begin\*/(.*?)/\*loom-params:end\*/', src, re.S)
    if not m:
        sys.exit('render_loom_svg: PARAMS block not found in assets/js/loom.js')
    return json.loads(m.group(1))


def y_of(x: float) -> float:
    pts = Y_OF_X
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def f(v: float) -> str:
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s


class Loom:
    def __init__(self, P: dict):
        self.P = P
        self.knots = P['knots']
        self.outer = P['strand']['outer']

    def pinch(self, x: float, strand: int) -> float:
        p = 0.0
        for k in self.knots:
            if k['strand'] != strand:
                continue
            z = (x - k['x']) / k['w']
            p = max(p, math.exp(-z * z))
        return p * 0.93

    def half(self, x: float, strand: int) -> float:
        return HALF * (1 - self.pinch(x, strand)) + 1.2

    def lane(self, name: str, x: float) -> float:
        """Lateral position of a story thread: alpha threads spread from the outer edge (0.337187) to the gap
        edge (0.571xxx); beta threads sit near the gap. Lanes squeeze into the pinch at a knot."""
        strand, k = self.P['threads'][name]
        if strand == 2:
            return SG_X
        phi = math.radians(self.P['strand']['phi0'] + k * 360 / self.outer)
        # phi 15..165 deg (front of the ply): -cos gives -0.97 (outer side) .. +0.97 (gap side)
        side = -math.cos(phi)
        if strand == 1:
            side = -side      # beta: the gap is on its left
        return BAND[strand] + side * self.half(x, strand) * 0.82


def band_path(L: Loom, strand: int, x0: float, x1: float) -> tuple[str, list[str]]:
    """A rope band: closed outline with small ply bumps, and diagonal ply hatching clipped to it."""
    steps = 240
    xs = [x0 + (x1 - x0) * i / steps for i in range(steps + 1)]
    left, right = [], []
    for x in xs:
        y = y_of(x)
        h = L.half(x, strand)
        bump = 1.3 * math.sin(2 * math.pi * y / 13.0) * (h / HALF)
        left.append((BAND[strand] - h + bump, y))
        right.append((BAND[strand] + h + bump * 0.6, y))
    pts = left + right[::-1]
    d = 'M' + ' L'.join(f'{f(a)} {f(b)}' for a, b in pts) + ' Z'
    hatch = []
    y = y_of(x0) + 3
    y_end = y_of(x1) - 3
    # invert y_of for hatching positions
    while y < y_end:
        x = x_of(y)
        h = L.half(x, strand)
        if h > 3:
            slant = 8.5 * (h / HALF)
            c = BAND[strand]
            hatch.append(f'M{f(c - h + 1.5)} {f(y + slant)}L{f(c + h - 1.5)} {f(y - slant)}')
        y += 7.2
    return d, hatch


def x_of(y: float) -> float:
    pts = Y_OF_X
    if y <= pts[0][1]:
        return pts[0][0]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y <= y1:
            return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
    return pts[-1][0]


def spark_path(L: Loom) -> tuple[list[str], list[str], dict]:
    """The spark's path. Returns (solid path segments, dashed flight segments, anchor points for labels)."""
    solid, dashed = [], []
    anchors = {}
    cur = None

    def pt(name, x):
        return (L.lane(name, x), y_of(x))

    for step in L.P['path']:
        kind = step[0]
        if kind == 'ride':
            _, name, x0, x1, opt = (step + [{}])[:5]
            if x1 < x0:
                # the flight back up beta: dashed, a lane width to the right of the forward ride
                ys = [x0 + (x1 - x0) * i / 60 for i in range(61)]
                pts = [(L.lane(name, x) + 6, y_of(x)) for x in ys]
                dashed.append('M' + ' L'.join(f'{f(a)} {f(b)}' for a, b in pts))
                anchors['flight'] = pts
                cur = pts[-1]
                continue
            ys = [x0 + (x1 - x0) * i / 40 for i in range(41)]
            pts = [pt(name, x) for x in ys]
            if cur is not None and math.dist(cur, pts[0]) > 0.5:
                pts.insert(0, cur)
            solid.append('M' + ' L'.join(f'{f(a)} {f(b)}' for a, b in pts))
            cur = pts[-1]
            if opt.get('mark'):
                anchors[opt['mark']] = cur
            continue
        if kind == 'leap':
            _, name, xa, xb, opt = step
            a, b = pt(name, xa), pt(name, xb)
            lift = 26 + 34 * opt.get('lift', 0.5)
            solid.append(f'M{f(a[0])} {f(a[1])}C{f(a[0] - lift)} {f(a[1] + 6)} {f(b[0] - lift)} {f(b[1] - 6)} {f(b[0])} {f(b[1])}')
            cur = b
            continue
        # jump / slip
        _, na, nb, xa, xb, opt = step
        a = cur if (cur is not None and kind == 'slip') else pt(na, xa)
        if kind == 'slip':
            a = (L.lane(na, xa) + 6, y_of(xa))
        b = pt(nb, xb)
        size = opt.get('size', 1)
        if size >= 3:      # the D-mail and the choice: long arcs across the gap
            bow = 18 + 6 * size
            mid_y = (a[1] + b[1]) / 2
            solid.append(f'M{f(a[0])} {f(a[1])}C{f(a[0] + (b[0] - a[0]) * 0.1)} {f(mid_y + bow)} {f(b[0] - (b[0] - a[0]) * 0.1)} {f(mid_y + bow)} {f(b[0])} {f(b[1])}')
        elif kind == 'slip':
            solid.append(f'M{f(a[0])} {f(a[1])}C{f(a[0] + 4)} {f(a[1] - 10)} {f(b[0] + 8)} {f(b[1] + 4)} {f(b[0])} {f(b[1])}')
        else:              # a hop between neighbouring threads: a short outward flick
            out = -1 if L.P['threads'][nb][0] == 0 else 1
            solid.append(f'M{f(a[0])} {f(a[1])}C{f(a[0] + out * 10)} {f(a[1] + 4)} {f(b[0] + out * 10)} {f(b[1] - 6)} {f(b[0])} {f(b[1])}')
        cur = b
        if opt.get('label'):
            anchors[opt['id']] = (b, nb, opt)
    return solid, dashed, anchors


def resolve(labels: list[dict], gap: float = FONT + 3) -> None:
    """Keep annotations on one side from overlapping: push later ones down."""
    for side in ('L', 'R'):
        group = sorted((l for l in labels if l['side'] == side), key=lambda l: l['y'])
        last = -1e9
        for l in group:
            if l['y'] < last + gap:
                l['y'] = last + gap
            last = l['y']


def render() -> str:
    P = load_params()
    L = Loom(P)
    x0, x1 = -4.7, 28.4
    out = []
    add = out.append
    add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 1000">')
    add('<!-- Generated by tools/render_loom_svg.py from the PARAMS block in assets/js/loom.js. Do not edit by hand. -->')
    add('<defs>')
    for s, name in ((0, 'a'), (1, 'b')):
        d, _ = band_path(L, s, x0, x1)
        add(f'<clipPath id="loom-clip-{name}"><path d="{d}"/></clipPath>')
    add('</defs>')
    add('<g id="loom-map" style="fill:none;stroke-linecap:round;stroke-linejoin:round">')

    # the Steins Gate thread (unlit: pale, barely there on the haze)
    add(f'<path d="M{f(SG_X)} {f(y_of(x0))}V{f(y_of(x1))}" style="stroke:var(--loom-sg-2);stroke-width:2.6"/>')
    add(f'<path d="M{f(SG_X)} {f(y_of(x0))}V{f(y_of(x1))}" style="stroke:var(--loom-sg);stroke-width:1.3"/>')

    # the two strands
    for s, name, c1, c2 in ((0, 'a', '--loom-a', '--loom-a-2'), (1, 'b', '--loom-b', '--loom-b-2')):
        d, hatch = band_path(L, s, x0, x1)
        add(f'<path d="{d}" style="fill:var({c1});fill-opacity:.9;stroke:var({c2});stroke-width:1"/>')
        add(f'<path clip-path="url(#loom-clip-{name})" d="{"".join(hatch)}" style="stroke:var({c2});stroke-width:1.6;opacity:.85"/>')

    # the spark's path
    solid, dashed, anchors = spark_path(L)
    sg_y0 = y_of(0.5)
    add(f'<path d="M{f(SG_X)} {f(sg_y0)}V{f(y_of(x1))}" style="stroke:var(--loom-sg-lit, var(--loom-sg));stroke-width:3.2;opacity:.9"/>')
    add(f'<path d="{"".join(solid)}" style="stroke:var(--loom-path);stroke-width:1.9"/>')
    for d in dashed:
        add(f'<path d="{d}" style="stroke:var(--loom-path);stroke-width:1.6;stroke-dasharray:1 6"/>')
    # chevrons up the flight: time running backward
    flight = anchors.get('flight') or []
    for i in range(8, len(flight) - 4, 12):
        cx, cy = flight[i]
        add(f'<path d="M{f(cx - 4)} {f(cy + 3)}L{f(cx)} {f(cy - 2)}L{f(cx + 4)} {f(cy + 3)}" style="stroke:var(--loom-path);stroke-width:1.4"/>')
    # the spark, where the story leaves it: on the Steins Gate thread
    end_y = y_of(x1) - 4
    add(f'<circle cx="{f(SG_X)}" cy="{f(end_y)}" r="3.4" style="fill:var(--loom-path);stroke:none"/>')

    # annotations
    labels = []
    for k, v in anchors.items():
        if k in ('flight',) or not isinstance(v, tuple) or len(v) != 3:
            continue
        (px, py), thread, opt = v
        side = 'L' if P['threads'][thread][0] == 0 else 'R'
        labels.append({'text': opt['label'], 'x': px, 'y': py, 'py': py, 'side': side, 'mono': True})
    for kn in P['knots']:
        side = 'L' if kn['strand'] == 0 else 'R'
        labels.append({'text': kn['date'], 'x': BAND[kn['strand']], 'y': y_of(kn['x']), 'py': y_of(kn['x']), 'side': side, 'mono': False})
    labels.append({'text': '1.130426', 'x': L.lane('U0', -4.3), 'y': y_of(-4.3), 'py': y_of(-4.3), 'side': 'R', 'mono': True})
    labels.append({'text': 'Aug 21', 'x': L.lane('U1', 24.0), 'y': y_of(24.0), 'py': y_of(24.0), 'side': 'R', 'mono': False})
    resolve(labels)
    for l in labels:
        ty = l['y'] + FONT * 0.34
        font = f'font:400 {FONT}px var(--font-mono);letter-spacing:.02em' if l['mono'] else f'font:italic 400 {FONT + 2}px var(--font-display)'
        if l['side'] == 'L':
            lx = LEFT_LABEL_X
            add(f'<path d="M{f(lx + 5)} {f(l["y"])}L{f(l["x"] - 5)} {f(l["py"])}" style="stroke:currentColor;stroke-width:1;opacity:.5"/>')
            add(f'<text x="{f(lx)}" y="{f(ty)}" text-anchor="end" style="fill:currentColor;stroke:none;{font}">{l["text"]}</text>')
        else:
            lx = RIGHT_LABEL_X
            add(f'<path d="M{f(l["x"] + 5)} {f(l["py"])}L{f(lx - 5)} {f(l["y"])}" style="stroke:currentColor;stroke-width:1;opacity:.5"/>')
            add(f'<text x="{f(lx)}" y="{f(ty)}" style="fill:currentColor;stroke:none;{font}">{l["text"]}</text>')
    add('</g>')
    add('</svg>')
    return '\n'.join(out) + '\n'


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--check', action='store_true', help='exit 1 if the file on disk is stale')
    a = ap.parse_args()
    svg = render()
    if a.check:
        ok = OUT.exists() and OUT.read_text() == svg
        print('loom-map.svg is ' + ('current' if ok else 'STALE: run tools/render_loom_svg.py'))
        return 0 if ok else 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(svg)
    print(f'wrote {OUT.relative_to(SITE)} ({len(svg) / 1024:.1f} KB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
