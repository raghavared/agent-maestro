# Implementation Brief — Maestro Marketing Website

> Consolidated reference for implementers. Merges key specs from content.md, styles.md, and ux.md into a single document.
> For full details, refer to the source files in this directory.

---

## Architecture

- **Type:** Single-page marketing site with anchor navigation
- **Sections:** Hero → Pillars → Coordination → Tasks → Teams → Terminal → Getting Started → CTA → Footer
- **URL structure:** `/#overview`, `/#pillars`, `/#coordination`, `/#tasks`, `/#teams`, `/#terminal`, `/#get-started`
- **No routing required** — single long-scroll page

---

## Section-by-Section Specs

### 1. Navigation (Fixed)

**Layout:** Fixed top bar, `height: 64px`, `z-index: 100`
**Background:** `rgba(10, 12, 16, 0.8)` + `backdrop-filter: blur(16px)`. Transparent over hero initially — fades in after 80px scroll.
**Nav links:** Overview | Pillars | Coordination | Tasks | Teams | Terminal
**CTA button:** "Get Started" (`.btn-primary`, small: `padding: 8px 20px`)
**Logo:** "Maestro" text, `--font-display`, weight 700, `--text-lg`
**Mobile (≤768px):** Hamburger menu → full-width dropdown with `slideDown 350ms`. Links stack vertically.
**Active state:** IntersectionObserver on sections (>30% viewport → `.active` class on nav link)

**Content:** See content.md §2 for nav labels.
**Styles:** See styles.md §5.3 for full CSS.
**UX:** See ux.md §2 for wireframes.

---

### 2. Hero Section (#overview)

**Layout:**
- `min-height: 100vh`, content centered
- `max-width: 800px` (--content-narrow)
- `padding-top: calc(64px + 96px)`, `padding-bottom: 96px`
- Text alignment: center

**Content:**
- Eyebrow badges: `Open Source` · `Multi-Agent` · `Local-First` (`.badge-accent`, flex row, gap 12px)
- Headline: "Orchestrate AI agents. Ship faster." (`--text-4xl`, weight 800, gradient text via `--gradient-text` + `background-clip: text`)
- Subheadline: "Maestro coordinates multiple Claude sessions across your projects — break work into tasks, spawn agents in parallel, and track everything from one place." (`--text-lg`, `--color-text-2`)
- CTA pair: "Get Started" (`.btn-primary`) + "View on GitHub" (`.btn-secondary`), flex row, gap 16px

**Media:** `[MP-01]` Hero demo reel — Video/GIF, 800×450, 16:9, autoplay muted loop. Below CTAs.

**Background:** `--gradient-hero-glow` (animated gradient orbs, `glow-drift 15s ease-in-out infinite`) + SVG noise overlay at 4% opacity.
**Optional:** `[MP-15]` Abstract agent orchestration animation behind text.

**Entrance animation:** Staggered fade-up (badges 0ms → headline 100ms → lede 200ms → CTAs 300ms), 500ms each, `--ease-out`.

---

### 3. Core Pillars (#pillars)

**Layout:**
- `max-width: 1200px`, centered
- Section padding: `96px` vertical
- Eyebrow: "PLATFORM" (`--font-mono`, `--text-xs`, uppercase, `--color-accent`, `letter-spacing: 0.12em`)
- Heading: "Built for how you actually work" (`--text-3xl`)
- Description: "Maestro is a desktop app, a CLI, a server, and a coordination engine..." (`--text-lg`, `--color-text-2`)
- Gap heading → grid: `48px`

**Grid:** `display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px`
- Desktop: 4 cols | Tablet: 2 cols | Mobile: 1 col

**Cards (4):**

| Card | Title | Icon | Description | Media |
|------|-------|------|-------------|-------|
| 1 | Desktop App | monitor/window | Full workspace with terminals, task boards... Built with Tauri. | [MP-02] Screenshot 560×350 |
| 2 | Server & API | server/database | Coordination backbone. Express + WebSocket. JSON files on disk. | [MP-03] Screenshot 560×350 |
| 3 | CLI | terminal/command-line | Full control from terminal. Every command supports `--json`. | [MP-04] Screenshot 480×360 |
| 4 | Coordination | network/nodes | Multi-agent layer. Coordinators + workers. DAG workflows. | [MP-05] Screenshot 560×350 |

