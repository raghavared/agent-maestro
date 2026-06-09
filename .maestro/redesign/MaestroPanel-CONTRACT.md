# MaestroPanel.tsx Shell Re-skin — CONTRACT

**Worker:** 🗂️ Maestro Panel Shell Worker (`tm_1780948938920_sypksn5wm`)
**Scope:** SHELL chrome of `maestro-ui/src/components/maestro/MaestroPanel.tsx` (775 lines) → `pn-mp` design.
**Coordinator:** Left Panel Coordinator (`sess_1780949253577_ei828bbjb`)
**Status:** Steps 1–3 complete (study + contract). Gate CLOSED — no source edits until `FOUNDATION-DONE.md`.
**Design source of truth:** `panel-redesign/shell.jsx` `MaestroPanel()` (canonical), `left-panels.jsx` `LedgerLeft()` (variant), `theme.css`, `kit.jsx`.

---

## 1. Functional surface — PRESERVE VERBATIM (zero behavior change)

Everything below stays untouched. Only the JSX wrapping/class names of the shell chrome change.

### Props (all preserved)
`isOpen`, `onClose`, `projectId`, `project`, `onCreateMaestroSession`, `onJumpToSession`, `onAddTaskToSession`, `forcedPrimaryTab`, `forcedTeamSubTab`.

### Store hooks (all preserved)
- `useTasks(projectId)` → `{ tasks, loading, error: fetchError }`
- `useMaestroStore(useShallow …)` → `createTask, updateTask, deleteTask, removeTaskFromSession, taskOrdering, fetchTaskOrdering, saveTaskOrdering, createTeam, sessions`
- `useMaestroStore(s => modelProfiles)` count, `useTaskLists`, `useTaskGraphStore`, `useSessionStore` (`activeId`, `sessions`), `useUIStore` (`createTaskRequested`, `showBoardRequested`, `setTaskDetailOverlay`)
- Extracted hooks: `useTeamMemberActions`, `useTeamActions`, `useExecutionMode`, `useTaskTree`, `useTaskSearch`

### Shell-owned UI state (PRESERVE)
- `searchQuery` / `setSearchQuery` — drives `useTaskSearch` → `searchMatchIds` → `filterBySearch`. **The search handler is `onChange={(e) => setSearchQuery(e.target.value)}` and the clear is `setSearchQuery("")`.**
- `taskSubTab` / `setTaskSubTab` (`current|pinned|completed|archived`) — **currently lives in PanelIconBar, see §4 BOUNDARY**
- `primaryTab` / `setPrimaryTab` (forced-aware), `teamSubTab`, `skillSubTab`
- `statusFilter`, `priorityFilter`, `sortBy`, `overdueFilter` — **rendered by `TaskFilters.tsx`, see §4 BOUNDARY**
- `showCreateModal` / `setShowCreateModal` — New-task button calls `setShowCreateModal(true)`
- `error` / `setError`, `fetchError` — error banner

### Derived counts feeding the subbar (PRESERVE source)
`activeRoots.length`, `pinnedRoots.length`, `completedRoots.length`, `archivedRoots.length` — all from existing `useMemo` derivations. Subtab badge numbers MUST read from these, never hardcoded.

### Handlers referenced by shell chrome (PRESERVE)
- New task → `setShowCreateModal(true)` (also `onNewTask` passed to PanelIconBar)
- Standup / "more" → `handleTeamStandup` (from `useTeamMemberActions`)
- All `useEffect`s (task-ordering fetch, createTask/showBoard request listeners, slide-out animation timers, collapsed-state init), all refs (`prevTaskStatusesRef`, `slideOutTimersRef`, `hasInitializedCollapsedRef`), early returns (`componentError`, `!isOpen`, `!projectId`) — UNTOUCHED.

### a11y / semantics (PRESERVE)
`type="text"` / `type="button"` on search input + clear, button roles, placeholder text semantics.

---

## 2. Visual surface — REPLACE (old class → new class + token/kit map)

