# TaskCard + KanbanColumn re-skin contract (pn-bcard / pn-bcol)

Worker: 🗂️ Project Board Worker. Source of truth: `panel-redesign/boards.jsx`
(`BoardCard` ~L13-41 → `pn-bcard`; `Column` ~L43-66 → `pn-bcol`),
`redesign-boards.css`, FOUNDATION-DONE.md §9/§2. Appearance only — ZERO functionality changes.

---

## 0. Critical wiring finding (escalated to coordinator)

- **`TaskCard.tsx` is LIVE + shared.** Rendered by `VirtualizedColumnBody` (single-project
  `UnifiedKanbanView`) **and** `ProjectKanbanRow` (multi-project grouped). Re-skinning it to
  `pn-bcard` propagates to both boards. No board-specific conditionals added.
- **`KanbanColumn.tsx` is DEAD CODE** — imported nowhere. The live single-project columns are
  inlined in `UnifiedKanbanView` (`taskBoardColumn*` + `VirtualizedColumnBody`) inside
  `MultiProjectBoard.tsx`, which the Multi-Project Board Worker owns. Re-skinning `KanbanColumn.tsx`
  to `pn-bcol` is done per directive but has **no visual effect** on the live board. The single-project
  column re-skin must land in `UnifiedKanbanView` (ownership pending coordinator ruling).

---

## A. Functional surface preserved VERBATIM

### TaskCard.tsx
- Props: `task, isDragging, onPointerDown, onClick, onWorkOn, projectBadge` — unchanged.
- `wasDraggingRef` ref + `useEffect([isDragging])` set-on-drag — unchanged.
- `handlePointerDown` (`onPointerDown(e, task.id)`) — unchanged, wired to root `onPointerDown`.
- `handleClick` (drag-suppression guard → `onClick(task)`) — unchanged, wired to root `onClick`.
- `handleDragStart` (`draggable` + `dataTransfer` `application/maestro-task` + `text/plain` + `effectAllowed='copy'`) — unchanged, wired to root `onDragStart` + `draggable`.
- Derived flags `isActive/isBlocked/isDone/isOverdue` + `subtaskCount/completedSubtasks` — unchanged.
- Work-on button: `onClick` stops propagation then `onWorkOn(task)`; rendered only for `todo`/`blocked` — unchanged.
- `React.memo` wrapper — unchanged.

### KanbanColumn.tsx
- Props (incl. className override props), `collapsed` state, `toggleCollapse`, `registerColumn` ref
  callback, all `TaskCard` prop wiring, `dragState?.taskId === task.id` drag flag — unchanged.
- NOTE: the className-override props (`className`/`headerClassName`/…) get **new pn-bcol defaults**;
  the `.replace("Header","Label")` derivation idiom is removed in favor of literal pn-bcol classes.

## B. className map (old → pn-*)

### TaskCard
| old | new |
|---|---|
| `taskBoardCard` (+ `--dragging/--active/--blocked/--done/--cancelled/--overdue`) | `pn-bcard` (+ `--blocked` when blocked, `--done` when done). dragging/active/cancelled/overdue card-level → dropped (see §D) |
| `taskBoardCardStripe` (priority hex) | **removed** — replaced by `pn-bcard__pdot` in `pn-bcard__top` |
| `taskBoardCardContent` | **removed** — children sit directly in `pn-bcard` (matches boards.jsx) |
| `mpbProjectBadge` (inline borderColor/color) | `pn-bcard__pbadge` (inline `color`+`borderColor` from `projectBadge.color`) |
| `taskBoardCardTitle` (+ `--cancelled`) | `pn-bcard__title` (inside `pn-bcard__top`) |
| `taskBoardCardMeta` | `pn-bcard__meta` |
| `taskBoardCardPriority taskBoardCardPriority--{p}` | `pn-tag pn-tag--{high\|med\|low}` (label HIGH/MED/LOW) |
| `taskBoardCardSubtasks` (`done/total`) | `pn-bcard__prog` → `{done}/{total}` + `pn-bcard__progbar > i` width% |
| `taskBoardCardDueDate` (+ `--overdue`) | `pn-bcard__due` (+ `--over`) |
| `taskBoardCardTime` (timeAgo) | **dropped** — not in boards.jsx (see §D) |
| `taskBoardCardSessions` | `pn-bcard__foot` > `pn-bcard__sessions` |
| `taskBoardCardSessionDot` (+ `--active`) | `pn-dot pn-dot--run` (active) / `pn-dot pn-dot--idle` |
| `taskBoardCardSessionCount` | inline text inside `pn-bcard__sessions` |
| `taskBoardCardAction` | `pn-bcard__run` (in `pn-bcard__foot`) |
| `terminalPrompt` | `pn-prompt` |

