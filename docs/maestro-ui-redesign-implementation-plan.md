# Maestro UI Redesign — Implementation Plan

**Status:** Draft for review
**Date:** 2026-05-31
**Scope:** `maestro-ui` (Tauri 2 · React 18 · Zustand)
**Source design system:** `maestro-design-system/` (unzipped from "Maestro Design System.zip")

---

## 1. Goal

Adopt the new Maestro design system — a **dark graphite "ink" canvas with a single warm amber "baton" accent**, Inter + JetBrains Mono, tight radii, hairline borders, an uppercase-mono micro-label motif, color-coded agent status, fast/mechanical motion, and Lucide stroke icons — across the existing desktop app, **without rewriting all 28k lines of CSS**.

The redesign is a **fresh, unified look**, not a reskin of the existing themes. It deliberately **retires the swappable multi-theme system** (Terminal / Material / Glass / Minimal × 6 colors each) in favor of one confident, opinionated identity.

---

## 2. The two systems, side by side

### 2.1 What the new system specifies (`maestro-design-system/`)

| Area | New system |
|---|---|
| **Canvas** | Cool, blue-leaning graphite ramp `--ink-900 #0a0c10` → `--ink-050`. Never pure black. Depth via layered surfaces (app → panel → card → raised), each one step lighter, plus a 1px inner top highlight. |
| **Accent** | **One** signature amber `--baton-500 #f5a524`. Used sparingly: primary button, live/active indicator, focus ring, logo, links. Only warm color in a cool world. |
| **Status** | Functional palette — green=running, amber=waiting, rose=blocked, blue=info, slate=idle. Always paired with a label. |
| **Agent hues** | 8 categorical hues (amber, teal, violet, rose, sky, lime, coral, pink) for concurrent agents/teams — dots, avatar rings, 3px left-border accents. |
| **Type** | Inter (UI/display) + JetBrains Mono (code/data/labels). Signature move: uppercase mono eyebrow — 11px / 600 / `0.14em` tracking / muted. |
| **Spacing** | 4px base grid (`--space-1`…`--space-16`). |
| **Radii** | Tight: 4 / 6 / 8 / 12 / 16 / pill. Engineered, not bubbly. |
| **Borders** | Hairline 1px `--border-1 #2a3140` does most separation work; shadows reserved for popovers/modals. |
| **Elevation** | Flat layered surfaces + inner-top highlight. Glow reserved for baton focus ring + live green dot only. |
| **Motion** | 120 / 180 / 280ms, `cubic-bezier(0.16,1,0.3,1)`. No bounce. |
| **Icons** | Lucide stroke icons, 1.5–2px, 24px grid. `--fg-4` rest → `--fg-2` hover → `--baton-500` active. PNGs only for 3rd-party brand logos (Claude/Codex/Gemini). |
| **Voice** | Plain, confident, sentence case, no emoji. Uppercase only for mono micro-labels. |
| **Layout** | 3-column shell: ~52px icon rail → collapsible context sidebar → center workspace → right "Spaces" panel. Fixed chrome, scrolling content. |

Token source of truth: `maestro-design-system/colors_and_type.css` (semantic vars `--bg-app`, `--bg-surface`, `--bg-raised`, `--bg-hover`, `--bg-active`, `--fg-1`…`--fg-4`, `--accent`, `--border-1`, etc.).

Reference kit: `maestro-design-system/ui_kits/desktop-app/` (React recreation of the exact target layout + `kit.css`).

### 2.2 What the app currently does (`maestro-ui/`)

