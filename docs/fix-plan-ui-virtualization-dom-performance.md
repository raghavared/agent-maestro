# Fix Plan: UI Virtualization & DOM Performance

**Reference:** `docs/ui-list-virtualization-dom-performance.md`
**Priority:** HIGH
**Estimated scope:** ~15 files modified, 1 package added

---

## Overview

The UI renders every list item into the DOM with no windowing. At scale (200+ sessions, 500+ tasks), this creates 5,000–15,000+ unnecessary DOM nodes, causing jank and slow renders. This plan addresses virtualization, CSS containment, chart lazy-loading, computation consolidation, and rendering optimizations.

---

## Phase 1: Install @tanstack/react-virtual (P0)

### Step 1.1 — Add dependency

```bash
cd maestro-ui && npm install @tanstack/react-virtual
```

**Why @tanstack/react-virtual over alternatives:**
- Headless (no wrapper divs) — works with existing flex containers and dnd-kit wrappers
- Small bundle (~3KB gzip)
- Supports dynamic row heights (needed for expanded sessions/tasks)
- Active maintenance, React 18 compatible

---

## Phase 2: Virtualize High-Impact Lists (P0)

### Step 2.1 — Virtualize SessionsSection history dropdown

**File:** `maestro-ui/src/components/SessionsSection.tsx`
**Lines:** ~780–829 (historySessions.map)

**Current:** `historySessions.map(hs => <div>...</div>)` renders all past sessions unbounded.

**Fix:**
1. Import `useVirtualizer` from `@tanstack/react-virtual`
2. Add a scrollable container ref around the history dropdown content
3. Replace `.map()` with virtualizer:
   ```tsx
   const parentRef = useRef<HTMLDivElement>(null);
   const rowVirtualizer = useVirtualizer({
     count: historySessions.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 36, // estimated row height
     overscan: 5,
   });

   <div ref={parentRef} className="sessionHistoryDropdown__list" style={{ maxHeight: 320, overflow: 'auto' }}>
     <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
       {rowVirtualizer.getVirtualItems().map(virtualRow => {
         const hs = historySessions[virtualRow.index];
         return (
           <div key={hs.id} style={{
             position: 'absolute',
             top: virtualRow.start,
             width: '100%',
             height: virtualRow.size,
           }}>
             {/* existing row content */}
           </div>
         );
       })}
     </div>
   </div>
   ```
4. Keep existing click handlers and formatting logic intact.

**Impact:** History dropdown goes from rendering 200+ rows to ~15 visible + 10 overscan.

---

### Step 2.2 — Virtualize SortableTaskList

**File:** `maestro-ui/src/components/maestro/SortableTaskList.tsx`
**Lines:** ~108–136 (roots.map)

**Current:** `roots.map(node => <SortableTaskItem>...</SortableTaskItem>)` renders all root tasks.

**Fix:**
1. Add virtualizer wrapping the SortableContext content:
   ```tsx
   const parentRef = useRef<HTMLDivElement>(null);
   const rowVirtualizer = useVirtualizer({
     count: roots.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 44, // base task row height
     overscan: 8,
   });
   ```
2. Replace the `.map()` with virtual items while keeping `SortableContext` items={roots.map(r => r.id)} unchanged (SortableContext needs all IDs for drag calculations):
   ```tsx
   <SortableContext items={roots.map(r => r.id)} strategy={verticalListSortingStrategy}>
     <div ref={parentRef} style={{ overflow: 'auto', maxHeight: containerHeight }}>
       <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
         {rowVirtualizer.getVirtualItems().map(virtualRow => {
           const node = roots[virtualRow.index];
           return (
             <div key={node.id} style={{
               position: 'absolute',
               top: virtualRow.start,
               width: '100%',
             }}>
               <SortableTaskItem id={node.id}>
                 {renderTaskNode(node, 0, ...)}
               </SortableTaskItem>
             </div>
           );
         })}
       </div>
     </div>
   </SortableContext>
   ```

**dnd-kit compatibility note:** `SortableContext` still receives the full `items` array for drag index calculation. Only the DOM rendering is virtualized. During active drag, we may need to increase overscan or temporarily render all items within a small range of the drag source/target.

