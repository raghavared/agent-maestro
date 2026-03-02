# Hierarchical Task Model

This document describes the hierarchical task model used across all Maestro components. Tasks can have parent-child relationships, enabling subtask decomposition without a separate "subtask" entity.

## Core Concept

All hierarchy is determined by a single field:

```typescript
interface MaestroTask {
  id: string;
  projectId: string;
  parentId: string | null;  // KEY: null = root task, string = child task
  title: string;
  // ... other fields
}
```

- **Root tasks**: `parentId === null`
- **Child tasks**: `parentId === "<parent-task-id>"`
- **No separate subtask type** - just tasks with parent references

---

## Type Definitions

### Server (`maestro-server/src/types.ts`)

```typescript
export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  sessionIds: string[];
  timeline: TimelineEvent[];
}

export interface CreateTaskPayload {
  projectId: string;
  parentId?: string;        // Optional: creates child task if provided
  title: string;
  description?: string;
  priority?: TaskPriority;
}
```

### UI (`maestro-ui/src/app/types/maestro.ts`)

```typescript
export interface MaestroTask {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  // ... same fields as server
}

// Extended type for tree display
export type TaskTreeNode = MaestroTask & {
  children: TaskTreeNode[];
};
```

---

## Server API

### Create Child Task

```http
POST /api/tasks
Content-Type: application/json

{
  "projectId": "proj_123",
  "parentId": "task_456",    // Makes this a child of task_456
  "title": "Child task title",
  "description": "Optional description"
}
```

**Response:** Returns created task with `parentId` set.

**Validation:** Server verifies parent task exists before creating child.

### Get Direct Children

```http
GET /api/tasks/:taskId/children
```

**Response:** Array of tasks where `parentId === taskId`

```json
[
  { "id": "task_child1", "parentId": "task_456", "title": "First child", ... },
  { "id": "task_child2", "parentId": "task_456", "title": "Second child", ... }
]
```

### Filter by Parent

```http
GET /api/tasks?projectId=proj_123&parentId=task_456
```

Returns tasks matching the parent filter.

```http
GET /api/tasks?projectId=proj_123&parentId=null
```

Returns only root tasks (no parent).

---

## CLI Commands

### Create Child Task

```bash
maestro task create "Child task title" --parent <parentTaskId>
```

Creates a task with `parentId` set to the specified parent.

### List Children

```bash
# Direct children only
maestro task children <taskId>

# All descendants (recursive)
maestro task children <taskId> --recursive
```

### View Task Tree

```bash
# Full project tree
maestro task tree

# From specific root
maestro task tree --root <taskId>

# Limit depth
maestro task tree --depth 2

# Filter by status
maestro task tree --status in_progress
```

**Output format:**
```
├─ [task_1] 🔄 Build Authentication
│  ├─ [task_2] ✅ Setup Database
│  └─ [task_3] ⏳ Add Login Routes
└─ [task_4] 🚫 Deploy to Production
```

---

## UI Hooks

### useTaskTree

Builds a tree structure from a flat array of tasks.

**File:** `maestro-ui/src/hooks/useTaskTree.ts`

```typescript
export function useTaskTree(tasks: MaestroTask[]): {
  roots: TaskTreeNode[];
  getChildren: (taskId: string) => TaskTreeNode[];
}
```

**Algorithm:**
1. Group all tasks by `parentId` into a `Map<parentId, Task[]>`
2. Find root tasks (`parentId === null`)
3. Recursively attach children to each node
4. Return roots with nested `children` arrays

**Usage:**
```typescript
const { roots, getChildren } = useTaskTree(tasks);

// roots = TaskTreeNode[] with nested children
// getChildren(taskId) returns direct children
```

### useTaskBreadcrumb

Returns ancestry chain from root to specified task.

**File:** `maestro-ui/src/hooks/useTaskBreadcrumb.ts`

```typescript
export function useTaskBreadcrumb(taskId: string | null): MaestroTask[]
```

**Algorithm:**
1. Start at given task
2. Walk UP by following `parentId` references
3. Build array: `[root, ..., grandparent, parent, task]`

**Usage:**
```typescript
const breadcrumb = useTaskBreadcrumb(selectedTaskId);
// [RootTask, ParentTask, SelectedTask]

// Render breadcrumb navigation
{breadcrumb.map(t => <span key={t.id}>{t.title} › </span>)}
```

### useSubtaskProgress

Calculates completion progress of direct children.

**File:** `maestro-ui/src/hooks/useSubtaskProgress.ts`

