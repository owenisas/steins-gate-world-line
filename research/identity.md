# Steins;Gate identity research: visuals, type, sound

Last updated: 2026-09-25

Scope: this covers what an unofficial, non-commercial fan tribute site needs to know to evoke Steins;Gate (VN 2009, White Fox anime 2011, Steins;Gate 0 VN 2015 and anime 2018) using only original procedural visuals (WebGL, SVG, CSS) and original Web Audio. It contains no official artwork, screenshots, logos, character art, lyrics or audio, and the site must not either.

Citation markers `[n]` refer to the Sources list at the end. **[unverified]** means I could not confirm the claim from a retrievable source; it comes from memory or a single weak source. **[derived]** means I computed or estimated it myself.

---

## 0. Current context (as of Sept 2026)

- **STEINS;GATE RE:BOOT** is a full remake with redrawn art, re-recorded voices and all BGM remade by Takeshi Abo. It launched 2026-08-20 in Japan (all platforms) and on Steam worldwide. Western console versions follow on 2026-10-29 [41][42][43]. Expect a spike in interest and in official new key art. Keep our visuals clearly separate from it.
- Producer Matsubara and writer Hayashi confirmed in Sept 2026 that new Science Adventure work (the long-teased "Steins;???") is in development [44].
- Current rights notices: `©MAGES./Chiyo St. Inc.` and `©MAGES./NITRO PLUS` [42]. The 2011 anime notice is `©2011 5pb./Nitroplus 未来ガジェット研究所` [19].
- Ownership: MAGES. (formerly 5pb.) left the KADOKAWA group through a 2019 management buyout. It has been a 100% subsidiary of **COLOPL** since 2020-04-03 [38][39][40]. KADOKAWA fan guidelines therefore do not govern the IP. The 2013 movie committee did include Kadokawa Shoten [20].

---

## 1. Anime art direction

### 1.1 Who owns the look

| Role | Steins;Gate TV (2011) | Steins;Gate 0 TV (2018) |
|---|---|---|
| Directors | Hiroshi Hamasaki, Takuya Satō | Kenichi Kawamura |
| Color design (色彩設計) | Miyuki Satō | Miyuki Satō (same person) |
| Art director (美術監督) | Kōji Etō | Takeshi Odaka |
| Director of photography (撮影監督, owns filters and compositing) | Keisuke Nakamura (T2studio) | Tomoyuki Shiokawa |
| Character design | Kyūta Sakai (from huke originals) | Tomoshige Inayoshi |
| OP | storyboard Hamasaki, episode direction Kanji Wakabayashi | |

Sources: [19][20][21]. Sakai said the anime designs lean toward "director Hamasaki's image" rather than toward huke's art [22]. Hamasaki named his focus as "the city and the characters' ecology feeling like one." For jargon he wanted "multi-dimensional expression through sound and image" [22]. Scenario writer Hanada described repeated location scouting to capture **Akihabara as it was in 2010** [22]. The ending credits also thank Fontworks, Sharp and Uchida Yōkō [19].

### 1.2 How critics described the grade

- The palette "sucks the color out of most scenes." Indoors the background colors are muted. Outdoors, subdued color is combined with **bright glare to convey summer heat**, a look that is "subdued but also blown-out" [1].
- "**Neutral colors like gray and white dominate** the scenery. Even green grass and blue sky are **washed out**." Cicada buzz and crowd noise often replace music [5].
- Backgrounds use "muted and grayish tones" but keep enough color to stay appealing [4]. One critic compared the "sun-beaten streets" to the morning streets of *Serial Experiments Lain*, and Hamasaki had worked on Lain-era productions [3].
- A Japanese blog (2012) observed that the colors are very thin even where saturated reds exist, and that **the top of the frame is washed white, as if hazed** [23]. This is the most design-actionable note.
- A detailed critique blames **heavy diffusion added in compositing** and a dull grade with little dynamic range, which flattens well-textured backgrounds. It also says the OVA and 2013 movie "open up" color and contrast [6].
- The Blu-ray shows heavy **color banding in dark fills** [2]. Another viewer wrote that everything looks "viewed under a very harsh white light" [24].
- Deliberate exceptions: a black-and-white scene in ep. 11, clasped hands as a visual theme in the second half, and more detailed, realistic drawing at moments of stress [4]. The washed-out base carries "**occasional bright greens, reds or blues** to make certain aspects pop" [25].
- On S;G0, ANN noted the "same **stifling color palette** and compositionally enforced sense of alienation" [26]. Another review found the colors "perhaps a little sharper" [27], and a hostile review complained that dark scenes are too dark to read [28].
- Composer Takeshi Abo, describing the VN's sound world as weather, called Chaos;Head "rainy," **Steins;Gate "cloudy,"** Robotics;Notes "clear" and Chaos;Child "stormy" [31]. That fits the hazed, overcast grade.

### 1.3 Working palettes [derived]

These are approximations built from the descriptions above plus two fan palettes: an Omarchy theme [7] and a Discord theme [8]. I sampled no frames. Treat them as starting tokens and tune by eye. Never ship screenshots.

**A. Lab, afternoon (interior, window-lit, cardboard and wood clutter)**
`#CFCBBE` hazed wall · `#A9A596` plaster mid · `#6E7465` grey-green shade · `#1F231C` olive-black (the fan theme uses `#181C14` [7]) · `#7A6A55` desaturated wood/cardboard · `#9FB3A8` cool CRT spill

**B. Akihabara at summer noon (overexposed)**
`#F2F0E8` haze white · `#E6EAE4` blown sky (only a hint of cyan) · `#A8A79F` concrete · `#5D5E59` asphalt · `#A9493F` sign red, desaturated · `#C8B35E` sign yellow, desaturated · `#7F9277` washed foliage

**C. Sunset: rooftop and the Radio Kaikan skyline**
`#C9B89A` high sky · `#E3A866` low sky · `#F2C98A` sun core · `#E08A4C` rim light · `#5A4A4E` long shadow · `#3B3230` building silhouette

**D. Night and neon (muted neon, never candy)**
`#15181C` base · `#C98B45` sodium lamp · `#B0485F` sign magenta · `#4E9A9C` sign cyan · `#A8D8E8` phone LCD backlight

