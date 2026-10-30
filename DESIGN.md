---
version: "alpha"
name: "Zoetrik"
description: "Pitch-black engine room: Orbitron 900 caps, a vertical reel of glowing interface cards, a green-and-cyan install line, orange eyebrows on #111 bands."
colors:
  primary: "#ffa41c"
  on-primary: "#000000"
  surface: "#000000"
  surface-container: "#111111"
  on-surface: "#ffffff"
  on-surface-variant: "#999999"
  outline: "#262626"
  bg3: "#151515"
  green: "#71ff19"
  cyan: "#19f2ff"
  blue: "#0099ff"
  mint: "#78facb"
  magenta: "#c8287f"
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
rounded:
  md: 4px
  lg: 8px
spacing:
  unit: 4px
---

# Zoetrik

Source: https://flavors.design/f/zoetrik

## Overview

The landing page of an interactive-graphics engine for game HUDs, car dashboards
and product UI, dressed like the tool itself: black canvas, square-shouldered
sci-fi capitals, quiet grey body copy. The hero is a split: on the left a 300px reel of labelled cards
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

Contrast rule: paragraphs `#999` on `#000` ≥ 7:1, headlines pure
white.

## Typography

- Display: `"Orbitron", sans-serif` — 900 for the h1 (40px/1.2), 700 for h2 (24px/1.4), always uppercase, tracking `0.01em`; 400 at 26px with `0.5em` tracking for the wordmark
- Body: `"Inter", system-ui, sans-serif` — 16px/1.6, tracking `0.01em`
- Mono: `"Fragment Mono", ui-monospace, monospace` — install commands, tab labels, the terminal, editor chrome
- Scale: 9 / 10 / 12 / 13 / 14 / 16 / 22 / 24 / 28 / 30 / 40
- Load: `<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Inter:wght@400;500;600&family=Fragment+Mono&display=swap">`

## Layout

- Base unit 4px; scale 4 / 8 / 12 / 16 / 24 / 32 / 64 / 128

## Elevation & Depth

Flat black slabs; depth comes from tone steps and from light emitted by the screens, never from shadows on chrome.

- Glow is emitted, not cast: the dial wears `box-shadow: 0 0 calc(var(--glow) * 26px) color-mix(in srgb, var(--blue) 65%, transparent), inset 0 0 calc(var(--glow) * 20px) …`; the reticle and gauge arc use `filter: drop-shadow(0 0 calc(var(--glow) * 6px) var(--green))`.
- Scanlines over every reel card: `repeating-linear-gradient(color-mix(in srgb, var(--bg) calc(var(--scan) * 100%), transparent) 0 1px, transparent 1px 3px)`.
- The closing panel is lit from above: `radial-gradient(38% 70% at 50% 0%, color-mix(in srgb, var(--fg) 30%, transparent), transparent 70%)` over a magenta vertical gradient.

## Shapes

- Radius: 4px (`--radius`) on buttons, reel cards, the install card, quote cards, FAQ cards; 8px (`--radius-lg`) on pricing cards and the closing panel
- Circles only inside screens: the dial, HUD rings, phone rings, the mint check discs (16px)
- The phone in the mobile card has 20px top corners and no bottom edge, cropped by the card

## Do's and Don'ts

- Do set every headline in Orbitron caps.
- Do keep paragraphs grey (`#999`) and short; white is reserved for things you scan.

- Don't use rounded pills; 4px is the default and 8px is the maximum.
- Don't add gradients, shadows or glow to nav, buttons or cards; glow belongs to the screens. The focus ring (`--ring`) is not a shadow and stays.
- Don't set body copy in Orbitron or Tomorrow, or headlines in sentence case.
- Don't make the hero reel jump or ease; it moves at one constant speed.

## Motion

- Duration 200ms, easing `ease`
- What animates: button and nav-link colour, the FAQ plus rotating 45°, the footer status dot blinking every 2s
- Signature move: the hero reel translates `0 → -50%` over 56s (`--reel-speed`), linear and infinite, on a duplicated card list so it loops seamlessly; on phones it scrolls sideways instead
- What never animates: headlines, cards entering on scroll, anything with a bounce
- All motion sits inside `@media (prefers-reduced-motion: no-preference)`; the still frame shows the reel already cut mid-card at the top

## Tweaks

- Signature knobs: wordmark tracking (0.1–0.9em), state machine nodes (3–7, the graph redraws), screen glow (0–2, scales every emitted glow), scanlines (0–0.4)
- Alternate schemes: **Phosphor**, **Arcade**, **Redline**, and **Drafting Table** (light)

## Reference CSS

<!-- prettier-ignore -->
```css
:root{
--bg:#000000;
--bg-2:#111111;
--bg-3:#151515;
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
--font-display:"Orbitron", sans-serif;
--font-body:"Inter", system-ui, sans-serif;
--font-mono:"Fragment Mono", ui-monospace, monospace;
--radius:4px;
--radius-lg:8px;
--mark-track:0.5em;
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
--ease:ease;
--dur:200ms;
--soft:color-mix(in srgb, var(--fg) 80%, transparent);
}
.cmd{font:400 13px/1.5 var(--font-mono);color:var(--green)}
```

