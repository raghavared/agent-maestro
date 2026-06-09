# FOUNDATION-DONE — Maestro Redesign Phase 0 (v2)

**Status:** ✅ Complete. This document is the contract for all 14 Phase-1 panel workers.
**Branch:** `maestro-redesign`
**Author:** 🧱 Redesign Foundation Engineer
**Build:** `bun run build:ui` passes clean (typecheck + Vite production build).

**v2 adds:** full `tiles.css` port (task tile `pn-tt*`, session tile `pn-st*`, `pn-team*`, `pn-kids`, `pn-av*` monograms, `pn-badge*`, `pn-toggle*`, `pn-docpill*`, `pn-actchip*`, `pn-stat*`, `pn-mini`, `pn-pop`/`pn-opt`); terminal `--pn-term-*` vars; 4 net-new primitives (`pn-btn--danger`, `pn-range`, `pn-mtabs--vert`, `pn-switch--danger`); new kit icons (`undo`, `volume`, `volumeOff`). See §8.

All values ported **verbatim** from `panel-redesign/theme.css`, `theme-dark.css`, `tiles.css`, `modals.css`, `kit.jsx`. The only non-verbatim additions are the explicitly coordinator-authorized net-new primitives in §8C and the `.pn-agent--init` fallback (§7) — every one sources colours from existing `--pn-*` tokens; nothing invented.

---

## 1. Files created

| File | Purpose |
|---|---|
| `maestro-ui/src/components/maestro/redesign/redesign-tokens.css` | All `--pn-*` design tokens (light + dark) + every `pn-*` component class from `theme.css`/`theme-dark.css` + `--pn-term-*` vars + net-new `pn-btn--danger`. |
| `maestro-ui/src/components/maestro/redesign/redesign-tiles.css` | All task-tile / session-tile / tree / avatar / badge / toggle classes from `tiles.css`. |
| `maestro-ui/src/components/maestro/redesign/redesign-modals.css` | All modal/form `pn-*` classes from `modals.css` + net-new `pn-range`, `pn-mtabs--vert`, `pn-switch--danger`. |
| `maestro-ui/src/components/maestro/redesign/kit.tsx` | Typed React primitives: `Icon`, `Mark`, `AgentTile` + `PN_ICONS` map. |
| `maestro-ui/src/components/maestro/redesign/useRedesignTheme.ts` | Theme/flag mechanism (hook + imperative helpers). |

**Wiring (already done in `main.tsx`):**
```ts
import "./components/maestro/redesign/redesign-tokens.css";
import "./components/maestro/redesign/redesign-tiles.css";
import "./components/maestro/redesign/redesign-modals.css";
import { setRedesignActive } from "./components/maestro/redesign/useRedesignTheme";
setRedesignActive(true); // <html data-redesign> default-on for this branch
```

### Scoping contract (CRITICAL)
- **Light tokens + all component classes** are scoped under `html[data-redesign]`.
- **Dark overrides** are scoped under `html[data-redesign][data-theme='dark']`.
- Global `:root` is **never** touched. Un-ported components render unchanged because nothing uses `pn-*` classes yet.
- To go dark: set `<html data-theme="dark">`. To go light: clear it. `data-redesign` must be present for any token to apply.

---

## 2. Exported primitives (`redesign/kit.tsx`)

Import path for all panel workers:
```ts
import { Icon, Mark, AgentTile, PN_ICONS } from "@/components/maestro/redesign/kit";
// or relative, e.g.  ../redesign/kit  /  ../../redesign/kit  depending on file depth
```

### `Icon`
```ts
interface IconProps {
  name: IconName;              // keyof typeof PN_ICONS (see list below)
  size?: number;               // default 16
  sw?: number;                 // stroke width, default 1.6
  style?: React.CSSProperties;
  className?: string;
}
function Icon(props: IconProps): JSX.Element
```
Renders a 16×16 `viewBox` SVG, `stroke="currentColor"`, rounded caps/joins, `aria-hidden`. Color follows `currentColor` — set color on the parent.

