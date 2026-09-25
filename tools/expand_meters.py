#!/usr/bin/env python3
"""expand_meters.py: fill <!-- meter:... --> markers with static divergence-meter markup.

Last updated: 2026-09-25

USAGE (from anywhere; paths resolve from this file)
  python3 tools/expand_meters.py            expand every marker in every *.html under steins-gate-site/
  python3 tools/expand_meters.py --sprite   also rebuild assets/meter/nixie.svg from NUMERALS below
  python3 tools/expand_meters.py --check    exit 1 if any file would change (for CI); writes nothing
  python3 tools/expand_meters.py FILE ...   limit expansion to these files

MARKER GRAMMAR (written by the page builder)
  <!-- meter:SIZE VALUE [flags] -->  ...anything...  <!-- /meter -->
    SIZE   hero | mini | footer | 404
    VALUE  1.130426 | ?.?????? | -.------ | " 275349" (quote it when it starts with a space: blank first tube)
           Anything without a dot is read as first tube + six digits. Tube index 1 is always the decimal tube.
    flags  (optional, space separated)
           id=NAME       id attribute on the meter
           class=a,b     extra classes on the meter
           ignite        adds data-ignite: under <html data-motion="full"> the lit digits start dark until
                         meter.js ignite() takes over (a 1.8s CSS deadline shows them anyway if JS never runs)
           sprite=URL    sprite URL to use instead of the relative path to assets/meter/nixie.svg
                         (use an absolute URL on 404.html, which hosts serve at arbitrary paths)
  Everything between the opening marker and the next <!-- /meter --> is replaced. A marker with no closing
  marker gets one. Running it twice changes nothing (idempotent).

OUTPUT (the no-JS poster; meter.css styles it, meter.js animates it)
  <div class="nx nx--hero" data-meter data-size="hero" data-value="1.130426" role="img"
       aria-label="Divergence meter reading 1.130426">
    8 x <span class="nx__tube" data-char="1">
          <svg class="nx__stack">  <use href="…nixie.svg#nx-stack"/>  unlit cathode stack (ghost wires)
          <svg class="nx__lit">    <use class="nx__sheath" …#nx-1/> <use class="nx__core" …#nx-1/>
          <svg class="nx__front">  <use href="…#nx-f-1"/>  cathodes stacked in front of the lit one
        </span>
    <span class="nx__text">1.130426</span>   visually hidden
  </div>

THE NUMERALS
  Original monoline set, drawn for this site on a 60 x 100 grid. Glyph box x 11-49, y 17-83 (38 x 66, about
  1:1.74). The construction is "wire bent round a mandrel": every bowl is a true arc (r 19 full width, r 14-15 for
  the small upper bowls), joined by straight wire, with round caps and joins. 0 is a stadium, not an oval; 5 is a
  true 5; 9 is the 6 turned 180 degrees, as a stamped cathode would be. Not traced from IN-14/IN-18 or the anime.
  Depth: cathodes stack front to back in STACK_ORDER; each layer is scaled about the glyph centre (-0.6% per layer)
  so the flat SVG reads as a stack. The lit symbol carries the same transform, so it sits exactly on its ghost.
"""

from __future__ import annotations

import argparse
import html
import os
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
SPRITE = SITE / "assets" / "meter" / "nixie.svg"
SIZES = ("hero", "mini", "footer", "404")
SKIP_DIRS = {".git", "node_modules", "research", "tests", "__pycache__"}

# ---------------------------------------------------------------------------------------------------------------
# Path table (the single source of truth: nixie.svg is generated from it and meter-gl.js parses nixie.svg).
# Absolute commands only (M L Q C A Z) so the GL side can sample them with SVGPathElement.
NUMERALS: dict[str, list[str]] = {
    "0": ["M11 36 A19 19 0 0 1 49 36 L49 64 A19 19 0 0 1 11 64 Z"],
    "1": ["M19.5 28.5 L30 17 L30 83"],
    "2": ["M11 36 A19 19 0 1 1 43.66 49.2 L11 83 L49 83"],
    "3": ["M16.84 26.21 A14 14 0 1 1 30 45 A19 19 0 1 1 12.15 70.5"],
    "4": ["M39 83 L39 17 L11 63 L49 63"],
    "5": ["M47 17 L16 17 L14.44 53.1 A19 19 0 1 1 13.55 73.5"],
    "6": ["M43.86 17.18 A36 47 0 0 0 11 64 A19 19 0 1 0 49 64 A19 19 0 1 0 11 64"],
    "7": ["M11 17 L49 17 Q33 42 28 83"],
    "8": [
        "M15 31.5 A15 14.5 0 0 1 45 31.5 A15 14.5 0 0 1 15 31.5 Z",
        "M11.5 64.5 A18.5 18.5 0 0 1 48.5 64.5 A18.5 18.5 0 0 1 11.5 64.5 Z",
    ],
    "9": ["M16.14 82.82 A36 47 0 0 0 49 36 A19 19 0 1 0 11 36 A19 19 0 1 0 49 36"],
}
# Extras that are not cathodes of the stack: they sit on the front layer.
EXTRAS: dict[str, list[str]] = {
    "q": ["M15.9 26.87 A15 15 0 1 1 41.71 41.38 L30 56 L30 63"],
    "dash": ["M18 50 L42 50"],
}
DOT = (30.0, 80.0, 2.0)  # decimal point: a filled disc, centre and radius (stroke adds to it)

