# WORLD LINE: an unofficial Steins;Gate world-line journal

Last updated: 2026-09-25

**Live:** https://steins-gate-world-line.vercel.app · **License:** MIT for the code and original artwork (see [LICENSE](LICENSE); the franchise belongs to its owners)

An unofficial, non-commercial fan tribute. A static site that retells the nine world-line shifts of Steins;Gate (Akihabara, summer 2010) as a lab journal, read on an original eight-tube divergence meter that rolls to a new value as you scroll into each chapter or send a D-mail. Behind the chapters runs the world-line loom: Suzuha's twisted yarn, built in WebGL, that the story plays on as you scroll (DESIGN §11).

v3 (DESIGN §12) opens it to people who have never seen the show and cuts the scrolling. Two doors at the hero choose a reading mode. A one-minute, spoiler-free primer explains four ideas with small working demos. Terms explain themselves in place. The second half waits behind a spoiler gate. Every chapter leads with a one-sentence summary and keeps its prose one click away. A world-line navigator, prev/next links, J/K keys and deep links move through the story.

The spec is [DESIGN.md](DESIGN.md). The story facts come from [research/lore.md](research/lore.md) and the grade, type and legal notes from [research/identity.md](research/identity.md). Both are read-only inputs.

## Run it

The meter's `<use href="assets/meter/nixie.svg#…">` sprite needs http, not `file://`.

```bash
git clone https://github.com/owenisas/steins-gate-world-line.git
cd steins-gate-world-line
python3 -m http.server 8000
```

Then open http://localhost:8000/ (journal), http://localhost:8000/lab.html (the lab) and http://localhost:8000/404.html.

### The meters

The HTML carries marker pairs where each meter goes; the meter build fills them with static SVG markup (the no-JS poster), and `assets/meter/meter.js` animates it:

```html
<!-- meter:hero 1.130426 ignite --><!-- /meter -->   index hero (the loader ignites it once per session)
<!-- meter:mini 1.130426 --><!-- /meter -->          nav, every page (1.048596 on lab.html and 404.html)
<!-- meter:footer 1.048596 --><!-- /meter -->        footer, every page
<!-- meter:404 ?.?????? --><!-- /meter -->           404.html
```

After editing any marker, re-run the expander (idempotent; `--check` exits 1 if a file would change):

```bash
python3 tools/expand_meters.py
```

Every marker sits inside a wrapper this site owns, `[data-meter-slot="nav|hero|footer|404"]` with a `data-reading` attribute. While a slot is still empty (markers not expanded), CSS shows that reading as a text stand-in, so the pages stay composed either way.

### Tests

```bash
python3 tests/test_site.py                       # all pages, all scenarios
python3 tests/test_site.py --pages index --scenarios normal,keyboard -v
```

Needs Python Playwright with Chromium, Pillow, and network access to the CDNs (except in the `cdn-blocked` scenario). It serves the site itself on a free port. Screenshots and `test_site_results.json` go to `../tmp/steins-gate-qa/`.

Scenarios, each on index, lab and 404 in a fresh browser: `normal`, `nojs`, `reduced` (prefers-reduced-motion), `nowebgl`, `cdn-blocked` (jsDelivr, Fontshare and Google Fonts aborted), `mobile` (390 x 844 touch: no horizontal overflow, nav items and the Chapters tab do not collide, the Chapters tab opens the menu, the hero meter fits, no text under 12px), `keyboard` (Tab walk: skip link first, every stop ringed, on screen and clear of the fixed nav) and `v3` (DESIGN §12.8, below). A per-frame monitor fails any run where content that was on screen at first paint is hidden for even one frame. The file adapts the awwwards-web-design skill's `recipes/test_recipes.py`.

The scenarios that walk the whole story (`normal`, `reduced`, `nowebgl`, `cdn-blocked`, `mobile`, `keyboard`) read as a returning fan (`localStorage.reader = 'fan'`), so the spoiler gate is open and every v1/v2 check still covers chapters 4-9. `nojs` and `v3` start as a first-time newcomer with the gate shut. Content inside a closed `<details>` or a closed `<dialog>`, and a `[data-responsive]` control that is off at that width, count as not on the page rather than as hidden by motion.

