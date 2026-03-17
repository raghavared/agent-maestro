# Maestro Website — UX & Page Architecture

> Blueprint for implementers. Every dimension, grid, breakpoint, and interaction is specified.
> Cross-reference: `content.md` for copy, `styles.md` for design tokens.

---

## 1. Site Map

```
maestro.dev (single-page marketing site)
│
├── / (Main Page — all sections below)
│   ├── #overview     → Hero
│   ├── #pillars      → Core Pillars (4-card grid)
│   ├── #coordination → Coordination Deep-Dive (split panels)
│   ├── #tasks        → Tasks & Projects
│   ├── #teams        → Teams & Team Members
│   ├── #terminal     → Terminal & Logs
│   ├── #get-started  → Getting Started (quick-start + first workflow)
│   └── Footer
│
├── Navigation (fixed top bar, scrolls with active highlight)
│
└── No additional pages in v1 — single long-scroll with anchor nav
```

**Rationale:** Single-page scroll with anchor nav keeps friction minimal for a developer tool landing page. All content is accessible without routing complexity. Navigation highlights the active section as the user scrolls.

---

## 2. Navigation

### Desktop Layout (>768px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ◆ Maestro          Overview  Pillars  Coordination  Tasks  Teams  Terminal │ [Get Started]  │
│  ◄─ logo ──►        ◄──────────── nav links (centered or left-flush) ─────►  ◄─ CTA btn ──► │
└─────────────────────────────────────────────────────────────────────────────┘
  height: 64px (--nav-height)
  position: fixed, top: 0
  background: rgba(10, 12, 16, 0.8) + backdrop-filter: blur(16px)
  border-bottom: 1px solid --color-border
  z-index: 100
  padding: 0 max(24px, 5vw)
```

**Behavior:**
- Fixed to viewport top at all times
- Transparent over hero initially (no background until user scrolls 80px)
- After 80px scroll: background fades in to `rgba(10, 12, 16, 0.8)` over 350ms
- Active section link highlighted via Intersection Observer on each section
- "Get Started" is a primary button (`.btn-primary`, small variant: padding `8px 20px`)
- Logo is text-only: "Maestro" in `--font-display`, weight 700, `--text-lg`

### Mobile Layout (≤768px)

```
┌───────────────────────────────────┐
│  ◆ Maestro              [≡]      │
│  ◄─ logo ──►         hamburger   │
└───────────────────────────────────┘

  Hamburger opens full-width dropdown:

┌───────────────────────────────────┐
│  ◆ Maestro              [✕]      │
├───────────────────────────────────┤
│  Overview                         │
│  Pillars                          │
│  Coordination                     │
│  Tasks                            │
│  Teams                            │
│  Terminal                         │
│  ─────────────────────────        │
│  [Get Started]  (full-width btn)  │
└───────────────────────────────────┘
  background: --color-bg-overlay + blur(32px)
  animation: slideDown 350ms --ease-out
  each link: padding 12px 20px, full-width tap target
```

**Hamburger icon:** 3-line icon, animates to X on open (CSS transform, 200ms).

---

## 3. Page Layout — Full Section Sequence

### 3.1 Hero Section (#overview)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          [nav bar — 64px]                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                    ┌─────────────────────────┐                     │
│                    │   OPEN SOURCE            │  ◄─ eyebrow badges │
│                    │   MULTI-AGENT            │     mono, xs,      │
│                    │   LOCAL-FIRST            │     uppercase,     │
│                    └─────────────────────────┘     accent color    │
│                                                                     │
│              Orchestrate AI agents.                                 │
│              Ship faster.                        ◄─ h1, gradient   │
│                                                     text, 3.5rem   │
│                                                                     │
│         Maestro coordinates multiple Claude                        │
│         sessions across your projects —                            │
│         break work into tasks, spawn agents       ◄─ lede, text-lg │
│         in parallel, and track everything              text-2      │
│         from one place.                                             │
│                                                                     │
│              [Get Started]  [View on GitHub]      ◄─ CTA buttons   │
│               primary btn    secondary btn             gap: 16px   │
│                                                                     │
│              ┌─────────────────────────────┐                        │
│              │    [MP-01] Hero demo reel   │      ◄─ media         │
│              │    Video/GIF · 800×450      │         placeholder    │
│              │    16:9 · autoplay muted    │         (see §10)     │
│              └─────────────────────────────┘                        │
│                                                                     │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ◄─ hero glow  │
│   ░░░  animated gradient orbs (absolute)  ░░░░░░      background   │
│   ░░░  [MP-15] optional bg animation      ░░░░░░                   │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Viewport height: `min-height: 100vh` (clamp to at least full screen)
- Content zone: `max-width: 800px` (--content-narrow), centered
- Top padding: `calc(var(--nav-height) + 96px)` = ~160px from top
- Bottom padding: `96px` (--space-24)
- Text alignment: center
- Badge row: `display: flex`, `gap: 12px`, `justify-content: center`, `margin-bottom: 32px`

**Background:**
- Gradient mesh (--gradient-hero-glow) as absolute-positioned layer
- Animated with `glow-drift` keyframes (15s, infinite)
- SVG noise overlay at 4% opacity on top

**Entrance animation:**
1. Badges: fade-up, delay 0ms
2. Headline: fade-up, delay 100ms
3. Lede: fade-up, delay 200ms
4. CTAs: fade-up, delay 300ms
5. Each step: 500ms duration, `--ease-out`

### 3.2 Core Pillars Section (#pillars)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  PLATFORM                                    ◄─ eyebrow (mono)     │
│  Built for how you actually work             ◄─ section title      │
│  Maestro is a desktop app, a CLI, ...        ◄─ description        │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐│
│  │  🖥           │ │  ⚙           │ │  >_          │ │  ◉          ││
│  │              │ │              │ │              │ │            ││
│  │ Desktop App  │ │ Server & API │ │ CLI          │ │Coordination││
│  │              │ │              │ │              │ │            ││
│  │ A full       │ │ The coord-   │ │ Full control │ │The layer   ││
│  │ workspace... │ │ ination...   │ │ from the...  │ │that makes..││
│  │              │ │              │ │              │ │            ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘│
│  ◄─────────── 4-column grid, gap: 24px, min-col: 280px ──────────►│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Grid specification:**
- Container: `max-width: 1200px` (--content-max-width), centered
- Grid: `display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px`
- This yields: 4 cols on desktop (>1200px), 2 cols on tablet (~768-1024px), 1 col on mobile (<640px)
- Section padding: `96px` vertical, `max(24px, 5vw)` horizontal

**Card anatomy:**
```
┌────────────────────────────────────────┐
│  [icon]  40×40px, accent-muted bg     │  ◄─ top-left, margin-bottom: 20px
│                                        │
│  Card Title                            │  ◄─ h4, text-xl, weight 600
│                                        │     margin-bottom: 12px
│  Description text that explains the    │  ◄─ text-base, text-2 color
│  feature in 2-3 sentences. This is     │     line-height: 1.6
│  the body content of the card.         │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  [MP-02..05] Screenshot          │  │  ◄─ media placeholder
│  │  560×350 · 16:10                 │  │     per-card (see §10)
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
  padding: 32px (--space-8)
  background: --color-surface-1
  border: 1px solid --color-border
  border-radius: 16px (--radius-lg)
  min-height: 240px
