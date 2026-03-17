# Maestro — Visual Design System

> Dark-first, developer-tool aesthetic. Inspired by Linear, Vercel, and Raycast.
> Every value is final and directly implementable.

---

## 1. Color Palette

### Backgrounds (Dark Theme)

| Token                | Hex         | Usage                              |
| -------------------- | ----------- | ---------------------------------- |
| `--color-bg-deep`    | `#050608`   | Page root / absolute deepest       |
| `--color-bg`         | `#0a0c10`   | Primary page background            |
| `--color-bg-raised`  | `#0f1117`   | Slightly raised surfaces (nav)     |
| `--color-bg-overlay` | `#13161e`   | Modals, dropdown backgrounds       |

### Surfaces / Cards

| Token                   | Hex                          | Usage                              |
| ----------------------- | ---------------------------- | ---------------------------------- |
| `--color-surface-1`     | `#141720`                    | Primary card / panel background    |
| `--color-surface-2`     | `#191d28`                    | Nested card / secondary surface    |
| `--color-surface-3`     | `#1e2230`                    | Hover state for cards              |
| `--color-surface-glass` | `rgba(255, 255, 255, 0.03)`  | Frosted glass panels               |

### Accent Colors

| Token                  | Hex       | Usage                                    |
| ---------------------- | --------- | ---------------------------------------- |
| `--color-accent`       | `#6C63FF` | Primary accent — buttons, links, focus   |
| `--color-accent-hover` | `#8078FF` | Hovered accent elements                  |
| `--color-accent-muted` | `rgba(108, 99, 255, 0.15)` | Accent tint backgrounds     |
| `--color-accent-2`     | `#00D4AA` | Secondary accent — badges, success tint  |
| `--color-accent-3`     | `#FF6B6B` | Tertiary accent — alerts, warnings       |
| `--color-accent-warm`  | `#F5A623` | Warm accent — highlights, featured tags  |

### Text

| Token                | Hex                          | Usage                             |
| -------------------- | ---------------------------- | --------------------------------- |
| `--color-text`       | `#EDEDF0`                    | Primary headings, body text       |
| `--color-text-2`     | `#B0B3C0`                    | Secondary body text               |
| `--color-text-muted` | `#6B6F80`                    | Captions, placeholders, disabled  |
| `--color-text-link`  | `#6C63FF`                    | Inline links (matches accent)     |
| `--color-text-on-accent` | `#FFFFFF`                | Text on accent-colored backgrounds |

### Borders & Separators

| Token                 | Hex                          | Usage                    |
| --------------------- | ---------------------------- | ------------------------ |
| `--color-border`      | `rgba(255, 255, 255, 0.08)`  | Default subtle border   |
| `--color-border-hover`| `rgba(255, 255, 255, 0.14)`  | Hovered border           |
| `--color-border-focus`| `rgba(108, 99, 255, 0.5)`    | Focus ring border        |
| `--color-divider`     | `rgba(255, 255, 255, 0.06)`  | Horizontal separators    |

### Status Colors

| Token                   | Hex       | Usage              |
| ----------------------- | --------- | ------------------ |
| `--color-success`       | `#00D4AA` | Success states     |
| `--color-success-muted` | `rgba(0, 212, 170, 0.12)` | Success bg  |
| `--color-warning`       | `#F5A623` | Warning states     |
| `--color-warning-muted` | `rgba(245, 166, 35, 0.12)` | Warning bg |
| `--color-error`         | `#FF6B6B` | Error states       |
| `--color-error-muted`   | `rgba(255, 107, 107, 0.12)` | Error bg  |
| `--color-info`          | `#6C63FF` | Info states        |
| `--color-info-muted`    | `rgba(108, 99, 255, 0.12)` | Info bg    |

### Gradients

