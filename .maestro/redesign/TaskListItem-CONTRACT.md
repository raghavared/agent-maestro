# TaskListItem.tsx → `pn-row` — Re-skin Contract (CORRECTED SCOPE)

**Worker:** 🟦 Task Tile Worker (`tm_1780948939178_ntw6sjc3w`)
**Scope file:** `maestro-ui/src/components/maestro/TaskListItem.tsx` (865 lines) — the LEFT-PANEL list tile rendered by `MaestroPanel` via `SortableTaskList`.
**Supersedes:** `TaskCard-CONTRACT.md` (TaskCard = Kanban board card, center scope, NOT mine — confirmed by Left Panel Coordinator).
**Target design:** `panel-redesign/left-panels.jsx` `TaskRow` (= `pn-row`) + `shell.jsx` `TRow`; CSS `theme.css` L305-354.
**Foundation outputs:** `redesign/kit.tsx` (`Icon`, `AgentTile`), `redesign-tokens.css` (`pn-row*`, `pn-dot*`, `pn-tag*`, `pn-meta`, `pn-chip`, `pn-btn*`, `pn-agent*`, `pn-sub*` — `html[data-redesign]` scoped).
**Status:** CONTRACT FINALIZED (all rulings received from Left Panel Coordinator 2026-06-09) — gate CLOSED, no source edits until `FOUNDATION-DONE.md` + coordinator go-ahead.

> KEY STRUCTURAL FACT: TaskListItem has **two regions** — (A) a single-line collapsed **main row** (`terminalTaskMain`) that maps cleanly onto `pn-row`, and (B) a large **expanded meta panel** (`terminalTaskMetaExpanded`, gated on `isMetaExpanded`) with inline status/priority/team/model/dangerous/worktree editors + sessions/docs/diagrams rows. **The `pn-row` design shows NOTHING for region B.** Region B must be preserved verbatim and restyled with foundation tokens only — its design treatment is ESCALATED (see §4 M-OPEN-A).

---

## 1. Functional surface — PRESERVE VERBATIM (zero functionality changes)

### 1a. Props (L14-35) — all kept, signature unchanged
`task, onSelect, onWorkOn, onWorkOnWithOverride?, onWorkOnWithTeamMember?, onAssignTeamMember?, onOpenCreateTeamMember?, onJumpToSession, onNavigateToTask?, depth?, hasChildren?, isChildrenCollapsed?, isAddingSubtask?, onToggleChildrenCollapse?, onTogglePin?, selectionMode?, isSelected?, onToggleSelect?, showPermanentDelete?, isSessionTask?`

### 1b. State (15 useState, L105-129) — all kept
`isMetaExpanded, taskDocs, docsLoaded, showDeleteConfirm, isDeleting, showStatusDropdown, isUpdatingStatus, showPriorityDropdown, isUpdatingPriority, showTeamMemberDropdown, isUpdatingTeamMember, showLaunchDropdown, expandedTool, launchOverride, isCreatingDiagram, statusDropdownPos, priorityDropdownPos, teamMemberDropdownPos, launchDropdownPos`

### 1c. Refs (8, L119-126) — all kept (dropdown anchoring)
`statusDropdownRef, priorityDropdownRef, teamMemberDropdownRef, launchDropdownRef, statusBtnRef, priorityBtnRef, teamMemberBtnRef, launchBtnRef`

### 1d. Store hooks — all kept (NO new data deps added)
`useTaskSessions(task.id)`; `useTaskSessions(parentTask?.id)`; `useMaestroStore`: `tasks, teamMembers, deleteTask, updateTask`; `useSpacesStore: createWhiteboard`; `useSessionStore: setActiveId`; `useUIStore: setDocOverlay`.

### 1e. Memos/derived — kept
`markdownDocs, diagramDocs, teamMembers, effectiveTeamMemberIds, assignedTeamMembers, assignedTeamMember (pickTopMember), effectiveModel, effectiveModelLabel, isSubtask, parentTask, allSessions, sessionCount, subtaskCount, totalDescendantCount`

