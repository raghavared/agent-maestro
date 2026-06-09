# MultiProjectBoard + ProjectKanbanRow — Re-skin Contract (P1e.2)

Worker: 🗃️ Multi-Project Board Worker. Files owned: `MultiProjectBoard.tsx`, `ProjectKanbanRow.tsx`.
Appearance-only re-skin to `pn-*`. ZERO functionality changes. Consumes shared `TaskCard` (→ `pn-bcard`, owned by Project Board Worker) and shared `pn-bcol` CSS (already in `redesign-boards.css`) — do NOT redefine either.

---

## (a) Functional surface to preserve VERBATIM

### MultiProjectBoard.tsx (`Board` = `React.memo`)
- `createPortal(..., document.body)` wrapper — KEEP.
- Props: `onClose`, `onSelectTask`, `onUpdateTaskStatus`, `onWorkOnTask`, `onCreateMaestroSession`, `focusProjectId`. KEEP all.
- Hooks: `useProjectStore`, `useMaestroStore` (sessions + teamMembers), `useSessionStore`, `useTasks(focusProjectId)`, `useMultiProjectTasks(...)`. KEEP all selectors verbatim.
- State: `activeView` (tasks|sessions|dashboard), `layoutMode` (grouped|unified), `sessionLayoutMode`, `selectedProjectIds` (Set, localStorage-persisted via `STORAGE_KEY`), `sidebarCollapsed`. KEEP.
- Effects: localStorage persist effect; Escape-key close effect (capture-phase listener). KEEP.
- Memos: `projectNames/projectColors/projectMap`, `selectedProjectIdArray`, `effectiveTasks`, `taskStats/taskCountByProject`, `sessionStats/sessionCountByProject`, `dashboardSessions`, `dashboardTeamMembers`, `tasksByProject`. KEEP.
- Callbacks: `handleToggleProject`, `handleSelectAll`, `handleDeselectAll`, `handleWorkOnTask`. KEEP.
- Children rendered: `ProjectSelectorSidebar` (NOT mine — props unchanged), `ProjectKanbanRow` (mine), `MultiProjectSessionsView` (NOT mine), `Dashboard` wrapped in `ErrorBoundary` (NOT mine), `UnifiedKanbanView` (in-file), `TaskCard` (NOT mine), `DragGhostCard` (NOT mine).
- `isSingleProject` branch toggles `taskBoard*` vs `mpb*` class families and switches single↔multi chrome. KEEP the branching logic; only swap the class strings.

### `VirtualizedColumnBody` (in-file)
- `useVirtualizer({ count, getScrollElement: () => parentRef.current, estimateSize: () => 72, overscan: 5 })`. KEEP wiring. **estimateSize=72** may need to change if the new `pn-bcard` row height differs — see §(d).
- Absolute-positioned virtual rows with `transform: translateY(start)`. KEEP inline positioning styles (these are layout mechanics, not theme).
- Renders `<TaskCard>` with `projectBadge` derived from `showProjectBadge`. KEEP prop wiring.

### `UnifiedKanbanView` (`React.memo`, in-file)
- `useBoardDrag(handleDrop)` → `{ dragState, dragOverColumn, onCardPointerDown, registerColumn }`. KEEP.
- `columnData` memo (group root tasks by status, priority+updatedAt sort). KEEP.
- `collapsedColumns` Set state + `toggleColumnCollapse`. KEEP.
- Iterates `COLUMNS`; collapsed vs expanded column branches; `registerColumn(col.status, el)` ref on BOTH branches. KEEP refs + handlers exactly.
- `DragGhostCard` rendered when `dragState`. KEEP.

### ProjectKanbanRow.tsx (`React.memo`)
- Props: `projectId`, `projectName`, `projectColor`, `tasks`, `onSelectTask`, `onUpdateTaskStatus`, `onWorkOnTask`. KEEP.
- `useBoardDrag(handleDrop)`, `handleSelectTask`, `columnData` memo, `rootTaskCount` memo, `collapsed` state + `toggleCollapse`, `collapsedColumns` Set + `toggleColumnCollapse`. KEEP.
- Iterates `COLUMNS`; collapsed vs expanded column branches; `registerColumn` ref on both. Renders `<TaskCard>` (non-virtualized list). `DragGhostCard` when dragging. KEEP all.

---

## (b) className → pn-* mapping

### CONFIDENT (prototype-backed, boards.jsx)

