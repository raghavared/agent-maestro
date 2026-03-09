# UI List Virtualization & DOM Performance Audit

## Executive Summary

**No virtualization library is installed** (no react-window, react-virtualized, react-virtuoso, or @tanstack/react-virtual). Every list in the UI renders all items directly into the DOM. At scale (200+ items), this creates significant DOM bloat, slow renders, and potential layout thrashing. Below is a component-by-component audit with specific findings and severity ratings.

---

## Finding 1: SessionsSection — No Virtualization for Session List

**File:** `maestro-ui/src/components/SessionsSection.tsx`
**Severity:** HIGH
**Lines:** 883-926

### Problem
The entire session list is rendered without any windowing. Each session item is wrapped in `SortableSessionItem` (from dnd-kit), which adds an extra wrapper div per item. The `renderSessionItem` function (lines 365-644) creates a **deeply nested DOM structure per session** — approximately 15-25 DOM nodes per inactive session, and 40-60+ nodes per active/expanded session (with task chips, action bars, status badges, avatar groups, etc.).

### Specific Issues
- **Line 780-829:** `historySessions.map(...)` renders ALL past sessions in a dropdown with no pagination or virtualization. With frequent usage, this list grows unbounded.
- **Line 849-866:** `agentShortcuts.map(...)` — minor, but creates an `<img>` per shortcut without lazy loading.
- **Line 260-278:** `sessionTasks` useMemo iterates all sessions × all tasks × all expanded sessions on every render — O(sessions × tasks).
- **Line 392-432:** For every session item rendered, multiple Map lookups are performed (`maestroSessions.get`, `maestroTasks.get`) plus array operations (`teamSnapshots.map`, `sessionTaskList.map`) inside the render path.

### DOM Count Estimate
With 50 sessions: ~750-1250 DOM nodes just for the session list.
With 200 sessions: ~3000-5000 DOM nodes.

---

## Finding 2: SortableTaskList — Renders All Tasks Without Windowing

**File:** `maestro-ui/src/components/maestro/SortableTaskList.tsx`
**Severity:** HIGH
**Lines:** 108-136

### Problem
All task `roots` are rendered inline without virtualization:
```tsx
{roots.map((node) => (
  <SortableTaskItem key={node.id} id={node.id}>
    {renderTaskNode(node, 0, ...)}
  </SortableTaskItem>
))}
```

Each task node is wrapped in a `SortableTaskItem` with dnd-kit's `useSortable` hook (which creates refs, measurements, and event listeners per item). The `renderTaskNode` callback is supplied externally and can produce arbitrarily complex DOM per task.

### Specific Issues
- No windowing means 200+ tasks = 200+ dnd-kit sortable items, each with its own event listeners and DOM measurements.
- The dnd-kit `SortableContext` with `verticalListSortingStrategy` computes bounding rects for ALL items on mount and drag start.

---

## Finding 3: TaskListsPanel — Nested Lists Without Virtualization

**File:** `maestro-ui/src/components/maestro/TaskListsPanel.tsx`
**Severity:** MEDIUM-HIGH
**Lines:** 80-131, 298-375

### Problem
Two-level nesting with no virtualization:
1. **Outer list** (lines 302-372): All `taskLists` are rendered via `taskLists.map(...)`.
2. **Inner list** (lines 84-127): Each expanded list renders ALL `taskIds` via `taskIds.map(...)`.

Each level uses its own `DndContext` + `SortableContext`, creating independent dnd-kit measurement trees.

### Specific Issues
- **Line 84:** `TaskListTasks` renders every task in the list without windowing. A list with 100 tasks renders all 100 sortable items.
- **Line 155:** `tasksById` creates a new `Map` on every tasks change — acceptable, but the fact that every item then does `tasksById.get(taskId)` inside a `.map()` in JSX means this runs on every render.
- Multiple dnd-kit instances nested (one for lists, one per expanded list) creates compounding measurement overhead.

---

