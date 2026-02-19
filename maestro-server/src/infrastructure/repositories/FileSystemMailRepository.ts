import * as fs from 'fs/promises';
import * as path from 'path';
import { IMailRepository } from '../../domain/repositories/IMailRepository';
import { Mail, CreateMailPayload } from '../../types';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';

export class FileSystemMailRepository implements IMailRepository {
  private mailDir: string;
  private mails: Map<string, Mail> = new Map();

  constructor(private dataDir: string, private idGenerator: IIdGenerator, private logger: ILogger) {
    this.mailDir = path.join(dataDir, 'mail');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.mailDir, { recursive: true });
    // Load all parentSessionId subdirs and their message files
    try {
      const parentDirs = await fs.readdir(this.mailDir);
      for (const parentDir of parentDirs) {
        const parentPath = path.join(this.mailDir, parentDir);
        const stat = await fs.stat(parentPath);
        if (!stat.isDirectory()) continue;
        const files = await fs.readdir(parentPath);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const content = await fs.readFile(path.join(parentPath, file), 'utf-8');
            const mail: Mail = JSON.parse(content);
            this.mails.set(mail.id, mail);
          } catch (err) {
            this.logger.error(`Failed to load mail file ${file}:`, err instanceof Error ? err : new Error(String(err)));
          }
        }
      }
    } catch (err) {
      // mailDir may not exist yet — that's fine
    }
    this.logger.info(`MailRepository initialized with ${this.mails.size} messages`);
  }

  async send(payload: CreateMailPayload, parentSessionId: string): Promise<Mail> {
    const mail: Mail = {
      id: this.idGenerator.generate('mail'),
      parentSessionId,
      fromSessionId: payload.fromSessionId,
      fromName: payload.fromName,
      toSessionId: payload.toSessionId,
      message: payload.message,
      detail: payload.detail,
      createdAt: Date.now(),
    };
    this.mails.set(mail.id, mail);
    const dir = path.join(this.mailDir, parentSessionId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${mail.id}.json`), JSON.stringify(mail, null, 2));
    return mail;
  }

  async findUnread(toSessionId: string, parentSessionId: string): Promise<Mail[]> {
    return Array.from(this.mails.values()).filter(
      m => m.toSessionId === toSessionId && m.parentSessionId === parentSessionId && !m.readAt
    );
  }

  async markRead(mailId: string, parentSessionId: string): Promise<void> {
    const mail = this.mails.get(mailId);
    if (!mail) return;
    mail.readAt = Date.now();
    const dir = path.join(this.mailDir, parentSessionId);
    await fs.writeFile(path.join(dir, `${mail.id}.json`), JSON.stringify(mail, null, 2));
  }
}