```css
/* Hero background glow — subtle radiating orbs */
--gradient-hero-glow:
  radial-gradient(ellipse 60% 50% at 20% 10%, rgba(108, 99, 255, 0.12), transparent),
  radial-gradient(ellipse 50% 40% at 80% 5%, rgba(0, 212, 170, 0.08), transparent),
  radial-gradient(ellipse 40% 50% at 50% 90%, rgba(245, 166, 35, 0.06), transparent);

/* CTA / feature section accent gradient */
--gradient-accent:
  linear-gradient(135deg, #6C63FF 0%, #00D4AA 100%);

/* Card hover shimmer (top border only) */
--gradient-card-shimmer:
  linear-gradient(90deg, transparent 0%, rgba(108, 99, 255, 0.4) 50%, transparent 100%);

/* Text gradient for hero heading */
--gradient-text:
  linear-gradient(135deg, #EDEDF0 0%, #6C63FF 50%, #00D4AA 100%);

/* Subtle noise overlay */
--gradient-noise: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E");

/* Button primary gradient */
--gradient-button-primary:
  linear-gradient(135deg, #6C63FF 0%, #5A52E0 100%);

/* Background mesh (page-level decorative) */
--gradient-mesh:
  radial-gradient(circle at 15% 25%, rgba(108, 99, 255, 0.08) 0%, transparent 50%),
  radial-gradient(circle at 85% 15%, rgba(0, 212, 170, 0.06) 0%, transparent 40%),
  radial-gradient(circle at 50% 80%, rgba(245, 166, 35, 0.04) 0%, transparent 45%);
```

---

## 2. Typography

### Font Families

```css
--font-display: "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif;
--font-body:    "Inter", "SF Pro Text", system-ui, -apple-system, sans-serif;
--font-mono:    "JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", monospace;
```

**Google Fonts import:**
```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap
```

### Type Scale

| Token            | Size       | Weight | Line Height | Letter Spacing | Usage                       |
| ---------------- | ---------- | ------ | ----------- | -------------- | --------------------------- |
| `--text-4xl`     | `3.5rem`   | 800    | 1.08        | `-0.03em`      | Hero headline               |
| `--text-3xl`     | `2.5rem`   | 700    | 1.12        | `-0.025em`     | Section headings            |
| `--text-2xl`     | `1.875rem` | 700    | 1.2         | `-0.02em`      | Sub-section headings        |
| `--text-xl`      | `1.5rem`   | 600    | 1.3         | `-0.015em`     | Card headings               |
| `--text-lg`      | `1.25rem`  | 500    | 1.5         | `-0.01em`      | Large body / lead paragraph |
| `--text-base`    | `1rem`     | 400    | 1.6         | `0`            | Default body text           |
| `--text-sm`      | `0.875rem` | 400    | 1.5         | `0`            | Secondary text, captions    |
| `--text-xs`      | `0.75rem`  | 500    | 1.4         | `0.02em`       | Eyebrow labels, badges      |

### Heading Styles

- **Display headings** (h1): `--font-display`, `--text-4xl`, weight 800. Can use `--gradient-text` with `background-clip: text`.
- **Section headings** (h2): `--font-display`, `--text-3xl`, weight 700, color `--color-text`.
- **Sub-headings** (h3): `--font-display`, `--text-2xl`, weight 700, color `--color-text`.
- **Card titles** (h4): `--font-display`, `--text-xl`, weight 600, color `--color-text`.
- **Eyebrow text**: `--font-mono`, `--text-xs`, weight 500, uppercase, color `--color-accent`, letter-spacing `0.12em`.

---

## 3. Spacing System

**Base unit: 4px**

| Token           | Value   |
| --------------- | ------- |
| `--space-0`     | `0`     |
| `--space-1`     | `4px`   |
| `--space-2`     | `8px`   |
| `--space-3`     | `12px`  |
| `--space-4`     | `16px`  |
| `--space-5`     | `20px`  |
| `--space-6`     | `24px`  |
| `--space-8`     | `32px`  |
| `--space-10`    | `40px`  |
| `--space-12`    | `48px`  |
| `--space-16`    | `64px`  |
| `--space-20`    | `80px`  |
| `--space-24`    | `96px`  |
| `--space-32`    | `128px` |

### Contextual Spacing Guide

- Card padding: `--space-6` (24px)
- Card gap in grid: `--space-6` (24px)
- Section vertical padding: `--space-20` to `--space-24` (80–96px)
- Section horizontal padding: `max(--space-6, 5vw)`
- Gap between section heading and content: `--space-12` (48px)
- Navigation padding: `--space-4` vertical, `--space-6` horizontal
- Button internal padding: `--space-3` vertical, `--space-6` horizontal

---

## 4. Design Tokens — CSS Custom Properties