## Finding 4: MultiProjectBoard / UnifiedKanbanView — Full Column Render Without Virtualization

**File:** `maestro-ui/src/components/maestro/MultiProjectBoard.tsx`
**Severity:** HIGH
**Lines:** 487-569 (UnifiedKanbanView), 375-398 (grouped view)

### Problem
The unified kanban view renders **all tasks in all columns** simultaneously:
```tsx
colTasks.map((task) => (
  <TaskCard key={task.id} ... />
))
```

In a project with 500 tasks distributed across 6 columns, all 500 `TaskCard` components render.

### Specific Issues
- **Lines 458-476:** `columnData` useMemo sorts ALL tasks every time the task list changes. Sorting is O(n log n) per column on every task update.
- **Lines 148-158:** `taskStats` iterates ALL `effectiveTasks` with 5 separate `.filter()` calls — could be a single pass.
- **Lines 160-170:** `sessionStats` iterates ALL `terminalSessions` with 3 separate `.filter()` calls.
- **Lines 172-192:** `taskCountByProject` and `sessionCountByProject` iterate entire collections on every render.
- **Line 91:** `useTasks(focusProjectId ?? "")` is called unconditionally even in multi-project mode, fetching data that won't be used.
- **Grouped view (line 376):** Each `ProjectKanbanRow` independently renders its own full task list, further multiplying DOM nodes.

### DOM Count Estimate
With 500 tasks across 6 columns, each `TaskCard` ~10-15 nodes = ~5,000-7,500 task-related nodes plus column containers.

---

## Finding 5: TeamMemberList — No Virtualization

**File:** `maestro-ui/src/components/maestro/TeamMemberList.tsx`
**Severity:** LOW-MEDIUM
**Lines:** 267-318

### Problem
All team members are rendered without windowing. While team member counts are typically small (10-50), the expandable `TeamMemberRow` creates significant DOM per member when expanded (role, identity, skills, actions bar).

### Specific Issues
- **Lines 247-250:** Four separate `.filter()` calls on the same array could be a single pass:
  ```tsx
  const activeMembers = teamMembers.filter(m => m.status === 'active');
  const archivedMembers = teamMembers.filter(m => m.status === 'archived');
  const defaultMembers = activeMembers.filter(m => m.isDefault);
  const customMembers = activeMembers.filter(m => !m.isDefault);
  ```
- These filters are not memoized — they rerun on every render.

---

## Finding 6: SessionTimeline / AggregatedTimeline — Unbounded Event Rendering

**File:** `maestro-ui/src/components/maestro/SessionTimeline.tsx`
**Severity:** HIGH
**Lines:** 135-144, 258-269

### Problem
Timeline events are rendered without virtualization:
```tsx
{displayEvents.map((event) => (
  <TimelineEvent key={event.id} event={event} ... />
))}
```

While `maxEvents` provides a cap, the `AggregatedTimeline` can still render many events (default `maxEvents = 20`, but the full `filteredEvents` are computed regardless).

### Specific Issues
- **Lines 38-39:** `sortedEvents` creates a new sorted copy of the entire events array on every events change.
- **Lines 43-68:** `filteredEvents` iterates the sorted array again with filter logic.
- **Lines 179-194:** `AggregatedTimeline.allEvents` merges events from ALL sessions — potentially hundreds of events from many sessions, creating a large intermediate array.
- **Line 207:** `filteredEvents.slice(-maxEvents)` only limits display but the full array is still materialized.

---

## Finding 7: TimelineEvent — Repeated Date Formatting

**File:** `maestro-ui/src/components/maestro/TimelineEvent.tsx`
**Severity:** LOW
**Lines:** 59-81

### Problem
Each `TimelineEvent` component calls `formatTime()` or `formatTimeAgo()` and `formatFullTimestamp()` on every render. `toLocaleTimeString()` and `toLocaleString()` are known to be relatively expensive — they involve Intl API calls.

