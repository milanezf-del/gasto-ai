---
name: Obsidian Kinetic
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
  on-surface-variant: '#c6c5d5'
  inverse-surface: '#dfe2f1'
  inverse-on-surface: '#2c303b'
  outline: '#908f9e'
  outline-variant: '#454653'
  surface-tint: '#bdc2ff'
  primary: '#bdc2ff'
  on-primary: '#131e8c'
  primary-container: '#818cf8'
  on-primary-container: '#101b8a'
  inverse-primary: '#4953bc'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00aa76'
  on-tertiary-container: '#003522'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bdc2ff'
  on-primary-fixed: '#000767'
  on-primary-fixed-variant: '#2f3aa3'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0f131d'
  on-background: '#dfe2f1'
  surface-variant: '#313540'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system projects precision, intelligence, and restraint. Tailored for an AI-powered financial workspace, it blends developer-grade technical rigor with premium wealth management ergonomics. The aesthetic balances low-friction data density with deliberate visual clarity, ensuring that complex predictive cash flows, automated categorical splits, and real-time transaction streams remain immediate and effortless to parse.

Drawing from modern technical minimalism and subtle dark glassmorphism, the interface rejects heavy skeuomorphism in favor of structural clarity: crisp 1px micro-borders, deep tiered obsidian planes, and high-frequency violet luminescence that signals algorithmic computation. The atmosphere evokes deep focus, executive-level composure, and mechanical trust.

## Colors

The palette operates on a strict functional stratification of dark tones paired with surgical accents:

- **Canvas & Surface Tiering**: The foundational canvas rests at `#0b0f19` (Obsidian Base). Elevated surfaces scale systematically through `#111827` (Card / Layer 1), `#1e293b` (Overlay / Layer 2), and `#334155` (Active Control / Surface Edge).
- **Core Intelligence**: `#818cf8` serves as the primary luminous violet, reserved for dominant CTAs, selected analytical states, and AI synthesis markers. `#6366f1` supports as an interactive state and gradient anchor.
- **Financial Telemetry**:
  - Positive yield, surplus, and confirmation: Emerald (`#10b981`).
  - Critical thresholds, deficits, and alerts: Rose (`#f43f5e`).
  - Budget warnings and pending algorithmic updates: Amber (`#f59e0b`).
- **Luminescence & Borders**: Structural separation relies on `rgba(255, 255, 255, 0.08)` micro-borders. Subtle background radial blooms of `#818cf8` at 6–10% opacity delineate active conversational AI streams without compromising contrast.

## Typography

The typographic hierarchy implements a disciplined split between editorial structure and numerical utility:

