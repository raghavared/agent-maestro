import { CustomPrompt } from '../../types';

export interface ICustomPromptRepository {
  findAll(): Promise<CustomPrompt[]>;
  findById(id: string): Promise<CustomPrompt | null>;
  create(prompt: CustomPrompt): Promise<CustomPrompt>;
  update(id: string, data: Partial<CustomPrompt>): Promise<CustomPrompt>;
  delete(id: string): Promise<void>;
  initialize(): Promise<void>;
}
