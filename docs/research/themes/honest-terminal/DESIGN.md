---
version: "alpha"
name: "Honest Terminal"
description: "Wide monospace with hacker whimsy: a tmux-window fold, glitching ASCII, typed deploy logs, IRC marquee quotes, and a blinking cursor."
colors:
  primary: "#86f28a"
  on-primary: "#0b0d11"
  surface: "#0b0d11"
  surface-container: "#0f131a"
  on-surface: "#d5d9e0"
  on-surface-variant: "#7c8390"
  outline: "#292c31"
  bright: "#f2f5f8"
  error: "#ff9d73"
typography:
  headline-display:
    fontFamily: "Geist Mono"
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: -0.055em
  body-md:
    fontFamily: "Geist Mono"
    fontSize: 15px
    lineHeight: 1.65
  label-md:
    fontFamily: "Geist Mono"
    fontSize: 12px
    lineHeight: 1.5
rounded:
  md: 0px
spacing:
  unit: 4px
  section: 88px
  max-width: 1200px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 10px 18px
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 10px 18px
  statusbar:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    height: 28px
  diff-deletion:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.error}"
  headline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.bright}"
  man-page:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
---

# Honest Terminal

> A deploy CLI that sells itself from inside its own tmux session: phosphor green, hairline panes, typed logs and one honest glitch.

Source: https://flavors.design/f/honest-terminal

## Overview

Honest Terminal is a product page that never leaves the terminal. The fold is one tmux window: a readme pane with the pitch, a pane typing a real deploy log, a region latency pane with block-character bars and a req/s pane with an ASCII column chart, all closed by a solid green tmux status bar. Every section below is a Unix artefact rebuilt as marketing: an htop meter band for stats, a `git diff` that deletes 912 lines of YAML, a `man` page for features, a 90-day uptime heatmap with an incidents log, an IRC channel marquee for testimonials, and an ASCII plan table with `[x]` checkboxes. The voice is dry and precise, the whimsy lives in details (a sliced glitch on the headline, "ask Dmitri" in the diff). It suits developer tools, infra, CLIs and open-source; it is not cyberpunk neon, a faux desktop OS with traffic lights, or a rounded SaaS dashboard.

## Colors

| Role      | Value     | Notes                                                   |
| --------- | --------- | ------------------------------------------------------- |
| bg        | `#0b0d11` | near-black page ground, pane fill                       |
| bg-2      | `#0f131a` | man page, diff, featured plan, install line             |
| fg        | `#d5d9e0` | primary text                                            |
| fg-muted  | `#7c8390` | comments, flags, metadata, pane titles                  |
| accent    | `#86f28a` | phosphor: prompts, actions, bars, status bar, live data |
| accent-fg | `#0b0d11` | text on filled green                                    |
| border    | `#292c31` | pane dividers, plan table, secondary buttons            |
| bright    | `#f2f5f8` | headlines, commands, high-priority output               |
| error     | `#ff9d73` | diff deletions, 429s, bad uptime days, glitch slice     |

Derived (never literals): `--grid-line: color-mix(in srgb, var(--fg) 10%, transparent)`, `--glow: color-mix(in srgb, var(--accent) var(--phosphor), transparent)`, diff row washes at 8-12% of error/accent.

Scheme: dark. Contrast rule: body in fg or bright (≥ 11:1 on bg), muted only for metadata ≥ 11px (≈ 4.9:1).
Color rules: green means action or live; orange means removed, failed or glitched and is never a button; the status bar is the one full-width green slab per viewport.

## Typography

- Display: `"Geist Mono", ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, monospace` — weight 600, tracking `-0.055em` (h1) / `-0.045em` (h2), sentence case, two forced lines on the h1
- Body: same stack — 15px, line-height 1.65, ligatures off
- Mono: same stack for everything; the ASCII wordmark uses `"DejaVu Sans Mono", Menlo, Consolas, monospace` so block glyphs tile
- Scale: 11 / 12 / 13 / 14 / 15 / 17 / 30 / 38 / 44 / 56
- Load: `<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300..700&display=swap" rel="stylesheet">`
- Rules: section h2s pair a bright phrase with a muted tail ("man shipit — three verbs."); labels are commands, not nouns; numbers are big, tight and half-green ("**8.4**s")

## Layout

