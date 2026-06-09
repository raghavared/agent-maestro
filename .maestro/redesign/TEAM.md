# Maestro Redesign — Team Members & Task Assignments

19 members total. All run on **`claude-opus-4-8[1m]`** (Opus 4.8 with 1M-token context).
Branch: `maestro-redesign`. Plan: `.maestro/redesign/PLAN.md`.

## Team member ID registry

| Slug | Avatar | Name | ID | Mode |
|---|---|---|---|---|
| foundation | 🧱 | Redesign Foundation Engineer | `tm_1780948938536_noqih1g29` | worker |
| left_coord | 🧭 | Left Panel Coordinator | `tm_1780948938669_3ugg9ikkv` | coordinator |
| left_iconrail | 🎚️ | Icon Rail Worker | `tm_1780948938792_yyg2rl326` | coordinated-worker |
| left_shell | 🗂️ | Maestro Panel Shell Worker | `tm_1780948938920_sypksn5wm` | coordinated-worker |
| left_listtree | 🌲 | Task List & Tree Worker | `tm_1780948939045_veaws1m9e` | coordinated-worker |
| left_tile | 🟦 | Task Tile Worker | `tm_1780948939178_ntw6sjc3w` | coordinated-worker |
| mid_coord | 🎛️ | Middle Panel Coordinator | `tm_1780948939299_d0m1zhizq` | coordinator |
| mid_term | 💻 | Terminal Theme Worker | `tm_1780948939436_q7ap3u0fe` | coordinated-worker |
| mid_stats | 📊 | Session Stats Theme Worker | `tm_1780948939575_17886a7jb` | coordinated-worker |
| right_coord | 🧩 | Right Panel Coordinator | `tm_1780948939727_148ykok8p` | coordinator |
| right_layout | 🪟 | Spaces Layout Worker | `tm_1780948939861_pc3fdqsz0` | coordinated-worker |
| right_list | 📜 | Session List Worker | `tm_1780948939988_p44zlteor` | coordinated-worker |
| right_tile | 🎴 | Session Tile Worker | `tm_1780948940118_o0obnlthy` | coordinated-worker |
| misc_coord | 🧰 | Misc Coordinator | `tm_1780948940236_xytclu2gp` | coordinator |
| misc_top | 🪧 | Project Bar / TopBar Worker | `tm_1780948940364_m0hjcurua` | coordinated-worker |
| misc_taskmodal | ➕ | Task Create Modal Worker | `tm_1780948940503_yqq1c649j` | coordinated-worker |
| misc_teamodal | 👤 | Team Member Modal Worker | `tm_1780948940669_urd37beqv` | coordinated-worker |
| misc_settings | ⚙️ | Settings Panel Worker | `tm_1780948940802_hkx8mi2bf` | coordinated-worker |
| misc_sweep | 🧹 | Modal Sweep Worker | `tm_1780948940921_2zck1yd0x` | coordinated-worker |

## Universal worker protocol (MANDATORY for every worker)

Every worker MUST follow this exact sequence — no skipping:

1. **READ the existing implementation** — open every file in your scope under `maestro-ui/src/components/maestro/`. Catalogue: every prop, every store hook (`useSessionStore`, `useTaskStore`, `useProjectStore`, etc.), every event handler, every ref, every `useEffect`/`useMemo`, every side effect, every accessibility attribute.
2. **READ the new design** — open the corresponding section in `panel-redesign/` (`shell.jsx` for layout, `theme.css`/`theme-dark.css` for tokens, `kit.jsx` for primitives, plus the specific variant file like `left-panels.jsx` Ledger / `right-panels.jsx` Roster / `tiles.jsx` / `modals.jsx`).
3. **Cross-reference** — write a side-by-side mapping (`<scope>-CONTRACT.md`) of: (a) functional surface to preserve verbatim, (b) visual surface to replace, (c) which exact foundation tokens and kit primitives each piece of the new design uses. This contract is the consistency guarantee — adopt nothing freehand.
4. **Adopt the new design** — modify the existing file IN PLACE. Pull every colour, spacing, font, radius, shadow from foundation tokens; pull every icon/avatar/dot/chip/button from kit primitives. Match the design exactly — same class semantics, same hierarchy, same spacing rhythm.
5. **Verify consistency** — diff your final result against `panel-redesign/` visually (light + dark screenshot side-by-side). Verify your contract: every prop/hook/handler/ref preserved verbatim.
6. **Report complete** with contract + screenshots + typecheck pass.

