# Implementation Plan

## Overview

Phased implementation approach for the Worker Strategy System, designed for incremental delivery with working features at each phase.

## Phase 0: Foundation (1-2 days)

### Goals
- Define types and interfaces
- Set up storage schema
- Create base data structure classes

### Tasks

#### 0.1 Type Definitions
```
Location: maestro-server/src/types/worker.ts
          maestro-cli/src/types/worker.ts
          maestro-ui/src/app/types/worker.ts
```

```typescript
// Types to define
export type WorkerType = 'queue' | 'stack' | 'priority' | 'dag' | 'round_robin';
export type ItemStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'skipped' | 'blocked';

export interface WorkerTypeDefinition { ... }
export interface SessionDataStructure { ... }
export interface DataStructureItem { ... }
export interface WorkerConfig { ... }
```

#### 0.2 Worker Type Registry
```
Location: maestro-server/src/worker-types/registry.ts
```
- Define all worker types with their configurations
- Include system prompts, allowed commands, descriptions

#### 0.3 Storage Schema
```
Location: ~/.maestro/data/projects/{projectId}/session-data-structures/
File: {sessionId}-ds.json
```

#### 0.4 Base Data Structure Classes
```
Location: maestro-server/src/services/data-structures/
Files: base.ts, queue.ts, stack.ts
```

### Deliverables
- [ ] Type definitions synced across all packages
- [ ] Worker type registry with queue/stack definitions
- [ ] Storage schema documented
- [ ] Base data structure class with common operations

---

## Phase 1: Queue Worker (3-4 days)

### Goals
- Implement full queue worker flow
- End-to-end working prototype

### Tasks

#### 1.1 Server: Queue Data Structure Service
```
Location: maestro-server/src/services/data-structures/queue.ts
```

Operations:
- `initialize(sessionId, tasks[])`
- `enqueue(item)`
- `dequeue()`
- `peek()`
- `getCurrent()`
- `start()`
- `complete(message?)`
- `fail(reason?, retry?)`
- `skip(reason?)`

#### 1.2 Server: Data Structure Routes
```
Location: maestro-server/src/routes/sessions-ds.ts
```

Endpoints:
- `GET /api/sessions/:id/ds`
- `POST /api/sessions/:id/ds/initialize`
- `GET /api/sessions/:id/ds/queue`
- `GET /api/sessions/:id/ds/queue/front`
- `POST /api/sessions/:id/ds/queue/enqueue`
- `POST /api/sessions/:id/ds/queue/start`
- `POST /api/sessions/:id/ds/queue/complete`
- `POST /api/sessions/:id/ds/queue/fail`
- `POST /api/sessions/:id/ds/queue/skip`

#### 1.3 Server: WebSocket Events
```
Location: maestro-server/src/events/ds-events.ts
```

Events:
- `ds:initialized`
- `ds:item_added`
- `ds:item_removed`
- `ds:item_status_changed`
- `ds:current_item_changed`

#### 1.4 CLI: Queue Commands
```
Location: maestro-cli/src/commands/queue/
Files: index.ts, top.ts, start.ts, complete.ts, fail.ts, skip.ts, list.ts, add.ts
```

#### 1.5 CLI: Worker Commands
```
Location: maestro-cli/src/commands/worker/
Files: init.ts, who-am-i.ts
```

#### 1.6 CLI: Update Manifest Generation
```
Location: maestro-cli/src/commands/manifest/generate.ts
```
- Add `workerType` to manifest
- Include worker-specific system prompt

#### 1.7 Integration Test
- Create session with queue worker
- Initialize with tasks
- Process tasks via CLI
- Verify status updates

### Deliverables
- [ ] Queue data structure service
- [ ] Queue API endpoints
- [ ] WebSocket events for queue
- [ ] `maestro queue *` commands
- [ ] `maestro worker init` command
- [ ] `maestro who-am-i` command
- [ ] Integration test passing

---

## Phase 2: Stack Worker (2 days)

### Goals
- Extend with stack worker
- Prove extensibility of architecture