**Impact:** 200 tasks → ~20 rendered + 16 overscan.

---

### Step 2.3 — Virtualize Kanban column bodies (UnifiedKanbanView)

**File:** `maestro-ui/src/components/maestro/MultiProjectBoard.tsx`
**Lines:** ~487–569 (column rendering)

**Current:** `colTasks.map(task => <TaskCard .../>)` renders all tasks per column.

**Fix:**
1. Extract column body into a `VirtualizedColumnBody` component:
   ```tsx
   function VirtualizedColumnBody({ tasks, ...props }) {
     const parentRef = useRef<HTMLDivElement>(null);
     const rowVirtualizer = useVirtualizer({
       count: tasks.length,
       getScrollElement: () => parentRef.current,
       estimateSize: () => 72, // TaskCard estimated height
       overscan: 5,
     });

     return (
       <div ref={parentRef} className="taskBoardColumnBody">
         <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
           {rowVirtualizer.getVirtualItems().map(virtualRow => {
             const task = tasks[virtualRow.index];
             return (
               <div key={task.id} style={{
                 position: 'absolute',
                 top: virtualRow.start,
                 width: '100%',
               }}>
                 <TaskCard task={task} {...props} />
               </div>
             );
           })}
         </div>
       </div>
     );
   }
   ```
2. Replace the inline `colTasks.map(...)` with `<VirtualizedColumnBody tasks={colTasks} ... />`.
3. Add `React.memo` to `TaskCard` component to prevent re-renders when parent virtualizer repositions items.

**Impact:** 500 tasks across 6 columns → ~30 rendered per visible column instead of all 500.

---

### Step 2.4 — Virtualize SessionTimeline events

**File:** `maestro-ui/src/components/maestro/SessionTimeline.tsx`
**Lines:** ~135–144 (displayEvents.map)

**Current:** `displayEvents.map(event => <TimelineEvent .../>)` renders up to `maxEvents` items (default 20 per session, but AggregatedTimeline merges all sessions).

**Fix:**
1. For `AggregatedTimeline` (which merges events from ALL sessions and can grow large):
   ```tsx
   const parentRef = useRef<HTMLDivElement>(null);
   const rowVirtualizer = useVirtualizer({
     count: displayEvents.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 48,
     overscan: 5,
   });
   ```
2. Replace the `.map()` with virtual items.
3. For single-session `SessionTimeline` (capped at `maxEvents=20`): skip virtualization — 20 items is fine. Only apply to `AggregatedTimeline`.

**Impact:** Aggregated timeline with 200+ events → ~15 rendered.

---

## Phase 3: Cache MermaidDiagram Renders (P0)

**File:** `maestro-ui/src/components/maestro/MermaidDiagram.tsx`

### Step 3.1 — Initialize mermaid once, not per render

**Current:** `reinitMermaid()` calls `mermaid.initialize()` on every render (lines 48–56).

**Fix:**
1. Create a module-level initialization flag:
   ```tsx
   let mermaidInitialized = false;
   let lastTheme: string | null = null;

   function ensureMermaidInit() {
     const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
     if (mermaidInitialized && currentTheme === lastTheme) return;

     const colors = getThemeColors();
     mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: colors });
     mermaidInitialized = true;
     lastTheme = currentTheme;
   }
   ```
2. Replace `reinitMermaid()` call in useEffect with `ensureMermaidInit()`.

### Step 3.2 — Cache SVG output by chart string

**Fix:**
1. Add a module-level LRU-style cache:
   ```tsx
   const svgCache = new Map<string, string>(); // chart string → sanitized SVG
   const MAX_CACHE = 50;
   ```
2. In the render effect, check cache first:
   ```tsx
   useEffect(() => {
     const cached = svgCache.get(chart.trim());
     if (cached) {
       setSvgContent(cached);
       return;
     }
     // ... existing async render logic ...
     // On success:
     const sanitized = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
     svgCache.set(chart.trim(), sanitized);
     if (svgCache.size > MAX_CACHE) {
       const firstKey = svgCache.keys().next().value;
       svgCache.delete(firstKey);
     }
     setSvgContent(sanitized);
   }, [chart]);
   ```

