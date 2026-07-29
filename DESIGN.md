---
name: HusAI
description: Real-time AI communication coach for Filipino virtual assistants
colors:
  # Brand (violet/indigo) — the brand acting
  violet-primary: "#8b5cf6"
  indigo-strong: "#6366f1"
  violet-bright: "#a78bfa"
  # AI/Live (fuchsia) — the AI acting live, right now. Never anything else.
  live-fuchsia: "#e879f9"
  live-fuchsia-bright: "#f0abfc"
  # Semantic status — only these two exist. No success color (see Colors: Do/Don't).
  danger-rose: "#f43f5e"
  warning-amber: "#f5b544"
  warning-text: "#f0d48a"
  # Neutral — surfaces, text, borders
  canvas: "#0a0b10"
  surface: "#0e1017"
  card: "#14161f"
  card-elevated: "#1c1f2b"
  inset: "#0c0e15"
  text-primary: "#eef0f6"
  text-body: "#c3c8d6"
  text-secondary: "#8b93a7"
  text-muted: "#788198"
typography:
  display:
    fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.7rem, 3vw, 2.15rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.9rem, 3vw, 2.3rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, 'Segoe UI', sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, 'Segoe UI', sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.06em"
  mono:
    fontFamily: "'SF Mono', 'JetBrains Mono', ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace"
rounded:
  sm: "12px"
  md: "18px"
  lg: "24px"
  full: "999px"
spacing:
  gap: "clamp(12px, 1.4vw, 16px)"
  card-pad: "clamp(18px, 2vw, 24px)"
  page-x: "clamp(20px, 3.5vw, 48px)"
  page-y: "clamp(24px, 2.5vw, 40px)"
components:
  button-primary:
    backgroundColor: "{colors.violet-primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "11px 18px"
  button-secondary:
    backgroundColor: "{colors.card-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "11px 18px"
  button-danger:
    backgroundColor: "{colors.danger-rose}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "11px 18px"
---

# Design System: HusAI

## Overview

**Creative North Star: "The Quiet Command Center"**

HusAI's current visual system is a dark-first (with a fully-designed light counterpart), violet-anchored interface built for a moment of real pressure: a VA on a live call, needing calm, precise help without visual noise. The system leans toward Raycast's control-panel precision and Linear's restraint, layered with a single warm signal color (violet→indigo) that means "this is the brand acting on your behalf," and a second, deliberately rarer color (fuchsia) that means "the AI is live right now." Everything else — text, borders, surfaces — stays neutral so those two signals stand out when they appear.

**Pinned reference (binding, partially carried out):** Raycast's actual UI achieves depth with zero drop shadows — a pure surface-color ladder where each layer reads as "one step forward" than the last — plus 1px hairline borders, a 96px section rhythm, and a hard rule that any saturated accent appears at most once per page. HusAI adopts this depth/spacing/restraint philosophy, while keeping violet/indigo (never Raycast's red) as the one accent color, per the Two-Signal Rule below.