```

**Hover state:**
- Card lifts: `translateY(-4px)`
- Shadow deepens: `--shadow-card-hover`
- Border brightens: `--color-border-hover`
- Top shimmer line fades in (gradient-card-shimmer)
- Transition: 350ms `--ease-out`

**Scroll reveal:**
- Cards animate in with `.reveal` (translateY 24px → 0, opacity 0 → 1)
- Staggered: each card delayed by 80ms × index
- Trigger: 15% intersection threshold, once

### 3.3 Coordination Deep-Dive (#coordination)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  COORDINATION                                ◄─ eyebrow            │
│  Multi-agent orchestration,                  ◄─ section title      │
│  not multi-agent chaos                                              │
│  Running multiple AI agents is easy...       ◄─ description        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  ┌──────────────────────┐   ┌──────────────────────┐       │   │
│  │  │                      │   │                      │       │   │
│  │  │  Two roles,          │   │  ┌───────────────┐   │       │   │
│  │  │  one workflow        │   │  │  Coordinator  │   │       │   │
│  │  │                      │   │  │     ◉         │   │       │   │
│  │  │  • Coordinators      │   │  │   ╱   ╲       │   │       │   │
│  │  │    plan work...      │   │  │  ◉     ◉     │   │       │   │
│  │  │  • Workers execute   │   │  │ Worker Worker │   │       │   │
│  │  │    tasks directly... │   │  │               │   │       │   │
│  │  │  • Planning stays    │   │  └───────────────┘   │       │   │
│  │  │    centralized...    │   │  ◄─ diagram zone ──► │       │   │
│  │  │                      │   │                      │       │   │
│  │  └──────────────────────┘   └──────────────────────┘       │   │
│  │  ◄──── text panel ────►     ◄──── visual panel ───►        │   │
│  │        55% width                  45% width                │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  ┌──────────────────────┐   ┌──────────────────────┐       │   │
│  │  │  visual / terminal   │   │  Full visibility,    │       │   │
│  │  │  screenshot mockup   │   │  zero interruptions  │       │   │
│  │  │                      │   │                      │       │   │
│  │  │  ┌─ Terminal ──────┐ │   │  • Real-time         │       │   │
│  │  │  │ $ maestro status│ │   │    progress tracking │       │   │
│  │  │  │ ● 3 active      │ │   │  • blocked states    │       │   │
│  │  │  │ ✓ 7 completed   │ │   │    surface problems  │       │   │
│  │  │  │ ▲ 1 blocked     │ │   │  • Attached docs     │       │   │
│  │  │  └─────────────────┘ │   │    maintain audit... │       │   │
│  │  │                      │   │  • DAG orchestration  │       │   │
│  │  └──────────────────────┘   └──────────────────────┘       │   │
│  │  ◄──── visual panel ──►     ◄──── text panel ────►         │   │
│  │        45% width                  55% width                │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout specification:**
- Container: `max-width: 1200px`, centered
- Two panel blocks, stacked vertically, `gap: 48px` between them
- Each panel block: `display: grid; grid-template-columns: 55% 45%; gap: 48px; align-items: center`
- Panel 2 reverses column order: `grid-template-columns: 45% 55%` (visual left, text right)
- This creates an alternating zigzag pattern

**Panel block styling:**
- Background: `--color-surface-1`
- Border: `1px solid --color-border`
- Border-radius: `--radius-lg` (16px)
- Padding: `48px` (--space-12)

**Visual zones:**
- Panel 1 visual: Coordinator/worker tree diagram — use CSS/SVG
  - Central node (Coordinator) connects downward to 2-3 Worker nodes
  - Nodes: 48px circles with labels, connected by 2px lines
  - Colors: Coordinator = `--color-accent`, Workers = `--color-accent-2`
  - Subtle pulse animation on active connections
- Panel 2 visual: Terminal mockup (`.code-terminal` component)
  - Shows sample `maestro status` output with colored status indicators
  - Static content, no typing animation needed

**Responsive (≤768px):**
- Both panels collapse to single column: `grid-template-columns: 1fr`
- Visual zone stacks below text in both panels (no zigzag on mobile)
- Gap reduces to `--space-8` (32px)

**Scroll reveal:**
- Panel 1: `.reveal-left` (slide from left)
- Panel 2: `.reveal` (slide from bottom — right variant not needed, standard is fine)
- Each with 500ms duration

### 3.4 Tasks & Projects Section (#tasks)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  TASKS                                       ◄─ eyebrow            │
│  Plan once, execute everywhere               ◄─ section title      │
│  Tasks are the unit of work in Maestro...    ◄─ description        │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  ┌─────────────────────────────┐                              │ │
│  │  │  📋  Task Tree              │  ◄─ visual: hierarchy demo  │ │
│  │  │                             │                              │ │
│  │  │  ▼ Build auth system        │     Interactive or static    │ │
│  │  │    ├─ JWT endpoint    ✓     │     task tree visualization  │ │
│  │  │    ├─ Login form      ●     │                              │ │
│  │  │    ├─ Session mgmt    ○     │     max-width: 480px         │ │
│  │  │    └─ E2E tests       ○     │     centered in container    │ │
│  │  │                             │                              │ │
│  │  └─────────────────────────────┘                              │ │
│  │                                                                │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │ │
│  │  │ feat │ │ feat │ │ feat │ │ feat │ │ feat │               │ │
│  │  │  1   │ │  2   │ │  3   │ │  4   │ │  5   │  ◄─ 5 bullet │ │
│  │  │      │ │      │ │      │ │      │ │      │     points    │ │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     as cards  │ │
│  │  ◄────────── horizontal feature list, scrollable ──────────► │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout:**
- Container: `max-width: 1200px`, centered
- Two zones stacked vertically:
  1. **Task tree visual** (top): centered, `max-width: 480px`, margin `0 auto`
  2. **Feature points** (below): horizontal scrolling card strip or 5-column grid

**Task tree visualization:**
- Rendered as a styled list with tree-line connectors (CSS `border-left` + `::before` pseudo-elements)
- Background: `--color-bg-deep`
- Border: `1px solid --color-border`
- Border-radius: `--radius-md`
- Status icons: ✓ (completed, green), ● (in-progress, accent), ○ (pending, muted)
- Font: `--font-mono`, `--text-sm`

**Feature points layout:**
- `display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px`
- Each point is a mini card:
  ```
  ┌────────────────────┐
  │  Hierarchical      │  ◄─ h4, text-base, weight 600
  │  task trees         │
  │                    │
  │  Parent/child      │  ◄─ text-sm, text-2
  │  relationships...  │
  └────────────────────┘
    padding: 20px
    background: --color-surface-2
    border-radius: --radius-md
    border: 1px solid --color-border
  ```
- On tablet (≤1024px): `grid-template-columns: repeat(3, 1fr)` (wraps to 2 rows)
- On mobile (≤640px): `grid-template-columns: 1fr` (vertical stack)

**Scroll reveal:** Task tree uses `.reveal-scale` (scale 0.95 → 1). Feature cards stagger with `.reveal`.

### 3.5 Teams Section (#teams)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  TEAMS                                       ◄─ eyebrow            │
│  Reusable agents. Predictable results.       ◄─ section title      │
│  Define agent identities once and reuse...   ◄─ description        │
│                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────────┐        │
│  │                          │  │                          │        │
│  │  Team Structure Visual   │  │  Feature List            │        │
│  │                          │  │                          │        │
│  │  ┌─────────────────┐    │  │  ✦ Preconfigured roles   │        │
│  │  │  🎯 Team Alpha  │    │  │    Ship with built-in    │        │
│  │  │                 │    │  │    defaults...            │        │
│  │  │  Leader:        │    │  │                          │        │
│  │  │  🧭 Coordinator │    │  │  ✦ Custom specialists    │        │
│  │  │                 │    │  │    Create agents...       │        │
│  │  │  Members:       │    │  │                          │        │
│  │  │  ⚡ Worker A    │    │  │  ✦ Persistent memory     │        │
│  │  │  🔧 Worker B    │    │  │    Team members           │        │
│  │  │  🧪 Tester      │    │  │    accumulate...         │        │
│  │  │                 │    │  │                          │        │
│  │  └─────────────────┘    │  │  ✦ Capability boundaries │        │
│  │                          │  │    Fine-grained...       │        │
│  │                          │  │                          │        │
│  │                          │  │  ✦ Team topology         │        │
│  │                          │  │    Organize members...   │        │
│  │                          │  │                          │        │
│  └──────────────────────────┘  └──────────────────────────┘        │
│  ◄──── visual: 45% ────────►  ◄──── content: 55% ──────►          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout:**
- Container: `max-width: 1200px`, centered
- `display: grid; grid-template-columns: 45% 55%; gap: 48px; align-items: start`

**Team structure visual:**
- Card with nested list showing team hierarchy
- Background: `--color-surface-1`
- Border: `1px solid --color-border`, radius `--radius-lg`
- Padding: `32px`
- Team name header: `--text-xl`, weight 600
- Members shown as list items with avatar emoji + name
- Leader has accent color highlight
- Subtle connecting lines between leader and members (CSS)

**Feature list:**
- 5 feature items, each with:
  - Accent-colored bullet (✦ or small dot, `--color-accent`)
  - Title: `--text-base`, weight 600, `--color-text`
  - Description: `--text-sm`, `--color-text-2`
  - Gap between items: `24px`

**Responsive (≤768px):**
- `grid-template-columns: 1fr` — visual stacks above content
- Visual card maintains its styling, just full-width

**Scroll reveal:** Visual panel `.reveal-left`, feature list `.reveal` with staggered items.

### 3.6 Terminal & Logs Section (#terminal)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  TERMINAL                                    ◄─ eyebrow            │
│  Real terminals. Full transparency.          ◄─ section title      │
│  Every session runs in a real PTY-backed...  ◄─ description        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ┌─ Terminal ──────────────────────────────────────────────┐ │   │
│  │  │                                                         │ │   │
│  │  │  $ maestro task create --title "Build auth system"     │ │   │
│  │  │  ✔ Task created: task_abc123                           │ │   │
│  │  │                                                         │ │   │
│  │  │  $ maestro session spawn --task task_abc123 --role      │ │   │
│  │  │  worker                                                 │ │   │
│  │  │  ✔ Session spawned: sess_def456                        │ │   │
│  │  │  ● Working on: Build auth system                       │ │   │
│  │  │                                                         │ │   │
│  │  │  $ maestro status                                      │ │   │
│  │  │  Project: my-project                                   │ │   │
│  │  │  ● 2 active  ✓ 5 completed  ▲ 1 blocked              │ │   │
│  │  │                                                         │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  │  ◄────────── max-width: 720px, centered ──────────────────► │   │
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │Persistent│  │ Session  │  │ Human    │  │ Command  │          │
│  │ sessions │  │transcripts│ │checkpoints│  │permissions│         │
│  │          │  │          │  │          │  │          │          │
│  │ Leave &  │  │ Full I/O │  │needs-    │  │Capability│          │
│  │ come back│  │ timeline │  │input     │  │-based    │          │
│  │ without  │  │ captured │  │states    │  │controls  │          │
│  │ losing.. │  │ as exec..│  │pause...  │  │govern... │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│  ◄──────────── 4-column grid, gap: 20px ────────────────►         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  Agents get real shells. You get full logs.         │  ◄─      │
│  │  Everyone stays accountable.                        │  callout │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout:**
- Container: `max-width: 1200px`, centered
- Three stacked zones:
  1. **Terminal mockup** (`.code-terminal`): `max-width: 720px`, centered
  2. **Feature grid**: `grid-template-columns: repeat(4, 1fr)`, gap `20px`
  3. **Callout**: full-width banner

**Terminal mockup:**
- Uses `.code-terminal` styling from styles.md
- Fake terminal chrome: three dots (red/yellow/green) at top-left corner, "Terminal" label
- Syntax-colored output:
  - Commands (`$`): `--color-text`
  - Success (`✔`): `--color-success`
  - Active (`●`): `--color-accent`
  - Blocked (`▲`): `--color-warning`
- Typing animation: optional, progressive reveal of lines with 40ms per character delay
  - Only runs once on scroll-into-view
  - Falls back to static content with `prefers-reduced-motion`

**Feature grid cards:**
- Same mini-card style as Tasks section feature points
- Padding: `24px`, background: `--color-surface-1`, radius: `--radius-lg`

**Callout banner:**
- Background: `--color-surface-2`
- Border: `1px solid --color-border`
- Border-radius: `--radius-md`
- Padding: `24px 32px`
- Text: `--text-lg`, weight 500, `--color-text-2`, centered
- Subtle left border accent: `4px solid --color-accent`

**Responsive:**
- Feature grid: 2 cols on tablet, 1 col on mobile
- Terminal mockup: full width with horizontal scroll if needed
- Callout: full width, padding decreases on mobile

### 3.7 Getting Started Section (#get-started)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  GET STARTED                                 ◄─ eyebrow            │
│  Up and running in three steps               ◄─ section title      │
│                                                                     │
│  ┌──── Step 1 ────┐  ┌──── Step 2 ────┐  ┌──── Step 3 ────┐      │
│  │                │  │                │  │                │      │
│  │  ① Install     │  │  ② Start       │  │  ③ CLI         │      │
│  │                │  │                │  │                │      │
│  │  ┌──────────┐  │  │  ┌──────────┐  │  │  ┌──────────┐  │      │
│  │  │git clone │  │  │  │npm run   │  │  │  │cd maestro│  │      │
│  │  │cd agent- │  │  │  │dev:all   │  │  │  │npm build │  │      │
│  │  │npm install│  │  │  │          │  │  │  │npm link  │  │      │
│  │  └──────────┘  │  │  └──────────┘  │  │  └──────────┘  │      │
│  │                │  │                │  │                │      │
│  │  Clone the repo│  │  Launches the  │  │  Now `maestro` │      │
│  │  and install   │  │  desktop app   │  │  is available  │      │
│  │  dependencies  │  │  and server    │  │  globally      │      │
│  │                │  │                │  │                │      │
│  └────────────────┘  └────────────────┘  └────────────────┘      │
│  ◄──────────── 3-column grid, gap: 24px ────────────────►         │
│                                                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ divider ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─          │
│                                                                     │
│  Your first multi-agent workflow             ◄─ sub-heading        │
│                                                                     │
│  ┌─ Terminal ───────────────────────────────────────────────┐      │
│  │  $ maestro task create --title "Build authentication"    │      │
│  │  ✔ Task created: task_abc123                             │      │
│  │                                                          │      │
│  │  $ maestro task create --title "JWT" --parent task_abc123│      │
│  │  $ maestro task create --title "Login" --parent task_abc │      │
│  │                                                          │      │
│  │  $ maestro session spawn --task <jwt> --role worker      │      │
│  │  $ maestro session spawn --task <login> --role worker    │      │
│  │                                                          │      │
│  │  $ maestro session list                                  │      │
│  │  Both agents work in parallel...                         │      │
│  └──────────────────────────────────────────────────────────┘      │
│  ◄──────────── max-width: 720px, centered ──────────────►         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout:**
- Container: `max-width: 1200px`, centered
- Two sub-sections stacked:
  1. **Quick-start steps**: 3-column grid
  2. **First workflow**: centered terminal block

**Step cards:**
- `display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px`
- Each card:
  - Step number: large circled number (①②③), `--text-2xl`, `--color-accent`
  - Title: `--text-xl`, weight 600
  - Code block: `.code-block` component, `--text-sm`
  - Description: `--text-sm`, `--color-text-2`
  - Background: `--color-surface-1`
  - Border: `1px solid --color-border`, radius `--radius-lg`
  - Padding: `32px`

**First workflow:**
- Terminal code block (`.code-terminal`), max-width 720px, centered
- Same terminal chrome as section 3.6

**Responsive:**
- Steps: 1 col on mobile (stacked vertically)
- Terminal: full width with horizontal overflow

### 3.8 CTA Section

```
┌─────────────────────────────────────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░ gradient background ░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░                                                          ░░  │
│  ░░   Stop managing agents.                                  ░░  │
│  ░░   Start orchestrating them.         ◄─ h2, text-3xl     ░░  │
│  ░░                                                          ░░  │
│  ░░   Maestro is open source and runs                        ░░  │
│  ░░   entirely on your machine...       ◄─ text-lg, text-2  ░░  │
│  ░░                                                          ░░  │
│  ░░          [Get Started]  [Star on GitHub]                 ░░  │
│  ░░           primary btn    secondary btn                   ░░  │
│  ░░                                                          ░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout:**
- Full viewport width (breaks out of container)
- Content: `max-width: 720px`, centered
- Text alignment: center
- Vertical padding: `96px` (--space-24)

