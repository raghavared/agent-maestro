# Session UI Remaster — Design Spec

## 1. Goal & scope
Rebuild **only the sessions list** inside the right-side panel (`SpacesPanel → SessionsSection`) so sessions render as a **task-tile-style collapsible tree**, where nesting = the existing **spawn chain** (`parentSessionId`). Clicking a session opens a **detail overlay** that mirrors the task detail overlay exactly.

**Untouched:** terminals/documents segmented filter, history dropdown, agent shortcuts, the left `MaestroPanel` (tasks). Team coordinator→worker color accents are **kept** as a visual layer over the tree.

### Layout reference (corrected)
- **Right panel** = `App.tsx:569` `<SpacesPanel>` (commented "Sessions on right") → hosts `SessionsSection`. **This is where sessions live.**
- **Left panel** = `AppLeftPanel` → `MaestroPanel` (Tasks). Not touched by this work.

## 2. Clarified decisions (locked)
- **Tree entity:** maestro sessions (`useMaestroStore`), not local terminal sessions. Terminal-linked sessions are highlighted/clickable-to-focus.
- **Hierarchy basis:** strict `parentSessionId` chain, **plus** keep existing per-team color accents as a visual layer.
- **Detail presentation:** exactly like the task tile UX (single-line tile + expandable meta) and the task detail overlay (tabbed).
- **Scope:** replace **only** the Sessions view within `SessionsSection`; keep terminals/documents filters, history, agent shortcuts.
- **Sub-sessions:** visualize existing spawn chain only — **no** manual sub-session creation in v1.
- **Status dot:** read-only indicator (sessions are agent-driven, not user-toggled).
- **Primary tile action:** jump to terminal (resume if stopped). Include stop/close. Single line; expands via rightmost caret button.

## 3. Data layer
- **Source of truth:** maestro sessions from `useMaestroStore.sessions`, filtered to the active project. Sessions with a live local terminal (`useSessionStore`) are marked "linked".
- **Tree building:** new `useSessionTree(sessions)` hook — direct clone of `useTaskTree`: group by `parentSessionId ?? null`, attach children recursively, return `{ roots, getChildren }`. Roots = sessions with no parent in the current set.
- **No new server endpoint needed** for v1: all project sessions are already in the store, so children are derived client-side (same model as tasks). `rootSessionId` available as fallback/validation.
- **Team colors:** reuse `buildTeamGroups()` → `sessionColorMap` to paint a left accent bar per node, independent of nesting.

## 4. New / changed components
| Component | Mirrors | Role |
|---|---|---|
| `SessionListItem.tsx` | `TaskListItem.tsx` | Single-line session tile + expandable meta |
| `SessionNodeRenderer` (in sessions view) | `TaskNodeRenderer` (MaestroPanel) | Recursive tree render w/ depth, collapse set |
| `useSessionTree.ts` | `useTaskTree.ts` | Build parent→child tree |
| `SessionDetailOverlay` + restyled `SessionDetailModal` | `TaskDetailOverlay` + `CreateTaskModal` | Tabbed detail overlay |
| `AddSubSession` | — | **Omitted** (visualize-only, no manual creation) |

## 5. Session tile anatomy (single line — exact task-tile mapping)
```
[▸3]  ●working   Coordinator: build auth      [avatar]   [↗]  [▾]
 │      │          │                            │          │    └ expand caret (rightmost) → toggles meta
 │      │          │                            │          └ primary action = JUMP TO TERMINAL (focus live term; stop/close secondary)
 │      │          │                            └ team-member avatar(s) badge
 │      │          └ name, click → opens detail overlay
 │      └ status dot: READ-ONLY colored indicator (working/idle/done/failed/needs-input)
 └ sub-session arrow + child count, collapse/expand
```
- **Status dot:** read-only colored indicator.
- **Primary button (↗):** focus linked terminal; if stopped, resume.
- **Stop/close (✕):** terminate a running session (secondary).
- **Rightmost caret (▾):** expand/collapse meta inline. Single-line by default.

## 6. Expanded meta (toggled by caret)
- **Read-only badges:** mode · model · strategy · started / last-activity (+duration).
- **Editable:** **mode** inline (via existing `updateSessionMode`). Everything else read-only.
- **Linked tasks chips:** session `taskIds` as status-symbol chips (analog of task tile's sessions row).
- **Docs row:** session `docs[]` as openable items (opens in a document space, same as task docs row).
- **Resume:** offered here for stopped/completed sessions.

## 7. Detail overlay (mirrors `TaskDetailOverlay`/`CreateTaskModal`, tabbed)
1. **Info** — identifiers, status, started/last-activity/duration, hostname/platform, spawn source, mode/model/strategy. (Reuses existing `SessionDetailsSection` content.)
2. **Sub-sessions** — spawn-chain children as a list/tree with progress (Subtasks-tab analog).
3. **Tasks** — linked tasks for this session.
4. **Docs + Timeline** — `DocsList` + `SessionTimeline` (both already exist).

Opening pattern reuses the task `useUIStore` overlay mechanism (add `sessionDetailOverlay` state alongside `taskDetailOverlay`).

## 8. Sub-tabs for the sessions view
Mirror task sub-tabs: **Active** (working/idle/spawning/needs-input) · **Completed** (completed/stopped/failed) · optionally **All**. Roots filtered by status; children always shown under a visible root.

## 9. Files to add / change
**Add:** `hooks/useSessionTree.ts`, `components/maestro/SessionListItem.tsx`, `components/maestro/session-modal/*` (InfoTab, SubSessionsTab, TasksTab, DocsTimelineTab), CSS additions in `styles-maestro-sessions-v2.css`.
**Change:** `SessionsSection.tsx` (swap flat list/`TeamSessionGroup` render for the tree in the Sessions segment only), `useUIStore.ts` (session overlay state), restyle `SessionDetailModal.tsx`.

## 10. Build phases
1. `useSessionTree` + read-only `SessionListItem` (status dot, title→overlay, arrow/collapse) wired into the Sessions segment, team colors layered.
2. Tile actions (jump-to-terminal, stop/close) + expandable meta (badges, linked-task chips, docs, editable mode, resume).
3. Detail overlay with the 4 tabs.
4. Sub-tabs (Active/Completed) + polish.

## 11. Open points (flagged, not blockers)
- **Cross-project / master sessions** can have parents in another project — v1 nests only within the active project; show as a root if the parent isn't in-scope.
- **`TeamSessionGroup`** stays used elsewhere (e.g. team view) untouched; only its grouping in the Sessions segment is replaced by the tree (colors retained).

## 12. Key source references
- Task tile UX: `maestro-ui/src/components/maestro/TaskListItem.tsx`
- Task tree render: `maestro-ui/src/components/maestro/MaestroPanel.tsx` (`TaskNodeRenderer`)
- Tree hook to clone: `maestro-ui/src/hooks/useTaskTree.ts`
- Current session list: `maestro-ui/src/components/SessionsSection.tsx`
- Current session detail: `maestro-ui/src/components/maestro/SessionDetailModal.tsx`, `SessionDetailsSection.tsx`
- Team grouping/colors: `maestro-ui/src/utils/teamGrouping.ts`
- Session type: `maestro-ui/src/app/types/maestro.ts` (`MaestroSession`, `parentSessionId`/`rootSessionId`), `maestro-server/src/types.ts`
- Layout mount: `maestro-ui/src/App.tsx:569` (`<SpacesPanel>`)