**E. World-line shift ("Reading Steiner")**
In the VN, Okabe describes the moment as vertigo, blurring "as if thrown into the ocean," and "**everything in sight turned monochrome**." Color returns when Mayuri calls his name [9]. Suggested ramp: `#0E0E0E` → `#7A7A7A` → `#E4E4E4`, with crushed mids for the duration of the shift.

**F. S;G0 variant (cooler, darker)** [unverified tendency]
`#101418` base · `#4A5560` dusk steel · `#C07A3A` sodium accent

**Accents.** One crimson for alarm states, e.g. `#D4483A` from the fan theme [7]; its author reserves crimson for interactive state only. The Nixie emission color is in §2.5 and sits about 19° of hue away from the crimson, the same separation that theme uses between its crimson and amber.

### 1.4 Grade recipe (WebGL post-pass or CSS filter stack) [derived]

1. Desaturate to 0.50–0.60 while preserving hue.
2. Tint midtones about 10–12% toward a warm grey-green (`#B8B59E`).
3. Lift the black point so pure black lands around `#161812`. Soft-roll highlights.
4. **Top-down haze:** add white at about 0.18 × smoothstep from the top edge to 35% of frame height [23].
5. Diffusion bloom on highlights: large radius, low gain [6].
6. Film grain around 2–3%, on the backdrop only and never over text (house deslop rule).
7. **Accent mask:** let exactly one element per view (a Nixie glow or an alarm red) bypass the desaturation. This is the "occasional pop" [25].
8. Optional: 6–7-level posterize in deep shadow to suggest the broadcast banding [2]. Keep it subtle and dithered.

### 1.5 Lighting and recurring imagery (for original procedural scenes)

- **Dim lab.** Window light plus CRT and monitor glow, piles of salvaged electronics. The lab sits above the **"Braun Tube Workshop" (ブラウン管工房)**, a CRT shop. "Braun tube" is the Japanese term for a CRT. That shop's **42-inch CRT** is canonically part of the time-travel mechanism, and the PhoneWave only works while it is switched on [10][11].
- **Sunset Akihabara and rooftops.** The long-shadow amber palette (C).
- **Neon night streets.** Palette D, with the neon kept muted.
- **Clocks.** An academic reading of Okabe's paranoia notes that "the only meaningful content of a broken clock is death" for him [29]. The OP lyric pairs the clock's "two hands" with the idea of the "finite" (paraphrased; see §5) [30]. Clock faces and hands therefore carry dread, not decoration.
- **Gears and clockwork** in the OP and logo [unverified; from memory, check against a legitimately owned copy].
- **Phone screens.** Mail and incoming calls drive the plot (§3.3).
- **The "satellite."** In ep. 1 and the VN prologue a satellite-like object (actually a time machine) crashes into the top of the Akihabara Radio Kaikan building. In Oct 2011 the real building staged a full-size recreation: 6 m × 4 m, 600 kg [12][13].
- **Summer.** Heat glare, cicadas, crowds [1][5].

---

## 2. The divergence meter and the Nixie look

### 2.1 The in-world device

- The display reads **one digit, a decimal point, then six digits**, e.g. `1.048596`, as a percentage relative to the 2036 origin world line [14][15]. Shikura describes the device as showing **seven digits** [14]. Fan replicas use **8 tubes**, with tube 2 permanently showing only the decimal point [16][17].
- Rules from the wiki [15]:
  - Negative values blank the first digit.
  - It can display two values superimposed.
  - Changes past the sixth decimal do not register.
  - In S;G0 the future meter "twitches, changes numbers, or glitches."
- Canonical values (usable as facts or easter eggs):
  - `0.571024`: Titor's first @channel post [32].
  - `0.337187`: the meter as Suzuha hands it over [33].
  - `1.048596`: the Steins;Gate world line.
  - `1.123581` and `1.097302`: S;G0 anime world lines [34]. The first reads as Fibonacci digits.
  - A 27-decimal table (`0.409420…`, `0.456903…`, `0.523299…`, `0.571046…`) comes from the Anonymous;Code "M2037" meter [14].
- **Physical build as drawn** (reverse-engineered by builders from frames):
  - The top perfboard has 60 × 16 holes.
  - Tubes are about 15 mm in diameter at a 17.4 mm pitch, with an envelope height:width of about **2.7:1**, and are **smooth-topped** with no pip.
  - **Faint cross patterns** show inside the tubes, and the **1 and 8 match no real Nixie**.
  - Bare wires run from the board to the tube bases, with hex standoffs and a case that looks like riveted sheet metal [16][18].
- **No real tube matches.** IN-18s have no decimal point. IN-14s have a pip top and a different 5. The Burroughs B5441A (smooth top, with decimal point) comes closest but is rare [16].
- **Design implication:** our tube can and should be fictional-original: our own numeral forms and our own envelope proportions. That is legally cleaner and more honest to the source.

### 2.2 Real Nixie anatomy (what to simulate)

- **Envelope.** A glass tube filled with low-pressure **neon plus a little argon** (a Penning mixture). Later long-life tubes add a trace of **mercury**, which tints the glow **blue or purple** unless the glass is orange-filtered [35].
- **Anode.** A **wire-mesh (often honeycomb) grille** in front of the cathode stack [35][36].
- **Cathodes.** Ten numeral-shaped wires **stacked front to back**, so each digit sits at a different depth. The order is chosen so front digits obscure lit rear digits as little as possible. One common order is **6 7 5 8 4 3 9 2 0 1** (front to back); the IN-12 uses **3 8 9 4 0 5 7 2 6 1** [35].
- **The glow.** In the normal-glow regime the glow is a **sheath a fraction of a millimetre off the cathode** that follows its shape exactly. More current covers **more area at the same voltage**. Below the minimum current, part of the numeral goes dark, so the tube **looks broken rather than dim** [36].
- **Electrical feel** (worth knowing for sound and timing):
  - Strike is about 170 V and sustain about 140 V.
  - The IN-14 draws about 2–2.5 mA per digit; the IN-18 about 4–8 mA [36][37].
  - The negative-resistance region is why every tube needs a ballast resistor [36].