```css
:root {
  /* ── Backgrounds ── */
  --color-bg-deep: #050608;
  --color-bg: #0a0c10;
  --color-bg-raised: #0f1117;
  --color-bg-overlay: #13161e;

  /* ── Surfaces ── */
  --color-surface-1: #141720;
  --color-surface-2: #191d28;
  --color-surface-3: #1e2230;
  --color-surface-glass: rgba(255, 255, 255, 0.03);

  /* ── Accent ── */
  --color-accent: #6C63FF;
  --color-accent-hover: #8078FF;
  --color-accent-muted: rgba(108, 99, 255, 0.15);
  --color-accent-2: #00D4AA;
  --color-accent-3: #FF6B6B;
  --color-accent-warm: #F5A623;

  /* ── Text ── */
  --color-text: #EDEDF0;
  --color-text-2: #B0B3C0;
  --color-text-muted: #6B6F80;
  --color-text-link: #6C63FF;
  --color-text-on-accent: #FFFFFF;

  /* ── Borders ── */
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-hover: rgba(255, 255, 255, 0.14);
  --color-border-focus: rgba(108, 99, 255, 0.5);
  --color-divider: rgba(255, 255, 255, 0.06);

  /* ── Status ── */
  --color-success: #00D4AA;
  --color-success-muted: rgba(0, 212, 170, 0.12);
  --color-warning: #F5A623;
  --color-warning-muted: rgba(245, 166, 35, 0.12);
  --color-error: #FF6B6B;
  --color-error-muted: rgba(255, 107, 107, 0.12);
  --color-info: #6C63FF;
  --color-info-muted: rgba(108, 99, 255, 0.12);

  /* ── Typography ── */
  --font-display: "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif;
  --font-body: "Inter", "SF Pro Text", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", monospace;

  --text-4xl: 3.5rem;
  --text-3xl: 2.5rem;
  --text-2xl: 1.875rem;
  --text-xl: 1.5rem;
  --text-lg: 1.25rem;
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
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* ── Shadows ── */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.5);
  --shadow-glow-accent: 0 0 30px rgba(108, 99, 255, 0.25);
  --shadow-glow-success: 0 0 30px rgba(0, 212, 170, 0.2);
  --shadow-card: 0 4px 16px rgba(0, 0, 0, 0.25);
  --shadow-card-hover: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(108, 99, 255, 0.12);

  /* ── Blur ── */
  --blur-sm: 8px;
  --blur-md: 16px;
  --blur-lg: 32px;
  --blur-xl: 64px;

  /* ── Transitions ── */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);
  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --duration-slow: 350ms;
  --duration-slower: 500ms;

  /* ── Layout ── */
  --content-max-width: 1200px;
  --content-narrow: 800px;
  --content-wide: 1400px;
  --nav-height: 64px;

  /* ── Gradients ── */
  --gradient-accent: linear-gradient(135deg, #6C63FF 0%, #00D4AA 100%);
  --gradient-accent-warm: linear-gradient(135deg, #6C63FF 0%, #F5A623 100%);
  --gradient-button-primary: linear-gradient(135deg, #6C63FF 0%, #5A52E0 100%);
  --gradient-text: linear-gradient(135deg, #EDEDF0 0%, #6C63FF 50%, #00D4AA 100%);
  --gradient-card-shimmer: linear-gradient(90deg, transparent, rgba(108, 99, 255, 0.3), transparent);
  --gradient-hero-glow:
    radial-gradient(ellipse 60% 50% at 20% 10%, rgba(108, 99, 255, 0.12), transparent),
    radial-gradient(ellipse 50% 40% at 80% 5%, rgba(0, 212, 170, 0.08), transparent),
    radial-gradient(ellipse 40% 50% at 50% 90%, rgba(245, 166, 35, 0.06), transparent);
  --gradient-mesh:
    radial-gradient(circle at 15% 25%, rgba(108, 99, 255, 0.08), transparent 50%),
    radial-gradient(circle at 85% 15%, rgba(0, 212, 170, 0.06), transparent 40%),
    radial-gradient(circle at 50% 80%, rgba(245, 166, 35, 0.04), transparent 45%);

  /* ── Font Rendering ── */
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## 5. Component Styles

### 5.1 Buttons

#### Primary Button

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--gradient-button-primary);
  color: var(--color-text-on-accent);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1;
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  box-shadow: var(--shadow-glow-accent);
  transition:
    transform var(--duration-normal) var(--ease-out),
    box-shadow var(--duration-normal) var(--ease-out),
    background var(--duration-fast) var(--ease-smooth);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 40px rgba(108, 99, 255, 0.35), 0 8px 20px rgba(0, 0, 0, 0.3);
  background: var(--color-accent-hover);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}
```