**Usage:** `<Icon name="play" />`, `<Icon name="search" size={15} />`, `<Icon name="plus" size={14} />`, `<Icon name="settings" sw={1.55} />`

### `Mark`
```ts
interface MarkProps { size?: number; } // default 22
function Mark(props: MarkProps): JSX.Element
```
The Maestro logo glyph (24×24 viewBox, `currentColor`). **Usage:** `<span className="pn-rail-mark"><Mark size={24} /></span>`

### `AgentTile`
```ts
type AgentKind = "claude" | "codex" | "gemini" | "terminal" | (string & {});
interface AgentTileProps { kind: AgentKind; lg?: boolean; }
function AgentTile(props: AgentTileProps): JSX.Element
```
- `kind="claude" | "codex" | "gemini"` → real bundled asset image inside a `.pn-agent` tile.
- `kind="terminal"` → `>_` mono tile (`.pn-agent .pn-agent--term`).
- **any other / unknown kind** → initial-letter avatar (`.pn-agent .pn-agent--init`), first char uppercased.
- `lg` → adds `.pn-agent--lg` (30×30 instead of 26×26).

**Usage:** `<AgentTile kind={session.agentTool} lg />`, `<AgentTile kind="terminal" />`

### `Glyph` (v2.1 — drawn per-status status indicator, `pn-stat`)
```ts
type GlyphKind = "todo" | "idle" | "in_progress" | "working" | "in_review"
  | "completed" | "cancelled" | "blocked" | "failed" | "archived" | "stopped"
  | "spawning" | "needsInput" | (string & {}); // unknown -> ring
interface GlyphProps { kind: GlyphKind; size?: number; } // size default 16
function Glyph(props: GlyphProps): JSX.Element
```
Renders `<span class="pn-stat pn-stat--{kind}"><svg viewBox="0 0 16 16">…</svg></span>` with a unique drawn glyph per status (ring, partial-arc spinner, filled dot, dashed review ring, filled check, cancel slash, X, rounded square, spawning half-fill, needs-input "i"). Color comes from the `pn-stat--{kind}` class (already in `redesign-tiles.css`). Used by **both** Task Tile (`pn-tt`) and Session Tile (`pn-st`). **Usage:** `<Glyph kind={task.status} />`, `<Glyph kind="needsInput" size={13} />`

### `Avatar` / `Avatars` (v2.1 — team-member monogram, `pn-av`)
```ts
interface AvatarMember { initial: string; name: string; color: string; bg?: string; }
function Avatar(props: { a: AvatarMember }): JSX.Element
function Avatars(props: { list: AvatarMember[] | null | undefined }): JSX.Element
```
`Avatar` = single `.pn-av` monogram; per-member `color`/`background` via inline style (`bg` falls back to `var(--pn-active)`). `Avatars` renders nothing for empty, one `Avatar` for a single member, else a `.pn-av-group` of up to 3 stacked `.pn-av.pn-av--stack`. **Usage:** `<Avatars list={task.assignees} />`

### `PN_ICONS` — full icon name inventory (54 icons)
`search, plus, chevronR, chevronD, chevronL, sliders, play, settings, pin, more, check, clock, gitBranch, listChecks, users, sparkles, folder, terminal, layers, mic, x, arrowRight, filter, dotsGrip, inbox, team, graph, archive, grid, pen, refresh, copy, info, shield, doc, teamview, sun, moon, calendar, music, paperclip, at, hash, bot, undo, volume, volumeOff, baton, globe, trash, archiveBox, folderOpen, fileCode, download, alert`