### Tasks

#### 2.1 Server: Stack Data Structure Service
```
Location: maestro-server/src/services/data-structures/stack.ts
```

Operations:
- `push(item)` - Add to top
- `pop()` - Remove from top
- `peek()` - View top
- `start()`, `complete()`, `fail()` - Same pattern as queue

#### 2.2 Server: Stack Routes
```
Location: maestro-server/src/routes/sessions-ds.ts (extend)
```

Endpoints:
- `GET /api/sessions/:id/ds/stack`
- `GET /api/sessions/:id/ds/stack/top`
- `POST /api/sessions/:id/ds/stack/push`
- `POST /api/sessions/:id/ds/stack/start`
- `POST /api/sessions/:id/ds/stack/complete`
- `POST /api/sessions/:id/ds/stack/fail`

#### 2.3 CLI: Stack Commands
```
Location: maestro-cli/src/commands/stack/
Files: index.ts, top.ts, start.ts, complete.ts, fail.ts, push.ts, list.ts
```

#### 2.4 Update Worker Registry
- Add stack worker type definition
- Add stack system prompt

### Deliverables
- [ ] Stack data structure service
- [ ] Stack API endpoints
- [ ] `maestro stack *` commands
- [ ] Stack worker type in registry

---

## Phase 3: UI Integration (3-4 days)

### Goals
- Session creation with worker type
- Data structure visualization
- Real-time updates

### Tasks

#### 3.1 Worker Type Selector Component
```
Location: maestro-ui/src/components/maestro/WorkerTypeSelector.tsx
```

#### 3.2 Update Session Creation
```
Location: maestro-ui/src/components/maestro/CreateSessionModal.tsx (extend)
```
- Add worker type selection
- Add task ordering for queue/stack

#### 3.3 Data Structure View Components
```
Location: maestro-ui/src/components/maestro/data-structures/
Files: DataStructureView.tsx, QueueView.tsx, StackView.tsx
```

#### 3.4 Data Structure Hook
```
Location: maestro-ui/src/hooks/useDataStructure.ts
```
- Fetch data structure state
- Subscribe to WebSocket events
- Real-time updates

#### 3.5 Update Session Panel
```
Location: maestro-ui/src/components/maestro/SessionPanel.tsx (extend)
```
- Show worker type badge
- Include data structure view

#### 3.6 Store Updates
```
Location: maestro-ui/src/stores/useMaestroStore.ts (extend)
```
- Add data structure state
- Handle DS WebSocket events

### Deliverables
- [ ] Worker type selector
- [ ] Updated session creation modal
- [ ] Queue/Stack visualizations
- [ ] Real-time WebSocket updates
- [ ] Session panel with DS view

---

## Phase 4: Dynamic Task Injection (2 days)

### Goals
- Add tasks to running sessions
- UI and CLI support

### Tasks

#### 4.1 Add Task to Session Button
```
Location: maestro-ui/src/components/maestro/AddTaskToSessionButton.tsx
```

#### 4.2 Add Task Modal
```
Location: maestro-ui/src/components/maestro/AddTaskToSessionModal.tsx
```

#### 4.3 CLI: Session Add Task Command
```
Location: maestro-cli/src/commands/session/add-task.ts
```

```bash
maestro session add-task <sessionId> <taskId> [--position front|back|<n>]
```

#### 4.4 Test Dynamic Injection
- Add task while session is processing
- Verify task appears in queue
- Verify worker picks it up

### Deliverables
- [ ] UI button and modal for adding tasks
- [ ] CLI command for adding tasks
- [ ] Dynamic injection working end-to-end

---

## Phase 5: Priority Queue Worker (2-3 days)

### Goals
- Priority-based task processing
- Priority management UI

### Tasks

#### 5.1 Server: Priority Queue Service
```
Location: maestro-server/src/services/data-structures/priority.ts
```

Operations:
- `insert(item, priority)`
- `extractMax()`
- `peekMax()`
- `updatePriority(taskId, priority)`

#### 5.2 Server: Priority Queue Routes

