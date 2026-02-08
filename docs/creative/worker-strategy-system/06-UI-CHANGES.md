# UI Changes

## Overview

UI updates needed to support the Worker Strategy System:

1. Session creation with worker type selection
2. Data structure visualization
3. Dynamic task injection
4. Worker status indicators
5. Real-time updates

## Component Changes

### 1. Session Creation Modal

**Current:** Session spawns with static task list
**New:** Worker type selection + data structure configuration

```tsx
// src/components/maestro/CreateSessionModal.tsx

interface CreateSessionModalProps {
  taskIds: string[];
  onClose: () => void;
  onSubmit: (config: SessionConfig) => void;
}

function CreateSessionModal({ taskIds, onClose, onSubmit }: CreateSessionModalProps) {
  const [workerType, setWorkerType] = useState<WorkerType>('queue');
  const [config, setConfig] = useState<WorkerConfig>({});

  return (
    <Modal onClose={onClose}>
      <h2>Create Session</h2>

      {/* Worker Type Selection */}
      <section>
        <label>Worker Type</label>
        <WorkerTypeSelector
          value={workerType}
          onChange={setWorkerType}
        />
        <p className="hint">{WORKER_TYPE_DESCRIPTIONS[workerType]}</p>
      </section>

      {/* Task Order (for Queue/Stack) */}
      {['queue', 'stack'].includes(workerType) && (
        <section>
          <label>Task Order</label>
          <DraggableTaskList
            tasks={taskIds}
            onReorder={setTaskOrder}
          />
        </section>
      )}

      {/* Priority Assignment (for Priority Queue) */}
      {workerType === 'priority' && (
        <section>
          <label>Task Priorities</label>
          <TaskPriorityAssigner
            tasks={taskIds}
            onChange={setPriorities}
          />
        </section>
      )}

      {/* Dependency Configuration (for DAG) */}
      {workerType === 'dag' && (
        <section>
          <label>Task Dependencies</label>
          <DependencyEditor
            tasks={taskIds}
            onChange={setDependencies}
          />
          <DAGPreview dependencies={dependencies} />
        </section>
      )}

      <div className="actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button primary onClick={() => onSubmit({ workerType, ...config })}>
          Create Session
        </Button>
      </div>
    </Modal>
  );
}
```

### 2. Worker Type Selector

```tsx
// src/components/maestro/WorkerTypeSelector.tsx

const WORKER_TYPES = [
  {
    id: 'queue',
    name: 'Queue',
    icon: '📋',
    description: 'Process tasks in order (FIFO)',
    useCase: 'Sequential workflows'
  },
  {
    id: 'stack',
    name: 'Stack',
    icon: '📚',
    description: 'Depth-first processing (LIFO)',
    useCase: 'Tasks with subtasks'
  },
  {
    id: 'priority',
    name: 'Priority',
    icon: '⭐',
    description: 'Process by priority',
    useCase: 'Mixed urgency tasks'
  },
  {
    id: 'dag',
    name: 'DAG',
    icon: '🔀',
    description: 'Respect dependencies',
    useCase: 'Complex workflows'
  }
];

function WorkerTypeSelector({ value, onChange }) {
  return (
    <div className="worker-type-selector">
      {WORKER_TYPES.map(type => (
        <button
          key={type.id}
          className={`worker-type-option ${value === type.id ? 'selected' : ''}`}
          onClick={() => onChange(type.id)}
        >
          <span className="icon">{type.icon}</span>
          <span className="name">{type.name}</span>
          <span className="description">{type.description}</span>
        </button>
      ))}
    </div>
  );
}
```

### 3. Data Structure Visualization

```tsx
// src/components/maestro/DataStructureView.tsx

interface DataStructureViewProps {
  sessionId: string;
}

function DataStructureView({ sessionId }: DataStructureViewProps) {
  const { dataStructure, isLoading } = useDataStructure(sessionId);

  if (isLoading) return <Spinner />;

  switch (dataStructure.type) {
    case 'queue':
      return <QueueView data={dataStructure} sessionId={sessionId} />;
    case 'stack':
      return <StackView data={dataStructure} sessionId={sessionId} />;
    case 'priority':
      return <PriorityQueueView data={dataStructure} sessionId={sessionId} />;
    case 'dag':
      return <DAGView data={dataStructure} sessionId={sessionId} />;
    default:
      return null;
  }
}
```

### 4. Queue Visualization

```tsx
// src/components/maestro/QueueView.tsx

function QueueView({ data, sessionId }) {
  const { items, currentItem, stats } = data;

  return (
    <div className="queue-view">
      {/* Stats Bar */}
      <div className="stats-bar">
        <span>{stats.queued} queued</span>
        <span>{stats.processing} processing</span>
        <span>{stats.completed} done</span>
      </div>

      {/* Queue Items */}
      <div className="queue-items">
        {items.map((item, index) => (
          <QueueItem
            key={item.taskId}
            item={item}
            position={index + 1}
            isCurrent={currentItem?.taskId === item.taskId}
          />
        ))}
      </div>

      {/* Add Task Button */}
      <AddTaskToSessionButton sessionId={sessionId} />
    </div>
  );
}

function QueueItem({ item, position, isCurrent }) {
  return (
    <div className={`queue-item ${isCurrent ? 'current' : ''} ${item.status}`}>
      <span className="position">{position}</span>
      <span className="status-icon">{STATUS_ICONS[item.status]}</span>
      <span className="title">{item.task.title}</span>
      <span className="status">{item.status}</span>
    </div>
  );
}
```

