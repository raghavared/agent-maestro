# Right Panel: Project-Wide Documents/Drawings Subtabs — Design

## 1. Current Right-Panel + View-Type Logic (Precise Map)

### App Layout (left → right)

```
[AppLeftPanel]  [Main Workspace]  [SpacesPanel (RIGHT)]
  icon rail +      terminal /        sessions rail /
  MaestroPanel     workspace         expanded panel
```

Source: `App.tsx:538–603`

- `AppLeftPanel` holds the **MaestroPanel** (Tasks / Team / Skills / Lists / Graphs tabs). This is the *left* panel.
- `SpacesPanel` is positioned at the **right** end of the layout (`App.tsx:584`), uses `rightPanelWidth` from `useUIStore`.

> **Important:** `AppRightPanel.tsx` is defined at `maestro-ui/src/components/AppRightPanel.tsx:12` but is **never imported or rendered** anywhere in the app. It is an orphaned component that references `activeRightPanel: 'none' | 'maestro' | 'files'` from `useUIStore.ts:148` — a store field that also has no live consumers. Both can be ignored (or cleaned up later).

---

### SpacesPanel (the actual right panel)

**File:** `maestro-ui/src/components/SpacesPanel.tsx:34`

Local state drives the content:

```ts
const [panelMode, setPanelMode] = useState<'sessions' | 'resources'>('sessions');
// SpacesPanel.tsx:55
```

The toolbar (`SpacesPanel.tsx:122–138`) renders two tab buttons:
- **Sessions** → `panelMode = 'sessions'` → renders `<SessionsSection>`
- **Resources** → `panelMode = 'resources'` → renders `<ResourcesView projectId={activeProjectId} />`

The panel can be collapsed to a narrow `SpacesRail` (icon strip) by toggling `spacesRailActiveSection` in `useUIStore.ts:297–303`.

---

### ResourcesView (today's Documents/Drawings area)

**File:** `maestro-ui/src/components/ResourcesView.tsx:52`

This is where Documents and Drawings are shown today.

**Data fetching:** On mount, fetches **all** project docs with no pagination:
```ts
maestroClient.getProjectDocs(projectId)
// ResourcesView.tsx:69 — calls GET /projects/:id/docs (no limit/offset)
// Returns a flat DocEntry[]
```

**Filtering (client-side):**
```ts
type ResourceType = "all" | "docs" | "diagrams" | "images";
// ResourcesView.tsx:8
// Applied client-side — ResourcesView.tsx:103–116
```

The "Docs" filter shows `kind === 'doc'` (i.e. `DocEntry.kind !== 'diagram'`).
The "Diagrams" filter shows `kind === 'diagram'`.
"Images" are task-level `TaskImage` objects from `useMaestroStore`.

**Opening items (`ResourcesView.tsx:118–136`):**
- Markdown doc → `openDocument(projectId, doc)` → creates a `DocumentSpace` in `useSpacesStore` → `setActiveId(id)` → center shows doc viewer
- Diagram → `createWhiteboard(projectId, doc.title, undefined, doc.id, doc.sessionId)` → creates a `WhiteboardSpace` → `setActiveId(id)` → center shows editable Excalidraw

---

### DocEntry shape

**File:** `maestro-ui/src/app/types/maestro.ts:274`

```ts
interface DocEntry {
  id: string;
  title: string;
  filePath: string;
  kind?: 'markdown' | 'diagram';   // undefined = markdown
  content?: string;
  taskId?: string;                  // set when added via `maestro task docs add`
  addedAt: number;
  addedBy?: string;                 // sessionId that added it
  sessionId?: string;               // session that owns this doc
  sessionName?: string;             // denormalized for display
}
```

---

### View Types (SpaceType) — what they ARE and what they DON'T drive

**File:** `maestro-ui/src/app/types/space.ts:3`

```ts
type SpaceType = "session" | "whiteboard" | "document" | "file";
```

These are types of **center-pane workspace tabs** (terminal session / Excalidraw board / doc viewer / code file). They are managed by `useSpacesStore` (`maestro-ui/src/stores/useSpacesStore.ts:67`) which holds the list of open Space objects.