- Max width 1200px, gutters `clamp(18px, 3vw, 40px)`
- Base unit 4px; spacing scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Section rhythm 88px vertical (60px below 640px)
- Grid: hero is a tmux window, `grid-template-columns: var(--split) 1fr` with the right side split 1.25fr/1fr into the log and two small panes; stats 4 columns; diff 1fr/1.25fr; uptime 1fr/300px; plans and commands 3 columns
- Density: balanced — dense terminal readouts inside wide, calm sections. Mobile: panes stack, stats go 2×2, plan table and man commands become one column, the marquee keeps scrolling

## Elevation & Depth

A CRT, not a desk: depth comes from hairline panes and phosphor glowing from within, never from a light source above.

- Panes: `.tmux { border: 1px solid var(--border); box-shadow: 0 0 0 1px var(--bg), 0 30px 80px -40px var(--glow); }`; the active readme pane is split from the rest by `border-right: 1px solid var(--accent)`; pane titles (`─ 1.0 shipit deploy --prod ─`) are cut into the top border with `background: var(--bg)`.
- Scanlines over the whole window: `.tmux::after { background: repeating-linear-gradient(to bottom, color-mix(in srgb, var(--bg) var(--scanlines), transparent) 0 1px, transparent 1px 3px); }`, removed below 640px.
- Glow is the only shadow: `--shadow: 0 0 28px color-mix(in srgb, var(--accent) 10%, transparent)`; the featured plan adds `0 0 60px -20px var(--glow)`; buttons on hover `0 0 0 1px var(--accent), 0 0 26px var(--glow)`. Text glow `text-shadow: 0 0 22px var(--glow)` on the green headline line, stat numbers and the ASCII wordmark.
- Atmosphere: `.flavor::before` is a 900px sky, `radial-gradient(ellipse 70% 60% at 70% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%)` over a 22px dot grid of `color-mix(in srgb, var(--fg) 13%, transparent)` dots, masked with `linear-gradient(#000, transparent 95%)`.
- Surfaces: bg for panes and cells, bg-2 for documents (man page, diff, featured plan, install line). Forbidden: offset drop shadows, blurred glass, gradient fills on buttons, a second glow colour.

## Shapes

- Radius: `0px` everywhere (`--radius`, `--radius-lg`): buttons, panes, plans, inputs, status bar
- Buttons are bracketed, not shaped: `::before` `[` and `::after` `]` at 55% opacity
- Squares only: the `›_` logo tile is 22×22, diffstat blocks are 12×12, uptime cells are 16px slivers in a 90-column grid; charts are `█` / `░` / `|` / `·` characters

## Components

- Buttons: 44px tall, `10px 18px`, 1px accent outline; `.solid` filled green, `.ghost` border-coloured and muted; hover fills green and glows
- tmux window: panes with cut-in titles, a typed deploy log, region bars, req/s chart; status bar `[shipit] 0:readme* 1:deploy- 2:regions … "atlas-api" 14:02 26-Sep-26`
- htop stats: `Dpl[||||||   ]` meter, 38px number with the value in green and the unit in bright
- Diff: header row, hunk lines muted, deletions in error on an 8% wash with `- `, the single addition in bold accent on a 12% wash
- Man page: `SHIPIT(1)` header/footer, bold NAME/SYNOPSIS/COMMANDS, 7ch indents; command cells invert to a green highlight on hover
- Uptime heatmap: 8 regions × 90 days, orange cells for bad days, incidents log beside it
- IRC marquee: `[09:14] <priya.r>` nick line, 17px bright quote, `-- name, role, company`
- Plan table: one bordered table of three columns, header row per plan, featured head filled green, `[x]` / `[ ]` feature lists
- FAQ: `[+]` / `[-]` rows on hairlines; install line `$ curl …` with a `copy` button that inverts on hover

## Do's and Don'ts

- Do build every section as a real terminal artefact (pane, diff, man page, log, table)
- Do give every pane a cut-in title and every section a `§ 0xNN · command` label
- Do draw charts and meters with block characters, not SVG shapes
- Do keep the hero log finished in the markup so stills read a complete deploy; split h2s into a bright phrase and a muted tail
- Do derive every tint with `color-mix()` from the nine `:root` colors

- Don't round anything, not even the logo tile
- Don't use orange for actions; it is deletions, errors and the glitch slice only
- Don't add desktop traffic-light dots or window chrome beyond the tmux frame
- Don't let the glitch cover more than a sliver of the headline
- Don't put decoration over body text on mobile, or animate when reduced motion is requested

## Motion

