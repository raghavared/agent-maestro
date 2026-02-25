import { Session, SessionStatus, CreateSessionPayload, UpdateSessionPayload, SessionTimelineEvent, SessionTimelineEventType, DocEntry } from '../../types';
import { ISessionRepository, SessionFilter } from '../../domain/repositories/ISessionRepository';
import { ITaskRepository } from '../../domain/repositories/ITaskRepository';
import { IProjectRepository } from '../../domain/repositories/IProjectRepository';
import { IEventBus } from '../../domain/events/IEventBus';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ValidationError, NotFoundError } from '../../domain/common/Errors';

/**
 * Application service for session operations.
 * Manages session lifecycle, task associations, and events.
 */
export class SessionService {
  constructor(
    private sessionRepo: ISessionRepository,
    private taskRepo: ITaskRepository,
    private projectRepo: IProjectRepository,
    private eventBus: IEventBus,
    private idGenerator: IIdGenerator
  ) {}

  /**
   * Create a new session.
   */
  async createSession(input: CreateSessionPayload): Promise<Session> {
    // Validation
    if (!input.projectId) {
      throw new ValidationError('Project ID is required');
    }

    // Verify project exists
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('Project', input.projectId);
    }

    // Inherit master session flag from project
    if (project.isMaster) {
      input.isMasterSession = true;
      input.env = { ...input.env, MAESTRO_IS_MASTER: 'true' };
    }

    // Verify all tasks exist
    if (input.taskIds && input.taskIds.length > 0) {
      for (const taskId of input.taskIds) {
        const task = await this.taskRepo.findById(taskId);
        if (!task) {
          throw new NotFoundError('Task', taskId);
        }
      }
    }

    const session = await this.sessionRepo.create(input);

    // Add session ID to all associated tasks and add timeline events
    for (const taskId of session.taskIds) {
      await this.taskRepo.addSession(taskId, session.id);

      // Add timeline event to session for each task
      const event: SessionTimelineEvent = {
        id: this.idGenerator.generate('evt'),
        type: 'task_started',
        timestamp: Date.now(),
        taskId,
        message: `Started working on task`,
      };
      await this.sessionRepo.addTimelineEvent(session.id, event);
    }

    // Emit events
    if (!input._suppressCreatedEvent) {
      await this.eventBus.emit('session:created', session);

      // Emit task:session_added events
      for (const taskId of session.taskIds) {
        await this.eventBus.emit('task:session_added', { taskId, sessionId: session.id });
      }
    }