STACK_ORDER = ["1", "7", "4", "2", "5", "3", "9", "6", "0", "8"]  # front -> back
LAYER_STEP = 0.006  # scale lost per layer toward the back
CENTER = (30, 50)

CHAR_KEY = {**{d: d for d in "0123456789"}, ".": "dot", "?": "q", "-": "dash", " ": "blank"}


def layer_scale(key: str) -> float:
    return 1 - LAYER_STEP * STACK_ORDER.index(key) if key in STACK_ORDER else 1.0


def g_open(scale: float, extra: str = "") -> str:
    cx, cy = CENTER
    t = "" if scale == 1 else f' transform="translate({cx} {cy}) scale({scale:.3f}) translate({-cx} {-cy})"'
    return f'<g{t}{extra}>'


def glyph(key: str, data_attr: bool = True) -> str:
    """Paths for one glyph wrapped in its depth transform.
    data-nx marks the source paths meter-gl.js reads; data-layer is the stack position (0 = front, -1 = in front
    of the whole stack), so the WebGL cathodes sit at the same depths as this sprite."""
    tag = f' data-nx="{key}"' if data_attr else ""
    layer = f' data-layer="{STACK_ORDER.index(key) if key in STACK_ORDER else -1}"' if data_attr else ""
    cx, cy, r = DOT
    dot = f'<circle{tag} cx="{cx:g}" cy="{cy:g}" r="{r:g}" fill="currentColor"/>'
    if key == "dot":
        return f"{g_open(1.0, layer)}{dot}</g>"
    paths = NUMERALS.get(key) or EXTRAS.get(key) or []
    body = "".join(f'<path{tag} d="{d}"/>' for d in paths) + (dot if key == "q" else "")
    return f"{g_open(layer_scale(key), layer)}{body}</g>"


def build_sprite() -> str:
    sym = 'viewBox="0 0 60 100" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'
    out = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100">',
        "<!-- Divergence-meter Nixie numerals. Original monoline set for the WORLD LINE fan tribute.",
        "     GENERATED by tools/expand_meters.py (sprite option): edit the NUMERALS table there, not this file.",
        "     Stroke width is left unset so the page controls it (it inherits through <use>).",
        "     nx-0..nx-9, nx-dot, nx-q, nx-dash, nx-blank: one glyph each, on its stack layer.",
        "     nx-stack: all ten cathodes, back to front. nx-f-N: the cathodes stacked in front of N. -->",
    ]
    for key in list("0123456789") + ["dot", "q", "dash"]:
        out.append(f'<symbol id="nx-{key}" {sym}>{glyph(key)}</symbol>')
    out.append(f'<symbol id="nx-blank" {sym}/>')
    back_to_front = list(reversed(STACK_ORDER))
    out.append(f'<symbol id="nx-stack" {sym}>' + "".join(glyph(k, False) for k in back_to_front) + "</symbol>")
    for key in "0123456789":
        front = STACK_ORDER[: STACK_ORDER.index(key)]
        out.append(f'<symbol id="nx-f-{key}" {sym}>' + "".join(glyph(k, False) for k in reversed(front)) + "</symbol>")
    for key in ("dot", "q", "dash", "blank"):  # nothing stands in front of the front layer
        out.append(f'<symbol id="nx-f-{key}" {sym}/>')
    out.append("</svg>")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------------------------------------------------------
# Values


def tubes_for(value: str) -> list[str]:
    """8 display characters. Index 1 is the decimal tube and always '.'. Unknown characters become blanks."""
    v = value
    if "." in v:
        left, right = v.split(".", 1)
        first = left[-1:] if left else " "
    else:
        first, right = (v[:1] or " "), v[1:]
    digits = (right + "      ")[:6]
    chars = [first, "."] + list(digits)
    return [c if c in CHAR_KEY else " " for c in chars]


def display(chars: list[str]) -> str:
    return "".join(chars)


def label_for(chars: list[str]) -> str:
    rest = [c for i, c in enumerate(chars) if i != 1]
    if all(c == "?" for c in rest):
        return "Divergence meter: world line unknown"
    if all(c == "-" for c in rest):
        return "Divergence meter: no reading"
    return f"Divergence meter reading {display(chars).strip()}"