**Background:**
- Gradient: `linear-gradient(135deg, rgba(108, 99, 255, 0.08) 0%, rgba(0, 212, 170, 0.06) 100%)`
- Over: `--color-surface-1`
- Border-top and border-bottom: `1px solid --color-border`

**CTA buttons:**
- Same primary/secondary pair as hero
- `display: flex; gap: 16px; justify-content: center`
- Margin-top: `32px` from description text

### 3.9 Footer

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ◆ Maestro                                                         │
│  Multi-agent orchestration                                         │
│  for developers.                             ◄─ tagline            │
│                                                                     │
│  Product        Resources        Community                         │
│  ─────────      ──────────       ──────────                        │
│  Desktop App    Getting Started  GitHub Discussions                 │
│  CLI            Architecture     Contributing Guide                │
│  Server & API   GitHub Repo      License (AGPL-3.0)               │
│  Documentation  Changelog                                          │
│                                                                     │
│  ───────────────────────────────────────────────────────────        │
│  © 2025 Maestro. Open-source under AGPL-3.0.                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout:**
- Container: `max-width: 1200px`, centered
- Top row: `display: grid; grid-template-columns: 1.5fr repeat(3, 1fr); gap: 48px`
  - Col 1 (wide): Logo + tagline
  - Cols 2-4: Link groups
