# Worker Strategy Pattern

## Overview

The Worker Strategy System uses the **Strategy Pattern** to define interchangeable task processing behaviors. Each strategy encapsulates:
- How tasks are stored (data structure)
- How tasks are selected (algorithm)
- What commands are available (interface)
- How status transitions work (state machine)

## Pattern Definition

```
┌─────────────────────────────────────────────────────────────┐
│                         Session                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              WorkerTypeStrategy                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │    │
│  │  │ DataStructure│  │ AllowedCmds │  │ StatusRules│  │    │
│  │  └─────────────┘  └─────────────┘  └────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              WorkerConfig                            │    │
│  │  (runtime parameters: retries, timeouts, etc.)       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Strategy Interface

```typescript
/**
 * Base interface for all worker strategies.
 * Implements the Strategy Pattern for task processing.
 */
interface WorkerTypeStrategy {
  /** Unique identifier for this strategy */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Description of how this strategy works */
  readonly description: string;

  /** The data structure this strategy uses (or 'none' for manifest) */
  readonly dataStructure: DataStructureType | 'none';

  /** Whether this is the default strategy */
  readonly isDefault?: boolean;

  /** CLI commands available for this strategy */
  readonly allowedCommands: readonly string[];

  /** System prompt template for the agent */
  readonly systemPrompt: string;

  /** Status transition rules */
  readonly statusTransitions: StatusTransitionMap;

  /** Optional strategy-specific configuration schema */
  readonly configSchema?: JSONSchema;
}

type DataStructureType = 'queue' | 'stack' | 'priority_queue' | 'dag' | 'circular_queue';

type StatusTransitionMap = Record<ItemStatus, readonly ItemStatus[]>;
```

## Concrete Strategies

### 1. SimpleStrategy (Default)

The "no strategy" strategy - maximum agent autonomy.

```typescript
const SimpleStrategy: WorkerTypeStrategy = {
  id: 'simple',
  name: 'Simple',
  description: 'All tasks provided upfront, agent decides execution',
  dataStructure: 'none',
  isDefault: true,

  allowedCommands: [
    'task list',
    'task get',
    'task update',
    'task complete',
    'task fail',
  ],

  systemPrompt: `You are a Maestro worker. Complete the assigned tasks in any order you choose.
Use 'maestro task complete <id>' when done with each task.`,

  statusTransitions: {
    todo: ['in_progress', 'done', 'failed'],
    in_progress: ['done', 'failed', 'todo'],
    done: ['todo'],  // Can reopen
    failed: ['todo', 'in_progress'],
  },
};
```

### 2. QueueStrategy

FIFO task processing.

```typescript
const QueueStrategy: WorkerTypeStrategy = {
  id: 'queue',
  name: 'Queue',
  description: 'Process tasks in first-in-first-out order',
  dataStructure: 'queue',

  allowedCommands: [
    'queue top',
    'queue start',
    'queue complete',
    'queue fail',
    'queue skip',
    'queue list',
    'queue add',
  ],

  systemPrompt: `You are a Queue Worker. Process tasks sequentially.
Run 'maestro queue start' to begin, then 'maestro queue complete' when done.`,

  statusTransitions: {
    queued: ['processing'],
    processing: ['completed', 'failed', 'skipped', 'queued'],  // queued = retry
    completed: [],  // Terminal
    failed: ['queued'],  // Can retry
    skipped: ['queued'],  // Can re-add
  },
};
```

### 3. StackStrategy

LIFO/depth-first processing.

```typescript
const StackStrategy: WorkerTypeStrategy = {
  id: 'stack',
  name: 'Stack',
  description: 'Process tasks depth-first (last-in-first-out)',
  dataStructure: 'stack',

  allowedCommands: [
    'stack top',
    'stack start',
    'stack complete',
    'stack fail',
    'stack push',
    'stack list',
  ],

  systemPrompt: `You are a Stack Worker. Process tasks depth-first.
Use 'maestro stack push' to add subtasks. Complete deepest tasks first.`,

  statusTransitions: {
    queued: ['processing'],
    processing: ['completed', 'failed'],
    completed: [],
    failed: ['queued'],
  },
};
```

### 4. PriorityStrategy

Priority-based processing.

```typescript
const PriorityStrategy: WorkerTypeStrategy = {
  id: 'priority',
  name: 'Priority',
  description: 'Process tasks by priority (highest first)',
  dataStructure: 'priority_queue',

  allowedCommands: [
    'priority top',
    'priority start',
    'priority complete',
    'priority fail',
    'priority add',
    'priority bump',
    'priority list',
  ],

  systemPrompt: `You are a Priority Worker. Always work on the highest priority task.
Use 'maestro priority start' to begin the most important task.`,

  statusTransitions: {
    queued: ['processing'],
    processing: ['completed', 'failed'],
    completed: [],
    failed: ['queued'],
  },

  configSchema: {
    type: 'object',
    properties: {
      defaultPriority: { type: 'number', minimum: 1, maximum: 5, default: 3 },
    },
  },
};
```

### 5. DAGStrategy

Dependency-aware processing.

```typescript
const DAGStrategy: WorkerTypeStrategy = {
  id: 'dag',
  name: 'DAG',
  description: 'Process tasks respecting dependencies',
  dataStructure: 'dag',

  allowedCommands: [
    'dag ready',
    'dag start',
    'dag complete',
    'dag fail',
    'dag add',
    'dag status',
    'dag visualize',
  ],

  systemPrompt: `You are a DAG Worker. Only work on tasks whose dependencies are satisfied.
Run 'maestro dag ready' to see available tasks, then 'maestro dag start <id>'.`,

  statusTransitions: {
    blocked: ['queued'],  // When deps satisfied
    queued: ['processing'],
    processing: ['completed', 'failed'],
    completed: [],
    failed: ['queued'],
  },
};
```

## Strategy Registry

```typescript
/**
 * Registry of all available worker strategies.
 * Strategies are immutable once registered.
 */
