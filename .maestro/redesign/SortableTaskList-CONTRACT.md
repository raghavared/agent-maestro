# SortableTaskList & Task Tree — Re-skin Contract

**Worker:** 🌲 Task List & Tree Worker (`tm_1780948939045_veaws1m9e`)
**Coordinator:** Left Panel Coordinator (`sess_1780949253577_ei828bbjb`)
**Branch:** `maestro-redesign` · **Gate:** CLOSED (study + contract only; no source edits until `FOUNDATION-DONE.md`)
**Status:** Steps 1–3 complete. All 5 open questions RULED by coordinator (see §6). Awaiting foundation gate only.

---

## 0. Scope boundary (what this worker owns)

| File | In scope? | What I touch |
|---|---|---|
| `SortableTaskList.tsx` (141 L) | ✅ YES | list container + dnd-kit wrapper + column header row |
| `TaskTabContent.tsx` (83 L) | ✅ YES (sibling list container) | duplicate `terminalTaskList`/`terminalTaskHeader` + empty/loading states |
| `MaestroPanel.tsx` → `TaskNodeRenderer` (L41–173) | ✅ YES | recursive tree node + parent→child indent wrappers |
| `MaestroPanel.tsx` → section/grouping derivations (L530–562) | ✅ YES | one `pn-sec-head` per active sub-tab; count from existing `*Roots.length` |
| `TaskListItem.tsx` (864 L) | ⚠️ SHARED SEAM — see §6.A | **Tile worker** owns inner row visual (`pn-row` content + `pn-sub` lines). **I** own the collapse-state wiring + (if needed) any wrapper/indent that lives here. Seam coordinated through Left Panel Coordinator. |
| `TaskCard.tsx` (129 L) | ❌ OUT OF SCOPE | Kanban **board** card (`taskBoardCard`); used by MultiProjectBoard / KanbanColumn / ProjectKanbanRow — not our left panel |
| `MaestroPanel.tsx` shell (head/subbar/search/filters/`pn-scroll`/`pn-fade`/footer) | ❌ NO | Maestro Panel Shell worker owns |

**Render path I re-skin:**
`MaestroPanel` → (`SortableTaskList` for `sortBy==="custom"` | `TaskTabContent` otherwise) → `renderTaskNode` → `TaskNodeRenderer` (recursive) → `TaskListItem` (tile, boundary).

---

## 1. Functional surface — PRESERVE VERBATIM (zero changes)

### 1.1 `SortableTaskList.tsx`
- **Props:** `roots`, `renderTaskNode`, `onReorder`, `showPermanentDelete`, `listClassName` — signature unchanged.
- **Module constant:** `PERMANENT_DELETE_OPTIONS = { showPermanentDelete: true } as const`.
- **dnd-kit wiring (EXACT — do not alter any value):**
  - `useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))`
  - `<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>`
  - `<SortableContext items={ids} strategy={verticalListSortingStrategy}>`
  - `ids = useMemo(() => roots.map(r => r.id), [roots])`
  - `handleDragEnd` (`useCallback`, deps `[roots, onReorder]`): guard `!over || active.id===over.id`; `oldIndex/newIndex` via `roots.findIndex`; guard `-1`; `arrayMove(roots.map(r=>r.id), oldIndex, newIndex)`; `onReorder(newOrder)`.
- **`SortableTaskItem` (React.memo):**
  - `useSortable({ id })` → `attributes, listeners, setNodeRef, transform, transition, isDragging`.
  - `style` (`useMemo`, deps `[transform, transition, isDragging]`): `transform: CSS.Transform.toString(transform)`, `transition`, `opacity: isDragging?0.4:1`, `cursor: isDragging?"grabbing":undefined`, `willChange: isDragging?"transform":"auto"`.
  - `ref={setNodeRef}` + spread `{...attributes} {...listeners}` — **drag handle = whole row; must remain spread on the wrapper.**
  - Renders `children` (the `renderTaskNode` output) unchanged.

### 1.2 `TaskNodeRenderer` (MaestroPanel.tsx L64–173)
- **All 19 props threaded recursively** unchanged: `node, depth, showPermanentDelete, collapsedTasks, slidingOutTasks, addingSubtaskTo, executionMode, selectedForExecution, currentSessionTaskIds, projectId, onSelectTask, onWorkOnTask, onAssignTeamMember, onJumpToSession, onNavigateToTask, onToggleAddSubtask, onTogglePin, onToggleSelect, onInlineAddSubtask`.
- **Derived state preserved:** `hasChildren = node.children.length>0`, `isCollapsed = collapsedTasks.has(node.id)`, `isSlidingOut = slidingOutTasks.has(node.id)`, `isAddingSubtask = addingSubtaskTo===node.id`.
- **`taskItem`** renders `<TaskListItem .../>` with full prop set — preserved verbatim (TaskListItem internals = boundary §6.A).
- **`subtaskInput`** = `<AddSubtaskInput parentTaskId={node.id} onAddSubtask={onInlineAddSubtask} depth={depth+1} />` rendered when `isAddingSubtask || (hasChildren && !isCollapsed)`.
- **Branching (preserve the two structural cases):**
  - depth-0 group: `if (depth===0 && (hasChildren || isAddingSubtask))` → outer group wrapper + children container with recursion + `subtaskInput`.
  - default: `React.Fragment` with `taskItem`, recursion over `!isCollapsed && node.children`, then `subtaskInput`.