When rendering 20+ timeline events, this means 40+ `toLocaleString` calls per render cycle.

---

## Finding 8: DocsList — No Virtualization for Document Grid

**File:** `maestro-ui/src/components/maestro/DocsList.tsx`
**Severity:** LOW-MEDIUM
**Lines:** 44-74

### Problem
All docs are rendered without virtualization:
```tsx
{sortedDocs.map((doc) => { ... })}
```

### Specific Issues
- **Line 27-29:** `sortedDocs` creates a new sorted array on every render (though memoized with `docs` dep).
- Each doc card creates ~10 DOM nodes. With 100+ documents, this becomes 1000+ nodes.

---

## Finding 9: DocViewer — ReactMarkdown Rendering Cost

**File:** `maestro-ui/src/components/maestro/DocViewer.tsx`
**Severity:** MEDIUM
**Lines:** 48-84, 180-198

### Problem
`ReactMarkdown` with `remarkGfm` plugin parses and renders the ENTIRE document content on every mount. For large markdown documents, this is an expensive operation.

### Specific Issues
- **Lines 48-84:** `markdownComponents` object is recreated on every parent render (not memoized or defined outside component). This causes ReactMarkdown to re-render all custom components.
  - EDIT: Actually it IS defined outside the component at module scope (line 48), so this is OK.
- **Lines 60-69:** Auto-detection of mermaid content checks `mermaidKeywords.some(...)` for every unlabeled code block. The `mermaidKeywords` array is recreated on every code block render.
- Each code block that matches mermaid triggers a full `MermaidDiagram` render (see Finding 10).

---

## Finding 10: MermaidDiagram — Expensive Re-initialization & SVG Rendering

**File:** `maestro-ui/src/components/maestro/MermaidDiagram.tsx`
**Severity:** HIGH
**Lines:** 48-56, 128-153, 177-186

### Problem
Every `MermaidDiagram` instance:
1. Calls `reinitMermaid()` which calls `mermaid.initialize()` with `getThemeColors()` — this reads `getComputedStyle(document.documentElement)` (forces style recalc) on EVERY render.
2. Calls `mermaid.render()` which is async and CPU-intensive (parses mermaid syntax, generates SVG).
3. Uses `dangerouslySetInnerHTML` with DOMPurify sanitization of the SVG on every render.

### Specific Issues
- **Lines 22-46:** `getThemeColors()` calls `getComputedStyle(document.documentElement)` which forces a style recalculation. This is called once per diagram render.
- **Lines 48-56:** `reinitMermaid()` re-initializes the entire mermaid library with theme config on every single render. This is the biggest issue — it should be initialized once and updated only on theme change.
- **Line 130:** `diagramCounter` is a module-level variable that increments on every render, creating unique IDs like `mermaid-diagram-1`, `mermaid-diagram-2`, etc. The old SVG elements from failed renders (line 147) are cleaned up via DOM query, but successful ones may leave stale elements.
- **Line 177:** `DOMPurify.sanitize()` is called on every render, not just when `svgContent` changes. It's in the render path, not in the effect.
- **Lines 185-186 & 213-215:** `dangerouslySetInnerHTML` with the same sanitized SVG is used twice (inline preview + overlay). The overlay duplicates the entire SVG DOM.
- **No caching:** If the same chart string is passed again (e.g., parent re-render), the entire render pipeline runs again.

### Performance Impact
With 5 mermaid diagrams in a document:
- 5 × `getComputedStyle` forced reflows
- 5 × `mermaid.initialize()` re-initializations
- 5 × SVG parsing and generation
- 5 × DOMPurify sanitization
- 10 × SVG injection via `dangerouslySetInnerHTML` (if any are zoomed)

---

## Finding 11: processEffects.ts — Minor But Frequent Linear Scans

**File:** `maestro-ui/src/processEffects.ts`
**Severity:** LOW
**Lines:** 34-50, 52-55