- Bottom row: copyright line, separated by `--color-divider` border-top

**Styling:**
- Background: `--color-bg-deep`
- Padding: `64px max(24px, 5vw) 32px`
- Link group titles: `--text-xs`, uppercase, `--font-mono`, `--color-text-muted`, `letter-spacing: 0.12em`, `margin-bottom: 16px`
- Links: `--text-sm`, `--color-text-2`, hover → `--color-text`
- Link gap: `12px` vertical
- Copyright: `--text-xs`, `--color-text-muted`

**Responsive (≤768px):**
- `grid-template-columns: repeat(2, 1fr)` — logo+tagline spans full width above, then 2-col link groups
- At ≤480px: single column, all stacked

---

## 4. Interactive Elements

### 4.1 Scroll-Triggered Animations

| Element             | Animation             | Direction     | Duration | Delay    | Trigger          |
| ------------------- | --------------------- | ------------- | -------- | -------- | ---------------- |
| Hero badges         | fade-up               | Y: 24→0       | 500ms    | 0ms      | page load        |
| Hero headline       | fade-up               | Y: 24→0       | 500ms    | 100ms    | page load        |
| Hero lede           | fade-up               | Y: 24→0       | 500ms    | 200ms    | page load        |
| Hero CTAs           | fade-up               | Y: 24→0       | 500ms    | 300ms    | page load        |
| Section eyebrow     | fade-up               | Y: 16→0       | 500ms    | 0ms      | 15% intersect    |
| Section title       | fade-up               | Y: 16→0       | 500ms    | 80ms     | 15% intersect    |
| Section description | fade-up               | Y: 16→0       | 500ms    | 160ms    | 15% intersect    |
| Pillar cards        | fade-up (staggered)   | Y: 24→0       | 500ms    | n×80ms   | 15% intersect    |
| Coord panel 1       | slide-from-left       | X: -32→0      | 500ms    | 0ms      | 15% intersect    |
| Coord panel 2       | fade-up               | Y: 24→0       | 500ms    | 0ms      | 15% intersect    |
| Task tree visual    | scale-up              | 0.95→1        | 500ms    | 0ms      | 15% intersect    |
| Feature mini-cards  | fade-up (staggered)   | Y: 24→0       | 500ms    | n×80ms   | 15% intersect    |
| Teams visual        | slide-from-left       | X: -32→0      | 500ms    | 0ms      | 15% intersect    |
| Terminal mockup     | scale-up              | 0.95→1        | 500ms    | 0ms      | 15% intersect    |
| Get started steps   | fade-up (staggered)   | Y: 24→0       | 500ms    | n×120ms  | 15% intersect    |
| CTA section         | fade-up               | Y: 16→0       | 500ms    | 0ms      | 15% intersect    |