### Step 3.3 — Move DOMPurify.sanitize out of render path

**Current:** `DOMPurify.sanitize()` runs on every render (line 177).

**Fix:** Sanitize once in the effect (step 3.2 above), store the sanitized result in state. The render path just uses `svgContent` directly (which is already sanitized).

**Impact:** Repeated renders of the same diagram are instant. Theme changes still trigger re-render. With 5 diagrams in a doc, initial render is unchanged but subsequent renders avoid 5× mermaid.render() + 5× DOMPurify.sanitize().

---

## Phase 4: CSS Containment & content-visibility (P1)

### Step 4.1 — Add `contain: content` to scrollable list containers

**Files to modify:**

| CSS Class | File |
|-----------|------|
| `.sessionList` | `maestro-ui/src/styles-sidebar-redesign.css` |
| `.terminalTaskList` | `maestro-ui/src/styles-terminal-theme.css` |
| `.taskBoardColumnBody` | `maestro-ui/src/styles-excalidraw.css` |
| `.sessionTimelineEvents` | `maestro-ui/src/styles-maestro-sessions-v2.css` |
| `.docsListGrid` | `maestro-ui/src/styles-docs-v2.css` |

**Add to each:**
```css
.sessionList {
  contain: content;
}
/* repeat for each container */
```

`contain: content` tells the browser that the element's contents don't affect layout outside it, enabling layout/paint isolation.

**Caution:** `contain: content` implies `contain: layout style paint`. Verify no child uses `position: fixed` or overflows the container visually. The existing containers all use `overflow: hidden` or `overflow-y: auto`, so this should be safe.

### Step 4.2 — Add `content-visibility: auto` to list items in long lists

For virtualized lists, this is redundant (virtual items are already not rendered). Apply to non-virtualized lists that are still lengthy:

```css
.taskListItem {
  content-visibility: auto;
  contain-intrinsic-size: auto 44px; /* estimated height */
}

.docsListCard {
  content-visibility: auto;
  contain-intrinsic-size: auto 48px;
}

.teamMemberRow {
  content-visibility: auto;
  contain-intrinsic-size: auto 52px;
}
```

**Impact:** Browser skips rendering off-screen items entirely, dramatically reducing paint work for scrollable containers.

---

## Phase 5: Lazy-Load Dashboard Charts (P1)

**File:** `maestro-ui/src/components/maestro/Dashboard.tsx`

### Step 5.1 — Use React.lazy + Suspense for chart sections

**Current:** All 5+ Recharts charts render on mount regardless of viewport visibility.

**Fix:**
1. Split each chart section into its own component if not already:
   - `TaskActivityChart`
   - `TaskStatusPie`
   - `TaskPriorityBar`
   - `SessionsBar`
   - `CalendarHeatmap`
2. Use an `IntersectionObserver`-based lazy render wrapper:
   ```tsx
   function LazyVisible({ children, minHeight = 200 }) {
     const ref = useRef<HTMLDivElement>(null);
     const [visible, setVisible] = useState(false);

     useEffect(() => {
       const observer = new IntersectionObserver(
         ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
         { rootMargin: '100px' }
       );
       if (ref.current) observer.observe(ref.current);
       return () => observer.disconnect();
     }, []);

     if (!visible) return <div ref={ref} style={{ minHeight }} />;
     return <>{children}</>;
   }
   ```
3. Wrap each chart section:
   ```tsx
   <LazyVisible minHeight={300}>
     <TaskActivityChart data={chartData} />
   </LazyVisible>
   ```

**Impact:** Only charts visible in the viewport render on mount. Scrolling into view triggers rendering with 100px anticipation margin.

---

## Phase 6: Consolidate Filter Iterations (P1)

### Step 6.1 — TeamMemberList single-pass categorization

**File:** `maestro-ui/src/components/maestro/TeamMemberList.tsx`
**Lines:** ~247–250