### KanbanColumn (default classNames)
| old default | new default |
|---|---|
| `taskBoardColumn` (+ `--dragOver`) | `pn-bcol` (+ `--over`) |
| `taskBoardColumnCollapsed` | `pn-bcol--collapsed` |
| `taskBoardColumnHeader` | `pn-bcol__hd` |
| `taskBoardColumnBody` | `pn-bcol__body` |
| `taskBoardColumnEmpty` | `pn-bcol__empty` |
| `taskBoardColumnDot taskBoardColumnDot--{status}` + `{symbol}` | `<Glyph kind={status==='todo'?'todo':status} size={14}/>` |
| `${headerClassName→Label}` | `pn-bcol__label` |
| `${headerClassName→Count}` | `pn-bcol__count` |
| `${collapsedClassName}Label` ({symbol}) | collapsed: `<Glyph .../>` + `pn-bcol__count` + `pn-bcol__label` |

## C. kit primitive substitutions
- Priority stripe/dot → `pn-bcard__pdot` with inline `background` from `PRIO_DOT` (`high→var(--pn-block)`,
  `medium→var(--pn-wait)`, `low→var(--pn-idle)`) — CSS vars, no hex.
- Active task indicator → `pn-bcard__glyph pn-dot-wrap` > `pn-dot pn-dot--run pn-dot--live`.
- Blocked task → `pn-bcard__glyph` > `<Glyph kind="blocked" size={14}/>`.
- Done task → `pn-bcard__glyph` > `<Glyph kind="completed" size={14}/>`.
- Session dot → `pn-dot pn-dot--run` (active) / `pn-dot pn-dot--idle`.
- Column status symbol → `<Glyph kind={status} size={14}/>` (todo maps to `todo`).
- Priority color/spacing/bg → all from `pn-*` classes/tokens. `PRIORITY_COLORS` import dropped.

## D. Design-silent edges (escalated; provisional defaults)
1. **timeAgo `time`** — boards.jsx omits → DROPPED (`timeAgo` import removed).
2. **card-level overdue** — only `pn-bcard__due--over` exists → keep due-level, drop card-level overdue class.
3. **cancelled** — no `pn-bcard--cancelled` in design → plain `pn-bcard`, `isCancelled` logic retained, no class.
4. **assignee Avatar** — boards.jsx shows `<Avatar a={t.assignee}/>` but `MaestroTask` has no assignee
   object (only `teamMemberId`) → SKIPPED (no new data plumbing). `Avatar` not imported.

## E. Container-leak gate (dual-theme, bidirectional)
- `pn-bcard` bg = `var(--pn-card)`, `pn-bcol` bg = `var(--pn-surface)` — both flip light↔dark automatically.
- No hardcoded hex introduced. `pn-bcard__pdot` uses status `--pn-*` vars.
- Single-project column container bg (`taskBoardColumns`/`taskBoardContent` in MultiProjectBoard.tsx) is
  NOT in my files — flagged to coordinator/Multi-Project worker for the leak repoint.
