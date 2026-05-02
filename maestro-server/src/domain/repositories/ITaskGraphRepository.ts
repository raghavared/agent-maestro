import { TaskGraph, CreateTaskGraphPayload, UpdateTaskGraphPayload } from '../../types';

export interface TaskGraphFilter {
  projectId?: string;
  status?: string;
}

export interface ITaskGraphRepository {
  initialize(): Promise<void>;
  create(input: CreateTaskGraphPayload): Promise<TaskGraph>;
  findById(id: string): Promise<TaskGraph | null>;
  findByProjectId(projectId: string): Promise<TaskGraph[]>;
  findAll(filter?: TaskGraphFilter): Promise<TaskGraph[]>;
  update(id: string, updates: UpdateTaskGraphPayload): Promise<TaskGraph>;
  delete(id: string): Promise<void>;
  existsByProjectId(projectId: string): Promise<boolean>;
  count(): Promise<number>;
}