- **Pure global CSS**, 53 files, ~28.3k lines, all `@import`ed from `src/styles.css`. No Tailwind/CSS-modules/CSS-in-JS. BEM-ish naming.
- **Theming via CSS variables driven by JS.** `useThemeStore` sets `data-style` + `data-theme` on `<html>` and writes `--theme-primary`, `--theme-primary-rgb`, `--theme-border`, `--theme-text`, etc. inline.
  - `src/styles-variables.css` — base vars + 4 **style personalities** (`html[data-style="…"]`) defining `--style-font-ui`, `--style-radius-*`, `--style-shadow-*`, `--style-surface-*`, `--style-transition`, `--style-backdrop`, etc.
  - `src/app/constants/themes.ts` — 4 styles × 6 color variants = 24 combos; `STYLE_THEMES`, `buildThemeId`, `parseThemeId`, `getColorVariant`.
  - `src/app/constants/teamColors.ts` — 8 categorical team colors (coral, teal, violet, gold, lime, hotpink, skyblue, orange).
- **Fonts already match:** self-hosted Inter + JetBrains Mono (4 weights each) in `src/assets/fonts/`, declared in `src/styles.css`.
- **Layout shell already matches the target topology** (V2 was already underway — see `UI-V2-DESIGN-PLAN.md`):
  - `src/App.tsx` → `ProjectTabBar`, `AppLeftPanel` (+ `IconRail`), `AppWorkspace`, `SpacesPanel`, `AppModals`.
  - `src/components/IconRail.tsx`, `AppLeftPanel.tsx`, `SpacesPanel.tsx`, `AppRightPanel.tsx`, `ProjectTabBar.tsx`.
- ~58 maestro components in `src/components/maestro/`; icons are **hand-rolled inline SVGs** (no icon library).

### 2.3 The core tension

The new system **wants one fixed identity**; the app is **built to swap 24**. Almost every one of the 28k CSS lines references `--theme-primary` / `--theme-primary-rgb` / `--style-*`. We must not hand-edit them all.

**Therefore the whole strategy is token remapping**: redefine what those existing variables *resolve to* so the bulk of the UI inherits the new look for free, then hand-polish the high-visibility surfaces.

---

## 3. Strategy

### 3.1 Guiding principle — remap, don't rewrite

Introduce the new design tokens as the **single source of truth**, then **alias the legacy variables onto them**. Existing CSS keeps working but renders in the new palette.

Concretely:

```css
/* NEW: src/styles-tokens.css — verbatim port of colors_and_type.css :root */
:root {
  --ink-900:#0a0c10; … --ink-050:#f5f7fb;
  --baton-500:#f5a524; --baton-400:#ffb845; --baton-600:#d4881a; …
  --signal-run:#34d399; --signal-wait:#f5a524; --signal-block:#fb7185; …
  --agent-amber:#f5a524; --agent-teal:#2dd4bf; … (8 hues)
  --bg-app:var(--ink-900); --bg-surface:var(--ink-850); --bg-raised:var(--ink-800);
  --fg-1:var(--ink-100); … --fg-4:var(--ink-400);
  --accent:var(--baton-500); --border-1:var(--ink-600); …
  /* + spacing, radii, shadow, motion scales */
}

/* LEGACY ALIASES — old names now point at new tokens */
:root {
  --bg:            var(--bg-app);
  --panel:         var(--bg-surface);
  --panel-2:       var(--bg-raised);
  --border:        var(--border-1);
  --border-subtle: rgba(255,255,255,0.04);
  --text:          var(--fg-1);
  --muted:         var(--fg-3);
  --accent:        var(--baton-500);
  --radius-control:var(--radius-sm);

  /* the big one: the whole app's accent now resolves to baton */
  --theme-primary:     var(--baton-500);
  --theme-primary-dim: var(--baton-600);
  --theme-primary-rgb: var(--baton-rgb);   /* 245,165,36 */
  --theme-border:      var(--border-1);
  --theme-text:        var(--fg-1);
  --theme-text-dim:    var(--fg-3);
}
```

And collapse the four `--style-*` personality blocks to a **single** new definition (graphite + Inter + tight radii + hairline borders + fast motion):