### 5. DAG Visualization

```tsx
// src/components/maestro/DAGView.tsx

function DAGView({ data, sessionId }) {
  const { nodes, edges, stats } = data;
  const [layout, setLayout] = useState<'auto' | 'vertical' | 'horizontal'>('auto');

  return (
    <div className="dag-view">
      {/* Stats */}
      <div className="dag-stats">
        <StatChip label="Ready" value={stats.ready} color="green" />
        <StatChip label="Processing" value={stats.processing} color="blue" />
        <StatChip label="Blocked" value={stats.blocked} color="orange" />
        <StatChip label="Done" value={stats.completed} color="gray" />
      </div>

      {/* Graph Visualization */}
      <DAGGraph
        nodes={nodes}
        edges={edges}
        layout={layout}
        onNodeClick={handleNodeClick}
      />

      {/* Layout Toggle */}
      <div className="layout-toggle">
        <button onClick={() => setLayout('auto')}>Auto</button>
        <button onClick={() => setLayout('vertical')}>Vertical</button>
        <button onClick={() => setLayout('horizontal')}>Horizontal</button>
      </div>
    </div>
  );
}

// Using a graph library like react-flow or dagre
function DAGGraph({ nodes, edges, layout, onNodeClick }) {
  return (
    <ReactFlow
      nodes={nodes.map(n => ({
        id: n.taskId,
        data: { label: n.task.title, status: n.status },
        style: getNodeStyle(n.status)
      }))}
      edges={edges.map(e => ({
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to
      }))}
      onNodeClick={onNodeClick}
    />
  );
}
```

### 6. Session Panel Updates

```tsx
// src/components/maestro/SessionPanel.tsx (updated)

function SessionPanel({ session }) {
  return (
    <div className="session-panel">
      {/* Header with Worker Type */}
      <header>
        <h3>{session.name}</h3>
        <WorkerTypeBadge type={session.workerType} />
        <SessionStatusBadge status={session.status} />
      </header>

      {/* Data Structure View */}
      <DataStructureView sessionId={session.id} />

      {/* Terminal (existing) */}
      <TerminalView sessionId={session.id} />

      {/* Controls */}
      <SessionControls session={session} />
    </div>
  );
}

function WorkerTypeBadge({ type }) {
  const info = WORKER_TYPES.find(w => w.id === type);
  return (
    <span className={`worker-badge ${type}`}>
      {info?.icon} {info?.name}
    </span>
  );
}
```

### 7. Add Task to Session

Allow users to add tasks to running sessions:

```tsx
// src/components/maestro/AddTaskToSessionButton.tsx

function AddTaskToSessionButton({ sessionId }) {
  const [isOpen, setIsOpen] = useState(false);
  const { session } = useSession(sessionId);
  const { tasks } = useTasks();
  const { addTaskToSession } = useSessionActions();

  // Filter out tasks already in this session
  const availableTasks = tasks.filter(
    t => !session.dataStructure?.items.some(i => i.taskId === t.id)
  );

  const handleAdd = async (taskId: string, options?: AddOptions) => {
    await addTaskToSession(sessionId, taskId, options);
    setIsOpen(false);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        + Add Task to {session.workerType}
      </Button>

      {isOpen && (
        <AddTaskModal
          workerType={session.workerType}
          availableTasks={availableTasks}
          onAdd={handleAdd}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

function AddTaskModal({ workerType, availableTasks, onAdd, onClose }) {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [priority, setPriority] = useState(3);
  const [dependencies, setDependencies] = useState<string[]>([]);

  return (
    <Modal onClose={onClose}>
      <h3>Add Task to Session</h3>

      <TaskSelector
        tasks={availableTasks}
        selected={selectedTask}
        onSelect={setSelectedTask}
      />

      {workerType === 'priority' && (
        <PriorityInput value={priority} onChange={setPriority} />
      )}

      {workerType === 'dag' && (
        <DependencySelector
          available={availableTasks}
          selected={dependencies}
          onChange={setDependencies}
        />
      )}

      <div className="actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          primary
          disabled={!selectedTask}
          onClick={() => onAdd(selectedTask!, { priority, dependencies })}
        >
          Add to {workerType}
        </Button>
      </div>
    </Modal>
  );
}
```

### 8. Real-Time Updates Hook

