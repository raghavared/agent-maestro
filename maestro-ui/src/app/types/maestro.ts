// Canonical types matching maestro-server/src/types.ts
// plus UI-specific optional fields

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high';
export type MaestroSessionStatus = 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped';
export type SpawnSource = 'ui' | 'session';
export type TaskSessionStatus = 'queued' | 'working' | 'needs_input' | 'blocked' | 'completed' | 'failed' | 'skipped';
export type WorkerStrategy = 'simple' | 'queue';
export type ModelType = 'sonnet' | 'opus' | 'haiku';

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
  | 'milestone';         // Milestone reached




export interface MaestroProject {
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // UI specific fields that might come from API or be computed
  basePath?: string | null;
  environmentId: string | null;
  assetsEnabled?: boolean;
}



export interface SessionTimelineEvent {
  id: string;
  type: SessionTimelineEventType;
  timestamp: number;
  message?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

export interface MaestroSessionEvent {
  id: string;
  timestamp: number;
  type: string;
  data?: any;
}

export interface MaestroTask {
  // Core Identity
  id: string;
  projectId: string;
  parentId: string | null;

  // Content
  title: string;
  description: string;
  initialPrompt: string; // Standardized from 'prompt'

  // Status & Priority
  status: TaskStatus;
  priority: TaskPriority;
  sessionStatus?: TaskSessionStatus;  // Renamed from agentStatus

  // Timestamps
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;

  // Relationships
  sessionIds: string[];
  skillIds: string[];
  agentIds: string[];
  dependencies: string[];
  // NOTE: timeline moved to Session

  // Model configuration
  model?: ModelType;

  // UI/Populated Fields (Optional)
  subtasks?: MaestroTask[];
  sessionCount?: number; // UI computed field
  lastUpdate?: string | null; // UI computed field
}

// Subtask alias - in the new model, subtasks are just Tasks
export type MaestroSubtask = MaestroTask;

export interface MaestroSession {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  agentId?: string;
  env: Record<string, string>;
  strategy?: WorkerStrategy;
  status: MaestroSessionStatus;
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
  hostname: string;
  platform: string;
  events: MaestroSessionEvent[];
  timeline: SessionTimelineEvent[];  // Session's activity timeline
  role?: 'orchestrator' | 'worker';
  spawnSource?: SpawnSource;
  spawnedBy?: string;
  manifestPath?: string;
  model?: ModelType;
}

// Payloads
export interface CreateTaskPayload {
  projectId: string;
  parentId?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  initialPrompt?: string; // Standardized
  skillIds?: string[];
  model?: ModelType;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  sessionStatus?: TaskSessionStatus;  // Renamed from agentStatus
  priority?: TaskPriority;
  initialPrompt?: string;
  sessionIds?: string[];
  skillIds?: string[];
  agentIds?: string[];
  model?: ModelType;
  // NOTE: timeline moved to Session - use addTimelineEvent on session
  completedAt?: number | null;
}

export interface CreateSessionPayload {
  id?: string;
  projectId: string;
  taskIds: string[];
  name?: string;
  agentId?: string;
}

export interface UpdateSessionPayload {
  taskIds?: string[];
  status?: MaestroSessionStatus;
  agentId?: string;
  events?: MaestroSessionEvent[];
  timeline?: SessionTimelineEvent[];
  completedAt?: number;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'role';
  version: string;
}

export interface SpawnSessionPayload {
  projectId: string;
  taskIds: string[];
  role?: 'worker' | 'orchestrator';
  strategy?: WorkerStrategy;          // 'simple' (default) or 'queue'
  spawnSource?: SpawnSource;          // 'ui' or 'session'
  sessionId?: string;                  // Required when spawnSource === 'session' (parent session ID)
  sessionName?: string;
  skills?: string[];
  spawnedBy?: string;                  // Deprecated: use sessionId instead
  context?: Record<string, any>;
  model?: ModelType;
}

export interface SpawnSessionResponse {
  success: boolean;
  sessionId: string;
  manifestPath: string;
  session: MaestroSession;
}

export type TaskTreeNode = MaestroTask & { children: TaskTreeNode[] };

// Template types
export type TemplateRole = 'worker' | 'orchestrator';

export interface MaestroTemplate {
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