`v3` checks, on index: newcomer by default with the gate shut and chapters 4-9 not rendered, and the menu and navigator marking all six; the page at 1440 with everything closed at least 35% shorter than v2 (v2 is measured live from `../tmp/steins-gate-backup/` when it is there); term explainers open on Enter and Space beside the term, close on Esc and give focus back; "I've seen it" stores fan mode, opens the gate and lands on chapter 1; the mode persists across reloads, and the menu switch flips it back and shuts the gate; the navigator lands on a chapter, lights its node and the meter reads that chapter's line; K and J step a chapter; J into the shut gate asks first, and declining stays put; a gated navigator node asks and then opens; J and K type into the composer and move nothing; opening "Read the full chapter" fires no jump, knot or blink, and afterwards every chapter 3 ledger row still shifts the meter at the centre with the loom at the same beat (drift under 0.05 path units), and again after closing; deep links `#ch-07` (opening the gate), `#ch-02`, `#primer`, `#lab` and `#dmail` land where they should. On lab it checks the member and glossary anchors, and on lab and 404 the Chapters tab. `nojs` adds that every term is a plain link to an anchor that exists on lab.html. Output for this pass went to `../tmp/steins-gate-qa/v3/test-run/`.

QA note: capture long screenshot walks with Playwright's `channel="chromium"` (as `test_site.py` does). The bare headless shell launched with `--use-angle=metal --enable-gpu` exits by itself about 32 s after launch, even on `about:blank`.

Loom checks (index): in `normal` and `mobile` the WebGL loom mounts and draws non-blank frames (yarn-coloured pixels on the stage), stays in its triangle budget (≤ 250k desktop, ≤ 120k touch) at DPR ≤ 1.5, and leaves at most one un-lost WebGL context after it starts; ledger rows carry no card fills or boxes (at rest, current and hovered); the copy holds ≥ 4.5:1 (≥ 3:1 for display type) against the stage, measured in pixels with the copy hidden at three scroll frames in chapters 2, 3, 5, 6, 8 and 9 at 1440 and 2, 5 and 8 at 390; `seekTo()` lands on a chapter without a burst of jump events and reaches the same state from above and below. In `reduced`, `nowebgl`, `nojs` and `cdn-blocked` there is no loom canvas and the static map is visibly drawn. A failed run that saw a dropped request (`ERR_CONNECTION_RESET` from the threaded test server under load) is re-run once before it counts.

### The loom (DESIGN §11)

The nine chapters play on a scroll-scrubbed 3D cord drawn by `assets/js/loom.js` (three.js 0.186.1) into a sticky, full-viewport stage behind `#journal`:

- **What it shows.** Time runs along the cord. The α strand (12 muted red threads) and the β strand (12 slate blue) are twisted into one two-ply cord; each thread is a world line. The pale Steins Gate thread runs down the axis, in the gap between the strands. Knots pinch a whole strand to one point where the lore converges it (β Jul 28, α Aug 13 and Aug 15). A neon spark (the only neon in the scene) rides the threads with a fading trail; jumps are arcs and time leaps are hoops.
- **The story on it.** Ch 1 the spark rides β into the Jul 28 knot and the first D-mail arcs it across the gap to α; ch 2 a calm ride; ch 3 five hops outward, one per ledger row; ch 4 into the Aug 13 knot (a flash, a thud if sound is on) as the page falls to night; ch 5 visible time-leap hoops back from the knot, shorter each time, then the 0.409431 hop over it; ch 6 the hops of ch 3 in reverse; ch 7 the long leap across the gap to β; ch 8 the flight backward to Jul 28 and the slip onto the Steins Gate thread just before the β knot; ch 9 that thread lit along its length while the strands relax and drift apart.
- **Sync.** Every beat is keyed to a real DOM position (a chapter top, a ledger row, a `[data-worldline]` paragraph crossing the viewport centre, the same line `shift.js` uses), so the loom, the meter roll, the monochrome blink and the live region stay together at any viewport size. The scene is a pure function of scroll: deep links and seeks land on the right state without replaying the beats in between.
- **Text over the stage.** Copy stays DOM in a left column (grid columns 1-5) over a scrim painted from the run's own ground; ledger rows are annotations (a thread-coloured hairline, date, sender, `before → after`), never cards. Projected, `aria-hidden` labels annotate each jump point with a leader. On phones the copy runs full width, each text block gets its own 95% backing, and the gaps between chapters are open windows onto the cord.
- **Budget.** Starts once the reader scrolls into `#journal` (a one-viewport margin would fire at load, since the hero is exactly one viewport tall); releases the hero's GL meter first (one live WebGL context); DPR ≤ 1.5; renders only on change plus a ≤ 5 s idle sway; pauses offscreen and in hidden tabs; disposes on `pagehide` and on a live switch to reduced motion. 147,854 triangles in 4 draw calls on desktop, 84,878 on touch or phone-width stages.
- **Fallbacks.** No JS, reduced motion, no WebGL2 or a blocked CDN: the static SVG map `assets/loom/loom-map.svg` (drawn by `tools/render_loom_svg.py` from the same parameters) is the stage, sticky in each run, in the run's own colourway.
- **Sound (opt-in).** Each jump plucks a synthesized string (Karplus-Strong; the pitch follows the divergence value it lands on) and each knot gives a low thud.
- **Hooks for the navigator.** `window.__journal.seekTo('ch-05' | 5 | '0.409431', { immediate, duration })`, `window.__journal.chapter`, and the document event `loom:chapter` `{ id, index, previous }` work in every mode; `window.__loom` adds `state()`, `highlight(value)`, `seekTo()` and `coalesce()` when the WebGL loom is live. Beats re-measure on every ScrollTrigger refresh, and the loom re-measures on the next frame when a `<details>` toggles (quietly: no pluck, thud or flash).
- **v3.** Beats and markers inside a closed `<details>` are skipped. With the spoiler gate shut the journal ends with the spark short of the Aug 13 knot; open, the story runs to the end. Chapter 4's poster, chapter 7's split and chapter 9's quiet line have their own cameras (`hinge`, `split`, `quiet`). The stage's lower edge dissolves where `#journal` ends.