```css
:root {
  --style-font-ui:   var(--font-ui);     /* Inter */
  --style-font-code: var(--font-mono);   /* JetBrains Mono */
  --style-radius-sm: var(--radius-xs);   /* 4 */
  --style-radius-md: var(--radius-sm);   /* 6 */
  --style-radius-lg: var(--radius-md);   /* 8 */
  --style-radius-xl: var(--radius-lg);   /* 12 */
  --style-shadow-glow:  none;            /* glow is baton-only now */
  --style-shadow-hover: var(--shadow-sm);
  --style-shadow-card:  none;            /* borders, not shadow */
  --style-shadow-modal: var(--shadow-lg);
  --style-surface-1: var(--bg-app);
  --style-surface-2: var(--bg-surface);
  --style-surface-3: var(--bg-raised);
  --style-surface-hover:  var(--bg-hover);
  --style-surface-active: var(--bg-active);
  --style-letter-spacing: 0;             /* uppercase reserved for eyebrows */
  --style-text-transform: none;
  --style-transition: var(--dur-fast) var(--ease-out);
  --style-backdrop: none;
}
```

This single change flips the entire app from "neon terminal green/whatever" to "graphite + amber baton" in one file. Everything downstream (buttons, cards, modals, panels) inherits it.

### 3.2 Then retire the theme switcher

Because the identity is now fixed:

- `useThemeStore` stops writing per-variant colors; it either becomes a no-op or is reduced to managing `color-scheme` + zoom only.
- The theme picker UI (`ThemeSwitcher`, `styles-theme-switcher.css`, theme section in settings) is removed or hidden behind a feature flag.
- `themes.ts` is reduced to a single canonical theme (keep `teamColors.ts` → remap to the 8 `--agent-*` hues).
- `data-style`/`data-theme` attributes can stay (harmless) but only ever hold the one value.

> **Decision needed (D1):** fully delete the multi-theme system, or keep the plumbing and ship a single locked theme? Recommended: **keep plumbing, lock to one theme** in phase 1 (lowest risk, reversible), delete dead code in a later cleanup phase.

### 3.3 Hand-polish in priority order

Token remapping gets ~80% there but won't fix: glow-heavy terminal effects, uppercase-everything text, wrong radii baked as literals, and layout-specific chrome. Polish the **most-visible surfaces first** using the reference kit (`ui_kits/desktop-app/kit.css`) as the spec.

---

## 4. Phased plan

### Phase 0 — Foundations (no visible change yet)
1. Copy `maestro-design-system/colors_and_type.css` `:root` block into a new **`src/styles-tokens.css`** (strip the `@font-face` — fonts already exist in `styles.css`).
2. Add the **legacy-alias** block and the **single `--style-*`** block (§3.1).
3. Import `styles-tokens.css` **first** in `src/styles.css` (before `styles-variables.css` so aliases win; or merge into `styles-variables.css`).
4. Add Lucide: `bun add lucide-react` and create a thin `Icon` wrapper component to begin replacing inline SVGs incrementally.
5. **Checkpoint:** app builds, fonts unchanged, no regressions. Tokens available but not yet driving everything.

### Phase 1 — Flip the palette (the big visible win)
1. Repoint `--theme-*` and `--style-*` to the new tokens (§3.1). App goes graphite + amber globally.
2. Lock `useThemeStore` to the single theme; hide the theme switcher.
3. Sweep for **hardcoded colors** that bypass variables (grep for `#0`, `#1`, `rgba(0, 255`, neon hex, `box-shadow: 0 0` glows). Replace with tokens. Priority files by size/visibility:
   - `styles-sessions.css`, `styles-maestro-sessions-v2.css`, `styles-spaces-panel.css`, `styles-maestro-panel.css`, `styles-themed-components.css`, `styles-terminal-theme.css`, `styles-sidebar-redesign.css` (has CRT/scanline glow to remove), `styles-multi-project-board.css`.
4. Kill terminal-only effects that fight the new look: scanlines, CRT glow, `text-transform: uppercase` on body text (keep only on `.t-eyebrow`-style micro-labels), neon `box-shadow` glows.
5. **Checkpoint:** every screen is graphite + baton; no neon green/purple/glass left.