    return session;
  }

  /**
   * Get a session by ID.
   */
  async getSession(id: string): Promise<Session> {
    const session = await this.sessionRepo.findById(id);
    if (!session) {
      throw new NotFoundError('Session', id);
    }
    return session;
  }

  /**
   * List sessions with optional filtering.
   */
  async listSessions(filter?: SessionFilter): Promise<Session[]> {
    return this.sessionRepo.findAll(filter);
  }

  /**
   * List sessions for a project.
   */
  async listSessionsByProject(projectId: string): Promise<Session[]> {
    return this.sessionRepo.findByProjectId(projectId);
  }

  /**
   * List sessions for a task.
   */
  async listSessionsByTask(taskId: string): Promise<Session[]> {
    return this.sessionRepo.findByTaskId(taskId);
  }

  /**
   * Update a session.
   */
  async updateSession(id: string, updates: UpdateSessionPayload): Promise<Session> {
    // Fetch old session state for comparison
    const oldSession = await this.sessionRepo.findById(id);

    // Snapshot old values BEFORE mutation (findById returns a mutable reference)
    const oldStatus = oldSession?.status;
    const oldNeedsInputActive = oldSession?.needsInput?.active ?? false;

    // Guard: don't overwrite 'completed' with 'stopped'
    if (updates.status === 'stopped') {
      if (oldSession && oldStatus === 'completed') {
        delete updates.status;
        if (Object.keys(updates).length === 0) return oldSession;
      }
    }

    const session = await this.sessionRepo.update(id, updates);

    // Propagate terminal session status to task-level taskSessionStatuses
    if (updates.status && ['stopped', 'completed', 'failed'].includes(updates.status)) {
      const taskSessionStatus = updates.status === 'completed' ? 'completed' : 'failed';
      for (const taskId of session.taskIds) {
        try {
          const task = await this.taskRepo.findById(taskId);
          if (task) {
            const currentTaskSessionStatus = task.taskSessionStatuses?.[id];
            // Only update if the task-session status is still active (working/queued/blocked)
            if (currentTaskSessionStatus && !['completed', 'failed', 'skipped'].includes(currentTaskSessionStatus)) {
              await this.taskRepo.update(taskId, {
                taskSessionStatuses: { ...(task.taskSessionStatuses || {}), [id]: taskSessionStatus },
              });
              const updatedTask = await this.taskRepo.findById(taskId);
              if (updatedTask) {
                await this.eventBus.emit('task:updated', updatedTask);
              }
            }
          }
        } catch {
          // Best effort — don't fail the session update if task update fails
        }
      }
    }

    await this.eventBus.emit('session:updated', session);

    // Emit notification events for session status transitions (using snapshot)
    if (oldSession && oldStatus !== session.status) {
      if (session.status === 'completed') {
        await this.eventBus.emit('notify:session_completed', { sessionId: session.id, name: session.name });
      } else if (session.status === 'failed') {
        await this.eventBus.emit('notify:session_failed', { sessionId: session.id, name: session.name });
      }
    }

    // Emit notify:needs_input when needsInput.active becomes true (using snapshot)
    if (oldSession && updates.needsInput?.active && !oldNeedsInputActive) {
      await this.eventBus.emit('notify:needs_input', {
        sessionId: session.id,
        name: session.name,
        message: updates.needsInput.message,
      });
    }

    return session;
  }

  /**
   * Delete a session.
   */
  async deleteSession(id: string): Promise<void> {
    const session = await this.sessionRepo.findById(id);
    if (!session) {
      throw new NotFoundError('Session', id);
    }

    // Add session_stopped timeline event before deletion
    const stopEvent: SessionTimelineEvent = {
      id: this.idGenerator.generate('evt'),
      type: 'session_stopped',
      timestamp: Date.now(),
      message: 'Session ended',
    };
    await this.sessionRepo.addTimelineEvent(id, stopEvent);

    // Remove session ID from all associated tasks
    for (const taskId of session.taskIds) {
      const task = await this.taskRepo.findById(taskId);
      if (task) {
        await this.taskRepo.removeSession(taskId, id);
      }
    }

    await this.sessionRepo.delete(id);

    await this.eventBus.emit('session:deleted', { id });
  }

  /**
   * Add a task to a session.
   */
  async addTaskToSession(sessionId: string, taskId: string): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    await this.sessionRepo.addTask(sessionId, taskId);
    await this.taskRepo.addSession(taskId, sessionId);

    // Add timeline event to session
    const event: SessionTimelineEvent = {
      id: this.idGenerator.generate('evt'),
      type: 'task_started',
      timestamp: Date.now(),
      taskId,
      message: `Added task to session`,
    };
    await this.sessionRepo.addTimelineEvent(sessionId, event);

    await this.eventBus.emit('session:task_added', { sessionId, taskId });
    await this.eventBus.emit('task:session_added', { taskId, sessionId });
  }

  /**
   * Remove a task from a session.
   */
  async removeTaskFromSession(sessionId: string, taskId: string): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    await this.sessionRepo.removeTask(sessionId, taskId);
    await this.taskRepo.removeSession(taskId, sessionId);

    // Add timeline event to session
    const event: SessionTimelineEvent = {
      id: this.idGenerator.generate('evt'),
      type: 'task_completed',  // Or could be task_skipped depending on context
      timestamp: Date.now(),
      taskId,
      message: `Removed task from session`,
    };
    await this.sessionRepo.addTimelineEvent(sessionId, event);

    await this.eventBus.emit('session:task_removed', { sessionId, taskId });
    await this.eventBus.emit('task:session_removed', { taskId, sessionId });
  }

  /**
   * Get session count.
   */
  async getSessionCount(): Promise<number> {
    return this.sessionRepo.count();
  }

  /**
   * Get active session count (idle + working).
   */
  async getRunningSessionCount(): Promise<number> {
    const idle = await this.sessionRepo.countByStatus('idle');
    const working = await this.sessionRepo.countByStatus('working');
    return idle + working;
  }

  /**
   * Add an event to a session.
   */
  async addEventToSession(sessionId: string, event: { type: string; data?: any }): Promise<Session> {
    const session = await this.sessionRepo.addEvent(sessionId, event);

    await this.eventBus.emit('session:updated', session);

    return session;
  }

  /**
   * Add a timeline event to a session.
   * This is the primary method for logging session activity.
   */
  async addTimelineEvent(
    sessionId: string,
    type: SessionTimelineEventType,
    message?: string,
    taskId?: string,
    metadata?: Record<string, any>
  ): Promise<Session> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    const event: SessionTimelineEvent = {
      id: this.idGenerator.generate('evt'),
      type,
      timestamp: Date.now(),
      message,
      taskId,
      metadata,
    };

    await this.sessionRepo.addTimelineEvent(sessionId, event);

    // Auto-set needsInput flag when needs_input timeline event is added
    if (type === 'needs_input') {
      await this.sessionRepo.update(sessionId, {
        needsInput: { active: true, message, since: Date.now() },
      });
    }

    // Fetch the fully updated session after all mutations
    const updatedSession = await this.sessionRepo.findById(sessionId);
    if (!updatedSession) {
      throw new NotFoundError('Session', sessionId);
    }

    await this.eventBus.emit('session:updated', updatedSession);

    // Emit notification events for specific timeline event types
    if (type === 'progress') {
      await this.eventBus.emit('notify:progress', {
        sessionId,
        taskId,
        message,
      });
    } else if (type === 'needs_input') {
      await this.eventBus.emit('notify:needs_input', {
        sessionId,
        name: updatedSession.name,
        message,
      });
    }

    return updatedSession;
  }

  /**
   * Add a document to a session and create a timeline event.
   */
  async addDoc(
    sessionId: string,
    title: string,
    filePath: string,
    content?: string,
    taskId?: string,
  ): Promise<Session> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    const doc: DocEntry = {
      id: this.idGenerator.generate('doc'),
      title,
      filePath,
      content,
      taskId,
      addedAt: Date.now(),
      addedBy: sessionId,
    };

    await this.sessionRepo.addDoc(sessionId, doc);

    // Also add a timeline event
    const event: SessionTimelineEvent = {
      id: this.idGenerator.generate('evt'),
      type: 'doc_added',
      timestamp: Date.now(),
      message: `Doc added: ${title}`,
      taskId,
      metadata: { docId: doc.id, filePath, title },
    };
    await this.sessionRepo.addTimelineEvent(sessionId, event);

    const updatedSession = await this.sessionRepo.findById(sessionId);
    if (!updatedSession) {
      throw new NotFoundError('Session', sessionId);
    }

    await this.eventBus.emit('session:updated', updatedSession);

    return updatedSession;
  }
}