Regenerate the map after changing the `PARAMS` block in `loom.js`:

```bash
python3 tools/render_loom_svg.py            # writes assets/loom/loom-map.svg
python3 tools/render_loom_svg.py --check    # exits 1 if the map is stale
```

### Tools

| Script | Does |
|---|---|
| `tools/expand_meters.py` | Fills the meter markers (owned by the meter build; see its header for the marker grammar). |
| `tools/font_metrics.py` | Measures Erode against Georgia in Chromium and prints the metric-matched `Erode Fallback` @font-face used in `site.css` (no layout shift on swap). |
| `tools/render_og.py` | Renders `assets/og.png` (1200 x 630) from the hero under reduced motion. Run it after the expander. |
| `tools/render_loom_svg.py` | Draws the static loom map `assets/loom/loom-map.svg` from the `PARAMS` block in `assets/js/loom.js` (`--check` for staleness). |
| `tools/render_primer_svg.py` | Draws the primer's figure (three threads tied into a bundle, the spark, the waiting D-mail arc, the value labels) into `index.html` between `<!-- primer:threads -->` markers, wide and tall versions (`--check` for staleness). |

## Structure

```
steins-gate-site/
  index.html            the journal: hero with two doors, the primer, 9 chapters over the loom stage (4-9 behind the
                        spoiler gate), D-mail composer, footer; the navigator, the spoiler confirm and the term explainers
  lab.html              lab members 001-008 (hover a row: the nav meter reads their line), glossary, places
  404.html              world line not found: the meter cycles and never locks
  assets/
    css/tokens.css      the skill's recipes/tokens.css, extended with the palette, grade, faces and scale
    css/site.css        the visual system
    js/main.js          boot: nav ground, chapter index, sound, shift, composer, motion, hero, lab rows, 404
    js/shift.js         world-line shift orchestrator (markers, roll, Reading Steiner blink, live region)
    js/dmail.js         D-mail composer (Shift-JIS bytes, 36-byte limit, deterministic hash, easter eggs)
    js/sound.js         opt-in WebAudio synth (mains hum, relay clicks, shift swell, DTMF, loom plucks and thuds)
    js/loom.js          the world-line loom: three.js cord, spark, scroll beats, labels, navigation hooks
    js/reader.js        reading mode, the spoiler gate and its confirm, one route for every jump, J/K, deep links,
                        the navigator's current node
    js/terms.js         term explainers: links become popover buttons, placed by anchor positioning
    js/primer.js        the primer's demos: point at a thread, re-read the meter, Shift
    js/vendor/          the skill's motion-core, page-transitions, magnetic recipes and boot snippet
    meter/              the divergence meter (nixie.svg, meter.css, meter.js, meter-gl.js): separate build
    loom/loom-map.svg   the static loom map (generated), the stage without WebGL
    favicon.svg, og.png
  tests/test_site.py    Playwright scenarios
  tools/                expand_meters.py (meter build), font_metrics.py, render_og.py, render_loom_svg.py,
                        render_primer_svg.py
  research/             lore.md, identity.md (inputs)
```

No build step: static HTML, ES modules and an import map pinned to gsap 3.15.0, lenis 1.3.26 and three 0.186.1 on `cdn.jsdelivr.net/npm/`. Only `vendor/motion-core.js` and `vendor/magnetic.js` depend on the CDN, and `main.js` imports them dynamically, so the composer, the sound toggle, the chapter index and the shift orchestrator keep working when the CDN is down.