class WorkerStrategyRegistry {
  private static strategies: Map<string, WorkerTypeStrategy> = new Map();

  static register(strategy: WorkerTypeStrategy): void {
    if (this.strategies.has(strategy.id)) {
      throw new Error(`Strategy '${strategy.id}' already registered`);
    }
    Object.freeze(strategy);
    Object.freeze(strategy.allowedCommands);
    Object.freeze(strategy.statusTransitions);
    this.strategies.set(strategy.id, strategy);
  }

  static get(id: string): WorkerTypeStrategy | undefined {
    return this.strategies.get(id);
  }

  static getDefault(): WorkerTypeStrategy {
    const defaultStrategy = [...this.strategies.values()].find(s => s.isDefault);
    if (!defaultStrategy) {
      throw new Error('No default strategy registered');
    }
    return defaultStrategy;
  }

  static list(): WorkerTypeStrategy[] {
    return [...this.strategies.values()];
  }

  static isValidCommand(strategyId: string, command: string): boolean {
    const strategy = this.get(strategyId);
    return strategy?.allowedCommands.includes(command) ?? false;
  }

  static isValidTransition(
    strategyId: string,
    from: ItemStatus,
    to: ItemStatus
  ): boolean {
    const strategy = this.get(strategyId);
    return strategy?.statusTransitions[from]?.includes(to) ?? false;
  }
}

// Register built-in strategies
WorkerStrategyRegistry.register(SimpleStrategy);
WorkerStrategyRegistry.register(QueueStrategy);
WorkerStrategyRegistry.register(StackStrategy);
WorkerStrategyRegistry.register(PriorityStrategy);
WorkerStrategyRegistry.register(DAGStrategy);
```

## Strategy Context (Session)

The Session acts as the **Context** in the Strategy Pattern:

```typescript
/**
 * Session is the Context that uses a WorkerTypeStrategy.
 * The strategy is set at creation and cannot be changed.
 *
 * NOTE: The data structure is NOT stored on the session.
 * It's an internal implementation detail managed by the strategy.
 */
interface Session {
  id: string;
  projectId: string;

  /** The strategy this session uses (immutable after creation) */
  strategy: WorkerTypeStrategy['id'];

  /** Runtime configuration for the strategy */
  config: WorkerConfig;

  /** Session state */
  status: SessionStatus;

  /** Task IDs assigned to this session */
  taskIds: string[];

  // ... other session fields

  // NO dataStructure field here - it's encapsulated in the strategy
}

interface WorkerConfig {
  maxRetries?: number;
  taskTimeout?: number;
  retryOnCrash?: boolean;
  // Strategy-specific config merged in
  [key: string]: unknown;
}
```

## Data Structure Encapsulation

The data structure is managed internally by the strategy, not exposed on the session:

```typescript
/**
 * Strategy Runtime - encapsulates the data structure.
 * Created when session starts, destroyed when session ends.
 */
class StrategyRuntime {
  private session: Session;
  private strategy: WorkerTypeStrategy;
  private dataStructure?: SessionDataStructure;  // Internal, not on Session

  constructor(session: Session) {
    this.session = session;
    this.strategy = WorkerStrategyRegistry.get(session.strategy)!;

    // Initialize data structure if strategy uses one
    if (this.strategy.dataStructure !== 'none') {
      this.dataStructure = DataStructureFactory.create(
        this.strategy.dataStructure,
        session.id,
        session.taskIds
      );
    }
  }

  // Strategy operations delegate to data structure internally
  async start(): Promise<Task | null> {
    if (!this.dataStructure) {
      throw new Error('Simple strategy does not use start command');
    }
    return this.dataStructure.getNext();
  }

  async complete(taskId: string): Promise<void> {
    if (this.dataStructure) {
      await this.dataStructure.markComplete(taskId);
    }
    // Update task status regardless
    await TaskService.updateStatus(taskId, 'completed');
  }
}

/**
 * Storage is separate - keyed by sessionId.
 * Session doesn't know about this.
 */
class DataStructureStore {
  private static store: Map<string, SessionDataStructure> = new Map();

