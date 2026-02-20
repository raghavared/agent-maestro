import { TaskList, CreateTaskListPayload, UpdateTaskListPayload } from '../../types';

export interface TaskListFilter {
  projectId?: string;
}

export interface ITaskListRepository {
  initialize(): Promise<void>;
  create(input: CreateTaskListPayload): Promise<TaskList>;
  findById(id: string): Promise<TaskList | null>;
  findByProjectId(projectId: string): Promise<TaskList[]>;
  findAll(filter?: TaskListFilter): Promise<TaskList[]>;
  update(id: string, updates: UpdateTaskListPayload): Promise<TaskList>;
  delete(id: string): Promise<void>;
  removeTaskReferences(taskId: string): Promise<void>;
  existsByProjectId(projectId: string): Promise<boolean>;
  count(): Promise<number>;
}