```tsx
// src/hooks/useDataStructure.ts

export function useDataStructure(sessionId: string) {
  const [dataStructure, setDataStructure] = useState<SessionDataStructure | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial load
    fetchDataStructure(sessionId).then(ds => {
      setDataStructure(ds);
      setIsLoading(false);
    });

    // WebSocket subscriptions
    const unsubscribers = [
      onEvent('ds:item_added', handleItemAdded),
      onEvent('ds:item_removed', handleItemRemoved),
      onEvent('ds:item_status_changed', handleStatusChanged),
      onEvent('ds:current_item_changed', handleCurrentChanged),
      onEvent('ds:reordered', handleReordered),
      onEvent('ds:dag_unlocked', handleDagUnlocked)
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [sessionId]);

  const handleItemAdded = (event: DSItemAddedEvent) => {
    if (event.sessionId !== sessionId) return;
    setDataStructure(prev => ({
      ...prev!,
      items: [...prev!.items, event.item]
    }));
  };

  // ... other handlers

  return { dataStructure, isLoading };
}
```

### 9. Task List Item Update

Show session status per task:

```tsx
// src/components/maestro/TaskListItem.tsx (updated)

function TaskListItem({ task }) {
  const { taskSessionStatuses } = useTaskSessionStatuses(task.id);

  return (
    <div className="task-list-item">
      <TaskStatusBadge status={task.userStatus} />
      <span className="title">{task.title}</span>

      {/* Session status indicators */}
      {taskSessionStatuses.length > 0 && (
        <div className="session-statuses">
          {taskSessionStatuses.map(tss => (
            <SessionStatusChip
              key={tss.sessionId}
              sessionId={tss.sessionId}
              status={tss.status}
              workerType={tss.workerType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionStatusChip({ sessionId, status, workerType }) {
  const icon = WORKER_TYPE_ICONS[workerType];
  const statusColor = STATUS_COLORS[status];

  return (
    <Tooltip content={`Session ${sessionId}: ${status}`}>
      <span className={`session-chip ${statusColor}`}>
        {icon} {STATUS_SHORT[status]}
      </span>
    </Tooltip>
  );
}
```

## New Components Summary

| Component | Purpose |
|-----------|---------|
| `WorkerTypeSelector` | Select worker type when creating session |
| `DataStructureView` | Router for structure-specific views |
| `QueueView` | Queue visualization |
| `StackView` | Stack visualization |
| `PriorityQueueView` | Priority queue with priority indicators |
| `DAGView` | Dependency graph visualization |
| `DAGGraph` | Interactive graph component |
| `WorkerTypeBadge` | Show worker type in session header |
| `AddTaskToSessionButton` | Trigger for adding tasks |
| `AddTaskModal` | Modal with worker-specific options |
| `SessionStatusChip` | Task's status in a specific session |
| `DependencyEditor` | Edit DAG dependencies |
| `TaskPriorityAssigner` | Assign priorities to tasks |

## CSS Additions

```css
/* Worker type badges */
.worker-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}
.worker-badge.queue { background: #e3f2fd; color: #1565c0; }
.worker-badge.stack { background: #fff3e0; color: #ef6c00; }
.worker-badge.priority { background: #fce4ec; color: #c2185b; }
.worker-badge.dag { background: #e8f5e9; color: #2e7d32; }

/* Data structure views */
.queue-view, .stack-view {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.queue-item, .stack-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.queue-item.current, .stack-item.current {
  background: var(--bg-highlight);
  border-left: 3px solid var(--accent);
}

/* Status indicators */
.status-icon.queued { color: var(--gray); }
.status-icon.processing { color: var(--blue); }
.status-icon.completed { color: var(--green); }
.status-icon.failed { color: var(--red); }
.status-icon.blocked { color: var(--orange); }

/* DAG view */
.dag-view {
  min-height: 300px;
}

.dag-node {
  padding: 8px 16px;
  border-radius: 4px;
  border: 2px solid;
}

.dag-node.completed { border-color: var(--green); background: #e8f5e9; }
.dag-node.processing { border-color: var(--blue); background: #e3f2fd; }
.dag-node.ready { border-color: var(--orange); background: #fff3e0; }
.dag-node.blocked { border-color: var(--gray); background: #f5f5f5; }
```

## Store Updates

```typescript
// src/stores/useMaestroStore.ts (additions)

interface MaestroState {
  // ... existing

  // Data structure state per session
  dataStructures: Record<string, SessionDataStructure>;

  // Actions
  initDataStructure: (sessionId: string, type: WorkerType, tasks: string[]) => Promise<void>;
  addTaskToSession: (sessionId: string, taskId: string, options?: AddOptions) => Promise<void>;
  updateDataStructure: (sessionId: string, update: Partial<SessionDataStructure>) => void;
}

// WebSocket event handling
function handleWSEvent(event: WSEvent) {
  // ... existing event handling

  // Data structure events
  if (event.type.startsWith('ds:')) {
    handleDataStructureEvent(event);
  }
}

function handleDataStructureEvent(event: DSEvent) {
  const { sessionId } = event;

  switch (event.type) {
    case 'ds:item_added':
      updateDataStructure(sessionId, ds => ({
        ...ds,
        items: [...ds.items, event.item]
      }));
      break;

    case 'ds:item_removed':
      updateDataStructure(sessionId, ds => ({
        ...ds,
        items: ds.items.filter(i => i.taskId !== event.item.taskId)
      }));
      break;

    // ... other events
  }
}
```
