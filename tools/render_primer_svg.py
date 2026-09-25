#!/usr/bin/env python3
"""
render_primer_svg.py: draw the primer's world-line figure (index.html #primer, DESIGN 12.2) as inline SVG.

Last updated: 2026-09-25

What it does
  The primer explains world lines with a small drawing in the loom map's own language (tools/render_loom_svg.py):
  three yarn threads tied into one bundle at the left, each a rope band with hatched plies, fanning out and running
  to the right, where HTML labels give their divergence values. A neon spark rides the beta thread; its trail is
  lit behind it. A hidden D-mail arc and a second trail wait for the primer's Shift button (assets/js/primer.js):
  the arc draws, the spark rides it onto the alpha thread, the meter beside it rolls to 0.571024.
  Two drawings are written, one wide (desktop) and one tall (phones), so neither is squashed; CSS shows one.
  Everything is static and complete without JS. Colours are classes styled in site.css (the night loom inks).

  The anchor geometry the script needs is also written as data-* attributes on each <svg>, so primer.js can move
  the spark along the arc with getPointAtLength and never guesses coordinates.

Usage
  python3 tools/render_primer_svg.py           replace the markup between <!-- primer:threads --> and
                                               <!-- /primer:threads --> in index.html
  python3 tools/render_primer_svg.py --check   exit 1 if index.html is stale
"""
from __future__ import annotations

import argparse
import math
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
INDEX = SITE / "index.html"
BEGIN, END = "<!-- primer:threads -->", "<!-- /primer:threads -->"

# name, css class suffix, field, divergence value (labels are HTML, placed by site.css from these rows)
THREADS = [("b", "1.130426"), ("a1", "0.571024"), ("a2", "0.523299")]

LAYOUTS = {
    # w, h, tie point, fan end x, run end x, row ys, wave amplitude/length, spark x, arc (x0, x1), spark x after
    "wide": dict(w=1200, h=210, tie=(34, 108), fan=330, end=1016, ys=(50, 108, 164), amp=5.5, lam=240,
                 r=6.2, spark=292, arc=(292, 436), after=494, hatch=6.2),
    "tall": dict(w=400, h=236, tie=(14, 120), fan=118, end=296, ys=(56, 120, 182), amp=4.0, lam=130,
                 r=6.6, spark=150, arc=(150, 222), after=248, hatch=6.0),
}
PHASE = {"b": 0.0, "a1": 2.1, "a2": 4.0}


def f(v: float) -> str:
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def centre(L: dict, name: str, x: float) -> float:
    """Thread centre y at x: tied at the left, fanned out by L['fan'], then a gentle wave."""
    tx, ty = L["tie"]
    target = L["ys"][[t[0] for t in THREADS].index(name)]
    t = max(0.0, min(1.0, (x - tx) / (L["fan"] - tx)))
    e = t * t * (3 - 2 * t)
    wave = L["amp"] * math.sin(2 * math.pi * x / L["lam"] + PHASE[name]) * e
    return ty + (target - ty) * e + wave


def centre_path(L: dict, name: str, x0: float, x1: float, step: float = 4.0) -> str:
    pts = []
    x = x0
    while x < x1:
        pts.append((x, centre(L, name, x)))
        x += step
    pts.append((x1, centre(L, name, x1)))
    return "M" + " L".join(f"{f(a)} {f(b)}" for a, b in pts)


def band(L: dict, name: str) -> tuple[str, str]:
    """Outline of the rope band (slightly lumpy edges, pinched at the tie) and its hatched plies."""
    tx, _ = L["tie"]
    x0, x1, r = tx, L["end"], L["r"]
    top, bot = [], []
    seed = sum(map(ord, name))
    x = x0
    while x <= x1 + 1e-6:
        c = centre(L, name, x)
        dy = (centre(L, name, x + 0.5) - centre(L, name, x - 0.5))
        n = 1 / math.hypot(1, dy)
        # radius: pinched into the binding at the tie, full soon after, a round cap at the end
        rr = r * (0.55 + 0.45 * min(1.0, (x - x0) / 26.0))
        if x > x1 - r:
            rr = math.sqrt(max(0.0, r * r - (x - (x1 - r)) ** 2))
        wob = 0.55 * math.sin(x * 0.9 + seed) + 0.35 * math.sin(x * 2.3 + seed * 1.7)
        top.append((x + dy * n * (rr + wob), c - n * (rr + wob)))
        bot.append((x - dy * n * (rr - wob), c + n * (rr - wob)))
        x += 3.0
    outline = "M" + " L".join(f"{f(a)} {f(b)}" for a, b in top + bot[::-1]) + " Z"
    hatch = []
    x = x0 + 4
    while x < x1:
        c = centre(L, name, x)
        hatch.append(f"M{f(x - 3.2)} {f(c + r + 2)}L{f(x + 3.2)} {f(c - r - 2)}")
        x += L["hatch"]
    return outline, "".join(hatch)