**Progress:** the Once-Per-Page and Two-Signal rules are now enforced on the Dashboard and Sidebar (see Named Rules below) — a `/impeccable critique` pass found the gap was worse than first estimated (up to 18 simultaneous full-strength accent elements on a populated Dashboard, not the original ~7 guess) and fixed the specific violations. The Zero-Shadow Rule and Section-Rhythm Rule are still **not yet implemented** — the current soft ambient hover-shadow and fluid `clamp()` spacing (no fixed section rhythm) remain the **before** state, described accurately below rather than glossed over. Two real bugs the critique also caught and fixed, unrelated to the pinned reference but found along the way: `.delta.good` was reusing brand violet for a "success" meaning (now neutral, per the Do/Don't list below), and `--text-muted` failed WCAG AA contrast in both themes (now fixed — see Colors).

**Key Characteristics:**
- Two-signal color language: violet for brand/action, fuchsia strictly for "AI is active right now"
- Flat-at-rest, lift-on-interaction elevation (borders do the resting work; shadow is reserved for hover/focus feedback)
- Generous fluid spacing driven by `clamp()`, so density adapts smoothly rather than snapping at breakpoints
- A recurring pulsing-dot motif (`coach-pulse`) is the app's signature "something live is happening" language, reused identically across the LIVE nav badge, the sidebar's active-call status, and the floating coach header

## Colors

**This is a closed list.** Every saturated or semantic color the app uses is declared below, grouped by what it means — not by hue family. A new color requires picking one of these four categories (or adding to Known Exceptions, deliberately, below) before it ships; it is never added by simply reaching for a hex value that "looks right" in the moment. The same four categories are named, in the same order, as comment headers directly above the token declarations in `styles.css`'s `:root` blocks, so the rule is enforceable at the source, not just documented here.

### Brand (violet/indigo)
- **Violet Primary** (`--accent`, `#8b5cf6` dark / `#7c3aed` light): The brand acting. Buttons, active nav states, links, focus rings. Always paired with **Indigo Strong** (`--accent-strong`, `#6366f1`) as `--grad`, a 135° gradient — HusAI's single most repeated visual signature.
- **Violet Bright / Accent Text** (`--accent-bright` / `--accent-text`): Emphasis variants — links, icon accents, ring-chart strokes, banner text. Never used for large fills.
- **Accent Soft** (`--accent-soft`) and **Border Accent** (`--border-accent`): Low-alpha violet washes for active-state backgrounds and hover/focus border emphasis.
- **Body Glow** (`--body-glow`): A very-low-alpha (≤0.1) violet radial wash used as whole-page ambiance. Exempt from the Once-Per-Page Rule below — it's atmospheric texture, not a foreground signal competing for attention.

**The Once-Per-Page Rule (implemented on Dashboard/Sidebar).** A saturated accent — the violet gradient fill, or a fuchsia live indicator — appears at full strength at most once in a given viewport of a page. The Dashboard hero banner is now the sole full-strength gradient surface; the sidebar's Start-a-Call button, Pro promo card, the header CTA, and the Quick Actions tile were demoted to flat `--accent` fills or neutral cards. (Chart/data-encoding color — trend bars, performance-legend dots — is a separate category from brand decoration and is not covered by this rule.)

### AI/Live (fuchsia)
- **Live Fuchsia** (`--live`, `#e879f9` dark / `#c026d3` light, paired with `--live-bright`): Means exactly one thing — **the AI is live, right now.** The LIVE nav badge (now wired to real call state, not always-on), the sidebar's active-call status pill, the floating coach's live indicator, the coaching waveform's gradient fill.
- **Live Soft / Live Border** (`--live-soft`, `--live-border`): Low-alpha washes for the same purpose, used for backgrounds and emphasis borders on live-only elements.
- **Grad Accent** (`--grad-accent`): The fuchsia→violet gradient pairing, for surfaces that are actively AI-generating (e.g. the mic visualizer's hero variant).

**The Two-Signal Rule (enforced).** Violet = the brand acting. Fuchsia = the AI acting live, right now. A third saturated color is never introduced for pure decoration — anything that isn't brand or "live" defaults to the neutral gray-violet ladder, or to danger/warning strictly when it means exactly that. Fixed violations: the notification dot now uses violet (generic attention, not AI-live — it was fuchsia); `coach-status-live` now uses fuchsia (it was violet, inside the one component that *is* actually live); the LIVE nav badge is wired to real call state.

### Semantic status
- **Danger Rose** (`--danger`, `#f43f5e` dark / `#e11d48` light, with `--danger-text`/`--danger-soft`/`--danger-border`): Destructive actions, errors, sign-out hover. Never decorative.
- **Warning Amber** (`--warning`, `#f5b544` dark / `#b45309` light, with `--warning-text`/`--warning-soft`/`--warning-border`): Payment/attention warnings only (e.g. a past-due billing banner).
- **No success color, deliberately.** A positive/improved state (a score that went up, a completed action) is conveyed with neutral text plus a directional glyph — never brand violet, never a new green introduced ad hoc. See the Do/Don't list.

**Fixes applied while closing this list:**
- `.banner.warning`'s text was a hardcoded `#f0d48a` with **no light-theme override** — 1.45:1 contrast on white (catastrophic WCAG failure), invisible in practice. Now `var(--warning-text)`, theme-aware: the existing `#f0d48a` value in dark mode (already fine at 12.44:1, just tokenized), and light mode reuses `--warning` directly (5.02:1 on white — already dark enough to serve as its own text color).
- `.banner.warning`'s border and `.banner.error`'s border were raw `rgba(...)` values, one of which (`rgba(239, 68, 68, 0.35)`) didn't match `--danger` **at all** — a different red entirely, apparently left over from before the token was finalized. Both now reference new `--danger-border`/`--warning-border` tokens matching their actual base colors.
- `.banner.info`'s text used `--accent-bright`, which clears AA in dark mode (6.63:1) but falls just short in light mode (4.23:1, under the 4.5:1 floor). Switched to `--accent-text`, identical value in dark mode (no visual change there) and 7.1:1 in light mode — the token that already existed specifically for "accent used as text."

### Neutral
- **Canvas / Surface / Card / Card Elevated / Inset**: the surface-color ladder used for depth — each layer reads as "one step forward" without needing a shadow to prove it.
- **Text Primary / Body / Secondary / Muted**: a four-step gray-violet text ladder (`#eef0f6` → `#788198` in dark mode) so hierarchy is legible without leaning on color.
- **Hairline border** (`--border` / `--border-2`): the default 1px border on nearly every card and row — the primary depth cue at rest, not shadow.
- Pure `#fff`/`#000` are always available as the extremes of this scale (e.g. white text on a solid accent fill) and aren't tokenized separately for that reason alone — they aren't "a color outside the list," they're the edges of it.

**Contrast fix applied:** `--text-muted` was `#5b6377` (dark) / `#9aa1b0` (light), failing WCAG AA (3.00:1 / ~2.6:1, against `--card`/white) on 18+ real load-bearing sites (timestamps, section labels, hints — not decoration). Brightened to `#788198` (dark, 4.63:1) and darkened to `#6b7489` (light, 4.68:1), same hue, minimum change needed to clear 4.5:1. Light mode now sits close to `--text-secondary` (4.68:1 vs 4.83:1) — accepted as the accessibility-correct tradeoff given how little headroom exists above the AA floor in light mode; revisit `--text-secondary` too if more visual separation is wanted later.

### Known Exceptions

Two things found while auditing for "anything outside the list" — deliberately left as-is rather than silently ignored or fixed as a side effect of this pass:

- **`Logo.jsx`'s `LogoMark`** defines a fourth gradient (`#ec4899 → #d946ef → #a855f7 → #6366f1`) not matching either `--grad` or `--grad-accent`, and a hex (`#ec4899`) that appears nowhere else in the system. Small footprint, but worth folding into the token system or explicitly re-confirming as intentional next time the logo is touched.
- **The landing hero's beam field** (`.lp-beams`) uses `mix-blend-mode: screen` in dark mode so the beams add light rather than paint violet over the canvas — without it they read as diagonal stripes, which is exactly how the first implementation looked. It stays strictly inside the Brand ramp (`--accent` → `--accent-bright` → `--accent-strong`); fuchsia was deliberately kept out despite being visually tempting, because the Two-Signal Rule reserves it for "the AI is live right now" and an ambient background is not that.
- **The landing page runs on its own always-dark canvas** (`.lp-dark` in `landing.css`), in both themes. It re-declares the dark token set locally over a deep violet-black ramp (`#0a0714` → `#1f1740`) rather than the app's near-black neutrals, so the beam backdrop has something purple to sit on. This is a Persuade-surface decision and does not leak into the app: `.auth-shell` shares `.lp` for the nav/footer chrome but deliberately not `.lp-dark`, so the auth pages keep following the user's theme. It also supersedes what used to be a one-off exception here — `.lp-measure`'s "cinematic dark in both themes" is now the rule for that whole page rather than a single section breaking it, though it keeps its own green-tinted one-off palette (`#0c1310`, `#9fb3aa`).

## Typography

**Display/Body/Label Font:** `-apple-system, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, 'Segoe UI', sans-serif` — an Apple-first system stack so the app reads native and fast on macOS, with Inter and Segoe UI as faithful cross-platform fallbacks.
**Mono Font:** `'SF Mono', 'JetBrains Mono', ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace` — used narrowly, for tabular data that must not shift width: call timers, score numbers.

**Character:** Confident and quiet — no display serif, no decorative type; hierarchy comes from size/weight steps and tight negative letter-spacing on larger sizes, not from font variety.

### Hierarchy
- **Display** (600, `clamp(1.7rem, 3vw, 2.15rem)`, 1.2 line-height, −0.025em tracking): Page-level greetings (Dashboard "Good morning," Plans header).
- **Title** (700, `clamp(1.9rem, 3vw, 2.3rem)`, 1.1 line-height, −0.03em tracking, tabular-nums): Large numeric values — plan prices, stat-tile figures.
- **Headline** (700, ~1.15rem): Card and section headers.
- **Body** (400–500, 0.86–0.94rem, 1.55 line-height): Default copy, descriptions, form labels.
- **Label** (700, 0.68–0.76rem, 0.06em tracking, uppercase): Stat-tile labels, sidebar section headers ("Workspace", "Improve") — the app's one consistently uppercase-tracked text role.

## Layout

Fluid, `clamp()`-driven spacing rather than fixed breakpoint jumps: page padding, card padding, and inter-element gaps all scale continuously with viewport width (`--page-pad-x: clamp(20px, 3.5vw, 48px)`, `--gap: clamp(12px, 1.4vw, 16px)`). Content is capped at `1520px` and centered, so ultrawide viewports get breathing room on both sides rather than one giant right-hand gap.

**Measured column for reading surfaces.** Help & Support is the app's one Read-mode page (prose to be understood, not a task to be completed), and caps at `920px` rather than taking the full shell width every Operate page uses. Long help answers at 1400px would be unreadable regardless of how well the rest of the system is tuned — the cap is the page's most load-bearing design decision, not a stylistic preference. Its topics use native `<details>` disclosure so keyboard, screen-reader, and browser find-in-page behavior come for free; the "setup check" rows report support for *this* browser rather than presenting a compatibility table, and use neutral dots with warning amber only when something needs attention (never a success color — see Colors).

**Pinned reference (binding, not yet implemented): a 96px section rhythm.** Raycast separates major page sections with a flat 96px vertical gap, distinct from the smaller fluid gap used *within* a section (between cards, between a heading and its body). HusAI's current spacing tokens have no equivalent dedicated "between sections" value — `--gap` is reused for both inter-section and intra-section spacing. Introducing a `--section-gap: 96px` token (fixed, not fluid — Raycast's rhythm does not scale down on smaller desktop viewports) and applying it between major page blocks (e.g., the Dashboard's metrics row, hero, and card grids) is the concrete implementation step for this rule.

### Named Rules
**The Section-Rhythm Rule (pinned target).** Major sections on a page are separated by a fixed 96px gap, never a fluid one — spacing *within* a section still scales with `--gap`. The distinction is what makes long pages feel paced rather than merely padded.

The authenticated shell is a persistent sidebar (`clamp(232px, 17.5vw, 268px)` wide, collapsible to a 78px icon rail) plus a main content column. Below 900px the sidebar becomes an off-canvas drawer with a mobile top bar; nothing is hidden at any width, only relocated.

## Elevation & Depth

**Pinned reference (binding, not yet implemented): zero drop shadows.** Raycast's actual depth model uses no `box-shadow` at all, including on hover — depth comes entirely from the surface-color ladder (each layer a discrete step lighter than the one behind it) plus the 1px hairline border. HusAI adopts this exactly: the ambient hover shadow described below is the **before** state to be removed, not a feature to preserve. A hovered card should read as "elevated" purely by shifting to the next surface step (e.g., `--card` → `--card-2`) and/or brightening its border, never by gaining a shadow.

The current implementation (described here accurately, as the measurable starting point): flat at rest, with a soft ambient shadow added on hover/focus/floating states. Cards, stat tiles, and list rows carry no shadow in their resting state — depth already comes from the card/canvas surface-color step plus a 1px hairline border, which is the *correct* half of the pattern. The part that needs to go is the interactive-state shadow itself.

### Shadow Vocabulary (current — target is to retire the first entry)
- **Ambient Interactive** (`box-shadow: 0 1px 2px rgba(0,0,0,0.28), 0 18px 44px -12px rgba(0,0,0,0.5)` dark / lighter values in light mode): **To be removed per the pinned zero-shadow target.** Currently used on hover/focus states and floating surfaces (popovers, drawers). Replace with a surface-step change (promote to `--card-2`) and/or a brighter border on hover; floating surfaces (popovers/drawers) may keep a 1px border-only separation from the page instead.
- **Focus Ring** (`box-shadow: 0 0 0 3px var(--accent-soft)`): Kept — this is an accessibility affordance (focus visibility), not a decorative depth shadow, and Raycast's own restraint doctrine doesn't extend to removing focus indicators.
- **Live Pulse** (`@keyframes coach-pulse`, animated `box-shadow` ring from `var(--live-soft)` to transparent): Kept — this is motion/signal, not static depth, and is the app's signature live-indicator language (see Colors: Live Fuchsia).

### Glass Material (floating-over-content surfaces only)
Two places qualify, on one shared test: **the surface floats directly over moving or meaningful content**. That is what makes translucency legible instead of decorative, and it is the whole rule — an opaque card on a flat page gains nothing from blur.

1. **The floating Lifeline card** (below) — over live page content.
2. **The landing hero's badge and listening pill** — over the animated beam field. Same recipe at a lighter weight (`blur(16px) saturate(170%)` over `color-mix(in srgb, var(--card) 62%, transparent)`), because they are small chips rather than a panel, and Apple's guidance scales material thickness with surface size. Both fall back to solid `--card` under `prefers-reduced-transparency`.

Nothing else in the app gets glass. The `.docked` Lifeline variant stays opaque — there is nothing behind it worth blurring.

The floating Smart Replies card uses a translucent, blurred material — `backdrop-filter: blur(20px) saturate(180%)` over `color-mix(in srgb, var(--card-2) 72%, transparent)`, with a brighter top border edge (`--glass-border-top`) reading as light catching the surface. This is a deliberate, scoped exception to the rest of the system's opaque-card language, not a general pattern: it's reserved for the one floating overlay that sits directly over real page content, where translucency is legible and purposeful (per Apple's materials guidance — heavier/opaque materials for structural regions, lighter/translucent for a floating, non-blocking layer). The `.docked` variant (embedded inline in the PiP coach window) stays opaque — there's nothing meaningful behind it to blur. Entrance animates blur and scale together ("materialize, don't just fade"), and respects both `prefers-reduced-motion` (drops the animation) and `prefers-reduced-transparency` (drops the blur, falls back to solid `--card-2`) as independent signals.

### Named Rules
**The Zero-Shadow Rule (pinned target, supersedes Rest-Is-Flat below).** No element carries a `box-shadow` for the purpose of depth, at rest or on interaction. Depth is conveyed exclusively by the surface-color ladder and hairline borders. Focus rings and the live-pulse animation are exempt — they signal state, not depth.
**The Rest-Is-Flat Rule (current, partially superseded).** Surfaces carry a border, never a shadow, at rest — this half already matches the pinned target. The remaining gap is the hover/interactive shadow, which the Zero-Shadow Rule now retires.

## Shapes

Radius scale: `8px` (`--radius-xs`, compact icon-sized controls — coach toggles, the sidebar collapse button), `12px` (buttons, inputs, small tiles), `18px` (default cards, the system's most common radius), `24px` (hero banners, large feature cards). Pills (`999px`) are reserved for status chips, badges, and toggle switches — never used on a rectangular content card. Borders are always 1px and hairline-opacity, except the deliberately subdued 2px `--border-accent` blockquote marker — colored or thick decorative borders are otherwise refused (see Do/Don't).

## Components

### Buttons
- **Shape:** `12px` radius, all variants.
- **Primary:** `--grad` (violet→indigo gradient) fill, white text, ambient shadow tinted violet (`0 6px 20px -6px var(--accent)`), lifts 1px on hover.
- **Secondary:** Card-elevated background, full-opacity border, no shadow — sits visually behind Primary.
- **Danger:** Solid `--danger` fill, white text — reserved for destructive confirmation only.

### Cards / Containers
- **Corner Style:** `18px` (default `.dash-card`) or `24px` (hero/feature cards).
- **Background:** `--card`, one step above canvas.
- **Shadow Strategy:** none at rest; `Ambient Interactive` shadow + slight upward transform on hover (see Elevation & Depth).
- **Border:** 1px hairline, always.
- **Internal Padding:** `--card-pad` (fluid, 18–24px).

### Inputs / Fields
- **Style:** `--inset` (recessed) background, 1px `--border-2` border, `12px` radius.
- **Focus:** Border shifts to `--accent`, plus the violet Focus Ring shadow — no color change on the background itself.

### Navigation (Sidebar)
- **Style:** Persistent rail, hairline right border, transparent nav items by default.
- **Active state:** Pill-style background (`--accent-soft`), violet text — no border, no shadow, color-wash only.
- **Live status:** A dedicated pulsing-dot row (fuchsia) appears only while a call is active, clickable to return to it from anywhere in the app.
- **Collapsed state:** Animates to a 78px icon-only rail; all text and the promo card hide, active-state pill treatment is preserved on icons.

### Smart Replies / Lifeline Card (signature component)
The one component unique to HusAI's actual product mechanism, not a generic UI primitive: a docked or floating card showing up to three AI-suggested reply lines during a live call, each individually copyable. It carries a live mic-level visualizer in its header (real audio-reactive bars, gradient-filled fuchsia→violet) and persists on screen until manually dismissed or replaced — it does not auto-hide, because disappearing mid-thought would undermine its purpose. This card, doubled with the floating "HusAI Live Coach" window it can appear inside, is the most visually distinctive thing in the product and the clearest embodiment of the North Star: quiet, precise, present exactly when needed.

## Do's and Don'ts

### Do:
- **Do** treat violet as the only "brand action" color and fuchsia as the only "AI is live" color — never swap their roles.
- **Do** keep cards and rows flat (border only) at rest; add the Ambient Interactive shadow only on hover/focus/floating states.
- **Do** use the uppercase, tracked Label style for section headers and stat labels — it's the app's one consistent all-caps convention.
- **Do** let spacing scale fluidly with `clamp()` rather than jumping at fixed breakpoints.

### Don't:
- **Don't** introduce a third saturated brand color for decoration. Anything that isn't violet, fuchsia, or a strict danger/warning status stays neutral gray.
- **Don't** apply a resting shadow to a card or tile — that's reserved for interaction, per the Rest-Is-Flat Rule.
- **Don't** recolor an icon or status element to violet/fuchsia when its real-world meaning is something else (destructive, warning, success) — semantic color always wins over brand color. (Fixed: `.delta.good` was using brand violet for "score improved"; now neutral, relying on its directional arrow glyph instead.)
- **Don't** use the pill/`999px` radius on anything that isn't a status chip, badge, or toggle.
