---
version: "alpha"
name: "Zoetrik"
description: "Pitch-black engine room: Orbitron 900 caps, tracked Tomorrow labels, a vertical reel of glowing interface cards, a green-and-cyan install line, orange eyebrows on #111 bands."
colors:
  primary: "#ffa41c"
  on-primary: "#000000"
  surface: "#000000"
  surface-container: "#111111"
  on-surface: "#ffffff"
  on-surface-variant: "#999999"
  outline: "#262626"
  bg3: "#151515"
  btn: "#1d1d1d"
  green: "#71ff19"
  cyan: "#19f2ff"
  blue: "#0099ff"
  mint: "#78facb"
  magenta: "#c8287f"
  paper: "#ebebeb"
typography:
  headline-display:
    fontFamily: "Orbitron"
    fontSize: 40px
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: 0.01em
  body-md:
    fontFamily: "Inter"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0.01em
  label-md:
    fontFamily: "Tomorrow"
    fontSize: 13px
    fontWeight: 600
    letterSpacing: 0.1em
rounded:
  sm: 3px
  md: 4px
  lg: 8px
spacing:
  unit: 4px
  section: 128px
  max-width: 1000px
---

# Zoetrik

> A pitch-black engine room where every label is tracked uppercase and the only light comes from the screens being sold.

Source: https://flavors.design/f/zoetrik

## Overview

The landing page of an interactive-graphics engine for game HUDs, car dashboards
and product UI, dressed like the tool itself: black canvas, square-shouldered
sci-fi capitals, quiet grey body copy, and colour only where a screen is
glowing. The hero is a split: on the left a 300px reel of labelled cards
(GAME UI, PRODUCT UI, AUTOMOTIVE…) scrolls upward forever, each one a tiny
live interface; on the right a tracked-out wordmark, a two-line Orbitron 900
headline, and an install card whose command line is green and cyan. Sections
alternate between `#000` and `#111` bands with no rules between them. It is
for engines, editors, runtimes and devtools that want to look like they ship
to consoles. It is NOT cyberpunk: no neon grids, no glitch, no gradients on
the chrome — the glow lives inside the product objects only.

## Colors

| Role      | Value     | Notes                                                     |
| --------- | --------- | --------------------------------------------------------- |
| bg        | `#000000` | the page, the hero, odd bands                             |
| bg-2      | `#111111` | even bands, the install card, pricing and FAQ cards       |
| bg-3      | `#151515` | quote cards sitting on a `#111` band                      |
| btn       | `#1d1d1d` | every button slab                                         |
| fg        | `#ffffff` | headlines, labels, card titles                            |
| fg-muted  | `#999999` | every paragraph, captions, inactive tabs                  |
| accent    | `#ffa41c` | section eyebrows, the "Most picked" tag, the gauge arc    |
| accent-fg | `#000000` | text on accent                                            |
| border    | `#262626` | the tab rule, state-machine nodes                         |
| green     | `#71ff19` | install URL, HUD reticle, terminal ticks, the phone card  |
| cyan      | `#19f2ff` | shell keywords and pipes in commands                      |
| blue      | `#0099ff` | dial glow, editor selection, the Export chip, active node |
| mint      | `#78facb` | pricing checks, seat-limit labels, status dot             |
| magenta   | `#c8287f` | the closing panel, broadcast card, editor artboard        |
| paper     | `#ebebeb` | the newsletter input, the only light surface              |

Scheme: dark. Contrast rule: paragraphs `#999` on `#000` ≥ 7:1, headlines pure
white. Colour rules: chrome is greyscale; accent orange appears only on
eyebrows, one pricing tag and one gauge; green and cyan only inside commands
and screens; every tint is `color-mix()` from these fifteen literals.

## Typography

- Display: `"Orbitron", sans-serif` — 900 for the h1 (40px/1.2), 700 for h2 (24px/1.4), always uppercase, tracking `0.01em`; 400 at 26px with `0.5em` tracking for the wordmark
- Labels: `"Tomorrow", sans-serif` — 500/600, uppercase, tracking `0.1em` (`--label-track`): nav 12px, buttons 13px, eyebrows and card titles 14–15px, captions 10–12px
- Body: `"Inter", system-ui, sans-serif` — 16px/1.6, tracking `0.01em`, always `--fg-muted`
- Mono: `"Fragment Mono", ui-monospace, monospace` — install commands, tab labels, the terminal, editor chrome
- Scale: 9 / 10 / 12 / 13 / 14 / 16 / 22 / 24 / 28 / 30 / 40
- Load: `<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Tomorrow:wght@500;600&family=Inter:wght@400;500;600&family=Fragment+Mono&display=swap">`
- Rules: three voices with fixed jobs — Orbitron shouts, Tomorrow labels, Inter explains. Nothing is sentence case except paragraphs and quotes.

## Layout