### 1f. Effects — kept verbatim
4× `useLayoutEffect` dropdown positioning (L145-187); `useEffect` lazy doc fetch (L190-195); `useEffect` task.docs sync (L198-202).

### 1g. Handlers — kept verbatim
`computeDropdownPos, computeLaunchDropdownPos, handleCreateDiagram, handleDeleteTask, confirmDeleteTask, handleRadioStatusClick, handleInlineStatusChange, handleInlinePriorityChange, handleInlineTeamMemberToggle, handleSubtaskAction, handleDragStart`

### 1h. a11y / DnD — kept
Root `draggable`+`onDragStart`+dataTransfer payload (L370-380); every `title=` attr; every `onClick` `stopPropagation`; checkbox `<input type=checkbox>` semantics; `createPortal` dropdowns + ConfirmActionModal.

---

## 2. Region A — collapsed main row (`terminalTaskMain`) → `pn-row`

| Old element (class) | New (class) | Handler / data preserved |
|---|---|---|
| root `terminalTaskRow terminalTaskRow--<status>` + `--subtask/--dropdownOpen/--selectable/--sessionActive` | `pn-row` + state mods (sel→`pn-row--sel`, dragging→opacity; see rulings) | `draggable`, `onDragStart`, all status mods kept as data hooks |
| `terminalTaskMain` | `pn-row` main flex (lead/body/trail) | — |
| `terminalTaskCheckbox` (selectionMode) | kept in `pn-row__lead` (design silent → token-restyle, see M-OPEN-B) | `onToggleSelect`, `isSelected`, stopPropagation |
| `terminalTaskSubtaskArrow` (+count) | chevron `Icon` (`chevronR`/`chevronD`) in lead; count → `pn-chip` | `handleSubtaskAction`→`onToggleChildrenCollapse`, all titles. (Tree worker owns the pn-sub child lines + `pn-kids` indent; I own this toggle.) |
| `terminalTaskRadioStatus--<status>` (status symbol, click-toggles complete) | `pn-dot-wrap > pn-dot pn-dot--<v>` (+`pn-dot--live` when in_progress) — **made clickable**, keep toggle | `handleRadioStatusClick`, title `STATUS_LABELS[status]` |
| `terminalTaskTitle--clickable` | `pn-row__title` | `onClick`→`onSelect`, `title`, empty-title italic style |
| `terminalTaskDocBadge` (doc count) | `pn-meta`/`pn-chip` inside `pn-row__sub` (M-OPEN-C) | `onClick`→expand meta, title |
| (none in collapsed today) priority | NEW `pn-tag pn-tag--<high\|med\|low>` read-only in `pn-row__sub` (design adds it) | reflects `task.priority`; editing stays in meta panel |
| (NEW per ruling) assignedTeamMember avatar | `AgentTile` (foundation primitive) at **start** of `pn-row__trail` | store-derived `assignedTeamMember` — no new dep (M-OPEN-E ✔) |
| `terminalTaskSessionIndicator` / `terminalTaskExpandBtn` (▾) | secondary trail button `pn-ib` (restyled) | toggles `isMetaExpanded`, session-status variants, titles (M-OPEN-D ✔) |
| `terminalTaskActions > terminalTaskPlayBtn` (▶) | `pn-row__run` + `Icon name="play"` (always-on) | onClick launchOverride/`onWorkOn`, title (V-OPEN-5 ✔) |

**`pn-row__trail` order (M-OPEN-D ✔):** `[AgentTile if assignee]` → expand/session `pn-ib` → `pn-row__run`. Both controls kept — dropping either = functionality loss.

### Status → `pn-dot` (mapping UNCHANGED — visual only). APPROVED items locked; ★ proposed:
`in_progress`→`pn-dot--run`+live · `todo`→`pn-dot--idle` · `blocked`→`pn-dot--block` · `in_review`★→`pn-dot--wait` · `completed`★→`pn-dot--idle` · `cancelled`★→`pn-dot--idle` · `archived`★→`pn-dot--idle`. (Existing `STATUS_SYMBOLS`/`STATUS_LABELS` retained for titles + meta-panel editor.)