- **Recursion** always at `depth + 1`.
- **`renderTaskNode` callback** (L576) and its full `useCallback` dependency array — unchanged.

### 1.3 `TaskTabContent.tsx`
- Props unchanged. **`loading` state** (`terminalLoadingState` spinner) and **empty state** (`terminalEmptyState` ASCII art + optional `$ new task` button via `showNewTaskButton && onNewTask`) — logic preserved (visual re-skin only, see §6.C for empty-state ASCII decision).
- List render: `roots.map(node => renderTaskNode(node, 0, showPermanentDelete ? { showPermanentDelete: true } : undefined))` — unchanged.

### 1.4 Collapse / keyboard / DnD invariants
- Expand/collapse is driven by **`collapsedTasks: Set<string>`** in MaestroPanel (toggled via `onToggleAddSubtask`) — I do NOT relocate this state; I only restyle the chevron/indent it produces. (Note: the chevron button lives in `TaskListItem` = boundary.)
- Keyboard nav = dnd-kit `KeyboardSensor` + `sortableKeyboardCoordinates` (unchanged) + native button focus order. No new tab traps.
- a11y: keep `title=` attrs; section headers get no interactive role (decorative).

---

## 2. Visual surface — REPLACE

| Existing class / element | New design target | Source |
|---|---|---|
| `terminalTaskList` (list container) | `pn-list` (`display:flex; flex-direction:column`) | shell.jsx `pn-list`; tokens L314 |
| `terminalTaskHeader` (STATUS/TASK/AGENT/ACTIONS column row) | **REMOVE** ✅ ruled — design has no column header; grouping conveyed by `pn-sec-head` (in `SortableTaskList.tsx` **and** `TaskTabContent.tsx`) | shell.jsx (no header) |
| `terminalTaskGroup` / `terminalTaskGroup--expanded/--collapsed` (depth-0 wrapper) | plain `<div>` wrapper (design `TaskNode` outer div) | tiles.jsx `TaskNode` L137 |
| `terminalTaskGroupChildren` (depth-0 children indent) | `pn-kids` (indent rail: `margin-left:19px; border-left:1px solid var(--pn-line)`) | tiles.css L232 — **NOT YET IN FOUNDATION (§6.D)** |
| depth>0 recursion (bare Fragment, no indent wrapper) | wrap `node.children` in `pn-kids` to match design's recursive indent rail | tiles.jsx `TaskNode` L142 |
| (none today) section headers | **ONE** `pn-sec-head` > `pn-eyebrow` + `pn-count` + `pn-line` per active sub-tab; label = sub-tab name, count = existing `activeRoots.length`/`pinnedRoots.length`/`completedRoots.length`/`archivedRoots.length`. **NO** new in-progress/up-next derivation (would change logic). | shell.jsx L149/151; tokens L308–312 |
| `sortableItemWrapper` / `--dragging` | keep class name OR map to design row-drag affordance; drag styles (opacity/cursor) preserved inline | n/a (structural; keep) |

**Design recursive node shape (target):**
```jsx
<div>                                  {/* TaskNode outer */}
  <TaskTile .../>                      {/* = TaskListItem (boundary) */}
  {children && !collapsed &&
    <div className="pn-kids">          {/* indent rail */}
      {children.map(c => <TaskNode .../>)}
    </div>}
</div>
```
My re-skin maps `terminalTaskGroupChildren` → `pn-kids` and adds a `pn-kids` wrapper to the depth>0 recursion so **every** nesting level shows the indent rail consistently (today only depth-0 has a group wrapper; design applies the rail at all depths).

---

## 3. Token + class mapping (everything from foundation — nothing freehand)