#### Secondary Button

```css
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: transparent;
  color: var(--color-accent);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1;
  border: 1px solid rgba(108, 99, 255, 0.3);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition:
    background var(--duration-normal) var(--ease-smooth),
    border-color var(--duration-normal) var(--ease-smooth),
    transform var(--duration-normal) var(--ease-out);
}

.btn-secondary:hover {
  background: var(--color-accent-muted);
  border-color: rgba(108, 99, 255, 0.5);
  transform: translateY(-1px);
}

.btn-secondary:active {
  transform: translateY(0);
  background: rgba(108, 99, 255, 0.2);
}
```

#### Ghost Button

```css
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: transparent;
  color: var(--color-text-2);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-smooth),
    background var(--duration-fast) var(--ease-smooth);
}

.btn-ghost:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.06);
}

.btn-ghost:active {
  background: rgba(255, 255, 255, 0.1);
}
```

### 5.2 Cards

```css
.card {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
  transition:
    transform var(--duration-slow) var(--ease-out),
    box-shadow var(--duration-slow) var(--ease-out),
    border-color var(--duration-normal) var(--ease-smooth);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card-hover);
  border-color: var(--color-border-hover);
}

/* Top shimmer border on hover (optional enhancement) */
.card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--gradient-card-shimmer);
  opacity: 0;
  transition: opacity var(--duration-slow) var(--ease-smooth);
}

.card:hover::before {
  opacity: 1;
}
```

**Card variants:**
- **Feature Card**: Same as `.card` but with `padding: var(--space-8)` and icon/emoji at top sized at 40px.
- **Glass Card**: Replace `background` with `var(--color-surface-glass)`, add `backdrop-filter: blur(var(--blur-md))`.

### 5.3 Navigation

```css
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: var(--nav-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 max(var(--space-6), 5vw);
  background: rgba(10, 12, 16, 0.8);
  backdrop-filter: blur(var(--blur-md));
  border-bottom: 1px solid var(--color-border);
  transition: background var(--duration-slow) var(--ease-smooth);
}

/* Logo area */
.nav-logo {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Navigation links */
.nav-links {
  display: flex;
  gap: var(--space-1);
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-link {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-muted);
  border-radius: var(--radius-md);
  transition:
    color var(--duration-fast) var(--ease-smooth),
    background var(--duration-fast) var(--ease-smooth);
}

.nav-link:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.06);
}

.nav-link.active {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.08);
}

/* Mobile nav: hamburger at 768px */
@media (max-width: 768px) {
  .nav-links {
    position: fixed;
    top: var(--nav-height);
    left: 0;
    right: 0;
    flex-direction: column;
    background: var(--color-bg-overlay);
    backdrop-filter: blur(var(--blur-lg));
    border-bottom: 1px solid var(--color-border);
    padding: var(--space-4);
    transform: translateY(-100%);
    opacity: 0;
    transition:
      transform var(--duration-slow) var(--ease-out),
      opacity var(--duration-slow) var(--ease-out);
  }

  .nav-links.open {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### 5.4 Code Blocks

```css
.code-block {
  background: var(--color-bg-deep);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--color-text-2);
  tab-size: 2;
}

/* Inline code */
.code-inline {
  background: rgba(108, 99, 255, 0.1);
  color: var(--color-accent);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: 0.85em;
  font-weight: 500;
}

/* Terminal-style code block */
.code-terminal {
  background: #0c0e12;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  line-height: 1.65;
  position: relative;
}