## Universal worker rules

- **Zero functionality changes** — preserve every prop, store hook, handler, ref, side effect, useEffect, useMemo verbatim. Visual layer only.
- **No hard-coded design values** — every colour, spacing, font, radius, shadow comes from foundation tokens. Never improvise.
- **No freehand design** — every layout choice maps to a specific class/structure in `panel-redesign/`. If the design is silent on something, escalate to the panel coordinator, not invent.
- **In-place modification** — edit existing files under `maestro-ui/src/components/maestro/`. Do not create parallel `redesign/` files (except the foundation kit primitives directory).
- **Source of truth:** `panel-redesign/shell.jsx` for layout, `theme.css`/`theme-dark.css` for tokens, `kit.jsx` for primitives.
- **Themes:** scope everything under `<html data-redesign>` and respect `<html data-theme="dark">` for dark mode.
- **Deliverables per worker:** (a) `<scope>-CONTRACT.md` with old-vs-new mapping, (b) in-place implementation, (c) light + dark screenshot, (d) `bun run build:ui` typecheck pass.

---

## Phase 0 — Foundation (BLOCKING)

### 🧱 Redesign Foundation Engineer — `worker`
**Task:** Port the design system so every panel worker has a complete kit to draw from.

**Deliverables:**
1. Port `panel-redesign/theme.css` → `maestro-ui/src/styles/redesign/theme.css` — every CSS variable copied verbatim, scoped under `:where([data-redesign])` and root selectors so it doesn't bleed.
2. Port `panel-redesign/theme-dark.css` → `maestro-ui/src/styles/redesign/theme-dark.css` — dark overrides, scoped to `[data-redesign][data-theme="dark"]`.
3. Import the theme stylesheets in `maestro-ui/src/main.tsx` (or root entry).
4. Wire a theme toggle that flips `<html data-theme>` — wired into the existing UI shell (top bar settings menu or visible toggle).
5. Wire a `<html data-redesign>` flag (default on for this branch).
6. Port `panel-redesign/kit.jsx` primitives to TypeScript under `maestro-ui/src/components/maestro/redesign-kit/`:
   - `Icon.tsx` — name → SVG map, props `{ name, size?, sw? }`
   - `Mark.tsx` — Maestro logo mark
   - `AgentTile.tsx` — agent avatar (claude/codex/gemini/terminal/custom), props `{ kind, lg? }`
   - `StatusDot.tsx` — `pn-dot` variants (run/wait/idle/block, live pulse)
   - `Chip.tsx`, `Tag.tsx`, `Kbd.tsx`, `Button.tsx` — match panel-redesign class semantics
7. Publish `FOUNDATION-DONE.md` on assigned task with: list of every exported primitive, its props, its CSS classes, and a usage snippet. This unblocks Phase 1 implementation.

**Acceptance:** typecheck passes, `bun run build:ui` succeeds, existing pages still render unchanged (because `data-redesign` flag isolates new tokens).

---

## Phase 1a — Left Panel (Maestro panel)

### 🧭 Left Panel Coordinator — `coordinator`
**Task:** Own end-to-end redesign of the left side (icon rail + Maestro panel). Spawn 4 workers below, sync their work, hand-off contracts. Wait for `FOUNDATION-DONE.md` before workers begin implementation; they may study old/new in parallel.

**Existing files in scope:**
- `maestro-ui/src/components/maestro/PanelIconBar.tsx`
- `maestro-ui/src/components/maestro/MaestroPanel.tsx`
- `maestro-ui/src/components/maestro/TaskCard.tsx`
- `maestro-ui/src/components/maestro/SortableTaskList.tsx`
- `maestro-ui/src/components/maestro/TaskFilters.tsx`

**Design source:** `panel-redesign/shell.jsx` (Ledger left), `panel-redesign/left-panels.jsx` Ledger section, `panel-redesign/tiles.jsx`.

---