**Column structure — shared by BOTH UnifiedKanbanView (taskBoard*) and ProjectKanbanRow (mpbKanbanColumn*):**
| old | new (boards.jsx Column) |
|---|---|
| `taskBoardColumns` / `mpbProjectRowColumns` | `pn-bcols` |
| `taskBoardColumn` / `mpbKanbanColumn` | `pn-bcol` |
| `taskBoardColumn--dragOver` / `mpbKanbanColumn--dragOver` | `pn-bcol--over` |
| `taskBoardColumnHeader` / `mpbKanbanColumnHeader` | `pn-bcol__hd` |
| `taskBoardColumnDot taskBoardColumnDot--{status}` + `{col.symbol}` | `<Glyph kind={col.status==='todo'?'todo':col.status} size={14} />` |
| `taskBoardColumnLabel` / `mpbKanbanColumnLabel` | `pn-bcol__label` |
| `taskBoardColumnCount` / `mpbKanbanColumnCount` | `pn-bcol__count` |
| `taskBoardColumnBody` / `mpbKanbanColumnBody` | `pn-bcol__body` |
| `taskBoardColumnEmpty` / `mpbKanbanColumnEmpty` (+ text) | `pn-bcol__empty` → text `no tasks` |
| `taskBoardColumnCollapsed` / `mpbKanbanColumnCollapsed` | `pn-bcol--collapsed` (onClick expand) |
| `taskBoardColumnCollapsedLabel`/`Symbol` | inner `<Glyph kind=... size={15}/>` |
| `taskBoardColumnCollapsedCount` / `mpbKanbanColumnCollapsedCount` | `pn-bcol__count` |

Collapsed column body order per prototype: `<Glyph/>`, `pn-bcol__count`, `pn-bcol__label`.

**Multi-project board chrome (FullBoard):**
| old | new |
|---|---|
| board "screen" region | `pn-screen` |
| header region (`mpbHeader`) | `pn-bd-hd` |
| title text "All projects" / project name | `pn-bd-hd__title` |
| `mpbProjectCount` "{n} projects" | `pn-bd-hd__sub` |
| spacer | `pn-bd-hd__sp` |
| "Group by status" action | `pn-btn pn-btn--ghost` + `<Icon name="sliders" size={14}/>` |

**ProjectKanbanRow (ProjectRow):**
| old | new |
|---|---|
| `mpbProjectRow` | `pn-mpr` |
| `mpbProjectRowHeader` (onClick toggle) | `pn-mpr__hd` |
| `mpbProjectRowColor` (inline `background: projectColor`) | `pn-mpr__dot` (KEEP inline color) |
| `mpbProjectRowName` | `pn-mpr__name` |
| `mpbProjectRowCount` "{n} tasks" | `pn-mpr__count` |
| `mpbProjectRowChevron` `▼` | `pn-mpr__chev` + `<Icon name={collapsed?'chevronR':'chevronD'} size={14}/>` |
| `mpbProjectRowColumns` (when open) | `pn-bcols` |

**TaskCard projectBadge:** already handled by TaskCard (`mpbProjectBadge` → `pn-bcard__pbadge`, Project Board Worker). I only pass the `projectBadge` prop — no change.

### AMBIGUOUS — NO prototype equivalent in boards.jsx (ESCALATED, see §questions)
| old | candidate (NOT in boards.jsx) |
|---|---|
| `mpbOverlay` / `taskBoardOverlay` (fixed full-screen modal) | no prototype; keep as positioned wrapper, repoint bg → `--pn-paper` |
| `mpbContainer` / `taskBoardContainer` | `pn-screen`? (border/radius/shadow look odd full-bleed) |
| `taskBoardTabs` / `taskBoardTab`(`--active`) / `taskBoardTabSymbol` | shell.jsx `pn-tabs`/`pn-tab`(`--active`)? |
| `taskBoardHeaderStats` / `taskBoardStat*` | `pn-meta` / `pn-dot` chips? |
| `mpbLayoutToggle` / `mpbLayoutBtn`(`--active`) | `pn-seg`/`pn-seg-i`(`--active`)? |
| `taskBoardCloseBtn` `✕` | `pn-ib` + `<Icon name="x"/>`? |
| `mpbBody`/`mpbContent`/`taskBoardBody`/`taskBoardContent` | layout-only wrappers; no pn equivalent |
| `mpbGroupedView` | scroll wrapper around `pn-mpr` rows |
| `mpbEmptyState`/`mpbEmptyText` | `pn-empty`/`pn-empty__h`? |

