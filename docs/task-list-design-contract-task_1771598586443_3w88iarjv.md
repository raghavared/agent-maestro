# Task Lists v1 — Design Clarifications + Integration Contract

Last updated: 2026-02-20
Owner: worker session sess_1771598602980_1f80a6dop

## Scope (Coordinator Decisions)
- v1 supports **flat task lists only** (no nested lists-of-tasks).
- Dedicated **Task Lists page** with **modals** for create/edit.
- Drag-and-drop ordering with accessible fallback.
- Reuse existing Maestro UI components.

---

## Open Questions (Need Product/Design/Tech Decision)
1. **List Membership Cardinality**: Can a task appear in multiple lists within the same project? If yes, can it appear multiple times in the same list?
2. **Cross-Project References**: Should a task list be able to reference tasks from other projects?
3. **List Ordering Ownership**: Should ordering be stored per list (preferred) or reuse global task ordering per project?
4. **Deletion Semantics**: If a task is deleted, should it be removed from lists automatically (recommended), or should lists retain a tombstone entry?
5. **Missing Task Behavior**: If a list references a task that doesn’t exist (e.g., race condition), should the API return partial results with warnings, or fail?
6. **Task State Constraints**: Are archived/blocked/completed tasks allowed in lists? If not, should they be filtered or blocked at add-time?
7. **List Visibility**: Are task lists private to the creator or shared at project scope?
8. **Task Constraints**: Should lists enforce max size or limit number of lists per project?
9. **Reordering Semantics**: Should reordering be full replace (`orderedTaskIds`) or patch operations (`move`/`insert`)?
10. **Cascade Effects**: If a task changes `projectId` (if ever allowed), how should its list memberships update?

---

## Provisional Assumptions (Unblock Implementation)
- **Project-scoped lists**: each list belongs to exactly one project.
- **Task membership**: tasks can belong to **multiple lists**; no duplicates within a single list.
- **No cross-project references**: list tasks must share `projectId` with list.
- **Missing task handling**: API returns list with `missingTaskIds` so UI can show placeholders.
- **Deletion behavior**: deleting a task automatically removes it from all lists.
- **Ordering**: list stores `orderedTaskIds` array; server normalizes and dedupes.
- **v1 flat lists**: lists contain task IDs only; no list-of-lists, no nesting.

---

## Entity Model (Backend)
### New resource: `TaskList`
```ts
interface TaskList {
  id: string;              // list_*
  projectId: string;
  title: string;
  description?: string;
  orderedTaskIds: string[];  // ordered membership
  createdAt: number;
  updatedAt: number;
  createdBy?: string;        // optional user/session id
}
```

### Storage
- `~/.maestro/data/taskLists/{projectId}/{listId}.json`
- Keep **flat** ordering in list entity.

---

## API Contract (REST)
### List
`GET /api/task-lists?projectId={projectId}`

Response:
```json
[
  {
    "id": "list_1738715000000_abcd",
    "projectId": "proj_123",
    "title": "Today",
    "description": "Focus",
    "orderedTaskIds": ["task_a", "task_b"],
    "createdAt": 1738715000000,
    "updatedAt": 1738715200000
  }
]
```

### Get One
`GET /api/task-lists/:id`

Response:
```json
{
  "id": "list_1738715000000_abcd",
  "projectId": "proj_123",
  "title": "Today",
  "description": "Focus",
  "orderedTaskIds": ["task_a", "task_b"],
  "createdAt": 1738715000000,
  "updatedAt": 1738715200000
}
```

### Create
`POST /api/task-lists`

Request:
```json
{
  "projectId": "proj_123",
  "title": "Today",
  "description": "Focus",
  "orderedTaskIds": ["task_a", "task_b"]
}
```

Response: `201` TaskList

### Update (partial)
`PATCH /api/task-lists/:id`

Request:
```json
{
  "title": "This Week",
  "description": "",
  "orderedTaskIds": ["task_b", "task_a", "task_c"]
}
```

Response: TaskList

### Delete
`DELETE /api/task-lists/:id`

Response:
```json
{ "success": true, "id": "list_1738715000000_abcd" }
```

### Add/Remove Task (optional convenience)
`POST /api/task-lists/:id/tasks`

Request:
```json
{ "taskId": "task_123", "position": 0 }
```

Response: TaskList

`DELETE /api/task-lists/:id/tasks/:taskId`

Response: TaskList

---

## Validation & Constraints
- `projectId` required.
- `title` required (min 1, max 200).
- `orderedTaskIds` must be **unique**; server dedupes and filters invalid ids.
- All tasks must belong to same `projectId` (reject 400 if mismatched).
- Reordering uses full array replacement for simplicity.

---

## WebSocket Events
- `taskList:created` — payload: TaskList
- `taskList:updated` — payload: TaskList
- `taskList:deleted` — payload: `{ id, projectId }`

UI subscribes and updates list store accordingly.

---

## Frontend Integration (UI)
- Add `TaskLists` page and use existing components (panels, list item rows, modals).
- Drag-and-drop ordering with keyboard fallback:
  - Buttons: `Move up` / `Move down`.
  - Context menu for `Move to top/bottom`.
- Modals:
  - Create/Edit Task List
  - Add/Remove tasks (picker using existing task selector)

---

## Edge Cases to Handle
1. Cycles are **not applicable** (no list nesting in v1).
2. Duplicate task IDs in `orderedTaskIds` → server dedupe.
3. Missing tasks → `missingTaskIds` returned (optional); UI shows placeholder row.
4. Cross-project task refs → reject 400.
5. Deleting a task → remove from all lists.
6. Deleting a list → no effect on tasks.
7. Large lists → pagination not required in v1; consider in v2.
8. Concurrent reorder edits → last-write wins (etag optional later).

---

## Migration Strategy (Existing Data)
- v1: **no migration required** (new entity).
- Future: if task list ordering is added to existing task ordering store, write a one-time migration to copy `ordering` entries into `TaskList.orderedTaskIds` for a default list per project.

---

## Next Decisions Needed
- Confirm membership rules, cross-project policy, and deletion behavior.
- Confirm whether to implement convenience add/remove endpoints in v1.
- Decide if list ownership is per-project or per-user.