- Max width 1000px, 24px gutters; the editor mockup is allowed to run past the right edge of the column
- Base unit 4px; scale 4 / 8 / 12 / 16 / 24 / 32 / 64 / 128
- Section rhythm 128px top and bottom (88px under 760px); bands alternate `#000` / `#111`
- Hero: `300px | 1fr` with an 88px gap, full viewport height minus the 64px nav; the reel column is clipped top and bottom, the copy is vertically centred
- Features are split rows (copy 0.9fr, object 1.1fr), alternating sides: editor mockup, runtime grid, agent terminal
- Density: airy — whole viewports of black around one split; dense inside the cards
- Mobile: the reel turns into a horizontal strip above the copy, splits stack, runtimes go 3-up

## Elevation & Depth

Flat black slabs; depth comes from tone steps and from light emitted by the screens, never from shadows on chrome.

- Surfaces step `#000 → #111 → #151515 → #1d1d1d` (page, band/card, card on band, button); a button inside the install card is mixed 70% toward the card so it sits one step up.
- Hairlines are `1px solid color-mix(in srgb, var(--fg) 9%, transparent)` (`--hair`) on reel cards, quote cards, pricing cards, buttons, the nav bottom, and the stats strip.
- Glow is emitted, not cast: the dial wears `box-shadow: 0 0 calc(var(--glow) * 26px) color-mix(in srgb, var(--blue) 65%, transparent), inset 0 0 calc(var(--glow) * 20px) …`; the reticle and gauge arc use `filter: drop-shadow(0 0 calc(var(--glow) * 6px) var(--green))`.
- Scanlines over every reel card: `repeating-linear-gradient(color-mix(in srgb, var(--bg) calc(var(--scan) * 100%), transparent) 0 1px, transparent 1px 3px)`.
- The highlighted plan gets an accent border at 70% and a 40px accent halo at 12%; the pricing toggle's selected half has `0 1px 2px` shadow (`--shadow`).
- The closing panel is lit from above: `radial-gradient(38% 70% at 50% 0%, color-mix(in srgb, var(--fg) 30%, transparent), transparent 70%)` over a magenta vertical gradient.

## Shapes

- Radius: 4px (`--radius`) on buttons, reel cards, the install card, quote cards, FAQ cards; 8px (`--radius-lg`) on pricing cards and the closing panel; 3px on tags, avatars and the toggle; 6px on the editor window and the newsletter input
- Circles only inside screens: the dial, HUD rings, phone rings, the mint check discs (16px)
- The phone in the mobile card has 20px top corners and no bottom edge, cropped by the card

## Components

- Buttons: 40px slabs, `padding: 0 16px`, `#1d1d1d`, hairline border, Tomorrow 600 13px uppercase at `0.1em`, a 15px glyph on the left (play disc, monitor, star, book). Hover lightens 12% toward fg. Nav button is 36px/12px. Pricing buttons are full width with the arrow on the right.
- Reel cards: 34px title bar (Tomorrow 600 15px, centred, hairline under it) over a 220px live scene. Scenes: HUD reticle with three green chips, a blue-glowing round dial, an orange gauge reading 88, a phone on a green field, a broadcast lower-third on magenta stripes.
- Install card: `#111`, 24px/20px padding. "ZOETRIK CLI" label, mono tabs with a 2px white underline on the active one over a `--border` rule, then the command (`curl -fsSL` cyan, URL green, `| sh` cyan) and a copy glyph, then "ZOETRIK EDITOR" and two buttons.
- Nav: 64px black bar with a hairline under it; mark, five Tomorrow 12px labels at 80% white with 11px chevrons, then a book-glyph "DOCS" link and the button.
- Eyebrows: orange Tomorrow 600 14px uppercase with a 15px line glyph, directly above an Orbitron 700 h2.
- Editor mockup: toolbar with a blue Export chip, a hierarchy tree with a blue-tinted selected row, a magenta-to-blue artboard, and a state machine panel whose nodes are 62×20 rects joined by bezier edges.
- Quote cards: masonry in three CSS columns; 24px initials avatar tinted from an extra colour, name in Tomorrow 600 11px caps, handle or role in 45% white caps, quote in 14px muted Inter.
- Pricing: name in Tomorrow 600 22px caps, seat limit in mint 10px caps, Inter 700 28px price with `/seat/mo`, full-width button, "CHOOSE IF YOU NEED TO" and "KEY FEATURES" captions, mint check list.
- Inputs: the newsletter field is the one light object: 46px, `#ebebeb`, 6px radius, black text, next to an Inter 600 "Sign up" slab.
- Footer: Tomorrow caps column heads, underlined 14px muted links, the tracked wordmark, copyright and a mint status dot.

## Do's and Don'ts