### 🎚️ Icon Rail Worker — `coordinated-worker`
**Existing:** `PanelIconBar.tsx`
**Design:** `pn-rail` from `shell.jsx` — vertical rail, Maestro mark at top, tasks/members/teams/skills/lists/graphs/files buttons with badge counts, spacer, whiteboard + settings at bottom.
**Task:** Re-skin `PanelIconBar.tsx` in place. Use `pn-rail`, `pn-rail-mark`, `pn-rail-btn`, `pn-rail-btn--active`, `pn-rail-badge`, `pn-rail-spacer` classes from foundation tokens. Icons via foundation `<Icon>` primitive. Preserve every onClick handler and route, every badge count source from existing stores.

---

### 🗂️ Maestro Panel Shell Worker — `coordinated-worker`
**Existing:** `MaestroPanel.tsx` (shell only — head, subbar, search, filters, scroll, fade, footer; NOT the task tree itself)
**Design:** `pn-mp` from `shell.jsx` — `pn-head` (project name + chevron, more button), `pn-subbar` (New task primary button + Current/Pinned/Completed/Archived subtabs), `pn-search` (search input with ⌘K kbd), `pn-filters` (All/High/Mine pills + sort), `pn-scroll` with `pn-fade` bottom mask.
**Task:** Re-skin the shell layout of `MaestroPanel.tsx` in place. Preserve store wiring (`useTaskStore`, `useProjectStore`, etc.), preserve the filter state, preserve the search handler, preserve which subtab is active. Only the visual chrome changes.

---

### 🌲 Task List & Tree Worker — `coordinated-worker`
**Existing:** `SortableTaskList.tsx`, `TaskListItem.tsx`, sectioning logic in `MaestroPanel.tsx`
**Design:** `pn-sec-head` group headers ("In progress · 2", "Up next · 3"), `pn-eyebrow`, `pn-count`, `pn-line`. Recursive `TaskNode` from `shell.jsx`/`tiles.jsx` for parent → child task indenting.
**Task:** Re-skin the list/tree rendering in place. Preserve drag-and-drop (`@dnd-kit` sortable), preserve expand/collapse state, preserve all keyboard nav, preserve the grouping logic (just restyle the section headers). Section header counts must come from existing store derivations.

---