### Problem
`detectProcessEffect()` and `getProcessEffectById()` both use linear scans over `PROCESS_EFFECTS` array. Currently the array only has 2 entries, but:
- `getProcessEffectById()` is called once per session item rendered in `SessionsSection` (line 369).
- With 200 sessions, that's 200 linear scans — still trivial with 2 entries but won't scale if more effects are added.

---

## Finding 12: domUtils.ts — Missing Performance Utilities

**File:** `maestro-ui/src/utils/domUtils.ts`
**Severity:** LOW (but a missed opportunity)

### Problem
This file only contains `sleep()` and `copyToClipboard()`. It's missing commonly needed DOM performance utilities:
- No `requestIdleCallback` wrapper for deferred work
- No `IntersectionObserver` utilities for lazy loading
- No debounce/throttle for scroll or resize handlers
- No `will-change` management helpers

---

## Finding 13: Missing `will-change` and CSS Containment

**Severity:** MEDIUM
**Across all components**

### Problem
None of the list containers use CSS `contain` property for layout containment. This means the browser must recalculate layout for the entire page when any list item changes.

### Missing in:
- `.sessionList` — no `contain: content` or `contain: layout`
- `.terminalTaskList` — no containment
- `.taskBoardColumnBody` — no containment (the main column body that holds task cards)
- `.sessionTimelineEvents` — no containment
- `.docsListGrid` — no containment

### Also Missing:
- No `will-change: transform` on elements that animate (sortable items, drag ghosts)
- No `content-visibility: auto` for off-screen list items

---

## Finding 14: Layout Thrashing Patterns

**Severity:** MEDIUM

### SessionsSection (lines 158-163, 165-169)
```tsx
const computeDropdownPos = useCallback((btnRef) => {
  const rect = btn.getBoundingClientRect();  // Forces layout
  return { top: rect.bottom + 4, right: window.innerWidth - rect.right };
}, []);

useLayoutEffect(() => {
  if (settingsOpen) {
    setSettingsDropdownPos(computeDropdownPos(settingsBtnRef));  // Read in layoutEffect
  }
}, [settingsOpen, computeDropdownPos]);
```
`getBoundingClientRect()` inside `useLayoutEffect` forces a synchronous layout pass. This runs for both settings and history dropdowns.

### MermaidDiagram (lines 22-46)
`getComputedStyle(document.documentElement)` forces style recalculation. Called on every diagram render.

---

## Finding 15: Unoptimized SVG/Icon Rendering

**Severity:** LOW-MEDIUM

### Inline SVG Duplication
Multiple components define SVG icons inline rather than referencing shared SVG sprites:
- **SessionsSection lines 943-980:** 3 different inline SVGs for space type icons, rendered for each space item.
- **TeamSessionGroup:** Inline SVGs for team status indicators.
- **DocViewer lines 137-143:** Fullscreen toggle SVGs.
- **MermaidDiagram lines 201-208:** Zoom control SVGs.

Each inline SVG creates its own DOM subtree. With many items, this multiplies quickly.

### TaskCard (from explore findings)
Each task card renders priority badges, status indicators, subtask progress, and session counts as separate DOM elements — ~10-15 nodes per card even in compact mode.

---

## Finding 16: MultiProjectSessionsView — DOM Reparenting

**File:** `maestro-ui/src/components/maestro/MultiProjectSessionsView.tsx`
**Severity:** MEDIUM-HIGH

### Problem
The `ResizableSessionColumn` component does DOM reparenting — it moves terminal DOM elements into board columns using direct DOM manipulation. This is inherently expensive as it:
- Causes layout recalculation when elements are moved
- May break React's reconciliation for moved elements
- Triggers reflow/repaint cycles

---

## Finding 17: Dashboard — Heavy Chart Rendering

**File:** `maestro-ui/src/components/maestro/Dashboard.tsx`
**Severity:** MEDIUM