**Card styling:**
- `padding: 32px` (--space-8)
- `background: --color-surface-1`, `border: 1px solid --color-border`, `border-radius: 16px`
- Icon: 40×40px with `--color-accent-muted` background
- Title: `--text-xl`, weight 600, `margin-bottom: 12px`
- Description: `--text-base`, `--color-text-2`
- Hover: `translateY(-4px)`, `--shadow-card-hover`, shimmer top border

**Animation:** Staggered `.reveal` (fade-up, 80ms × index)

---

### 4. Coordination Deep-Dive (#coordination)

**Layout:**
- `max-width: 1200px`, centered
- Eyebrow: "COORDINATION"
- Heading: "Multi-agent orchestration, not multi-agent chaos"
- Description: "Running multiple AI agents is easy. Keeping them coordinated is hard..."

**Two panel blocks, stacked, gap: 48px:**

**Panel 1 — "Two roles, one workflow":**
- Grid: `55% text / 45% visual`, gap 48px
- Text: 5 bullet points about coordinator/worker pattern
- Visual: Coordinator-worker tree diagram (CSS/SVG) — coordinator node → 2-3 worker nodes. `[MP-06]` Video/GIF 480×480 as alternative/enhancement
- Container: `--color-surface-1`, `border: 1px solid --color-border`, `border-radius: 16px`, `padding: 48px`

**Panel 2 — "Full visibility, zero interruptions":**
- Grid: `45% visual / 55% text` (reversed — zigzag pattern)
- Visual: Terminal mockup showing `maestro status` output. `[MP-07]` Screenshot 520×390
- Text: 5 bullet points about monitoring and control

**Responsive (≤768px):** Single column, text above visual in both panels.
**Animation:** Panel 1 `.reveal-left`, Panel 2 `.reveal`

---

### 5. Tasks & Projects (#tasks)

**Layout:**
- `max-width: 1200px`, centered
- Eyebrow: "TASKS"
- Heading: "Plan once, execute everywhere"
- Description: "Tasks are the unit of work in Maestro..."

**Two zones stacked:**

**Zone 1 — Task tree visualization:**
- `max-width: 480px`, centered
- Styled list with tree-line connectors (CSS `border-left` + `::before`)
- `background: --color-bg-deep`, `border: 1px solid --color-border`, `border-radius: --radius-md`
- `font: --font-mono, --text-sm`
- Status icons: ✓ (green/completed), ● (accent/in-progress), ○ (muted/pending)
- `[MP-08]` Screenshot 420×560 as alternative/enhancement
- Animation: `.reveal-scale`

**Zone 2 — Feature points (5):**
- Grid: `repeat(5, 1fr)`, gap `20px`
- Each mini-card: `padding: 20px`, `background: --color-surface-2`, `border-radius: --radius-md`

| # | Title | Description |
|---|-------|-------------|
| 1 | Hierarchical task trees | Parent/child relationships for decomposing complex objectives |
| 2 | Many-to-many linking | Multiple sessions per task, multiple tasks per session |
| 3 | Full lifecycle tracking | todo → in_progress → in_review → completed, with blocked/cancelled |
| 4 | Automatic session sync | Task-session links update bidirectionally in real-time |
| 5 | Project isolation | Self-contained workspaces with own tasks, sessions, team structure |

- Tablet (≤1024px): 3-col | Mobile (≤640px): 1-col
- Animation: Staggered `.reveal`

---

### 6. Teams (#teams)

**Layout:**
- `max-width: 1200px`, centered
- Eyebrow: "TEAMS"
- Heading: "Reusable agents. Predictable results."
- Description: "Define agent identities once and reuse them across sessions..."

**Grid: `45% visual / 55% content`, gap 48px**

**Visual (left):** Team structure card showing hierarchy — leader + members with avatar emojis, connecting lines. `[MP-10]` Screenshot 420×560 as alternative.

**Feature list (right):** 5 items, gap 24px between each:

