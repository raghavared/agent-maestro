import { Mail, CreateMailPayload } from '../../types';

export interface IMailRepository {
  initialize(): Promise<void>;
  send(payload: CreateMailPayload, parentSessionId: string): Promise<Mail>;
  findUnread(toSessionId: string, parentSessionId: string): Promise<Mail[]>;
  markRead(mailId: string, parentSessionId: string): Promise<void>;
}