```typescript
export function useSubtaskProgress(taskId: string | null): {
  completed: number;
  total: number;
  percentage: number;
}
```

**Algorithm:**
1. Filter tasks where `parentId === taskId`
2. Count total children
3. Count children with `status === 'completed'`
4. Calculate percentage

**Usage:**
```typescript
const progress = useSubtaskProgress(task.id);
// { completed: 3, total: 5, percentage: 60 }

<ProgressBar value={progress.percentage} />
<span>{progress.completed}/{progress.total} complete</span>
```

---

## Data Flow

### Creating a Child Task

```
User clicks "Add Subtask" in UI
         │
         ▼
CreateTaskModal opens with parentId context
         │
         ▼
POST /api/tasks { parentId: "task_parent", title: "..." }
         │
         ▼
Server validates parent exists
         │
         ▼
Server creates task with parentId set
         │
         ▼
Server emits task:created WebSocket event
         │
         ▼
UI receives event, adds to store
         │
         ▼
useTaskTree automatically rebuilds tree
         │
         ▼
UI re-renders with new child visible
```

### Navigating Hierarchy

```
User clicks child task in tree
         │
         ▼
TaskDetailModal opens
         │
         ▼
useTaskBreadcrumb(taskId) walks UP ancestry
         │
         ▼
Modal displays: Root › Parent › Selected
         │
         ▼
useSubtaskProgress shows child completion %
         │
         ▼
User clicks breadcrumb item
         │
         ▼
onNavigateToTask(parentId) jumps to parent
```

---

## Storage

Tasks are stored as flat JSON files. Hierarchy is reconstructed at query time.

```
~/.maestro/data/tasks/{projectId}/
├── task_1738713700000_abc.json    # Root task (parentId: null)
├── task_1738713800000_def.json    # Child (parentId: "task_1738713700000_abc")
└── task_1738713900000_ghi.json    # Grandchild (parentId: "task_1738713800000_def")
```

Each file contains the full task object:
```json
{
  "id": "task_1738713800000_def",
  "projectId": "proj_123",
  "parentId": "task_1738713700000_abc",
  "title": "Setup authentication",
  "status": "in_progress",
  ...
}
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single `parentId` field | Simple, no join tables needed |
| No separate subtask type | Reduces complexity, same CRUD for all |
| Flat storage | Easy to query, hierarchy rebuilt on read |
| No cycle detection | Trusted clients, simple implementation |
| Client-side tree building | Server stays stateless, hooks are memoized |
| Recursive CLI fetching | No server-side tree endpoint needed |

---

## Integration Points

### UI ↔ Server

| UI Action | API Call |
|-----------|----------|
| Add subtask | `POST /api/tasks` with `parentId` |
| View children | `GET /api/tasks/:id/children` |
| Filter roots | `GET /api/tasks?parentId=null` |

### CLI ↔ Server

| CLI Command | API Call |
|-------------|----------|
| `task create --parent <id>` | `POST /api/tasks` with `parentId` |
| `task children <id>` | `GET /api/tasks/:id/children` |
| `task tree` | Multiple `GET` calls, client-side assembly |

### WebSocket Events

No special events for hierarchy. Standard task events apply:
- `task:created` - includes `parentId` in payload
- `task:updated` - includes `parentId` in payload
- `task:deleted` - UI removes from tree

---

## Example: Full Tree Lifecycle

```bash
# 1. Create root task
maestro task create "Build User Auth" --priority high
# → task_auth_root

# 2. Create child tasks
maestro task create "Setup JWT library" --parent task_auth_root
# → task_jwt

maestro task create "Add login endpoint" --parent task_auth_root
# → task_login

maestro task create "Add logout endpoint" --parent task_auth_root
# → task_logout

# 3. View tree
maestro task tree

# Output:
# └─ [task_auth_root] 🔄 Build User Auth
#    ├─ [task_jwt] ⏳ Setup JWT library
#    ├─ [task_login] ⏳ Add login endpoint
#    └─ [task_logout] ⏳ Add logout endpoint

# 4. Complete a child
maestro task update task_jwt --status completed

# 5. Check progress in UI
# useSubtaskProgress(task_auth_root) → { completed: 1, total: 3, percentage: 33 }
```

---

## Constraints

1. **Max depth**: Not enforced (recommend keeping shallow for UX)
2. **Cycles**: Not validated (don't create `A → B → A`)
3. **Orphans**: Deleting parent doesn't cascade to children (children become roots)
4. **Cross-project**: Children must have same `projectId` as parent