- **Decimal-point cathodes.** The IN-14 has **both left and right DPs** (pins 2 and 13) [45]. The IN-12B has one **bottom-left** DP; the IN-12A has none [35][46]. The IN-18 has **none** [16].

### 2.3 Reference tubes

| Tube | View | Digit height | Envelope | "5" | DP | Notes |
|---|---|---|---|---|---|---|
| **IN-14** | side | 18 mm | ~18 mm dia, pip top, flying leads | **upside-down 2** | L + R | The iconic hobby tube; "gothic, slightly angular" digits [45][47][48] |
| **IN-12A/B** | top/front | ~18–19 mm | oval, 30 mm wide | upside-down 2 | B only, bottom-left | Cheap, rugged [46] |
| **IN-18** | side | **40 mm** (22 mm wide) | 30–31 mm dia, 68–71 mm tall, smooth top | **true 5** | none | Trace mercury gives a faint bluish tint. The "blue dot" comes from bad drivers, not the tube [37][49][50] |
| Burroughs B5441A | side | — | smooth top | true | yes | Closest match to the anime; rare [16] |

### 2.4 Nixie numeral form (to draw our own glyphs)

- **Monoline bent wire.** One constant stroke, no contrast and no serifs; wire ends are simply cut. Render as a stroked SVG centreline, not a filled font [36][51].
- **Tall and condensed.** The IN-18 digit is 40 × 22 mm, about 1.8:1 [49]. Design an original set around 1.7–1.9:1.
- **Stacking.** Draw every unlit cathode as a dull-nickel wire behind the mesh, slightly offset in depth and scale. This "ghost stack" is what reads as real [51].
- **Construction tells.** IN-14 and IN-12 digits reuse one stamping for 2 and 5 [47][48]. Our set should have a true 5, because the anime's tubes are fictional too.
- **Avoid.** Anything resembling the anime's specific 1 and 8, or its cross-pattern artefact [16].

### 2.5 Glow color [derived]

- Neon's visible emission lines sit at about **585, 614, 640, 703 nm** plus others [52]. A 1968 Burroughs datasheet calls its tube color "Neon red" [53].
- I weighted approximate neon line intensities through a CIE 1931 color-matching approximation and got chromaticity **x ≈ 0.595, y ≈ 0.403**. At full saturation in sRGB that is **`#FF6800`**, i.e. the emission hue sits around `#FF6A00`.
- Suggested tokens:
  - `--nixie-core #FFD7A0`: the hot 1–1.5 px centre of the filament. This mimics how cameras clip it; to the eye it reads orange.
  - `--nixie-glow #FF6A00`: the sheath.
  - `--nixie-halo #FF3D00` at 25–40% alpha, Gaussian 6–14 px.
  - `--nixie-spill #5A1A04`: glow reflected on the glass and base.
  - `--cathode-off #5E5A52` and `--mesh #3A3833`.
  - Glass highlight: `rgba(216,224,230,.12)`.
  - For mercury tubes, mix 5–8% `#7A5CFF` into the halo near the cathode edges only [35][50].

### 2.6 Flicker and behavior

- **Multiplexed** tubes shimmer or flicker and can show **ghost digits** when switching; direct-drive tubes are steadier and brighter [16][54][55].
- The anti-poisoning **"slot machine"** routine cycles every digit, loved as eye candy. A subtler option is 10 × 2 ms cycling on each change, which gives "a small flicker on every transition" [56].
- **Cathode poisoning** shows as dark, missing patches on rarely used digits [57]. That makes a good "damaged world line" texture.
- Brightness varies slightly per digit and per tube, and some builders dislike clocks whose brightness changes as digits change [58].
- Implementation:
  - Per-tube random gain of ±4%.
  - 1/f intensity noise of about ±2% at 5–20 Hz.
  - A rare 30–60 ms dropout.
  - No strobing faster than 3 Hz (seizure safety).

### 2.7 How digits "roll" during a world-line shift

- One builder took his meter's change animation from the **VN's** meter animation, not the anime's [18]. The fan web toy MskTmi/DivergenceMeter defaults each digit to **8–20 random flickers at 60 ms** before it locks [59]. The Wallpaper Engine meter keeps the first digit at 0 or 1 [60].
- Anime and VN specifics, such as lock order and whether all tubes scramble together, are **[unverified]**. My recollection is that all tubes cycle rapidly and settle, not like an odometer.
- **Original spec** proposed for our site (1.2–1.6 s total):
  1. **0–150 ms:** the frame drains to monochrome (palette E), with a low-frequency "underwater" displacement wobble and a tighter vignette [9].
  2. **150–1000 ms:** each digit tube steps through random numerals every 45–70 ms. The decimal tube stays lit throughout.
  3. **Locks:** tubes lock one by one in a jittered left-to-right order. Each lock gets a 1.3× overbright pulse for 80 ms, a single-frame ghost of the previous digit, and a relay click (§5.3).
  4. **1000–1500 ms:** color returns, with a small global hue or palette offset so the "new world line" looks slightly different.
- `prefers-reduced-motion`: replace everything above with a 200 ms crossfade between values.

---

## 3. Motifs (describe, reinterpret, never reproduce)

### 3.1 Logo structure (describe only; do not imitate the lockup)

- Two fan type-ID sources independently identify the wordmark as **Garamond Bold** (Monotype, or Adobe Garamond Pro) set in caps, with the **semicolon** as the signature character. One also suggests the script face **"Ariendezze"** for the small subtitle line [61][62]. A third source calls it a "techno-glitch" custom mark [63]; it reads as generic AI copy, so I discount it.
- A gear, clock or cog emblem behind the wordmark **[unverified]**.
- **Rule for us:** do not set the title in bold Garamond caps, do not turn a semicolon into a logo device, and do not place type over a gear emblem. Our wordmark should come from the Nixie and keitai vocabulary instead.

### 3.2 "El Psy Kongroo" and the pose