### Problem
The Dashboard component renders multiple Recharts charts simultaneously:
- Area chart (task activity over time)
- Pie chart (by status)
- Bar chart (by priority)
- Bar chart (sessions)
- Calendar heatmap
- Due dates list
- Team member stats cards

All charts render on mount regardless of visibility. No lazy loading of off-screen charts.

### Specific Issues
- 527 lines with multiple expensive data transformations
- Time range filtering recomputes all chart data on range change
- Calendar heatmap renders a cell for every day in the selected range (up to 365 cells)

---

## Summary Table

| # | Component | Issue | Severity | Est. DOM Nodes at Scale |
|---|-----------|-------|----------|------------------------|
| 1 | SessionsSection | No virtualization, heavy per-item DOM | HIGH | 3000-5000 (200 sessions) |
| 2 | SortableTaskList | No virtualization + dnd-kit overhead | HIGH | 2000-3000 (200 tasks) |
| 3 | TaskListsPanel | Nested lists, no virtualization | MEDIUM-HIGH | 1500-3000 (10 lists × 100 tasks) |
| 4 | MultiProjectBoard | Full column render, redundant iterations | HIGH | 5000-7500 (500 tasks) |
| 5 | TeamMemberList | No virtualization, unmemoized filters | LOW-MEDIUM | 500-1000 (50 members) |
| 6 | SessionTimeline | Unbounded event rendering | HIGH | 1000-2000 (100+ events) |
| 7 | TimelineEvent | Expensive date formatting per item | LOW | N/A (CPU cost) |
| 8 | DocsList | No virtualization | LOW-MEDIUM | 1000+ (100 docs) |
| 9 | DocViewer | ReactMarkdown full-doc parse | MEDIUM | Variable |
| 10 | MermaidDiagram | reinitMermaid per render, no caching | HIGH | Variable (SVG complexity) |
| 11 | processEffects.ts | Linear scan per session | LOW | N/A (CPU cost) |
| 12 | domUtils.ts | Missing perf utilities | LOW | N/A |
| 13 | CSS Containment | No `contain` or `content-visibility` | MEDIUM | N/A (layout cost) |
| 14 | Layout Thrashing | getBoundingClientRect in layoutEffect | MEDIUM | N/A (layout cost) |
| 15 | SVG Icons | Inline SVGs not shared | LOW-MEDIUM | 200-500 extra nodes |
| 16 | MultiProjectSessionsView | DOM reparenting | MEDIUM-HIGH | N/A (reflow cost) |
| 17 | Dashboard | All charts render at once | MEDIUM | 2000-3000 (charts + heatmap) |

---

## Recommendations (Priority Order)

### P0 — Critical (implement first)
1. **Add virtualization library** (@tanstack/react-virtual recommended) for SessionsSection, SortableTaskList, kanban columns, and SessionTimeline.
2. **Cache MermaidDiagram renders** — initialize mermaid once, cache SVG output by chart string, avoid re-init on every render.
3. **Add CSS `contain: content`** to all scrollable list containers.

### P1 — High Priority
4. **Add `content-visibility: auto`** to off-screen list items for automatic rendering deferral.
5. **Lazy-load Dashboard charts** — only render charts visible in viewport.
6. **Consolidate filter iterations** — replace multiple `.filter()` passes with single-pass categorization in TeamMemberList, MultiProjectBoard.
7. **Memoize expensive computations** — `taskStats`, `sessionStats`, column data sorting.

### P2 — Medium Priority
8. **Use SVG sprite sheet** instead of inline SVGs for repeated icons.
9. **Add `will-change: transform`** to drag-sortable items.
10. **Debounce dropdown position calculations** to avoid synchronous layout in useLayoutEffect.
11. **Add pagination to session history dropdown** instead of rendering all past sessions.

### P3 — Low Priority
12. **Convert processEffects lookups to Map** for O(1) access.
13. **Add requestIdleCallback utilities** to domUtils.ts.
14. **Memoize date formatting** in TimelineEvent (cache formatted strings).
