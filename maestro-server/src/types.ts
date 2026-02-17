// Ordering types (separate from task/session models - UI ordering only)
export interface Ordering {
  projectId: string;
  entityType: 'task' | 'session';
  orderedIds: string[];  // Ordered array of entity IDs
  updatedAt: number;
}

export interface UpdateOrderingPayload {
  orderedIds: string[];
}

// Mail message types
export type MailMessageType = 'assignment' | 'status_update' | 'query' | 'response' | 'directive' | 'notification';

export interface MailMessage {
  id: string;                    // "mail_<timestamp>_<random>"
  projectId: string;
  fromSessionId: string;
  toSessionId: string | null;    // null = broadcast
  replyToMailId: string | null;
  type: MailMessageType;
  subject: string;
  body: Record<string, any>;     // Type-specific structured fields
  createdAt: number;
}

export interface SendMailPayload {
  projectId: string;
  fromSessionId: string;
  toSessionId?: string | null;
  toTeamMemberId?: string;          // Resolve to session IDs for this team member
  replyToMailId?: string | null;
  type: MailMessageType;
  subject: string;
  body?: Record<string, any>;
}

export interface MailFilter {
  type?: MailMessageType;
  since?: number;
}

// Worker strategy types
export type WorkerStrategy = 'simple' | 'tree';
export type OrchestratorStrategy = 'default' | 'intelligent-batching' | 'dag';
export type AgentTool = 'claude-code' | 'codex' | 'gemini';

// Three-axis model types
export type AgentMode = 'execute' | 'coordinate';

// Base types
export interface Project {
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

// Team Member entity (first-class, separate from Task)
export type TeamMemberStatus = 'active' | 'archived';

export interface TeamMember {
  id: string;                          // "tm_<timestamp>_<random>" or deterministic for defaults
  projectId: string;
  name: string;                        // "Worker", "Coordinator", "Frontend Dev"
  role: string;                        // "Default executor", "Task orchestrator"
  identity: string;                    // Custom instructions / persona prompt
  avatar: string;                      // Emoji: "🔧", "🎯", "🎨"
  model?: string;                      // "opus", "sonnet", "haiku"
  agentTool?: AgentTool;               // "claude-code", "codex", "gemini"
  mode?: AgentMode;                    // "execute" or "coordinate"
  strategy?: string;                   // Deprecated: kept for backward compatibility
  skillIds?: string[];
  isDefault: boolean;                  // true for Worker & Coordinator
  status: TeamMemberStatus;            // 'active' | 'archived'

  capabilities?: {
    can_spawn_sessions?: boolean;
    can_edit_tasks?: boolean;
    can_report_task_level?: boolean;
    can_report_session_level?: boolean;
  };

  // Phase 2: Command permission overrides
  commandPermissions?: {
    groups?: Record<string, boolean>;    // e.g. { task: true, session: false }
    commands?: Record<string, boolean>;  // e.g. { "session:spawn": true }
  };

  // Phase 3: Workflow customization
  workflowTemplateId?: string;         // Built-in template ID or 'custom'
  customWorkflow?: string;             // Freeform workflow text (when workflowTemplateId === 'custom')

  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
}

export interface TeamMemberSnapshot {
  name: string;
  avatar: string;
  role: string;
  model?: string;
  agentTool?: AgentTool;
}

export interface CreateTeamMemberPayload {
  projectId: string;
  name: string;
  role: string;
  identity: string;
  avatar: string;
  model?: string;
  agentTool?: AgentTool;
  mode?: AgentMode;
  strategy?: string;
  skillIds?: string[];
  capabilities?: TeamMember['capabilities'];
  commandPermissions?: TeamMember['commandPermissions'];
  workflowTemplateId?: string;
  customWorkflow?: string;
}

export interface UpdateTeamMemberPayload {
  name?: string;
  role?: string;
  identity?: string;
  avatar?: string;
  model?: string;
  agentTool?: AgentTool;
  mode?: AgentMode;
  strategy?: string;
  skillIds?: string[];
  status?: TeamMemberStatus;
  capabilities?: TeamMember['capabilities'];
  commandPermissions?: TeamMember['commandPermissions'];
  workflowTemplateId?: string;
  customWorkflow?: string;
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

  // Pinned tasks appear in the dedicated "Pinned" tab for quick re-execution
  pinned?: boolean;

  // Assigned team member for this task
  teamMemberId?: string;

  // Multiple team member identities for this task (takes precedence over teamMemberId)
  teamMemberIds?: string[];
}

export interface Session {
  id: string;
  projectId: string;

  // PHASE IV-A: Changed from taskId to taskIds
  taskIds: string[];           // Multiple tasks in this session

  name: string;                // Session name
  agentId?: string;            // Agent running this session (Phase IV-C)
  env: Record<string, string>; // Environment variables
  strategy?: string;    // Deprecated: kept for backward compatibility

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
  teamMemberId?: string;
  teamMemberSnapshot?: TeamMemberSnapshot;

  // Multiple team member identities for this session
  teamMemberIds?: string[];
  teamMemberSnapshots?: TeamMemberSnapshot[];
}

// Supporting types
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled' | 'blocked' | 'archived';
export type TaskSessionStatus = 'working' | 'blocked' | 'completed' | 'failed' | 'skipped';
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
  metadata?: Record<string, any>;     // Extensible metadata
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
  teamMemberId?: string;
  teamMemberIds?: string[];
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
  pinned?: boolean;
  teamMemberId?: string;
  teamMemberIds?: string[];
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
  strategy?: string;   // Deprecated: kept for backward compatibility
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
  mode?: AgentMode;                     // Three-axis model: 'execute' or 'coordinate'
  strategy?: string;                    // Deprecated: kept for backward compatibility
  spawnSource?: 'ui' | 'session';      // Who is calling (ui or session)
  sessionId?: string;                   // Required when spawnSource === 'session' (parent session ID)
  sessionName?: string;
  skills?: string[];
  context?: Record<string, any>;
  teamMemberId?: string;                // Team member running this session (backward compat)
  teamMemberIds?: string[];             // Multiple team member identities for this session
  delegateTeamMemberIds?: string[];     // Team member IDs for coordination delegation pool
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