- Okabe ends fake phone calls (the phone is switched off) with this sign-off [64].
- The canonical romanization is **Kongroo**, confirmed by the in-story address `sg-epk@jtk93.x29.jp` [64].
- The official lab account said it has no fixed meaning [65].
- Physical pose: phone to one ear, a theatrical lab-coat flourish, arms spread, the mad-scientist laugh [66]. The hand-over-face variant is **[unverified]** as a canonical keyframe.
- **For us:** use it as an **interaction ritual**, not a figure. For example, a "hang up" gesture that closes a session with a phone-style end-call tone, and never a silhouette of the character.

### 3.3 Phones and the phone-trigger UI

- **Era.** The story is set in summer 2010, the tail of the Japanese feature-phone era.
  - Okabe's phone "SG-001" was designed as an original model. There is an official prop replica, and the designers deliberately avoided smartphones [67].
  - A fan analysis argues it is a straight bar phone, not a flip, while other characters carry flips [68] **[fan claim]**.
  - He switches to a smartphone in S;G0 [69] **[fan claim]**.
- **The VN's "phone trigger."** Instead of choice menus, the player can answer or ignore calls and reply to mail. **Keywords in incoming mail are underlined blue like hyperlinks**, and selecting one composes the reply [70][71][72]. The phone can be customized, and the OST includes **8 retro-synth ringtone** versions of themes [73][74]. The concept came from producer Matsubara, who first wanted to use the player's real phone and dropped it over privacy law [71].
- **D-mail constraints** (good for a playful form limit):
  - Maximum **36 bytes**, which is **18 full-width Japanese / 36 half-width** characters.
  - Received in **three parts of 6 full-width / 12 half-width** characters; anything past byte 36 is lost [10][11][75].
  - The PhoneWave's timer sets how far back the mail goes, **in one-hour increments** [75].
  - Shikura ties the six-character unit to the meter's six decimals [14].
  - A NamuWiki note citing the official data book says the timer is typed with a `#` prefix and the reverse spin with a suffix (`#120` vs `120#`) **[unverified]** [76].
- **PhoneWave (name subject to change).** Future Gadget No. 8, 電話レンジ（仮）. It is a microwave triggered by calling the attached phone. Early tests turn bananas into green gel [10][77]. Its discharge produces **bluish-white light**, and in the time-leap scene Okabe's "vision turns white" [78].

### 3.4 IBN 5100

This is a play on the real **IBM 5100** (1975), useful as original industrial-design inspiration:
- **5-inch CRT, 64 × 16 characters**, about 25 kg, tape unit.
- A **front-panel BASIC/APL toggle switch**; a "Reverse Display" switch [79][80][81].
- In the story it holds a hidden ability to read IBN's pre-APL/BASIC legacy language [82].
- **Our use:** a 64 × 16 character-cell panel, green-grey phosphor, a two-position toggle as a UI control.

### 3.5 @channel

- A parody of **2channel**. The name comes from Shift+2 typing "@" on Japanese keyboards [83][84].
- Post header shape: number · name · tripcode · date with weekday · time · ID, e.g. `311 Name : JOHN TITOR <trip> : 2010/07/..(Fri)` [32].
- Anime details: users "age" or "sage" threads, and Kurisu's handle is "KuriGohan and Kamehameha" [85].
- **Our use:** an original textboard layout for a guestbook or "theories" page: numbered posts, date(weekday), anonymous default name, sage toggle. Use the genre's grammar, not any official screen layout.

### 3.6 Time-leap machine and headgear

- An upgrade of the PhoneWave with a **headset** that scans memory. The data is compressed to D-mail size and "played" into the past self's brain through the phone earpiece. There is a 48-hour limit [86][87][88].
- Kurisu configures it on an **X68000** [78]. That is Sharp's 1987 personal computer, the same machine Abo made music on as a student [31].
- The headgear's exact look is **[unverified]**. Cosplayers describe it as a modified headset [89].

### 3.7 World-line diagram

- The VN's key explanation is physical: **Suzuha twists colored yarn**, and each thread is a world line.
  - Red = α, blue = β, yellow = γ, white = δ.
  - Threads converge within a strand (an attractor field). Strands are bundled into one thick twisted cord [90][91][92].
- Fan and analysis diagrams plot world lines either **by divergence value**, or artistically as branching and rejoining [93].
- **Our use:** a generative SVG or WebGL of twisted, converging threads, colored by attractor field, scrubbable by divergence. The in-universe whiteboard sketch itself is **[unverified]** as an anime shot.

### 3.8 Other grammar worth borrowing

- **Episode titles pair a Japanese phrase with an English subtitle between dashes**, e.g. 「時間跳躍のパラノイア -Time Travel Paranoia-」 [20]. Write our own section headings in this pattern; do not reuse real titles.
- The official in-universe **Future Gadget Lab website** (anime promotion) was built to look like a **poorly made 90s homepage**: frames, broken blinking, bad English [94][95]. ANN lists its page title as "無題ドキュメン…" [96], which looks like a truncated "無題ドキュメント", Dreamweaver's Japanese default title for untitled pages (**[unverified]** whether this was deliberate). Evoke the idea of amateur 2000s JP web in one corner; do not replicate that site.

---

## 4. Typography

### 4.1 What is known

- **Logo:** Garamond-style bold serif caps, per fan IDs [61][62] (§3.1).
- **Anime ED credits:** **Fontworks "Greco M" (グレコ)** [97]. It is a formal **kaisho (regular brush script)** Japanese face, described as giving a sense of propriety and suited to certificates [98]. Fontworks is credited in the anime's staff roll [19].
- **VN body and UI fonts:** not identified [retrieval gap]. S;G0's UI switched to a **rusted-metal look** versus the original's cleaner UI [99].

### 4.2 What to use (evoke, don't copy)

The house deslop law bans JetBrains Mono, IBM Plex Mono, Inter, Space Grotesk, Cormorant and similar faces, and it bans monospace as the house voice. So:

