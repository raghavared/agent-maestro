import * as fs from 'fs/promises';
import * as path from 'path';
import { CustomPrompt } from '../../types';
import { ICustomPromptRepository } from '../../domain/repositories/ICustomPromptRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';
import { atomicWriteFile } from './utils/atomicWrite';

export class FileSystemCustomPromptRepository implements ICustomPromptRepository {
  private promptsDir: string;
  private initialized: boolean = false;
  private cache: Map<string, CustomPrompt> = new Map();
  private cacheLoaded: boolean = false;

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.promptsDir = path.join(dataDir, 'custom-prompts');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await fs.mkdir(this.promptsDir, { recursive: true });
      this.logger.info('Custom prompt repository initialized');
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize custom prompt repository:', err as Error);
      throw err;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }

  private async loadAll(): Promise<void> {
    if (this.cacheLoaded) return;

    try {
      const files = await fs.readdir(this.promptsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const data = await fs.readFile(path.join(this.promptsDir, file), 'utf-8');
          const prompt = JSON.parse(data) as CustomPrompt;
          this.cache.set(prompt.id, prompt);
        } catch (err) {
          this.logger.warn(`Failed to load custom prompt file: ${file}`, {
            error: (err as Error).message
          });
        }
      }
    } catch (err) {
      // Directory may not exist yet
    }

    this.cacheLoaded = true;
  }

  async findAll(): Promise<CustomPrompt[]> {
    await this.ensureInitialized();
    await this.loadAll();
    return Array.from(this.cache.values());
  }

  async findById(id: string): Promise<CustomPrompt | null> {
    await this.ensureInitialized();

    const cached = this.cache.get(id);
    if (cached) return cached;

    // Try disk
    try {
      const filePath = path.join(this.promptsDir, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const prompt = JSON.parse(data) as CustomPrompt;
      this.cache.set(prompt.id, prompt);
      return prompt;
    } catch (err) {
      return null;
    }
  }

  async create(prompt: CustomPrompt): Promise<CustomPrompt> {
    await this.ensureInitialized();

    const filePath = path.join(this.promptsDir, `${prompt.id}.json`);
    await atomicWriteFile(filePath, JSON.stringify(prompt));

    this.cache.set(prompt.id, prompt);
    this.logger.debug(`Created custom prompt: ${prompt.id}`);
    return prompt;
  }

  async update(id: string, data: Partial<CustomPrompt>): Promise<CustomPrompt> {
    await this.ensureInitialized();

    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('CustomPrompt', id);

    const updated: CustomPrompt = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };

    const filePath = path.join(this.promptsDir, `${id}.json`);
    await atomicWriteFile(filePath, JSON.stringify(updated));

    this.cache.set(id, updated);
    this.logger.debug(`Updated custom prompt: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('CustomPrompt', id);

    const filePath = path.join(this.promptsDir, `${id}.json`);
    await fs.unlink(filePath);

    this.cache.delete(id);
    this.logger.debug(`Deleted custom prompt: ${id}`);
  }
}
