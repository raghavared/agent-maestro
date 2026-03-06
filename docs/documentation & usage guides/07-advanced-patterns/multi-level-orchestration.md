# Multi-Level Orchestration

**Maestro supports coordinators spawning other coordinators — creating hierarchical orchestration for very large projects with distinct workstreams.**

---

## The Four Modes

Maestro has four agent modes that form a hierarchy:

| Mode | Has Parent? | Can Spawn? | Description |
|------|------------|------------|-------------|
| `worker` | No | No | Standalone executor |
| `coordinator` | No | Yes | Standalone orchestrator, spawns workers |
| `coordinated-worker` | Yes | No | Worker spawned by a coordinator |
| `coordinated-coordinator` | Yes | No* | Coordinator spawned by another coordinator |

*Coordinated-coordinators **cannot** spawn new sessions. They coordinate only with existing team members assigned to them.

## Session Hierarchy

Every session tracks its lineage:

```typescript
interface Session {
  parentSessionId?: string;     // Direct parent (who spawned me)
  rootSessionId?: string;       // Top-level ancestor
  teamSessionId?: string;       // Shared team identifier
}
```

### How Hierarchy Forms

```
Top-Level Coordinator (coordinator)
├── parentSessionId: null
├── rootSessionId: null
│
├── spawns → Sub-Coordinator A (coordinated-coordinator)
│   ├── parentSessionId: top-coordinator-id
│   ├── rootSessionId: top-coordinator-id
│   │
│   ├── manages → Worker A1 (coordinated-worker)
│   │   ├── parentSessionId: sub-coordinator-a-id
│   │   └── rootSessionId: top-coordinator-id
│   │
│   └── manages → Worker A2 (coordinated-worker)
│       ├── parentSessionId: sub-coordinator-a-id
│       └── rootSessionId: top-coordinator-id
│
└── spawns → Sub-Coordinator B (coordinated-coordinator)
    ├── parentSessionId: top-coordinator-id
    ├── rootSessionId: top-coordinator-id
    │
    └── manages → Worker B1 (coordinated-worker)
        ├── parentSessionId: sub-coordinator-b-id
        └── rootSessionId: top-coordinator-id
```

The `rootSessionId` always points to the top-level coordinator, regardless of depth. This enables tracking the full chain.

## Mode Auto-Derivation

You don't manually set `coordinated-worker` or `coordinated-coordinator`. Modes are derived automatically:

- `worker` spawned by a coordinator → becomes `coordinated-worker`
- `coordinator` spawned by a coordinator → becomes `coordinated-coordinator`

This happens during the spawn process:

```
normalizeMode('worker', hasCoordinator=true)     → 'coordinated-worker'
normalizeMode('coordinator', hasCoordinator=true) → 'coordinated-coordinator'
```

## Coordinated-Coordinator Behavior

A coordinated-coordinator is a coordinator that was spawned by another coordinator. It:

- **Receives directives** from its parent coordinator via `initialDirective`
- **Reports progress** back to its parent using `maestro session report progress`
- **Coordinates existing team members** assigned to it
- **Cannot spawn new sessions** — this is enforced at the server level

This restriction prevents unbounded recursive spawning. The top-level coordinator is the only one that spawns sessions.

### How It Works in Practice

1. Top-level coordinator analyzes the project
2. Decomposes into workstreams (frontend, backend, infrastructure)
3. Spawns a sub-coordinator for each workstream
4. Each sub-coordinator receives workers pre-assigned to it
5. Sub-coordinators manage their workers, report back to the top-level coordinator

## Setting Up Multi-Level Orchestration

### Step 1: Create Team Members

```bash
# Sub-coordinators
maestro team-member create "Frontend Lead" \
  --role "Frontend Coordinator" \
  --mode coordinator \
  --identity "You coordinate frontend development. Break down UI work, assign to team members, verify visual quality and accessibility."

maestro team-member create "Backend Lead" \
  --role "Backend Coordinator" \
  --mode coordinator \
  --identity "You coordinate backend development. Design APIs, assign implementation work, ensure tests pass."

# Workers
maestro team-member create "React Dev" --role "React Developer" --mode worker
maestro team-member create "CSS Specialist" --role "CSS/Design Engineer" --mode worker
maestro team-member create "API Dev" --role "API Developer" --mode worker
maestro team-member create "DB Engineer" --role "Database Engineer" --mode worker
```