### Priority → `pn-tag` (APPROVED): `high`→`pn-tag--high` "high" · `medium`→`pn-tag--med` **"med"** (label literal per ruling V-OPEN-2; underlying value stays `medium`) · `low`→`pn-tag--low` "low". (Existing `PRIORITY_LABELS` HIGH/MED/LOW kept for the editable meta badge.)

---

## 3. Coordinator rulings — ALL RESOLVED (locked)

- **#id (V-OPEN-1) ✔:** short id (last/numeric segment of `task.id`) as `pn-meta` label; full id in `title=`. → `pn-row__sub` `pn-meta`.
- **'med' (V-OPEN-2) ✔:** tag label literal `med`; value `medium` untouched.
- **extra fields (V-OPEN-7) ✔:** PRESERVE all; they live in the expanded meta panel (timeAgo L748, sessions L752-779, docs/diagrams L782-840). `projectBadge`/`dueDate` not rendered by TaskListItem → nothing to place.
- **AgentTile (V-OPEN-4 / M-OPEN-E) ✔ — ADD:** surface `assignedTeamMember` via foundation `AgentTile` at start of `pn-row__trail`. Store-derivable, no new dep → faithful re-skin. (Overrides earlier keep-current default.)
- **work-on (V-OPEN-5) ✔:** play button is ALWAYS shown in TaskListItem → keep always-on, restyle to `pn-row__run`, preserve launchOverride branch + titles.
- **cancelled strike (V-OPEN-3) + drag state (V-OPEN-6):** still escalated to foundation. Interim: `pn-row--sel` for selected; inline opacity for dragging; cancelled/completed title treatment via existing `terminalTaskRow--<status>` data hook + token override pending foundation.

---

## 4. Meta-panel & collapsed-row rulings — ALL RESOLVED (locked)

- **M-OPEN-A (meta panel) ✔ — OPTION (a):** restyle `terminalTaskMetaExpanded` IN PLACE, foundation tokens only. Map chips→`pn-tag`/`pn-chip`, buttons→`pn-btn`, dropdown/popover surfaces→`--pn-card` / `--pn-line` / `--pn-paper` / `--pn-ink`. **KEEP VERBATIM:** all structure, every handler, all `createPortal` anchoring, the 8 refs + 4 `useLayoutEffect` positioning logic. No restructure, no drop, no legacy classes left behind (NOT option b/c). If a specific sub-element has no token analog → escalate that element by name.
- **M-OPEN-B (checkbox) ✔:** token-restyle existing checkbox in place — `--pn-line` (border) / `--pn-brand` (checked) / `--pn-active`. No foundation primitive.
- **M-OPEN-C (doc badge) ✔:** `pn-meta` inside `pn-row__sub` (consistent with #id/subtasks). Reserve `pn-chip` for trail/session contexts.
- **M-OPEN-D (two trail controls) ✔:** keep BOTH. play→`pn-row__run`; expand/session-indicator→secondary `pn-ib`. Trail order: `[AgentTile if assignee]` + expand/session `pn-ib` + `pn-row__run`.
- **M-OPEN-E ✔:** see §3 (ADD AgentTile).
- **M-OPEN-F (subtask seam) ✔:** I own the expand/collapse chevron + count BUTTON in `pn-row__lead` (calls existing toggle prop) and restyle ONLY that control. Tree worker owns what the toggle does — child-row recursion, `pn-sub` child lines, `pn-kids` indent. If that recursion block lives in this file, I do NOT edit it.

### Still-pending foundation items (interim handled; not blocking contract)
`pn-row` cancelled/completed title treatment (V-OPEN-3) + dragging state (V-OPEN-6) — interim approach above; finalize when foundation responds.

---

## 5. Deliverables (post-gate)
1. This corrected contract ✓
2. In-place re-skin of `TaskListItem.tsx` collapsed row → `pn-row` + meta-panel token restyle (after FOUNDATION-DONE + M-OPEN rulings)
3. Light + dark screenshots (collapsed + expanded) vs `panel-redesign`
4. `bun run build:ui` typecheck pass
5. Contract check: §1a-1h all preserved