**Implementation approach:**
- Use `IntersectionObserver` with `threshold: 0.15` and `rootMargin: "0px 0px -60px 0px"`
- Add `.visible` class on intersection → triggers CSS transition
- Unobserve after first trigger (animate once)
- Use CSS custom property `--stagger-index` for stagger delays
- All animations respect `prefers-reduced-motion: reduce` (instant display, no motion)

### 4.2 Hover States

| Element          | Hover Effect                                              | Transition                    |
| ---------------- | --------------------------------------------------------- | ----------------------------- |
| Primary button   | `translateY(-1px)`, glow shadow intensifies               | 200ms `--ease-out`            |
| Secondary button | `translateY(-1px)`, bg → accent-muted, border brightens   | 200ms `--ease-out`            |
| Ghost button     | text → `--color-text`, bg → `rgba(255,255,255,0.06)`      | 120ms `--ease-smooth`         |
| Feature card     | `translateY(-4px)`, shadow → card-hover, border brightens | 350ms `--ease-out`            |
| Mini card        | `translateY(-2px)`, border brightens                      | 200ms `--ease-out`            |
| Nav link         | text → `--color-text`, bg → `rgba(255,255,255,0.06)`      | 120ms `--ease-smooth`         |
| Footer link      | text → `--color-text`                                     | 120ms `--ease-smooth`         |
| Card shimmer     | top-border gradient fades in (opacity 0→1)                | 350ms `--ease-smooth`         |

