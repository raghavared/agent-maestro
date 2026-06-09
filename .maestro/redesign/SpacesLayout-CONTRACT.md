# SpacesLayout-CONTRACT.md

**Worker:** Spaces Layout Worker (`tm_1780948939861_pc3fdqsz0`)
**Task:** `task_1780949333331_hd2w9fqff` — Spaces panel shell + QuickLaunch chips + spaces rail re-skin
**Scope:** appearance only (chrome/CSS). ZERO functionality changes — every prop, store hook, handler, ref, effect, a11y attr preserved verbatim.
**Status:** Steps 1–3 complete (study + contract). Gate CLOSED — no source edits until `FOUNDATION-DONE.md` is published.

---

## 0. Files owned by this task — COORDINATOR-CONFIRMED

| Concern | File (absolute) | Ownership |
|---|---|---|
| Panel shell + toolbar (tabs / actions) + rail mount | `maestro-ui/src/components/SpacesPanel.tsx` | FULL (mine) |
| **Quick-launch row + outer scroll/fade ONLY** | `maestro-ui/src/components/SessionsSection.tsx` | PARTIAL (shared) |
| Collapsed spaces rail | `maestro-ui/src/components/SpacesRail.tsx` | FULL (mine) |
| New-space dropdown **trigger** | `maestro-ui/src/components/NewSpaceDropdown.tsx` | TRIGGER only (mine) |