| # | Title | Description |
|---|-------|-------------|
| 1 | Preconfigured roles | Built-in defaults (Simple Worker, Coordinator, Batch Coordinator, DAG Coordinator, Recruiter) |
| 2 | Custom specialists | Tailored agents with custom model, tools, permissions, identity |
| 3 | Persistent memory | Project-specific knowledge accumulates across sessions |
| 4 | Capability boundaries | Fine-grained permissions control per agent |
| 5 | Team topology | Nested sub-teams, reusable structures across tasks |

**Responsive (≤768px):** Single column, visual above text.
**Animation:** Visual `.reveal-left`, list items staggered `.reveal`

---

### 7. Terminal & Logs (#terminal)

**Layout:**
- `max-width: 1200px`, centered
- Eyebrow: "TERMINAL"
- Heading: "Real terminals. Full transparency."
- Description: "Every session runs in a real PTY-backed shell..."

**Three stacked zones:**

**Zone 1 — Terminal mockup:**
- `.code-terminal` component, `max-width: 720px`, centered
- Fake terminal chrome: three dots (red/yellow/green) top-left, "Terminal" label
- Content: task creation → session spawn → `maestro status` output
- Syntax colors: commands `--color-text`, success `--color-success`, active `--color-accent`, blocked `--color-warning`
- `[MP-12]` Video/GIF 720×405 as alternative
- Optional typing animation: progressive line reveal, 200ms between lines, only on first viewport entry
- Animation: `.reveal-scale`

**Zone 2 — Feature grid (4):**
- Grid: `repeat(4, 1fr)`, gap `20px`
- `padding: 24px`, `background: --color-surface-1`, `border-radius: --radius-lg`

| # | Title | Description |
|---|-------|-------------|
| 1 | Persistent sessions | Leave and come back without losing state |
| 2 | Session transcripts | Full I/O timeline captured as execution log |
| 3 | Human checkpoints | `needs-input` states pause execution safely |
| 4 | Command permissions | Capability-based controls govern agent execution |

- Tablet: 2-col | Mobile: 1-col

**Zone 3 — Callout banner:**
- `background: --color-surface-2`, `border: 1px solid --color-border`, `border-radius: --radius-md`
- `padding: 24px 32px`, left border accent `4px solid --color-accent`
- Text: "Agents get real shells. You get full logs. Everyone stays accountable." (`--text-lg`, weight 500, centered)

---

### 8. Getting Started (#get-started)

**Layout:**
- `max-width: 1200px`, centered
- Eyebrow: "GET STARTED"
- Heading: "Up and running in three steps"

**Sub-section 1 — Quick start steps:**
- Grid: `repeat(3, 1fr)`, gap `24px`
- Mobile: 1-col stacked

| Step | Title | Code | Description |
|------|-------|------|-------------|
| ① Install | Install | `git clone ...` / `cd agent-maestro` / `npm install` | Clone the repo and install dependencies |
| ② Start | Start | `npm run dev:all` | Launches desktop app and server together |
| ③ CLI | CLI Setup | `cd maestro-cli` / `npm run build && npm link` / `maestro --help` | Now `maestro` is available globally |

- Card styling: `padding: 32px`, `background: --color-surface-1`, `border-radius: --radius-lg`
- Step number: circled (①②③), `--text-2xl`, `--color-accent`
- Code: `.code-block` component

**Sub-section 2 — First workflow:**
- Sub-heading: "Your first multi-agent workflow" (`--text-2xl`)
- Terminal block (`.code-terminal`), `max-width: 720px`, centered
- Shows: task create → subtask create → session spawn × 2 → session list
- `[MP-14]` Video/GIF 720×405 as alternative

**Animation:** Step cards staggered `.reveal` (120ms × index)

---

### 9. CTA Section

**Layout:**
- Full viewport width (breaks out of container)
- Content: `max-width: 720px`, centered, text-align center
- `padding: 96px` vertical

**Background:** `linear-gradient(135deg, rgba(108, 99, 255, 0.08), rgba(0, 212, 170, 0.06))` over `--color-surface-1`. Border top + bottom: `1px solid --color-border`.