**This does NOT drive ResourcesView content.** The Resources tab already ignores which Space is active — it always shows all project docs. The "different logic" the task description refers to is:

> Today, the SpacesPanel's primary navigation is session-centric (Sessions tab). The Resources tab is a secondary mode that breaks from this by showing project-wide data. The new Documents/Drawings subtabs extend this project-wide paradigm further — they are independent of the active space/session.

---

### Server: GET /projects/:id/docs

**File:** `maestro-server/src/api/projectRoutes.ts:95`

```ts
router.get('/projects/:id/docs',
  validateParams(idParamSchema),
  validateQuery(paginationQuerySchema),
  async (req, res) => {
    const docs = await sessionService.getProjectDocsWithContent(id);
    if (req.query.limit || req.query.offset) {
      res.json(paginate(docs, extractPagination(req.query)));
    } else {
      res.json(docs);   // flat array — no pagination envelope
    }
  }
);
```

**`paginationQuerySchema`** (`validation.ts:548`): accepts `limit` (1–500, coerced int) and `offset` (≥0, coerced int).

**`paginate()` response** (`validation.ts:575`):
```ts
{
  data: DocEntry[];
  pagination: { offset: number; limit: number; total: number; hasMore: boolean; }
}
```

`total` and `hasMore` are already returned — no server change needed for those.

**`getProjectDocsWithContent`** (`SessionService.ts:502`): iterates all sessions in the project, aggregates `session.docs[]` arrays, dedupes by `doc.id`, sorts by `addedAt`. Task docs (`maestro task docs add`) are stored in a session with `doc.taskId` set (`taskRoutes.ts:182`, `SessionService.ts:432`), so they appear here via session iteration.

**Current gap:** No `kind` query param — all docs (markdown + diagram) are returned together. Client must filter.

---

## 2. The Delta: What Changes

### Summary

Add **Documents** and **Drawings** as first-class tab modes in `SpacesPanel`, each backed by a paginated, scroll-for-more list. The existing **Resources** tab is retained unchanged (useful for mixed browsing + images).

### Changes to `SpacesPanel.tsx`

1. Expand `panelMode` type:
   ```ts
   type PanelMode = 'sessions' | 'resources' | 'documents' | 'drawings';
   ```

2. Add two tab buttons in the toolbar (after "Resources"):
   ```tsx
   <button className={`spacesPanelTab ${panelMode === 'documents' ? 'spacesPanelTab--active' : ''}`}
     onClick={() => setPanelMode('documents')}>
     Documents
   </button>
   <button className={`spacesPanelTab ${panelMode === 'drawings' ? 'spacesPanelTab--active' : ''}`}
     onClick={() => setPanelMode('drawings')}>
     Drawings
   </button>
   ```

3. Add conditional renders:
   ```tsx
   {panelMode === 'documents' && (
     <ProjectDocsTab kind="markdown" projectId={activeProjectId} />
   )}
   {panelMode === 'drawings' && (
     <ProjectDocsTab kind="diagram" projectId={activeProjectId} />
   )}
   ```

### New Component: `ProjectDocsTab`

`maestro-ui/src/components/ProjectDocsTab.tsx` (new file)

Props: `{ kind: 'markdown' | 'diagram'; projectId: string }`

Responsibilities:
- Uses `useProjectDocsPaginated(projectId, kind)` hook
- Renders a scrollable list of `DocEntry` items
- Appends a sentinel `<div>` at the bottom; `IntersectionObserver` on it triggers `loadMore()` when visible
- On item click: opens doc or whiteboard (same logic as `ResourcesView.handleOpen`)
- Shows task/session attribution as clickable chips under each title

### What Does NOT Change

| Component | Status |
|---|---|
| `ResourcesView` | Unchanged — "Resources" tab stays as-is |
| `SessionsSection` / `SpacesRail` | Unchanged |
| `useSpacesStore` | Unchanged — `openDocument` / `createWhiteboard` are reused |
| `SpaceType` in `space.ts` | Unchanged — still drives center-pane rendering |
| `AppRightPanel` | Unchanged (still orphaned — out of scope) |
| `MaestroPanel` (left panel) | Unchanged |
| `useUIStore.activeRightPanel` | Unchanged (unused anyway) |

