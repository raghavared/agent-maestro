import { Project, Task, Session, SpawnRequestEvent, TaskSessionStatus } from '../../types';

/**
 * Type-safe domain event definitions.
 * These match the events currently emitted by the Storage class.
 */

// Project Events
export interface ProjectCreatedEvent {
  type: 'project:created';
  data: Project;
}

export interface ProjectUpdatedEvent {
  type: 'project:updated';
  data: Project;
}

export interface ProjectDeletedEvent {
  type: 'project:deleted';
  data: { id: string };
}

// Task Events
export interface TaskCreatedEvent {
  type: 'task:created';
  data: Task;
}

export interface TaskUpdatedEvent {
  type: 'task:updated';
  data: Task;
}

export interface TaskDeletedEvent {
  type: 'task:deleted';
  data: { id: string };
}

export interface TaskSessionAddedEvent {
  type: 'task:session_added';
  data: { taskId: string; sessionId: string };
}

export interface TaskSessionRemovedEvent {
  type: 'task:session_removed';
  data: { taskId: string; sessionId: string };
}

// Session Events
export interface SessionCreatedEvent {
  type: 'session:created';
  data: Session;
}

export interface SessionSpawnEvent {
  type: 'session:spawn';
  data: SpawnRequestEvent;
}

export interface SessionUpdatedEvent {
  type: 'session:updated';
  data: Session;
}

export interface SessionDeletedEvent {
  type: 'session:deleted';
  data: { id: string };
}

export interface SessionTaskAddedEvent {
  type: 'session:task_added';
  data: { sessionId: string; taskId: string };
}

export interface SessionTaskRemovedEvent {
  type: 'session:task_removed';
  data: { sessionId: string; taskId: string };
}

// Notification Events (fire alongside CRUD events for high-impact state transitions)
export interface NotifyTaskCompletedEvent {
  type: 'notify:task_completed';
  data: { taskId: string; title: string };
}

export interface NotifyTaskFailedEvent {
  type: 'notify:task_failed';
  data: { taskId: string; title: string };
}

export interface NotifyTaskBlockedEvent {
  type: 'notify:task_blocked';
  data: { taskId: string; title: string };
}

export interface NotifyTaskSessionCompletedEvent {
  type: 'notify:task_session_completed';
  data: { taskId: string; sessionId: string; title: string };
}

export interface NotifyTaskSessionFailedEvent {
  type: 'notify:task_session_failed';
  data: { taskId: string; sessionId: string; title: string };
}

export interface NotifySessionCompletedEvent {
  type: 'notify:session_completed';
  data: { sessionId: string; name: string };
}

export interface NotifySessionFailedEvent {
  type: 'notify:session_failed';
  data: { sessionId: string; name: string };
}

export interface NotifyNeedsInputEvent {
  type: 'notify:needs_input';
  data: { sessionId: string; name: string; message?: string };
}

export interface NotifyProgressEvent {
  type: 'notify:progress';
  data: { sessionId: string; taskId?: string; message?: string };
}

/**
 * Union type of all domain events.
 * Use this for type-safe event handling.
 */
export type DomainEvent =
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | ProjectDeletedEvent
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskDeletedEvent
  | TaskSessionAddedEvent
  | TaskSessionRemovedEvent
  | SessionCreatedEvent
  | SessionSpawnEvent
  | SessionUpdatedEvent
  | SessionDeletedEvent
  | SessionTaskAddedEvent
  | SessionTaskRemovedEvent
  | NotifyTaskCompletedEvent
  | NotifyTaskFailedEvent
  | NotifyTaskBlockedEvent
  | NotifyTaskSessionCompletedEvent
  | NotifyTaskSessionFailedEvent
  | NotifySessionCompletedEvent
  | NotifySessionFailedEvent
  | NotifyNeedsInputEvent
  | NotifyProgressEvent;

/**
 * Type-safe event map for event bus.
 * Maps event name strings to their payload types.
 */
export interface TypedEventMap {
  'project:created': Project;
  'project:updated': Project;
  'project:deleted': { id: string };
  'task:created': Task;
  'task:updated': Task;
  'task:deleted': { id: string };
  'task:session_added': { taskId: string; sessionId: string };
  'task:session_removed': { taskId: string; sessionId: string };
  'session:created': Session;
  'session:spawn': SpawnRequestEvent;
  'session:updated': Session;
  'session:deleted': { id: string };
  'session:task_added': { sessionId: string; taskId: string };
  'session:task_removed': { sessionId: string; taskId: string };
  // Notification events
  'notify:task_completed': { taskId: string; title: string };
  'notify:task_failed': { taskId: string; title: string };
  'notify:task_blocked': { taskId: string; title: string };
  'notify:task_session_completed': { taskId: string; sessionId: string; title: string };
  'notify:task_session_failed': { taskId: string; sessionId: string; title: string };
  'notify:session_completed': { sessionId: string; name: string };
  'notify:session_failed': { sessionId: string; name: string };
  'notify:needs_input': { sessionId: string; name: string; message?: string };
  'notify:progress': { sessionId: string; taskId?: string; message?: string };
}

/**
 * All valid event names.
 */
export type EventName = keyof TypedEventMap;

/**
 * Get the payload type for a specific event name.
 */
export type EventPayload<K extends EventName> = TypedEventMap[K];