| New element | Foundation class | Tokens consumed | Foundation status |
|---|---|---|---|
| list container | `.pn-list` | — | ✅ present (tokens L314) |
| section header row | `.pn-sec-head` | layout only | ✅ present (L308) |
| section eyebrow label | `.pn-eyebrow` | type scale | ✅ present (L109) |
| section count suffix | `.pn-count` | `--pn-ink-4` | ✅ present (L118) |
| section hairline | `.pn-sec-head .pn-line` | `--pn-line` | ✅ present (L312) |
| subtask indent rail | `.pn-kids` | `--pn-line` | ⏳ escalated → foundation will add (`tiles.css:232`). Design it in now. |
| (Tile worker's, but wrapped by my rail) | `.pn-sub` / `.pn-sub--done` | `--pn-line`, `--pn-run` | ⏳ foundation will add (`left-panels.jsx`/`tiles.css`) — **Tile worker** renders these inside the row; my `.pn-kids` rail is their container |

No kit primitives (`Icon`/`AgentTile`/`Mark`) are consumed by the list/tree wrapper itself — those live inside the tile (`TaskListItem`, Tile worker's seam). My surface is **purely structural CSS classes**: `.pn-list`, `.pn-sec-head`/`.pn-eyebrow`/`.pn-count`/`.pn-line`, `.pn-kids`.

---

## 4. Theming
- All new classes already scoped under `html[data-redesign]` in foundation tokens; dark mode via `html[data-theme="dark"]` overrides. No theme-specific work in my layer beyond using the tokenized classes.

## 5. Verification plan (post-gate)
1. Light + dark screenshots of: flat list (non-custom sort), custom-sort drag list, a parent task with 2-level nested subtasks (indent rails at each depth), empty state, loading state.
2. Contract check: dnd drag-reorder still fires `onReorder`; keyboard reorder works; collapse toggle works; `AddSubtaskInput` still appears.
3. `bun run build:ui` typecheck pass.

---

## 6. COORDINATOR RULINGS (resolved 2026-06-09 by Left Panel Coordinator)

**A. Tile ownership — RESOLVED.**
`TaskCard.tsx` is **OUT of scope** (Kanban board card: MultiProjectBoard / KanbanColumn / ProjectKanbanRow). The left-panel list tile is `TaskListItem.tsx`, owned by the **Task Tile worker** (coordinator redirected them there). **Shared seam on `TaskListItem.tsx`:** Tile worker owns the row's **INNER visual** (`pn-row` content + `pn-sub` lines); **I own** the wrapper, indent rail (`pn-kids`), children recursion, expand/collapse state, and ALL @dnd-kit wiring. Seam coordinated through the coordinator.
- *Note:* the collapse **control** (`terminalTaskSubtaskArrow` chevron + count) lives inside `TaskListItem.tsx` and is part of the Tile worker's inner visual, but it drives **my** collapse state (`collapsedTasks` Set + `onToggleChildrenCollapse`). I will not change its wiring; Tile worker restyles its glyph. Flagged as a seam to verify post-gate.

**B. Remove `terminalTaskHeader` — APPROVED.** Remove the STATUS/TASK/AGENT/ACTIONS column row in **both** `SortableTaskList.tsx` and `TaskTabContent.tsx`. Design uses `pn-sec-head` instead.

**C. Sectioning — APPROVED (option 1).** Render a **single** `pn-sec-head` per active sub-tab; label = sub-tab name, `pn-count` = existing `activeRoots.length` / `pinnedRoots.length` / `completedRoots.length` / `archivedRoots.length`. **Do NOT** invent an in-progress/up-next derivation. Zero-logic-change holds.

**D. `.pn-kids` indent rail — ESCALATED to foundation (relayed).** Assume foundation will add, verbatim from `panel-redesign/tiles.css:232`:
```css
.pn-kids     { margin-left: 19px; border-left: 1px solid var(--pn-line); position: relative; }
.pn-kids--st { margin-left: 19px; border-left: 1px solid var(--pn-line); }
```
plus `.pn-sub` / `.pn-sub--done` / `.pn-list` (from `left-panels.jsx` / `tiles.css`). Designed into §2–§3 now. (`--st` = Session-List worker's; `.pn-kids` is mine. `.pn-sub*` = Tile worker's content, wrapped by my rail.)

**E. Empty-state ASCII art — APPROVED keep.** Retain the `terminalEmptyState` box-drawing art; only restyle its text with foundation tokens.

---

### Post-gate implementation checklist (derived from rulings)
1. `SortableTaskList.tsx`: drop `terminalTaskHeader`; `terminalTaskList` → `pn-list`; keep dnd-kit + `SortableTaskItem` verbatim; prepend a single `pn-sec-head` (label "Current", `pn-count` = `roots.length`).
   - **Seam LOCKED (coordinator-confirmed):** `pn-sec-head` is MINE and renders at the **top of my list container**, *inside* the `pn-scroll` region the Shell worker provides. Shell worker = empty `pn-scroll` + `pn-fade` wrapper only; I = `pn-sec-head` + TaskNode list inside it. Matches `shell.jsx` (sec-head sits inside `pn-scroll` alongside the nodes).
2. `TaskTabContent.tsx`: drop `terminalTaskHeader`; `terminalTaskList` → `pn-list`; restyle empty/loading text with tokens; single `pn-sec-head` from passed-in count.
3. `TaskNodeRenderer` (MaestroPanel): `terminalTaskGroupChildren` → `pn-kids`; add `pn-kids` wrapper to the depth>0 recursion so the indent rail renders at every level; keep the depth-0/Fragment branch logic + all 19 props verbatim.
