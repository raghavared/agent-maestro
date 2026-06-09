# SessionStatsView — Tokenization Contract

**Worker:** 📊 Session Stats Theme Worker (`sess_1780949406004_s388hwzpf`)
**Coordinator:** Middle Panel Coordinator (`sess_1780949254944_6jpoi5ju2`)
**Task:** `task_1780949360133_7zlamzw7s`
**Branch:** `maestro-redesign`
**Status:** CONTRACT FINALIZED — all escalations resolved by coordinator. Gate still closed; holding for explicit `FOUNDATION-DONE.md` go-ahead before any edit.

---

## LOCKED DECISIONS (coordinator-approved 2026-06-09)

These supersede the open ASKs in §5. Implement exactly as below once the gate opens.

| # | Decision |
|---|---|
| §0 scope | **APPROVED** — edit `maestro-ui/src/styles-session-stats.css`. Redefine each `--ssv-*` (lines 11–69) to reference a `--pn-*` token; keep all ~1100 lines of `.ssv-*` rule bodies **byte-identical**. `.tsx` changes only for the var-name swaps in §5.2/§5.3. |
| §2/§3/§4 | **ALL APPROVED** as written (surfaces, ink, status, type, radii). |
| §5.1 lighter brass | **COLLAPSE** `--ssv-baton-400`, `--ssv-baton-300`, `--ssv-accent-hover`, inline-code color → `--pn-brand`. (Possible `--pn-brand-3` light tint escalated to parent; if it lands, hover states swap in a follow-up.) |
| §5.2 warn split | **Option (b).** Genuine STATUS warns → `--pn-wait` / `--pn-wait-soft`: `SEVERITY_COLOR.warn` (`.tsx:245`), `PRIORITY_VISUAL.medium` bg/fg (`.tsx:266`). **EXCEPTION:** user-message accents (`.tsx:949` bg, `.tsx:955` & `:964` color) are **brand identity → `--pn-brand`** (the dim/bg `--ssv-baton-tint` → `--pn-brand-soft`). Pure var-read swaps, no logic change. |
| §5.3 categorical hues | **KEEP** `AGENT_HUES` (`.tsx:171–180`) + `--ssv-violet`/`--ssv-teal` viz hues as-is. **Avatar text:** set `--ssv-on-accent: #20160a` **once** in the token block (foundation's on-brass ink, used by `pn-btn--primary:hover`; foundation exposes **no** `--pn-on-accent` variable), then **centralize** — the 3 raw-literal sites (`.ssv-av-lg color:#0a0c10`:261, `.ssv-mchip-dot color:#0a0c10`:308, `.ssv-sub-av color:#0a0c10`:1043) reference `var(--ssv-on-accent)` instead of scattering raw hex. Single source of truth, easy to swap if foundation later adds an on-accent token. Must stay fixed-dark in both themes — do NOT use `--pn-ink` (it theme-flips). |
| §5.4 inner-top | `--ssv-inner-top` → `--pn-sh-sm` (foundation card elevation; not flat-drop). |
| §5.5 radial glow | **DROP** the gradient; root bg → flat `var(--pn-paper)`. |
| §5.6 user-bubble border | `.ssv-msg-user .ssv-msg-bubble` border (`.css:837`) → `--pn-line-2`. Delete the orphaned `--ssv-baton-rgb` triplet (`.css:32`) after the glow is removed. |
| §5.7 scrollbar | thumb → `--pn-line-2`, hover → `--pn-ink-4` (`.css:92/96`). |
| §5.8 literals | leave as-is (`#000` clamp mask is a mask alpha, not a color). |
| scoping | `data-redesign` is a global `<html>` flag (foundation default-on for this branch) — stats view is in-scope automatically, **no guard needed**. Verify after foundation publishes. |

---

## 0. Scope correction (ESCALATION — needs coordinator ack)

The directive names `SessionStatsView.tsx` + `SessionStatsIcons.tsx` as scope. After reading all three files, the actual hardcoded design values do **not** live in the `.tsx`:

| File | Hardcoded design values present? |
|---|---|
| `maestro-ui/src/components/maestro/SessionStatsView.tsx` | Only `AGENT_HUES` (8 categorical hex) + token-segment hues. Everything else is `var(--ssv-*)` references — already tokenized. |
| `maestro-ui/src/components/maestro/SessionStatsIcons.tsx` | **None.** Pure SVG glyphs, `stroke="currentColor"`, color passed in by parent. No edits needed. |
| `maestro-ui/src/styles-session-stats.css` | **ALL of them.** The `--ssv-*` token block (lines 11–69) is the hardcoded color/font/radius/shadow/spacing palette, plus a handful of literal values in the rule body. |

**Therefore the real tokenization target is `styles-session-stats.css`.** The cleanest in-place approach: **redefine each `--ssv-*` variable to reference a `--pn-*` foundation token** at the top of the file (lines 11–69). The ~1100 lines of `.ssv-*` layout/structure rules stay byte-for-byte identical, so layout, spacing rhythm, ordering, and every class semantic is preserved automatically. The `.tsx` changes only for `AGENT_HUES` (see §5) if approved.

**Bonus win:** the view is currently **dark-only** ("renders its fixed aesthetic regardless of the app's active terminal theme"). Pointing `--ssv-*` at `--pn-*` makes it automatically honor light + dark via the foundation's `html[data-redesign]` / `html[data-redesign][data-theme=dark]` scoping — which is exactly the redesign requirement.

> **ASK:** Confirm I may edit `styles-session-stats.css` (it is the only place the values live). Without this the task cannot be completed, since the `.tsx` has no standalone color/spacing values to swap.

---

## 1. Foundation tokens available (source of truth)

From `maestro-ui/src/components/maestro/redesign/redesign-tokens.css` (republished verbatim from `panel-redesign/theme.css` + `theme-dark.css`), scoped under `html[data-redesign]` (light) and `html[data-redesign][data-theme=dark]` (dark):

- Surfaces: `--pn-paper`, `--pn-surface`, `--pn-card`, `--pn-hover`, `--pn-active`
- Lines: `--pn-line`, `--pn-line-2`
- Ink: `--pn-ink`, `--pn-ink-2`, `--pn-ink-3`, `--pn-ink-4`
- Brand (brass): `--pn-brand`, `--pn-brand-2`, `--pn-brand-soft`
- Status: `--pn-run`/`-soft`, `--pn-wait`/`-soft`, `--pn-block`/`-soft`, `--pn-info`/`-soft`, `--pn-idle`/`-soft`
- Type: `--pn-serif`, `--pn-ui`, `--pn-mono`
- Radii: `--pn-r-xs` 5px, `--pn-r-sm` 7px, `--pn-r-md` 10px, `--pn-r-lg` 14px, `--pn-r-pill` 999px
- Shadow: `--pn-sh-sm`, `--pn-sh-md`, `--pn-sh-pop`

Foundation has **no** categorical/data-viz hue palette, **no** RGB triplet for brand, **no** inset-highlight shadow, **no** motion/easing tokens — see escalations §5.

---

## 2. Surfaces, lines, ink — clean 1:1 map

| `--ssv-*` (line) | Current value (dark-only) | → Foundation token | Notes |
|---|---|---|---|
| `--ssv-bg-app` (13) | `#0a0c10` | `--pn-paper` | app canvas |
| `--ssv-bg-surface` (14) | `#0e1117` | `--pn-surface` | panel surface |
| `--ssv-bg-raised` (15) | `#131720` | `--pn-card` | raised card |
| `--ssv-bg-hover` (16) | `#181d28` | `--pn-hover` | row hover |
| `--ssv-bg-active` (17) | `#1e2430` | `--pn-active` | selected/chip fill |
| `--ssv-border-1` (18) | `#2a3140` | `--pn-line` | hairline divider |
| `--ssv-border-2` (19) | `#3a4354` | `--pn-line-2` | stronger border |
| `--ssv-fg-1` (22) | `#e4e8f0` | `--pn-ink` | primary text |
| `--ssv-fg-2` (23) | `#b9c0cf` | `--pn-ink-2` | secondary |
| `--ssv-fg-3` (24) | `#8b93a6` | `--pn-ink-3` | muted |
| `--ssv-fg-4` (25) | `#586073` | `--pn-ink-4` | faint / meta (this is the `pn-meta`-equivalent dim text) |

---

## 3. Status signals — 1:1 semantic map

| `--ssv-*` (line) | Current | → Foundation | Notes |
|---|---|---|---|
| `--ssv-run` (40) | `#34d399` | `--pn-run` | success green |
| `--ssv-run-dim` (41) | `rgba(52,211,153,.14)` | `--pn-run-soft` | |
| `--ssv-block` (42) | `#fb7185` | `--pn-block` | failure red |
| `--ssv-block-dim` (43) | `rgba(251,113,133,.14)` | `--pn-block-soft` | |
| `--ssv-info` (44) | `#60a5fa` | `--pn-info` | info blue |
| `--ssv-info-dim` (45) | `rgba(96,165,250,.14)` | `--pn-info-soft` | |
| `--ssv-idle-dim` (46) | `rgba(88,96,115,.18)` | `--pn-idle-soft` | |

(`--pn-idle` itself maps to `--ssv-fg-4` usages where a neutral signal is needed; the existing CSS already uses `--ssv-fg-4` for neutral so no extra alias required.)

---

## 4. Type, radii, shadow, motion

| `--ssv-*` (line) | Current | → Foundation | Notes |
|---|---|---|---|
| `--ssv-font-ui` (53) | Inter stack | `--pn-ui` | Hanken Grotesk |
| `--ssv-font-mono` (54) | JetBrains Mono stack | `--pn-mono` | JetBrains Mono (same family) |
| `--ssv-r-xs` (57) | 4px | `--pn-r-xs` (5px) | +1px |
| `--ssv-r-sm` (58) | 6px | `--pn-r-sm` (7px) | +1px |
| `--ssv-r-md` (59) | 8px | `--pn-r-md` (10px) | +2px |
| `--ssv-r-lg` (60) | 12px | `--pn-r-lg` (14px) | +2px |
| `--ssv-r-pill` (61) | 999px | `--pn-r-pill` | identical |
| `--ssv-inner-top` (64) | `inset 0 1px 0 rgba(255,255,255,.04)` | **ESCALATE** → recommend `--pn-sh-sm` | see §5.4 |
| `--ssv-dur-fast/base/slow` (65–67) | 120/180/280ms | **keep as-is** | foundation doesn't tokenize motion; not an appearance/color value |
| `--ssv-ease`, `--ssv-ease-out` (68–69) | cubic-beziers | **keep as-is** | same rationale |

No serif is introduced — the view uses none today and the design is silent on adding one here (don't invent).

---

## 5. Escalations — values with no clean foundation match

### 5.1 Baton (amber accent) family → brass brand
`--ssv-baton-*` serves a **dual role**: (a) the signature accent and (b) a warn/amber status. Foundation separates these into `--pn-brand` (brass accent) and `--pn-wait` (amber status). Proposed mapping:

| `--ssv-*` (line) | Current | → Proposed | Confidence |
|---|---|---|---|
| `--ssv-baton-500` (28) | `#f5a524` | `--pn-brand` | high |
| `--ssv-baton-600` (30) | `#d4881a` (press/darker) | `--pn-brand-2` | high |
| `--ssv-baton-tint` (33) | `rgba(245,165,36,.1)` | `--pn-brand-soft` | high |
| `--ssv-accent` (34) | → baton-500 | → `--pn-brand` | high |
| `--ssv-accent-press` (36) | → baton-600 | → `--pn-brand-2` | high |
| `--ssv-baton-400` (29) | `#ffb845` (hover/lighter) | **?** `--pn-brand` (foundation has no lighter-than-brand brass) | **ESCALATE** |
| `--ssv-accent-hover` (35) | → baton-400 | **?** `--pn-brand` or `--pn-hover`-on-brand | **ESCALATE** |
| `--ssv-baton-300` (31) | `#ffcd7a` (lightest; used as inline-code text color) | **?** `--pn-brand` | **ESCALATE** |
| `--ssv-on-accent` (37) | `#1a1206` (text on brass btn) | `#20160a` literal (matches `pn-btn--primary:hover`) or `--pn-paper` | **ESCALATE** |

> **ASK:** Foundation exposes only `--pn-brand` / `--pn-brand-2` (darker) / `--pn-brand-soft`. There is no lighter brand tint (`baton-400`/`-300`). Options: (a) collapse all lighter variants to `--pn-brand`; (b) you provide an additional `--pn-brand-3` light tint in the foundation. Which?

### 5.2 `--ssv-baton-400` used as WARN status (in `.tsx`)
In `SessionStatsView.tsx`, `var(--ssv-baton-400)` is used for the **warn severity** (timeline `task_blocked`/`needs_input`, `SEVERITY_COLOR.warn`, `PRIORITY_VISUAL.medium`, user-message accents) and `--ssv-baton-tint` as its dim. Semantically these are `--pn-wait` / `--pn-wait-soft`, **not** brand. But they reference the same `--ssv-baton-*` vars that also drive the accent.

> **ASK:** Do you want me to (a) leave them reading as brand (simplest — one var), or (b) split the warn usages to point at `--pn-wait`/`--pn-wait-soft` while keeping the accent on `--pn-brand`? Option (b) is more faithful to the foundation's "status by muted dot+word, brand stays brand" intent but touches `.tsx` lines 222/245/264/266/949/955/964. Recommend (b).

### 5.3 Categorical / data-viz hues (no foundation equivalent)
Foundation has **no** categorical palette. These encode data identity, not chrome:

- `AGENT_HUES` — 8 hex in `SessionStatsView.tsx:171–180` (amber/teal/violet/rose/sky/lime/coral/pink), hashed per agent name for stable avatar colors.
- `--ssv-violet` `#a78bfa` (49), `--ssv-teal` `#2dd4bf` (50) — token-bar segment colors.
- Token-bar segments in `.tsx:646–649`: cacheRead=violet, input=info, cacheCreate=teal, output=baton-500.
- `#0a0c10` literal text on colored avatars (`.ssv-av-lg`:261, `.ssv-mchip-dot`:308, `.ssv-sub-av`:1043).

> **ASK:** Recommend **keeping AGENT_HUES + the two viz hues as-is** (they are categorical data encodings, not theme chrome — re-skinning them to brass would destroy the per-agent identity signal). For the `#0a0c10` avatar text, recommend `--pn-ink` (warm near-black, legible on every bright categorical hue in both themes). Approve?

### 5.4 Inset-highlight shadow (`--ssv-inner-top`)
`inset 0 1px 0 rgba(255,255,255,.04)` is a dark-mode top-edge sheen on cards/avatars. On warm paper (light) a white inset reads wrong. Foundation only offers drop shadows (`--pn-sh-sm/md/pop`).

> **ASK:** Recommend mapping `--ssv-inner-top` → `--pn-sh-sm` (foundation's card elevation). Alternatively drop the inset entirely (flat paper aesthetic). Which?

### 5.5 Radial baton glow on the root background
`.sessionStatsView` bg (lines 77–79) is `radial-gradient(... rgba(var(--ssv-baton-rgb),.06) ...) , var(--ssv-bg-app)` — a neon-ish accent glow. The redesign is explicitly "the deliberate opposite of dark-neon… warm ink on warm paper, hairline dividers." A radial accent glow is anti-pattern here.

> **ASK:** Recommend replacing the whole background with flat `var(--pn-paper)` and dropping the gradient (and the now-orphaned `--ssv-baton-rgb` triplet). Approve?

### 5.6 `--ssv-baton-rgb` triplet
`245, 165, 36` (32) feeds two `rgba(var(--ssv-baton-rgb), …)` call-sites: the §5.5 gradient and `.ssv-msg-user .ssv-msg-bubble` border `rgba(...,.25)` (line 837). Foundation has no brand RGB triplet.

> **ASK:** If §5.5 gradient is dropped, the only remaining use is the user-bubble border. Recommend replacing that border with `--pn-line-2` (or `--pn-wait` if user bubbles should stay amber-tinted per §5.2). Which?

### 5.7 Scrollbar thumb
`.sessionStatsView::-webkit-scrollbar-thumb` uses `rgba(255,255,255,.08)` / `.16` (lines 92/96). Foundation scrollbar uses `--pn-line-2` (thumb) / `--pn-ink-4` (hover). Recommend that map. Low-risk, flagging for completeness.

### 5.8 Non-design literals (NOT touched — for the record)
- `.ssv-final-body.clamped` mask `linear-gradient(180deg,#000 60%,transparent)` (351–352): `#000` is a **mask alpha**, not a visible color. Leave as-is.
- `.pn-btn--primary:hover` analog text `#20160a` only relevant if §5.1 chooses the literal.

---

## 6. Functional surface to preserve VERBATIM (contract guarantee)

Zero functionality changes. The following are **not** touched by tokenization (CSS-var swap only):

- **Props:** `SessionStatsViewProps { session }`; `TaskCard`, `FoldKV`, `Section`, `StatusChip`, `StatIcon` prop signatures.
- **Store hooks:** `useMaestroStore` (tasks, sessions, resumeSessionFlow, resumingSessionId, setSessionArchived), `useProjectStore` (projects).
- **State:** `viewId`, `stats`, `statsLoading`, `statsError`, `finalExpanded`, `lastMsgsOpen`, `timelineOpen`, `runConfigOpen`, `identityOpen`, `openDoc`, `copied`/`useCopy`.
- **Effects/memos:** the `viewId` sync effect, the transcript-load effect (`loadTranscriptStats`), `sessionCwd`, `finalMessage`, `linkedTasks`, `timelineBreakdown`, `subSessions`, `subRollup`, `runConfigRows`, `identityRows`, `tokenSegments` — all preserved.
- **Handlers:** `handleResumeClick`, `handleRestoreClick`, `setViewId`, copy, all toggles.
- **Data sources & computation:** `computeTranscriptStats`, `calculateMetrics`, stat ordering/grouping, outcome/status/severity/priority maps — unchanged. Which stats are shown, how computed, their order: **identical**.
- **Refs / portals:** `createPortal(DocViewer …)` unchanged.
- **a11y:** `aria-expanded` on toggles, `aria-hidden`/`focusable={false}` on icons, `title`/`alt` attributes — unchanged.
- **`data-session-id`** attribute preserved.

Only **visual** surface changes: the `--ssv-*` token *definitions* (color/font/radius/shadow), now sourced from `--pn-*`, gaining automatic light+dark.

---

## 7. Final edit plan (LOCKED — execute on FOUNDATION-DONE go-ahead)

1. **`styles-session-stats.css` lines 11–69:** redefine each `--ssv-*` as `var(--pn-*)` per §2–§4 and the Locked Decisions table. Keep all `.ssv-*` rule bodies byte-identical.
   - Baton family → `--pn-brand` / `--pn-brand-2` / `--pn-brand-soft` (lighter tints collapse to `--pn-brand`, §5.1).
   - `--ssv-on-accent` → fixed literal `#20160a` (§5.3); the 3 avatar-text sites reference `var(--ssv-on-accent)` (no raw hex).
   - `--ssv-inner-top` → `var(--pn-sh-sm)` (§5.4).
   - Delete `--ssv-baton-rgb` (§5.6) after the glow is removed.
2. **Root bg (`.css:77–79`):** drop the radial gradient → flat `var(--pn-paper)` (§5.5).
3. **Scrollbar (`.css:92/96`):** thumb `--pn-line-2`, hover `--pn-ink-4` (§5.7).
4. **User-bubble border (`.css:837`):** → `--pn-line-2` (§5.6).
5. **Avatar text literals (`.css:261/308/1043`):** `color:#0a0c10` → `color: var(--ssv-on-accent)`; define `--ssv-on-accent: #20160a` once in the token block (§5.3, single source of truth).
6. **`SessionStatsView.tsx`:** §5.2 warn split — `SEVERITY_COLOR.warn` (:245) & `PRIORITY_VISUAL.medium` (:266) → `--pn-wait`/`--pn-wait-soft`; user-message accents (:949/:955/:964) → `--pn-brand` + `--pn-brand-soft`. AGENT_HUES + viz hues kept verbatim.
7. **Scope:** no guard — `data-redesign` is global default-on; verify view renders in-scope after foundation publishes.
8. **Verify:** `bun run build:ui` typecheck pass + light & dark screenshots diffed against the paper aesthetic.

---

**Status:** Contract finalized with coordinator-approved decisions. **Holding for explicit `FOUNDATION-DONE.md` go-ahead before any edit.**