---

## 3. Pagination / Infinite-Scroll Plan

### Server Change (Small — Required)

Add a `kind` filter to `GET /projects/:id/docs` so each tab only fetches its relevant type.

**`maestro-server/src/api/validation.ts`** — add new schema:
```ts
export const projectDocsQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  kind:   z.enum(['markdown', 'diagram']).optional(),
});
```

**`maestro-server/src/api/projectRoutes.ts:95`** — switch to new schema, apply filter:
```ts
router.get('/projects/:id/docs',
  validateParams(idParamSchema),
  validateQuery(projectDocsQuerySchema),   // <-- new schema
  async (req, res) => {
    const { kind } = req.query as { kind?: 'markdown' | 'diagram' };
    const docs = await sessionService.getProjectDocsWithContent(id);
    // Apply kind filter (treat missing kind as 'markdown')
    const filtered = kind
      ? docs.filter(d => (d.kind ?? 'markdown') === kind)
      : docs;
    if (req.query.limit || req.query.offset) {
      res.json(paginate(filtered, extractPagination(req.query)));
    } else {
      res.json(filtered);
    }
  }
);
```

No change to `SessionService.getProjectDocsWithContent` — post-filter in route handler is sufficient for typical project sizes. At very large scale (10k+ docs), move the filter into the service to avoid hydrating unneeded content.

**Confirmed server response shape for paginated calls:**
```json
{
  "data": [ /* DocEntry[] — PAGE_SIZE items */ ],
  "pagination": {
    "offset": 0,
    "limit": 50,
    "total": 127,
    "hasMore": true
  }
}
```
`total` is available — enables displaying "Showing N of M" and stopping the observer when `hasMore = false`.

### Client API (`MaestroClient.ts`)

Add alongside the existing `getProjectDocs`:
```ts
async getProjectDocsPaginated(
  projectId: string,
  kind: 'markdown' | 'diagram',
  limit: number,
  offset: number,
): Promise<{ data: DocEntry[]; pagination: { offset: number; limit: number; total: number; hasMore: boolean } }> {
  const params = new URLSearchParams({
    kind,
    limit: String(limit),
    offset: String(offset),
  });
  return this.fetch(`/projects/${projectId}/docs?${params}`);
}
```

### Client Hook: `useProjectDocsPaginated`

New file: `maestro-ui/src/hooks/useProjectDocsPaginated.ts`

```ts
const PAGE_SIZE = 50;

export function useProjectDocsPaginated(projectId: string, kind: 'markdown' | 'diagram') {
  const [items, setItems] = useState<DocEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const hasMore = total === null || offset < total;

  // Reset when projectId or kind changes
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setTotal(null);
  }, [projectId, kind]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await maestroClient.getProjectDocsPaginated(projectId, kind, PAGE_SIZE, offset);
      setItems(prev => [...prev, ...res.data]);
      setOffset(prev => prev + res.data.length);
      setTotal(res.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [projectId, kind, offset, loading, hasMore]);

  // Trigger initial load after reset (offset resets to 0 then this fires)
  const initialLoadDone = useRef(false);
  useEffect(() => {
    initialLoadDone.current = false;
  }, [projectId, kind]);
  useEffect(() => {
    if (!initialLoadDone.current && !loading) {
      initialLoadDone.current = true;
      loadMore();
    }
  });

  return { items, loading, hasMore, loadMore, total };
}
```

**Scroll-for-more in `ProjectDocsTab`:**
```tsx
const sentinelRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && hasMore && !loading) loadMore();
  }, { rootMargin: '200px' });
  if (sentinelRef.current) observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [hasMore, loading, loadMore]);

// In JSX, at bottom of list:
<div ref={sentinelRef} />
```

---

## 4. Navigation: Opening Items & Jumping to Task/Session

### Opening a Document
```ts
const id = openDocument(projectId, doc);   // useSpacesStore — creates/reuses DocumentSpace
setActiveId(id);                           // useSessionStore — activates it in center pane
```
`openDocument` deduplicates: if a `DocumentSpace` with the same `doc.id` already exists, returns its id.
Source: `useSpacesStore.ts:109–126`, `ResourcesView.tsx:133–135`