.code-terminal::before {
  content: "Terminal";
  position: absolute;
  top: 0;
  left: var(--space-5);
  transform: translateY(-50%);
  padding: 2px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
```

**Syntax highlighting token colors:**

| Token      | Color     |
| ---------- | --------- |
| Keyword    | `#C792EA` |
| String     | `#C3E88D` |
| Number     | `#F78C6C` |
| Comment    | `#546E7A` |
| Function   | `#82AAFF` |
| Operator   | `#89DDFF` |
| Variable   | `#EEFFFF` |
| Punctuation| `#89DDFF` |

### 5.5 Section Headings

```css
.section-heading {
  max-width: var(--content-narrow);
  margin-bottom: var(--space-12);
}

.section-eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-accent);
  margin-bottom: var(--space-4);
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.12;
  letter-spacing: -0.025em;
  margin: 0 0 var(--space-4);
}

.section-description {
  font-size: var(--text-lg);
  color: var(--color-text-2);
  line-height: 1.6;
  margin: 0;
}
```

### 5.6 Badges & Tags

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
}

.badge-accent {
  background: var(--color-accent-muted);
  color: var(--color-accent);
  border: 1px solid rgba(108, 99, 255, 0.2);
}

.badge-success {
  background: var(--color-success-muted);
  color: var(--color-success);
  border: 1px solid rgba(0, 212, 170, 0.2);
}

.badge-warning {
  background: var(--color-warning-muted);
  color: var(--color-warning);
  border: 1px solid rgba(245, 166, 35, 0.2);
}

.badge-neutral {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-2);
  border: 1px solid var(--color-border);
}
```

---

## 6. Effects & Animations

### 6.1 Box Shadows

| Token                    | Value                                                                           |
| ------------------------ | ------------------------------------------------------------------------------- |
| `--shadow-xs`            | `0 1px 2px rgba(0, 0, 0, 0.3)`                                                 |
| `--shadow-sm`            | `0 2px 8px rgba(0, 0, 0, 0.3)`                                                 |
| `--shadow-md`            | `0 8px 24px rgba(0, 0, 0, 0.4)`                                                |
| `--shadow-lg`            | `0 16px 48px rgba(0, 0, 0, 0.5)`                                               |
| `--shadow-glow-accent`   | `0 0 30px rgba(108, 99, 255, 0.25)`                                            |
| `--shadow-glow-success`  | `0 0 30px rgba(0, 212, 170, 0.2)`                                              |
| `--shadow-card`          | `0 4px 16px rgba(0, 0, 0, 0.25)`                                               |
| `--shadow-card-hover`    | `0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(108, 99, 255, 0.12)`          |

### 6.2 Backdrop Blur

| Token        | Value  |
| ------------ | ------ |
| `--blur-sm`  | `8px`  |
| `--blur-md`  | `16px` |
| `--blur-lg`  | `32px` |
| `--blur-xl`  | `64px` |

### 6.3 Border Radius Scale

| Token           | Value    | Usage                      |
| --------------- | -------- | -------------------------- |
| `--radius-xs`   | `4px`    | Inline code, tiny elements |
| `--radius-sm`   | `8px`    | Badges, small inputs       |
| `--radius-md`   | `12px`   | Buttons, code blocks       |
| `--radius-lg`   | `16px`   | Cards, panels              |
| `--radius-xl`   | `24px`   | Hero elements, modals      |
| `--radius-full` | `9999px` | Pills, avatars, toggles    |

### 6.4 Transition Timing

| Token              | Curve                               | Usage                           |
| ------------------ | ----------------------------------- | ------------------------------- |
| `--ease-out`       | `cubic-bezier(0.16, 1, 0.3, 1)`    | Most UI interactions (default)  |
| `--ease-in-out`    | `cubic-bezier(0.65, 0, 0.35, 1)`   | Modal open/close, page transitions |
| `--ease-spring`    | `cubic-bezier(0.34, 1.56, 0.64, 1)`| Bouncy — tooltips, popovers    |
| `--ease-smooth`    | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Colors, opacity fades           |

| Token              | Value   | Usage                                    |
| ------------------ | ------- | ---------------------------------------- |
| `--duration-fast`  | `120ms` | Hover color changes, opacity toggles     |
| `--duration-normal`| `200ms` | Button transforms, most interactions     |
| `--duration-slow`  | `350ms` | Card hover lift, nav transitions         |
| `--duration-slower`| `500ms` | Scroll reveal, section entrance          |

### 6.5 Scroll Reveal Animations

Use **Intersection Observer** with CSS classes. Elements start hidden and animate in when entering viewport.

```css
/* Base state — applied to elements before they're visible */
.reveal {
  opacity: 0;
  transform: translateY(24px);
}

