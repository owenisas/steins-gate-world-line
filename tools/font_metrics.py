#!/usr/bin/env python3
"""font_metrics.py: measure Erode against Georgia in Chromium and print a metric-matched fallback @font-face.

Last updated: 2026-09-25
Why: Erode loads from the Fontshare CSS API with font-display: swap. A fallback whose width and vertical
metrics match keeps the swap from shifting layout (CLS). The math follows Capsize:
  size-adjust     = average advance of Erode / average advance of Georgia (same sample text)
  ascent-override = Erode ascent / size-adjust, descent-override = Erode descent / size-adjust
Usage: python3 tools/font_metrics.py          (needs network for the Fontshare font; paste the output into site.css)
"""
from playwright.sync_api import sync_playwright

SAMPLE = 'The girl in the blood. Operation Urd, Verthandi, Skuld: a world line chosen, not granted. 0123456789'
PAGE = """<!doctype html><html><head>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=erode@400&display=block"></head>
<body><p style="font-family:Erode">x</p></body></html>"""

JS = """async (sample) => {
  await document.fonts.load('400 100px Erode');
  await document.fonts.ready;
  const c = document.createElement('canvas').getContext('2d');
  const m = (font) => { c.font = font; const t = c.measureText(sample); return { w: t.width, a: t.fontBoundingBoxAscent, d: t.fontBoundingBoxDescent }; };
  return { erode: m('400 100px Erode'), georgia: m('400 100px Georgia'), loaded: document.fonts.check('400 100px Erode') };
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.set_content(PAGE, wait_until='networkidle')
    r = pg.evaluate(JS, SAMPLE)
    b.close()

if not r['loaded']:
    raise SystemExit('Erode did not load (network?)')
e, g = r['erode'], r['georgia']
size = e['w'] / g['w']
print(f"/* measured: Erode w={e['w']:.1f} asc={e['a']:.1f} desc={e['d']:.1f}; Georgia w={g['w']:.1f} (100px) */")
print('@font-face {\n  font-family: "Erode Fallback";\n  src: local("Georgia");')
print(f"  size-adjust: {size * 100:.1f}%;\n  ascent-override: {e['a'] / size:.1f}%;\n  descent-override: {e['d'] / size:.1f}%;\n  line-gap-override: 0%;\n}}")