- **Headlines (Hanken Grotesk)**: Renders section architecture and portfolio aggregates. Its tight apertures and geometric balance present an assertive, institutional authority without becoming cold.
- **Body & Data Displays (Geist)**: Manages all narrative AI responses, tables, ledgers, and interactive states. Geist’s neutral character and tabular alignment ensure fiscal digits, timestamps, and currency markers align across high-density registers.
- **Numerics Guidance**: All transactional balances, portfolio percentages, and algorithmic confidence metrics must utilize tabular numbers (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during live data feeds.

## Layout & Spacing

The layout model enforces a 12-column responsive fluid grid designed to toggle between high-density operational ledgers and conversational AI workspaces:

- **Desktop (1024px+)**: 12-column layout with 2rem outer margins and 1.5rem gutters. The interface partitions into fixed tactical sidebars (navigation & quick-action triggers), a wide central ledger/analytics canvas, and a contextual 380px AI insight rail.
- **Tablet (768px – 1023px)**: 8-column layout with 1.5rem margins and 1rem gutters. The AI rail collapses into a drawer, prioritizing financial tracking charts and immediate transaction logs.
- **Mobile (< 768px)**: 4-column layout with 1rem margins and 1rem gutters. All ledger elements reflow into full-width stacked micro-cards, with conversational assistant prompts anchored via bottom sheets.
- **Rhythm**: Internal component padding follows the structured `space-*` scale to maintain strict micro-alignment between tabular data rows and conversational message clusters.

## Elevation & Depth

Visual hierarchy does not rely on diffused drop shadows, which dilute the deep obsidian canvas. Depth is achieved strictly through planar stacking and edge luminosity:

- **Surface Tiers**:
  - `Layer 0 (Canvas)`: `#0b0f19` — The infinite base.
  - `Layer 1 (Cards, Ledger Containers)`: `#111827` overlaid with a 1px border of `rgba(255, 255, 255, 0.08)`.
  - `Layer 2 (Dropdowns, Dialogs, Floating Toolbars)`: `#1e293b` with a 1px border of `rgba(255, 255, 255, 0.12)`.
- **Edge Highlighting**: Modals and actionable cards utilize an inner border highlight (`inset 0 1px 0 0 rgba(255, 255, 255, 0.06)`) to convey physical separation against pure dark backdrops.
- **AI Glow / Luminescence**: When the assistant generates forecasts or surfaces insights, the container receives a subtle outer atmospheric glow: `0 0 24px -4px rgba(129, 140, 248, 0.15)`. No heavy black drop shadows are permitted.

## Shapes

The design system enforces a precise, technical shape language via soft geometry:

- **Base Radius (`0.25rem` / `4px`)**: Applied to badges, table tags, inline code snippets, and precision form inputs.
- **Container Radius (`rounded-lg` / `0.5rem` / `8px`)**: Applied to standard content cards, analytics widgets, action sheets, and modal panels.
- **Accent Radius (`rounded-xl` / `0.75rem` / `12px`)**: Reserved strictly for conversational assistant chat bubbles and high-level dashboard summaries.
- **Sharpness Intent**: The tight rounding reinforces an analytical instrument feel, contrasting with standard consumer finance applications that rely on hyper-rounded pills.

## Components

- **Buttons**:
  - *Primary*: Solid `#818cf8` surface with `#0b0f19` Geist medium text. On hover, shifts to `#6366f1` with a subtle violet halo.
  - *Secondary / Surface*: `#1e293b` fill with a 1px border of `rgba(255, 255, 255, 0.08)` and `#f8fafc` text. Hover shifts border to `rgba(255, 255, 255, 0.18)`.
  - *Ghost / Destructive*: Transparent background, `#f43f5e` text, shifting to `rgba(244, 63, 94, 0.1)` on hover.
- **Chips & Tags**:
  - Rendered with `space-xs` vertical and `space-sm` horizontal padding.
  - Category tags (e.g., "Subscription", "Tax-Deductible") use `#111827` surface, `rgba(255, 255, 255, 0.08)` border, and Geist label-sm text.
  - Status chips feature a 6px circular indicator dot (emerald for settled, amber for pending review).
- **Lists & Data Tables**:
  - Flat structure without alternating zebra rows. Rows are separated by 1px `rgba(255, 255, 255, 0.05)` rules.
  - Row hover invokes a micro-transition to `#111827`. Numeric values are right-aligned, monospaced via Geist, and colored according to cash flow polarity.
- **Form Controls (Checkboxes & Radios)**:
  - Checkboxes use a 16px square with 2px corner radius, `#1e293b` fill, and a 1px border of `rgba(255, 255, 255, 0.12)`. When checked, the fill shifts to `#818cf8` with an obsidian check icon.
- **Input Fields**:
  - Height of 40px, filled with `#111827`, surrounded by a 1px `rgba(255, 255, 255, 0.08)` border.
  - Focus state transitions border color to `#818cf8` and applies an outer glow of `0 0 0 1px #818cf8`. Monospace mode triggers when typing currencies or mathematical expressions.
- **Cards & AI Insight Panels**:
  - Container cards use `#111827` with 1px `rgba(255, 255, 255, 0.08)`.
  - AI-augmented insight modules introduce a subtle diagonal gradient overlay: `linear-gradient(135deg, rgba(129, 140, 248, 0.05) 0%, rgba(17, 24, 39, 0) 100%)` accompanied by a violet spark indicator icon.
- **Conversational Chat Prompts**:
  - User messages: Solid `#1e293b` surface with crisp right alignment.
  - AI responses: Transparent background bounded by a 1px violet micro-border (`rgba(129, 140, 248, 0.2)`), displaying raw analytical copy followed by actionable pill triggers (e.g., "Adjust Budget", "Categorize All").