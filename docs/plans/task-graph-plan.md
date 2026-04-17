# Task Graph Feature — Brainstorm & Implementation Plan

## 1. What I Understood

You want a **Task Graph** feature — a visual, interactive graph UI where:

1. **Users create tasks as nodes** on a canvas
2. **Users draw edges** between tasks to define execution dependencies
3. **Each node can have a team member** (agent persona) configured
4. A **"Run" button** triggers a coordinator that executes the entire graph end-to-end
5. The coordinator **respects the dependency topology** — runs tasks in parallel when independent, sequentially when dependent
6. This is conceptually like an **Augmented Transition Network (ATN)** but using Maestro's task/session primitives

---

## 2. Current State Analysis

### What Already Exists (building blocks)

| Component | Status | Notes |
|-----------|--------|-------|
| `Task.dependencies: string[]` | **Exists but UNUSED** | Field on Task entity, not in validation schemas, not in CLI, not enforced |
| `TaskList` entity | Exists | Ordered task collections — conceptual predecessor |
| Coordinator mode | Exists | 4-mode model, spawns workers, but has NO structured execution plan |
| Parent-child tasks | Exists | `parentId` hierarchy — tree, not graph |
| `@dnd-kit` | Installed | Drag-and-drop in UI |
| Mermaid / Excalidraw | Installed | Diagram rendering — but not interactive graph editing |
| React Flow | **NOT installed** | We'll need this for the graph canvas |
| TaskSessionStatuses | Exists | Per-session status on each task — perfect for tracking graph execution |
| WebSocket real-time | Exists | Live status updates as graph executes |

### What's Missing

1. **No graph entity** — nowhere to store a named, reusable task dependency graph
2. **No graph visualization** — no interactive node-link editor
3. **No structured execution engine** — coordinators currently decide execution order via AI (unstructured)
4. **No dependency validation** — no DAG cycle detection
5. **No dependency-aware scheduling** — server doesn't know which tasks are "ready" based on completed predecessors
6. **`dependencies` field is dead** — not in Zod schemas, not settable via API/CLI

---

## 3. Proposed Data Model

### Option A: TaskGraph as a Lightweight View (Recommended)

The graph topology lives **on the tasks themselves** (via `dependencies[]`), and `TaskGraph` is a lightweight entity that stores:
- Which tasks are in the graph
- Canvas layout positions
- Per-node execution config (team member overrides)
- Execution state

```typescript
// New entity — maestro-server/src/types.ts
export interface TaskGraph {
  id: string;
  projectId: string;
  name: string;
  description?: string;

  // Graph nodes — each references an existing Task
  nodes: TaskGraphNode[];

  // Graph edges — dependency relationships
  // These are the SOURCE OF TRUTH for this graph's topology.
  // They also get synced to Task.dependencies when the graph is saved.
  edges: TaskGraphEdge[];

  // Coordinator config
  coordinatorTeamMemberId?: string;  // Who runs the graph
  coordinatorModel?: string;
  
  // Execution state
  status: TaskGraphStatus;
  executionSessionId?: string;       // Coordinator session running this graph
  lastRunAt?: number;
  
  createdAt: number;
  updatedAt: number;
}

export type TaskGraphStatus = 
  | 'draft'      // Being edited
  | 'ready'      // Validated, can be run
  | 'running'    // Coordinator is executing
  | 'completed'  // All nodes completed
  | 'failed'     // A node failed and graph halted
  | 'paused';    // Execution paused (future)

export interface TaskGraphNode {
  taskId: string;                          // Reference to existing Task
  position: { x: number; y: number };      // Canvas position for React Flow
  teamMemberId?: string;                   // Override team member for this node
  memberOverrides?: MemberLaunchOverride;  // Override model/agent/permissions
}

export interface TaskGraphEdge {
  id: string;
  sourceTaskId: string;  // Upstream task (must complete first)
  targetTaskId: string;  // Downstream task (waits for source)
  label?: string;        // Optional edge label
}
```

