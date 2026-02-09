/**
 * Storage entity interfaces — matches server's data shapes exactly.
 * Used by LocalStorage for reading/writing ~/.maestro/data/
 */

export interface StoredProject {
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredTask {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: string;
  taskSessionStatuses?: Record<string, string>;  // Per-session status map: { [sessionId]: status }
  priority: string;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  sessionIds: string[];
  dependencies: string[];
  // NOTE: timeline moved to Session
  acceptanceCriteria?: string[];
  metadata?: Record<string, any>;
}

export interface StoredSession {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  status: string;
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
  timeline: SessionTimelineEvent[];  // Session's activity timeline
  metadata?: Record<string, any>;
}

export interface SessionTimelineEvent {
  id: string;
  type: string;
  timestamp: number;
  message?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}
