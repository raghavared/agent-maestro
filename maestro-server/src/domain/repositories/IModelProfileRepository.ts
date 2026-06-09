import { ModelProfile } from '../../types';

export interface IModelProfileRepository {
  findAll(): Promise<ModelProfile[]>;
  findById(id: string): Promise<ModelProfile | null>;
  create(profile: ModelProfile): Promise<ModelProfile>;
  update(id: string, data: Partial<ModelProfile>): Promise<ModelProfile>;
  delete(id: string): Promise<void>;
  initialize(): Promise<void>;
}
