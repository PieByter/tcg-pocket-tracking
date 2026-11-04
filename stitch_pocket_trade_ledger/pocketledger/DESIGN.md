---
name: PocketLedger
colors:
  surface: '#0f131d'
  surface-dim: '#0f131d'
  surface-bright: '#353944'
  surface-container-lowest: '#0a0e18'
  surface-container-low: '#171b26'
  surface-container: '#1c1f2a'
  surface-container-high: '#262a35'
  surface-container-highest: '#313540'
  on-surface: '#dfe2f1'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dfe2f1'
  inverse-on-surface: '#2c303b'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#d0bcff'
  on-tertiary: '#3c0091'
  tertiary-container: '#b395ff'
  on-tertiary-container: '#4900ae'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#0f131d'
  on-background: '#dfe2f1'
  surface-variant: '#313540'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style
The design system establishes a high-utility, tournament-grade digital vault engineered for collectors, traders, and multi-account competitive players of Pokémon TCG Pocket. The visual tone balances the rigor of financial portfolio trackers with the luminescent, collectible excitement of opening physical booster packs. 

The aesthetic fuses **Modern Dark-Mode Utility** with **Prismatic Glassmorphism**. Clean, low-friction ledger interfaces allow instantaneous scanning across multiple account inventories, while iridescent micro-interactions and chromatic borders evoke the tactile magic of holographic card foils. The product communicates supreme precision, prestige, and speed—transforming casual deck management into a streamlined trading floor.

## Colors
The palette is built upon deep cosmic obsidian layers to maximize optical contrast against luminous rarity tier designations and dynamic holo effects.

- **Primary (`#06B6D4` - Cyber Cyan):** Represents active system states, primary CTAs, booster pack stamina gauges, and account switching highlights.
- **Secondary (`#F59E0B` - Electric Amber / Crown Gold):** Dictates premium ledger balances, Crown-rare designations, and completionist milestones.
- **Tertiary (`#8B5CF6` - Psychic Ultraviolet):** Applied to Immersive rarity indicators, secret mission badges, and holographic shimmer gradients.
- **Neutral Base (`#0B0F19` - Void Slate):** Root canvas background. Component surfaces stack progressively via `#111827` (Card Surface) and `#1F2937` (Interactive Elevated Surface).

### Functional Card Rarity Palette
- **Diamond 1–4:** `#38BDF8` with translucent cyan frosted backgrounds.
- **Star 1–3:** `#A855F7` with metallic prism accents.
- **Crown Gold Foil:** Linear gradient `linear-gradient(135deg, #F59E0B 0%, #FCD34D 50%, #D97706 100%)` accompanied by a specular gold box-glow.
- **Data Accents:** Semantic green (`#10B981`) for completed playsets (2/2); semantic muted slate (`#4B5563`) for unowned slots (0/2).

## Typography
The typographic hierarchy utilizes three distinct typefaces serving distinct cognitive tasks:

1. **Space Grotesk (Headlines):** Imparts a technical, futuristic edge suitable for modern competitive gaming.
2. **Geist (Body & Navigation):** Delivers clean readability and neutral ergonomics across data-dense dashboards.
3. **JetBrains Mono (Data, Tables, & Counters):** Strictly leveraged for rarity designations, owned card counters (`0/2`, `1/2`, `2/2`), set numbers (`A1-045`), and multi-account inventory tallies. Monospaced tabular alignment guarantees vertical scanning integrity across compact rows without visual jitter.

## Layout & Spacing
The layout follows a fluid-responsive model built on an 8pt base spacing unit with 4pt half-steps for compact data rows. 