- Duration 200ms, easing `cubic-bezier(0.2, 0.8, 0.2, 1)`
- Load: the tmux window powers on like a CRT (`clip-path: inset(49% 0 49% 0)` → `inset(0)`, 0.6s), pane contents boot up 120ms apart, then the deploy log rewinds and types itself out
- Loops: cursor blink `1.05s steps(1)`, headline and ASCII glitch slices (`steps(1)` keyframes offset by `--glitch`), IRC marquee 48s linear, paused on hover
- Hover: buttons invert and glow, man commands highlight, plans and uptime rows take a 3-5% wash
- All of it lives in `@media (prefers-reduced-motion: no-preference)`; the static frame shows the glitch slices at rest and the finished log

## Tweaks

- `--glitch` (0-18px) shifts the headline/ASCII slices; `--scanlines` (0-40%) sets scanline density; `--phosphor` (0-90%) drives every green glow via `--glow`
- `--split` (46-66%): width of the readme pane in the tmux window
- `--load` (15-100%): traffic in the req/s pane; the ASCII chart and number redraw on `flavor:tweak`
- Schemes: Amber CRT, Mainframe, Teletype (light paper), Vapor

## Reference CSS

```css
:root {
  --bg: #0b0d11;
  --bg-2: #0f131a;
  --fg: #d5d9e0;
  --fg-muted: #7c8390;
  --accent: #86f28a;
  --accent-fg: #0b0d11;
  --border: #292c31;
  --bright: #f2f5f8;
  --error: #ff9d73;
  --font-display: "Geist Mono", ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, monospace;
  --font-body: "Geist Mono", ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, monospace;
  --font-mono: "Geist Mono", ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, monospace;
  --radius: 0px;
  --radius-lg: 0px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur: 200ms;
  --max-width: 1200px;
  --section: 88px;
  --glitch: 5px;
  --scanlines: 12%;
  --phosphor: 45%;
  --split: 56%;
  --load: 70%;
  --grid-line: color-mix(in srgb, var(--fg) 10%, transparent);
  --glow: color-mix(in srgb, var(--accent) var(--phosphor), transparent);
  --shadow: 0 0 28px color-mix(in srgb, var(--accent) 10%, transparent);
}
  :root { --section: 60px; }
  .tmux::after { display: none; }
  .topbar-right .up { display: none; }
  .pane { padding: 26px 18px 20px; }
  .pitch { padding: 34px 18px 30px; }
  h1 { font-size: clamp(30px, 9.4vw, 44px); }
  h1 .line { white-space: normal; }
  h1 .cursor { display: none; }
  .duo { grid-template-columns: 1fr; }
  .duo .pane + .pane { border-left: 0; border-top: 1px solid var(--border); }
  .log { font-size: 11.5px; }
  .statusbar .win:nth-of-type(n + 3), .statusbar .date { display: none; }
  .stat { padding: 22px 16px; }
  .stat strong { font-size: 28px; }
  .man-head span:nth-child(2), .man-foot span:nth-child(2) { display: none; }
  .man .indent { padding-left: 2ch; }
  .cmd { padding: 20px 4px 22px 4ch; }
  .heat p { grid-template-columns: 4ch 1fr; }
  .heat p > span:last-child { display: none; }
  .incidents { border-left: 0; padding-left: 0; }
  .quote { width: 300px; padding: 22px; }
  .quote blockquote { font-size: 15px; }
  .install { display: flex; font-size: 12px; }
  .footer { flex-direction: column; align-items: flex-start; }
}

.btn { min-height: 44px; padding: 10px 18px; border: 1px solid var(--accent); border-radius: var(--radius); color: var(--accent); font: 500 14px/1 var(--font-mono); }
.btn::before { content: "["; opacity: 0.55; }
.btn::after { content: "]"; opacity: 0.55; }
```

## Reference markup

```html
<div class="tmux">
  <div class="panes">
    <div class="pane pitch active">
      <span class="pane-title">─ 0.0 ~/readme ─</span>
      <p class="eyebrow"><b>$</b> shipit --version 2.4.0</p>
      <h1><span class="line">One command,</span><span class="line glow"><span class="glitch" data-text="then it's live.">then it's live.</span></span></h1>
      <div class="actions"><a class="btn solid" href="#">Install shipit</a></div>
    </div>
    <div class="pane log"><span class="pane-title">─ 1.0 shipit deploy --prod ─</span><p class="ok">✓ live · 41s</p></div>
  </div>
  <div class="statusbar"><span class="sess">[shipit]</span><span class="win">0:readme*</span></div>
</div>
```

## How to apply this flavor

1. Replace the target page's design tokens with the palette, fonts and spacing above.
2. Restyle components to match the Components section; keep the page's content and structure.
3. Apply the motion rules; remove any animation not described here.
4. Check the Don't list before finishing.
