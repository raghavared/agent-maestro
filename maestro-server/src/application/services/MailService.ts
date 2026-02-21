import { IMailRepository } from '../../domain/repositories/IMailRepository';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IEventBus } from '../../domain/events/IEventBus';
import { Mail } from '../../types';
import { NotFoundError } from '../../domain/common/Errors';

export class MailService {
  constructor(
    private mailRepo: IMailRepository,
    private sessionRepo: ISessionRepository,
    private eventBus: IEventBus
  ) {}

  async notify(payload: {
    fromSessionId: string;
    fromName: string;
    toSessionId: string;
    message: string;
    detail?: string;
  }): Promise<Mail> {
    const targetSession = await this.sessionRepo.findById(payload.toSessionId);
    if (!targetSession) {
      throw new NotFoundError('Session', payload.toSessionId);
    }
    const parentSessionId = targetSession.parentSessionId || payload.toSessionId;

    const mail = await this.mailRepo.send({
      fromSessionId: payload.fromSessionId,
      fromName: payload.fromName,
      toSessionId: payload.toSessionId,
      message: payload.message,
      detail: payload.detail,
    }, parentSessionId);

    const trimmedMsg = payload.message.trim();
    const ptyContent = `[From: ${payload.fromName} (${payload.fromSessionId})] ${trimmedMsg} — mail stored, run: maestro session mail read`;
    await this.eventBus.emit('session:prompt_send', {
      sessionId: payload.toSessionId,
      content: ptyContent,
      mode: 'send',
      senderSessionId: payload.fromSessionId,
    });

    return mail;
  }

  async readMail(toSessionId: string, parentSessionId: string): Promise<Mail[]> {
    const unread = await this.mailRepo.findUnread(toSessionId, parentSessionId);
    await Promise.all(unread.map(m => this.mailRepo.markRead(m.id, parentSessionId)));
    return unread;
  }
}
