import { Task, TaskStatus, CreateTaskPayload, UpdateTaskPayload } from '../../types';

/**
 * Filter options for listing tasks.
 */
export interface TaskFilter {
  projectId?: string;
  status?: TaskStatus;
  parentId?: string | null;
  sessionId?: string;
}

/**
 * Repository interface for Task persistence operations.
 */
export interface ITaskRepository {
  /**
   * Create a new task.
   * @param task - Task data from CreateTaskPayload
   * @returns The created task with generated id and timestamps
   */
  create(task: CreateTaskPayload): Promise<Task>;

  /**
   * Find a task by ID.
   * @param id - Task ID
   * @returns The task if found, null otherwise
   */
  findById(id: string): Promise<Task | null>;

  /**
   * Find all tasks for a project.
   * @param projectId - Project ID
   * @returns Array of tasks, empty if none found
   */
  findByProjectId(projectId: string): Promise<Task[]>;

  /**
   * Find tasks by status.
   * @param status - Task status to filter by
   * @returns Array of tasks with the given status
   */
  findByStatus(status: TaskStatus): Promise<Task[]>;

  /**
   * Find subtasks (tasks with a specific parent).
   * @param parentId - Parent task ID (null for root tasks)
   * @returns Array of child tasks
   */
  findByParentId(parentId: string | null): Promise<Task[]>;

  /**
   * Find all tasks associated with a session.
   * @param sessionId - Session ID
   * @returns Array of tasks associated with the session
   */
  findBySessionId(sessionId: string): Promise<Task[]>;

  /**
   * Find tasks with optional filters.
   * @param filter - Filter options
   * @returns Array of tasks matching filter
   */
  findAll(filter?: TaskFilter): Promise<Task[]>;

  /**
   * Update an existing task.
   * @param id - Task ID
   * @param updates - Partial task updates
   * @returns The updated task
   * @throws {NotFoundError} if task not found
   */
  update(id: string, updates: UpdateTaskPayload): Promise<Task>;

  /**
   * Delete a task.
   * @param id - Task ID
   * @throws {NotFoundError} if task not found
   */
  delete(id: string): Promise<void>;

  /**
   * Add a session association to a task.
   * @param taskId - Task ID
   * @param sessionId - Session ID to add
   */
  addSession(taskId: string, sessionId: string): Promise<void>;

  /**
   * Remove a session association from a task.
   * @param taskId - Task ID
   * @param sessionId - Session ID to remove
   */
  removeSession(taskId: string, sessionId: string): Promise<void>;

  // NOTE: addTimelineEvent removed - timeline is now on Session

  /**
   * Check if project has any tasks.
   * @param projectId - Project ID
   * @returns true if project has tasks
   */
  existsByProjectId(projectId: string): Promise<boolean>;

  /**
   * Count total tasks.
   * @returns Number of tasks
   */
  count(): Promise<number>;
}
