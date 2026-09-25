# WORLD LINE: an unofficial Steins;Gate world-line journal

Last updated: 2026-09-25

This is the design spec. It was produced with the `awwwards-web-design` skill (`.agents/skills/awwwards-web-design/`) and follows that skill's loop, with research in `research/lore.md` and `research/identity.md`. Builders follow it exactly; when something is missing, choose the option that matches the skill's rules and the anti-slop law (`deslop-law.md`), and note the choice in the handoff.

## 0. Legal frame (non-negotiable)

- Unofficial, non-commercial fan tribute. No official artwork, screenshots, logos, character art, music, sound effects or fonts. Every visual is original: procedural WebGL, SVG or CSS.
- Do not recreate the Steins;Gate logo (bold Garamond-style caps with gear/semicolon device). The title is set in our own type as plain text: `Steins;Gate`.
- Quotes: only the catchphrases "El Psy Kongroo", "Tutturu" and "the choice of Steins Gate" appear verbatim. Everything else is our own summary.
- The footer on every page carries: "Unofficial, non-commercial fan tribute. Not affiliated with MAGES., Nitroplus, White Fox or any rights holder. Steins;Gate and all related names belong to their owners. No official assets are used on this site."

## 1. Brief (skill step 1)

What the subject really has:
- **An object:** the Divergence Meter. Eight Nixie tubes read `D.DDDDDD`: seven digits plus a tube that lights only the decimal point. Neon glow is orange (core `#FFD7A0`, glow `#FF6A00`, halo `#FF3D00`); unlit cathode wire is `#5E5A52`, and the cathodes are stacked front to back.
- **A process:** world-line shifts. A D-mail (a text message of at most 36 bytes, sent into the past) changes history. Only Okabe remembers ("Reading Steiner"), and his vision goes monochrome for a moment.
- **A place:** Akihabara, summer 2010, and the Future Gadget Laboratory, 2F above Mr. Braun's CRT shop.
- **A story:** 9 beats. Each has a date, a divergence number and a D-mail that caused it (section 5).
- **Tone:** chuunibyou comedy that turns into a looping tragedy at the hinge (Aug 13). The theme is the cost of changing the past: every D-mail granted a friend's wish, and each must be undone.

## 2. Jury lens (step 2)

- **Target:** SOTD band (≥ 7.4); stretch goal SOTM (7.7).
- **Cheapest points:** Usability and Accessibility, where winners lose most. They are covered by content visible by default, a real reduced-motion state, keyboard access and contrast.
- **Creativity:** from the signature being *played* (scroll shifts, D-mail sends).
- **Content:** from real, specific story facts: dates, numbers, names.

## 3. Direction and signature (steps 3-4)

**Decision line:** Object hero (+ Editorial type voice) for Steins;Gate: *the Divergence Meter re-reads the world line whenever the visitor scrolls into a chapter or sends a D-mail.* Ground `#0E0F0D` (lab night) / `#C9CCC3` (summer haze), ink `#D6D9CF` / `#1B1D19`, accent `#FF6A00`, only as the meter's neon. Display: an editorial serif (section 6) at up to 150px. Clock: the object on stepped time (45-70ms digit cycles); the DOM on expo-out, with a 200/600/1000/1400ms ladder.

**Signature spec:** The divergence meter rolls its eight tubes to a new world line when the visitor scrolls into a chapter or sends a D-mail.
- **At rest:** eight glowing tubes reading a number.
- **Touchpoints where it returns:**
  - the loader: tubes ignite, cycle and lock on 1.130426
  - the nav: a mini meter that is the chapter index
  - every chapter shift: a roll plus a monochrome blink
  - page transitions: the mini meter stays still while the page changes under it
  - the D-mail composer: sending shifts the meter
  - the footer: 1.048596
  - the 404: a reading of `?.??????`, with tubes flickering and failing to lock
- **Cost:** procedural geometry only, three.js loaded after LCP, and an SVG meter as the poster.

**Swap test:** only Steins;Gate has this object. **Motion-off still:** the SVG meter reading 1.130426 in the hero.

## 4. Pages and structure

```
steins-gate-site/
  index.html        the world-line journal (hero, 9 chapters, D-mail composer, footer)
  lab.html          lab members 001-008, glossary, Akihabara places
  404.html          world line not found
  assets/
    css/tokens.css  copied from the skill's recipes/tokens.css, then extended (palette, type)
    css/site.css
    meter/nixie.svg         SVG sprite: symbols nx-0..nx-9, nx-dot, nx-blank, nx-stack (unlit cathode stack)
    meter/meter.css         DOM meter styles (glow, tube glass, mesh), used everywhere
    meter/meter.js          DOM meter controller: shiftTo(), ignite(), flicker/fail for 404
    meter/meter-gl.js       three.js hero meter (WebGL layer over the DOM poster)
    js/main.js              boot: motion-core init, shift orchestrator, nav, composer, sound
    js/shift.js             world-line shift orchestrator (events, monochrome blink, a11y announcements)
    js/dmail.js             D-mail composer
    js/sound.js             opt-in WebAudio synth
    js/vendor/              motion-core.js/.css, page-transitions.js/.css, magnetic.js copied from the skill's recipes/
  tests/test_site.py        Playwright scenarios (adapt the skill's recipes/test_recipes.py)
  tools/                    small helper scripts (e.g. render meter markup, OG image)
  README.md                 how to run, structure, credits, disclaimer
```