### 🟦 Task Tile Worker — `coordinated-worker`
**Existing:** `TaskCard.tsx`
**Design:** `pn-row` from `left-panels.jsx` LedgerLeft: lead status dot (`pn-dot--run/wait/idle/block`, optional `pn-dot--live` pulse), title, sub-row with priority tag (`pn-tag pn-tag--high/med/low`) + meta (#id, subtasks), trailing `AgentTile` + run button.
**Task:** Re-skin `TaskCard.tsx` in place. Preserve every click handler, hover state, context menu, every store-derived field, every drag handle, every accessibility attribute. Status dot variant must derive from existing task.status mapping.

---

## Phase 1b — Middle Panel (Terminal + Stats)

### 🎛️ Middle Panel Coordinator — `coordinator`
**Task:** Own the center column. Terminal stays dark even in light mode (per `shell.jsx`). Coordinate 2 workers. Wait for foundation, then dispatch.

**Existing files in scope:**
- `maestro-ui/src/components/maestro/MaestroSessionContent.tsx`
- `maestro-ui/src/components/maestro/SessionStatsView.tsx`
- `maestro-ui/src/components/maestro/SessionStatsIcons.tsx`
- Terminal chrome around `SessionTerminal.tsx` (existing terminal component)

---

### 💻 Terminal Theme Worker — `coordinated-worker`
**Existing:** terminal chrome (`MaestroSessionContent.tsx` terminal wrapper, surrounding bars, input row)
**Design:** `pn-term` from `shell.jsx` — `pn-term-bar` (top dot + session name + agent · model + branch on right), `pn-term-body` (terminal area, dark surface, accent prompt `›`, ok lines, dim lines, file highlights), `pn-term-input` (slash prompt + placeholder + model · effort indicator).
**Task:** Re-skin the chrome around the existing xterm.js terminal. **Do not touch the xterm instance, the reparenting logic, the WebSocket wiring, the registry, or fit.fit()** — only the surrounding bars + colors. Terminal stays dark in both light and dark mode.

---

### 📊 Session Stats Theme Worker — `coordinated-worker`
**Existing:** `SessionStatsView.tsx`, `SessionStatsIcons.tsx` (just landed on `feature/session-stats-redesign`)
**Design:** Apply foundation tokens (typography, colors, spacing, hairlines) without changing the new stats layout. Match panel-redesign visual language: `--pn-paper`, `--pn-ink`, `--pn-ink-3`, hairline borders, `pn-meta` for dim text.
**Task:** Replace any hardcoded colours, fonts, paddings, radii in the new stats view with foundation tokens. Stats data sources, computation, and layout structure stay untouched.

---

## Phase 1c — Right Panel (Spaces)

### 🧩 Right Panel Coordinator — `coordinator`
**Task:** Own the right side (Spaces panel + spaces rail). Coordinate 3 workers. Wait for foundation, then dispatch.

**Existing files in scope:**
- `maestro-ui/src/components/maestro/MultiProjectSessionsView.tsx`
- `maestro-ui/src/components/maestro/SessionListItem.tsx`
- `maestro-ui/src/components/maestro/SessionDetailsSection.tsx`
- `maestro-ui/src/components/maestro/SessionActionBar.tsx`
- `maestro-ui/src/components/maestro/SessionLiveIndicator.tsx`
- Spaces rail (far-right) location TBD by coordinator during study phase

---

### 🪟 Spaces Layout Worker — `coordinated-worker`
**Existing:** `MultiProjectSessionsView.tsx` shell + `MaestroPanel.tsx` right-side wrapper if any + spaces rail
**Design:** `pn-sp` from `shell.jsx` — toolbar (Sessions/Resources tabs, new-space + collapse buttons), `QuickLaunch` (terminal/claude/codex/gemini chips), `pn-scroll` with `pn-fade`. `pn-srail` (far right) — new-space, expand, dividers, agent thumbnails with `pn-srail-pulse`/`pn-srail-wait`.
**Task:** Re-skin the layout chrome in place. Preserve tabs state, preserve "new session" flow, preserve session-thumbnail click → focus behaviour, preserve spaces persistence.

---

### 📜 Session List Worker — `coordinated-worker`
**Existing:** session grouping/listing logic inside `MultiProjectSessionsView.tsx`
**Design:** Per `shell.jsx` SpacesPanel — sections via `pn-sec-head`: "Running · 4", "Needs input · 1", "Idle · 2". Team grouping `pn-team` (head with dot + name + count, then nested session nodes). `SessionNode` recursion for coordinator → children indent.
**Task:** Re-skin the grouping + recursion in place. Preserve which sessions are grouped under which team/coordinator (data is from `useSessionStore`), preserve real-time WebSocket updates, preserve every collapse state.

---

### 🎴 Session Tile Worker — `coordinated-worker`
**Existing:** `SessionListItem.tsx`, `SessionLiveIndicator.tsx`
**Design:** `pn-sess` row: `AgentTile` (lg), name, status row (`pn-dot` + status text + elapsed), trailing chip (task ref) + more button. Variants: `pn-sess--active`, `pn-sess--wait`. Status text classes `pn-sess__statustext--wait/run`.
**Task:** Re-skin `SessionListItem.tsx` in place. Preserve click handler, preserve right-click context menu, preserve every status derivation from session state, preserve the live pulse logic.

---

## Phase 1d — Miscellaneous (Top bar + modals)

### 🧰 Misc Coordinator — `coordinator`
**Task:** Own top chrome and all modals. Coordinate 5 workers. Wait for foundation, then dispatch.

**Existing files in scope:**
- Top bar / window chrome (location: `App.tsx` or layout root — coordinator finds)
- `CreateTaskModal.tsx`
- `TeamMemberModal.tsx`, `TeamModal.tsx`, `ModelProfileModal.tsx`
- `TaskListModal.tsx`, `TaskListAddTasksModal.tsx`
- `SessionDetailModal.tsx`, `TeamLaunchConfigModal.tsx`
- Settings UI (location TBD by coordinator)

---

### 🪧 Project Bar / TopBar Worker — `coordinated-worker`
**Existing:** current top bar / window chrome
**Design:** `pn-top` from `shell.jsx` — `pn-lights` (traffic-light area on macOS), `pn-ptabs` (project tabs with status dot, active state, plus button for new tab), right side `pn-top-r` (theme toggle Moon/Sun, search button, ⌘K kbd).
**Task:** Replace existing top chrome with `pn-top`. Wire theme toggle button to foundation's `<html data-theme>` flip. Preserve project switching behaviour, preserve "new project" flow, preserve any Tauri title-bar drag region. If Tauri title-bar needs adjustment, do it carefully — verify drag + window controls still work in dev (`bun run dev:ui`).

---

### ➕ Task Create Modal Worker — `coordinated-worker`
**Existing:** `CreateTaskModal.tsx`
**Design:** `panel-redesign/modals.jsx` new-task modal + `modals.css` tokens.
**Task:** Re-skin the modal in place. Preserve form fields, validation, submit handler, store wiring, every keyboard shortcut (Esc to close, Enter to submit).

---

### 👤 Team Member Modal Worker — `coordinated-worker`
**Existing:** `TeamMemberModal.tsx`
**Design:** `panel-redesign/modals.jsx` new-team-member modal.
**Task:** Re-skin in place. Preserve avatar emoji picker, mode dropdown, model dropdown, identity textarea, skills selector, all form state.

---

### ⚙️ Settings Panel Worker — `coordinated-worker`
**Existing:** settings UI (locate during study)
**Design:** Foundation tokens applied to existing settings layout; reference `modals.css` for any modal-shaped settings overlays.
**Task:** Re-skin in place. Preserve every preference binding, every save handler, every read-back from settings store.

---

### 🧹 Modal Sweep Worker — `coordinated-worker`
**Existing:** `TeamModal.tsx`, `ModelProfileModal.tsx`, `TaskListModal.tsx`, `TaskListAddTasksModal.tsx`, `SessionDetailModal.tsx`, `TeamLaunchConfigModal.tsx`, plus any other modal/overlay discovered
**Design:** Apply foundation tokens — colours, fonts, paddings, hairlines, button styles, kbd hints. Match `modals.css` patterns.
**Task:** Sweep each remaining modal in place. Preserve every functional surface verbatim. Minimal layout change — restyle only.

---

## Summary table

| Phase | Member | Mode | Owns |
|---|---|---|---|
| P0 | 🧱 Redesign Foundation Engineer | worker | tokens, kit, theme toggle |
| P1a | 🧭 Left Panel Coordinator | coordinator | left side end-to-end |
| P1a | 🎚️ Icon Rail Worker | coordinated-worker | `PanelIconBar.tsx` |
| P1a | 🗂️ Maestro Panel Shell Worker | coordinated-worker | `MaestroPanel.tsx` shell |
| P1a | 🌲 Task List & Tree Worker | coordinated-worker | `SortableTaskList.tsx`, sectioning |
| P1a | 🟦 Task Tile Worker | coordinated-worker | `TaskCard.tsx` |
| P1b | 🎛️ Middle Panel Coordinator | coordinator | center column |
| P1b | 💻 Terminal Theme Worker | coordinated-worker | terminal chrome |
| P1b | 📊 Session Stats Theme Worker | coordinated-worker | `SessionStatsView.tsx` |
| P1c | 🧩 Right Panel Coordinator | coordinator | right side end-to-end |
| P1c | 🪟 Spaces Layout Worker | coordinated-worker | spaces panel layout |
| P1c | 📜 Session List Worker | coordinated-worker | session grouping |
| P1c | 🎴 Session Tile Worker | coordinated-worker | `SessionListItem.tsx` |
| P1d | 🧰 Misc Coordinator | coordinator | top + modals |
| P1d | 🪧 Project Bar / TopBar Worker | coordinated-worker | `pn-top` |
| P1d | ➕ Task Create Modal Worker | coordinated-worker | `CreateTaskModal.tsx` |
| P1d | 👤 Team Member Modal Worker | coordinated-worker | `TeamMemberModal.tsx` |
| P1d | ⚙️ Settings Panel Worker | coordinated-worker | settings UI |
| P1d | 🧹 Modal Sweep Worker | coordinated-worker | remaining modals |