## shadcn/ui Usage

### Install

Add this flavor's theme with `npx shadcn@latest add https://flavors.design/r/zoetrik.json`. The CLI has no cookie — Pro users append `?key=YOUR_API_KEY` (Settings → API keys). Install primitives with `npx shadcn@latest add button card input textarea select dialog sheet tabs badge separator checkbox switch slider tooltip dropdown-menu table`.

### Theme variables

```css
@import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Inter:wght@400;500;600&family=Fragment+Mono&display=swap");

:root {
  --accent: #171717;
  --accent-foreground: #ffffff;
  --background: #000000;
  --border: #262626;
  --card: #111111;
  --card-foreground: #ffffff;
  --chart-1: #ffa41c;
  --chart-2: #ffffff;
  --chart-3: #999999;
  --chart-4: #151515;
  --chart-5: #0099ff;
  --destructive: #f87171;
  --destructive-foreground: #000000;
  --foreground: #ffffff;
  --input: #262626;
  --muted: #171717;
  --muted-foreground: #999999;
  --popover: #111111;
  --popover-foreground: #ffffff;
  --primary: #ffa41c;
  --primary-foreground: #000000;
  --radius: 4px;
  --ring: #ffa41c;
  --secondary: #171717;
  --secondary-foreground: #ffffff;
  --sidebar: #111111;
  --sidebar-accent: #171717;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: #262626;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #ffa41c;
  --sidebar-primary-foreground: #000000;
  --sidebar-ring: #ffa41c;
}

.dark {
  --accent: #171717;
  --accent-foreground: #ffffff;
  --background: #000000;
  --border: #262626;
  --card: #111111;
  --card-foreground: #ffffff;
  --chart-1: #ffa41c;
  --chart-2: #ffffff;
  --chart-3: #999999;
  --chart-4: #151515;
  --chart-5: #0099ff;
  --destructive: #f87171;
  --destructive-foreground: #000000;
  --foreground: #ffffff;
  --input: #262626;
  --muted: #171717;
  --muted-foreground: #999999;
  --popover: #111111;
  --popover-foreground: #ffffff;
  --primary: #ffa41c;
  --primary-foreground: #000000;
  --radius: 4px;
  --ring: #ffa41c;
  --secondary: #171717;
  --secondary-foreground: #ffffff;
  --sidebar: #111111;
  --sidebar-accent: #171717;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: #262626;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #ffa41c;
  --sidebar-primary-foreground: #000000;
  --sidebar-ring: #ffa41c;
}

[data-flavor-scheme="phosphor"] {
  --accent: #152019;
  --accent-foreground: #d9ffe4;
  --background: #020a05;
  --border: #16301f;
  --card: #07140b;
  --card-foreground: #d9ffe4;
  --chart-1: #71ff19;
  --chart-2: #d9ffe4;
  --chart-3: #6f9c7c;
  --chart-4: #10261a;
  --chart-5: #2fd2ff;
  --destructive: #f87171;
  --destructive-foreground: #020a05;
  --foreground: #d9ffe4;
  --input: #16301f;
  --muted: #152019;
  --muted-foreground: #6f9c7c;
  --popover: #07140b;
  --popover-foreground: #d9ffe4;
  --primary: #71ff19;
  --primary-foreground: #021004;
  --radius: 4px;
  --ring: #71ff19;
  --secondary: #152019;
  --secondary-foreground: #d9ffe4;
  --sidebar: #07140b;
  --sidebar-accent: #152019;
  --sidebar-accent-foreground: #d9ffe4;
  --sidebar-border: #16301f;
  --sidebar-foreground: #d9ffe4;
  --sidebar-primary: #71ff19;
  --sidebar-primary-foreground: #021004;
  --sidebar-ring: #71ff19;
}

[data-flavor-scheme="arcade"] {
  --accent: #201b2b;
  --accent-foreground: #f6efff;
  --background: #0b0616;
  --border: #2c1f47;
  --card: #130b22;
  --card-foreground: #f6efff;
  --chart-1: #ff4fd8;
  --chart-2: #f6efff;
  --chart-3: #9d8fbf;
  --chart-4: #22163a;
  --chart-5: #6c7bff;
  --destructive: #f87171;
  --destructive-foreground: #0b0616;
  --foreground: #f6efff;
  --input: #2c1f47;
  --muted: #201b2b;
  --muted-foreground: #9d8fbf;
  --popover: #130b22;
  --popover-foreground: #f6efff;
  --primary: #ff4fd8;
  --primary-foreground: #12041a;
  --radius: 4px;
  --ring: #ff4fd8;
  --secondary: #201b2b;
  --secondary-foreground: #f6efff;
  --sidebar: #130b22;
  --sidebar-accent: #201b2b;
  --sidebar-accent-foreground: #f6efff;
  --sidebar-border: #2c1f47;
  --sidebar-foreground: #f6efff;
  --sidebar-primary: #ff4fd8;
  --sidebar-primary-foreground: #12041a;
  --sidebar-ring: #ff4fd8;
}

[data-flavor-scheme="redline"] {
  --accent: #201b1a;
  --accent-foreground: #fff4f0;
  --background: #0a0505;
  --border: #2e1c1a;
  --card: #140b0a;
  --card-foreground: #fff4f0;
  --chart-1: #ff3b2f;
  --chart-2: #fff4f0;
  --chart-3: #a8908b;
  --chart-4: #241413;
  --chart-5: #ff6a4d;
  --destructive: #f87171;
  --destructive-foreground: #0a0505;
  --foreground: #fff4f0;
  --input: #2e1c1a;
  --muted: #201b1a;
  --muted-foreground: #a8908b;
  --popover: #140b0a;
  --popover-foreground: #fff4f0;
  --primary: #ff3b2f;
  --primary-foreground: #120202;
  --radius: 4px;
  --ring: #ff3b2f;
  --secondary: #201b1a;
  --secondary-foreground: #fff4f0;
  --sidebar: #140b0a;
  --sidebar-accent: #201b1a;
  --sidebar-accent-foreground: #fff4f0;
  --sidebar-border: #2e1c1a;
  --sidebar-foreground: #fff4f0;
  --sidebar-primary: #ff3b2f;
  --sidebar-primary-foreground: #120202;
  --sidebar-ring: #ff3b2f;
}

[data-flavor-scheme="drafting-table"] {
  --accent: #dedcd7;
  --accent-foreground: #111111;
  --background: #f2f0eb;
  --border: #d4d0c6;
  --card: #e8e5de;
  --card-foreground: #111111;
  --chart-1: #d9480f;
  --chart-2: #111111;
  --chart-3: #6b675f;
  --chart-4: #dedad1;
  --chart-5: #1f6fe0;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --foreground: #111111;
  --input: #d4d0c6;
  --muted: #dedcd7;
  --muted-foreground: #595856;
  --popover: #e8e5de;
  --popover-foreground: #111111;
  --primary: #d9480f;
  --primary-foreground: #ffffff;
  --radius: 4px;
  --ring: #d9480f;
  --secondary: #dedcd7;
  --secondary-foreground: #111111;
  --sidebar: #e8e5de;
  --sidebar-accent: #dedcd7;
  --sidebar-accent-foreground: #111111;
  --sidebar-border: #d4d0c6;
  --sidebar-foreground: #111111;
  --sidebar-primary: #d9480f;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-ring: #d9480f;
}

@theme inline {
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-background: var(--background);
  --color-border: var(--border);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-foreground: var(--foreground);
  --color-input: var(--input);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-ring: var(--ring);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-sidebar: var(--sidebar);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-ring: var(--sidebar-ring);
  --font-display: "Orbitron", sans-serif;
  --font-mono: "Fragment Mono", ui-monospace, monospace;
  --font-sans: "Inter", system-ui, sans-serif;
  --radius-lg: var(--radius);
  --radius-md: max(0px, calc(var(--radius) - 2px));
  --radius-sm: max(0px, calc(var(--radius) - 4px));
  --radius-xl: calc(var(--radius) + 4px);
}
```