/* Active state — applied via IntersectionObserver */
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity var(--duration-slower) var(--ease-out),
    transform var(--duration-slower) var(--ease-out);
}

/* Stagger children — apply --stagger-index as inline style */
.reveal.visible {
  transition-delay: calc(var(--stagger-index, 0) * 80ms);
}

/* Variant: slide from left */
.reveal-left {
  opacity: 0;
  transform: translateX(-32px);
}
.reveal-left.visible {
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity var(--duration-slower) var(--ease-out),
    transform var(--duration-slower) var(--ease-out);
}

/* Variant: scale up */
.reveal-scale {
  opacity: 0;
  transform: scale(0.95);
}
.reveal-scale.visible {
  opacity: 1;
  transform: scale(1);
  transition:
    opacity var(--duration-slower) var(--ease-out),
    transform var(--duration-slower) var(--ease-out);
}
```

**IntersectionObserver config:**

```js
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target); // animate once
      }
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
);
```

### 6.6 Hover Transitions

| Element          | Property                  | Duration         | Easing           |
| ---------------- | ------------------------- | ---------------- | ---------------- |
| Button           | `transform, box-shadow`   | `--duration-normal` | `--ease-out`  |
| Card             | `transform, box-shadow, border-color` | `--duration-slow` | `--ease-out` |
| Nav link         | `color, background`       | `--duration-fast`| `--ease-smooth`  |
| Badge            | `background`              | `--duration-fast`| `--ease-smooth`  |
| Icon button      | `color, transform`        | `--duration-fast`| `--ease-out`     |

### 6.7 Gradient Animation (Hero)

Slowly animate the hero glow orbs to create a living, breathing background:

```css
@keyframes glow-drift {
  0%, 100% {
    background-position: 0% 0%;
    opacity: 1;
  }
  33% {
    background-position: 5% -3%;
    opacity: 0.85;
  }
  66% {
    background-position: -3% 5%;
    opacity: 0.95;
  }
}

.hero-glow {
  position: absolute;
  inset: 0;
  background: var(--gradient-hero-glow);
  background-size: 120% 120%;
  animation: glow-drift 15s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}
```

### 6.8 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .reveal, .reveal-left, .reveal-scale {
    opacity: 1;
    transform: none;
  }
}
```

---

## 7. Layout Constraints

### Content Width

| Token                | Value    | Usage                              |
| -------------------- | -------- | ---------------------------------- |
| `--content-narrow`   | `800px`  | Text-heavy sections, blog posts    |
| `--content-max-width`| `1200px` | Standard content, feature grids    |
| `--content-wide`     | `1400px` | Full-width feature comparisons     |

### Grid

- Primary grid: `12 columns`, gutter `--space-6` (24px)
- Feature cards: `repeat(auto-fit, minmax(320px, 1fr))`
- Pillar grid (3-col): `repeat(auto-fit, minmax(280px, 1fr))`
- Two-column layout: `repeat(2, 1fr)` at desktop, `1fr` at mobile

### Breakpoints

| Name      | Value    | Usage                              |
| --------- | -------- | ---------------------------------- |
| `sm`      | `640px`  | Mobile landscape                   |
| `md`      | `768px`  | Tablet — nav collapses, 1-col grid |
| `lg`      | `1024px` | Desktop — full layout              |
| `xl`      | `1280px` | Wide desktop                       |
| `2xl`     | `1536px` | Ultra-wide                         |

### Section Padding

```css
.section {
  padding: var(--space-24) max(var(--space-6), 5vw);  /* 96px top/bottom */
}

@media (max-width: 768px) {
  .section {
    padding: var(--space-16) var(--space-5);  /* 64px 20px on mobile */
  }
}
```

### Navigation Height

- Desktop: `var(--nav-height)` = `64px`
- Content starts below nav: `padding-top: var(--nav-height)` on page wrapper

### Page Container

```css
.container {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 0 max(var(--space-6), 5vw);
}
```

---

## Appendix: Noise Overlay

Apply a subtle SVG noise texture at the page level for grain:

```css
.page::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E");
  opacity: 0.04;
  pointer-events: none;
  mix-blend-mode: overlay;
  z-index: 9999;
}
```

---

*End of Visual Design System — v1.0*