Static HTML, ES modules, an import map, no build step. Pinned versions come from the skill: gsap 3.15.0, lenis 1.3.26, three 0.186.1 via `cdn.jsdelivr.net/npm/`. Serve with `python3 -m http.server` from `steins-gate-site/`, since `<use href="assets/meter/nixie.svg#…">` needs http, not `file://`.

## 5. Content: the journal (index.html)

1. **Hero.** Owned by the meter.
   - `h1`: "Steins;Gate", set in the display serif at a quiet size (the object carries the scale).
   - Subline: "An unofficial world-line journal. Akihabara, summer 2010."
   - Meta line in mono: `WORLD LINE 1.130426β · JUL 28 2010 · RADIO KAIKAN`.
   - A "Begin" anchor to chapter 1.
   - A spoiler note: "Chapters 4-9 reveal the second half."
2. **Chapters.** Each is one `<section>` with `data-worldline`.

| # | Title (ours) | Dates 2010 | Field | Divergence | What changes it |
|---|---|---|---|---|---|
| 1 | The girl in the blood | Jul 28 | β→α | 1.130426 → 0.571024 | Okabe texts Daru that Kurisu has been stabbed. The text arrives a week early: the first D-mail. |
| 2 | The PhoneWave (name subject to change) | Jul 28 - Aug 2 | α | 0.571024 | The lab, gelbanas, John Titor on @channel, SERN, the IBN 5100. |
| 3 | Operation Urd | Aug 3 - Aug 10 | α | 0.571015 → 0.523299 → 0.456903 → 0.409420 → 0.337187 | Five D-mails, five friends' wishes: Loto 6, Moeka, Luka, Faris, Okabe. |
| 4 | Time leap (spoilers) | Aug 11 - Aug 13 | α | 0.337187 | The Time Leap Machine; the raid; Mayuri dies. The hinge. |
| 5 | Convergence | Aug 13 - 14, looped | α | 0.337187 → 0.409431 | She dies every time. Suzuha is John Titor. The 1% barrier. |
| 6 | Operation Verthandi | Aug 14 - 15 | α | 0.409431 → 0.456914 → 0.523307 → 0.571046 | Undoing each wish in reverse order. |
| 7 | The choice | Aug 15 - 17 | α→β | 0.571046 → 1.130205 | Deleting the first D-mail saves Mayuri and loses Kurisu. |
| 8 | Operation Skuld | Aug 21 → Jul 28 | β→SG | 1.130205 → 1.048596 | Deceive the world: the metal Upa, the stab, the blood. |
| 9 | Steins Gate | Aug 21 onward | none | 1.048596 | Nobody has to die. A chance meeting on an Akihabara street. |

   - Chapter copy comes from `research/lore.md`, in our own words: 80-160 words each, specific (names, dates, places), no verbatim dialogue. Mark chapters 4-9 with a small "Spoiler" label, and give chapter 4 a skip link to the composer.
   - Chapter 3 lists its five shifts as a vertical "shift ledger": date, sender, divergence before → after. The ledger is the editorial device, and the mini meter rolls on each row as it crosses the viewport centre.
   - Chapter 6 reuses the ledger in reverse (the undo). Visually it is the mirror of chapter 3.
3. **D-mail composer** ("Send a D-mail"). Specified in section 9.
4. **Footer.** The meter at 1.048596 in a large DOM meter (no WebGL), with "El Psy Kongroo." beneath it in the display serif. Below that: nav links, a credits line (research sources: Steins;Gate Wiki on Fandom, Wikipedia), the disclaimer from section 0, and "Made with the awwwards-web-design skill".

**lab.html**
- Lab members 001-008 as an index table: number, name, one-line role, the D-mail or turning point tied to them. Mono for numbers only. Hovering a row shows that member's world line on the mini meter (tonal state change, no box movement).
- Glossary: 20-30 terms, from lore.md §3.
- Places: fiction → real Akihabara, from lore.md §5. Draw a simple original SVG diagram, not a map tile: the Suehirochō / Radio Kaikan / shrine / UDX relative positions, labelled as approximate.

**404.html:** "World line not found." The meter flickers `?.??????` and fails to lock (reduced motion: a static `-.------`). The copy is one line plus a link back to 1.048596, the home page.

## 6. System (step 5)

**Palette (tokens in `tokens.css`)**
- `--lab` `#0E0F0D` (night ground) and `--lab-ink` `#D6D9CF`.
- `--haze` `#C9CCC3` (summer haze ground) and `--haze-ink` `#1B1D19`.
- Tonal steps for rules and meta, computed with `color-mix`: 12%, 24% and 60% ink on ground.
- **Neon:** `--nx-core #FFD7A0`, `--nx-glow #FF6A00`, `--nx-halo #FF3D00`, `--nx-wire #5E5A52`. Neon appears only on the meter's lit digits and at most one live UI state: the composer's byte counter at the limit. No orange text, chips or buttons.
- **Chapter grounds:** chapters 1-3 are summer haze. Chapter 4 is the hinge: its section fades haze → lab over its height, scrubbed with scroll. Chapters 5-9 are lab night. The hero and footer are lab night.
- **The anime grade**, made original: desaturated, grey-green midtones, lifted blacks, a white haze fading down from the top of the hero. This lives inside the WebGL scene and as a substrate gradient behind content. Never lay grain or haze over text.
- **Contrast:** ink-on-ground ≥ 4.5:1 for body text, measured on the worst frame.