  static get(sessionId: string): SessionDataStructure | undefined {
    return this.store.get(sessionId);
  }

  static set(sessionId: string, ds: SessionDataStructure): void {
    this.store.set(sessionId, ds);
  }

  static delete(sessionId: string): void {
    this.store.delete(sessionId);
  }
}
```

## Why This Encapsulation?

1. **Session is clean** - Only knows about strategy ID, not implementation
2. **Strategy owns its state** - Data structure is strategy's concern
3. **Swappable storage** - Can change how DS is stored without touching Session
4. **Single responsibility** - Session = context, Strategy = behavior, DS = state
5. **Testable** - Can mock data structure independently

```
┌─────────────────────────────────────────────────────────────┐
│                         Session                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ id, projectId, strategy, config, status, taskIds    │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           │ references                       │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              StrategyRuntime                         │    │
│  │  ┌─────────────────┐  ┌─────────────────────────┐   │    │
│  │  │ WorkerTypeStrategy│  │ DataStructure (internal)│   │    │
│  │  │ (definition)     │  │ (runtime state)         │   │    │
│  │  └─────────────────┘  └─────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```
```

## Strategy Execution

```typescript
/**
 * Executes strategy operations, validating against strategy rules.
 */
class StrategyExecutor {
  constructor(
    private session: Session,
    private strategy: WorkerTypeStrategy
  ) {}

  /**
   * Validate and execute a command.
   */
  async executeCommand(command: string, args: unknown[]): Promise<CommandResult> {
    // 1. Validate command is allowed
    if (!this.strategy.allowedCommands.includes(command)) {
      throw new CommandNotAllowedError(command, this.strategy.id);
    }

    // 2. Get command handler
    const handler = CommandRegistry.get(command);
    if (!handler) {
      throw new CommandNotFoundError(command);
    }

    // 3. Execute with strategy context
    return handler.execute(this.session, this.strategy, args);
  }

  /**
   * Validate and execute a status transition.
   */
  async transition(itemId: string, to: ItemStatus): Promise<void> {
    const item = await this.getItem(itemId);
    const from = item.status;

    // Validate transition
    if (!this.strategy.statusTransitions[from]?.includes(to)) {
      throw new InvalidTransitionError(from, to, this.strategy.id);
    }

    // Execute transition
    await this.updateItemStatus(itemId, to);
  }
}
```

## Adding Custom Strategies

Third parties can add custom strategies:

```typescript
// Example: Custom deployment strategy
const DeploymentStrategy: WorkerTypeStrategy = {
  id: 'deployment',
  name: 'Deployment Pipeline',
  description: 'Sequential deployment with rollback support',
  dataStructure: 'queue',

  allowedCommands: [
    'deploy start',
    'deploy complete',
    'deploy rollback',
    'deploy status',
  ],

  systemPrompt: `You are a Deployment Worker...`,

  statusTransitions: {
    pending: ['deploying'],
    deploying: ['deployed', 'rolled_back', 'failed'],
    deployed: ['pending'],  // For re-deploy
    rolled_back: ['pending'],
    failed: ['pending'],
  },
};

// Register custom strategy
WorkerStrategyRegistry.register(DeploymentStrategy);
```

## Strategy Selection UI

```
┌─────────────────────────────────────────────────────────────┐
│ Select Processing Strategy                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ○ Simple (Default)                                         │
│    All tasks upfront, you decide the order                  │
│                                                             │
│  ○ Queue                                                    │
│    Process in order: first added, first done                │
│                                                             │
│  ○ Stack                                                    │
│    Depth-first: newest tasks first, good for subtasks       │
│                                                             │
│  ○ Priority                                                 │
│    Most important tasks first                               │
│                                                             │
│  ○ DAG                                                      │
│    Respect task dependencies                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [?] Which strategy should I use?                            │
└─────────────────────────────────────────────────────────────┘
```

## Benefits of Strategy Pattern

1. **Open/Closed Principle**: Add new strategies without modifying existing code
2. **Single Responsibility**: Each strategy handles one way of processing
3. **Testability**: Strategies are isolated and independently testable
4. **Composition**: Strategies can be composed (future enhancement)
5. **Runtime Selection**: Strategy chosen at session creation
6. **Clear Contracts**: Interface defines what strategies must implement

## Type Hierarchy

```typescript
// Base types
type StrategyId = 'simple' | 'queue' | 'stack' | 'priority' | 'dag' | string;

// The strategy definition (immutable template)
interface WorkerTypeStrategy { ... }

// The session's runtime config for the strategy
interface WorkerConfig { ... }

// The session using a strategy
interface Session {
  strategy: StrategyId;
  config: WorkerConfig;
  ...
}
```

## Naming Convention

| Old Name | New Name | Purpose |
|----------|----------|---------|
| WorkerType | WorkerTypeStrategy | Strategy definition |
| workerType | strategy | Session's strategy ID |
| ManifestWorker | SimpleStrategy | Default strategy |
| QueueWorker | QueueStrategy | FIFO strategy |
| WorkerConfig | WorkerConfig | Runtime config (unchanged) |
