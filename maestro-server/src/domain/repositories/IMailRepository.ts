import { MailMessage, MailFilter } from '../../types';

/**
 * Repository interface for Mail persistence operations.
 */
export interface IMailRepository {
  /**
   * Create (store) a new mail message.
   */
  create(mail: MailMessage): Promise<MailMessage>;

  /**
   * Find a mail message by ID.
   */
  findById(id: string): Promise<MailMessage | null>;

  /**
   * Find all mail messages (optionally filtered).
   */
  findAll(filter?: MailFilter): Promise<MailMessage[]>;

  /**
   * Find inbox for a session (messages addressed to this session or broadcast).
   */
  findInbox(sessionId: string, projectId: string, filter?: MailFilter): Promise<MailMessage[]>;

  /**
   * Find messages since a given timestamp for a session.
   */
  findSince(sessionId: string, projectId: string, since: number): Promise<MailMessage[]>;

  /**
   * Find all messages in a thread by threadId.
   */
  findByThreadId(threadId: string): Promise<MailMessage[]>;

  /**
   * Delete a mail message.
   */
  delete(id: string): Promise<void>;

  /**
   * Count messages in inbox for a session.
   */
  count(sessionId: string, projectId: string): Promise<number>;

  /**
   * Initialize the repository.
   */
  initialize(): Promise<void>;
}