def meter_markup(size: str, value: str, sprite: str, indent: str = "", flags: dict | None = None) -> str:
    flags = flags or {}
    chars = tubes_for(value)
    shown = display(chars)
    esc = lambda s: html.escape(s, quote=True)  # noqa: E731
    classes = ["nx", f"nx--{size}"] + [c for c in flags.get("class", "").split(",") if c]
    attrs = [f'class="{esc(" ".join(classes))}"']
    if flags.get("id"):
        attrs.append(f'id="{esc(flags["id"])}"')
    attrs += ["data-meter", f'data-size="{size}"', f'data-value="{esc(shown)}"']
    if "ignite" in flags:
        attrs.append("data-ignite")
    attrs += ['role="img"', f'aria-label="{esc(label_for(chars))}"']
    svg = 'viewBox="0 0 60 100" aria-hidden="true" focusable="false"'
    lines = [f'{indent}<div {" ".join(attrs)}>']
    for c in chars:
        key = CHAR_KEY[c]
        href = f"{sprite}#nx-{key}"
        lines.append(
            f'{indent}  <span class="nx__tube" data-char="{key}">'
            f'<svg class="nx__stack" {svg}><use href="{sprite}#nx-stack"/></svg>'
            f'<svg class="nx__lit" {svg}><use class="nx__sheath" href="{href}"/><use class="nx__core" href="{href}"/></svg>'
            f'<svg class="nx__front" {svg}><use href="{sprite}#nx-f-{key}"/></svg>'
            "</span>"
        )
    lines.append(f'{indent}  <span class="nx__text">{esc(shown.strip())}</span>')
    lines.append(f"{indent}</div>")
    return "\n".join(lines)


# ---------------------------------------------------------------------------------------------------------------
# Marker expansion

OPEN_RE = re.compile(r'<!--\s*meter:(?P<size>[\w-]+)\s+(?:"(?P<q>[^"]*)"|(?P<v>[^\s"]+))(?P<flags>(?:\s+[\w-]+(?:=[^\s>]+)?)*)\s*-->')
CLOSE_RE = re.compile(r"<!--\s*/meter\s*-->")


def parse_flags(raw: str) -> dict:
    out = {}
    for tok in raw.split():
        k, _, v = tok.partition("=")
        out[k] = v
    return out


def expand_text(text: str, sprite_default: str, where: str = "") -> tuple[str, int]:
    out, pos, count = [], 0, 0
    for m in OPEN_RE.finditer(text):
        if m.start() < pos:  # inside a region we already replaced (cannot happen with well-formed markers)
            continue
        size = m.group("size")
        if size not in SIZES:
            raise SystemExit(f"{where}: unknown meter size {size!r} (use one of {', '.join(SIZES)})")
        value = m.group("q") if m.group("q") is not None else m.group("v")
        flags = parse_flags(m.group("flags") or "")
        line_start = text.rfind("\n", 0, m.start()) + 1
        indent = re.match(r"[ \t]*", text[line_start : m.start()]).group(0)
        close = CLOSE_RE.search(text, m.end())
        nxt = OPEN_RE.search(text, m.end())
        has_close = close is not None and (nxt is None or close.start() < nxt.start())
        body = meter_markup(size, value, flags.get("sprite") or sprite_default, indent, flags)
        out.append(text[pos : m.end()])
        out.append("\n" + body + "\n" + indent)
        if has_close:
            out.append(close.group(0))
            pos = close.end()
        else:
            out.append("<!-- /meter -->")
            pos = m.end()
        count += 1
    out.append(text[pos:])
    return "".join(out), count


def html_files(paths: list[str]) -> list[Path]:
    if paths:
        return [Path(p).resolve() for p in paths]
    found = []
    for root, dirs, files in os.walk(SITE):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        found += [Path(root) / f for f in files if f.endswith(".html") and not f.endswith("-snippet.html")]
    return sorted(found)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("files", nargs="*", help="HTML files (default: every *.html under the site)")
    ap.add_argument("--sprite", action="store_true", help="rebuild assets/meter/nixie.svg first")
    ap.add_argument("--check", action="store_true", help="report files that would change; write nothing")
    a = ap.parse_args(argv)

    changed = []
    if a.sprite:
        svg = build_sprite()
        if not SPRITE.exists() or SPRITE.read_text(encoding="utf-8") != svg:
            changed.append(SPRITE)
            if not a.check:
                SPRITE.parent.mkdir(parents=True, exist_ok=True)
                SPRITE.write_text(svg, encoding="utf-8")

    total = 0
    for f in html_files(a.files):
        text = f.read_text(encoding="utf-8")
        rel = os.path.relpath(SPRITE, f.parent).replace(os.sep, "/")
        new, n = expand_text(text, rel, str(f))
        total += n
        if new != text:
            changed.append(f)
            if not a.check:
                f.write_text(new, encoding="utf-8")

    verb = "would change" if a.check else "updated"
    for f in changed:
        print(f"{verb}: {os.path.relpath(f, SITE)}")
    print(f"{total} meter marker(s) expanded, {len(changed)} file(s) {verb}.")
    return 1 if (a.check and changed) else 0


if __name__ == "__main__":
    sys.exit(main())
