#!/usr/bin/env python3
"""render_og.py: render assets/og.png (1200 x 630), the Open Graph image, from the live hero.

Last updated: 2026-09-25
It serves the site, opens index.html at 1200 x 630 under reduced motion (so the meter is a still: no ignite,
no WebGL) and screenshots the first screen. Run it after tools/expand_meters.py so the meter is in the page.
Usage: python3 tools/render_og.py
"""
import functools
import http.server
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / 'assets' / 'og.png'


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(SITE)))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1, reduced_motion='reduce')
        pg.goto(f'http://127.0.0.1:{httpd.server_address[1]}/index.html', wait_until='networkidle')
        pg.evaluate('document.fonts.ready')
        time.sleep(1.0)
        pg.screenshot(path=str(OUT))
        b.close()
    print(f'wrote {OUT.relative_to(SITE)}')
finally:
    httpd.shutdown()