### How the pieces talk

- `shift.js` treats every `[data-worldline]` element (chapter sections, marked paragraphs, ledger rows) as a marker. When one crosses the viewport centre it calls `meter(navMeter).shiftTo(value)`, blinks the page monochrome at the first `meter:lock` (a fixed overlay with `backdrop-filter: grayscale(1)`, 160 ms in, 480 ms out, at most once per 900 ms), announces "World line shifted to …" once per chapter in a polite live region, and dispatches `worldline:shift` `{ from, to, source }` on `document`. Scrolling back returns to the previous value. Reduced motion: instant swap, no blink.
- `dmail.js` dispatches `dmail:key` `{ key }` and `dmail:sent` `{ value, hours }`; the send shifts the nav meter through `shift.js`. Easter eggs: "El Psy Kongroo" 1.048596, "tutturu" 0.337187, "fibonacci" 1.123581, "gamma" 2.615074, "faris" a dark first tube then 275349, "beta" anywhere lands on a 1.xxxxxx line.
- `sound.js` listens for `meter:lock` (relay click), `worldline:shift` (swell) and `dmail:key` (DTMF). It creates no AudioContext until the toggle is pressed.
- `main.js` hands the hero stage `#meter-gl` to `meter-gl.js` (`mountMeterGL(stage, { value, signal })`) after load and idle, only with full motion, working WebGL and no Save-Data. Once the reader scrolls into `#journal` it imports `loom.js` and mounts the loom; the loom's `beforeContext` aborts and disposes the hero's GL meter first, so only one WebGL scene is ever live (the hero keeps its DOM meter and a DOM re-read).
- `loom.js` reads scroll through the shared ScrollTrigger (Lenis-synced), dispatches `loom:jump` `{ id, size, value, reverse }`, `loom:knot` `{ mark }` (coalesced: never during a seek or a fling) and `loom:chapter`; `sound.js` plucks and thuds on the first two.
- `reader.js` routes every `[data-go]` link (doors, navigator, chapter menu, prev/next, primer links) and J/K: it closes the menu, asks through `#spoiler-confirm` before entering the shut gate, then scrolls once with `seekTo` / `scrollToY` (0.9 s, instant under reduced motion) while `shift.coalesce()` holds the meter and `__loom.coalesce()` keeps the loom quiet. The hash follows with `pushState`. It sets `html[data-reader]` and localStorage `reader`, and lights the navigator node on `loom:chapter`. `shift.js` skips markers inside a closed `<details>` and follows a `<details>` toggle quietly (no blink, no announcement).
- `terms.js` swaps each `a.term[data-term]` for `<button popovertarget="tip-…">`; the explainer is a `popover` in index.html. `primer.js` drives the figure, the small meter (`[data-meter-slot="primer"]`, through `controllerFor`) and the Shift demo, using `shift.blink()` for the monochrome blink.
- QA hooks: `window.__motion` (the motion-core api), `window.__worldline` (the shift controller) and `window.__reader` (`go(id)`, `setMode('new'|'fan')`, `askSpoilers()`).

## Type

| Role | Face | Licence and source |
|---|---|---|
| Display: titles, wordmark, journal voice | **Erode** 400/500 and italic, by the Indian Type Foundry | Free for personal and commercial use under Fontshare's licence (ITF Free Font License). Served by the Fontshare CSS API; not redistributed here. |
| Data: divergence values, dates, byte counts, member numbers | **Necto Mono**, by Collletttivo | SIL Open Font License 1.1. Served by jsDelivr's GitHub endpoint at a pinned commit (`collletttivo/necto-mono@db9edb7`). |
| Phone screen only | **DotGothic16**, by Fontworks | SIL Open Font License 1.1. Google Fonts. |
| Body | `system-ui` | The platform face. |

Why Erode: the three Fontshare candidates from DESIGN §6 (Sentient, Zodiak, Erode) were rendered at 120 px and 32 px on the lab ground (`../tmp/steins-gate-qa/fonts/`). Zodiak's high contrast and ball terminals lean toward the Didone "luxury serif" the house law rejects, and its hairlines thin out at 13-32 px on the dark ground. Sentient is warm but wide and soft, with an old-style feel that sits closer to the Garamond caps of the official logo. Erode is condensed and low-contrast with cut wedge serifs: it reads like a lab notebook, holds up at small sizes on both grounds, echoes the tall 3:5 Nixie numerals, and its narrow set keeps long titles ("Operation Verthandi", "The girl in the blood") to two lines at every width.

## Decisions worth knowing

