# STYLE-SPEC.md — Maestro Website Redesign Bible

> **Purpose:** This document is the single source of truth for the Maestro website visual redesign. Every value is exact and implementable. An implementer should be able to follow this spec without asking a single question.
>
> **Design philosophy:** Dark editorial. Not "dark mode" — dark *editorial*. Think a well-art-directed tech magazine spread, not a SaaS template. Inspired by Linear's restraint, Warp's warmth, Raycast's product integration, Cursor's minimalism, and Vercel's typographic confidence.

---

## Table of Contents

1. [Typography](#1-typography)
2. [Color Palette](#2-color-palette)
3. [Layout System](#3-layout-system)
4. [Animations & Motion](#4-animations--motion)
5. [Textures & Effects](#5-textures--effects)
6. [Component-by-Component Specs](#6-component-by-component-specs)
7. [Anti-AI-Generated Checklist](#7-anti-ai-generated-checklist)

---

## 1. Typography

### Font Stack

The current site uses Inter for everything. That's fine for body but lacks editorial punch. We add **Space Grotesk** as a display font — it has geometric character with slightly quirky terminals that feel hand-picked, not defaulted-to.

```
Google Fonts import:
https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap
```

```css
--font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
--font-body:    "Inter", "SF Pro Text", system-ui, -apple-system, sans-serif;
--font-mono:    "JetBrains Mono", "SF Mono", "Fira Code", monospace;
```

**Why Space Grotesk:** It's geometric like Inter but with more character — the lowercase `a` is single-story, the `g` has a distinctive tail, numbers are tabular. It screams "someone chose this deliberately" rather than "we picked the first sans-serif on Google Fonts." Linear uses Inter everywhere — we differentiate by mixing.

### Type Scale (Revised)

The current type scale is safe. We make it more editorial with bigger contrasts between levels, and add a new `--text-5xl` for hero impact.

| Token            | Size        | Weight | Line Height | Letter Spacing | Font         | Usage                          |
| ---------------- | ----------- | ------ | ----------- | -------------- | ------------ | ------------------------------ |
| `--text-5xl`     | `4.5rem`    | 700    | 1.0         | `-0.04em`      | display      | Hero headline (desktop)        |
| `--text-4xl`     | `3.25rem`   | 700    | 1.05        | `-0.035em`     | display      | Hero headline (tablet)         |
| `--text-3xl`     | `2.25rem`   | 700    | 1.1         | `-0.025em`     | display      | Section headings               |
| `--text-2xl`     | `1.75rem`   | 600    | 1.2         | `-0.02em`      | display      | Sub-section headings           |
| `--text-xl`      | `1.375rem`  | 600    | 1.3         | `-0.015em`     | display      | Card headings                  |
| `--text-lg`      | `1.125rem`  | 400    | 1.65        | `-0.005em`     | body         | Lead paragraphs                |
| `--text-base`    | `1rem`      | 400    | 1.6         | `0`            | body         | Body text                      |
| `--text-sm`      | `0.875rem`  | 400    | 1.5         | `0`            | body         | Secondary text, descriptions   |
| `--text-xs`      | `0.75rem`   | 500    | 1.4         | `0.06em`       | mono         | Eyebrow labels, badges, meta   |

### Heading Rules

- **Hero h1:** `--font-display`, `clamp(2.5rem, 6vw + 0.5rem, 4.5rem)`, weight 700, `letter-spacing: -0.04em`, `line-height: 1.0`. Use `--gradient-text-hero` with `background-clip: text`. The tight line-height and aggressive negative tracking are what make it feel editorial rather than default.

- **Section h2:** `--font-display`, `clamp(1.75rem, 3vw + 0.5rem, 2.25rem)`, weight 700, `letter-spacing: -0.025em`. Color: `--color-text`. Always left-aligned (never centered — this is a key anti-AI move).

- **Sub-headings h3:** `--font-display`, `--text-2xl`, weight 600, color `--color-text`.

- **Card titles h4:** `--font-display`, `--text-xl`, weight 600, color `--color-text`.

- **Eyebrow text:** `--font-mono`, `--text-xs`, weight 500, uppercase, color `--color-accent-primary`, `letter-spacing: 0.06em`. NOT `0.12em` — the current value is too spread out and feels like a template. `0.06em` is tighter and more confident.

### Body Text Rules

- Body text: `--font-body`, `--text-base`, weight 400, color `--color-text-secondary`, `line-height: 1.6`.
- Lead paragraphs: `--font-body`, `--text-lg`, weight 400, color `--color-text-secondary`, `max-width: 580px` (not 640px — slightly narrower forces better line lengths).
- Code inline: `--font-mono`, `font-size: 0.85em`, weight 500.

---

## 2. Color Palette

### The Problem with the Current Palette

The current `#6C63FF` purple accent is the most common "AI product" purple on the internet. It's the exact shade used by dozens of AI tools. We need to shift the palette to feel owned rather than generated.

### New Palette Direction: "Midnight Indigo"

Inspired by Linear's recent move toward restraint and Warp's warmth. The accent shifts from generic purple to a deeper, bluer indigo with a warm amber secondary. The backgrounds gain slight blue undertones rather than pure neutral.

### Backgrounds (Dark Theme)

| Token                | Hex         | Change from current | Usage                              |
| -------------------- | ----------- | ------------------- | ---------------------------------- |
| `--color-bg-deep`    | `#030507`   | Darker, blue-tinted | Page root / absolute deepest       |
| `--color-bg`         | `#08090E`   | Slightly bluer      | Primary page background            |
| `--color-bg-raised`  | `#0E1018`   | —                   | Slightly raised surfaces (nav)     |
| `--color-bg-overlay` | `#12141D`   | —                   | Modals, dropdown backgrounds       |

### Surfaces / Cards

| Token                   | Hex                          | Usage                              |
| ----------------------- | ---------------------------- | ---------------------------------- |
| `--color-surface-1`     | `#131620`                    | Primary card / panel background    |
| `--color-surface-2`     | `#181B26`                    | Nested card / secondary surface    |
| `--color-surface-3`     | `#1D2130`                    | Hover state for cards              |
| `--color-surface-glass` | `rgba(255, 255, 255, 0.025)` | Frosted glass panels               |

### Accent Colors

| Token                     | Hex / Value                    | Usage                                      |
| ------------------------- | ------------------------------ | ------------------------------------------ |
| `--color-accent-primary`  | `#5B6CF0`                      | Primary — buttons, links, focus rings      |
| `--color-accent-hover`    | `#7280FF`                      | Hover state for accent elements            |
| `--color-accent-muted`    | `rgba(91, 108, 240, 0.12)`    | Accent tint backgrounds                    |
| `--color-accent-warm`     | `#E8A44A`                      | Warm secondary — highlights, featured tags |
| `--color-accent-warm-muted` | `rgba(232, 164, 74, 0.10)`  | Warm tint backgrounds                      |
| `--color-accent-teal`     | `#38BFA7`                      | Tertiary — success adjacent, code accents  |
| `--color-accent-teal-muted` | `rgba(56, 191, 167, 0.10)`  | Teal tint backgrounds                      |

**Why `#5B6CF0` instead of `#6C63FF`:** It's bluer and less saturated — reads as "confident indigo" rather than "AI purple." The shift from red-purple to blue-purple is subtle but changes the entire mood. Linear went this direction in their 2025 refresh.

**Why `#E8A44A` warm accent:** Amber/gold against dark blue-black creates a distinctive pairing. Warp uses this tonal family. It feels premium and intentional.

### Text

| Token                    | Hex                          | Usage                             |
| ------------------------ | ---------------------------- | --------------------------------- |
| `--color-text`           | `#E8E9ED`                    | Primary headings                  |
| `--color-text-secondary` | `#9DA1B3`                    | Body text, descriptions           |
| `--color-text-muted`     | `#5A5F73`                    | Captions, placeholders, disabled  |
| `--color-text-link`      | `#5B6CF0`                    | Inline links (matches accent)     |
| `--color-text-on-accent` | `#FFFFFF`                    | Text on accent backgrounds        |

**Note:** `--color-text-secondary` is cooler and slightly more muted than the current `#B0B3C0`. This creates more contrast hierarchy against the blue-tinted backgrounds.

### Borders & Separators

| Token                 | Hex                          | Usage                    |
| --------------------- | ---------------------------- | ------------------------ |
| `--color-border`      | `rgba(255, 255, 255, 0.06)`  | Default subtle border (softer than current 0.08) |
| `--color-border-hover`| `rgba(255, 255, 255, 0.12)`  | Hovered border           |
| `--color-border-focus`| `rgba(91, 108, 240, 0.5)`    | Focus ring border        |
| `--color-divider`     | `rgba(255, 255, 255, 0.04)`  | Horizontal separators (softer)   |

### Status Colors

| Token                   | Hex                              | Usage              |
| ----------------------- | -------------------------------- | ------------------ |
| `--color-success`       | `#38BFA7`                        | Success states     |
| `--color-success-muted` | `rgba(56, 191, 167, 0.10)`      | Success bg         |
| `--color-warning`       | `#E8A44A`                        | Warning states     |
| `--color-warning-muted` | `rgba(232, 164, 74, 0.10)`      | Warning bg         |
| `--color-error`         | `#E85A5A`                        | Error states       |
| `--color-error-muted`   | `rgba(232, 90, 90, 0.10)`       | Error bg           |

### Gradients (Revised)

```css
/* Hero text gradient — cooler, more editorial */
--gradient-text-hero:
  linear-gradient(
    135deg,
    #E8E9ED 0%,
    #7280FF 40%,
    #38BFA7 80%,
    #E8A44A 100%
  );

/* Hero background glow — asymmetric, off-center */
--gradient-hero-glow:
  radial-gradient(ellipse 70% 50% at 25% 15%, rgba(91, 108, 240, 0.10), transparent),
  radial-gradient(ellipse 40% 60% at 75% 8%, rgba(56, 191, 167, 0.06), transparent),
  radial-gradient(ellipse 50% 40% at 60% 85%, rgba(232, 164, 74, 0.04), transparent);

/* Section divider gradient — used between some sections */
--gradient-section-divider:
  linear-gradient(90deg, transparent 0%, rgba(91, 108, 240, 0.15) 30%, rgba(56, 191, 167, 0.08) 70%, transparent 100%);

/* CTA background — subtle, warm shift */
--gradient-cta-bg:
  linear-gradient(160deg, rgba(91, 108, 240, 0.06) 0%, rgba(232, 164, 74, 0.04) 100%);

/* Button primary — single color, no gradient (flatter is modern) */
--gradient-button-primary: #5B6CF0;

/* Card top shimmer on hover */
--gradient-card-shimmer:
  linear-gradient(90deg, transparent 0%, rgba(91, 108, 240, 0.25) 40%, rgba(56, 191, 167, 0.15) 60%, transparent 100%);

/* Background mesh for select sections */
--gradient-mesh:
  radial-gradient(circle at 10% 20%, rgba(91, 108, 240, 0.06), transparent 50%),
  radial-gradient(circle at 80% 10%, rgba(56, 191, 167, 0.04), transparent 40%),
  radial-gradient(circle at 55% 85%, rgba(232, 164, 74, 0.03), transparent 45%);

/* Noise overlay */
--gradient-noise: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E");
```

### Syntax Highlighting (Terminal)

| Token      | Color     | Note                             |
| ---------- | --------- | -------------------------------- |
| Command    | `#E8E9ED` | White — primary text             |
| Comment    | `#5A5F73` | Muted — same as text-muted       |
| String     | `#A8D8A0` | Soft green (less saturated than current) |
| Success    | `#38BFA7` | Teal accent                      |
| Warning    | `#E8A44A` | Warm accent                      |
| Error      | `#E85A5A` | Red accent                       |
| Active     | `#5B6CF0` | Primary accent                   |
| Keyword    | `#B8A0E8` | Soft lavender                    |
| Function   | `#7BA0E8` | Soft blue                        |
| Number     | `#E8A07B` | Warm peach                       |
| Operator   | `#7BC8E8` | Cyan-blue                        |

---

## 3. Layout System

### The Problem with the Current Layout

Every section follows the same centered pattern: centered eyebrow → centered title → centered description → uniform grid. This rigid repetition is the #1 tell of AI-generated design. We need **varied rhythms** — some sections left-aligned, some with asymmetric splits, some with bento grids.

### Layout Principles

1. **Left-align section headings** (not centered). The eye naturally starts at the left. Centered headings feel like a PowerPoint slide.
2. **Vary section rhythms.** Not every section should be `padding: 96px`. Alternate between tight and generous spacing.
3. **Use asymmetric grids.** Feature sections should mix column sizes (2/3 + 1/3, or bento arrangements).
4. **Break the container** on 1-2 sections. The CTA and hero should extend to full viewport width.
5. **Offset elements.** Cards, images, and decorative elements should occasionally break alignment for a hand-crafted feel.

### Content Widths

| Token                | Value    | Usage                              |
| -------------------- | -------- | ---------------------------------- |
| `--content-max-width`| `1120px` | Standard content (slightly tighter than 1200px) |
| `--content-narrow`   | `720px`  | Text-heavy sections (tighter than current 800px) |
| `--content-wide`     | `1320px` | Bento grids, full-width features   |

### Section Padding Rhythm

Not all sections should have the same vertical padding. This creates a pacing system:

| Section         | Top Padding | Bottom Padding | Note                                    |
| --------------- | ----------- | -------------- | --------------------------------------- |
| Hero            | `calc(var(--nav-height) + 80px)` | `64px` | Tighter bottom — flows into Pillars |
| Pillars         | `80px`      | `96px`         | Standard generous                       |
| Coordination    | `48px`      | `80px`         | Tighter top — feels connected to Pillars |
| Tasks           | `96px`      | `80px`         | Standard                                |
| Teams           | `48px`      | `96px`         | Tighter top — paired with Tasks         |
| Terminal        | `96px`      | `64px`         | Standard top, tight bottom              |
| Getting Started | `80px`      | `80px`         | Even                                    |
| CTA             | `96px`      | `96px`         | Generous — breathing room               |
| Footer          | `64px top, 32px bottom` | — | Compact                              |

### Section Heading Alignment

| Section       | Heading Alignment | Max Width  | Note                         |
| ------------- | ----------------- | ---------- | ---------------------------- |
| Hero          | Center            | `720px`    | Exception: hero stays centered |
| Pillars       | **Left**          | `560px`    | Left-aligned, narrower       |
| Coordination  | **Left**          | `560px`    | Left-aligned                 |
| Tasks         | Center            | `640px`    | Center — this section has centered tree visual |
| Teams         | **Left**          | `560px`    | Left-aligned                 |
| Terminal      | Center            | `640px`    | Center — terminal mockup is centered |
| Getting Started | Center          | `640px`    | Center — step cards are centered |
| CTA           | Center            | `640px`    | Center — call to action      |

### Bento Grid Layout (Pillars Section)

Replace the uniform 4-column grid with an asymmetric bento layout:

```
┌─────────────────────────────────┬──────────────────┐
│                                 │                  │
│     Desktop App (2/3 width)     │   Server & API   │
│     Larger card, more           │   (1/3 width)    │
│     prominent media area        │                  │
│                                 │                  │
├──────────────────┬──────────────┴──────────────────┤
│                  │                                 │
│      CLI         │    Coordination (2/3 width)     │
│   (1/3 width)    │    Larger card with             │
│                  │    orchestration diagram         │
│                  │                                 │
└──────────────────┴─────────────────────────────────┘
```

CSS grid spec:
```css
.pillars-bento {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: auto auto;
  gap: 16px;
}

.pillars-bento > :nth-child(1) { grid-column: 1; grid-row: 1; }  /* Desktop App — tall */
.pillars-bento > :nth-child(2) { grid-column: 2; grid-row: 1; }  /* Server */
.pillars-bento > :nth-child(3) { grid-column: 1; grid-row: 2; }  /* CLI */
.pillars-bento > :nth-child(4) { grid-column: 2; grid-row: 2; }  /* Coordination — wide */

@media (max-width: 768px) {
  .pillars-bento {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
  .pillars-bento > * {
    grid-column: 1 !important;
    grid-row: auto !important;
  }
}
```

### Grid Gap

Use `16px` for bento grids (tighter = more editorial) and `20px` for feature grids. The current `24px` feels loose.

### Breakpoints (unchanged)

| Name      | Value    |
| --------- | -------- |
| `sm`      | `640px`  |
| `md`      | `768px`  |
| `lg`      | `1024px` |
| `xl`      | `1280px` |

---

## 4. Animations & Motion

### Core Principles

- **No bouncy springs.** The current `--ease-spring` overshoot feels playful in the wrong way for a developer tool. Replace with a damped spring or remove.
- **Slower is better.** Scroll reveals at `500ms` feel like a template. Use `700ms` for section reveals and `400ms` for card reveals.
- **Stagger with wider gaps.** Current `80ms` stagger is too fast — elements appear in a blur. Use `120ms` for cards, `150ms` for list items.

### Timing Functions (Revised)

```css
--ease-out:     cubic-bezier(0.16, 1, 0.3, 1);       /* Keep — this is good */
--ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);       /* Keep */
--ease-smooth:  cubic-bezier(0.25, 0.1, 0.25, 1);     /* Keep */
--ease-expo:    cubic-bezier(0.19, 1, 0.22, 1);       /* NEW — strong deceleration for dramatic reveals */
--ease-circ:    cubic-bezier(0.075, 0.82, 0.165, 1);   /* NEW — smooth for opacity */

/* REMOVE --ease-spring — not appropriate for this aesthetic */
```

### Duration Scale (Revised)

```css
--duration-instant: 80ms;    /* Hover color changes */
--duration-fast:    150ms;   /* Button transforms */
--duration-normal:  250ms;   /* Card hover, nav transitions */
--duration-slow:    400ms;   /* Card scroll reveals */
--duration-slower:  700ms;   /* Section reveals, hero entrance */
--duration-glacial: 1200ms;  /* Hero background animation cycle fade */
```

### Scroll Reveal System (Revised)

The current reveals are fine structurally but need tuning:

```css
/* Base: Fade up */
.reveal {
  opacity: 0;
  transform: translateY(32px);  /* Was 24px — more travel = more drama */
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity var(--duration-slower) var(--ease-expo),
    transform var(--duration-slower) var(--ease-out);
  transition-delay: calc(var(--stagger-index, 0) * 120ms);  /* Was 80ms */
}

/* Slide from left — for text blocks in split layouts */
.reveal-left {
  opacity: 0;
  transform: translateX(-40px);  /* Was -32px */
}

.reveal-left.visible {
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity var(--duration-slower) var(--ease-expo),
    transform var(--duration-slower) var(--ease-out);
}

/* Scale up — for hero media, terminal mockups */
.reveal-scale {
  opacity: 0;
  transform: scale(0.92);  /* Was 0.95 — more dramatic */
}

.reveal-scale.visible {
  opacity: 1;
  transform: scale(1);
  transition:
    opacity var(--duration-slower) var(--ease-expo),
    transform var(--duration-slower) var(--ease-out);
}

/* NEW: Reveal from right — for zigzag layouts */
.reveal-right {
  opacity: 0;
  transform: translateX(40px);
}

.reveal-right.visible {
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity var(--duration-slower) var(--ease-expo),
    transform var(--duration-slower) var(--ease-out);
}
```

### IntersectionObserver Config (Revised)

```js
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: "0px 0px -80px 0px" }
  // Changed: lower threshold (0.1 vs 0.15) — trigger earlier
  // Changed: more negative rootMargin (-80px vs -60px) — trigger when element is more visible
);
```

### Hero Entrance Animation (Revised)

Slower, more deliberate. Each element breathes before the next appears.

```css
.hero-entrance {
  opacity: 0;
  transform: translateY(24px);
  animation: hero-fade-up 700ms var(--ease-expo) forwards;
  animation-delay: var(--hero-delay, 0ms);
}

@keyframes hero-fade-up {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Stagger delays: badges `0ms` → headline `200ms` → subheadline `400ms` → CTAs `600ms` → media `900ms`.

### Hero Background Animation (Revised)

```css
@keyframes glow-drift {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 0.8;
  }
  25% {
    transform: translate(2%, -3%) scale(1.02);
    opacity: 1;
  }
  50% {
    transform: translate(-1%, 2%) scale(0.98);
    opacity: 0.85;
  }
  75% {
    transform: translate(3%, 1%) scale(1.01);
    opacity: 0.95;
  }
  100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.8;
  }
}

.hero-glow {
  position: absolute;
  inset: -10%;  /* Extend beyond container to avoid edge clipping */
  background: var(--gradient-hero-glow);
  animation: glow-drift 20s ease-in-out infinite;  /* Slower — 20s vs 15s */
  pointer-events: none;
  z-index: 0;
  filter: blur(60px);  /* NEW — soft blur for organic feel */
}
```

### Card Hover Animation

```css
.card {
  transition:
    transform var(--duration-normal) var(--ease-out),
    box-shadow var(--duration-normal) var(--ease-out),
    border-color var(--duration-fast) var(--ease-smooth);
}

.card:hover {
  transform: translateY(-2px);  /* Was -4px — subtler is better */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35),
              0 0 0 1px rgba(91, 108, 240, 0.08);
  border-color: var(--color-border-hover);
}
```

### NEW: Terminal Typing Animation

For the terminal mockup in the Terminal section — lines reveal progressively on first viewport entry:

```css
.terminal-line {
  opacity: 0;
  transform: translateX(-4px);
}

.terminal-line.typed {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 150ms var(--ease-smooth),
              transform 150ms var(--ease-out);
}
```

JS implementation:
```js
// Trigger when terminal enters viewport
function typeTerminalLines(container: HTMLElement) {
  const lines = container.querySelectorAll('.terminal-line');
  lines.forEach((line, i) => {
    setTimeout(() => {
      line.classList.add('typed');
    }, i * 120);  // 120ms between each line
  });
}
```

### NEW: Section Divider Gradient Animation

Between select sections (after Pillars, after Terminal), add a subtle animated gradient line:

```css
.section-divider {
  height: 1px;
  background: var(--gradient-section-divider);
  background-size: 200% 100%;
  animation: shimmer-slide 8s ease-in-out infinite;
  margin: 0 auto;
  max-width: var(--content-max-width);
}

@keyframes shimmer-slide {
  0%, 100% { background-position: 0% 0%; }
  50% { background-position: 100% 0%; }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .reveal, .reveal-left, .reveal-scale, .reveal-right,
  .hero-entrance, .terminal-line {
    opacity: 1;
    transform: none;
  }
}
```

---

## 5. Textures & Effects

### Noise Overlay (Revised)

Reduce frequency for coarser, more visible grain. The current `baseFrequency='0.75'` produces too-fine grain that disappears at most viewing distances.

```css
.page::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.18'/%3E%3C/svg%3E");
  opacity: 0.035;
  pointer-events: none;
  mix-blend-mode: overlay;
  z-index: 9999;
}
```

Changes: `baseFrequency` from `0.75` to `0.55`, `numOctaves` from `4` to `3`, SVG size from `200` to `300`, opacity from `0.04` to `0.035`.

### Dot Grid Background (Sections)

For specific sections (Coordination, Teams) — a subtle dot grid adds texture without noise:

```css
.dot-grid-bg {
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

Apply as a secondary background on the section element, behind content.

### Gradient Mesh Background (Hero)

The hero uses multiple layered radial gradients. Add a new mesh technique with subtle movement:

```css
.hero-mesh {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 10%, rgba(91, 108, 240, 0.08), transparent),
    radial-gradient(ellipse 50% 70% at 78% 5%, rgba(56, 191, 167, 0.05), transparent),
    radial-gradient(ellipse 60% 40% at 55% 90%, rgba(232, 164, 74, 0.03), transparent);
  filter: blur(80px);
  pointer-events: none;
}
```

### Glow/Bloom on Interactive Elements

Buttons and accent elements get a glow on hover:

```css
/* Primary button glow */
.btn-primary {
  box-shadow: 0 0 0 rgba(91, 108, 240, 0);
  transition: box-shadow var(--duration-normal) var(--ease-out);
}

.btn-primary:hover {
  box-shadow: 0 0 24px rgba(91, 108, 240, 0.3),
              0 4px 16px rgba(0, 0, 0, 0.3);
}

/* Card glow on hover */
.card:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35),
              0 0 0 1px rgba(91, 108, 240, 0.08);
}

/* Terminal glow */
.code-terminal {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4),
              0 0 80px rgba(91, 108, 240, 0.04);
}
```

### Border Styling

Borders are key for dark themes. Use thin borders with very low opacity for a "laser-etched" feel:

```css
/* Standard card border */
border: 1px solid rgba(255, 255, 255, 0.05);

/* Hover border — slightly visible */
border: 1px solid rgba(255, 255, 255, 0.10);

/* Accent border for featured cards */
border: 1px solid rgba(91, 108, 240, 0.15);

/* Glass border with gradient */
border-image: linear-gradient(
  180deg,
  rgba(255, 255, 255, 0.08) 0%,
  rgba(255, 255, 255, 0.02) 100%
) 1;
```

### Top-Light Effect on Cards

Cards should feel like they're being lit from above — a subtle gradient inside:

```css
.card::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%);
  pointer-events: none;
  border-radius: inherit;
}
```

---

## 6. Component-by-Component Specs

### 6.1 Navigation

**Current issues:** Straightforward but generic. Needs more personality.

**Changes:**
- Logo: Replace `◆` with a custom SVG mark, or use `M` lettermark in `--font-display` weight 700 with accent color background (`16px × 16px` rounded square with `4px` radius, white `M` inside).
- Nav background: Make fully transparent over hero (currently `rgba(10, 12, 16, 0.8)` by default). Only add background after scrolling past hero section.
- Active link indicator: Instead of `background: rgba(255, 255, 255, 0.08)`, use a bottom `2px` accent-colored bar, positioned with `::after` pseudo-element.
- CTA button in nav: Make it smaller (`padding: 6px 16px`), use ghost style by default, switch to filled on scroll.

```
┌──────────────────────────────────────────────────────────────────┐
│ [M] Maestro         Overview  Pillars  Coordination  ...  [Get Started] │
│  ↑ logomark          ↑ links — left-flush after logo            ↑ ghost  │
│  16×16 accent bg     text-sm, weight 500, text-muted           → filled  │
│                      active: text color + 2px bottom bar        on scroll │
└──────────────────────────────────────────────────────────────────┘
  height: 56px (reduced from 64px — tighter is more modern)
  background: transparent (over hero) → rgba(8, 9, 14, 0.85) + blur(16px) (scrolled)
```

**Typography:**
- Logo: `--font-display`, `1.125rem`, weight 700
- Links: `--font-body`, `0.8125rem` (13px), weight 500
- CTA: `--font-body`, `0.8125rem`, weight 600

**CSS:**
```css
.nav {
  height: 56px;
  padding: 0 max(24px, 4vw);
  /* everything else same but with updated colors */
}

.nav-link.active::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 2px;
  background: var(--color-accent-primary);
  border-radius: 1px;
}
```

---

### 6.2 HeroSection

**Current issues:** Centered layout is fine for hero but execution is generic. Badges look like pills from a template. Gradient text is the AI-product default move.

**Changes:**

```
                                                             ┌──────────┐
                                                             │ animated │
  Open Source · Multi-Agent · Local-First  ← tiny,           │ gradient │
                                             no pill bg      │ orbs     │
  Orchestrate AI agents.                 ← Line 1: white     │ (hero-   │
  Ship faster.                           ← Line 2: gradient  │  glow)   │
                                                             │          │
  Maestro coordinates multiple Claude    ← narrower: 520px   └──────────┘
  sessions across your projects...         max-width

  [Get Started]  View on GitHub →        ← primary + text link (not button)

          ┌────────────────────────┐
          │   [MP-01] hero demo    │     ← appears with reveal-scale
          │   800 × 450            │       slightly offset: margin-left: 5%
          └────────────────────────┘
```

**Key design changes:**
1. **Badges:** Remove pill backgrounds. Just plain text with `·` separators. `font-mono`, `text-xs`, `color: --color-text-muted`, `letter-spacing: 0.06em`, `text-transform: uppercase`.
2. **Headline:** Split into two lines. Line 1 "Orchestrate AI agents." in solid `--color-text`. Line 2 "Ship faster." with gradient text. This creates a visual anchor and reads better than full-gradient text.
3. **Secondary CTA:** Replace button with text link: "View on GitHub →" in `--color-text-secondary` with hover to `--color-text`. Arrow is an actual `→` character. No border, no background.
4. **Media placeholder:** Offset `margin-left: 3%` to break perfect centering. Add a subtle `box-shadow: 0 20px 60px rgba(0,0,0,0.5)` and `border-radius: 12px`.
5. **Subheadline:** `max-width: 520px` (narrower for better line lengths).

**Typography:**
- Badges: `--font-mono`, `0.6875rem` (11px), weight 500, uppercase, `letter-spacing: 0.06em`, `color: --color-text-muted`
- Headline: `--font-display`, `clamp(2.5rem, 6vw + 0.5rem, 4.5rem)`, weight 700
- Subheadline: `--font-body`, `1.0625rem` (17px), weight 400, `line-height: 1.7`, `color: --color-text-secondary`
- Primary CTA: `--font-body`, `0.875rem`, weight 600
- Secondary CTA: `--font-body`, `0.875rem`, weight 500, `color: --color-text-secondary`

**Animation:**
- Badges: `delay: 0ms`, `duration: 700ms`
- Headline: `delay: 200ms`, `duration: 700ms`
- Subheadline: `delay: 400ms`, `duration: 700ms`
- CTAs: `delay: 600ms`, `duration: 700ms`
- Media: `delay: 900ms`, `duration: 700ms`, use `reveal-scale`

---

### 6.3 PillarsSection

**Current issues:** Uniform 4-column grid. Every card is identical size. Feels like a SaaS template features section.

**Changes:**

Use the bento grid layout from Section 3 above. Key changes:

1. **Section heading:** Left-aligned, not centered. Eyebrow `PLATFORM` in `--color-accent-primary`.
2. **Bento grid:** 2×2 with unequal column sizes (`2fr 1fr` top row, reversed bottom row).
3. **Card differentiation:** The two "large" cards (Desktop App, Coordination) get more visual content — the media placeholder is more prominent. The two "small" cards (Server, CLI) are text-heavier with smaller/no media.
4. **Card internal layout:** Stack vertically: icon → title → description → media (for large cards). No horizontal splits inside cards.
5. **Icon treatment:** Replace the generic 40×40 icon boxes. Instead, use the SVG icons inline at `24px`, unboxed, colored `--color-accent-primary`. Simpler, less template-y.
6. **Card padding:** `24px` for small cards, `32px` for large cards.
7. **Gap:** `16px` (tighter than current `24px`).

**ASCII mockup:**
```
  PLATFORM                                  ← left-aligned eyebrow
  Built for how you                         ← left-aligned, max-width: 560px
  actually work
  Maestro is a desktop app, a CLI...        ← description

  ┌──────────────────────────────┬──────────────┐
  │ 🖥 Desktop App               │ 🗄 Server     │
  │                              │ & API        │
  │ A full workspace with        │              │
  │ terminals, task boards...    │ The coord-   │
  │                              │ ination      │
  │ ┌──────────────────────┐     │ backbone...  │
  │ │  [MP-02] screenshot  │     │              │
  │ └──────────────────────┘     │              │
  └──────────────────────────────┴──────────────┘
  ┌──────────────┬──────────────────────────────┐
  │ > CLI        │ ⬡ Coordination               │
  │              │                              │
  │ Full control │ The layer that makes         │
  │ from the     │ multi-agent work...          │
  │ terminal...  │                              │
  │              │ ┌──────────────────────┐     │
  │              │ │  [MP-05] diagram     │     │
  │              │ └──────────────────────┘     │
  └──────────────┴──────────────────────────────┘
  gap: 16px
```

**Typography per card:**
- Icon: SVG `24px`, `color: --color-accent-primary`
- Title: `--font-display`, `1.25rem`, weight 600, `margin-bottom: 8px`
- Description: `--font-body`, `0.875rem`, `color: --color-text-secondary`, `line-height: 1.6`

**Animation:** Stagger the 4 cards: `0ms`, `120ms`, `120ms`, `240ms` (the two in each row appear close together).

---

### 6.4 CoordinationSection

**Current issues:** Two identical panels with a simple zigzag. The zigzag is a standard layout. Needs more visual interest.

**Changes:**

1. **Section heading:** Left-aligned.
2. **Panel 1 layout:** Keep `55% / 45%` but the visual (right side) should be a live-looking CSS diagram, not a static placeholder. Build a coordinator/worker tree with animated connection lines.
3. **Panel 2 layout:** Keep `45% / 55%` zigzag. The visual (left side) should be a terminal mockup showing `maestro status` output.
4. **Panel container:** Remove the card-like container (`--color-surface-1` + border). Instead, let the panels float without a wrapper — this avoids the "card inside a card" problem. Use the dot-grid background on this section instead.
5. **Panel spacing:** `gap: 40px` between columns, `gap: 64px` between the two panels.
6. **Bullet point styling:** Replace generic `•` with numbered accent circles or chevrons. Use `--color-accent-primary` for the marker, `--color-text-secondary` for text.

**ASCII mockup:**
```
  COORDINATION                              ← left-aligned eyebrow
  Multi-agent orchestration,
  not multi-agent chaos
  Running multiple AI agents is easy...     ← dot-grid bg behind this section

  ┌─ Two roles, one workflow ──────────────────────────────────────────┐
  │                                                                    │
  │  → Coordinators plan work, create...        ┌─── Coordinator ───┐ │
  │  → Workers execute tasks directly...        │    spawns workers  │ │
  │  → Coordinators spawn workers with...       │   ┌────┐ ┌────┐   │ │
  │  → Workers report progress in...            │   │ W1 │ │ W2 │   │ │
  │  → Planning stays centralized...            │   └────┘ └────┘   │ │
  │                                             └───────────────────┘ │
  └────────────────────────────────────────────────────────────────────┘
                                                     55% ↕ 45%

        gap: 64px between panels

  ┌─ Full visibility, zero interruptions ──────────────────────────────┐
  │                                                                    │
  │  ┌──────────────────────┐      → Real-time progress tracking...   │
  │  │ $ maestro status     │      → `blocked` and `needs-input`...   │
  │  │   Sessions: 3        │      → Attached docs and artifacts...   │
  │  │   Tasks: 5/12        │      → Session prompt for live...       │
  │  │   Blocked: 1         │      → DAG orchestration and batch...   │
  │  └──────────────────────┘                                         │
  │        45% ↕ 55%                                                  │
  └────────────────────────────────────────────────────────────────────┘
```

**Animation:**
- Panel 1 text: `reveal-left`
- Panel 1 visual: `reveal-right` (new class), `delay: 200ms`
- Panel 2 visual: `reveal-left`, `delay: 0ms`
- Panel 2 text: `reveal-right`, `delay: 200ms`

---

### 6.5 TasksSection

**Current issues:** Task tree is nice but the 5-column feature grid below is too wide and small at desktop. The feature cards are too uniform.

**Changes:**

1. **Section heading:** Centered (exception — this section has a centered tree visual).
2. **Task tree:** Keep but add subtle animation — status icons pulse softly (`in-progress` items).
3. **Feature grid:** Change from `5-col` to a `2-3` bento pattern:

```
  ┌──────────────────────────────────────────────┐
  │                                              │
  │  ┌─ Hierarchical  ─┬─ Many-to-many ─┐       │
  │  │  task trees      │ linking         │       │
  │  │                  │                 │       │
  │  │  Parent/child    │ Multiple        │       │
  │  │  relationships   │ sessions can    │       │
  │  │  for decomp...   │ work the same...│       │
  │  └──────────────────┴─────────────────┘       │
  │  ┌─ Lifecycle  ─┬─ Session sync ─┬─ Project ─┐│
  │  │  tracking     │                │ isolation ││
  │  │               │ Task-session   │           ││
  │  │  todo → ...   │ links update   │ Each proj ││
  │  │               │ bidirection... │ is self...││
  │  └──────────────┴────────────────┴───────────┘│
  │                                              │
  └──────────────────────────────────────────────┘
  Row 1: repeat(2, 1fr)  — larger cards
  Row 2: repeat(3, 1fr)  — smaller cards
```

CSS:
```css
.tasks-features {
  display: grid;
  gap: 16px;
}

.tasks-features-row-1 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.tasks-features-row-2 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .tasks-features-row-1,
  .tasks-features-row-2 {
    grid-template-columns: 1fr;
  }
}
```

4. **Feature card styling:** `padding: 20px`, `background: --color-surface-1`, `border: 1px solid --color-border`, `border-radius: 12px`. Title in `--font-display`, `0.9375rem` (15px), weight 600. Description in `--font-body`, `0.8125rem` (13px), `color: --color-text-secondary`.

---

### 6.6 TeamsSection

**Current issues:** Standard 45/55 split with list items. Functional but predictable.

**Changes:**

1. **Section heading:** Left-aligned.
2. **Layout:** Keep the split but flip the proportions to `50/50` and add a slight vertical offset — the visual column starts `32px` lower than the text column. This "offset grid" breaks rigidity.
3. **Team hierarchy card:** Add subtle animation — when the section enters viewport, the members "connect" with animated lines (draw-in effect over `1s`).
4. **Feature list:** Replace the plain list with numbered items. Each item gets a number in `--font-display` weight 700, `--color-accent-primary`, `1.5rem` size, aligned left of the text block.

**ASCII mockup:**
```
  TEAMS                                  ← left-aligned
  Reusable agents.
  Predictable results.
  Define agent identities once...

  ┌────────────────────────┐
  │                        │     1  Preconfigured roles
  │  Team: auth-feature    │        Ship with built-in defaults...
  │                        │
  │  🎯 Coordinator        │     2  Custom specialists
  │    ├── ⚡ API Worker    │        Create agents tailored...
  │    ├── 🧪 Test Engineer│
  │    └── 🎨 Frontend Dev │     3  Persistent memory
  │                        │        Team members accumulate...
  │                        │
  └────────────────────────┘     4  Capability boundaries
       ↑ starts 32px lower          Fine-grained permissions...
         than right column
                                 5  Team topology
                                    Organize members under...
```

**Typography for numbered list:**
- Number: `--font-display`, `1.5rem`, weight 700, `color: --color-accent-primary`, `opacity: 0.6`
- Title: `--font-display`, `0.9375rem` (15px), weight 600, `color: --color-text`
- Description: `--font-body`, `0.8125rem` (13px), weight 400, `color: --color-text-secondary`, `line-height: 1.6`

---

### 6.7 TerminalSection

**Current issues:** Terminal mockup is good. Feature grid is another uniform 4-col grid. Callout banner is fine.

**Changes:**

1. **Section heading:** Centered.
2. **Terminal mockup:** Add the typing animation (see Section 4 above). Add a slight perspective tilt — `transform: perspective(1200px) rotateX(2deg)` — to make the terminal feel like it's sitting on a surface. On hover, straighten to `rotateX(0)`.
3. **Terminal chrome:** The three dots are fine. Add a subtle "traffic light" glow effect — each dot gets a tiny `box-shadow` in its color:
   ```css
   .terminal-dot-red    { box-shadow: 0 0 4px rgba(255, 95, 87, 0.4); }
   .terminal-dot-yellow { box-shadow: 0 0 4px rgba(254, 188, 46, 0.4); }
   .terminal-dot-green  { box-shadow: 0 0 4px rgba(40, 200, 64, 0.4); }
   ```
4. **Feature grid:** Change to `2×2` grid instead of `1×4`. Each card is slightly larger with more padding.
5. **Callout banner:** Add a subtle background pattern (dot-grid) and increase left border width to `3px`. Change from `text-align: center` to `text-align: left` for more editorial feel.

**ASCII mockup:**
```
  TERMINAL                               ← centered
  Real terminals. Full transparency.
  Every session runs in a real PTY-backed shell...

  ┌───────────────────────────────────────────────────┐
  │ ● ● ●  Terminal                                   │ ← perspective tilt
  │                                                   │
  │ # Create a parent task                            │ ← typing animation
  │ $ maestro task create --title "Build auth..."     │   lines appear one
  │ ✓ Task created: task_a1b2c3                       │   by one
  │                                                   │
  │ # Spawn workers for subtasks                      │
  │ $ maestro session spawn --task task_jwt --role...  │
  │ ✓ Session spawned: sess_x7y8z9 (JWT endpoint)    │
  │ ...                                               │
  └───────────────────────────────────────────────────┘
        max-width: 680px (slightly narrower)
        transform: perspective(1200px) rotateX(2deg)

  ┌──────────────────┬──────────────────┐
  │ Persistent       │ Session          │
  │ sessions         │ transcripts      │
  │                  │                  │
  │ Leave and come   │ Full I/O         │
  │ back without...  │ timeline...      │
  ├──────────────────┼──────────────────┤
  │ Human            │ Command          │
  │ checkpoints      │ permissions      │
  │                  │                  │
  │ needs-input      │ Capability-      │
  │ states pause...  │ based controls...│
  └──────────────────┴──────────────────┘
        2×2 grid, gap: 16px

  ┊ Agents get real shells. You get full logs.        ← left-aligned callout
  ┊ Everyone stays accountable.                        with dot-grid bg
```

---

### 6.8 GettingStartedSection

**Current issues:** Standard 3-column step cards. Functional but uninspired.

**Changes:**

1. **Section heading:** Centered.
2. **Step cards:** Keep the 3-column layout but differentiate the step numbers. Instead of circled unicode numbers, use large display numbers:
   - Number: `--font-display`, `3rem`, weight 700, `color: --color-accent-primary`, `opacity: 0.15`, positioned absolutely in the top-right corner of the card. This creates a large, watermarked number that adds editorial flair.
3. **Step card layout:** Title at top, code block in middle, description at bottom. The code block should use `--color-bg-deep` background (darkest).
4. **Workflow terminal:** Keep centered. Increase `max-width` to `680px`. Add the perspective tilt like the Terminal section.
5. **Visual connection:** Between step cards, add a thin dashed line connecting them at their vertical center — `border-top: 1px dashed rgba(91, 108, 240, 0.2)` — spanning the gap. This shows progression.

**ASCII mockup:**
```
  GET STARTED                            ← centered
  Up and running in three steps

  ┌──────────────── · · · · ──────────────── · · · · ────────────────┐
  │                                                                   │
  │  ┌─────────── 1 ─┐   ┌─────────── 2 ─┐   ┌─────────── 3 ─┐     │
  │  │           (bg) │   │           (bg) │   │           (bg) │     │
  │  │ Install        │   │ Start          │   │ CLI Setup      │     │
  │  │                │   │                │   │                │     │
  │  │ ┌────────────┐ │   │ ┌────────────┐ │   │ ┌────────────┐ │     │
  │  │ │ git clone..│ │   │ │ npm run    │ │   │ │ cd maestro-│ │     │
  │  │ │ cd agent-..│ │   │ │ dev:all    │ │   │ │ cli && npm │ │     │
  │  │ │ npm install│ │   │ │            │ │   │ │ run build..│ │     │
  │  │ └────────────┘ │   │ └────────────┘ │   │ └────────────┘ │     │
  │  │                │   │                │   │                │     │
  │  │ Clone and      │   │ Launches the   │   │ Now maestro is │     │
  │  │ install deps.  │   │ app + server.  │   │ available...   │     │
  │  └────────────────┘   └────────────────┘   └────────────────┘     │
  │       connected by dashed accent line                             │
  └───────────────────────────────────────────────────────────────────┘
  gap: 20px, padding per card: 28px
```

**Animation:** Stagger: `0ms`, `150ms`, `300ms` (wider gaps than current `120ms` — more deliberate).

---

### 6.9 CTASection

**Current issues:** Standard centered CTA. The gradient background is subtle. Needs more impact.

**Changes:**

1. **Break the container:** The CTA section should span full viewport width (already does via `borderTop/borderBottom`). Keep this.
2. **Background:** Replace the gradient with a more dramatic glow — a single large radial gradient centered behind the text:
   ```css
   background:
     radial-gradient(ellipse 60% 50% at 50% 40%, rgba(91, 108, 240, 0.08), transparent),
     var(--color-surface-1);
   ```
3. **Heading:** Use `--font-display` at `--text-3xl`, but add a subtle gradient to the word "orchestrating" — highlighting the key action word.
4. **Secondary CTA:** Text link style (like hero): "Star on GitHub →" without button border. `color: --color-text-secondary`, hover `--color-text`.
5. **Remove border-top/bottom.** Instead, use the `section-divider` gradient line above and below.

**Typography:**
- Heading: `--font-display`, `clamp(1.75rem, 3vw + 0.5rem, 2.25rem)`, weight 700, `color: --color-text`
- Description: `--font-body`, `1.0625rem` (17px), weight 400, `color: --color-text-secondary`

---

### 6.10 Footer

**Current issues:** Standard 4-column footer. Fine but could have more personality.

**Changes:**

1. **Reduce visual weight.** The footer should feel quiet — it's the end of the page.
2. **Logo area:** Keep `◆ Maestro` but make the diamond SVG colored `--color-accent-primary`. Add description: "Open-source multi-agent orchestration." in `text-xs`, `color: --color-text-muted`.
3. **Link groups:** Remove `text-transform: uppercase` on group titles. Use weight 600 + `text-sm` + `color: --color-text` instead.
4. **Link colors:** `--color-text-muted` default, `--color-text-secondary` on hover. Not `--color-text` — too bright for footer.
5. **Grid:** `1.5fr repeat(3, 1fr)` stays. Gap: `40px` (reduced from `48px`).
6. **Copyright:** Add build version or year dynamically. `font-mono`, `text-xs`, `color: --color-text-muted`.
7. **Subtle top border:** `1px solid --color-divider` as separator from CTA section.

---

### 6.11 Layout

**Current issues:** IntersectionObserver setup is good. No changes needed.

**Changes:**

1. **Nav height:** Update `--nav-height` from `64px` to `56px` throughout.
2. **Noise overlay:** Update to revised spec from Section 5.
3. **Skip link:** Keep as-is — good accessibility.

---

### 6.12 Section (Wrapper Component)

**Current issues:** All sections use the same wrapper. Need section-specific rhythm.

**Changes:**

1. **Accept `paddingTop` and `paddingBottom` as optional props** — allowing sections to override default padding for rhythm variation.
2. **Accept `fullWidth` prop** for CTA section (removes `max-width` container).
3. **Accept `background` prop** for sections that need dot-grid or mesh backgrounds.
4. **Section heading alignment:** Accept `align` prop (`'left' | 'center'`), defaulting to `'left'`.

```tsx
interface SectionProps {
  id: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center';
  paddingTop?: string;
  paddingBottom?: string;
  fullWidth?: boolean;
  background?: string;
}
```

When `align='left'`:
```css
.section-heading-left {
  max-width: 560px;
  text-align: left;
}
```

When `align='center'`:
```css
.section-heading-center {
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
  text-align: center;
}
```

---

### 6.13 MediaPlaceholder

**Current issues:** Generic dashed-border placeholder. Fine for development.

**Changes:**

1. **Style:** Keep dashed border but reduce opacity. Use a subtle pattern inside:
   ```css
   background:
     repeating-linear-gradient(
       45deg,
       transparent,
       transparent 8px,
       rgba(255, 255, 255, 0.01) 8px,
       rgba(255, 255, 255, 0.01) 16px
     ),
     var(--color-surface-2);
   ```
2. **Placeholder text:** Show dimensions alongside ID: `[MP-01] 800×450` in `font-mono`, `text-xs`.
3. **Border radius:** Match parent card's radius.

---

## 7. Anti-AI-Generated Checklist

This is the quality gate. Before the implementation is considered complete, verify each item:

### Layout & Composition
- [ ] **Hero headline is NOT centered on all axes.** The hero text block should be centered horizontally but the overall composition should have asymmetric elements (offset media placeholder, asymmetric glow positioning).
- [ ] **Section headings are left-aligned** on at least 3 of 7 content sections (Pillars, Coordination, Teams).
- [ ] **Bento grid on Pillars** — cards are NOT all the same size. Two larger, two smaller.
- [ ] **Section padding varies** — not every section has the same top/bottom spacing. At least 3 different padding combinations used.
- [ ] **At least one offset element** — the team hierarchy card starts 32px lower than its sibling column.
- [ ] **Feature grids are not uniform** — Tasks section uses 2-row + 3-row pattern, not a single 5-col grid.

### Typography
- [ ] **Two font families visible** — Space Grotesk for headings, Inter for body. They should be noticeably different.
- [ ] **Eyebrow letter-spacing is tight** — `0.06em`, not the template-default `0.12em`.
- [ ] **Hero headline uses aggressive negative tracking** — `-0.04em`. It should feel tight and confident.
- [ ] **At least one heading uses mixed styling** — e.g., hero with Line 1 solid + Line 2 gradient.
- [ ] **Body text max-width is narrow** — `520px` for hero, `560px` for section descriptions. Forces short line lengths = editorial feel.

### Color & Texture
- [ ] **Primary accent is `#5B6CF0`** (indigo), NOT `#6C63FF` (generic purple).
- [ ] **Backgrounds have blue undertone** — `#08090E` base, not neutral gray.
- [ ] **Grain/noise overlay is visible** at normal viewing distance (check on a dark monitor).
- [ ] **Dot-grid background** appears on at least 1 section (Coordination recommended).
- [ ] **Card borders are subtle** — `rgba(255, 255, 255, 0.05)`, NOT the more visible `0.08`.
- [ ] **Top-light effect on cards** — subtle gradient from top creating a "lit from above" feel.

### Animation & Motion
- [ ] **No bouncy easings.** All transitions use `ease-out`, `ease-expo`, or `ease-smooth`. No overshoot springs.
- [ ] **Stagger delays are generous** — `120ms` minimum between staggered items. Not a rapid-fire `80ms`.
- [ ] **Hero entrance is deliberate** — `200ms` gaps between elements, `700ms` duration per element.
- [ ] **Terminal typing animation works** — lines appear one by one on first viewport entry.
- [ ] **Section divider gradient** animates between at least 2 sections.

### Personality & Polish
- [ ] **Badges in hero have NO pill backgrounds** — just plain text with `·` separators.
- [ ] **Secondary CTAs are text links** ("View on GitHub →"), NOT bordered buttons.
- [ ] **Feature list in Teams uses numbered markers** (1, 2, 3...), not bullets.
- [ ] **Terminal has perspective tilt** — subtle `rotateX(2deg)` that straightens on hover.
- [ ] **Callout banner is left-aligned**, not centered.
- [ ] **Footer is quiet** — reduced visual weight, muted colors, no uppercase headings.
- [ ] **Copy tone is direct** — no "leverage", "empower", "seamless". Active verbs: "run", "track", "spawn".

### What to Avoid
- [ ] **No identical section layouts** — if two sections feel like copy/paste with different text, redesign one.
- [ ] **No uniform card grids** — every grid should have at least one element that breaks the pattern (size, span, or visual treatment).
- [ ] **No stock gradients** — every gradient uses the custom `#5B6CF0` / `#38BFA7` / `#E8A44A` palette.
- [ ] **No default button radius** — buttons use `8px` radius (not the rounded `16px` of the current spec). Sharper = more intentional.
- [ ] **No full-width centered text blocks** — text should always be constrained to a reasonable `max-width`.

---

## Appendix A: Complete CSS Custom Properties (Updated)

```css
:root {
  /* ── Backgrounds ── */
  --color-bg-deep: #030507;
  --color-bg: #08090E;
  --color-bg-raised: #0E1018;
  --color-bg-overlay: #12141D;

  /* ── Surfaces ── */
  --color-surface-1: #131620;
  --color-surface-2: #181B26;
  --color-surface-3: #1D2130;
  --color-surface-glass: rgba(255, 255, 255, 0.025);

  /* ── Accent ── */
  --color-accent-primary: #5B6CF0;
  --color-accent-hover: #7280FF;
  --color-accent-muted: rgba(91, 108, 240, 0.12);
  --color-accent-warm: #E8A44A;
  --color-accent-warm-muted: rgba(232, 164, 74, 0.10);
  --color-accent-teal: #38BFA7;
  --color-accent-teal-muted: rgba(56, 191, 167, 0.10);

  /* ── Text ── */
  --color-text: #E8E9ED;
  --color-text-secondary: #9DA1B3;
  --color-text-muted: #5A5F73;
  --color-text-link: #5B6CF0;
  --color-text-on-accent: #FFFFFF;

  /* ── Borders ── */
  --color-border: rgba(255, 255, 255, 0.05);
  --color-border-hover: rgba(255, 255, 255, 0.10);
  --color-border-focus: rgba(91, 108, 240, 0.5);
  --color-divider: rgba(255, 255, 255, 0.04);

  /* ── Status ── */
  --color-success: #38BFA7;
  --color-success-muted: rgba(56, 191, 167, 0.10);
  --color-warning: #E8A44A;
  --color-warning-muted: rgba(232, 164, 74, 0.10);
  --color-error: #E85A5A;
  --color-error-muted: rgba(232, 90, 90, 0.10);

  /* ── Typography ── */
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --font-body: "Inter", "SF Pro Text", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Fira Code", monospace;

  --text-5xl: 4.5rem;
  --text-4xl: 3.25rem;
  --text-3xl: 2.25rem;
  --text-2xl: 1.75rem;
  --text-xl: 1.375rem;
  --text-lg: 1.125rem;
  --text-base: 1rem;
  --text-sm: 0.875rem;
  --text-xs: 0.75rem;

  /* ── Spacing ── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;

  /* ── Radius ── */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* ── Shadows ── */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.5);
  --shadow-glow-accent: 0 0 24px rgba(91, 108, 240, 0.2);
  --shadow-glow-teal: 0 0 24px rgba(56, 191, 167, 0.15);
  --shadow-card: 0 2px 12px rgba(0, 0, 0, 0.2);
  --shadow-card-hover: 0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(91, 108, 240, 0.08);

  /* ── Blur ── */
  --blur-sm: 8px;
  --blur-md: 16px;
  --blur-lg: 32px;
  --blur-xl: 64px;

  /* ── Transitions ── */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-expo: cubic-bezier(0.19, 1, 0.22, 1);
  --ease-circ: cubic-bezier(0.075, 0.82, 0.165, 1);
  --duration-instant: 80ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-slower: 700ms;
  --duration-glacial: 1200ms;

  /* ── Layout ── */
  --content-max-width: 1120px;
  --content-narrow: 720px;
  --content-wide: 1320px;
  --nav-height: 56px;

  /* ── Gradients ── */
  --gradient-text-hero: linear-gradient(135deg, #E8E9ED 0%, #7280FF 40%, #38BFA7 80%, #E8A44A 100%);
  --gradient-hero-glow:
    radial-gradient(ellipse 70% 50% at 25% 15%, rgba(91, 108, 240, 0.10), transparent),
    radial-gradient(ellipse 40% 60% at 75% 8%, rgba(56, 191, 167, 0.06), transparent),
    radial-gradient(ellipse 50% 40% at 60% 85%, rgba(232, 164, 74, 0.04), transparent);
  --gradient-section-divider: linear-gradient(90deg, transparent 0%, rgba(91, 108, 240, 0.15) 30%, rgba(56, 191, 167, 0.08) 70%, transparent 100%);
  --gradient-cta-bg: linear-gradient(160deg, rgba(91, 108, 240, 0.06) 0%, rgba(232, 164, 74, 0.04) 100%);
  --gradient-card-shimmer: linear-gradient(90deg, transparent 0%, rgba(91, 108, 240, 0.25) 40%, rgba(56, 191, 167, 0.15) 60%, transparent 100%);
  --gradient-mesh:
    radial-gradient(circle at 10% 20%, rgba(91, 108, 240, 0.06), transparent 50%),
    radial-gradient(circle at 80% 10%, rgba(56, 191, 167, 0.04), transparent 40%),
    radial-gradient(circle at 55% 85%, rgba(232, 164, 74, 0.03), transparent 45%);

  /* ── Font Rendering ── */
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## Appendix B: Button Styles (Updated)

```css
/* Primary — flat color, no gradient (modern trend) */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--color-accent-primary);
  color: var(--color-text-on-accent);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1;
  border: none;
  border-radius: var(--radius-md);  /* 8px — sharper */
  cursor: pointer;
  box-shadow: none;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    box-shadow var(--duration-normal) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
  box-shadow: 0 0 24px rgba(91, 108, 240, 0.3), 0 4px 16px rgba(0, 0, 0, 0.3);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-xs);
}

/* Secondary — text link style, no border */
.btn-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  background: transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1;
  border: none;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-smooth);
}

