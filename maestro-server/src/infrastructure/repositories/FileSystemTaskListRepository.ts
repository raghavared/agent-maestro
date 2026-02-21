import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskList, CreateTaskListPayload, UpdateTaskListPayload } from '../../types';
import { ITaskListRepository, TaskListFilter } from '../../domain/repositories/ITaskListRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';

/**
 * File system based implementation of ITaskListRepository.
 * Stores task lists as JSON files organized by project.
 */
export class FileSystemTaskListRepository implements ITaskListRepository {
  private taskListsDir: string;
  private taskLists: Map<string, TaskList>;
  private initialized: boolean = false;

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.taskListsDir = path.join(dataDir, 'task-lists');
    this.taskLists = new Map();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.taskListsDir, { recursive: true });

      const entries = await fs.readdir(this.taskListsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const projectDir = path.join(this.taskListsDir, entry.name);
        const listFiles = await fs.readdir(projectDir);
        for (const file of listFiles.filter(f => f.endsWith('.json'))) {
          await this.loadTaskListFile(path.join(projectDir, file));
        }
      }

      this.logger.info(`Loaded ${this.taskLists.size} task lists`);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize task list repository:', err as Error);
      throw err;
    }
  }

  private async loadTaskListFile(filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const taskList = JSON.parse(data) as TaskList;
      if (!taskList.orderedTaskIds) taskList.orderedTaskIds = [];
      this.taskLists.set(taskList.id, taskList);
    } catch (err) {
      this.logger.warn(`Failed to load task list file: ${filePath}`, { error: (err as Error).message });
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveTaskList(taskList: TaskList): Promise<void> {
    const projectDir = path.join(this.taskListsDir, taskList.projectId);
    await fs.mkdir(projectDir, { recursive: true });
    const filePath = path.join(projectDir, `${taskList.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(taskList, null, 2));
  }

  private async deleteTaskListFile(taskList: TaskList): Promise<void> {
    const filePath = path.join(this.taskListsDir, taskList.projectId, `${taskList.id}.json`);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async create(input: CreateTaskListPayload): Promise<TaskList> {
    await this.ensureInitialized();

    const taskList: TaskList = {
      id: this.idGenerator.generate('task_list'),
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      orderedTaskIds: input.orderedTaskIds ?? [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.taskLists.set(taskList.id, taskList);
    await this.saveTaskList(taskList);

    this.logger.debug(`Created task list: ${taskList.id}`);
    return taskList;
  }

  async findById(id: string): Promise<TaskList | null> {
    await this.ensureInitialized();
    return this.taskLists.get(id) || null;
  }

  async findByProjectId(projectId: string): Promise<TaskList[]> {
    await this.ensureInitialized();
    return Array.from(this.taskLists.values()).filter(t => t.projectId === projectId);
  }

  async findAll(filter?: TaskListFilter): Promise<TaskList[]> {
    await this.ensureInitialized();
    let lists = Array.from(this.taskLists.values());
    if (filter?.projectId) {
      lists = lists.filter(l => l.projectId === filter.projectId);
    }
    return lists;
  }

  async update(id: string, updates: UpdateTaskListPayload): Promise<TaskList> {
    await this.ensureInitialized();

    const taskList = this.taskLists.get(id);
    if (!taskList) {
      throw new NotFoundError('Task list', id);
    }

    if (updates.name !== undefined) taskList.name = updates.name;
    if (updates.description !== undefined) taskList.description = updates.description;
    if (updates.orderedTaskIds !== undefined) taskList.orderedTaskIds = updates.orderedTaskIds;

    taskList.updatedAt = Date.now();

    this.taskLists.set(id, taskList);
    await this.saveTaskList(taskList);

    this.logger.debug(`Updated task list: ${id}`);
    return taskList;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    const taskList = this.taskLists.get(id);
    if (!taskList) {
      throw new NotFoundError('Task list', id);
    }

    this.taskLists.delete(id);
    await this.deleteTaskListFile(taskList);

    this.logger.debug(`Deleted task list: ${id}`);
  }

  async removeTaskReferences(taskId: string): Promise<void> {
    await this.ensureInitialized();

    let updatedCount = 0;
    for (const taskList of this.taskLists.values()) {
      if (!taskList.orderedTaskIds.includes(taskId)) continue;

      taskList.orderedTaskIds = taskList.orderedTaskIds.filter(id => id !== taskId);
      taskList.updatedAt = Date.now();
      await this.saveTaskList(taskList);
      updatedCount++;
    }

    if (updatedCount > 0) {
      this.logger.debug(`Removed task ${taskId} from ${updatedCount} task list(s)`);
    }
  }

  async existsByProjectId(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    return Array.from(this.taskLists.values()).some(t => t.projectId === projectId);
  }

  async count(): Promise<number> {
    await this.ensureInitialized();
    return this.taskLists.size;
  }
}