The loom's own decisions (the ones §11 left open) are listed in DESIGN.md §11, "v2 handoff", and v3's in §12, "v3 handoff".

- **Page height (DESIGN §12.5), `index.html` with every "Read the full chapter" closed**, measured in Chromium after fonts load (v2 from `../tmp/steins-gate-backup/`):

  | Viewport | v2 | v3, newcomer (the default: gate shut) | v3, fan (gate open) |
  |---|---|---|---|
  | 1440 x 900 | 14,534 px | 8,770 px (39.7% shorter) | 13,902 px (4.3% shorter) |
  | 390 x 844 | 16,495 px | 10,144 px (38.5% shorter) | 15,623 px (5.3% shorter) |

  The fan's page includes the primer (about 1,700 px at 1440), which the "I've seen it" door skips. With every chapter open, the v3 journal alone (the loom section) is 9,579 px against v2's 11,776 at 1440 (19% shorter) and 10,137 against 13,657 at 390 (26% shorter). Regular chapters are about 0.85-1.05 viewports with the prose closed.

- **Chapter title scale.** DESIGN §6 gives `clamp(3rem, 7.5vw + 1rem, 9.5rem)`, which is 124 px at 1440 (not 150) and has a max of 3.2 x its min. The skill's WCAG rule caps max at 2.5 x min, so the site uses `clamp(3rem, 7.5vw + 1rem, 7.5rem)`: 48 px at 390, 120 px at 1440.
- **Meta ink.** The spec's 60 % ink step passes 4.5:1 on lab night (4.8) but not on summer haze (4.1), so small text uses a 68 % step (6.0 and 5.1). The 12/24/60 % steps remain for rules, fills and text of 24 px and up.
- **The fall to night.** Between 34 % and 53 % of the way from haze to lab, neither ink reaches 4.5:1, so no text sits on the midpoint of the morph. In v3 the page falls to night after chapter 3, over a long, text-free, grained gradient, and the spoiler gate is the first thing on night: the comedy ends there, and chapters 4-9 all sit on lab night. It is scrubbed by the scroll itself and needs no JS.
- **One continuous day.** Chapters 1-3 share one wash from noon glare (#D2D4CC) to afternoon (#C3C6BD), so the haze never seams between sections. Grain sits on the substrate only and fades out wherever it meets an ungrained ground.
- **Ledger mirror.** Chapter 6 mirrors chapter 3: the rail moves to the right, the title aligns right, and each row reads right to left (`0.456914 ← 0.409431`) while the DOM order stays logical for screen readers.
- **The nav plate** follows the ground under it (haze or lab, transparent over the hero) with an ink flip; without JS it stays lab-dark.
- **404 hosting.** The pages use relative asset paths. A host that serves `404.html` for deep paths needs a `<base href="/your-root/">` in `404.html` (and the expander's `sprite=` flag for the meter).
- **No canonical URL** is set because there is no deployment URL yet; add one per page when there is.

## Credits

Research (paraphrased; see the source tables in `research/lore.md` and `research/identity.md`): the Steins;Gate Wiki on Fandom, Wikipedia (Steins;Gate, the TV series, Steins;Gate 0, the film, Science Adventure), Kiri Kiri Basara (the 2026 Akihabara pilgrimage notes and franchise status), Anime News Network, Famitsu and Dengeki Online (the Divergence Meter clock), brotoro.com and taricorp.net (meter replica analysis), the SciADV wiki, and the Nixie tube articles cited in `identity.md`.

Built with the awwwards-web-design skill (its tokens, motion-core, page-transitions and magnetic recipes, and its test harness). Motion: GSAP 3.15.0 (free standard licence), Lenis 1.3.26 (MIT), three.js 0.186.1 (MIT).

## Disclaimer

Unofficial, non-commercial fan tribute. Not affiliated with MAGES., Nitroplus, White Fox or any rights holder. Steins;Gate and all related names belong to their owners. No official assets are used on this site.

No official artwork, screenshots, logos, character art, music, sound effects or fonts are used. The meter, its numerals, the phone, the map and every sound are original. Only three catchphrases appear verbatim: "El Psy Kongroo", "Tutturu" and "the choice of Steins Gate".

## Deploy (Vercel)

Any static host works. With the Vercel CLI, from this folder:

    vercel deploy --prod

In a non-interactive shell, add `--yes --scope <your-team>`. `.vercelignore` keeps research, tests, tools, dev pages, notes and `.env*` off the deployment. `vercel link` writes a `.env.local` holding a Vercel OIDC token: it is gitignored, so never commit or deploy it. `404.html` uses root-absolute paths, because Vercel serves it for any missing URL (for example `/a/b/c`).
