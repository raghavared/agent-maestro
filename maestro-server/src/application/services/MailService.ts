import { MailMessage, SendMailPayload, MailFilter } from '../../types';
import { IMailRepository } from '../../domain/repositories/IMailRepository';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IEventBus } from '../../domain/events/IEventBus';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { NotFoundError, ValidationError } from '../../domain/common/Errors';

/**
 * Application service for mail operations.
 * Handles sending, receiving, and waiting for mail messages.
 */
export class MailService {
  constructor(
    private mailRepo: IMailRepository,
    private eventBus: IEventBus,
    private idGenerator: IIdGenerator,
    private sessionRepo?: ISessionRepository
  ) {}

  /**
   * Send a mail message.
   * If toTeamMemberId is provided, resolves to active session IDs for that team member.
   */
  async sendMail(payload: SendMailPayload): Promise<MailMessage | MailMessage[]> {
    // Resolve toTeamMemberId to session IDs if provided
    if (payload.toTeamMemberId && !payload.toSessionId) {
      if (!this.sessionRepo) {
        throw new ValidationError('Session repository not available for team member resolution');
      }

      const sessions = await this.sessionRepo.findAll({
        projectId: payload.projectId,
      });

      // Find active sessions for this team member
      const targetSessions = sessions.filter(s =>
        s.teamMemberId === payload.toTeamMemberId &&
        ['working', 'idle', 'spawning'].includes(s.status)
      );

      if (targetSessions.length === 0) {
        throw new NotFoundError('Active session for team member', payload.toTeamMemberId);
      }

      // Send to each matching session
      const results: MailMessage[] = [];
      for (const session of targetSessions) {
        const mail = await this.createAndStoreMail({
          ...payload,
          toSessionId: session.id,
          toTeamMemberId: undefined,
        });
        results.push(mail);
      }
      return results.length === 1 ? results[0] : results;
    }

    return this.createAndStoreMail(payload);
  }

  /**
   * Create and store a single mail message.
   */
  private async createAndStoreMail(payload: SendMailPayload): Promise<MailMessage> {
    const id = this.idGenerator.generate('mail');

    const mail: MailMessage = {
      id,
      projectId: payload.projectId,
      fromSessionId: payload.fromSessionId,
      toSessionId: payload.toSessionId ?? null,
      replyToMailId: payload.replyToMailId ?? null,
      type: payload.type,
      subject: payload.subject,
      body: payload.body || {},
      createdAt: Date.now(),
    };

    const created = await this.mailRepo.create(mail);

    await this.eventBus.emit('mail:received', created);

    return created;
  }

  /**
   * Get inbox for a session.
   */
  async getInbox(sessionId: string, projectId: string, filter?: MailFilter): Promise<MailMessage[]> {
    return this.mailRepo.findInbox(sessionId, projectId, filter);
  }

  /**
   * Get a single mail message by ID.
   */
  async getMail(id: string): Promise<MailMessage> {
    const mail = await this.mailRepo.findById(id);
    if (!mail) {
      throw new NotFoundError('Mail', id);
    }
    return mail;
  }

  /**
   * Wait for new mail (long-poll).
   * Checks for existing messages since timestamp. If none, subscribes to mail:received
   * event bus. Resolves when matching message arrives or timeout expires.
   * Returns empty array on timeout.
   */
  async waitForMail(sessionId: string, projectId: string, options?: { timeout?: number; since?: number }): Promise<MailMessage[]> {
    const timeout = Math.min(options?.timeout || 30000, 120000);
    const since = options?.since || 0;

    // Check for existing messages first
    const existing = await this.mailRepo.findSince(sessionId, projectId, since);
    if (existing.length > 0) {
      return existing;
    }

    // Long-poll: wait for new mail
    return new Promise<MailMessage[]>((resolve) => {
      let resolved = false;

      const handler = (mail: MailMessage) => {
        if (resolved) return;
        if (mail.projectId !== projectId) return;
        if (mail.toSessionId !== null && mail.toSessionId !== sessionId) return;

        resolved = true;
        this.eventBus.off('mail:received', handler);
        clearTimeout(timer);
        resolve([mail]);
      };

      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        this.eventBus.off('mail:received', handler);
        resolve([]);
      }, timeout);

      this.eventBus.on('mail:received', handler);
    });
  }

  /**
   * Delete a mail message.
   */
  async deleteMail(id: string): Promise<void> {
    await this.mailRepo.delete(id);
    await this.eventBus.emit('mail:deleted', { id });
  }
}