**Type (render candidates at size, then pick)**
- **Display (journal voice):** an editorial serif with character, self-hosted or served through the Fontshare CSS API.
  - Candidates: Sentient, Zodiak, Erode (all Fontshare, free).
  - Render each at 120px and 32px on `--lab`, pick one and note why in the handoff.
  - Banned (law): Fraunces, Cormorant, Playfair, Didones, Instrument Serif, EB Garamond, and anything Garamond-caps (too close to the logo).
- **Body:** `system-ui`, 18px desktop / 17px mobile, line-height 1.55, measure ≤ 64ch.
- **Data mono:** divergence numbers, dates, byte counts and lab member numbers only.
  - Use Necto Mono (Collletttivo, OFL) or Steps Mono (Velvetyne, OFL), self-hosted or served via jsDelivr from the foundry's GitHub if that is available.
  - Never on headings, nav labels or buttons.
- **Phone screen only:** DotGothic16, for the feature-phone bitmap feel inside the composer's screen. Nowhere else.
- **Scale (two-tier):**
  - Chapter titles: `clamp(3rem, 7.5vw + 1rem, 9.5rem)`, about 150px at 1440 and 48px at 390. Tracking -0.02 to -0.03em, line-height 0.92.
  - Hero `h1`: quiet, `clamp(2.5rem, 4vw + 1rem, 5rem)`.
  - Meta text: 13-14px. Chapter numbers: display serif italic if the face has one.
- **Nixie numerals:** our own monoline SVG set. Thin constant strokes, rounded terminals, tall narrow forms about 3:5. They are not IN-14 or IN-18 copies and not the anime's shapes.

**Layout**
- 12-column grid, margins `clamp(20px, 4vw, 64px)`, gutter 24px.
- A chapter uses a sticky left rail (columns 1-3: chapter number, dates, field α/β, the divergence number in mono) and a body in columns 5-11: title, then narrative.
- Between chapters sits a full-width "shift band": a hairline, `0.571024 → 0.523299` in mono, and the sender.
- **Mobile 390:** the rail turns into a meta row above the title. The mini meter stays in the nav. The hero meter scales to fit 8 tubes within 390 - 40px.

**Motion**
- Lenis 1.3.26 on the GSAP ticker and ScrollTrigger (use the vendored motion-core). Reveals use motion-core `data-reveal` (lines for chapter titles, settle for body), visible by default.
- **The shift, the site's one hero moment, in this order:**
  1. The meter rolls: each tube cycles random digits every 45-70ms, then the tubes lock left to right with 40-90ms jitter. Each locking tube gets a 120ms over-bright pulse.
  2. At the first lock, the page takes a monochrome blink: a fixed overlay with `backdrop-filter: grayscale(1)`, 160ms in, then a 480ms fade out on `--ease-exit`/`--ease-enter`.
  3. Then the chapter title settles.
- **Total:** ≤ 1.2s. Scrolling back reverses (shift to the previous value).
- **Reduced motion:** the value swaps instantly with no roll and no blink. Lenis stays off. The WebGL scene renders one still frame.
- **Aria:** a visually hidden `aria-live="polite"` region announces "World line shifted to 0.523299" at most once per chapter. It stays quiet during the loader.

## 7. Imagery and 3D (step 6)

The only image is the meter. There is no photography and no official art. Atmosphere comes from the grade, the haze gradient and the meter's glow falling on the board.

**3D hero meter (`meter-gl.js`, three.js 0.186.1)**
- **Model:** 8 tubes on a dark board with a thin copper trace pattern.
- **Each tube:**
  - A glass envelope with a fresnel rim shader, not transmission, to save cost.
  - A honeycomb mesh anode as an alpha-textured cylinder segment.
  - Ten stacked unlit cathodes as thin tube geometry built from the numeral paths in `nixie.svg`, in `--nx-wire`.
  - The lit numeral: emissive `--nx-glow` with a `--nx-core` core, plus a cheap bloom (a low-strength UnrealBloomPass or an additive sprite halo).
  - The decimal tube lights only its dot.
- **Camera:** long lens (FOV about 20-25). One warm key light from the glow, plus a faint cool fill. Contact shadow on the board. Grade pass: desaturate to about 0.55 except the neon, lift blacks, and add the top haze.
- **Interaction:**
  - Pointer parallax of 2-3 degrees on fine pointers.
  - Scrolling out of the hero dollies the camera from a 3/4 view to straight-on and dims the scene. After the hero, the WebGL stops: pause offscreen, dispose on route change.
  - Clicking or pressing the meter triggers a manual re-read: a roll that locks on the same value. That is the "play" on the first screen.
- **Budget:** init after LCP (text) on idle; DPR ≤ 1.5; render on demand (only while rolling, parallaxing or dollying); one context; no model files.
- **Fallback:** no WebGL, reduced motion or an init error leaves the DOM SVG meter (the poster) in place. The canvas is `aria-hidden`, and it fades in over the poster only after its first frame.

## 8. Interaction (step 7)