### Why This Over Storing Edges on Tasks

| Approach | Pros | Cons |
|----------|------|------|
| **Edges on TaskGraph** (chosen) | Same task can be in multiple graphs with different edges; graph is self-contained; clean separation | Slight duplication if you also want Task.dependencies |
| **Edges on Task.dependencies** | Single source of truth; no new entity for edges | Task can only have one set of dependencies; mixing graph concerns into task entity |

**Decision**: Store edges on TaskGraph. Optionally sync to `Task.dependencies` when graph is saved (for CLI/API consumers who don't use the graph UI).

### Option B: Extend TaskList (NOT Recommended)

We could extend TaskList with edges and layout, but TaskList is fundamentally a flat ordered list. Grafting graph semantics onto it would be awkward and confusing.

---

## 4. Architecture — Layer by Layer

### 4.1 Server Domain Layer

**New files:**
```
maestro-server/src/domain/repositories/ITaskGraphRepository.ts
```

```typescript
export interface ITaskGraphRepository {
  create(graph: CreateTaskGraphPayload): Promise<TaskGraph>;
  findById(id: string): Promise<TaskGraph | null>;
  findByProjectId(projectId: string): Promise<TaskGraph[]>;
  update(id: string, updates: UpdateTaskGraphPayload): Promise<TaskGraph>;
  delete(id: string): Promise<void>;
}
```

### 4.2 Server Application Layer

**New file:**
```
maestro-server/src/application/services/TaskGraphService.ts
```

Key methods:
```typescript
class TaskGraphService {
  // CRUD
  createGraph(input: CreateTaskGraphPayload): Promise<TaskGraph>
  getGraph(id: string): Promise<TaskGraph>
  listGraphs(projectId: string): Promise<TaskGraph[]>
  updateGraph(id: string, updates: UpdateTaskGraphPayload): Promise<TaskGraph>
  deleteGraph(id: string): Promise<void>
  
  // Validation
  validateGraph(id: string): Promise<ValidationResult>  // DAG check, task existence, team member validity
  
  // Execution
  runGraph(id: string, options?: RunOptions): Promise<{ sessionId: string }>
  getGraphExecutionStatus(id: string): Promise<GraphExecutionStatus>
  pauseGraph(id: string): Promise<void>   // Future
  cancelGraph(id: string): Promise<void>
  
  // Topology helpers
  getReadyNodes(graph: TaskGraph, completedTaskIds: string[]): TaskGraphNode[]
  getTopologicalOrder(graph: TaskGraph): string[]  // For display
  detectCycles(edges: TaskGraphEdge[]): string[][] | null  // Returns cycles if any
}
```

**DAG Validation** (cycle detection):
```typescript
// Kahn's algorithm for topological sort — returns null if cycle exists
function topologicalSort(nodes: string[], edges: { source: string; target: string }[]): string[] | null {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  
  nodes.forEach(n => { inDegree.set(n, 0); adjacency.set(n, []); });
  edges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    adjacency.get(e.source)?.push(e.target);
  });
  
  const queue = nodes.filter(n => inDegree.get(n) === 0);
  const sorted: string[] = [];
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighbor of adjacency.get(node) || []) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }
  
  return sorted.length === nodes.length ? sorted : null; // null = cycle
}
```

### 4.3 Server Infrastructure Layer

**New file:**
```
maestro-server/src/infrastructure/repositories/FileSystemTaskGraphRepository.ts
```

Storage: `~/.maestro/data/task-graphs/{projectId}/{graphId}.json`

Following the same patterns as FileSystemTaskListRepository.

### 4.4 Server API Layer

**New file:**
```
maestro-server/src/api/taskGraphRoutes.ts
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/task-graphs?projectId=X` | List graphs for project |
| `POST` | `/api/task-graphs` | Create new graph |
| `GET` | `/api/task-graphs/:id` | Get graph by ID |
| `PATCH` | `/api/task-graphs/:id` | Update graph (nodes, edges, config) |
| `DELETE` | `/api/task-graphs/:id` | Delete graph |
| `POST` | `/api/task-graphs/:id/validate` | Validate graph (DAG check) |
| `POST` | `/api/task-graphs/:id/run` | Execute graph → spawns coordinator |
| `GET` | `/api/task-graphs/:id/status` | Get execution status per node |
| `POST` | `/api/task-graphs/:id/cancel` | Cancel running graph |

**Zod Schemas:**
```typescript
const taskGraphNodeSchema = z.object({
  taskId: safeId,
  position: z.object({ x: z.number(), y: z.number() }),
  teamMemberId: safeId.optional(),
  memberOverrides: memberLaunchOverrideSchema.optional(),
});

const taskGraphEdgeSchema = z.object({
  id: z.string().max(100),
  sourceTaskId: safeId,
  targetTaskId: safeId,
  label: z.string().max(200).optional(),
});

const createTaskGraphSchema = z.object({
  projectId: safeId,
  name: shortString,
  description: longString.optional(),
  nodes: z.array(taskGraphNodeSchema).default([]),
  edges: z.array(taskGraphEdgeSchema).default([]),
  coordinatorTeamMemberId: safeId.optional(),
  coordinatorModel: z.string().optional(),
});

const updateTaskGraphSchema = z.object({
  name: shortString.optional(),
  description: longString.optional(),
  nodes: z.array(taskGraphNodeSchema).optional(),
  edges: z.array(taskGraphEdgeSchema).optional(),
  coordinatorTeamMemberId: safeId.optional(),
  coordinatorModel: z.string().optional(),
  status: z.enum(['draft', 'ready']).optional(),
});
```

### 4.5 WebSocket Events

```typescript
// New events
'task_graph:created'    → { graph: TaskGraph }
'task_graph:updated'    → { graph: TaskGraph }
'task_graph:deleted'    → { graphId: string }
'task_graph:running'    → { graphId: string, sessionId: string }
'task_graph:node_started'   → { graphId: string, taskId: string, sessionId: string }
'task_graph:node_completed' → { graphId: string, taskId: string }
'task_graph:node_failed'    → { graphId: string, taskId: string, error: string }
'task_graph:completed'  → { graphId: string }
'task_graph:failed'     → { graphId: string, failedTaskId: string }
```

### 4.6 CLI Commands

**New command group:**
```
maestro task-graph list                    # List graphs for current project
maestro task-graph get <id>                # Get graph details
maestro task-graph create <name>           # Create empty graph
maestro task-graph add-node <graphId> <taskId>    # Add task to graph
maestro task-graph add-edge <graphId> <sourceTaskId> <targetTaskId>  # Add dependency
maestro task-graph remove-node <graphId> <taskId>
maestro task-graph remove-edge <graphId> <edgeId>
maestro task-graph validate <graphId>      # Check for cycles
maestro task-graph run <graphId>           # Execute the graph
maestro task-graph status <graphId>        # Check execution status
maestro task-graph cancel <graphId>        # Cancel execution
```

### 4.7 Manifest Changes

When running a task graph, the coordinator's manifest needs graph context:

```typescript
// Addition to MaestroManifest
interface MaestroManifest {
  // ... existing fields ...
  
  // NEW: Task graph context (only present when executing a graph)
  taskGraph?: {
    graphId: string;
    graphName: string;
    nodes: Array<{
      taskId: string;
      taskTitle: string;
      taskDescription: string;
      teamMemberId?: string;
      teamMemberName?: string;
      inDegree: number;       // Number of upstream dependencies
      upstreamTaskIds: string[];
      downstreamTaskIds: string[];
    }>;
    edges: Array<{
      sourceTaskId: string;
      targetTaskId: string;
      label?: string;
    }>;
    topologicalOrder: string[];  // Pre-computed execution order
    parallelGroups: string[][];  // Groups of tasks that can run in parallel
  };
}
```

The coordinator prompt would include structured instructions:
```
You are executing a Task Graph named "{graphName}".

## Execution Plan (Topological Order)
Layer 0 (no dependencies — start immediately):
  - Task A: "Set up database schema" → assigned to Backend Engineer
  - Task B: "Design API contracts" → assigned to Backend Engineer

Layer 1 (depends on Layer 0):
  - Task C: "Implement REST endpoints" → depends on [A, B] → assigned to Backend Engineer

Layer 2 (depends on Layer 1):
  - Task D: "Write integration tests" → depends on [C] → assigned to Backend Engineer
  - Task E: "Build UI components" → depends on [C] → assigned to React Engineer

## Rules
1. Spawn workers for all tasks in a layer simultaneously (parallel execution)
2. Wait for ALL dependencies of a task to complete before spawning it
3. If a task fails, do NOT spawn any of its downstream tasks
4. Report graph-level status after each layer completes
```

---

## 5. UI Design — Task Graph Canvas

### 5.1 New Dependencies

```bash
# React Flow — interactive node-link graph editor
bun add @xyflow/react

# Layout algorithms
bun add dagre    # or elkjs for more sophisticated layouts
```

### 5.2 Component Structure

```
maestro-ui/src/components/maestro/task-graph/
├── TaskGraphPanel.tsx          # Main panel (list of graphs + selected graph view)
├── TaskGraphCanvas.tsx         # React Flow canvas wrapper
├── TaskGraphNode.tsx           # Custom node component (shows task info)
├── TaskGraphEdge.tsx           # Custom edge component (with delete button)
├── TaskGraphToolbar.tsx        # Top bar: name, auto-layout, validate, run
├── TaskGraphNodePalette.tsx    # Side panel: drag tasks onto canvas
├── TaskGraphNodeConfig.tsx     # Node config popover (team member, model)
├── TaskGraphStatusOverlay.tsx  # Execution status overlay on nodes
├── TaskGraphMinimap.tsx        # React Flow minimap
└── useTaskGraph.ts             # Hook: graph state, CRUD, WebSocket updates
```

### 5.3 User Interaction Flow

```
┌─────────────────────────────────────────────────────────┐
│  Task Graph: "Feature X Pipeline"          [⚙] [▶ Run] │
├──────────┬──────────────────────────────────────────────┤
│ Tasks    │                                              │
│ ───────  │    ┌──────────┐     ┌──────────┐            │
│ □ Task A │    │  Task A  │────▶│  Task C  │──┐         │
│ □ Task B │    │ 🏗️ BE    │     │ 🏗️ BE    │  │         │
│ □ Task C │    └──────────┘     └──────────┘  │         │
│ □ Task D │                                    ▼         │
│ □ Task E │    ┌──────────┐     ┌──────────┐            │
│          │    │  Task B  │────▶│  Task D  │            │
│ [+ New]  │    │ ⚛️ React │     │ 🏗️ BE    │            │
│          │    └──────────┘     └──────────┘            │
│          │                                              │
│          │    ┌──────────┐                              │
│          │    │  Task E  │  (no deps, runs immediately) │
│          │    │ 🎨 CSS   │                              │
│          │    └──────────┘                              │
├──────────┴──────────────────────────────────────────────┤
│ Status: Draft │ Nodes: 5 │ Edges: 3 │ Valid DAG ✓      │
└─────────────────────────────────────────────────────────┘
```

### 5.4 Custom Node Component

```tsx
// TaskGraphNode.tsx
function TaskGraphNode({ data }: NodeProps<TaskGraphNodeData>) {
  const { task, teamMember, executionStatus } = data;
  
  return (
    <div className={cn(
      "task-graph-node rounded-lg border-2 p-3 min-w-[180px]",
      executionStatus === 'completed' && "border-green-500 bg-green-500/10",
      executionStatus === 'working'   && "border-blue-500 bg-blue-500/10 animate-pulse",
      executionStatus === 'failed'    && "border-red-500 bg-red-500/10",
      executionStatus === 'blocked'   && "border-yellow-500 bg-yellow-500/10",
      !executionStatus               && "border-neutral-600 bg-neutral-800",
    )}>
      {/* Handles for edge connections */}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      
      <div className="flex items-center gap-2">
        <span className="text-lg">{teamMember?.avatar || '📋'}</span>
        <div>
          <div className="font-medium text-sm truncate">{task.title}</div>
          <div className="text-xs text-muted">{teamMember?.name || 'Unassigned'}</div>
        </div>
      </div>
      
      {executionStatus && (
        <div className="mt-2 text-xs">
          <StatusBadge status={executionStatus} />
        </div>
      )}
    </div>
  );
}
```

### 5.5 Interaction Patterns

1. **Add nodes**: Drag task from left palette onto canvas, or right-click canvas → "Add Task"
2. **Create edges**: Drag from source handle to target handle (React Flow built-in)
3. **Configure nodes**: Click node → popover with team member picker, model selector
4. **Auto-layout**: Button that runs dagre/elk layout algorithm
5. **Validate**: Button that checks DAG validity, highlights cycles in red
6. **Run**: Button that POST /task-graphs/:id/run → shows live execution status on nodes
7. **Delete edges**: Click edge → delete button appears on edge midpoint
8. **Create task inline**: "+" button on palette creates a new task AND adds it as a node

---

## 6. Execution Engine Design

### 6.1 Graph Execution Flow

```
User clicks [▶ Run]
    │
    ▼
POST /api/task-graphs/:id/run
    │
    ├── Validate: DAG check, all tasks exist, team members valid
    ├── Set graph.status = 'running'
    ├── Compute topological layers (parallel groups)
    │
    ▼
Spawn coordinator session
    │
    ├── Manifest includes full graph context
    ├── Mode: 'coordinator'
    ├── Identity: graph.coordinatorTeamMemberId
    │
    ▼
Coordinator reads graph from manifest
    │
    ├── Identify Layer 0 tasks (no dependencies)
    ├── Spawn workers for all Layer 0 tasks in parallel
    │
    ▼
Workers execute tasks
    │
    ├── Worker completes → task report complete
    ├── Coordinator detects completion via polling/events
    │
    ▼
Coordinator checks: any newly unblocked tasks?
    │
    ├── Yes → spawn workers for newly ready tasks
    ├── No + all done → report graph complete
    ├── No + still running → wait
    ├── Failure → halt downstream, report graph failed
    │
    ▼
Graph execution complete
    ├── graph.status = 'completed' | 'failed'
    ├── Emit task_graph:completed / task_graph:failed
    └── UI updates all nodes to final status
```

### 6.2 Server-Side Execution Tracking

The server can track graph execution without relying solely on the coordinator:

```typescript
// In TaskGraphService
async trackExecution(graphId: string): void {
  const graph = await this.getGraph(graphId);
  if (!graph.executionSessionId) return;
  
  // Get status of each task in the graph
  const nodeStatuses: Record<string, TaskGraphNodeStatus> = {};
  
  for (const node of graph.nodes) {
    const task = await this.taskService.getTask(node.taskId);
    const sessionStatus = graph.executionSessionId 
      ? task.taskSessionStatuses?.[graph.executionSessionId]
      : undefined;
    
    nodeStatuses[node.taskId] = {
      taskStatus: task.status,
      sessionStatus,
      isReady: this.isNodeReady(node, graph, nodeStatuses),
    };
  }
  
  // Check if graph is complete
  const allCompleted = graph.nodes.every(n => 
    nodeStatuses[n.taskId].taskStatus === 'completed'
  );
  
  if (allCompleted) {
    await this.updateGraph(graphId, { status: 'completed' });
  }
}
```

### 6.3 Failure Handling Strategies

| Strategy | Behavior | When to Use |
|----------|----------|-------------|
| **Halt downstream** (default) | If node fails, don't execute any dependent nodes | Critical path tasks |
| **Skip downstream** | Mark dependent nodes as 'skipped', continue independent branches | Non-critical branches |
| **Retry** | Re-run failed node up to N times | Flaky tasks |
| **Manual intervention** | Pause graph, notify user, wait for resume | High-stakes tasks |

---

## 7. Zustand Store

```typescript
// maestro-ui/src/stores/useTaskGraphStore.ts
interface TaskGraphState {
  graphs: Record<string, TaskGraph>;
  selectedGraphId: string | null;
  graphOrdering: Record<string, string[]>;  // projectId → ordered graph IDs
  
  // CRUD
  fetchGraphs: (projectId: string) => Promise<void>;
  fetchGraph: (graphId: string) => Promise<void>;
  createGraph: (data: CreateTaskGraphPayload) => Promise<TaskGraph>;
  updateGraph: (graphId: string, updates: UpdateTaskGraphPayload) => Promise<TaskGraph>;
  deleteGraph: (graphId: string) => Promise<void>;
  
  // Graph editing
  addNode: (graphId: string, taskId: string, position: { x: number; y: number }) => void;
  removeNode: (graphId: string, taskId: string) => void;
  addEdge: (graphId: string, sourceTaskId: string, targetTaskId: string) => void;
  removeEdge: (graphId: string, edgeId: string) => void;
  updateNodePosition: (graphId: string, taskId: string, position: { x: number; y: number }) => void;
  updateNodeConfig: (graphId: string, taskId: string, config: Partial<TaskGraphNode>) => void;
  
  // Execution
  runGraph: (graphId: string) => Promise<{ sessionId: string }>;
  cancelGraph: (graphId: string) => Promise<void>;
  
  // Validation
  validateGraph: (graphId: string) => Promise<ValidationResult>;
  
  // Selection
  selectGraph: (graphId: string | null) => void;
}
```

---

## 8. Integration with Existing Systems

### 8.1 MaestroPanel Integration

Add a new primary tab to MaestroPanel:
```
[Tasks] [Sessions] [Skills] [Teams] [Graphs]  ← NEW TAB
```

Or make it a separate panel accessible from the icon bar.

### 8.2 Task Creation Integration

When creating a task from the graph palette:
- Open CreateTaskModal in compact mode
- On save, automatically add the new task as a node at the drop position

### 8.3 Session Integration

When a graph is running:
- Sessions spawned by the coordinator should have `metadata.taskGraphId`
- The session list can filter/group by graph execution
- Clicking a running node in the graph jumps to its session terminal

### 8.4 WebSocket Integration

Subscribe to existing events + new graph events:
```typescript
// In WebSocket handler
socket.on('task:updated', (task) => {
  // Check if this task is in any running graph
  // Update node execution status accordingly
});

socket.on('task_graph:node_started', ({ graphId, taskId, sessionId }) => {
  // Animate the node, show session link
});
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Server + Data Model)
**Effort: ~2-3 days**

1. Add `TaskGraph`, `TaskGraphNode`, `TaskGraphEdge` types to `types.ts`
2. Create `ITaskGraphRepository` interface
3. Create `FileSystemTaskGraphRepository`
4. Create `TaskGraphService` with CRUD + validation (DAG check)
5. Create `taskGraphRoutes.ts` with CRUD endpoints
6. Add Zod validation schemas
7. Wire into DI container
8. Add WebSocket events for graph CRUD
9. Write tests

### Phase 2: UI — Graph Canvas
**Effort: ~3-4 days**

1. Install `@xyflow/react` and `dagre`
2. Create `TaskGraphPanel` with graph list
3. Create `TaskGraphCanvas` with React Flow
4. Create custom `TaskGraphNode` component
5. Implement drag-from-palette to add nodes
6. Implement edge drawing between nodes
7. Implement auto-layout with dagre
8. Create `TaskGraphToolbar` (name, validate, save, run)
9. Add to MaestroPanel as new tab or icon bar entry
10. Add `useTaskGraphStore` Zustand store

### Phase 3: Execution Engine
**Effort: ~2-3 days**

1. Add `POST /task-graphs/:id/run` endpoint
2. Implement `runGraph()` in TaskGraphService
3. Modify manifest generation to include graph context
4. Create coordinator prompt template for graph execution
5. Add execution status tracking (per-node status)
6. Add `GET /task-graphs/:id/status` endpoint
7. Add cancel/halt endpoints
8. Implement real-time execution status on canvas nodes (WebSocket)

### Phase 4: CLI Commands
**Effort: ~1-2 days**

1. Add `maestro task-graph` command group
2. Implement list, get, create, run, status, cancel subcommands
3. Add node/edge management subcommands
4. Add graph context to coordinator prompts in CLI

### Phase 5: Polish & Advanced Features
**Effort: ~2-3 days**

1. Node config popover (team member, model, permissions per node)
2. Graph templates (save graph structure without task data for reuse)
3. Execution history (list of past runs with status)
4. Minimap and zoom controls
5. Graph export/import
6. Parallel execution visualization (animated edges during run)
7. Failure handling strategies (halt/skip/retry)
8. "Create task inline" from graph canvas

---

## 10. Key Design Decisions to Make

### Q1: Where do edges live?
**Recommendation**: On `TaskGraph.edges[]` (not on `Task.dependencies[]`)
- Allows same task to participate in multiple graphs with different topologies
- Cleaner separation — graph is self-contained
- Optionally sync to Task.dependencies for CLI/API consumers

### Q2: New entity or extend TaskList?
**Recommendation**: New `TaskGraph` entity
- TaskList is a flat ordered collection — wrong abstraction for a DAG
- Clean domain model > reusing an ill-fitting entity

### Q3: Server-driven or coordinator-driven execution?
**Recommendation**: Hybrid
- **Server** validates DAG, computes topological order, and tracks execution status
- **Coordinator** receives pre-computed execution plan in manifest and executes it
- Server monitors task completion events and updates graph status
- This gives us structured execution (vs. current "coordinator decides everything")

### Q4: React Flow or build custom?
**Recommendation**: React Flow (@xyflow/react)
- Battle-tested, 25k+ GitHub stars
- Built-in: handles, edge drawing, zoom/pan, minimap, layout hooks
- Custom nodes/edges are just React components
- Fits perfectly with our Zustand + Tailwind stack

### Q5: How to handle graph execution when coordinator is an AI?
**Recommendation**: Make the coordinator prompt VERY structured
- Pre-compute parallel execution layers in the manifest
- Give explicit instructions: "spawn these workers NOW, wait for completion, then spawn next layer"
- Include taskId→teamMemberId mapping so coordinator doesn't need to figure out assignment
- The coordinator's job is to EXECUTE the plan, not CREATE it (the graph IS the plan)

---

## 11. Summary

The Task Graph feature adds a **visual, interactive DAG editor** to Maestro where users design execution workflows by connecting tasks with dependency edges. A coordinator then executes the graph layer-by-layer, spawning workers in parallel where the topology allows.

**Key insight**: Today, coordinators receive an unstructured bag of tasks and use AI to decide execution order. Task Graph gives the USER control over the execution topology, and the coordinator becomes a **structured executor** rather than a planner. This is a major upgrade in reliability and predictability.

**What changes:**
- New `TaskGraph` entity (server, DB, API, WebSocket)
- New React Flow-based graph canvas (UI)
- New graph-aware coordinator manifest/prompt (CLI)
- New CLI commands for graph management
- ~10-15 days of total effort across all layers