### Step 2: Create Teams

```bash
# Frontend team
maestro team create "Frontend Team" \
  --leader <frontend-lead-id> \
  --members <frontend-lead-id>,<react-dev-id>,<css-specialist-id>

# Backend team
maestro team create "Backend Team" \
  --leader <backend-lead-id> \
  --members <backend-lead-id>,<api-dev-id>,<db-engineer-id>
```

### Step 3: Create Task Hierarchy

```bash
# Root task
maestro task create "Build e-commerce checkout" \
  --desc "Full checkout flow with cart, payment, and confirmation" \
  --priority high

# Workstream tasks
maestro task create "Frontend checkout UI" \
  --parent <root-task-id> \
  --desc "Cart page, payment form, confirmation page"

maestro task create "Backend checkout API" \
  --parent <root-task-id> \
  --desc "Cart endpoints, payment processing, order creation"
```

### Step 4: Launch Top-Level Coordinator

```bash
maestro session spawn \
  --task <root-task-id> \
  --mode coordinator
```

The top-level coordinator reads the task, sees the subtasks, and spawns sub-coordinators for each workstream. Each sub-coordinator manages its assigned workers.

## Communication Across Levels

### Parent → Child

Coordinators send directives to their children via `session prompt`:

```bash
maestro session prompt <child-session-id> --message "Prioritize the payment form — it's blocking the backend team."
```

### Child → Parent

Children report back using session reporting:

```bash
maestro session report progress "Frontend checkout UI 70% complete. Cart page done, payment form in progress."
maestro session report complete "All frontend components implemented and tested."
maestro session report blocked "Waiting for payment API endpoint from backend team."
```

### Sibling Discovery

Children can discover their siblings:

```bash
maestro session siblings
```

This returns all sessions sharing the same parent coordinator, enabling horizontal coordination.

### Cross-Team Communication

Any session can prompt any other session by ID:

```bash
maestro session prompt <sibling-session-id> --message "The cart component is ready for integration."
```

## When to Use Multi-Level Orchestration

Multi-level orchestration adds complexity. Use it only when the benefits outweigh the overhead.

**Good fit:**

| Scenario | Why |
|----------|-----|
| Large project with 3+ distinct workstreams | Each workstream needs its own coordination logic |
| Different teams with different specializations | Frontend team works differently than backend team |
| Task hierarchy deeper than 2 levels | Sub-coordinators can manage sub-sub-tasks |
| Projects where workstreams have internal dependencies | Sub-coordinators handle intra-team ordering |

**Not needed:**

| Scenario | Better approach |
|----------|----------------|
| Small project with < 5 tasks | Single coordinator or direct worker execution |
| All tasks are independent | Use `coordinate-batching` with a single coordinator |
| Linear dependency chain | Use `execute-tree` with a single worker |

## Monitoring Multi-Level Sessions

### Watch All Sessions

```bash
maestro session list --status working
```

### Watch Specific Branch

```bash
# Watch a sub-coordinator and all its workers
maestro session watch <sub-coordinator-id>
```

### View Session Hierarchy

```bash
# See the full tree from root
maestro session info <root-session-id>
```

### Check Logs

```bash
# Tail logs from specific sessions
maestro session logs <session-id> --follow
```

## Limitations

- **Max depth: 2 levels.** The top-level coordinator spawns sub-coordinators, which manage workers. Coordinated-coordinators cannot spawn further sessions.
- **Session count.** More levels = more sessions = more resource usage. Plan your hierarchy to minimize unnecessary coordination layers.
- **Communication overhead.** Multi-level reporting takes more time. Use it when the work is genuinely complex enough to warrant it.