- **Nav:** fixed and minimal. Left: "WORLD LINE" wordmark in the display serif (links home). Centre: the mini meter (DOM, 8 small tubes) showing the current chapter's value. Clicking it opens the chapter index: an overlay listing the 9 chapters with their values; Esc closes it and focus returns. Right: "Lab" link and a sound toggle ("Sound: off").
- **Hovers:** a tonal ink step, never an underline wipe and never a lift. Primary buttons use the magnetic recipe (the label drifts, the box stays still).
- **Native cursor:** kept. No custom cursor.
- **Loader:** none as a full-screen gate. The hero meter ignites (1.0s: tubes glow up from off, cycle, lock on 1.130426) while the text is already visible. It runs once per session (sessionStorage in a try/catch) and is skippable by scrolling.
- **Page transitions:** cross-document View Transitions using the vendored page-transitions recipe. The mini meter carries `view-transition-name: meter`, so it stays still while the page crossfades under it; on lab.html it reads the member-hover values.
- **Sound (opt-in, off by default):** WebAudio synth only.
  - A 100 Hz mains hum at very low gain while the tab is visible.
  - A relay click per tube lock.
  - A soft filtered-noise swell on a shift.
  - A DTMF tone per key in the composer.
  - The toggle persists in localStorage (try/catch). No audio context is created until the visitor turns sound on.

## 9. D-mail composer (index.html section)

