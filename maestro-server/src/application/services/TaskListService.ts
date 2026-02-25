import { TaskList, CreateTaskListPayload, UpdateTaskListPayload } from '../../types';
import { ITaskListRepository, TaskListFilter } from '../../domain/repositories/ITaskListRepository';
import { IProjectRepository } from '../../domain/repositories/IProjectRepository';
import { ITaskRepository } from '../../domain/repositories/ITaskRepository';
import { IEventBus } from '../../domain/events/IEventBus';
import { ValidationError, NotFoundError } from '../../domain/common/Errors';

/**
 * Application service for task list operations.
 */
export class TaskListService {
  constructor(
    private taskListRepo: ITaskListRepository,
    private projectRepo: IProjectRepository,
    private taskRepo: ITaskRepository,
    private eventBus: IEventBus
  ) {}

  async createTaskList(input: CreateTaskListPayload): Promise<TaskList> {
    if (!input.projectId) {
      throw new ValidationError('Project ID is required');
    }
    if (!input.name || input.name.trim() === '') {
      throw new ValidationError('Task list name is required');
    }

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('Project', input.projectId);
    }

    const orderedTaskIds = input.orderedTaskIds ?? [];
    await this.validateTaskIds(input.projectId, orderedTaskIds);

    const taskList = await this.taskListRepo.create({
      ...input,
      name: input.name.trim(),
      orderedTaskIds,
    });

    await this.eventBus.emit('task_list:created', taskList);
    return taskList;
  }

  async getTaskList(id: string): Promise<TaskList> {
    const taskList = await this.taskListRepo.findById(id);
    if (!taskList) {
      throw new NotFoundError('Task list', id);
    }
    return taskList;
  }

  async listTaskLists(filter?: TaskListFilter): Promise<TaskList[]> {
    return this.taskListRepo.findAll(filter);
  }

  async listTaskListsByProject(projectId: string): Promise<TaskList[]> {
    return this.taskListRepo.findByProjectId(projectId);
  }

  async updateTaskList(id: string, updates: UpdateTaskListPayload): Promise<TaskList> {
    if (updates.name !== undefined && updates.name.trim() === '') {
      throw new ValidationError('Task list name cannot be empty');
    }

    const existing = await this.taskListRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Task list', id);
    }

    if (updates.orderedTaskIds !== undefined) {
      await this.validateTaskIds(existing.projectId, updates.orderedTaskIds);
    }

    const nextUpdates: UpdateTaskListPayload = { ...updates };
    if (updates.name !== undefined) {
      nextUpdates.name = updates.name.trim();
    }

    const taskList = await this.taskListRepo.update(id, nextUpdates);
    await this.eventBus.emit('task_list:updated', taskList);
    return taskList;
  }

  async reorderTaskList(id: string, orderedTaskIds: string[]): Promise<TaskList> {
    const existing = await this.taskListRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Task list', id);
    }

    await this.validateTaskIds(existing.projectId, orderedTaskIds);

    const taskList = await this.taskListRepo.update(id, { orderedTaskIds });
    await this.eventBus.emit('task_list:reordered', taskList);
    return taskList;
  }

  async addTaskToList(listId: string, taskId: string): Promise<TaskList> {
    const existing = await this.taskListRepo.findById(listId);
    if (!existing) {
      throw new NotFoundError('Task list', listId);
    }

    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    if (task.projectId !== existing.projectId) {
      throw new ValidationError(`Task ${taskId} does not belong to project ${existing.projectId}`);
    }

    if (existing.orderedTaskIds.includes(taskId)) {
      return existing;
    }

    const orderedTaskIds = [...existing.orderedTaskIds, taskId];
    const taskList = await this.taskListRepo.update(listId, { orderedTaskIds });
    await this.eventBus.emit('task_list:updated', taskList);
    return taskList;
  }

  async removeTaskFromList(listId: string, taskId: string): Promise<TaskList> {
    const existing = await this.taskListRepo.findById(listId);
    if (!existing) {
      throw new NotFoundError('Task list', listId);
    }

    const orderedTaskIds = existing.orderedTaskIds.filter((id) => id !== taskId);
    if (orderedTaskIds.length === existing.orderedTaskIds.length) {
      return existing;
    }

    const taskList = await this.taskListRepo.update(listId, { orderedTaskIds });
    await this.eventBus.emit('task_list:updated', taskList);
    return taskList;
  }

  async deleteTaskList(id: string): Promise<void> {
    const existing = await this.taskListRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Task list', id);
    }

    await this.taskListRepo.delete(id);
    await this.eventBus.emit('task_list:deleted', { id });
  }

  private async validateTaskIds(projectId: string, orderedTaskIds: string[]): Promise<void> {
    if (!Array.isArray(orderedTaskIds)) {
      throw new ValidationError('orderedTaskIds must be an array');
    }

    const seen = new Set<string>();
    for (const taskId of orderedTaskIds) {
      if (seen.has(taskId)) {
        throw new ValidationError(`Duplicate taskId in orderedTaskIds: ${taskId}`);
      }
      seen.add(taskId);

      const task = await this.taskRepo.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task', taskId);
      }
      if (task.projectId !== projectId) {
        throw new ValidationError(`Task ${taskId} does not belong to project ${projectId}`);
      }
    }
  }
}