### 4.3 Navigation Active State

- Uses Intersection Observer on each `<section>` element
- When a section occupies >30% of viewport, its nav link gets `.active` class
- Active link: `color: --color-text`, `background: rgba(255,255,255,0.08)`
- Smooth scroll on nav link click: `scroll-behavior: smooth` + `scroll-margin-top: 80px` on sections

### 4.4 Hero Background Animation

- Three gradient orbs (radial gradients) in absolute-positioned layer
- `animation: glow-drift 15s ease-in-out infinite`
- Orbs slowly shift position (5% movement range) and opacity (0.85-1.0)
- Purely decorative, behind all content, `pointer-events: none`
- Disabled under `prefers-reduced-motion`

### 4.5 Terminal Typing Animation (Optional Enhancement)

- Applied to terminal mockup in Terminal section
- Progressive reveal: lines appear one at a time
- Each line appears with a brief delay (200ms between lines)
- Characters within a line can optionally type at ~40ms intervals
- Trigger: only runs when terminal enters viewport (Intersection Observer)
- Only plays once
- Falls back to fully-visible static content under `prefers-reduced-motion`

---

## 5. Responsive Strategy

### 5.1 Breakpoints

| Name     | Width     | Description                                           |
| -------- | --------- | ----------------------------------------------------- |
| `sm`     | ≤640px    | Mobile portrait — single column everything            |
| `md`     | 641-768px | Mobile landscape / small tablet — nav collapses       |
| `lg`     | 769-1024px| Tablet — 2-column grids, reduced spacing              |
| `xl`     | 1025-1280px| Desktop — full layout                                |
| `2xl`    | >1280px   | Wide desktop — max-width container constrains content |

### 5.2 Section Adaptation by Breakpoint

#### Hero
| Breakpoint | Adaptation                                                        |
| ---------- | ----------------------------------------------------------------- |
| Desktop    | Full viewport, 800px content, center-aligned, all animations     |
| Tablet     | Same layout, text slightly tighter (clamp handles sizing)         |
| Mobile     | Padding reduces to `64px 20px`, badges wrap to 2 rows if needed   |
|            | CTAs stack vertically, full-width buttons                         |

#### Core Pillars
| Breakpoint | Grid                                                              |
| ---------- | ----------------------------------------------------------------- |
| Desktop    | 4 columns (`minmax(280px, 1fr)`)                                  |
| Tablet     | 2 columns (auto-fit handles this)                                 |
| Mobile     | 1 column                                                          |

#### Coordination
| Breakpoint | Layout                                                            |
| ---------- | ----------------------------------------------------------------- |
| Desktop    | 55/45 split grid (alternating)                                    |
| Tablet     | Same split but tighter (reduce gap to 32px)                       |
| Mobile     | Single column, text above visual in both panels                   |

#### Tasks
| Breakpoint | Layout                                                            |
| ---------- | ----------------------------------------------------------------- |
| Desktop    | Task tree centered, 5-col feature grid below                      |
| Tablet     | Task tree full-width, 3-col feature grid                          |
| Mobile     | Task tree full-width, 1-col feature stack                         |

#### Teams
| Breakpoint | Layout                                                            |
| ---------- | ----------------------------------------------------------------- |
| Desktop    | 45/55 split (visual left, text right)                             |
| Tablet     | Same split with reduced gap                                       |
| Mobile     | Single column, visual above text                                  |

#### Terminal
| Breakpoint | Layout                                                            |
| ---------- | ----------------------------------------------------------------- |
| Desktop    | Terminal centered (720px), 4-col feature grid, callout            |
| Tablet     | Terminal full-width, 2-col feature grid                           |
| Mobile     | Terminal full-width (horizontal scroll if needed), 1-col features |

#### Getting Started
| Breakpoint | Layout                                                            |
| ---------- | ----------------------------------------------------------------- |
| Desktop    | 3-col step cards, centered terminal block                         |
| Tablet     | 3-col maintained (cards compress)                                 |
| Mobile     | 1-col stacked steps, full-width terminal                          |

#### CTA
| Breakpoint | Adaptation                                                        |
| ---------- | ----------------------------------------------------------------- |
| Desktop    | Center-aligned, 720px max content                                 |
| Mobile     | Tighter padding, CTAs stack vertically                            |

#### Footer
| Breakpoint | Grid                                                              |
| ---------- | ----------------------------------------------------------------- |
| Desktop    | 4 columns (1.5fr + 3×1fr)                                        |
| Tablet     | 2 columns (logo spans full, links in 2-col grid)                 |
| Mobile     | 1 column, everything stacked                                     |

### 5.3 Mobile-Specific Patterns

1. **Touch targets**: All interactive elements ≥44px minimum tap height
2. **Horizontal scroll**: Terminal/code blocks use `overflow-x: auto` with `-webkit-overflow-scrolling: touch`
3. **Text sizing**: Fluid type via `clamp()`:
   - Hero h1: `clamp(2rem, 5vw + 1rem, 3.5rem)`
   - Section h2: `clamp(1.75rem, 3vw + 0.5rem, 2.5rem)`