- An original flip-phone-inspired panel drawn in CSS and SVG, not a real phone model. The screen area uses DotGothic16. There is a textarea (label: "Message"), a byte counter "0 / 36 bytes", and "Send back" with a select of 1-48 hours.
- **Byte count:** Shift-JIS rules. ASCII and half-width katakana count 1 byte; everything else counts 2. At 36 bytes, input beyond the limit is prevented and the counter turns neon (the one allowed UI neon).
- **Send:** a real `<form>` whose submit is handled in JS. Without JS it shows a static explanation. It is keyboard accessible.
  - On send, the meter shifts to a deterministic value. Hash the message and hours into a value inside the α range 0.000000-0.999999, or 1.xxxxxx when the message contains "beta".
  - Easter eggs from lore §2.10:
    - "El Psy Kongroo" → 1.048596
    - "tutturu" → 0.337187
    - "fibonacci" → 1.123581
    - "gamma" → 2.615074
    - "faris" → blank first tube, then 275349 (the meter can't show a minus sign)
  - A response line appears in the screen: "Sent 12h back. World line 0.4xxxxx. Only you remember."
  - Nothing is sent over the network. Say so in small print.

## 10. Quality gates (steps 9-10)

Probe `index.html`, `lab.html` and `404.html` with the skill's `scripts/site_probe.py` at 1440 and 390, and view every screenshot individually. Run the adapted Playwright suite:
- normal, no-JS, reduced motion, no-WebGL and CDN-blocked
- keyboard walk
- 390px overflow

Then self-score with `references/jury-lens.md` §7 and fix everything below band. The references' Crafted-vs-slop tables apply. There must be zero house-law failures.

## 11. v2: the world-line loom (replaces the chapter card layout)

Last updated: 2026-09-25. **Why:** the owner's feedback was that the scroll story reads as "dead and cold, boring cards with descriptions". The fix is to visualize the story the way the source does, with strings.

**Source image:** in the VN, Suzuha explains world lines with twisted coloured yarn (`research/identity.md` §3.7).
- Each thread is a world line: red = α, blue = β.
- Threads converge inside a strand, which is an attractor field.
- The strands are twisted together into one cord.
- The 1% barrier is the gap between the strands.
- The Steins Gate line is not in either strand.

This becomes the second hero of the page: a scroll-scrubbed 3D loom that the nine chapters play on.

**Stage**
- The chapters section (`#journal`) gets a sticky, full-viewport WebGL stage. `assets/js/loom.js` uses three.js 0.186.1 and runs its own renderer, context and render loop.
- The hero's GL meter is disposed once the loom starts, so there is at most one active WebGL scene at a time.
- The canvas is `aria-hidden`. The chapter text stays DOM, in normal flow, scrolling over the stage.
- **Ground follows the story:** summer haze `#C9CCC3` for chapters 1-3 (reads like yarn on paper), then a scrubbed fall to lab night `#0E0F0D` at the hinge (chapter 4), and night from chapter 5 on.

**Geometry (procedural, no files)**
- Time runs along the cord axis. Scroll progress through `#journal` maps to time, and the camera travels along the cord (long lens, FOV about 30, slight 3/4 angle).
- The **α strand** is about 12 threads in muted, graded yarn red (`#9E4A3F` range). The **β strand** is about 12 threads in muted slate blue (`#4F6E8F` range). The two strands wind around each other as a two-ply cord.
- Within a strand, the threads twist around the strand centre.
- **Convergence knots:** where the lore places them, every thread of the strand pinches to one point. The strand radius goes to about 0 over a short span, then opens again.
  - α knot at Aug 13 (and Aug 15), where Mayuri dies.
  - β knot at Jul 28, where Kurisu dies. Chapter 8 flies time backward to reach it.
- **Steins Gate thread:** one pale thread (`#E8E6DC`, unlit) running through the gap between the strands and belonging to neither. It is barely visible until the end.
- **Yarn material:** a custom shader with a twisted-fibre stripe along the tube UVs, soft wrap lighting, faint fuzz from noise, and the anime grade (desaturated, lifted blacks). No bloom on the yarn.
- **The spark:** Okabe's consciousness. A small neon bead (`--nx-core` / `--nx-glow`, the same orange as the meter and the only neon in the scene) travels along the current thread. The part of that thread it has already covered glows faintly behind it: an emissive trail on the thread, fading over distance.

**Choreography (scroll-scrubbed; the text beats drive it)**
1. **Ch1:** the spark rides a β (blue) thread. At the first D-mail it jumps: a bright arc across the barrier to a red α thread. Monochrome blink, and the meter rolls 1.130426 → 0.571024.
2. **Ch2:** a calm ride on one α thread. The camera drifts; the yarn sways a little with the pointer.
3. **Ch3:** five small hops between neighbouring α threads, one per ledger row. Each row's divergence label is anchored to its jump point.
4. **Ch4:** the α strand pinches into the Aug 13 knot. The spark hits it and the thread flashes. The ground falls to night.
5. **Ch5:** time-leap loops. The spark snaps back along its thread, rides forward, and hits the knot again, three or more times with shorter intervals: the loop is visible. Then the 0.409431 hop.
6. **Ch6:** the hops of chapter 3 in reverse. Each undo jumps the spark back to the thread it came from.
7. **Ch7:** the big leap across the 1% gap from the red strand to the blue one, the longest arc, with the monochrome blink. The meter reads 1.130205.
8. **Ch8:** time flies backward toward the Jul 28 β knot. Just before the knot, the spark slips out between the strands onto the pale Steins Gate thread (the deception).
9. **Ch9:** the SG thread lights along its whole length. The strands relax, loosen and drift back. Calm. The meter reads 1.048596.

- The meter, the shift events and the aria-live announcements stay as in v1: `shift.js` drives them from `data-worldline` crossings. The loom listens to the same progress, so they stay in sync.

**Text over the stage (no more cards)**
- **Chapter copy:** sits in a column on the left (desktop: columns 1-5) over a soft scrim gradient taken from the current ground, so text contrast holds at ≥ 4.5:1 on the worst frame. The loom owns the right and centre.
- **Titles:** keep the Erode display voice.
- **Ledger rows:** no longer cards (no filled backgrounds, no boxes). They become annotations: a hairline, the date, the sender, and `before → after` in Necto Mono. When WebGL is live, each row's number pairs visually with a small DOM label anchored to its jump point in 3D: projected from the 3D point, `aria-hidden`, a duplicate of the in-flow text.
- **Mobile:** the stage is full-bleed behind the text, with a stronger scrim. The camera frames the cord more tightly. The text column spans the full width.

**Interaction**
- Pointer parallax of about 2°.
- Hovering or focusing a ledger row highlights its thread: the thread brightens and the others dim a step.
- If sound is on, each jump plays a soft plucked-string sound (Karplus-Strong, synthesized) and each knot a low thud.

**Fallbacks**
- **No JS, reduced motion, or no WebGL:** a static SVG map of the same loom sits as the sticky stage. It is generated once by `tools/render_loom_svg.py` from the same parameters: the two strands, the knots, the spark's path drawn as a single orange line with jump arcs, and labels.
- **Reduced motion with WebGL:** no loom animation. Show the SVG map; the meter swaps values instantly, as in v1.
- **Performance:**
  - Init the loom when `#journal` comes within one viewport.
  - DPR ≤ 1.5.
  - Render only while scroll or pointer changes, plus a slow idle sway that stops after 5s.
  - Pause offscreen; dispose on route change.
  - Triangle budget: ≤ 250k desktop, ≤ 120k on touch devices (fewer threads and segments).

**v2 handoff (decisions the spec left open)**
- **The ground stays in document space.** The runs, the dawn fall and the dusk fall paint the ground in CSS; the WebGL canvas is transparent and the yarn dissolves into it with distance, so canvas and page can never seam and the no-JS page has the same ground. The "scrubbed fall to night" at the hinge is the text-free dusk fall scrolling through; the yarn shader reads where the falls are on screen and lights each pixel for haze or night.
- **Story time on the cord.** One unit is about one day of summer 2010, with the dense stretches (Operation Urd, the loops, Verthandi) given a little more length. The second α knot sits at Aug 15, just past the point where the choice leaps across.
- **Thread order.** Story threads are ordered by divergence: 0.571xxx lies nearest the 1% gap and 0.337187 furthest from it, so Urd hops outward, Verthandi climbs back and the choice leaps across. As §11 asks, each undo returns to the thread it came from, and each label reads its true value (for example 0.456914 where Urd showed 0.456903 on the same thread, about ten days earlier).
- **Three twists, and the lens.** The plies twist round each other, the threads twist round their ply, and each thread has three plies in the shader. The within-ply twist is solved once (a small dynamic programme) so every jump, landing and loop faces the lens, never coils tighter than 2.4x its nominal pitch, and at most untwists slightly under the Verthandi hops. Between events the spark may spiral behind its ply; it then lights the yarn from inside, and the camera drifts up to 32° toward it.
- **Chapter 5's last hop** (to 0.409431) arcs over the Aug 13 knot: the undo moves the convergence date, so the spark passes the knot without hitting it.
- **Chapter 8** draws one backward flight. The failed first attempt is told in the copy, not drawn as a second flight.
- **Triggered, not scrubbed.** The knot flash and the sounds fire on crossing a mark, and only for a single mark crossed at reading speed. Seeks, flings and deep links coalesce to the destination state.
- **Labels are annotations.** Each is a value set just clear of the cord with a hairline leader (the ledger's device), plus the three knot dates. They fade before they reach the copy column.
- **Titles.** Chapter titles use `--step-chapter-loom` (44px at 390, 72px at 1440), so every title holds to two lines in the five-column text column.
- **The mirror.** Chapter 6 keeps its copy on the left like every chapter. The mirror of chapter 3 lives in the loom (the hops climb back) and in the reversed ledger reading (`after ← before`). v1's shift-band lines are gone, since the loom now draws the world line.
- **Scrims.** On desktop there is one scrim per run: the run's own ground, opaque under columns 1-5, eased out over about 21vw and feathered at both ends of the run. The night run's feather sits inside the dusk fall, which is already lab night. On phones there is one 95% backing per text block, wrapping only the words, so the gaps between chapters are open windows onto the cord, and the spark rides about a quarter of the way down the screen. The italic chapter aside and the band line use a 76% ink (one step past `--ink-meta`) because they sit over the stage. Measured worst copy contrast (pixels, copy hidden, three scroll frames per chapter): 4.90:1 at 1440 (a 14px ledger value over the haze) and 4.80:1 at 390 (a 13px meta label); body text measures higher.
- **Start timing.** "Init when #journal comes within one viewport" would fire at load, because the hero is exactly one viewport tall, and would retire the hero's GL meter before anyone saw it. So the loom starts once the reader has scrolled into the journal (its top 30% of a viewport into view). three.js is already cached from the hero, and the cord sits a dawn fall below the journal's top, so the canvas is live before the rope scrolls in.
- **Sticky without overhang.** The stage and both maps are sticky boxes inside absolutely placed wrappers the size of their section. A sticky box with the usual `-100svh` bottom margin hangs a whole viewport past its section (the day map drew over the night map on phones).
- **Labels yield.** When two projected labels collide on one line, the older one fades out; labels never sit over the copy column.
- **The static map** is a schematic of the same loom (time runs down the page): one generated file used twice through `<use>`, with day and night colourways taken from CSS custom properties.
- **Ledger rows** join the tab order only while the WebGL loom is live, since that is the only time focusing one does something.
- **Lite tier.** A coarse pointer, a touch-only device or a stage under 768px wide gets 9 threads a ply and 224 segments.
- **One context.** `meter-gl.js` gained an AbortSignal option, so the loom can take the context even while the hero meter is still booting. The hero keeps its DOM meter and a DOM re-read afterwards.
- **Sound.** The pluck's pitch follows the divergence value it lands on, quantised to a pentatonic scale from G3. The two big jumps add a string an octave below.
- **Navigation hooks** for the next pass (the timeline, prev/next, J/K keys, deep links, disclosures): `seekTo()`, `scrollYFor()`, `watchChapters()` and the `loom:chapter` event work without WebGL. Beats re-measure on every ScrollTrigger refresh, and the loom refreshes when `#journal` changes height.

## 12. v3: newcomers, less scrolling, more ways in

Last updated: 2026-09-25.

**Why:** the owner reviewed the site and found it "too consistent, good design, but not good for people who never watched Steins;Gate; too much scrolling; maybe more ways to navigate?" This pass keeps the system: meter, loom, type and palette. It changes access and rhythm, and it follows the skill's `interaction.md`, `content-voice.md` and `quality-gates.md`.

**12.1 Two doors at the hero**
- Below the subline, a choice group of two large buttons (≥ 44px targets):
  - **"Never watched it":** leads to the primer.
  - **"I've seen it":** leads to chapter 1.
- Secondary links on the same line: "Send a D-mail" and "Meet the lab".
- The choice sets `data-reader="new|fan"` on `<html>`. It persists in localStorage inside a try/catch, and it can be changed any time from the chapter menu ("Reading as: newcomer / fan").
- With no choice made, the page behaves as newcomer: spoilers collapsed.

**12.2 Primer (`#primer`), spoiler-free, about 60 seconds, placed before the journal**
- **Four ideas.** Each gets a short paragraph (≤ 45 words) and a micro-demo built from existing parts:
  1. **D-mail:** a text message sent into the past through a modified microwave. Demo: a link into the composer.
  2. **World lines:** history is a bundle of threads, and a D-mail moves you to another thread. Demo: a small static SVG of three threads; hover or focus lights one.
  3. **The Divergence Meter:** the number says which thread you are on. Demo: a mini DOM meter; tap to re-read.
  4. **Reading Steiner:** when the world shifts, only Okabe remembers the old one. Demo: one sentence whose key words swap, in a monochrome blink, when you press "Shift".
- **Who's who:** 8 names with lab number and a spoiler-free descriptor of 8 words or fewer. Each links to `lab.html#member-00N`. Descriptors reveal nothing past episode 5, for example "Kurisu Makise, 18, neuroscience researcher back from America".
- **One line:** "The 2011 anime runs 24 episodes. This page spoils it from chapter 4." No links to streaming sites.

**12.3 Inline explainers**
- **What gets marked:** in chapter prose, the first mention per chapter of a key term or name.
- **Terms:** D-mail, PhoneWave, SERN, IBN 5100, John Titor, Reading Steiner, world line, divergence, attractor field, Time Leap Machine, Rounders, Operation Urd/Verthandi/Skuld, plus the lab members.
- **With JS:** a `<button class="term">` opens a popover (the Popover API, with anchor positioning where supported and a positioned fallback). It holds 1-2 sentences, spoiler-safe for chapters 1-3.
- **Without JS:** the same terms are plain links to the glossary on `lab.html`.
- **Keyboard and styling:** Enter or Space opens, Esc closes and returns focus. Terms read as terms through a tonal ink step and a dotted rule set as a static text-decoration. There is no animated underline.

**12.4 Spoiler gate**
- Chapters 4-9 sit inside one `<details class="spoiler-gate">`.
- The summary reads "Spoilers: the second half, chapters 4 to 9", with a one-line suggestion to watch first, and lists the chapter titles.
- Newcomer mode renders it closed; fan mode renders it open.
- Opening it re-measures the loom and ScrollTrigger positions.
- The mini meter, navigator and chapter menu mark the gated chapters. Choosing one opens the gate after a confirm step ("This spoils the second half. Open?").

**12.5 Less scrolling**
- Every chapter leads with a one-sentence `.chapter__tldr` in the display serif (28-34px at 1440), always visible. The remaining prose sits in `<details class="chapter__more"><summary>Read the full chapter</summary>`, closed by default in both modes.
- Ledger annotations (chapters 3 and 6) stay visible, because they are the jumps.
- Cut dead vertical space: each chapter is about 1.1-1.6 viewports tall with the details closed, still enough for its loom beats.
- **Target:** the index page is at least 35% shorter than v2 with everything closed. Measure it.

**12.6 More ways to navigate**
- **World-line navigator.** A fixed thin vertical thread at the right edge on desktop (≥ 64em), running from `#journal` to its end.
  - 9 nodes, one per chapter, coloured by field (α muted red, β muted blue, SG pale). The current node is lit in neon, the one allowed UI neon state besides the byte counter.
  - Each node is an `<a href="#ch-0N">`. On hover or focus, its label shows the number, the title and the divergence.
  - Below 64em the navigator hides. The nav gets a visible "Chapters" button beside the mini meter that opens the existing chapter overlay.
- **Prev/next.** At the end of each chapter: "← 03 Operation Urd" and "05 Convergence →".
- **Keyboard.** J = next chapter, K = previous chapter. Ignored while focus is in an input, textarea, select or contenteditable, or while a popover or overlay is open. The chapter overlay lists the shortcuts.
- **Deep links.** `#primer`, `#ch-01` … `#ch-09`, `#dmail` and `#lab` work on load and land the loom in the right state (use the loom's `seekTo` API).
- All jumps use Lenis `scrollTo` with a short duration (≤ 0.9s), or an instant jump under reduced motion.

**12.7 Rhythm: break the template**
- **Ch4 (the hinge):** a full-bleed statement with a poster-size "August 13" (about 180-220px at 1440, clamp to about 64px at 390) centred over the loom's knot. The TL;DR and the gated prose follow.
- **Ch7 (the choice):** a split layout. Two columns, "Delete the first D-mail" and "Keep it", each with its consequence (Mayuri lives / Kurisu dies, and the reverse). The loom shows the two strands apart. On mobile the columns stack.
- **Ch9 (Steins Gate):** a quiet, centred single line with generous air, then the TL;DR. No rail.
- The other chapters keep the rail layout. The difference comes from the loom scene and these three set pieces.

**12.8 QA additions** (extend `tests/test_site.py`)
- **Defaults:** newcomer is the default and the spoiler gate starts closed. The reader choice persists across reloads and flips the gate.
- **Explainers:** term popovers open on Enter, close on Esc and return focus. Without JS, terms link to the glossary.
- **Keyboard:** J/K move chapter by chapter and never fire inside the composer textarea.
- **Navigator and deep links:** navigator links and deep links land on the right chapter, and the meter reads that chapter's value.
- **Layout changes:** toggling `<details>` keeps the loom beats in sync, checked at the ledger rows.
- **Page height:** at least 35% shorter than v2 (record both numbers).
- **Mobile:** no overflow at 390. The "Chapters" button is visible and works.
- All v1/v2 checks stay green.
- **Visual review:** screenshots at 1440 and 390 of the hero doors, the primer, each set piece and the navigator, each viewed one at a time.

**v3 handoff (decisions the spec left open)**
- **The gate sits after the dusk.** Chapters 4-9 must be one `<details>`, and the closed gate must hand over to the composer's lab night without a seam. So the page falls to night after chapter 3 (the text-free dusk), and the gate's face is the first thing on night. Chapter 4 is now on lab night, and the hinge is the dusk plus the gate: "Everything above this line was a comedy" still closes chapter 4's prose.
- **The loom respects the gate.** A beat whose element is inside a closed `<details>` is skipped, and each shift marker there is skipped too. With the gate shut, the journal ends with the spark riding toward the Aug 13 knot and stopping short of it (x 13.95 of 15), so nothing past chapter 3 plays. Open, the full story runs. Every beat is keyed to something that is always visible: a chapter top, a TL;DR, a ledger row, the chapter 4 poster, the chapter 7 split. New cameras: `hinge` (the knot centred under the poster), `split` (the plies side on) and `quiet` (the Steins Gate thread low and centred under chapter 9's line).
- **Bands became ledger rows.** v2's shift bands between chapters are gone. The shift each chapter makes is now a single ledger row under its TL;DR, always visible, and it carries the `data-worldline` marker the prose paragraph used to carry (chapters 1, 5, 7 and 8). Its thread is the yarn of the line it lands on: alpha red, beta blue, the pale Steins Gate thread. Chapter 2's "holds" row is dashed. The prose ("Read the full chapter") sits after the row, so opening it never moves the shift a reader is looking at.
- **Chapter height.** A regular chapter is about 0.85-1.05 viewports with the details closed. The ledger chapters are about 1.35-1.6 and the set pieces about 1.05, which is shorter than the spec's 1.1-1.6: every loom beat still has 200 px or more of travel at 1440 x 900, and "too much scrolling" was the complaint.
- **Where a jump lands.** A chapter lands at its top, clear of the nav, but never past its own first shift. So the meter reads the line the chapter starts on (its `data-worldline`), not the first ledger row under the title. Chapter 3 lands 22 px lower at 1440 x 900 for this reason.
- **Deep links open the gate without asking.** A URL ending `#ch-05` is an explicit request, so the inline script opens the gate at parse time and the page never jumps. Every other way in (the navigator, the chapter menu, a "next" link, J) asks first while the gate is shut. The question is a modal `<dialog>` with focus on "Stay spoiler-free". The gate's own summary opens it without asking, because its face already says what it hides. Opening the gate by hand does not change the reading mode; the doors and the menu switch do.
- **"Marked" on the mini meter** means the menu the meter opens. It marks chapters 4-9 with the half-lit spoiler disc while the gate is shut (pure CSS, `:has(#spoilers:not([open]))`). The navigator draws those nodes hollow, and chapter 3's "next" link carries the disc.
- **The primer is one annotated figure.** Instead of four cards, the four ideas are annotations round one drawing of three threads tied into a bundle (`tools/render_primer_svg.py`, in the loom map's hatched-rope language). One Shift button plays all four ideas: the D-mail arc draws, the spark rides onto the alpha thread, the small meter rolls 1.130426 → 0.571024, the page blinks and the sentence changes. The small meter is a footer-size DOM meter scaled down (`nx--probe`, marker `meter:footer 1.130426 class=nx--probe`). It re-reads when pressed, and pointing at a thread reads that thread on it. The example sentence (Kurisu in the blood, then alive) is episode 1.
- **Who's who** links each name to `lab.html#member-00N`, as specified. A quiet line under the list says that the lab page spoils the story, because its turning-point column does.
- **Terms.** A term is marked at its first mention per chapter, counting the always-visible TL;DR first and then the prose, so newcomers meet the explainers without opening anything. There is one explainer per term, shared by every chapter and spoiler-safe everywhere, even where a gated chapter could say more. Placement uses CSS anchor positioning with the invoker as the implicit anchor (`position-area: bottom span-right`, with flips); where that is missing, `terms.js` places the explainer and follows it on scroll. A `<button>` never wraps, so a multi-word term moves to the next line whole, like a name joined with no-break spaces.
- **The navigator shows on every desktop scroll position**, not only over the journal. It sits in the DOM right after the header, so keyboard users reach it in order, and at the hero it reads as the story still ahead. It spans two grounds during a fall, so each node and its length of thread take the ink of the ground under that node (`data-on`, set by `main.js`). The trail above the current node reads stronger.
- **Chapters tab.** Below 64em the tab is fused to the right side of the meter's pill (same ink, a 1 px seam), so the meter and the tab read as one control. Its hit area is extended to 44 px. The phone nav shrinks the tubes to 10 px so the wordmark, meter, Chapters, Lab and Sound fit at 390 (and at 360).
- **One route for every jump.** Doors, the navigator, the menu, prev/next, the primer links and the footer's composer link all go through `reader.js`: close the menu, confirm if gated, then one Lenis scroll of 0.9 s (quartic out; instant under reduced motion). The loom coalesces (no pluck, thud or flash while flying past), the meter holds and then shifts once on landing, and the hash follows with `pushState` so Back and Forward work. J and K count from where a jump in flight will land, so pressing J twice quickly moves two chapters.
- **A `<details>` toggling is a layout change, not reading.** The loom re-measures on the next frame and stays quiet for 0.9 s. The meter re-measures and follows without a blink or an announcement. A reader toggles the disclosure they are looking at, so the prose opens below its summary and nothing on screen moves.
- **The stage's lower edge dissolves** (the bottom 20% of the sticky stage is masked on desktop), so the yarn is never cut by a hard line where `#journal` ends and the composer scrolls up.
- **Tests read as a returning fan** in the scenarios that walk the whole story, so every v1 and v2 check still covers chapters 4-9. `nojs` and the new `v3` scenario start as a first-time newcomer. The harness treats content inside a closed `<details>`, a closed `<dialog>` and a `[data-responsive]` control that is off at that width as not on the page, rather than as hidden by motion.