def arc_path(L: dict) -> str:
    a0, a1 = L["arc"]
    yb, ya = centre(L, "b", a0), centre(L, "a1", a1)
    lift = 30 if L["w"] > 600 else 22
    return (f"M{f(a0)} {f(yb)} C{f(a0 + (a1 - a0) * 0.32)} {f(yb - lift)} "
            f"{f(a1 - (a1 - a0) * 0.42)} {f(ya - lift * 1.1)} {f(a1)} {f(ya)}")


def render(kind: str) -> str:
    L = LAYOUTS[kind]
    w, h = L["w"], L["h"]
    out = [f'<svg class="lines__svg lines__svg--{kind}" viewBox="0 0 {w} {h}" aria-hidden="true" focusable="false" '
           f'data-spark="{f(L["spark"])} {f(centre(L, "b", L["spark"]))}" '
           f'data-after="{f(L["after"])} {f(centre(L, "a1", L["after"]))}">']
    out.append("<defs>")
    for name, _ in THREADS:
        outline, _ = band(L, name)
        out.append(f'<clipPath id="lines-clip-{kind}-{name}"><path d="{outline}"/></clipPath>')
    out.append("</defs>")
    for name, value in THREADS:
        outline, hatch = band(L, name)
        out.append(f'<g class="lines__thread lines__thread--{name}" data-thread="{name}" data-value="{value}">')
        out.append(f'<path class="lines__band" d="{outline}"/>')
        out.append(f'<path class="lines__ply" clip-path="url(#lines-clip-{kind}-{name})" d="{hatch}"/>')
        out.append(f'<path class="lines__sheen" d="{centre_path(L, name, L["tie"][0] + 18, L["end"] - 6)}" '
                   f'transform="translate(0 {f(-L["r"] * 0.42)})"/>')
        out.append("</g>")
    # the binding that ties the bundle: a few pale wraps round the three threads at the tie
    tx, ty = L["tie"]
    turns = "".join(f"M{f(tx + 4.5 + i * 3.2)} {f(ty - 9.5)}l-2.2 19" for i in range(4))
    out.append(f'<g class="lines__tie"><rect x="{f(tx + 1)}" y="{f(ty - 10)}" width="14" height="20" rx="3.5"/>'
               f'<path d="{turns}"/></g>')
    # the spark's trail on beta (lit), the D-mail arc and the trail on alpha (both waiting for Shift)
    x0 = tx + 16
    out.append(f'<path class="lines__trail lines__trail--b" d="{centre_path(L, "b", x0, L["spark"])}"/>')
    out.append(f'<path class="lines__arc" pathLength="1" d="{arc_path(L)}"/>')
    out.append(f'<path class="lines__trail lines__trail--a" pathLength="1" '
               f'd="{centre_path(L, "a1", L["arc"][1], L["after"])}"/>')
    sx, sy = L["spark"], centre(L, "b", L["spark"])
    out.append(f'<g class="lines__spark" transform="translate({f(sx)} {f(sy)})">'
               f'<circle class="lines__halo" r="11"/><circle class="lines__bead" r="4.6"/>'
               f'<circle class="lines__core" r="1.9"/></g>')
    out.append("</svg>")
    return "".join(out)


def rows_css(kind: str, prefix: str) -> str:
    """Each thread's row as a share of the drawing's height, so the HTML labels sit on their threads."""
    L = LAYOUTS[kind]
    return ";".join(f"--{prefix}-{name}:{L['ys'][i] / L['h'] * 100:.2f}%" for i, (name, _) in enumerate(THREADS))


FIELD = {"b": "β", "a1": "α", "a2": "α"}


def labels() -> str:
    """The divergence of each thread, as HTML set at the thread's right end (the figcaption carries the text)."""
    items = "".join(f'<li class="lines__label lines__label--{name}" data-thread="{name}"><data value="{value}">{value}</data>'
                    f'<span class="lines__field">{FIELD[name]}</span></li>' for name, value in THREADS)
    return f'<ul class="lines__labels" aria-hidden="true">{items}</ul>'


def block() -> str:
    style = (rows_css("wide", "row") + ";" + rows_css("tall", "row-tall") +
             f";--label-x:{LAYOUTS['wide']['end'] / LAYOUTS['wide']['w'] * 100:.2f}%"
             f";--label-x-tall:{LAYOUTS['tall']['end'] / LAYOUTS['tall']['w'] * 100:.2f}%")
    return (f'{BEGIN}\n<div class="lines__art" style="{style}">'
            f'{render("wide")}{render("tall")}{labels()}</div>\n{END}')


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    src = INDEX.read_text(encoding="utf-8")
    pat = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.S)
    if not pat.search(src):
        print(f"no {BEGIN} marker in index.html", file=sys.stderr)
        return 1
    new = pat.sub(lambda _m: block(), src, count=1)
    if args.check:
        stale = new != src
        print("primer figure is stale" if stale else "primer figure is current")
        return 1 if stale else 0
    if new != src:
        INDEX.write_text(new, encoding="utf-8")
        print("primer figure written")
    else:
        print("primer figure unchanged")
    return 0


if __name__ == "__main__":
    sys.exit(main())