- Do set every headline in Orbitron caps and every label, button and eyebrow in tracked Tomorrow caps.
- Do keep paragraphs grey (`#999`) and short; white is reserved for things you scan.
- Do alternate `#000` and `#111` bands and let the band change be the only divider.
- Do put the colour inside product objects (screens, gauges, commands) and keep the chrome greyscale.
- Do give every button a glyph on its left and a `#1d1d1d` slab with a hairline.
- Do build signature objects in CSS/SVG: a reel of labelled screens, an editor window with a state machine, a runtime glyph grid.

- Don't use rounded pills; 4px is the default and 8px is the maximum.
- Don't add gradients, shadows or glow to nav, buttons or cards; glow belongs to the screens.
- Don't set body copy in Orbitron or Tomorrow, or headlines in sentence case.
- Don't make the hero reel jump or ease; it moves at one constant speed.

## Motion

- Duration 200ms, easing `ease`
- What animates: button and nav-link colour, tab underline, the FAQ plus rotating 45°, the footer status dot blinking every 2s
- Signature move: the hero reel translates `0 → -50%` over 56s (`--reel-speed`), linear and infinite, on a duplicated card list so it loops seamlessly; on phones it scrolls sideways instead
- What never animates: headlines, cards entering on scroll, anything with a bounce
- All motion sits inside `@media (prefers-reduced-motion: no-preference)`; the still frame shows the reel already cut mid-card at the top

## Tweaks

- Signature knobs: wordmark tracking (0.1–0.9em), label tracking for every Tomorrow caps label (0–0.3em), state machine nodes (3–7, the graph redraws), screen glow (0–2, scales every emitted glow), scanlines (0–0.4)
- Alternate schemes: **Phosphor**, **Arcade**, **Redline**, and **Drafting Table** (light)

## Reference CSS

<!-- prettier-ignore -->
```css
:root{
--bg:#000000;
--bg-2:#111111;
--bg-3:#151515;
--btn:#1d1d1d;
--fg:#ffffff;
--fg-muted:#999999;
--accent:#ffa41c;
--accent-fg:#000000;
--border:#262626;
--green:#71ff19;
--cyan:#19f2ff;
--blue:#0099ff;
--mint:#78facb;
--magenta:#c8287f;
--paper:#ebebeb;
--font-display:"Orbitron", sans-serif;
--font-label:"Tomorrow", sans-serif;
--font-body:"Inter", system-ui, sans-serif;
--font-mono:"Fragment Mono", ui-monospace, monospace;
--radius:4px;
--radius-lg:8px;
--mark-track:0.5em;
--label-track:0.1em;
--states:5;
--glow:1;
--scan:0.14;
--reel-speed:56s;
--space-1:4px;
--space-2:8px;
--space-3:12px;
--space-4:16px;
--space-5:24px;
--space-6:32px;
--space-7:64px;
--space-8:128px;
--shadow:0 1px 2px color-mix(in srgb, var(--accent-fg) 25%, transparent);
--ease:ease;
--dur:200ms;
--max-width:1000px;
--gut:max(var(--space-5), calc(50% - var(--max-width) / 2));
--soft:color-mix(in srgb, var(--fg) 80%, transparent);
--hair:color-mix(in srgb, var(--fg) 9%, transparent);
}
.btn{display:inline-flex;align-items:center;gap:10px;height:40px;padding:0 16px;border:1px solid var(--hair);border-radius:var(--radius);background:var(--btn);font:600 13px/1 var(--font-label);letter-spacing:var(--label-track);text-transform:uppercase}
.btn:hover{background:color-mix(in srgb, var(--btn) 88%, var(--fg))}
.cmd{font:400 13px/1.5 var(--font-mono);color:var(--green)}
```

## Reference markup

```html
<div class="inst">
  <h3 class="lb">Zoetrik CLI</h3>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" aria-selected="true">Shell</button>
    <button type="button" role="tab" aria-selected="false">Tarball</button>
  </div>
  <div class="cmd">
    <code
      ><i>curl -fsSL</i> https://get.zoetrik.dev/install.sh <i>| sh</i></code
    >
    <button type="button" aria-label="Copy">
      <svg><use href="#i-copy" /></svg>
    </button>
  </div>
  <h3 class="lb">Zoetrik Editor</h3>
  <div class="row">
    <a class="btn" href="#"
      ><svg><use href="#i-play" /></svg>Sign up</a
    >
    <a class="btn" href="#"
      ><svg><use href="#i-mon" /></svg>Download desktop app</a
    >
  </div>
</div>
```

## How to apply this flavor

1. Replace the target page's tokens with the palette, the three type voices and the 4px/8px radii above.
2. Rebuild the hero as a clipped reel of labelled product screens beside a centred copy column with an install card.
3. Turn feature lists into alternating split rows, each with a CSS/SVG product object; alternate `#000` / `#111` bands.
4. Apply the motion rules: one constant-speed reel, 200ms colour fades, nothing else.
5. Check the Don't list before finishing.