**Current:**
```tsx
const activeMembers = teamMembers.filter(m => m.status === 'active');
const archivedMembers = teamMembers.filter(m => m.status === 'archived');
const defaultMembers = activeMembers.filter(m => m.isDefault);
const customMembers = activeMembers.filter(m => !m.isDefault);
```
4 iterations over the same data (3 filter passes + 1 implicit).

**Fix:**
```tsx
const { defaultMembers, customMembers, archivedMembers } = useMemo(() => {
  const result = { defaultMembers: [], customMembers: [], archivedMembers: [] };
  for (const m of teamMembers) {
    if (m.status === 'archived') result.archivedMembers.push(m);
    else if (m.status === 'active' && m.isDefault) result.defaultMembers.push(m);
    else if (m.status === 'active') result.customMembers.push(m);
  }
  return result;
}, [teamMembers]);
```

Single pass + memoized.

### Step 6.2 — MultiProjectBoard single-pass stats

**File:** `maestro-ui/src/components/maestro/MultiProjectBoard.tsx`
**Lines:** ~148–192

**Current:** 5 separate `.filter()` calls for taskStats + 3 for sessionStats + 2 for project counts.

**Fix:**
```tsx
const { taskStats, sessionStats, taskCountByProject, sessionCountByProject } = useMemo(() => {
  const ts = { pending: 0, inProgress: 0, completed: 0, blocked: 0, total: 0 };
  const ss = { active: 0, completed: 0, total: 0 };
  const tcp = new Map<string, number>();
  const scp = new Map<string, number>();

  for (const t of effectiveTasks) {
    ts.total++;
    if (t.status === 'pending') ts.pending++;
    else if (t.status === 'in_progress') ts.inProgress++;
    else if (t.status === 'completed') ts.completed++;
    if (t.blockedBy?.length) ts.blocked++;
    tcp.set(t.projectId, (tcp.get(t.projectId) ?? 0) + 1);
  }

  for (const s of terminalSessions) {
    ss.total++;
    if (s.status === 'active') ss.active++;
    else if (s.status === 'completed') ss.completed++;
    scp.set(s.projectId, (scp.get(s.projectId) ?? 0) + 1);
  }

  return { taskStats: ts, sessionStats: ss, taskCountByProject: tcp, sessionCountByProject: scp };
}, [effectiveTasks, terminalSessions]);
```

Replaces 10 array iterations with 2.

---

## Phase 7: CSS will-change & Drag Optimization (P2)

### Step 7.1 — Add `will-change: transform` to sortable items

**Files:** CSS files for sortable item wrappers.

```css
/* Items being dragged or about to be dragged */
.sortableTaskItem,
.sortableSessionItem,
.sortableWrapper {
  will-change: transform;
}

/* Only during active drag to avoid GPU memory overhead at rest */
.sortableTaskItem[data-dragging="true"],
.sortableSessionItem[data-dragging="true"] {
  will-change: transform;
  z-index: 10;
}
```

**Better approach:** Only set `will-change` during active drag via dnd-kit's `isDragging` state, not permanently. Permanent `will-change` wastes GPU memory:

```tsx
// In SortableTaskItem:
const { isDragging, ... } = useSortable({ id });
<div style={{ willChange: isDragging ? 'transform' : 'auto' }}>
```

### Step 7.2 — SVG sprites for repeated icons (optional, P2)

**Files:** SessionsSection.tsx (lines 943–980), DocViewer.tsx, MermaidDiagram.tsx

**Current:** Inline `<svg>` elements duplicated per list item.

**Fix:**
1. Create `maestro-ui/src/components/icons/sprite.svg` with `<symbol>` elements.
2. Replace inline SVGs with `<svg><use href="#icon-name" /></svg>`.

**Impact:** Reduces DOM nodes per repeated icon from 5–10 to 2 (svg + use). With 50 sessions × 3 icons = 150 SVGs → 150 `<use>` refs to 3 symbols. Saves ~900 DOM nodes.

**Decision:** This is nice-to-have. Only do this if there's time after higher-priority items.

---

## Implementation Order & Checklist

