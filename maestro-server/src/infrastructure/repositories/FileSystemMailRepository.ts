import * as fs from 'fs/promises';
import * as path from 'path';
import { MailMessage, MailFilter } from '../../types';
import { IMailRepository } from '../../domain/repositories/IMailRepository';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';

/**
 * File system based implementation of IMailRepository.
 * Stores mail messages as individual JSON files in ~/.maestro/data/mail/.
 */
export class FileSystemMailRepository implements IMailRepository {
  private mailDir: string;
  private messages: Map<string, MailMessage>;
  private initialized: boolean = false;

  constructor(
    private dataDir: string,
    private logger: ILogger
  ) {
    this.mailDir = path.join(dataDir, 'mail');
    this.messages = new Map();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.mailDir, { recursive: true });

      const files = await fs.readdir(this.mailDir);
      const mailFiles = files.filter(f => f.endsWith('.json'));

      for (const file of mailFiles) {
        try {
          const data = await fs.readFile(path.join(this.mailDir, file), 'utf-8');
          const mail = JSON.parse(data) as MailMessage;
          this.messages.set(mail.id, mail);
        } catch (err) {
          this.logger.warn(`Failed to load mail file: ${file}`, { error: (err as Error).message });
        }
      }

      this.logger.info(`Loaded ${this.messages.size} mail messages`);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize mail repository:', err as Error);
      throw err;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveMessage(mail: MailMessage): Promise<void> {
    const filePath = path.join(this.mailDir, `${mail.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(mail, null, 2));
  }

  private async deleteMessageFile(id: string): Promise<void> {
    const filePath = path.join(this.mailDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async create(mail: MailMessage): Promise<MailMessage> {
    await this.ensureInitialized();

    this.messages.set(mail.id, mail);
    await this.saveMessage(mail);

    this.logger.debug(`Created mail: ${mail.id} (${mail.type}) from ${mail.fromSessionId} to ${mail.toSessionId || 'broadcast'}`);
    return mail;
  }

  async findById(id: string): Promise<MailMessage | null> {
    await this.ensureInitialized();
    return this.messages.get(id) || null;
  }

  async findAll(filter?: MailFilter): Promise<MailMessage[]> {
    await this.ensureInitialized();

    let results = Array.from(this.messages.values());

    if (filter?.type) {
      results = results.filter(m => m.type === filter.type);
    }
    if (filter?.since) {
      results = results.filter(m => m.createdAt > filter.since!);
    }

    return results.sort((a, b) => a.createdAt - b.createdAt);
  }

  async findInbox(sessionId: string, projectId: string, filter?: MailFilter): Promise<MailMessage[]> {
    await this.ensureInitialized();

    let results = Array.from(this.messages.values()).filter(m =>
      m.projectId === projectId &&
      (m.toSessionId === sessionId || m.toSessionId === null)
    );

    if (filter?.type) {
      results = results.filter(m => m.type === filter.type);
    }
    if (filter?.since) {
      results = results.filter(m => m.createdAt > filter.since!);
    }

    return results.sort((a, b) => a.createdAt - b.createdAt);
  }

  async findSince(sessionId: string, projectId: string, since: number): Promise<MailMessage[]> {
    return this.findInbox(sessionId, projectId, { since });
  }

  async findByThreadId(threadId: string): Promise<MailMessage[]> {
    await this.ensureInitialized();
    return Array.from(this.messages.values())
      .filter(m => (m as any).threadId === threadId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.messages.has(id)) {
      throw new NotFoundError('Mail', id);
    }

    this.messages.delete(id);
    await this.deleteMessageFile(id);

    this.logger.debug(`Deleted mail: ${id}`);
  }

  async count(sessionId: string, projectId: string): Promise<number> {
    await this.ensureInitialized();

    return Array.from(this.messages.values()).filter(m =>
      m.projectId === projectId &&
      (m.toSessionId === sessionId || m.toSessionId === null)
    ).length;
  }
}