### Opening a Diagram
```ts
const id = createWhiteboard(projectId, doc.title, undefined, doc.id, doc.sessionId);
setActiveId(id);
```
Source: `useSpacesStore.ts:70–89`, `ResourcesView.tsx:124–130`

### Jumping to Task (Task Docs / Task Diagrams)
If `doc.taskId` is set, show a task attribution chip below the title. Clicking it:
```ts
useUIStore.getState().setTaskDetailOverlay({ taskId: doc.taskId, projectId });
```
This opens the `TaskDetailOverlay` (the existing task detail view) which shows all task docs and diagrams in context.
Source: `useUIStore.ts:184–185`, `MaestroPanel.tsx:566`

### Jumping to Session
If `doc.sessionId` is set and no `doc.taskId`, show a session attribution chip. Clicking it:
```ts
useSessionStore.getState().setActiveId(doc.sessionId);
```
(Or open `SessionDetailOverlay` if the session is completed/inspected.)

---

## 5. Phased Implementation Plan

### Phase 1 — Server tweak (est. ~30 min)
| File | Change |
|---|---|
| `maestro-server/src/api/validation.ts` | Add `projectDocsQuerySchema` with `kind` + `limit` + `offset` |
| `maestro-server/src/api/projectRoutes.ts:95` | Switch `validateQuery` to new schema; apply `kind` filter before `paginate()` |

### Phase 2 — Client API + Hook (est. ~30 min)
| File | Change |
|---|---|
| `maestro-ui/src/utils/MaestroClient.ts` | Add `getProjectDocsPaginated(projectId, kind, limit, offset)` method |
| `maestro-ui/src/hooks/useProjectDocsPaginated.ts` | New file — pagination + reset hook |

### Phase 3 — UI (est. ~1.5–2 hours)
| File | Change |
|---|---|
| `maestro-ui/src/components/ProjectDocsTab.tsx` | New file — paginated list with IntersectionObserver sentinel, item open/navigation handlers |
| `maestro-ui/src/components/SpacesPanel.tsx` | Add `'documents' \| 'drawings'` to panelMode; add two tab buttons (~lines 123–138); render `ProjectDocsTab` for each |

### Phase 4 — Tests (est. ~30 min)
| File | Change |
|---|---|
| `maestro-ui/src/__tests__/ProjectDocsTab.test.tsx` | New — mock paginated API, test load-more, test open/navigate actions |
| `maestro-server/test/projectRoutes.test.*` | Add test for `?kind=markdown` and `?kind=diagram` filtering |

**Total estimated implementation time: 3–4 hours**

---

## 6. Open Questions

1. **Tab label polish**: "Documents" and "Drawings" are clear, but should they show a count badge? The count (`pagination.total`) becomes available after the first fetch fires — suggest showing it only after the initial load (avoids a flash of no-count).

2. **ResourcesView retention**: Keep or remove? Recommendation: **keep it** — the "All" view with images is useful for mixed browsing and covers `TaskImage` objects that the new tabs don't.

3. **"Jump to task" UX**: Two options:
   - Inline attribution chip under each title (always visible, one click)
   - Hover-reveal info row with task/session links (cleaner list, more discoverable on hover)
   Recommendation: inline chip, matching `ResourcesView.tsx:223–231` pattern.

4. **Content hydration at scale**: `getProjectDocsWithContent` reads file content for every doc before filtering. For projects with hundreds of docs this is tolerable; at thousands it becomes a bottleneck. A future `fields=metadata` param could skip content hydration for list views where content isn't needed.

5. **Kind inference**: `DocEntry.kind` can be `undefined` (legacy docs before kind was added). Convention in `ResourcesView.tsx:86–88` is that `undefined` → treated as `'doc'` (markdown). The server filter should apply `(d.kind ?? 'markdown') === kind` to match this convention.

6. **Orphaned session docs**: A `DocEntry` may reference a `sessionId` for a session that has since been deleted. The doc itself persists. The list should still show these — just omit the "session" navigation link if the session is gone (check `useSessionStore.sessions` to confirm existence).