**Content:**
- Heading: "Stop managing agents. Start orchestrating them." (`--text-3xl`)
- Description: "Maestro is open source and runs entirely on your machine. Set up in minutes, coordinate dozens of agents, and keep everything local." (`--text-lg`, `--color-text-2`)
- CTAs: "Get Started" (`.btn-primary`) + "Star on GitHub" (`.btn-secondary`), flex, gap 16px, `margin-top: 32px`

---

### 10. Footer

**Layout:**
- `max-width: 1200px`, centered
- `background: --color-bg-deep`
- `padding: 64px max(24px, 5vw) 32px`
- Grid: `1.5fr repeat(3, 1fr)`, gap `48px`
- Col 1: Logo + tagline ("Multi-agent orchestration for developers.")
- Cols 2-4: Link groups (Product, Resources, Community)
- Bottom: Copyright line with `--color-divider` border-top

**Link Groups:**

| Product | Resources | Community |
|---------|-----------|-----------|
| Desktop App | Getting Started | GitHub Discussions |
| CLI | Architecture Guide | Contributing Guide |
| Server & API | GitHub Repository | License (AGPL-3.0) |
| Documentation | Changelog | |

**Responsive:** Tablet 2-col, Mobile 1-col.

---

## Component Catalog

All CSS is defined in `styles.md`. Key components for implementation:

| Component | Class | Usage | Key Specs |
|-----------|-------|-------|-----------|
| Primary Button | `.btn-primary` | Hero CTA, Nav CTA, Getting Started CTA | Gradient bg, glow shadow, hover lift -1px |
| Secondary Button | `.btn-secondary` | Hero secondary CTA, CTA section | Transparent bg, accent border, hover tint |
| Ghost Button | `.btn-ghost` | Footer links, inline actions | No border, hover bg tint |
| Feature Card | `.card` | Pillar cards, coordination panels | Surface-1 bg, hover lift -4px, shimmer top border |
| Mini Card | (variant) | Task features, terminal features, step cards | Surface-2 bg, smaller padding, hover lift -2px |
| Glass Card | (variant) | Optional decorative use | Glass bg + backdrop blur |
| Code Block | `.code-block` | Getting started code snippets | bg-deep, mono font, border |
| Terminal Block | `.code-terminal` | Coordination panel 2, terminal section, getting started workflow | bg #0c0e12, terminal chrome dots + label |
| Section Heading | `.section-heading` + `.section-eyebrow` + `.section-title` + `.section-description` | Every section intro | Eyebrow mono uppercase, title text-3xl, desc text-lg |
| Badge | `.badge-accent` | Hero meta badges | Accent-muted bg, accent text, full-radius pill |
| Callout Banner | (custom) | Terminal section | Surface-2 bg, left accent border 4px |
| Nav Bar | `.nav` | Top navigation | Fixed, blur bg, 64px height |

---

## Media Placeholders (15 total)

Implement each placeholder as:
```
background: --color-surface-2
border: 1px dashed --color-border
border-radius: --radius-lg
display: flex; align-items: center; justify-content: center
color: --color-text-muted
font: --font-mono, --text-xs
```

| ID | Section | Type | Dimensions | Description |
|----|---------|------|-----------|-------------|
| MP-01 | Hero | Video/GIF | 800×450 (16:9) | Hero demo reel — desktop app quick cuts |
| MP-02 | Pillars: Desktop App | Screenshot | 560×350 (16:10) | Desktop app workspace |
| MP-03 | Pillars: Server & API | Screenshot | 560×350 (16:10) | Session timeline view |
| MP-04 | Pillars: CLI | Screenshot | 480×360 (4:3) | Terminal CLI output |
| MP-05 | Pillars: Coordination | Screenshot | 560×350 (16:10) | Multi-session parallel view |
| MP-06 | Coordination Panel 1 | Video/GIF | 480×480 (1:1) | Coordinator spawning workers |
| MP-07 | Coordination Panel 2 | Screenshot | 520×390 (4:3) | Real-time monitoring view |
| MP-08 | Tasks | Screenshot | 420×560 (3:4) | Task board kanban view |
| MP-09 | Tasks (alt) | Video/GIF | 640×360 (16:9) | Task lifecycle demo |
| MP-10 | Teams | Screenshot | 420×560 (3:4) | Team member management |
| MP-11 | Teams (alt) | Video/GIF | 640×360 (16:9) | Spawning with team member |
| MP-12 | Terminal | Video/GIF | 720×405 (16:9) | Live terminal session |
| MP-13 | Terminal (alt) | Screenshot | 720×405 (16:9) | Session log viewer |
| MP-14 | Getting Started | Video/GIF | 720×405 (16:9) | Complete first workflow |
| MP-15 | Hero (decorative) | Animation | Full-width | Abstract agent orchestration bg |

