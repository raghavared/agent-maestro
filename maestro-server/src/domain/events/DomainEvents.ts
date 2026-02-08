import { Project, Task, Session, SpawnRequestEvent } from '../../types';

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
  | SessionTaskRemovedEvent;

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
}

/**
 * All valid event names.
 */
export type EventName = keyof TypedEventMap;

/**
 * Get the payload type for a specific event name.
 */
export type EventPayload<K extends EventName> = TypedEventMap[K];
