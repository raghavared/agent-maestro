import { Task, TaskStatus, CreateTaskPayload, UpdateTaskPayload } from '../../types';
import { ITaskRepository, TaskFilter } from '../../domain/repositories/ITaskRepository';
import { IProjectRepository } from '../../domain/repositories/IProjectRepository';
import { IEventBus } from '../../domain/events/IEventBus';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ValidationError, NotFoundError } from '../../domain/common/Errors';

/**
 * Application service for task operations.
 * Manages task lifecycle, validation, and events.
 */
export class TaskService {
  constructor(
    private taskRepo: ITaskRepository,
    private projectRepo: IProjectRepository,
    private eventBus: IEventBus,
    private idGenerator: IIdGenerator
  ) {}

  /**
   * Create a new task.
   */
  async createTask(input: CreateTaskPayload): Promise<Task> {
    // Validation
    if (!input.projectId) {
      throw new ValidationError('Project ID is required');
    }
    if (!input.title || input.title.trim() === '') {
      throw new ValidationError('Task title is required');
    }

    // Verify project exists
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('Project', input.projectId);
    }

    // Verify parent task exists if specified
    if (input.parentId) {
      const parentTask = await this.taskRepo.findById(input.parentId);
      if (!parentTask) {
        throw new NotFoundError('Parent task', input.parentId);
      }
    }

    const task = await this.taskRepo.create({
      ...input,
      title: input.title.trim()
    });

    await this.eventBus.emit('task:created', task);

    return task;
  }

  /**
   * Get a task by ID.
   */
  async getTask(id: string): Promise<Task> {
    const task = await this.taskRepo.findById(id);
    if (!task) {
      throw new NotFoundError('Task', id);
    }
    return task;
  }

  /**
   * List tasks with optional filtering.
   */
  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    return this.taskRepo.findAll(filter);
  }

  /**
   * List tasks for a project.
   */
  async listTasksByProject(projectId: string): Promise<Task[]> {
    return this.taskRepo.findByProjectId(projectId);
  }

  /**
   * List child tasks of a parent.
   */
  async listChildTasks(parentId: string | null): Promise<Task[]> {
    return this.taskRepo.findByParentId(parentId);
  }

  /**
   * Update a task.
   *
   * IMPORTANT: When updateSource === 'session', agents/sessions can only update:
   * - sessionStatus (their working status on this task)
   * They CANNOT update user-controlled fields like status, priority, title, etc.
   * NOTE: Timeline is now on Session, not Task - use SessionService.addTimelineEvent()
   */
  async updateTask(id: string, updates: UpdateTaskPayload): Promise<Task> {
    // Validate updates
    if (updates.title !== undefined && updates.title.trim() === '') {
      throw new ValidationError('Task title cannot be empty');
    }

    // ENFORCEMENT: Sessions can only update sessionStatus, not user status
    if (updates.updateSource === 'session') {
      // Strip user-controlled fields - sessions can only update sessionStatus
      const {
        status,           // BLOCKED: user status
        title,            // BLOCKED: user field
        description,      // BLOCKED: user field
        priority,         // BLOCKED: user field
        updateSource,     // Remove from payload (internal)
        sessionId,        // Remove from payload (internal)
        ...allowedUpdates
      } = updates;

      // Only allow sessionStatus from sessions
      const sessionAllowedUpdates: UpdateTaskPayload = {};
      if (updates.sessionStatus !== undefined) {
        sessionAllowedUpdates.sessionStatus = updates.sessionStatus;
      }

      const task = await this.taskRepo.update(id, sessionAllowedUpdates);
      await this.eventBus.emit('task:updated', task);
      return task;
    }

    // User updates - allow all fields (but remove internal tracking fields)
    const { updateSource, sessionId, ...userUpdates } = updates;
    const task = await this.taskRepo.update(id, userUpdates);

    await this.eventBus.emit('task:updated', task);

    return task;
  }

  /**
   * Delete a task.
   */
  async deleteTask(id: string): Promise<void> {
    const task = await this.taskRepo.findById(id);
    if (!task) {
      throw new NotFoundError('Task', id);
    }

    await this.taskRepo.delete(id);

    await this.eventBus.emit('task:deleted', { id });
  }

  /**
   * Associate a session with a task.
   */
  async addSessionToTask(taskId: string, sessionId: string): Promise<void> {
    await this.taskRepo.addSession(taskId, sessionId);

    await this.eventBus.emit('task:session_added', { taskId, sessionId });
  }

  /**
   * Remove a session association from a task.
   */
  async removeSessionFromTask(taskId: string, sessionId: string): Promise<void> {
    await this.taskRepo.removeSession(taskId, sessionId);

    await this.eventBus.emit('task:session_removed', { taskId, sessionId });
  }

  /**
   * Get task count.
   */
  async getTaskCount(): Promise<number> {
    return this.taskRepo.count();
  }
}