### Schemes

- The flavor is dark-native: `:root` and `.dark` carry the same palette, so the theme reads the same with or without a `dark` class.
- Extra palettes are opt-in: set `data-flavor-scheme="<slug>"` on `<html>` or any subtree. Available: `phosphor` (Phosphor), `arcade` (Arcade), `redline` (Redline), `drafting-table` (Drafting Table).

### Token mapping

| Flavor token | shadcn variable |
| --- | --- |
| bg | `--background` |
| fg | `--foreground`, first choice for every `--*-foreground` |
| bg2 | `--card`, `--popover`, `--sidebar` when it sits on the same side as `bg` and reads with `fg` |
| bg + fg (9%) | `--secondary`, `--muted`, `--accent` (shadcn's hover surface, not the flavor accent) |
| fg-muted | `--muted-foreground` (pulled toward `fg` until it reads) |
| accent | `--primary`, `--ring`, `--chart-1` |
| accent-fg | `--primary-foreground` |
| border | `--border`, `--input`, `--sidebar-border` (derived from `bg`/`fg` when the token is a `var()`, `color-mix()` or invisible against `bg`) |
| extra.* | `--destructive`, `--chart-2..5` |
| radius | `--radius`; `--radius-sm/md` never go below 0 |

### Component recipes

- **Button:** use `bg-primary text-primary-foreground rounded-[var(--radius)]`; headings can use `font-display` ("Orbitron", sans-serif).
- **Card:** use `bg-card text-card-foreground border border-border rounded-[var(--radius)]`.
- **Input:** use `bg-background border border-input rounded-[var(--radius)]`.
- **Badge:** use `bg-secondary text-secondary-foreground rounded-[var(--radius)]`; follow the flavor's density and typography rules above.
- **Tabs:** use `border-b border-border` with active `text-primary`.

### Implementation rule for agents

Import primitives from `@/components/ui/*`, apply the theme CSS first, and keep this flavor's Do's and Don'ts as the source of truth. shadcn names are only the implementation surface.
