import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskList, CreateTaskListPayload, UpdateTaskListPayload } from '../../types';
import { ITaskListRepository, TaskListFilter } from '../../domain/repositories/ITaskListRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';
import { atomicWriteFile } from './utils/atomicWrite';
import { loadFilesParallel } from './utils/parallelFileLoader';

/**
 * File system based implementation of ITaskListRepository.
 * Stores task lists as JSON files organized by project.
 */
export class FileSystemTaskListRepository implements ITaskListRepository {
  private taskListsDir: string;
  private taskLists: Map<string, TaskList>;
  private initialized: boolean = false;

  // Phase 2: Secondary indexes
  private projectTaskListIndex: Map<string, Set<string>> = new Map();
  private taskToTaskListIndex: Map<string, Set<string>> = new Map();

  // Phase 3: ensureDir cache
  private createdDirs: Set<string> = new Set();

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.taskListsDir = path.join(dataDir, 'task-lists');
    this.taskLists = new Map();
  }

  private async ensureDir(dirPath: string): Promise<void> {
    if (this.createdDirs.has(dirPath)) return;
    await fs.mkdir(dirPath, { recursive: true });
    this.createdDirs.add(dirPath);
  }

  // --- Secondary index helpers ---

  private indexTaskList(taskList: TaskList): void {
    if (!this.projectTaskListIndex.has(taskList.projectId)) {
      this.projectTaskListIndex.set(taskList.projectId, new Set());
    }
    this.projectTaskListIndex.get(taskList.projectId)!.add(taskList.id);

    for (const taskId of taskList.orderedTaskIds) {
      if (!this.taskToTaskListIndex.has(taskId)) {
        this.taskToTaskListIndex.set(taskId, new Set());
      }
      this.taskToTaskListIndex.get(taskId)!.add(taskList.id);
    }
  }

  private unindexTaskList(taskList: TaskList): void {
    this.projectTaskListIndex.get(taskList.projectId)?.delete(taskList.id);
    if (this.projectTaskListIndex.get(taskList.projectId)?.size === 0) {
      this.projectTaskListIndex.delete(taskList.projectId);
    }
    for (const taskId of taskList.orderedTaskIds) {
      this.taskToTaskListIndex.get(taskId)?.delete(taskList.id);
      if (this.taskToTaskListIndex.get(taskId)?.size === 0) {
        this.taskToTaskListIndex.delete(taskId);
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.ensureDir(this.taskListsDir);

      const entries = await fs.readdir(this.taskListsDir, { withFileTypes: true });

      // Collect all file paths
      const filePaths: string[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const projectDir = path.join(this.taskListsDir, entry.name);
        this.createdDirs.add(projectDir);
        const listFiles = await fs.readdir(projectDir);
        for (const file of listFiles.filter(f => f.endsWith('.json'))) {
          filePaths.push(path.join(projectDir, file));
        }
      }

      // Load in parallel
      const { successes, failures } = await loadFilesParallel(
        filePaths,
        async (filePath) => {
          const data = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(data) as TaskList;
        },
        { concurrency: 50 }
      );

      for (const failure of failures) {
        this.logger.warn(`Failed to load task list file: ${failure.path}`, { error: failure.error.message });
      }

      for (const taskList of successes) {
        if (!taskList.orderedTaskIds) taskList.orderedTaskIds = [];
        this.taskLists.set(taskList.id, taskList);
        this.indexTaskList(taskList);
      }

      this.logger.info(`Loaded ${this.taskLists.size} task lists`);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize task list repository:', err as Error);
      throw err;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveTaskList(taskList: TaskList): Promise<void> {
    const projectDir = path.join(this.taskListsDir, taskList.projectId);
    await this.ensureDir(projectDir);
    const filePath = path.join(projectDir, `${taskList.id}.json`);
    await atomicWriteFile(filePath, JSON.stringify(taskList));
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
    this.indexTaskList(taskList);
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
    const taskListIds = this.projectTaskListIndex.get(projectId);
    if (!taskListIds) return [];
    const lists: TaskList[] = [];
    for (const id of taskListIds) {
      const tl = this.taskLists.get(id);
      if (tl) lists.push(tl);
    }
    return lists;
  }

  async findAll(filter?: TaskListFilter): Promise<TaskList[]> {
    await this.ensureInitialized();
    if (filter?.projectId) {
      return this.findByProjectId(filter.projectId);
    }
    return Array.from(this.taskLists.values());
  }

  async update(id: string, updates: UpdateTaskListPayload): Promise<TaskList> {
    await this.ensureInitialized();

    const taskList = this.taskLists.get(id);
    if (!taskList) {
      throw new NotFoundError('Task list', id);
    }

    // Unindex old state
    this.unindexTaskList(taskList);

    if (updates.name !== undefined) taskList.name = updates.name;
    if (updates.description !== undefined) taskList.description = updates.description;
    if (updates.orderedTaskIds !== undefined) taskList.orderedTaskIds = updates.orderedTaskIds;

    taskList.updatedAt = Date.now();

    this.taskLists.set(id, taskList);
    // Re-index new state
    this.indexTaskList(taskList);
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

    this.unindexTaskList(taskList);
    this.taskLists.delete(id);
    await this.deleteTaskListFile(taskList);

    this.logger.debug(`Deleted task list: ${id}`);
  }

  async removeTaskReferences(taskId: string): Promise<void> {
    await this.ensureInitialized();

    // Use taskToTaskListIndex to find only affected task lists
    const affectedIds = this.taskToTaskListIndex.get(taskId);
    if (!affectedIds?.size) return;

    let updatedCount = 0;
    for (const tlId of affectedIds) {
      const tl = this.taskLists.get(tlId);
      if (!tl) continue;

      tl.orderedTaskIds = tl.orderedTaskIds.filter(id => id !== taskId);
      tl.updatedAt = Date.now();
      await this.saveTaskList(tl);
      updatedCount++;
    }

    this.taskToTaskListIndex.delete(taskId);

    if (updatedCount > 0) {
      this.logger.debug(`Removed task ${taskId} from ${updatedCount} task list(s)`);
    }
  }

  async existsByProjectId(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    return (this.projectTaskListIndex.get(projectId)?.size ?? 0) > 0;
  }

  async count(): Promise<number> {
    await this.ensureInitialized();
    return this.taskLists.size;
  }
}