---

## (c) kit primitive per icon/dot/chev
- Column status indicator → `Glyph kind={status}` (replaces `taskBoardColumnDot` + unicode symbol).
- Project row dot → `pn-mpr__dot` span with inline `background: projectColor` (no glyph; matches prototype).
- Project row chevron → `Icon name={collapsed?'chevronR':'chevronD'} size={14}` (replaces `▼` + rotate).
- "Group by status" button icon → `Icon name="sliders" size={14}`.
- Close button (if approved) → `Icon name="x"`.
- Import: `import { Icon, Glyph } from "../redesign/kit";` (both files are at `components/maestro/`, kit at `components/maestro/redesign/` → depth `../redesign/kit`).

---

## CORRECTNESS-PRESERVING STRUCTURAL CHANGE (reviewer: do NOT flag as a functionality change)
`VirtualizedColumnBody` (unified view) gained `measureElement` wiring: each virtual row div now carries `data-index={virtualRow.index}` + `ref={rowVirtualizer.measureElement}`, and `estimateSize` changed `72 → 110` (now only an initial hint). **Rationale:** the design's `pn-bcard` is INTENTIONALLY variable-height (boards.jsx `BoardCard` has optional `pbadge`/`prog`/`due`/`foot` + 1–3 line title clamp), which BREAKS the old fixed-`estimateSize=72` absolute-positioned virtualization (would overlap taller cards / gap shorter ones). `measureElement` is the minimal standard `@tanstack/react-virtual` pattern that RESTORES correct, non-overlapping virtualized layout across scroll — it preserves prior behavior, it is NOT a new feature. `translateY(virtualRow.start)` positioning + all drag/click/refs unchanged. `ProjectKanbanRow` renders a plain non-virtualized list — unaffected. Approved by Board Coordinator + top coordinator.

## (d) Virtualizer estimateSize note
Current `estimateSize: () => 72` (old `taskBoardCard`). New `pn-bcard` is `padding 11px 12px` + `gap 8px` flex column (title up to 3 lines, meta row, foot row) — likely TALLER than 72px. After TaskCard lands as `pn-bcard`, measure the rendered card height and update `estimateSize` to match (overscan absorbs minor drift, but a wrong estimate hurts scroll math). FLAGGED for report. Will set after visual verify; provisional bump to ~108–120px pending measurement.

---

## (e) Container-leak gate (bidirectional, per coordinator addendum)
`styles-multi-project-board.css` uses `background: var(--bg, #0a0e16)` (fixed dark) on `.mpbOverlay`, `.mpbContainer`, `.mpbKanbanColumn`, `.mpbKanbanColumnCollapsed`, etc. These feed the board. Once classes are swapped to `pn-*`, the `pn-*` rules (token-bound) take over for the swapped elements. For any remaining wrapper still using `var(--bg,...)` (overlay), repoint bg → `--pn-paper` so it flips light(paper)/dark(graphite) automatically. NEVER a fixed light or dark hex. Terminal areas N/A here.

---

## OPEN QUESTIONS for coordinator (sess_1780983665553_0qnartfgo)
1. **No-prototype chrome:** boards.jsx FullBoard has none of: tabs, header stats, layout toggle, sidebar, close button, modal overlay. How should I skin `taskBoardTabs/Tab`, `taskBoardHeaderStats/Stat*`, `mpbLayoutToggle/Btn`, `taskBoardCloseBtn`, `mpbOverlay/Container`? Use shell.jsx primitives (`pn-tabs/pn-tab`, `pn-seg`, `pn-ib`, `pn-meta`)? Or leave these as-is (out of scope) and only swap the prototype-backed board/column/row classes?
2. **Single-project mode:** `Board` also renders the single-project view (`taskBoard*` / `taskBoardOverlay`). Its analog is the ProjectBoard prototype (`pn-screen` "agent-maestro" + `pn-bcols`). Is the single-project chrome mine, or the Project Board Worker's? It lives in `MultiProjectBoard.tsx` (my file).
3. **UnifiedKanbanView columns:** these inline `taskBoardColumn*` classes are ALSO used by `KanbanColumn.tsx` (Project Board Worker) via `styles-task-board.css`. If I swap them to `pn-bcol` inline here, do I risk diverging from their CSS handling? Confirm I should swap the in-file unified columns to `pn-bcol` regardless.