1. **Nixie numerals as the identity type.** Draw an original monoline SVG numeral set (0–9, point, colon, minus). This is the one "face" that is ours, and it carries every number that matters.
2. **Keitai bitmap (for phone UI and D-mail only):** **DotGothic16** by Fontworks. It is OFL, on Google Fonts, and built on the old 16 × 16 Gothic bitmaps of "cell phones and computer screens" [100]. It is the right era and even the right foundry. Keep it inside phone screens.
3. **CRT and IBN panel text (data only):** a VT-style terminal bitmap such as VT323, used only for real data inside screens.
4. **Japanese signage and labels:** a condensed or bold Gothic in the spirit of 2000s electronics labelling and Akihabara shop signs. Ideally license a Fontworks or Morisawa Gothic of the period (e.g. FOT-Rodin or Shin Go) **[suggestion]**, or use a Japanese Gothic chosen for the brief.
5. **One ceremonial accent:** a kaisho or brush face for rare "fate" moments (echoing the ED's Greco), e.g. Klee One or a licensed kaisho.

Give each role a distinct treatment, as the deslop law requires. Avoid Garamond caps entirely.

---

## 5. Sound identity

### 5.1 Songs (reference only; never embed audio or quote lyrics)

- **"Hacking to the Gate"** is the 2011 anime OP.
  - Vocals Kanako Itō, lyrics and music Chiyomaru Shikura, arrangement Toshimichi Isoe.
  - Released 2011-04-27, peaked at Oricon #17, with B-side "Reliance" [101][102][103].
  - Its theme is a lone observer crossing world lines, framed by the clock's two hands standing for the finite (paraphrase) [30].
- **"Skyclad no Kansokusha" (スカイクラッドの観測者)** is the 2009 VN OP.
  - Same writer and arranger team; released 2009-10-28, Oricon #31 [104][105].
  - Itō called it "acrobatic" and her most "cyber" song. She sang it deliberately **cold**, for a "cyber" Akihabara [106].
  - The lyric frames past and future as binary 0 and 1 (paraphrase) [106].
  - The VN also has an insert song, "technovision" (vocal-synth cyber-techno), and the ED ballad "Another Heaven" [106].
- **S;G0:** "World-Line" (Asami Imai) became the ED from ep. 14 [107]. Other S;G0 and anime theme credits **[unverified]**.

### 5.2 Score

- **Takeshi Abo** scored the VN and the anime, the anime with Jun Murakami [20]. Abo says he tried to make **"GATE OF STEINER"** contain the whole story, **accelerating** toward its climax [31].
- One review describes its opening as repeated 16th-note intervals in E♭ major, with a synth-orchestra, electronica sound "reminiscent of Blade Runner but more melodic," and a piano version [73].
- Abo's roots: YMO, FM synthesis on the Sharp X1 and X68000. The 8-bit OST was programmed in MML on FM and PSG chips [31].
- **The anime** often drops music for cicadas, crowd noise and "simple sounds" [5][24].

### 5.3 The world-line shift sound and our original layer

- Fans describe the anime's shift SFX as "grinding and then a bell-toll thing" **[unverified fan description]** [108]. The VN narration supplies the rest: vertigo, blur, underwater, monochrome, a sense of the ground shaking [9].
- **Original Web Audio ideas** (default muted, start on a user gesture, one master fader):
  - **Mains hum, specific to Tokyo.** Eastern Japan, including Tokyo and Akihabara, runs on **50 Hz** mains. Transformer buzz sits at **100 Hz** plus harmonics. A low bed of about −40 dBFS for the lab.
  - **Nixie supply whine.** A faint 8–15 kHz switching whine with slow random drift, plus a tiny tick on each digit strike.
  - **Relay click for each tube lock.** A 3–6 ms filtered noise burst plus a damped 2–4 kHz resonant ping, randomized ±10% per tube.
  - **CRT whine.** The NTSC horizontal line frequency is about **15.734 kHz** (Japan used NTSC-J). Keep it very quiet, since many listeners can't hear it, and add a degauss "thunk" on page load.
  - **Keitai keys.** DTMF pairs (697/770/852/941 Hz × 1209/1336/1477 Hz) on the D-mail keypad, and a short square-wave "sent" chirp. Compose our own ringtone motif; never approximate Abo's.
  - **Summer.** Synthesized cicada drone (amplitude-modulated band-passed noise, 4–7 kHz) plus distant crowd murmur in the daylight scenes.
  - **Shift cue.** Descending pitch-bent sine, a reverse-granular swell, a low-pass "underwater" sweep (to about 400 Hz), then an inharmonic struck-metal bell on the final lock. Sync it with the monochrome dip.
  - **PhoneWave discharge.** A magnetron-style 100 Hz buzz, crackle bursts, and a rising turntable-motor whirr.

---

## 6. Existing fan projects (so we can be different)

| Project | What it does | Strength | Weakness / our opening |
|---|---|---|---|
| divergence.nyarchlinux.moe (FrancescoCaracciolo/DivergenceMeter) [109][110] | Estimates the "world's divergence" from live news every 15 min; plot plus public API | Clever real-world data concept; open API | Plays **sound from the VN** (rights problem); dashboard/table UI with no atmosphere |
| elpsykongroo.de [110] | Short narrative mini-game: mission brief, choose an Akihabara shop, D-mail form, drag events into a timeline, "World line shifted" | Genuine interactive storytelling; sound off by default | Generic HUD styling; leans on character dialogue |
| lomirus.github.io/divergence-meter [111] | Vanilla JS/CSS meter; `/?1.048596` URL easter egg | Tiny; nice URL trick | Plays **"Hacking to the Gate" and other OST tracks** (rights problem) |
| trigger-testing …/divergence-meter (TriggersTools.SteinsGate) [112] | Renders arbitrary text as meter images | Useful generator | Uses **graphics taken from the VN** |
| dogancelik/divergence-meter [113] | Embeddable JS meter, live clock mode | Simple embed API | Image-sprite digits; no glow physics |
| MskTmi/DivergenceMeter [59] | Configurable scramble (8–20 flickers @ 60 ms), AJAX values | Good roll-timing parameters | Flat visuals |
| futuregadget-lab.github.io/old-version [94] | Vue rebuild of the official 90s-style promo site | Faithful | Replicates official content; zero originality |
| brotoro.com/dm [16][18] | Hardware replica with a detailed design analysis | Best reference on tube geometry | Hardware, not web |
| @glowbox/nixie and joeparadiso/nixie-tube-clock [51][114] | Generic procedural Nixie: honeycomb mesh, ghost stack, bloom; CSS flicker plus hum | Real Nixie physics on the web | Not S;G; hum is a sample file |

**Where we can be distinct:** zero ripped assets; physically motivated Nixie rendering with an original numeral set; the whole-page grade and the monochrome "Reading Steiner" transition as the signature; original synthesized sound; a D-mail composer that enforces the 36-byte, 3 × 12-byte rule; an attractor-field "yarn" visualizer. Most projects above are either a lone meter widget or a ripped-asset replica.

---

## 7. Legal and fan-content notes

- **Nitroplus** (co-creator; runs a formal fan-creation guideline) [115][116]:
  - It allows **non-commercial** derivative work that shows the fan's own creativity.
  - It **forbids** traces or copies of official art and work with only trivial design additions.
  - It forbids anything that harms the IP's image, **misleads people into thinking it is official**, or infringes others' rights.
  - Paid distribution limits: direct sale, 200 units or fewer, ¥100k or less. Promotional or affiliate use is disallowed.
  - **Music:** arrangements and covers follow JASRAC; master recordings need Nitroplus's permission.
  - Its gameplay-video guideline explicitly **excludes STEINS;GATE**, which is limited to the trial range [117]. In Aug 2025 it restated support for non-excessively-profitable fan work [118].
  - Which titles the guideline covers depends on its managed-works list; S;G coverage is **[unverified]**.
- **MAGES.:**
  - Its published guideline covers **video and still-image streaming of listed titles only**. Titles not listed may not be streamed. **OP movies and songs are always excluded**, monetization is banned, and clipping music, BGM, voice or SFX is banned [119].
  - For **RE:BOOT** it grants no streaming or let's-play permission at all [120][121].
  - I found **no MAGES. general fan-art or fan-site guideline** [retrieval gap].
- **Trademark.** Treat "STEINS;GATE" and the logo as protected marks (registration status **[unverified]**). Use the name only descriptively in text ("a fan tribute to Steins;Gate"). Keep it out of our wordmark, favicon and domain branding.
- **Safe-practice checklist for the site:**
  1. Label it in the header or footer: *"Unofficial, non-commercial fan tribute. Not affiliated with or endorsed by MAGES., Nitroplus, Chiyo St. Inc., COLOPL or White Fox. All trademarks belong to their owners."* This mirrors the good practice in fan hardware projects [122].
  2. No official images, screenshots, logos, character likenesses, fonts extracted from games, audio or lyrics. Paraphrase lyrics; quote at most a line of dialogue.
  3. No ads, donations, affiliate links or merch. No sale of anything (Nitroplus treats promotional use as commercial [115]).
  4. Canonical facts (divergence values, gadget numbers, the 36-byte rule) are fine to reference. Write all explanatory text ourselves.
  5. Link to official channels (the RE:BOOT site) instead of hosting anything official.
  6. Provide a takedown contact, and comply on request, as the guidelines reserve [115].

---

## 8. Retrieval gaps

- I could not verify the anime's own world-line-shift visual effect, the OP's gear and clock imagery, or the logo emblem from a retrievable text source. Verify them by watching a legitimately owned copy, and do not capture frames for the site.
- No frame sampling was done, so all palette hex values are derived estimates.
- VN UI fonts and any MAGES. general fan guideline were not found.
- Exact neon line intensities in `neon.py` (in session scratch) came from memory of NIST relative values, so the glow hue is ±10° approximate.

---

## Sources

1. Ragashingo review: https://ragashingo.com/review-steinsgate/
2. TheaterByte Blu-ray review: https://www.theaterbyte.com/steins-gate-complete-series-part-one-blu-ray-review/
3. THEM Anime review: https://www.themanime.org/viewreview.php?id=1275
4. Wikipedia, Steins;Gate (TV series): https://en.wikipedia.org/wiki/Steins%3BGate_(TV_series)
5. The Game of Nerds (2025): https://thegameofnerds.com/2025/06/26/steinsgate-review/
6. Red Q Studios critique: https://www.redqstudios.com/p/steinsgate-review-commentary-qs-wall-of_3.html
7. Omarchy Steins;Gate theme (fan palette): https://github.com/husamemadH/omarchy-steins-gate-theme (seen via mirror github.laiyagushi.com)
8. VSThemes Discord theme: https://vsthemes.org/en/skins/discord/12537-steins-gate-rintaro-okabe-and-kuris.html
9. Reading Steiner (VN narration): https://steins-gate.fandom.com/wiki/Reading_Steiner
10. PhoneWave, fandom: https://steins-gate.fandom.com/wiki/PhoneWave_(name_subject_to_change)
11. PhoneWave, SciADV wiki: https://scienceadventure.wiki.gg/wiki/PhoneWave
12. ANN on the Radio Kaikan satellite: https://www.animenewsnetwork.com/interest/2011-10-27/steins-gate-crashed-satellite-recreated-in-akihabara
13. ANN, satellite returns: https://www.animenewsnetwork.com/interest/2012-01-20/steins-gate-satellite-returns-to-akihabara-in-tokyo
14. Divergence Meter, SciADV wiki: https://scienceadventure.wiki.gg/wiki/Divergence_Meter
15. Divergence Meter, fandom: https://steins-gate.fandom.com/wiki/Divergence_Meter
16. brotoro design analysis: http://brotoro.com/dm/design.html
17. waicool20 manual: https://github.com/waicool20/Divergence-Meter-Project/blob/master/Users%20Manual.md
18. brotoro project page: http://brotoro.com/dm/ ; taricorp: https://www.taricorp.net/projects/divergence-meter/
19. Anime staff DB (credits): https://seesaawiki.jp/w/radioi_34/d/Steins%3BGate
20. ja.wikipedia, STEINS;GATE (anime): https://ja.wikipedia.org/wiki/STEINS;GATE_(%E3%82%A2%E3%83%8B%E3%83%A1)
21. Syoboi staff comparison: http://cal.syoboi.jp/cmp?TID=4868%2C4444%2C3494%2C2715%2C2142%2C1465
22. Official anime site staff comments: http://steinsgate.tv/special/staff_comment2.html
23. Mangaism blog on color (2012): https://nuruta.hatenablog.com/entry/20120711/1341940039
24. This Euphoria ep. 2 review: https://matthigh.wordpress.com/2011/09/02/anime-review-steinsgate-episode-2/
25. Star Crossed Anime, S;G0 review: https://starcrossedanime.com/steinsgate-0-anime-review-46-100/
26. ANN S;G0 preview: https://www.animenewsnetwork.com/preview-guide/2018/spring/steins-gate-0/.130238
27. My Shiny Toy Robots, S;G0: https://www.myshinytoyrobots.com/2018/04/steins-gate-0-first-impressions.html
28. Mr. Flawfinder, S;G0: https://flawfinder.wordpress.com/2018/09/29/anime-review-steinsgate-0-white-fox/
29. Wikipedia, Rintaro Okabe: https://en.wikipedia.org/wiki/Rintaro_Okabe
30. OP lyrics and translation page (paraphrased only): https://www.animesonglyrics.com/steinsgate/hacking-to-the-gate/video
31. VGMO Takeshi Abo interview: https://vgmonline.net/takeshiabointerview/
32. @channel VN transcription: https://steins-gate.fandom.com/wiki/@channel/Visual_Novel_Transcription
33. LP Archive part 115: https://lparchive.org/SteinsGate/Update%20115/
34. NamuWiki, divergence: https://en.namu.wiki/w/%EB%8B%A4%EC%9D%B4%EB%B2%84%EC%A0%84%EC%8A%A4
35. Wikipedia, Nixie tube: https://en.wikipedia.org/wiki/Nixie_tube
36. Youblob Nixie blueprint (2026): https://youblob.com/us/blueprints/nixie-tube
37. tube-tester IN-18: https://www.tube-tester.com/sites/nixie/data/in18.htm
38. MAGES. MBO release (2019): https://mages.co.jp/wp-content/uploads/2019/07/0726%e7%99%ba%e8%a1%a8_%e3%83%aa%e3%83%aa%e3%83%bc%e3%82%b9fix_clean2.pdf
39. MAGES. company profile: https://mages.co.jp/about/company
40. ja.wikipedia, MAGES.: https://ja.wikipedia.org/wiki/MAGES.
41. RE:BOOT official (EN): https://steinsgate.jp/reboot/en-us/
42. ANN, RE:BOOT West dates: https://www.animenewsnetwork.com/news/2026-05-27/steins-gate-re-boot-game-launches-in-west-on-switch-2-switch-ps5-on-october-29/.237879
43. Spike Chunsoft Steam launch: https://www.spike-chunsoft.com/news/steins-gate-reboot-for-steam-available-now/
44. Kiri Kiri Basara (Famitsu interview recap): https://www.kirikiribasara.com/2026/09/06/new-sciadv-projects-are-in-development-steinsgate-creators-confirm/
45. Tubes-Store IN-14 pinout: https://tubes-store.com/product_info.php?products_id=41
46. Industrial Alchemy IN-12: https://www.industrialalchemy.org/articleview.php?item=1010
47. nixieclocks.ch IN-14: https://www.nixieclocks.ch/english/nixie-knowledge/in-14-nixie-tubes/
48. nixieclock.biz tube guide: https://www.nixieclock.biz/guides/in14-vs-z570m-vs-in8-2-which-tube.html
49. IN-18 clock spec sheet (digit 40 × 22 mm): https://sb03fefd490221d21.jimcontent.com/download/version/1521714701/module/9293036869/name/IN-18-6Tube-ENV3.pdf
50. display-tubes.org IN-18: https://display-tubes.org/nixie/gazotron-in-18/
51. @glowbox/nixie: https://www.npmjs.com/package/@glowbox/nixie
52. Giangrandi, neon glow lamp spectra: https://www.giangrandi.org/electronics/neon/neon.shtml
53. Burroughs B-5859 datasheet (1968): https://www.grwiki.org/grwiki/images/9/99/Burroughs_B-5859_Nixie_Tube_Data_09_1968.pdf
54. neonixie-l newbie thread: https://groups.google.com/g/neonixie-l/c/WIK2UWjMHPI
55. EE.SE Nixie ghosting: https://electronics.stackexchange.com/questions/477115/ghosting-on-nixie-tube-clock
56. neonixie-l cathode-poisoning prevention: https://groups.google.com/g/neonixie-l/c/1gMGal-8HMA/m/3WJqRb7IAAAJ
57. surfncircuits, poisoning and ghosting: https://surfncircuits.com/2019/04/06/eliminating-nixie-tube-cathode-poisoning-bi-quinary-digit-ghosting-and-heavily-oxidized-leads/
58. neonixie-l IN-18 depoisoning: https://groups.google.com/g/neonixie-l/c/xjWMzh26FrI
59. MskTmi/DivergenceMeter: https://github.com/MskTmi/DivergenceMeter
60. Steam Workshop meter v2: https://steamcommunity.com/sharedfiles/filedetails/?id=2232159157
61. fontmeme: https://fontmeme.com/steins-gate-font/
62. dafont forum: https://www.dafont.com/forum/read/28234/what-font-is-this-steins-gate
63. madegooddesigns (discounted): https://madegooddesigns.com/steins-gate-font/
64. Episode Glossary (El Psy Kongroo): https://steins-gate.fandom.com/wiki/Episode_Glossary
65. Anime.SE on memes (official tweet): https://anime.stackexchange.com/questions/14347/what-are-the-original-memes-mentioned-in-steinsgate
66. Baidu Baike, EL PSY KONGROO: https://baike.baidu.com/en/item/EL%20PSY%20KONGROO/1446220
67. cafe yui, SG-001 replica: http://cafeyui.net/steinsgate-sg-001/
68. "Is Okabe's phone a flip phone?" (fan video): https://www.youtube.com/watch?v=LafqkBZ6Z5s
69. r/steinsgate phone thread: https://www.reddit.com/r/steinsgate/comments/3p4jhq/help_me_find_a_cellphone_like_okabe/
70. JAST S;G about page: https://steins-gate.com/about.html
71. Wikipedia, Steins;Gate (VN): https://en.wikipedia.org/wiki/Steins;Gate
72. TrueAchievements controls: https://www.trueachievements.com/game/Steins-Gate/walkthrough/2
73. VGMO OST review: https://vgmonline.net/steinsgate/
74. App Store listing: https://apps.apple.com/us/app/steins-gate-en-english/id998826504
75. LP Archive part 37: https://lparchive.org/SteinsGate/Update%2037/
76. NamuWiki, D-mail: https://en.namu.wiki/w/D%EB%A9%94%EC%9D%BC
77. Ep. 2 synopsis (fandom): https://steins-gate.fandom.com/wiki/S;G_(anime)_-_Ep.02
78. LP Archive part 95: https://lparchive.org/SteinsGate/Update%2095/
79. Wikipedia, IBM 5100: https://en.wikipedia.org/wiki/IBM_5100
80. IBM 5100 APL manual (1975): https://bitsavers.org/pdf/ibm/5100/SA21-9213-0_IBM_5100_APL_Reference_Manual_Aug1975.pdf
81. Dave's Old Computers, IBM 5100: http://dunfield.classiccmp.org/ibm5100/index.htm
82. LP Archive part 18: https://lparchive.org/SteinsGate/Update%2018/
83. @channel, fandom: https://steins-gate.fandom.com/wiki/@channel
84. NamuWiki, @channel: https://en.namu.wiki/w/%40%EC%B1%84%EB%84%90
85. Ep. 2 glossary terms (fandom): https://steins-gate.fandom.com/wiki/S;G_(anime)_-_Ep.02
86. Time Leap Machine, fandom: https://steins-gate.fandom.com/wiki/Time_Leap_Machine
87. Time Leap Machine, SciADV wiki: https://scienceadventure.wiki.gg/wiki/Time_Leap_Machine
88. Time Leap, fandom: https://steins-gate.fandom.com/wiki/Time_Leap
89. r/cosplay headset thread: https://www.reddit.com/r/cosplay/comments/b3zmto/helpsteinsgate_time_leap_machine_headset/
90. Attractor Field, fandom: https://steins-gate.fandom.com/wiki/Attractor_Field
91. Attractor Field, SciADV wiki: https://scienceadventure.wiki.gg/wiki/Attractor_Field
92. Fandom user blog (VN yarn quote): https://steins-gate.fandom.com/wiki/User_blog:Zeldakasumi/World_Line_Theory,_Divergence,_Loops,_and_Kurisu%27s_Deaths_and_Salvation
93. Votuko, *The Mechanics of Steins;Gate* (2023): https://gwern.net/doc/fiction/science-fiction/time-travel/2023-votuko-themechanicsofsteinsgate.pdf
94. futuregadget-lab/old-version: https://github.com/futuregadget-lab/old-version
95. Future Gadget Laboratory, fandom: https://steins-gate.fandom.com/wiki/Future_Gadget_Laboratory
96. ANN company entry: https://www.animenewsnetwork.com/encyclopedia/company.php?id=9941
97. GD.SE, ED credit font: https://graphicdesign.stackexchange.com/questions/120093/what-is-the-japanese-font-used-in-the-ending-credit-of-steinsgate-anime
98. Fontworks Greco M: https://fontworks.co.jp/fontsearch/grecostd-m/
99. XTgamer S;G0 review: https://www.xtgamer.net/2018/05/14/review-steinsgate-0/
100. DotGothic16: https://fonts.google.com/specimen/DotGothic16 ; https://github.com/fontworks-fonts/dotgothic16
101. VGMdb single: https://vgmdb.net/album/23847
102. ja.wikipedia, Hacking to the Gate: https://ja.wikipedia.org/wiki/Hacking_to_the_Gate
103. MusicBrainz release: https://musicbrainz.org/release/5d050188-fb85-3369-8ab7-31e4d1eee15a
104. ja.wikipedia, スカイクラッドの観測者: https://ja.wikipedia.org/wiki/%E3%82%B9%E3%82%AB%E3%82%A4%E3%82%AF%E3%83%A9%E3%83%83%E3%83%89%E3%81%AE%E8%A6%B3%E6%B8%AC%E8%80%85
105. ORICON product page: https://www.oricon.co.jp/prof/332455/products/840917/1/
106. Animate Times, Itō interview (2009): https://www.animatetimes.com/news/details.php?id=1254381560
107. "World-Line", fandom: https://steins-gate.fandom.com/wiki/World-Line
108. r/steinsgate SFX thread: https://www.reddit.com/r/steinsgate/comments/96cjil/world_line_change_sound_effect/
109. FrancescoCaracciolo/DivergenceMeter: https://github.com/francescocaracciolo/divergencemeter
110. Live sites: https://divergence.nyarchlinux.moe ; https://elpsykongroo.de/
111. lomirus/divergence-meter: https://github.com/lomirus/divergence-meter
112. TriggersTools.SteinsGate: https://github.com/trigger-segfault/TriggersTools.SteinsGate
113. dogancelik/divergence-meter: https://github.com/dogancelik/divergence-meter
114. joeparadiso/nixie-tube-clock: https://github.com/joeparadiso/nixie-tube-clock
115. Nitroplus fan-creation guideline: https://www.nitroplus.co.jp/company/license/fan-fiction/
116. Nitroplus license index: https://www.nitroplus.co.jp/company/license/
117. Nitroplus gameplay-video guideline: https://www.nitroplus.co.jp/company/license/fan-fiction/gameplay
118. Denfaminico Gamer (Aug 2025): https://news.denfaminicogamer.jp/news/250819d
119. MAGES. streaming guideline: https://game.mages.co.jp/guideline/
120. RE:BOOT guideline: https://steinsgate.jp/reboot/ja-jp/guideline/
121. GameBusiness.jp on RE:BOOT: https://www.gamebusiness.jp/article/2026/05/08/26877.html
122. Nergon123/Okabe_Phone disclaimer: https://github.com/Nergon123/Okabe_Phone