| # | Element | OLD (current) | NEW (design) | Tokens / kit |
|---|---------|---------------|--------------|--------------|
| a | Panel container | `div.maestroPanel.terminalTheme` (+`--executionMode`) | `div.pn-mp` (keep exec-mode modifier as data attr/extra class) | `.pn-mp` → `width:340px; flex-col; background:var(--pn-surface); overflow:hidden` (theme.css:616) |
| b | **Panel header (NEW)** | *(none — project name is in TopBar)* | `div.pn-head` → `span.pn-proj{project.name <Icon chevronD>}` + `span.pn-head-spacer` + `button.pn-ib`(more/standup) | `.pn-head` (207), `.pn-proj` (218), `.pn-head-spacer` (225), `.pn-ib` (194); `<Icon name="chevronD" size=13>`, `<Icon name="more">` |
| c | Subbar (New task + subtabs) | inside `PanelIconBar` task subtabs | `div.pn-subbar` → `button.pn-btn.pn-btn--primary{<Icon plus 14> New task}` + spacer + 4×`button.pn-subtab` (Current/Pinned/Completed/Archived, active = `pn-subtab--active`, each with `<Icon>` + count) | `.pn-subbar` (620), `.pn-subtab(.--active)` (621-628), `.pn-btn.--primary` (170-184); icons `listChecks`,`pin`,`check`,`archive`,`plus` |
| d | Search | `div.taskSearchBar`(`__icon ⌕`, `__input`, `__clear ×`) | `div.pn-search` → `<Icon search>` + `<input placeholder="Search tasks">` + `span.pn-kbd ⌘K` | `.pn-search` (267), `.pn-kbd` (186); `<Icon name="search">` |
| e | Filters | `<TaskFilters …>` component | `div.pn-filters` → `button.pn-filter`(All/High/Mine, active=`--active`) + `button.pn-filter`(Sort, `marginLeft:auto`, `<Icon sliders 13>`) | `.pn-filters` (282), `.pn-filter(.--active)` (283-291) — **see §4 mapping** |
| f | Scroll container (MINE) | `div.terminalContent` (per-tab, inside TaskTabContent/SortableTaskList) | `div.pn-scroll` (single wrapper) | `.pn-scroll` (91-94) |
| g | Bottom fade mask (MINE) | *(none)* | `div.pn-fade` (absolute, bottom of pn-mp) | `.pn-fade` (80-87) |
| h | Section headers (NOT MINE → Tree worker) | *(none inline — sections are subtabs)* | `div.pn-sec-head` → `span.pn-eyebrow{label <span.pn-count>· N</span>}` + `span.pn-line` | rendered INSIDE my `pn-scroll` by Task List & Tree Worker (§4.3) |
| i | Error banner (MINE) | `div.terminalErrorBanner` | restyle with paper tokens, keep functional | `--pn-paper`/`--pn-ink`/`--pn-line` interim (§5) |

---

## 3. Token & primitive inventory (what I draw from foundation)

**CSS classes (from `theme.css`):** `.pn-mp`, `.pn-head`, `.pn-proj`, `.pn-head-spacer`, `.pn-ib`, `.pn-subbar`, `.pn-subtab`, `.pn-subtab--active`, `.pn-btn`, `.pn-btn--primary`, `.pn-search`, `.pn-kbd`, `.pn-filters`, `.pn-filter`, `.pn-filter--active`, `.pn-scroll`, `.pn-fade`, `.pn-sec-head`, `.pn-eyebrow`, `.pn-count`, `.pn-line`.

**Kit primitives (from foundation `maestro-ui/src/components/maestro/redesign/kit.tsx`; tokens `redesign/redesign-tokens.css`, theme hook `redesign/useRedesignTheme.ts`):** `<Icon name=… size=… sw=…>` with icons `chevronD, more, plus, listChecks, pin, check, archive, search, sliders`. (`<Mark>`/`<AgentTile>` are NOT used in shell chrome — Mark is in the icon rail, AgentTile in tiles.)

**Color/spacing tokens (verbatim, never hardcode):** `--pn-surface, --pn-paper, --pn-card, --pn-hover, --pn-active, --pn-line, --pn-line-2, --pn-ink, --pn-ink-2, --pn-ink-3, --pn-ink-4, --pn-brand, --pn-r-sm, --pn-r-pill, --pn-ui, --pn-mono`.

---

## 4. BOUNDARY OVERLAPS — RESOLVED by Left Panel Coordinator (sess_1780949253577_ei828bbjb)

All seams ruled. These are now binding implementation decisions.

1. **Subbar ownership — RULED: I own it.**
   `pn-subbar` (New-task `pn-btn--primary` + Current/Pinned/Completed/Archived `pn-subtab`) is rendered by ME **inside `pn-mp`**. It reads `taskSubTab`/`setTaskSubTab` (MaestroPanel.tsx:243) and counts from existing `activeRoots/pinnedRoots/completedRoots/archivedRoots .length`. Icon Rail Worker keeps ONLY the vertical `pn-rail`. **Restructure:** the task-subtab UI + its props (`taskSubTab`, `onTaskSubTabChange`, `activeCount`, `pinnedCount`, `completedCount`, `archivedCount`) move OUT of `PanelIconBar` into my `pn-subbar`. Top-coordinator confirmed the restructure — coordinate the prop removal with Icon Rail Worker at implementation time. Active subtab → `pn-subtab--active`. Icons: `listChecks`/`pin`/`check`/`archive`, `plus` for New-task.