4. **Spacing reduction**: Section padding drops from `96px` → `64px` vertical
5. **Full-width buttons**: CTA buttons stretch to `width: 100%` on mobile, stacked vertically with `gap: 12px`

---

## 6. User Journey

### Primary Flow: Land → Understand → Evaluate → Get Started

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  ARRIVE  │────►│  ORIENT  │────►│  EXPLORE  │────►│ EVALUATE │────►│  CONVERT │
│          │     │          │     │           │     │          │     │          │
│ Hero     │     │ Pillars  │     │ Coord /   │     │ Terminal │     │ CTA /    │
│ 5 sec    │     │ 15 sec   │     │ Tasks /   │     │ Get Start│     │ GitHub   │
│          │     │          │     │ Teams     │     │          │     │          │
│ Goal:    │     │ Goal:    │     │ Goal:     │     │ Goal:    │     │ Goal:    │
│ Hook +   │     │ Scope    │     │ Depth for │     │ See it   │     │ Remove   │
│ orient   │     │ what it  │     │ evaluators│     │ working  │     │ friction │
│          │     │ is       │     │           │     │          │     │          │
└─────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### Journey Touchpoints

1. **Arrive (0-5s)** — Hero section
   - User sees headline + 3 trust badges (Open Source, Multi-Agent, Local-First)
   - Immediate clarity: "This orchestrates AI agents"
   - Two clear paths: "Get Started" (action) or "View on GitHub" (verify)

2. **Orient (5-20s)** — Core Pillars
   - Scans 4 cards to understand scope: Desktop App + Server + CLI + Coordination
   - Realizes this is a full platform, not just a library
   - Card descriptions provide enough detail to decide whether to keep reading

3. **Explore (20-60s)** — Coordination, Tasks, Teams
   - For evaluators who want depth before committing
   - Coordinator/worker diagram shows how multi-agent actually works
   - Task tree shows concrete hierarchy example
   - Teams section shows reusable agent identities
   - Each section builds on the previous — increasing specificity

4. **Evaluate (60-90s)** — Terminal, Getting Started
   - Terminal mockup shows real CLI output — proof it works
   - Getting Started shows 3-step install — proof it's simple
   - First workflow example shows the product in action

5. **Convert** — CTA + Footer
   - Final CTA with emotional hook: "Stop managing agents. Start orchestrating them."
   - Two conversion paths: Get Started (try it) or Star on GitHub (bookmark for later)
   - Footer provides comprehensive links for deeper exploration

### Secondary Flows

- **Returning visitor**: Scrolls directly to Get Started via nav link
- **GitHub-first user**: Clicks "View on GitHub" from hero, evaluates repo, returns
- **Deep evaluator**: Uses nav to jump between Coordination/Tasks/Teams sections
- **Mobile browser**: Same flow, but condensed — hero CTA is prominently full-width

---

## 7. Scroll & Content Pacing

### Section Heights (Approximate)

| Section        | Desktop Height | Content Density | Scroll Feel          |
| -------------- | -------------- | --------------- | -------------------- |
| Hero           | 100vh          | Low             | Expansive, breathing |
| Pillars        | ~600px         | Medium          | Scannable            |
| Coordination   | ~900px         | High            | Detailed, two panels |
| Tasks          | ~700px         | Medium          | Visual + list        |
| Teams          | ~600px         | Medium          | Split visual + text  |
| Terminal       | ~800px         | Medium-High     | Terminal + grid      |
| Getting Started| ~700px         | Medium          | Steps + terminal     |
| CTA            | ~300px         | Low             | Punchy, decisive     |
| Footer         | ~250px         | Low             | Reference links      |

**Total scroll depth:** ~5,500px on desktop (comfortable, not exhausting)

### Pacing Rules

1. **High-density sections** (Coordination, Terminal) are followed by **lower-density sections** — prevents fatigue
2. **Visual elements** (diagrams, terminals, task trees) break up text-heavy areas
3. **Each section has one clear takeaway** — no section tries to say everything
4. **The page ends with action**, not information — CTA is the penultimate section

---

## 8. Accessibility Requirements