- **Grid Architecture:** Desktop views utilize a 12-column adaptive layout with `gutter-lg` (`1.5rem`) and `margin-lg` (`2.5rem`), transitioning to a single-column stacked view with sticky sub-headers and card filters on mobile devices (`< 768px`).
- **Ledger Density:** Card collection tables prioritize horizontal economy: fixed-width identifier columns (Set #, Rarity Icon) paired with flexible card name cells and compact segmented counters for linked accounts (Main, Alt 1, Alt 2).
- **Responsive Adaptations:** Side drawers and drawer-based filter trays compress into bottom-sliding sheets on viewports under 640px.

## Elevation & Depth
Depth is created through tinted glassmorphic stratification rather than conventional drop shadows.

- **Level 0 (Canvas):** Pure `#0B0F19` backdrop with fixed radial background accents (`rgba(6, 182, 212, 0.04)` and `rgba(139, 92, 246, 0.04)`).
- **Level 1 (Panels & Ledger Rows):** Semi-opaque surfaces (`rgba(17, 24, 39, 0.75)`) layered over a `12px` backdrop blur, bordered by a hair-thin 1px border (`rgba(255, 255, 255, 0.07)`).
- **Level 2 (Cards, Flyouts & Modals):** Elevated glass surfaces (`rgba(31, 41, 55, 0.85)`) over a `20px` backdrop blur, bounded by `rgba(6, 182, 212, 0.15)` and an ambient, colored glow (`0 8px 32px -4px rgba(0, 0, 0, 0.65)`).
- **Level 3 (Holographic Foil Interactive Focus):** When hovering or inspecting high-rarity cards, dynamic CSS specular gradients activate across the top border: `box-shadow: 0 0 20px -2px rgba(6, 182, 212, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)`.

## Shapes
The shape language relies on precision technical corners (`roundedness: 1` — Soft, base `0.25rem` / `4px`), reflecting high-performance telemetry software.

- **Micro UI & Pills:** `0.25rem` (4px) for rarity chips, status tags, and tabular count triggers.
- **Card Containers & Inputs:** `0.5rem` (8px / `rounded-lg`) ensuring a disciplined, non-bubble silhouette that frames card artwork cleanly.
- **Modals & Master Sheets:** `0.75rem` (12px / `rounded-xl`) for main card inspector viewports.
- **Foil Accent Strips:** Exact 90° razor bevels for internal tabular divider notches.

## Components

### Buttons
- **Primary Action (Pack Open / Sync):** Electric Cyan background (`#06B6D4`) with `#0B0F19` bold typography, slight top internal glow (`inset 0 1px 0 rgba(255, 255, 255, 0.4)`), and a subtle `0 0 16px rgba(6, 182, 212, 0.35)` hover aura.
- **Secondary (Vault Filter):** Frosted glass surface (`rgba(255, 255, 255, 0.05)`) with a 1px border (`rgba(255, 255, 255, 0.12)`), text rendered in white, shifting to cyan border on focus.
- **Destructive / Reset:** Deep charcoal with muted rose boundary (`#F43F5E`), illuminating only upon hover confirmation.

### Data Chips & Rarity Badges
- **Diamond 1–4 Badges:** Crisp cyan tint container (`rgba(56, 189, 248, 0.1)`) housing faceted geometric diamond vector icons alongside JetBrains Mono label tokens.
- **Star 1–3 Badges:** Amethyst translucent container (`rgba(168, 85, 247, 0.12)`) with a 1px iridescent stroke.
- **Crown Badges:** Metallic Amber base (`#F59E0B`) with an animated specular swipe and contrasting jet-black typography.
- **Account State Chips:** Multi-account mini pills (e.g., `ACC-01: 2/2`, `ACC-02: 0/2`) with immediate emerald/slate background color-coding.

### Ledger Data Tables
- **Header:** Sticky, flat `#0B0F19` backdrop with micro-uppercase `label-sm` labels, sorting indicators, and horizontal hairline dividers.
- **Rows:** Alternating subtle zebra striping (`transparent` vs. `rgba(255, 255, 255, 0.015)`). Hovering over a row triggers a `rgba(6, 182, 212, 0.06)` background transition and reveals quick-increment actions.
- **Numeric Controls:** Direct embedded split-steppers (`-` / `+`) featuring monospaced numerals with optical alignment.

### Input Fields & Search
- Sleek dark fields (`#111827`) bounded by `rgba(255, 255, 255, 0.1)`. Active focus shifts border to `#06B6D4` paired with an inner shadow ring. Integrated keyboard shortcut badges (e.g., `⌘K`) rendered in `label-sm`.

### Multi-Account Card Tile
- Dual display: A high-density visual view rendering cropped card thumbnails crowned with holo foil sheen layers and stacked progress dots along the bottom border representing ownership parity across up to 5 concurrent accounts.