### Phase 2 — Component polish against the kit
Work surface by surface, matching `ui_kits/desktop-app/kit.css` + the JSX components. Suggested order (highest traffic first):
1. **Buttons / inputs / badges** — `styles-themed-components.css`. Match `.btn-primary` (baton fill, `--on-accent` text), `.btn-secondary`, `.btn-ghost`, focus ring `--glow-baton`, press `scale(0.98)`.
2. **Icon rail + sidebar** — `IconRail.tsx`, `styles-icon-rail.css`, `AppLeftPanel`, `styles-left-panel.css`, `styles-maestro-panel*.css`. 52px rail; active icon = baton; eyebrow section headers.
3. **Spaces panel + session cards** — `SpacesPanel.tsx`, `styles-spaces-panel.css`, `styles-sessions*.css`. Card = `--bg-raised` + 1px border + `--radius-md` + 3px left border in agent hue; live = pulsing green dot; status colors from `--signal-*`.
4. **Task items** — `TaskListItem`, `styles-task-list-*.css`, priority/status pickers. Priority chips, `#id` in mono, eyebrow meta.
5. **Command palette** — `styles-command-palette.css` vs kit `CommandPalette`. Grouped list, baton active row, `--shadow-pop`, `ESC`/`⌘K` kbd chips.
6. **Modals** — spawn/create-task/team-member modals + `styles-*-modal*.css`. `--bg-overlay` scrim, `--radius-lg`, `--shadow-lg`, eyebrow field labels, agent/role option cards.
7. **Top bar + status bar** — `ProjectTabBar.tsx` / `styles-project-tabs.css`. Project dots in agent hues, ⌘K command bar, baton Spawn button; bottom status bar (running count / tasks / branch / server·port).
8. **Terminal + editor** — `styles-terminal-theme.css`, xterm palette, Monaco theme. Align terminal ANSI/prompt colors to ink+baton+signal palette.

### Phase 3 — Iconography migration
- Replace inline SVGs with Lucide via the `Icon` wrapper, per the README mapping: `list-checks` (Tasks), `users` (Members), `git-merge` (Teams), `sparkles` (Skills), `list-ordered` (Lists), `folder-tree` (Files), `terminal`, `pen-tool` (Whiteboard), `git-branch`, `play`, `circle` (status).
- Keep PNG brand logos (Claude/Codex/Gemini) — copy from `maestro-design-system/assets/` if better than current.
- Sizes: 16 (dense) / 18 (buttons, rail) / 20 (toolbar) / 24 (empty states). Stroke 1.75, `currentColor`.

### Phase 4 — Cleanup & consolidation (optional, post-ship)
- Delete the dead multi-theme code (`themes.ts` variants, `ThemeSwitcher`, `styles-theme-switcher.css`, style-personality blocks) if D1 = delete.
- Consider consolidating the 53 CSS files into `src/styles/{tokens,layout,components,overlays}/` (non-blocking; large diff — do last).
- Add a lightweight design-tokens reference page (could reuse the `preview/` specimen cards).

---

## 5. File impact map