> **v2 additions:** `undo` (restore — counter-clockwise arrow, distinct from `refresh`), `volume` (speaker + waves), `volumeOff` (muted speaker), `baton` (conductor's baton — for the Team-View coordinator badge, distinct from `Mark`).
> **views.jsx additions (design-silent, authored to match style):** `globe` (Members GLOBAL badge / Skills Global section), `trash` (Members Delete / DeleteTask dialog), `archiveBox` (Members Archive — open box, distinct from `archive`), `folderOpen` (Files open folder), `fileCode` (Files code-file — doc with `</>`), `download` (Skills install count — arrow into tray), `alert` (CloseSession / Discard warn — triangle + `!`).

`type IconName = keyof typeof PN_ICONS` is exported for typing your own `name` props.

---

## 3. Theme mechanism (`redesign/useRedesignTheme.ts`)

> ⚠️ Exported only — **not** wired into live chrome. The 🪧 TopBar worker consumes `useRedesignTheme()` to render the Moon/Sun toggle.

```ts
// React hook (keeps local state synced to <html data-theme>)
function useRedesignTheme(opts?: {
  ensureRedesign?: boolean;      // default true — sets <html data-redesign> on mount
  initialTheme?: "light"|"dark"; // default = current <html data-theme>
}): {
  theme: "light" | "dark";
  isDark: boolean;
  toggle: () => void;            // mirrors shell.jsx TopBar toggle
  setTheme: (t: "light"|"dark") => void;
};

// Imperative helpers
function setRedesignActive(active: boolean): void;   // toggles <html data-redesign>
function isRedesignActive(): boolean;
function setRedesignTheme(theme: "light"|"dark"): void;
function getRedesignTheme(): "light" | "dark";
```
TopBar usage snippet:
```tsx
const { isDark, toggle } = useRedesignTheme();
<button className="pn-ib" title={isDark ? "Light mode" : "Dark mode"} onClick={toggle}>
  <Icon name={isDark ? "sun" : "moon"} />
</button>
```

---

## 4. `--pn-*` CSS variable inventory (light / dark values)

All variables are available anywhere under `html[data-redesign]`. Dark column applies under `html[data-redesign][data-theme='dark']`. **Always consume via `var(--pn-x)` — never hard-code these hex values.**

### Paper + ink
| Variable | Light | Dark |
|---|---|---|
| `--pn-paper` | `#F4F2EC` | `#15130E` |
| `--pn-surface` | `#FBFAF6` | `#1B1810` |
| `--pn-card` | `#FFFFFF` | `#221E15` |
| `--pn-hover` | `#F2EFE8` | `#262117` |
| `--pn-active` | `#ECE8DF` | `#302A1D` |
| `--pn-line` | `#E7E3D9` | `#2C2719` |
| `--pn-line-2` | `#D8D3C6` | `#3B3524` |
| `--pn-ink` | `#23201B` | `#EFE9DB` |
| `--pn-ink-2` | `#5B564C` | `#BDB5A2` |
| `--pn-ink-3` | `#8E897B` | `#8C8470` |
| `--pn-ink-4` | `#B7B2A4` | `#665E4C` |

### Brand (brass)
| Variable | Light | Dark |
|---|---|---|
| `--pn-brand` | `#B26A2B` | `#E0A45A` |
| `--pn-brand-2` | `#9A581F` | `#C98A3E` |
| `--pn-brand-soft` | `rgba(178,106,43,0.11)` | `rgba(224,164,90,0.15)` |

### Status (desaturated, anti-neon) — each has a `-soft` companion
| Variable | Light | Dark |
|---|---|---|
| `--pn-run` / `--pn-run-soft` | `#3E8E5A` / `rgba(62,142,90,0.12)` | `#5CB381` / `rgba(92,179,129,0.17)` |
| `--pn-wait` / `--pn-wait-soft` | `#BD8A2A` / `rgba(189,138,42,0.14)` | `#D9AA49` / `rgba(217,170,73,0.18)` |
| `--pn-block` / `--pn-block-soft` | `#BB4D3D` / `rgba(187,77,61,0.12)` | `#DA7D6A` / `rgba(218,125,106,0.17)` |
| `--pn-info` / `--pn-info-soft` | `#3F6C90` / `rgba(63,108,144,0.12)` | `#6F9FC7` / `rgba(111,159,199,0.17)` |
| `--pn-idle` / `--pn-idle-soft` | `#A29C8E` / `rgba(162,156,142,0.16)` | `#7A7360` / `rgba(122,115,96,0.20)` |

### Terminal chrome (v2 — stays dark in both themes; only `--pn-term-bg` flips)
| Variable | Light | Dark |
|---|---|---|
| `--pn-term-bg` | `#1c1a16` | `#100E0A` |
| `--pn-term-ink` | `#cfc9bb` | (same) |
| `--pn-term-acc` | `#d99a4e` | (same) |
| `--pn-term-dim` | `#8a8474` | (same) |

> The `.pn-term*` block now consumes these vars instead of raw hex (single source). Other terminal literals (`#2c2922`/`#221E15` borders, `#a9a294`/`#e6e0d3` bar text, `#5aa777` tdot, `#7bb98e` l-ok, `#cbb98a` l-file, `#7d7768` input, `#6a6457`) remain verbatim — the design did not tokenize them. Border dark-flip (`#221E15`) is unchanged.

### Type
| Variable | Value |
|---|---|
| `--pn-serif` | `'Newsreader', Georgia, 'Times New Roman', serif` |
| `--pn-ui` | `'Hanken Grotesk', system-ui, -apple-system, sans-serif` |
| `--pn-mono` | `'JetBrains Mono', ui-monospace, 'SF Mono', monospace` |

> **Fonts are SELF-HOSTED (v2.2) — do not re-add a Google Fonts `@import`.** The Tauri CSP (`font-src 'self'`) blocks `fonts.googleapis.com`, so the original `@import` silently fell back to system-ui/Georgia in the real app (static browser harnesses still loaded Google Fonts and looked correct, which masked the bug). Fix: `@fontsource/hanken-grotesk` (`--pn-ui`, weights 400/500/600/700) + `@fontsource/newsreader` (`--pn-serif`, 400/500 + 400-italic) are imported in `main.tsx` and bundled by Vite (served under `'self'`). `--pn-mono` (JetBrains Mono) remains self-hosted in `styles.css`. No CSP change was needed. If you need an additional weight, add the matching `@fontsource/<family>/<weight>.css` import to `main.tsx`.

### Radii / shadow
| Variable | Light | Dark (shadows only) |
|---|---|---|
| `--pn-r-xs` | `5px` | — |
| `--pn-r-sm` | `7px` | — |
| `--pn-r-md` | `10px` | — |
| `--pn-r-lg` | `14px` | — |
| `--pn-r-pill` | `999px` | — |
| `--pn-sh-sm` | `0 1px 2px rgba(40,34,24,0.05)` | `0 1px 2px rgba(0,0,0,0.45)` |
| `--pn-sh-md` | `0 2px 6px rgba(40,34,24,0.06), 0 8px 24px rgba(40,34,24,0.06)` | `0 2px 8px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.4)` |
| `--pn-sh-pop` | `0 12px 34px rgba(40,34,24,0.14)` | `0 16px 44px rgba(0,0,0,0.6)` |

---

## 5. `pn-*` component class inventory (`redesign-tokens.css`)

Every class below is scoped under `html[data-redesign]`. Use them with the exact same DOM structure as `panel-redesign/shell.jsx`.

**Panel shell:** `pn-panel`, `pn-fade`, `pn-fade--card`, `pn-scroll`

**Shared primitives:** `pn-eyebrow` (+ child `pn-count`), `pn-dot` (`--run`/`--wait`/`--block`/`--info`/`--idle`/`--live`), `pn-dot-wrap`, `pn-meta` (+ `<b>`), `pn-tag` (`--high`/`--med`/`--low`), `pn-chip`, `pn-agent` (`--lg`/`--term`/`--init`), `pn-btn` (`--primary`/`--ghost`/`--block`), `pn-kbd`, `pn-ib`

**Panel header:** `pn-head`, `pn-mark`, `pn-proj` (+ `pn-proj-org`), `pn-head-spacer`

**Tabs:** `pn-tabs`, `pn-tab` (`--active`, child `pn-tab-n`), `pn-seg`, `pn-seg-i` (`--active`)

**Search / filters:** `pn-search`, `pn-filters`, `pn-filter` (`--active`)

> `pn-ib` also has a foundation-added `pn-ib--active` state (`background: var(--pn-active); color: var(--pn-ink)`, matching the `pn-subtab--active` idiom) for toggle icon-buttons.

**Sections + rows (left/Ledger):** `pn-sec-head` (child `pn-line`), `pn-list`, `pn-row` (`--sel`; children `pn-row__lead`/`__body`/`__title`/`__sub`/`__trail`/`__run`), `pn-sub` (`--done`; children `pn-sub__title`/`__check`)

**Session rows/cards (right/Roster):** `pn-quick`, `pn-qchip` (child `pn-plus`), `pn-sess` (`--active`/`--wait`; children `pn-sess__body`/`__name`/`__status`/`__statustext` [`--wait`/`--run`]/`__trail`), `pn-cards`, `pn-card-s` (children `__top`/`__name`/`__act`/`__foot`, child `pn-caret`), `pn-pill` (`--run`/`--wait`/`--idle`)

**Activity / now-playing:** `pn-np`, `pn-np__item`/`__top`/`__name`/`__elapsed`/`__say`/`__bar`, `pn-typing`, `pn-offstage`, `pn-off-row`/`__name`

**Stack layout:** `pn-stack-head`, `pn-stack-title`, `pn-stack-prog`, `pn-srow`/`__body`/`__title`/`__meta`, `pn-prio` (`--high`/`--med`/`--low`)

**Console layout:** `pn-con-head` (child `pn-prompt`/`pn-proj-n`), `pn-caret-blink`, `pn-con-input`, `pn-con-tabs`, `pn-con-tab` (`--active`), `pn-con-rule` (child `pn-line`), `pn-con-row`/`__idx`/`__title`/`__k`

**Footer / empty:** `pn-foot`, `pn-empty`/`__h`/`__p`

**App shell:** `pn-shell`, `pn-shell-body`

**Top bar:** `pn-top`, `pn-lights`, `pn-ptabs`, `pn-ptab` (`--active`), `pn-top-r`

**Icon rail (far left):** `pn-rail`, `pn-rail-mark`, `pn-rail-btn` (`--active`), `pn-rail-badge`, `pn-rail-spacer`, `pn-rail-div`

**Spaces rail (far right):** `pn-srail`, `pn-srail-s` (`--active`/`--exited`, also takes `pn-agent--term`), `pn-srail-pulse`, `pn-srail-wait`

**Terminal (center, stays dark in both themes):** `pn-term`, `pn-term-bar` (children `pn-tdot`/`<b>`/`pn-tslash`), `pn-term-body` (line classes `l-prompt`/`l-dim`/`l-ok`/`l-file`/`l-acc`), `pn-tcursor`, `pn-term-input` (child `pn-tslash`)

**Left/right content frames:** `pn-mp` (left, 340px), `pn-sp` (right, 340px), `pn-subbar`, `pn-subtab` (`--active`)

**Keyframes (global, defined once):** `pn-ping`, `pn-blink`, `pn-caret`

> ⚠️ Note on terminal colors: `pn-term*` uses hard-coded dark hex values (e.g. `#1c1a16`, `#cfc9bb`, `#d99a4e`) **verbatim from the design** — the terminal stays dark in both light and dark mode by design. This is the one place hex values are expected; copy them as-is from `redesign-tokens.css`.

---

## 6. Modal + form class inventory (`redesign-modals.css`)

Scoped under `html[data-redesign]`. No dark-specific rules — all derive from `--pn-*` tokens, so they flip automatically with `data-theme="dark"`.

**Showcase / layout:** `pn-mdl-stage`, `pn-mdl-col`, `pn-mdl-cap`

**Modal card:** `pn-mdl`, `pn-mdl__hd`, `pn-mdl__hdmain`, `pn-mdl__crumb` (+ `<b>`, `svg`), `pn-mdl__titleinput`, `pn-mdl__close`, `pn-mdl__body`

**Fields:** `pn-fld`, `pn-flabel` (child `.req`), `pn-fhint`, `pn-frow`, `pn-input`, `pn-textarea` (`--mono`)

**Description toolbar:** `pn-desc`, `pn-desc__bar`, `pn-mchip` (`--ref`)

**Avatar / tools / select:** `pn-avatar-edit`, `pn-toolsel`, `pn-tool` (`--active`, child `pn-tool__name`), `pn-select`

**Priority pills:** `pn-prio-pills`, `pn-prio-pill` (`--active`, child `pn-pdot`)

**Capabilities / switches:** `pn-caps`, `pn-cap`, `pn-cap__body`, `pn-cap__name`, `pn-cap__desc`, `pn-switch` (`--on`)

**Instrument picker:** `pn-instr`, `pn-instr-i` (`--active`, child `pn-instr-i__name`)

**Modal tabs:** `pn-mtabs`, `pn-mtab` (`--active`, child `pn-mtab__n`)

**Footer:** `pn-mdl__foot`, `pn-mdl__footL`, `pn-mdl__footR`, `pn-assignadd`, `pn-savehint` (uses `pn-dot`)

---

## 8. v2 additions — tiles classes, net-new primitives, terminal vars

### A. Task-tile / session-tile / tree classes (`redesign-tiles.css`, ported verbatim from `tiles.css`)
Scoped under `html[data-redesign]`; no dark rules (all derive from `--pn-*` tokens).

**Status glyph color hooks:** `pn-stat` (+ status modifiers `--todo`/`--idle`/`--cancelled`/`--archived`/`--stopped`/`--in_progress`/`--working`/`--completed`/`--in_review`/`--spawning`/`--blocked`/`--failed`/`--needsInput`)

**Inline editable badge:** `pn-badge` (`--btn`, child `pn-badge__caret`; status variants `pn-badge--status-<status>`; `pn-badge--prio-high`; `pn-badge--model` + `.is-override`)

**Avatar monograms (per-member color/bg via inline style):** `pn-av`, `pn-av--stack`, `pn-av-group`

**Toggle pill:** `pn-toggle` (`--on-danger` → `--pn-block`, `--on-wt` → `--pn-run`)

**Mini count:** `pn-mini`

**Task tile:** `pn-tt` (`--active`/`--completed`); children `pn-tt__main`/`__check`(`--on`)/`__arrow`(`--expanded`/`--empty`)/`__arrowCount`/`__status`/`__title`(`--untitled`)/`__activedot`/`__inline`/`__actions`/`__run`/`__ind`(`--open`/`--working`/`--completed`/`--failed`)/`__meta`/`__metarow`(`--fill`)/`__time`/`__sub`/`__subline`

**Activity chip:** `pn-actchip` (`--working`/`--needsInput`/`--completed`/`--failed`)

**Doc pills:** `pn-docpill` (`--add`, children `pn-docpill__ic`/`__t`)

**Session tile:** `pn-st` (`--selected`/`--needsInput`/`--archived`); children `pn-st__main`/`__arrow`(`--expanded`/`--empty`)/`__arrowCount`/`__radio`(`--on`/`--archived`)/`__title`/`__titleText`/`__tag`(`--done`)/`__live`/`__stopped`/`__statusglyph`/`__actions`/`__btn`(`--danger`)/`__resume`/`__tasklines`/`__taskline`/`__tasklineLabel`/`__meta`/`__metasec`/`__metalabel`/`__metacontent`/`__taskchip`/`__actbtn`. (Note: `pn-st__time` has no rule in the source — always paired with `pn-tt__time`, which carries the styling. Apply both classes, as the design does.)

**Tree nesting:** `pn-kids`, `pn-kids--st`

**Team group:** `pn-team`, `pn-team__head`, `pn-team__dot`, `pn-team__name`, `pn-team__count` (+ `pn-team .pn-st:last-child` removes last border)

**Inline-edit popover (portal):** `pn-pop-ov`, `pn-pop`, `pn-opt` (`--cur`, child `pn-opt__chk`)

**Showcase scaffold (prototype-only, harmless):** `pn-showstage`, `pn-showrow`, `pn-showcol`, `pn-showcap`, `pn-showframe`(`__hd`), `pn-showsub`

### B. (reserved)

### C. Net-new primitives (coordinator-authorized; colours from existing tokens only)
| Class | File | Definition source |
|---|---|---|
| `pn-btn--danger` | `redesign-tokens.css` | bg/border `--pn-block`; hover → `--pn-block-soft` bg + `--pn-block` text. Also `.pn-btn--danger.pn-btn--ghost` (transparent, block text). `pn-btn` geometry. |
| `pn-range` | `redesign-modals.css` | native `<input type=range>` restyle — track `--pn-line`, filled/thumb `--pn-brand` (via `accent-color` + `-moz-range-progress` + webkit/moz thumb). |
| `pn-mtabs--vert` | `redesign-modals.css` | vertical variant of `pn-mtabs` (Settings sidebar rail) — column layout, right-edge border + active marker; reuses `pn-mtab` styling. Horizontal default unchanged. |
| `pn-switch--danger` | `redesign-modals.css` | `.pn-switch--danger.pn-switch--on { background: var(--pn-block); }` (vs `--pn-run`). |

> **NOT added (deliberate, per coordinator):** `--pn-brand-3` — the design uses ONE restrained brass accent; hover states collapse to `--pn-brand`. Do not request a lighter brass tint.

---

## 9. Boards + Team View class inventory (`redesign-boards.css`, ported verbatim from `boards.css`)

Scoped under `html[data-redesign]`; the single dark rule (`.pn-tv__term` background) is under `html[data-redesign][data-theme='dark']`. These reuse already-ported primitives (`Glyph`/`Avatar`/`Icon`/`AgentTile`, `pn-dot`/`pn-tag`).

**Board stage / header:** `pn-bd-stage`, `pn-bd-cap`, `pn-screen`, `pn-bd-hd` (children `pn-bd-hd__title`/`__sub`/`__sp`)

**Columns:** `pn-bcols`, `pn-bcol` (`--over`/`--collapsed`; children `pn-bcol__hd`/`__label`/`__count`/`__body`/`__empty`)

**Board card:** `pn-bcard` (`--blocked`/`--done`; children `pn-bcard__top`/`__pdot`/`__title`/`__glyph`/`__pbadge`/`__meta`/`__prog`/`__progbar`/`__due`(`--over`)/`__foot`/`__sessions`/`__run`)

**Multi-project rows:** `pn-mpr` (children `pn-mpr__hd`/`__dot`/`__name`/`__count`/`__chev`; nests `pn-bcols`/`pn-bcol`)

**Team view:** `pn-tv` (sets `--tv-col-w` custom prop); header `pn-tv__hd`/`__title`/`__pill`(`--active`/`--idle`)/`__count`/`__hint`/`__close`; breadcrumbs `pn-tv__crumbs`/`__crumb`(`--current`)/`__crumb-sep`; body `pn-tv__body`; coordinator column `pn-tv__coord`/`__coordhd`/`__coordring`/`__coordname`/`__coordbadge`; resize `pn-tv__resize`(`--active`); workers `pn-tv__workers`/`__col`(`--needs`/`--collapsed`)/`__colv`/`__colvname`; drill `pn-tv__drillbar`/`__colbtn`; slot header `pn-tv__slothd`/`__slotname`/`__slotrole`/`__slotsp`/`__stats`/`__statchip`/`__slotbtn`; terminal `pn-tv__term` (line classes `l-prompt`/`l-dim`/`l-ok`/`l-file`; dark-flips bg) + `pn-tv__tcursor`; placeholder `pn-tv__ph`/`__ph__resume`

> `pn-tv__term` carries raw terminal hex verbatim from `boards.css` (mirrors the `--pn-term-*` values; the Middle/Board worker may repoint to those vars later). `pn-tv__tcursor` reuses the global `@keyframes pn-caret`.

---

## 10. Views class inventory (`redesign-views.css`, ported verbatim from `views.css`)

Secondary panels — Team Members, Files, Skills, and confirm dialogs. Scoped under `html[data-redesign]`; no dark rules (all derive from `--pn-*`). Reuse `Glyph`/`Avatar`/`Icon`/`AgentTile` + `pn-dot`/`pn-tag`/`pn-mdl`.

**Shared view chrome:** `pn-vstage`, `pn-vcap`, `pn-vframe` (`--tall`), `pn-vhd` (`__title`/`__sp`), `pn-vsearch`, `pn-vscroll`, `pn-vsec` (child `pn-line`), `pn-vtoggle` (`button`, `button.on`, child `.n`)

**Team Members:** `pn-mem` (`--archived`; children `pn-mem__main`/`__av`(`--ring`)/`__body`/`__name`/`__role`/`__chev`(`--open`)/`__badges`/`__exp`/`__block`/`__blocklabel`/`__blocktext`(`--mono`)/`__skills`/`__actions`), `pn-mbadge` (`--model`/`--profile`/`--default`/`--global`)

**Files:** `pn-files__path`, `pn-fvrow` (Files row — renamed from `pn-frow`, see §10; `--active`; children `pn-fvrow__tw`(`--open`)/`__ic`(`--folder`/`--file`)/`__name`/`__git`(`--m`/`--a`/`--d`/`--u`)/`__gitdot`), `pn-files__foot`, `pn-files__footchip`

**Skills:** `pn-skill` (children `pn-skill__hd`/`__ic`/`__body`/`__namerow`/`__name`/`__desc`/`__badges`/`__exp`/`__row`/`__rowlabel`/`__rowval`/`__tags`/`__tag`/`__path`), `pn-sbadge` (`--src`/`--ver`)

**Confirm dialogs:** `pn-dlg-stage`, `pn-scrim`, `pn-dlg` (children `pn-dlg__hd`/`__icon`(`--danger`/`--warn`)/`__title`/`__body`/`__msg`/`__warn`(`--danger`)/`__foot`)

### §10 — Two class-name collisions (RESOLVED — coordinator-ruled). These are the only deviations from verbatim in `redesign-views.css`.
1. **`.pn-frow` collision → RESOLVED.** The Files-view row is **renamed to `.pn-fvrow`** in `redesign-views.css` (all `pn-frow*` → `pn-fvrow*`). `redesign-modals.css` keeps `.pn-frow` for its form/field row, untouched (modal workers consume it). **Views/Files JSX must use `className="pn-fvrow"`** for file rows. (Import order — views before modals — is retained.)
2. **`.pn-sp` collision → RESOLVED.** The two colliding views spacer rules (`.pn-mem__actions .pn-sp`, `.pn-dlg__foot .pn-sp`) were **dropped** from `redesign-views.css`. `.pn-sp` stays exclusively the 340px Spaces-panel container (`redesign-tokens.css`). **Views JSX must use `className="pn-head-spacer"`** (already in tokens, `flex:1`) wherever the design had a `pn-sp` spacer.

---

## 7. Notes / escalations

1. **`.pn-agent--init`** — `panel-redesign/kit.jsx` `AgentTile` has no initial-letter variant, but the coordinator directive explicitly requires unknown kinds to fall back to one. I added a single token-only class (`color: var(--pn-ink-2); font-family: var(--pn-ui); font-weight: 700; font-size: 12px`, larger for `--lg`). Flagged for coordinator confirmation. If a different look is wanted, only this one rule changes — no worker impact.
2. **Initial-letter monogram (`.pn-av`)** for *team-member assignees* (Rhea/Kit/Ada style) — ✅ **resolved in v2**: `pn-av`/`pn-av--stack`/`pn-av-group` are now ported into `redesign-tiles.css` (§8A). Per-member `color`/`background` are applied via inline `style` in the JSX (as in the prototype's `Avatar`), not via CSS classes — so no per-member rules exist to port.
3. **Terminal hex values** are intentionally hard-coded (see §5 note) — not a token gap.
4. If you need a `pn-*` class or token that is **not** listed here, **do not invent it** — escalate to your panel coordinator, who escalates to me to extend the foundation.