**Priority order:** MP-01 → MP-12 → MP-14 → MP-08 → MP-06 → MP-02 → rest

---

## Design Tokens Quick Reference

```css
/* Key colors */
--color-bg: #0a0c10;
--color-surface-1: #141720;
--color-surface-2: #191d28;
--color-accent: #6C63FF;
--color-accent-2: #00D4AA;
--color-text: #EDEDF0;
--color-text-2: #B0B3C0;
--color-text-muted: #6B6F80;
--color-border: rgba(255, 255, 255, 0.08);

/* Key typography */
--font-display: "Inter", system-ui, sans-serif;
--font-mono: "JetBrains Mono", monospace;
--text-4xl: 3.5rem;  /* Hero h1 */
--text-3xl: 2.5rem;  /* Section h2 */
--text-xl: 1.5rem;   /* Card h4 */
--text-lg: 1.25rem;  /* Lead text */
--text-base: 1rem;   /* Body */
--text-sm: 0.875rem; /* Secondary */

/* Key layout */
--content-max-width: 1200px;
--content-narrow: 800px;
--nav-height: 64px;
--space-6: 24px;  /* Card padding, grid gap */
--space-12: 48px; /* Heading-to-content gap */
--space-24: 96px; /* Section vertical padding */
--radius-lg: 16px; /* Cards */
--radius-md: 12px; /* Buttons, code blocks */
```

Full token set in `styles.md` §4.

---

## Responsive Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| sm | ≤640px | Single column everything, full-width CTAs, reduced padding |
| md | 641-768px | Nav collapses to hamburger, 2-col grids |
| lg | 769-1024px | 2-col grids, reduced gaps |
| xl | 1025-1280px | Full layout, all columns |
| 2xl | >1280px | Max-width container constrains content |

Fluid type: `clamp(2rem, 5vw + 1rem, 3.5rem)` for hero h1, `clamp(1.75rem, 3vw + 0.5rem, 2.5rem)` for section h2.

---

## Animation Summary

- **Scroll reveal:** IntersectionObserver, threshold 0.15, rootMargin "0px 0px -60px 0px". Add `.visible` class. Unobserve after first trigger.
- **Stagger:** CSS custom property `--stagger-index` × 80ms delay (120ms for getting started steps).
- **Hero entrance:** 4-step staggered fade-up on page load (0/100/200/300ms).
- **Hero background:** `glow-drift` 15s infinite on gradient orbs.
- **Reduced motion:** All animations disabled via `prefers-reduced-motion: reduce`.

---

## Accessibility Checklist

- [ ] Skip navigation link (hidden, visible on focus → jumps to #pillars)
- [ ] Visible focus rings on all interactive elements (`--color-border-focus`)
- [ ] WCAG AA color contrast on all text
- [ ] `prefers-reduced-motion` disables all animations
- [ ] Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section aria-label>`, `<footer>`
- [ ] Keyboard navigation follows visual order
- [ ] Decorative SVGs/diagrams have `aria-hidden="true"`
- [ ] Touch targets ≥44px on mobile

---

## Performance Targets

- Bundle: < 100KB JS, < 50KB CSS
- No raster images in v1 (all CSS/SVG/HTML visuals)
- Font preload: Inter + JetBrains Mono with `font-display: swap`
- Critical CSS: Hero section styles inlined or loaded first
- Lazy-load terminal typing animation

---

*Generated from approved design deliverables. For full specs, see content.md, styles.md, and ux.md.*