1. **Skip navigation link**: Hidden link at page top, visible on focus → jumps to `#pillars` (main content)
2. **Focus management**: All interactive elements have visible focus rings (`--color-border-focus`)
3. **Color contrast**: All text meets WCAG AA:
   - `--color-text` (#EDEDF0) on `--color-bg` (#0a0c10): ratio ≥15:1
   - `--color-text-2` (#B0B3C0) on `--color-bg`: ratio ≥8:1
   - `--color-text-muted` (#6B6F80) on `--color-bg`: ratio ≥4.5:1
4. **Motion**: All animations disabled under `prefers-reduced-motion: reduce`
5. **Semantic HTML**:
   - `<header>` for hero
   - `<nav>` for navigation
   - `<main>` wrapping all content sections
   - `<section>` with `aria-label` for each named section
   - `<footer>` for footer
6. **Keyboard navigation**: Tab order follows visual order, nav links are keyboard-navigable
7. **Image alternatives**: All decorative SVGs/diagrams have `aria-hidden="true"`, informational visuals have descriptive `aria-label`

---

## 9. Performance Considerations

1. **Font loading**: Preload Inter (wght 400-800) and JetBrains Mono (400-600) with `font-display: swap`
2. **Images**: No raster images in v1 — all visuals are CSS/SVG/HTML
3. **Animations**: CSS-only where possible, JS only for Intersection Observer triggers
4. **Code splitting**: Not needed for single-page, but lazy-load terminal typing animation
5. **Critical CSS**: Hero section styles should be inlined or loaded first
6. **Bundle target**: < 100KB total JS (React + app code), < 50KB CSS

---

## 10. Media Placeholders

Every placeholder below should be filled with actual media later. Placeholder elements in the implementation should use `--color-surface-2` background with a centered label describing what goes there.

### Catalog

| ID     | Section        | Location in Layout                        | Media Type  | Aspect Ratio | Dimensions (approx) | Description                                                                                                             |
| ------ | -------------- | ----------------------------------------- | ----------- | ------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| MP-01  | Hero           | Below CTA buttons, above fold boundary    | Video/GIF   | 16:9         | 800×450px            | **Hero demo reel**: 10-15s loop showing Maestro desktop app — quick cuts of task board, terminal sessions, real-time session monitoring. Should convey "full control plane" at a glance. |
| MP-02  | Core Pillars   | Inside "Desktop App" card, below title    | Screenshot  | 16:10        | 560×350px            | **Screenshot: Maestro desktop app** — Full workspace showing terminal pane, task board sidebar, and session list. Dark theme, populated with real tasks. |
| MP-03  | Core Pillars   | Inside "Server & API" card, below title   | Screenshot  | 16:10        | 560×350px            | **Screenshot: Maestro API / session timeline** — Session detail view showing timeline of progress reports, status transitions, and linked tasks. |
| MP-04  | Core Pillars   | Inside "CLI" card, below title            | Screenshot  | 4:3          | 480×360px            | **Screenshot: Terminal showing CLI commands** — `maestro task tree` or `maestro status` output with colored status indicators. Real terminal, not mockup. |
| MP-05  | Core Pillars   | Inside "Coordination" card, below title   | Screenshot  | 16:10        | 560×350px            | **Screenshot: Multi-session view** — Maestro UI showing 3+ active sessions working in parallel, with status chips and progress indicators visible. |
| MP-06  | Coordination   | Panel 1 visual zone (right side)          | Video/GIF   | 1:1          | 480×480px            | **Demo: Coordinator spawning workers** — 8-12s clip showing coordinator session creating subtasks and spawning 2 worker sessions. Shows the delegation flow in action. |
| MP-07  | Coordination   | Panel 2 visual zone (left side)           | Screenshot  | 4:3          | 520×390px            | **Screenshot: Real-time monitoring view** — Session list showing mixed states: active (green dot), blocked (amber), completed (checkmark). With progress percentages or status text visible. |
| MP-08  | Tasks          | Task tree visual zone (top center)        | Screenshot  | 3:4          | 420×560px            | **Screenshot: Task board kanban view** — Kanban columns (todo, in-progress, in-review, completed) populated with realistic tasks. Shows hierarchy indicators and session links. |
| MP-09  | Tasks          | Alternative: beside feature grid          | Video/GIF   | 16:9         | 640×360px            | **Demo: Task lifecycle** — 10s clip showing a task moving from creation → agent assignment → progress updates → completion. Real UI, not simulated. |
| MP-10  | Teams          | Team structure visual zone (left side)    | Screenshot  | 3:4          | 420×560px            | **Screenshot: Team member management** — Team view showing leader + members with avatars, roles, mode badges. Ideally showing the team member detail/edit modal. |
| MP-11  | Teams          | Alternative: below feature list           | Video/GIF   | 16:9         | 640×360px            | **Demo: Spawning with team member** — 8s clip showing session spawn with `--team-member-id`, and the session inheriting role/identity from the team member config. |
| MP-12  | Terminal       | Terminal mockup zone (centered)           | Video/GIF   | 16:9         | 720×405px            | **Demo: Live terminal session** — 12-15s recording of actual Maestro terminal interaction: creating a task, spawning a session, watching real-time output. Should feel authentic, not staged. |
| MP-13  | Terminal       | Alternative to or alongside mockup        | Screenshot  | 16:9         | 720×405px            | **Screenshot: Session log viewer** — Session log modal showing execution transcript with timestamps, command outputs, and status markers. Shows the "full transparency" value prop. |
| MP-14  | Getting Started| Below "first workflow" section            | Video/GIF   | 16:9         | 720×405px            | **Demo: Complete first workflow** — 20-30s screencast showing the 3-step install + first multi-agent workflow running. End state: two agents working in parallel visible in UI. |
| MP-15  | Hero           | Behind/around hero text (decorative)      | Animation   | N/A          | Full-width           | **Background animation: Agent orchestration visual** — Abstract SVG/CSS animation showing nodes connecting, tasks flowing between agents. Subtle, non-distracting. If too complex, fall back to gradient mesh only. |

### Placeholder Implementation Guide

For each placeholder in the implementation, render:

```
┌────────────────────────────────────────────┐
│                                            │
│         [icon: image/video/gif]            │
│                                            │
│    "Screenshot: Maestro task board..."     │  ◄─ label from Description column
│                                            │
│         560 × 350                          │  ◄─ dimensions
│                                            │
└────────────────────────────────────────────┘
  background: --color-surface-2
  border: 1px dashed --color-border
  border-radius: --radius-lg
  display: flex, align-items: center, justify-content: center
  color: --color-text-muted
  font-family: --font-mono
  font-size: --text-xs
```

### Priority Order for Media Capture

1. **MP-01** (Hero demo) — First impression, highest impact
2. **MP-12** (Terminal demo) — Shows the product actually working
3. **MP-14** (Getting Started demo) — Removes adoption friction
4. **MP-08** (Task board) — Core feature visualization
5. **MP-06** (Coordinator demo) — Key differentiator
6. **MP-02** (Desktop screenshot) — Establishes product category
7. Remaining items in any order

### Media Production Notes

- All screenshots/recordings should use the Maestro dark theme
- Terminal recordings: use a clean terminal profile (no custom prompts that distract)
- Recordings should be captured at 2x resolution for retina displays
- GIFs: optimize to < 2MB each, use efficient palettes
- Videos: MP4 with H.264, < 5MB each, autoplay muted with loop
- All media containers should have `border-radius: --radius-lg` to match card styling
- Add subtle `--shadow-card` to media containers for depth

---

*End of UX & Page Architecture — v1.0*