| # | Phase | Step | Priority | Est. Effort |
|---|-------|------|----------|-------------|
| 1 | Phase 1 | Install @tanstack/react-virtual | P0 | 5 min |
| 2 | Phase 3.1 | Mermaid: init once | P0 | 20 min |
| 3 | Phase 3.2 | Mermaid: SVG cache | P0 | 20 min |
| 4 | Phase 3.3 | Mermaid: sanitize in effect | P0 | 10 min |
| 5 | Phase 4.1 | CSS contain:content on 5 containers | P0 | 15 min |
| 6 | Phase 2.1 | Virtualize history dropdown | P0 | 30 min |
| 7 | Phase 2.3 | Virtualize kanban columns | P0 | 45 min |
| 8 | Phase 2.2 | Virtualize SortableTaskList | P0 | 45 min |
| 9 | Phase 2.4 | Virtualize AggregatedTimeline | P0 | 30 min |
| 10 | Phase 4.2 | content-visibility:auto on items | P1 | 15 min |
| 11 | Phase 5 | Lazy-load Dashboard charts | P1 | 40 min |
| 12 | Phase 6.1 | TeamMemberList single-pass filter | P1 | 15 min |
| 13 | Phase 6.2 | MultiProjectBoard single-pass stats | P1 | 20 min |
| 14 | Phase 7.1 | will-change on drag items | P2 | 15 min |
| 15 | Phase 7.2 | SVG sprites (optional) | P2 | 45 min |

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `maestro-ui/package.json` | Add @tanstack/react-virtual |
| `maestro-ui/src/components/SessionsSection.tsx` | Virtualize history dropdown |
| `maestro-ui/src/components/maestro/SortableTaskList.tsx` | Virtualize root task list |
| `maestro-ui/src/components/maestro/MultiProjectBoard.tsx` | Virtualize kanban columns, consolidate stats |
| `maestro-ui/src/components/maestro/SessionTimeline.tsx` | Virtualize AggregatedTimeline |
| `maestro-ui/src/components/maestro/MermaidDiagram.tsx` | Cache renders, init once, sanitize in effect |
| `maestro-ui/src/components/maestro/Dashboard.tsx` | LazyVisible wrapper for charts |
| `maestro-ui/src/components/maestro/TeamMemberList.tsx` | Single-pass filter with useMemo |
| `maestro-ui/src/styles-sidebar-redesign.css` | contain:content on .sessionList |
| `maestro-ui/src/styles-terminal-theme.css` | contain:content on .terminalTaskList, content-visibility on items |
| `maestro-ui/src/styles-excalidraw.css` | contain:content on .taskBoardColumnBody |
| `maestro-ui/src/styles-maestro-sessions-v2.css` | contain:content on .sessionTimelineEvents |
| `maestro-ui/src/styles-docs-v2.css` | contain:content on .docsListGrid, content-visibility on cards |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| dnd-kit + virtualization conflicts (drag index miscalculation) | Keep `SortableContext items` as full list; only virtualize DOM rendering. Test drag reorder at list boundaries. |
| Dynamic row heights break virtualizer positioning | Use `measureElement` callback from @tanstack/react-virtual for dynamic sizing. Set reasonable `estimateSize` defaults. |
| `contain: content` breaks absolute/fixed positioned children | Audit each container for such children before applying. All current containers use overflow:hidden/auto, so risk is low. |
| `content-visibility: auto` causes scroll jumps | Set accurate `contain-intrinsic-size` values. Test in Chrome and Firefox. |
| MermaidDiagram cache grows unbounded | LRU eviction at 50 entries. Charts are typically unique per document. |
| LazyVisible causes layout shift when charts render | Set `minHeight` to match actual chart height. Use skeleton placeholder. |

---

## Testing Plan

1. **Virtualization:** Load 200+ sessions/tasks, verify smooth scrolling, verify dnd-kit drag reorder works across virtual boundaries
2. **MermaidDiagram:** Render doc with 5+ diagrams, verify no re-init on scroll, verify theme switch updates diagrams
3. **CSS containment:** Visual regression check — verify no clipping or overflow issues
4. **Dashboard:** Scroll dashboard with multiple charts, verify lazy loading triggers correctly
5. **Filter consolidation:** Compare stat counts before/after refactor — must be identical
