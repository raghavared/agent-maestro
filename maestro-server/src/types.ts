// Worker strategy types
export type WorkerStrategy = 'simple' | 'queue' | 'tree';
export type OrchestratorStrategy = 'default' | 'intelligent-batching' | 'dag';
export type AgentTool = 'claude-code' | 'codex' | 'gemini';

export interface QueueItem {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  failReason?: string;
}

export interface QueueState {
  sessionId: string;
  strategy: WorkerStrategy;
  items: QueueItem[];
  currentIndex: number;  // -1 if no item is being processed
  createdAt: number;
  updatedAt: number;
}

// Base types
export interface Project {
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  taskSessionStatuses?: Record<string, TaskSessionStatus>;  // Per-session status map: { [sessionId]: status }
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  initialPrompt: string;

  // PHASE IV-A: Many-to-many relationships
  sessionIds: string[];        // Multiple sessions working on this task
  skillIds: string[];          // Skills assigned (Phase IV-B)
  agentIds: string[];          // Agents assigned (Phase IV-C)

  dependencies: string[];
  // NOTE: timeline moved to Session - each session has its own timeline

  // Reference task IDs for context (docs from these tasks are provided to the agent)
  referenceTaskIds?: string[];

  // Model configuration
  model?: string;

  // Agent tool configuration
  agentTool?: AgentTool;
}

export interface Session {
  id: string;
  projectId: string;

  // PHASE IV-A: Changed from taskId to taskIds
  taskIds: string[];           // Multiple tasks in this session

  name: string;                // Session name
  agentId?: string;            // Agent running this session (Phase IV-C)
  env: Record<string, string>; // Environment variables
  strategy: WorkerStrategy | OrchestratorStrategy;    // Worker strategy ('simple' or 'queue') or orchestrator strategy

  status: SessionStatus;
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
  hostname: string;
  platform: string;
  events: SessionEvent[];
  timeline: SessionTimelineEvent[];  // Session's activity timeline
  docs: DocEntry[];                  // Documents created/added during session
  metadata?: Record<string, any>;  // Additional metadata (skill, spawnedBy, etc.)
  needsInput?: {
    active: boolean;
    message?: string;
    since?: number;
  };
}

// Supporting types
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled' | 'blocked';
export type TaskSessionStatus = 'queued' | 'working' | 'blocked' | 'completed' | 'failed' | 'skipped';
export type TaskPriority = 'low' | 'medium' | 'high';
export type SessionStatus = 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped';

// Session timeline event types
export type SessionTimelineEventType =
  | 'session_started'    // Session spawned
  | 'session_stopped'    // Session stopped
  | 'task_started'       // Started working on a task
  | 'task_completed'     // Finished a task
  | 'task_failed'        // Failed a task
  | 'task_skipped'       // Skipped a task
  | 'task_blocked'       // Blocked on a task
  | 'needs_input'        // Waiting for user input
  | 'progress'           // General progress update
  | 'error'              // Error occurred
  | 'milestone'          // Milestone reached
  | 'doc_added';         // Documentation added

export interface SessionTimelineEvent {
  id: string;
  type: SessionTimelineEventType;
  timestamp: number;
  message?: string;
  taskId?: string;                    // Which task this event relates to
  metadata?: Record<string, any>;     // Extensible for strategy-specific data
}

// Document entry for session/task docs
export interface DocEntry {
  id: string;
  title: string;
  filePath: string;
  content?: string;                   // Optional inline markdown content
  taskId?: string;                    // Which task this doc relates to
  addedAt: number;
  addedBy?: string;                   // Session that added this doc
}

export interface SessionEvent {
  id: string;
  timestamp: number;
  type: string;
  data?: any;
}

// API request/response types
export interface CreateTaskPayload {
  projectId: string;
  parentId?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  initialPrompt?: string;
  skillIds?: string[];
  referenceTaskIds?: string[];
  model?: string;
  agentTool?: AgentTool;
}

export type UpdateSource = 'user' | 'session';

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  sessionStatus?: TaskSessionStatus;  // Backward compat: session-source updates send single status (mapped to taskSessionStatuses[sessionId])
  taskSessionStatuses?: Record<string, TaskSessionStatus>;  // Direct map update (for user/internal updates)
  priority?: TaskPriority;
  sessionIds?: string[];      // PHASE IV-A: Update sessions
  skillIds?: string[];         // PHASE IV-B
  agentIds?: string[];         // PHASE IV-C
  referenceTaskIds?: string[];
  model?: string;
  agentTool?: AgentTool;
  // NOTE: timeline removed - use session timeline via /sessions/:id/timeline
  // Update source tracking
  updateSource?: UpdateSource;  // Who is making the update
  sessionId?: string;           // Session ID if updateSource === 'session'
}

export interface CreateSessionPayload {
  id?: string;
  projectId: string;
  taskIds: string[];           // PHASE IV-A: Array of task IDs
  name?: string;
  agentId?: string;
  strategy?: WorkerStrategy | OrchestratorStrategy;   // Worker or orchestrator strategy, defaults to 'simple'
  status?: SessionStatus;
  env?: Record<string, string>;
  metadata?: Record<string, any>;
  _suppressCreatedEvent?: boolean;  // Internal: suppress session:created event
}

export interface UpdateSessionPayload {
  taskIds?: string[];          // PHASE IV-A: Update tasks
  status?: SessionStatus;
  agentId?: string;
  env?: Record<string, string>;  // Environment variables
  events?: SessionEvent[];
  timeline?: SessionTimelineEvent[];  // Append timeline events
  needsInput?: {
    active: boolean;
    message?: string;
    since?: number;
  };
}

// Spawn session payload (Server-Generated Manifests)
export interface SpawnSessionPayload {
  projectId: string;
  taskIds: string[];
  role?: 'worker' | 'orchestrator';
  strategy?: WorkerStrategy;            // Worker strategy ('simple' or 'queue'), defaults to 'simple'
  orchestratorStrategy?: OrchestratorStrategy;  // Orchestrator strategy ('default', 'intelligent-batching', or 'dag')
  spawnSource?: 'ui' | 'session';      // Changed: who is calling (ui or session)
  sessionId?: string;                   // Required when spawnSource === 'session' (parent session ID)
  sessionName?: string;
  skills?: string[];
  model?: string;  // Model to use for the session
  agentTool?: AgentTool;                // Agent tool to use ('claude-code' or 'codex')
  spawnedBy?: string;                   // Deprecated: use sessionId instead
  context?: Record<string, any>;
}

// Spawn request event (emitted by server to UI)
export interface SpawnRequestEvent {
  session: Session;
  projectId: string;
  taskIds: string[];
  command: string;
  cwd: string;
  envVars: Record<string, string>;
  manifest?: any;
  spawnSource: 'ui' | 'session';        // Who initiated the spawn
  parentSessionId?: string;              // Parent session ID if session-initiated
  _isSpawnCreated?: boolean;             // Backward compatibility flag
}

// Template types
export type TemplateRole = 'worker' | 'orchestrator';

export interface Template {
  id: string;
  name: string;
  role: TemplateRole;
  content: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTemplatePayload {
  name: string;
  role: TemplateRole;
  content: string;
}

export interface UpdateTemplatePayload {
  name?: string;
  content?: string;
}