| File / area | Action | Phase |
|---|---|---|
| `src/styles-tokens.css` (**new**) | Port new tokens + legacy aliases + single `--style-*` block | 0–1 |
| `src/styles.css` | Import tokens first; fonts already present | 0 |
| `src/styles-variables.css` | Collapse 4 style blocks → 1; or supersede via aliases | 1 |
| `src/app/constants/themes.ts` | Reduce to single theme (or delete in P4) | 1/4 |
| `src/app/constants/teamColors.ts` | Remap 8 colors → `--agent-*` hues | 1 |
| `src/stores/useThemeStore.ts` | Lock to one theme / no-op color writes | 1 |
| `ThemeSwitcher` + `styles-theme-switcher.css` | Hide, then remove | 1/4 |
| `src/components/Icon*` (**new** Lucide wrapper) | Add; migrate inline SVGs | 0/3 |
| `styles-themed-components.css` | Buttons/inputs/badges polish | 2 |
| `styles-icon-rail.css`, `styles-left-panel.css`, `styles-maestro-panel*.css` | Rail + sidebar polish | 2 |
| `styles-spaces-panel.css`, `styles-sessions*.css` | Session cards polish | 2 |
| `styles-command-palette.css` | Palette polish | 2 |
| `styles-*-modal*.css` | Modals polish | 2 |
| `styles-terminal-theme.css` | Terminal palette | 2 |
| `styles-sidebar-redesign.css` | Strip CRT/scanline FX | 1 |
| `styles-multi-project-board.css` | Re-token (already mid-edit) | 1/2 |

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Hardcoded colors** that bypass variables won't flip with the alias trick. | Phase 1 grep sweep for hex/neon/`0 0 …px` glow literals; fix per file. |
| **Contrast/legibility** changes when neon → muted graphite text. | Verify `--fg-*` ramp against `--bg-*` surfaces on each surface; the new tokens are designed for this. |
| **Theme persistence** in localStorage holds a now-invalid theme id. | `useThemeStore` should ignore stored value and force the single theme; clear/migrate on load. |
| **Snapshot tests** (`prompt-composer` etc.) unrelated, but UI snapshot/visual diffs may churn. | Expect large CSS diff; review by screen, not by line. Test in running app. |
| **Big-bang regressions** across 53 files. | Phased: P0/P1 are global+reversible; P2 is incremental per-surface. Test the app in-browser at each checkpoint. |
| **Scope creep** into V2 layout work (Phase 2 of `UI-V2-DESIGN-PLAN.md`). | Keep layout-topology changes out of this redesign — topology already matches. This is visual only. |

---

## 7. Open decisions

- **D1 — Multi-theme system:** delete entirely vs. lock to one theme (keep plumbing). *Recommended: lock now, delete in P4.*
- **D2 — Lucide migration depth:** full replacement of all inline SVGs, or only rail/toolbar/common icons. *Recommended: common set first, opportunistic thereafter.*
- **D3 — CSS file consolidation:** do the 53→4 reorg now or never. *Recommended: defer (high churn, low user value).*
- **D4 — Light mode:** the new system is dark-first; is a light theme ever needed? *Assume no for now.*
- **D5 — Terminal ANSI palette:** how strictly to align xterm colors to the new signal palette vs. leave standard ANSI. *Recommended: align prompt/accent only, keep ANSI standard.*

---

## 8. Definition of done

- App renders graphite + amber baton on every screen; no neon/glass/multi-theme artifacts remain.
- Theme switcher is gone (or hidden); only the canonical identity ships.
- Buttons, cards, modals, command palette, rail, sidebar, spaces panel, task items match the reference kit within reasonable fidelity.
- Status uses `--signal-*`; agents/teams use the 8 `--agent-*` hues; focus uses the baton ring; only the live dot + baton glow.
- Icons are Lucide (common set minimum); brand logos remain PNG.
- `bun run build:ui` passes; app verified in-browser (golden paths: spawn session, browse tasks, command palette, open modal).

---

## 9. Appendix — token cross-reference (legacy → new)

| Legacy var | New token | Value |
|---|---|---|
| `--bg` | `--bg-app` / `--ink-900` | `#0a0c10` |
| `--panel` | `--bg-surface` / `--ink-850` | `#0e1117` |
| `--panel-2` | `--bg-raised` / `--ink-800` | `#131720` |
| `--border` | `--border-1` / `--ink-600` | `#2a3140` |
| `--text` | `--fg-1` / `--ink-100` | `#e4e8f0` |
| `--muted` | `--fg-3` / `--ink-300` | `#8b93a6` |
| `--accent`, `--theme-primary` | `--accent` / `--baton-500` | `#f5a524` |
| `--theme-primary-rgb` | `--baton-rgb` | `245, 165, 36` |
| `--radius-control` | `--radius-sm` | `6px` |
| terminal green `#00ff41` | (removed) | → baton |
| team colors (8) | `--agent-*` (8) | amber/teal/violet/rose/sky/lime/coral/pink |