2. **TaskFilters — RULED: restyle `TaskFilters.tsx` in place to `pn-filters`/`pn-filter`.**
   - `All` → active when no filters (clears `priorityFilter`/`statusFilter`).
   - `High` → `priorityFilter=['high']`.
   - `Sort` → existing `sortBy` control (`pn-filter`, `marginLeft:auto`, `<Icon sliders 13>`).
   - `Mine` → **OMIT** (provisional — no backing state; escalated, awaiting decision). Do NOT invent an assigned-to-me filter.
   - `Overdue` → **RULED: render as one extra `pn-filter` pill labelled "Overdue"**, reusing `pn-filter`/`pn-filter--active` (no new idiom). Wired to existing `overdueFilter`/`onOverdueFilterChange`; active class when `overdueFilter` is true. Folded into foundation escalation alongside Mine — may change.
   - Preserve `statusFilter`, `priorityFilter`, `sortBy`, `overdueFilter` state + all `on*Change` handlers verbatim.

3. **pn-scroll / pn-sec-head — RULED: I own the `pn-scroll` container + `pn-fade` mask ONLY.**
   Task List & Tree Worker owns everything rendered INSIDE `pn-scroll` (`pn-sec-head`, `pn-eyebrow`, `pn-count`, `pn-line`, task nodes). **I do NOT render section heads or rows.** I provide the scroll+fade shell; they fill it. (Table §2 rows f/g stay mine; row h `pn-sec-head` reassigned to Tree worker.)

4. **pn-head — RULED: ADD it.**
   New chrome inside `pn-mp`: `span.pn-proj{project.name <Icon chevronD size=13>}` + `span.pn-head-spacer` + `button.pn-ib`(more/standup) wired to `handleTeamStandup`. Coexists with `pn-top` project tabs (TopBar worker) — no conflict.

5. **Footer — RULED: follow canonical `shell.jsx`.**
   New-task lives in `pn-subbar`. **NO `pn-foot` footer.** Ignore the `LedgerLeft` footer variant.

---

## 5. EDGE STATES — escalated to foundation; interim treatment ruled

Per coordinator: keep these elements **functional**, restyle with existing paper tokens (`--pn-paper`/`--pn-ink`/`--pn-line`), and await foundation guidance before finalizing.

- **Error banner** (`terminalErrorBanner` → restyle): keep `error || fetchError` render + `setError(null)` close. Paper-token interim; foundation to confirm a `--pn-block`/`--pn-block-soft` treatment.
- **Loading spinner** (`terminalSpinner`/`terminalCursor`): keep functional; paper-token interim; await foundation.
- **Execution-mode skin** (`maestroPanel--executionMode`): preserve the modifier class on the `pn-mp` container; no design skin yet — await foundation.
- **"Mine" filter**: OMIT (no backing state).
- **Overdue filter**: RULED — render as an extra `pn-filter` pill "Overdue" reusing existing styling, wired to `overdueFilter`/`onOverdueFilterChange`. Folded into foundation escalation; may change.

---

## 6. Deliverables checklist
- [x] Read existing implementation (full catalogue above)
- [x] Read design (shell.jsx, left-panels.jsx, kit.jsx, theme.css)
- [x] Contract written (this doc)
- [x] In-place implementation — MaestroPanel.tsx (pn-mp root, pn-head, pn-subbar with ALL re-homed subtab/action rows, pn-search, pn-scroll+pn-fade, token error/spinner/exec-mode) + TaskFilters.tsx (option B: pn-filters pills + pn-pop/pn-opt dropdowns + restyled expand panel). PanelIconBar render removed from MaestroPanel (no dup vs app-level IconRail).
- [x] Typecheck pass — `cd maestro-ui && bunx tsc -b` → exit 0 (build policy: tsc -b only, no vite — concurrent build:ui storms SIGTERM each other)
- [ ] Light + dark screenshots — delegated to 📸 Screenshots Worker (sess_1780953175711_pzzhco61r) per coordinator policy
- [ ] PanelIconBar.tsx cleanup (strip to type-exports) — PENDING coordinator ruling on right-panel-mount primary-nav gap (see §7)

## 7. Open items pending coordinator ruling
- **Right-panel mounts** (`AppRightPanel.tsx:160`, `app/RightPanel.tsx:56`) render MaestroPanel standalone with no `forcedPrimaryTab` and no `IconRail` — PanelIconBar was their only primary-tab nav. Removing it leaves them tasks-only. Awaiting ruling: accept / add IconRail there / conditionally render PanelIconBar when `!forcedPrimaryTab`. PanelIconBar.tsx left intact (restored, not rendered, compiles) until ruled.
