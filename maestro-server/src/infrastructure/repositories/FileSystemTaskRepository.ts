import * as fs from 'fs/promises';
import * as path from 'path';
import { Task, TaskStatus, CreateTaskPayload, UpdateTaskPayload } from '../../types';
import { ITaskRepository, TaskFilter } from '../../domain/repositories/ITaskRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';

/**
 * File system based implementation of ITaskRepository.
 * Stores tasks as JSON files organized by project.
 */
export class FileSystemTaskRepository implements ITaskRepository {
  private tasksDir: string;
  private tasks: Map<string, Task>;
  private initialized: boolean = false;

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.tasksDir = path.join(dataDir, 'tasks');
    this.tasks = new Map();
  }

  /**
   * Initialize the repository by loading existing data.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.tasksDir, { recursive: true });

      // Read all project directories
      const entries = await fs.readdir(this.tasksDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Load tasks from project directory
          const projectTasksDir = path.join(this.tasksDir, entry.name);
          const taskFiles = await fs.readdir(projectTasksDir);

          for (const file of taskFiles.filter(f => f.endsWith('.json'))) {
            await this.loadTaskFile(path.join(projectTasksDir, file));
          }
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          // Handle legacy tasks in root tasks directory
          await this.loadTaskFile(path.join(this.tasksDir, entry.name));
        }
      }

      this.logger.info(`Loaded ${this.tasks.size} tasks`);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize task repository:', err as Error);
      throw err;
    }
  }

  private async loadTaskFile(filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const task = JSON.parse(data) as Task;

      // Initialize Phase IV-A fields if missing
      if (!task.sessionIds) task.sessionIds = [];
      if (!task.skillIds) task.skillIds = [];
      if (!task.agentIds) task.agentIds = [];
      if (!task.referenceTaskIds) task.referenceTaskIds = [];
      // NOTE: timeline removed from Task - now lives on Session

      // Migrate legacy sessionStatus -> taskSessionStatuses
      if ((task as any).sessionStatus && !task.taskSessionStatuses) {
        if (task.sessionIds.length > 0) {
          task.taskSessionStatuses = { [task.sessionIds[0]]: (task as any).sessionStatus };
        }
        delete (task as any).sessionStatus;
      }
      if (!task.taskSessionStatuses) task.taskSessionStatuses = {};

      this.tasks.set(task.id, task);
    } catch (err) {
      this.logger.warn(`Failed to load task file: ${filePath}`, { error: (err as Error).message });
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveTask(task: Task): Promise<void> {
    const projectTasksDir = path.join(this.tasksDir, task.projectId);
    await fs.mkdir(projectTasksDir, { recursive: true });
    const filePath = path.join(projectTasksDir, `${task.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(task, null, 2));
  }

  private async deleteTaskFile(task: Task): Promise<void> {
    const filePath = path.join(this.tasksDir, task.projectId, `${task.id}.json`);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  }

  async create(input: CreateTaskPayload): Promise<Task> {
    await this.ensureInitialized();

    const task: Task = {
      id: this.idGenerator.generate('task'),
      projectId: input.projectId,
      parentId: input.parentId || null,
      title: input.title,
      description: input.description || '',
      status: 'todo' as TaskStatus,
      priority: input.priority || 'medium',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      initialPrompt: input.initialPrompt || '',
      sessionIds: [],
      skillIds: input.skillIds || [],
      agentIds: [],
      dependencies: [],
      referenceTaskIds: input.referenceTaskIds || [],
      teamMemberId: input.teamMemberId,
      // NOTE: timeline is now on Session, not Task
    };

    this.tasks.set(task.id, task);
    await this.saveTask(task);

    this.logger.debug(`Created task: ${task.id}`);
    return task;
  }

  async findById(id: string): Promise<Task | null> {
    await this.ensureInitialized();
    return this.tasks.get(id) || null;
  }

  async findByProjectId(projectId: string): Promise<Task[]> {
    await this.ensureInitialized();
    return Array.from(this.tasks.values()).filter(t => t.projectId === projectId);
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    await this.ensureInitialized();
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  async findByParentId(parentId: string | null): Promise<Task[]> {
    await this.ensureInitialized();
    return Array.from(this.tasks.values()).filter(t => t.parentId === parentId);
  }

  async findBySessionId(sessionId: string): Promise<Task[]> {
    await this.ensureInitialized();
    return Array.from(this.tasks.values()).filter(t => t.sessionIds.includes(sessionId));
  }

  async findAll(filter?: TaskFilter): Promise<Task[]> {
    await this.ensureInitialized();
    let tasks = Array.from(this.tasks.values());

    if (filter) {
      if (filter.projectId) {
        tasks = tasks.filter(t => t.projectId === filter.projectId);
      }
      if (filter.status) {
        tasks = tasks.filter(t => t.status === filter.status);
      }
      if (filter.parentId !== undefined) {
        tasks = tasks.filter(t => t.parentId === filter.parentId);
      }
      if (filter.sessionId) {
        tasks = tasks.filter(t => t.sessionIds.includes(filter.sessionId!));
      }
    }

    return tasks;
  }

  async update(id: string, updates: UpdateTaskPayload): Promise<Task> {
    await this.ensureInitialized();

    const task = this.tasks.get(id);
    if (!task) {
      throw new NotFoundError('Task', id);
    }

    // Apply updates
    if (updates.title !== undefined) task.title = updates.title;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.sessionIds !== undefined) task.sessionIds = updates.sessionIds;
    if (updates.skillIds !== undefined) task.skillIds = updates.skillIds;
    if (updates.agentIds !== undefined) task.agentIds = updates.agentIds;
    if (updates.taskSessionStatuses !== undefined) {
      task.taskSessionStatuses = { ...(task.taskSessionStatuses || {}), ...updates.taskSessionStatuses };
    }
    if (updates.referenceTaskIds !== undefined) task.referenceTaskIds = updates.referenceTaskIds;
    if (updates.pinned !== undefined) task.pinned = updates.pinned;
    if (updates.teamMemberId !== undefined) task.teamMemberId = updates.teamMemberId;

    // Handle status changes
    if (updates.status !== undefined) {
      task.status = updates.status;
      if (updates.status === 'in_progress' && !task.startedAt) {
        task.startedAt = Date.now();
      }
      if (updates.status === 'completed' && !task.completedAt) {
        task.completedAt = Date.now();
      }
    }

    // NOTE: timeline is now on Session, not Task

    task.updatedAt = Date.now();

    this.tasks.set(id, task);
    await this.saveTask(task);

    this.logger.debug(`Updated task: ${id}`);
    return task;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    const task = this.tasks.get(id);
    if (!task) {
      throw new NotFoundError('Task', id);
    }

    this.tasks.delete(id);
    await this.deleteTaskFile(task);

    this.logger.debug(`Deleted task: ${id}`);
  }

  async addSession(taskId: string, sessionId: string): Promise<void> {
    await this.ensureInitialized();

    const task = this.tasks.get(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    if (!task.sessionIds.includes(sessionId)) {
      task.sessionIds.push(sessionId);
      task.updatedAt = Date.now();
      this.tasks.set(taskId, task);
      await this.saveTask(task);
    }
  }

  async removeSession(taskId: string, sessionId: string): Promise<void> {
    await this.ensureInitialized();

    const task = this.tasks.get(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    task.sessionIds = task.sessionIds.filter(id => id !== sessionId);
    task.updatedAt = Date.now();
    this.tasks.set(taskId, task);
    await this.saveTask(task);
  }

  // NOTE: addTimelineEvent removed - timeline is now on Session

  async existsByProjectId(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    return Array.from(this.tasks.values()).some(t => t.projectId === projectId);
  }

  async count(): Promise<number> {
    await this.ensureInitialized();
    return this.tasks.size;
  }
}