#### 5.3 CLI: Priority Commands
```
Location: maestro-cli/src/commands/priority/
```

#### 5.4 UI: Priority Queue View
```
Location: maestro-ui/src/components/maestro/data-structures/PriorityQueueView.tsx
```
- Show tasks sorted by priority
- Priority indicators (stars, colors)

#### 5.5 UI: Task Priority Assigner
```
Location: maestro-ui/src/components/maestro/TaskPriorityAssigner.tsx
```
- Assign priorities when creating session
- Update priorities for existing items

### Deliverables
- [ ] Priority queue service
- [ ] Priority API endpoints
- [ ] `maestro priority *` commands
- [ ] Priority queue visualization
- [ ] Priority assignment UI

---

## Phase 6: DAG Worker (3-4 days)

### Goals
- Dependency-aware task processing
- DAG visualization

### Tasks

#### 6.1 Server: DAG Service
```
Location: maestro-server/src/services/data-structures/dag.ts
```

Operations:
- `addNode(item, dependencies[])`
- `addEdge(from, to)`
- `getReady()` - Tasks with all deps satisfied
- `complete(taskId)` - Unlock dependents
- `fail(taskId, skipDependents?)`
- `toAscii()` - ASCII visualization

#### 6.2 Server: DAG Routes

#### 6.3 CLI: DAG Commands
```
Location: maestro-cli/src/commands/dag/
```

#### 6.4 UI: DAG View
```
Location: maestro-ui/src/components/maestro/data-structures/DAGView.tsx
```
- Interactive graph (react-flow or similar)
- Node coloring by status
- Edge visualization

#### 6.5 UI: Dependency Editor
```
Location: maestro-ui/src/components/maestro/DependencyEditor.tsx
```
- Visual dependency editing when creating session

### Deliverables
- [ ] DAG service with topological operations
- [ ] DAG API endpoints
- [ ] `maestro dag *` commands
- [ ] Interactive DAG visualization
- [ ] Dependency editor

---

## Phase 7: Polish & Documentation (2 days)

### Goals
- Error handling
- Documentation
- Testing

### Tasks

#### 7.1 Error Handling
- Graceful handling of invalid operations
- Clear error messages
- Recovery strategies

#### 7.2 Worker Type Documentation
```
Location: maestro-cli/docs/worker-types.md
          maestro-ui/docs/worker-types.md
```

#### 7.3 E2E Tests
- Full workflow tests for each worker type
- Edge cases (empty queue, failed tasks, etc.)

#### 7.4 Performance Testing
- Large queues/DAGs
- Many concurrent sessions

### Deliverables
- [ ] Comprehensive error handling
- [ ] User documentation
- [ ] E2E test suite
- [ ] Performance benchmarks

---

## Timeline Summary

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| 0 | Foundation | 1-2 days | None |
| 1 | Queue Worker | 3-4 days | Phase 0 |
| 2 | Stack Worker | 2 days | Phase 1 |
| 3 | UI Integration | 3-4 days | Phase 2 |
| 4 | Dynamic Injection | 2 days | Phase 3 |
| 5 | Priority Queue | 2-3 days | Phase 4 |
| 6 | DAG Worker | 3-4 days | Phase 5 |
| 7 | Polish | 2 days | Phase 6 |

**Total: ~18-23 days**

## Milestones

1. **M1 (End of Phase 1):** Basic queue worker working end-to-end via CLI
2. **M2 (End of Phase 3):** Queue and stack workers with UI
3. **M3 (End of Phase 4):** Dynamic task injection working
4. **M4 (End of Phase 6):** All worker types implemented
5. **M5 (End of Phase 7):** Production-ready release

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Complex DAG implementation | Start simple, iterate |
| WebSocket event handling | Reuse existing patterns |
| UI complexity | Component-based approach |
| Integration issues | Test early and often |

## Success Criteria

1. All worker types process tasks correctly
2. Real-time UI updates work reliably
3. Dynamic task injection works mid-session
4. Status flows are predictable and correct
5. Performance acceptable for 100+ tasks per session