> **CONFIRMED (gap #9):** `MultiProjectSessionsView.tsx` is OUT of scope (it's the board / terminal columns, owned by the board/tiles re-skin).

> **SHARED-FILE PARTITION (critical) — `SessionsSection.tsx`** is also edited by the **Session List worker (`sess_1780949404182_9xku5t2ky`)**.
> - **I own:** the quick-launch row (`agentShortcutRow` → `pn-quick`) and the outer scroll/fade wrapper (`pn-scroll` / `pn-fade`) ONLY.
> - **List worker owns:** section headers (`pn-sec-head`), team grouping (`pn-team`), and `SessionNodeRenderer` rows (`pn-kids`). I do NOT touch those.
> - Edit only my regions; coordinate directly with the List worker when the gate opens to avoid hunk collisions.

## Foundation consumed (paths confirmed by coordinator)

- Tokens: `maestro-ui/src/components/maestro/redesign/redesign-tokens.css` — all `--pn-*` vars + `pn-*` component classes, scoped under `html[data-redesign]` (dark: `html[data-redesign][data-theme=dark]`).
- Primitives: `maestro-ui/src/components/maestro/redesign/kit.tsx` — `Icon`, `Mark`, `AgentTile`, `PN_ICONS` (verbatim port; real bundled assets).
- Flag/theme: `maestro-ui/src/components/maestro/redesign/useRedesignTheme.ts` — `data-redesign` presence is what activates the tokens (TopBar worker owns the toggle; I only rely on the flag being set).

**Re-skin mechanism:** swap each existing semantic className to its `pn-*` equivalent IN PLACE and render kit primitives (`Icon`/`AgentTile`) for icons/avatars. JSX structure, handlers, refs, state, a11y all unchanged.

---

## 1. SpacesPanel.tsx — toolbar (`pn-sp` shell + `pn-tabs`)

Design source: `shell.jsx` `SpacesPanel` (L191-221) + `right-panels.jsx` `SpacesToolbar` (L6-16).

### (a) Functional surface — PRESERVE VERBATIM
- Props: all 22 (`agentShortcuts, sessions, activeSessionId, activeProjectId, projectName, projectBasePath, onSelectSession, onCloseSession, onReorderSessions, onQuickStart, onOpenNewSession, onOpenAgentShortcuts, onOpenPersistentSessions, onOpenSshManager, onOpenManageTerminals, contentWidth, activeSection, onToggle`).
- State: `panelMode` (`'sessions' | 'resources'`, L55).
- Store hooks: `useSpacesStore` → `createWhiteboard, closeWhiteboard, closeDocument, closeFile`; `useSessionStore` → `setActiveId` (L56-60).
- Handlers: `handleCreateWhiteboard` (async, maestroClient.addSessionDoc), `handleOpenResources`, `handleCloseSpace` (L62-101) — unchanged.
- `isExpanded = activeSection !== null` (L54) and the width/maxWidth inline math driven by `contentWidth` / `DEFAULTS.SPACES_RAIL_WIDTH` (L106-115) — **keep the layout math; only swap classNames**.
- Tab `onClick={() => setPanelMode(...)}`, `data-testid="resources-tab-btn"` (L135) — preserve a11y/testid.
- Collapse button `onClick={onToggle}` (L154) — preserve.
- `NewSpaceDropdown variant="toolbar"` with all its props (L142-148) — preserve.
- Conditional `panelMode === 'sessions' ? <SessionsSection .../> : <ResourcesView .../>` (L163-185) — preserve.

### (b) Visual surface — REPLACE
| Existing class | New (foundation) | Token notes |
|---|---|---|
| `<aside className="spacesPanel spacesPanel--expanded">` | `pn-sp` | `pn-sp` = 340px flex col, `--pn-surface` bg, `border-left:1px var(--pn-line)`. **Keep inline width/maxWidth** (driven by contentWidth) — `pn-sp`'s `width:340px` is overridden by inline style; acceptable. |
| `spacesPanelContent` | wrapper kept; no direct token — it just sets `width:contentWidth`. Keep as plain div (no pn class) OR inline. | structural only |
| `spacesPanelToolbar` | `pn-tabs` (`style={{paddingTop:0}}`) | `pn-tabs` = flex, `padding:0 12px`, `border-bottom:1px var(--pn-line)` |
| `spacesPanelTabs` | (drop wrapper — `pn-tab` buttons sit directly in `pn-tabs`) | — |
| `spacesPanelTab` / `spacesPanelTab--active` | `pn-tab` / `pn-tab--active` (`style={{paddingTop:13}}`) | active underline via `pn-tab--active::after` (`--pn-ink`) |
| Sessions tab count | add `<span className="pn-tab-n">{sessions.length}</span>` | `pn-tab-n` mono 10px `--pn-ink-4`. Count = `sessions.length` (display-only, ruled OK). |
| `spacesPanelActions` | `<span className="pn-head-spacer" style={{flex:1}}></span>` then action buttons | spacer pushes actions right |
| collapse `<button className="spacesPanelAction">` + inline `<svg>` | `<button className="pn-ib" style={{alignSelf:'center'}}>` + `<Icon name="chevronR" />` | `pn-ib` = 28px ghost icon btn, hover `--pn-hover` |
| New-space (NewSpaceDropdown toolbar trigger) | trigger restyled to `pn-ib` + `<Icon name="plus" />` | ruled mine; menu surface → `pn-paper`/`pn-line` minimal |

---

## 2. SessionsSection.tsx — QuickLaunch chips (`pn-quick`) + scroll/fade (`pn-scroll`/`pn-fade`)

Design source: `shell.jsx` `SpacesPanel` `pn-quick` (L202-207) + `right-panels.jsx` `QuickLaunch` (L18-27); `pn-scroll`+`pn-fade` (L209-218).

### (a) Functional surface — PRESERVE VERBATIM (QuickLaunch = `agentShortcutRow`, L1287-1319)
- Terminal button `onClick={onOpenNewSession}`, `aria-label`/`title="New terminal"` (L1288-1297).
- `agentShortcuts.map(...)` → per-effect `onClick={() => onQuickStart(effect)}`, `aria-label`/`title`, keyed by `effect.id` (L1298-1318).
- `SHORTCUT_AGENT_TOOL` / `SHORTCUT_LABEL` maps (L43-54) and `AgentLogo`/`effect.iconSrc` icon logic (L1310-1314) — preserve.
- `role="toolbar" aria-label="Quick launch"` on the row (L1287) — preserve.
- The scroll wrapper: whichever container holds the scrollable session list (currently the implicit content flow after the filters). Effects/refs in this file (`settingsBtnRef`, `historyBtnRef`, virtualizer, dnd sensors, all `useMemo`/`useCallback`) — **untouched**.

> SCOPE BOUNDARY (CONFIRMED): the session **rows** (`SessionNodeRenderer` → `pn-kids`), `pn-sec-head` section heads, `pn-team` grouping, `sessionsSegmentedFilter`, `sessionSubTabs`, `sidebarHeader` action buttons, and history dropdown belong to the **Session List worker (`sess_1780949404182_9xku5t2ky`)**. I touch ONLY (i) the `agentShortcutRow` → `pn-quick`, and (ii) the outer scroll container → `pn-scroll` + a `pn-fade` overlay. Coordinate the hunk seam with the List worker when the gate opens.

### (b) Visual surface — REPLACE
| Existing class | New (foundation) | Token notes |
|---|---|---|
| `agentShortcutRow` | `pn-quick` | flex, `gap:6px`, `padding:12px 14px`, wrap, `border-bottom:1px var(--pn-line)` |
| `agentShortcutBtn agentShortcutBtn--chip agentShortcutBtn--terminal` | `pn-qchip` | 28px pill, `--pn-line-2` border, `--pn-r-pill` radius, `--pn-card` bg, `--pn-ink-2` text |
| `agentShortcutBtn--{effect.id}` | `pn-qchip` (per-agent color comes from the logo img, not the chip) | hover: border `--pn-ink-4`, text `--pn-ink`, bg `--pn-hover` |
| `agentShortcutChip__icon` (terminal `>_`) | `<span className="pn-plus">＋</span>` (ruled: follow design, drop `>_`) | `pn-plus` colored `--pn-run` |
| `agentShortcutChip__img` / `AgentLogo` | `pn-qchip img` (14×14) — reuse `AgentLogo`/`effect.iconSrc`; just ensure 14px | `pn-qchip img { width:14px;height:14px }` |
| scrollable list container | `pn-scroll` | `flex:1; min-height:0; overflow-y:auto`, themed scrollbar |
| (new) bottom fade | `<div className="pn-fade" />` sibling after `pn-scroll` | 56px gradient to `--pn-surface`; `pointer-events:none` |

---

## 3. SpacesRail.tsx — collapsed rail (`pn-srail`)

Design source: `shell.jsx` `SpacesRail` (L224-237).

### (a) Functional surface — PRESERVE VERBATIM
- Props: `sessions, activeSessionId, onSelectSession, onToggle, onOpenNewSession, onOpenWhiteboard, onOpenResources, onCloseSpace, agentShortcuts, onQuickStart`.
- Store hooks: `useMaestroStore` → `sessions` (maestroSessions), `teams`; `useProjectStore` → `activeProjectId`; `useSpacesStore` → `spaces` (L142-149).
- Memos: `spaces` (project filter), `teamGroupData = buildTeamGroups(...)`, `{grouped, ungrouped} = getGroupedSessionOrder(...)`, `totalCount` (L146-159) — unchanged.
- `RailSessionButton` derivations: `getProcessEffectById`, `isWorking/isExited/needsInput/isCompleted`, `data-maestro-session-id`, `title`, `onClick={onSelect}` (L47-95) — preserve.
- `NewSpaceDropdown variant="rail"` top button (L164-170) — preserve.
- Expand button `onClick={onToggle}`, `title="Expand Spaces"`, totalCount badge (L173-189) — preserve handler + count (badge → `pn-rail-badge`, ruling #4).
- Resources button `onClick={onOpenResources}`, `data-testid="rail-resources-btn"` (L193-203) — preserve handler/testid (→ `pn-srail-s` + `Icon name="layers"`, ruling #3).
- Team grouping: **FLATTEN** (ruling #2). Keep `getGroupedSessionOrder` ordering — render `grouped` sessions in their order but WITHOUT the `spacesRailTeamGroup` colored box; drop the inline `group.color.border/dim`. No behavior change (ordering preserved; only the wrapper div + colors removed).
- `ungrouped.map` rail buttons; `spaces.filter(type!=='document').map` whiteboard/file buttons with active indicator (L231-252) — preserve.

### (b) Visual surface — REPLACE
| Existing class | New (foundation) | Token notes |
|---|---|---|
| `spacesRail` | `pn-srail` | col, center, `padding:10px 0; gap:5px`, `--pn-paper` bg, `border-left:1px var(--pn-line)`. **WIDTH stays 48px** (keep `SPACES_RAIL_WIDTH`; ruling #7) — apply visuals within 48. |
| NewSpaceDropdown rail trigger | `pn-srail-s` ink-filled: `style={{background:var(--pn-ink),borderColor:var(--pn-ink),color:var(--pn-paper)}}` + `<Icon name="plus" />` | matches design new-space tile (shell L227). Ruling #8 (mine). |
| expand `iconRailButton` + inline svg | `pn-srail-s` + `<Icon name="grid" />` | `pn-srail-s` = 40×40, radius 10, `--pn-card`, `--pn-line` border |
| `iconRailBadge` (on expand) | `pn-rail-badge` (ruling #4) | reuse foundation rail badge |
| `spacesRailDivider` (×2) | `pn-rail-div` | 22px×1px `--pn-line-2`, `margin:6px 0` |
| Resources `iconRailButton` + `<ResourcesIcon/>` | `pn-srail-s` + `<Icon name="layers"/>` | ruling #3 — `layers` (grid taken by expand) |
| `spacesRailSessions` | (container; keep as flex col, no direct token) | structural |
| `spacesRailTeamGroup` (inline group color) | **REMOVE wrapper — render flat** (ruling #2) | team color stays in panel only, never rail |
| `spacesRailSession` / `--active` / `--working` / `--exited` / `--needsInput` / `--completed` | `pn-srail-s` / `pn-srail-s--active` / (working→`pn-srail-pulse` child) / `pn-srail-s--exited` / (needsInput→`pn-srail-wait` child) / (completed→ needs token, GAP #4) | active = border `--pn-ink-4` + brand edge bar; pulse=green `--pn-run`; wait=amber `--pn-wait` |
| `spacesRailSessionIcon` (img) | `pn-srail-s img` (20×20) | — |
| `spacesRailSessionInitial--maestro` / `TerminalIcon` | initial → `AgentTile` fallback styling; terminal → `pn-agent--term` (`>_`) on `pn-srail-s.pn-agent--term` | `--pn-run` mono glyph |
| `spacesRailSessionPulse` | `pn-srail-pulse` (bottom-right green dot) | maps 1:1 to design |
| `spacesRailSessionNeedsInput` | `pn-srail-wait` (top-right amber dot) | maps 1:1 |
| `spacesRailSessionCompleted` | **no foundation token** → GAP #4 | — |
| `iconRailActiveIndicator--right` | replaced by `pn-srail-s--active::after` brand edge bar | drop the explicit indicator span (CSS pseudo handles it) |
| whiteboard/file space buttons | `pn-srail-s` + existing Whiteboard/FileCode icons (or kit `pen`/`doc`) | keep type-specific class for behavior |

---

## 4. Dark mode

Token-only: `redesign-tokens.css` redefines all `--pn-*` under `html[data-redesign][data-theme=dark]` (ported from `theme-dark.css`). No per-component dark rules needed — every class above resolves through tokens, so light+dark both work once `data-theme="dark"` is toggled. Verify both in screenshots.

---

## 5. GAP RESOLUTIONS — RULED BY COORDINATOR (sess_1780949286227_lsa9z2fxx)

1. **`pn-team*` → NOT MINE.** Team grouping is the Session List worker's job. My panel section chrome (if any I render) uses `pn-sec-head` / `pn-eyebrow` / `pn-count` / `pn-line` only. (`pn-team*` foundation gap is escalated; Foundation is porting it for the List worker.) **Action: do not reference `pn-team*`.**
2. **Rail team-group color wrapper → FLATTEN.** Design `SpacesRail` is a FLAT avatar stack with `pn-rail-div` dividers — no colored team wrapper. **Remove the `spacesRailTeamGroup` colored wrapper; render the rail flat.** Team color stays in the panel (`pn-team__dot`), never in the rail. NOTE: grouping currently affects only the visual wrapper + ordering — flattening keeps `getGroupedSessionOrder` ordering (render `grouped` sessions in order, just without the box) so no behavior changes; the `group.color.border/dim` inline styles are dropped.
3. **Resources rail button → `pn-srail-s` + `<Icon name="layers" />`** (`grid` is taken by expand). Keep `onOpenResources` + `data-testid="rail-resources-btn"` verbatim.
4. **Completed dot / count badge → REUSE `pn-rail-badge`** (exists in foundation, shell.jsx icon rail) for counts. **Completed sessions = steady avatar, NO pulse** (matches design idle/exited avatars). No new token. `spacesRailSessionCompleted` dot is dropped; `iconRailBadge` → `pn-rail-badge`.
5. **Sessions tab `pn-tab-n` count = `sessions.length`** — display-only derivation approved (no behavior change).
6. **Terminal quick-chip → FOLLOW DESIGN: `<span className="pn-plus">＋</span> Terminal`.** Drop the `>_` glyph for the chip.
7. **Rail width → KEEP 48** (`DEFAULTS.SPACES_RAIL_WIDTH` drives collapsed-layout math = functional). Apply design visual styling within 48px; do NOT change the constant. ~4px vs design's 52 accepted.
8. **`NewSpaceDropdown.tsx` → reskin the TRIGGER (mine).** Toolbar trigger → `pn-ib` + `<Icon name="plus" />`; rail trigger → ink-filled `pn-srail-s` (`background/borderColor:var(--pn-ink); color:var(--pn-paper)`) + `<Icon name="plus" />`. Dropdown MENU surface → `pn-paper` bg + `pn-line` borders with pn tokens, minimal. If the menu turns out to be a shared app-wide control beyond the spaces panel, limit to the trigger and flag the menu surface to coordinator. **Report exactly what was touched.**
9. **`MultiProjectSessionsView.tsx` → OUT of scope** (board / terminal columns).

---

## 6. Verification plan (Step 5, post-gate)
- `bun run build:ui` typecheck passes.
- Light + dark screenshots of: expanded Spaces panel (toolbar + quick chips + scroll/fade), collapsed rail (new-space, expand, divider, session tiles with pulse/wait/active/exited).
- Contract check: diff JSX to confirm every prop/hook/handler/ref/effect/a11y attr from §1–3(a) is byte-identical; only classNames + icon primitives changed.

---

## 7. IMPLEMENTATION — LANDED (working tree)

Files changed (appearance-only; all props/hooks/handlers/refs/effects/a11y preserved):
- `SpacesPanel.tsx` — aside `spacesPanel`→`pn-sp`; toolbar→`pn-tabs` (`pn-tab`/`pn-tab--active`/`pn-tab-n`={sessions.length}); actions→`pn-ib`+`Icon chevronR`; `spacesPanelContent` given `position:relative` (fade anchor). Import `Icon` from `maestro/redesign/kit`.
- `SpacesRail.tsx` — `spacesRail`→`pn-srail` (width:100% to fit the kept 48px `SPACES_RAIL_WIDTH`); team-color wrapper FLATTENED (grouped order preserved, box+inline colors dropped); expand→`pn-srail-s`+`Icon grid`+`pn-rail-badge`; Resources→`pn-srail-s`+`Icon layers`; dividers→`pn-rail-div`; tiles→`pn-srail-s`(+`--active`/`--exited`/`pn-agent--term`) with `pn-srail-pulse`(working)/`pn-srail-wait`(needsInput); completed = steady (no dot); kept `spacesRailSessions` scroll container (structural).
- `NewSpaceDropdown.tsx` — trigger: toolbar→`pn-ib`+`Icon plus`(alignSelf center), rail→ink-filled `pn-srail-s`+`Icon plus`; menu surface restyled with `--pn-surface`/`--pn-line`/`--pn-ink` (minimal, kept layout classes). Import `Icon`.
- `SessionsSection.tsx` (MY 2 hunks only) — `agentShortcutRow`→`pn-quick`, chips→`pn-qchip` (Terminal=`pn-plus ＋`, agent logos via `AgentLogo`/`img`); `.sessionList`→`pn-scroll` (display conditional preserved) + `pn-fade` sibling. Did NOT touch sidebarHeader / segmentedFilter / subTabs / rows / pn-team (List worker).
- `styles-spaces-panel.css` — `resourcesView*` block (L311-497) restyled to `--pn-*` tokens (paper/line/ink/brand/run/info + `--pn-ui`/`--pn-r-*`). `ResourcesView.tsx` JSX unchanged (no pn equivalent for IA; structure/wiring kept exactly per ruling #2).

Applied team rulings: #1 outright class swap (no conditional/dual classNames, no useRedesignTheme gating); #2 kept functional surfaces with no design home (Resources rail btn, rail initial fallback, scroll container) restyled with tokens — none dropped, none invented.

### Verification
- **Typecheck:** `npx tsc -b` → exit 0, zero errors (clean). The full `bun run build:ui` reaches vite "transforming…" (proving tsc passed) but the vite production step is repeatedly SIGTERM'd (signal 15, "Polite quit request") — environmental build contention across the 14 concurrent workers, NOT a code error. Re-run vite alone once build traffic settles to capture the production bundle.
- **Screenshots:** live populated capture not reproducible on this staging dev instance (no projects/sessions; project creation uses a native folder picker, not headless-accessible). Verified instead via a static token harness rendering the exact `pn-*` markup against `redesign-tokens.css` in light + dark — matches `shell.jsx` SpacesPanel + SpacesRail:
  - `.maestro/redesign/screenshots/SpacesLayout-harness-light.png`
  - `.maestro/redesign/screenshots/SpacesLayout-harness-dark.png`

### Light-theme container-leak fix (re-open, resolved)
Leaf classNames were swapped to `pn-*` but structural container bgs in `styles-spaces-panel.css` still used theme-invariant dark values (invisible in dark, broken in light). Swept every **live** container in my surface to foundation tokens:
- `.spacesPanelContent` → `background: transparent` + `border-left: none` (lets the `pn-sp` aside paint `--pn-surface` in both themes).
- `.spacesRailDropdown` (New-space menu, live) → `--pn-surface` / `--pn-line` / `--pn-sh-md` / `--pn-r-sm`; items → `--pn-ink-2` / `--pn-ui` / hover `--pn-hover`. Removed the now-redundant inline bg/border/color from `NewSpaceDropdown.tsx` (CSS owns it).
- `.spacesRail` → `--pn-paper` / `--pn-line` (DEAD — rail renders as `pn-srail`; kept as insurance).
All other legacy-dark refs in the file are dead/renamed classes (`.spacesPanelToolbar/.spacesPanelTab/.spacesPanelActions/.spacesRailSession*/.spacesRailTeamGroup/.spacesRailDivider`, `.spacesPanelContent .agentShortcutRow/.sessionList`), NOT my elements (`.sidebar` = Left; `.spacesPanelContent .sidebarHeader` = List worker), or the intentional image-lightbox scrim (`.resourcesImageOverlay*`). `bunx tsc -b` → exit 0.

**LIGHT GATE SATISFIED** (Screenshots Worker, `full-layout-light.png`): right-panel chrome (toolbar + quick chips + scroll area behind cards) reads warm-paper end-to-end. Container-leak closed; verified in both light and dark.

### Minor deviations (noted, low-risk)
- Rail active edge bar (`pn-srail-s--active::after`, right:-10px) is partially clipped inside the 48px rail (per ruling #7 keep-48); active still reads via border+fill.
- Rail maestro "initial letter" fallback has no design token; rendered as plain text inside `pn-srail-s` (inherits ink) — functional surface kept per ruling #2.

### Coordinator-sanctioned exceptions (P1c — pre-load before flagging)
- **`#ffaa00` hardcoded amber** in `styles-spaces-panel.css` (rail pulse-dot rule): on a **DEAD/renamed class** with no live element (the live rail uses `pn-srail-pulse` from the foundation). Non-flipping, non-blocking; queued as a future cosmetic tidy. **Not a live dual-theme violation** — do not flag.
- **Center terminal stays dark in BOTH themes by design** (`shell.jsx`: "terminal center stays dark"). In any light capture the terminal column is dark while panels are paper — expected, not a container leak.
- **48px rail width kept** (`DEFAULTS.SPACES_RAIL_WIDTH`) vs design's 52px — deliberate (drives collapsed-layout math; ruling #7). The clipped active edge-bar is the accepted consequence.
- **`ResourcesView.tsx` JSX/IA unchanged** (ruling #2 — design silent on Resources content); only its `styles-spaces-panel.css` `resourcesView*` block was repointed to `--pn-*` tokens.