.btn-text:hover {
  color: var(--color-text);
}

.btn-text::after {
  content: "→";
  transition: transform var(--duration-fast) var(--ease-out);
}

.btn-text:hover::after {
  transform: translateX(3px);
}

/* Ghost — for nav, inline actions */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-smooth),
    background var(--duration-fast) var(--ease-smooth),
    border-color var(--duration-fast) var(--ease-smooth);
}

.btn-ghost:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--color-border-hover);
}
```

---

## Appendix C: Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## Appendix D: Migration Mapping

For the implementer — mapping old token names to new:

| Old Token              | New Token                 | Note                          |
| ---------------------- | ------------------------- | ----------------------------- |
| `--color-accent`       | `--color-accent-primary`  | Renamed + color changed       |
| `--color-accent-2`     | `--color-accent-teal`     | Renamed + color changed       |
| `--color-accent-3`     | `--color-error`           | Removed as separate accent    |
| `--color-text-2`       | `--color-text-secondary`  | Renamed for clarity           |
| `--color-text-link`    | `--color-text-link`       | Same, updated value           |
| `--ease-spring`        | REMOVED                   | Not appropriate for aesthetic |
| `--gradient-text`      | `--gradient-text-hero`    | Renamed                       |
| `--gradient-button-primary` | REMOVED              | Buttons use flat color now    |
| `--gradient-accent-warm` | REMOVED                 | Not used                      |
| `--radius-lg`          | `12px` (was `16px`)       | Sharper                       |
| `--radius-md`          | `8px` (was `12px`)        | Sharper                       |
| `--radius-sm`          | `6px` (was `8px`)         | Sharper                       |
| `--nav-height`         | `56px` (was `64px`)       | Tighter                       |
| `--content-max-width`  | `1120px` (was `1200px`)   | Tighter                       |
| `--content-narrow`     | `720px` (was `800px`)     | Tighter                       |

---

*End of STYLE-SPEC.md — v2.0*
*Design direction: Midnight Indigo — dark editorial aesthetic*
*Fonts: Space Grotesk (display) + Inter (body) + JetBrains Mono (code)*
*Palette: #5B6CF0 (indigo) + #38BFA7 (teal) + #E8A44A (amber)*
