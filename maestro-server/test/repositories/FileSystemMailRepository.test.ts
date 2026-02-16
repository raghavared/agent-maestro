import { FileSystemMailRepository } from '../../src/infrastructure/repositories/FileSystemMailRepository';
import { MailMessage } from '../../src/types';
import { TestDataDir } from '../helpers';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

function createMail(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: `mail_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    projectId: 'proj_test',
    fromSessionId: 'sess_sender',
    toSessionId: 'sess_receiver',
    replyToMailId: null,
    type: 'notification',
    subject: 'Test mail',
    body: { message: 'hello' },
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('FileSystemMailRepository', () => {
  let repo: FileSystemMailRepository;
  let testDataDir: TestDataDir;

  beforeEach(async () => {
    testDataDir = new TestDataDir();
    repo = new FileSystemMailRepository(testDataDir.getPath(), mockLogger as any);
    await repo.initialize();
  });

  afterEach(async () => {
    await testDataDir.cleanup();
  });

  describe('create', () => {
    it('should create and persist a mail message', async () => {
      const mail = createMail();
      const result = await repo.create(mail);

      expect(result).toEqual(mail);

      const found = await repo.findById(mail.id);
      expect(found).toEqual(mail);
    });
  });

  describe('findById', () => {
    it('should return null for non-existent mail', async () => {
      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findInbox', () => {
    it('should return messages addressed to session', async () => {
      const m1 = createMail({ toSessionId: 'sess_a', projectId: 'proj_1' });
      const m2 = createMail({ toSessionId: 'sess_b', projectId: 'proj_1' });
      const m3 = createMail({ toSessionId: null, projectId: 'proj_1' }); // broadcast

      await repo.create(m1);
      await repo.create(m2);
      await repo.create(m3);

      const inbox = await repo.findInbox('sess_a', 'proj_1');
      expect(inbox).toHaveLength(2); // m1 (direct) + m3 (broadcast)
      expect(inbox.map(m => m.id)).toContain(m1.id);
      expect(inbox.map(m => m.id)).toContain(m3.id);
    });

    it('should filter by type', async () => {
      const m1 = createMail({ toSessionId: 'sess_a', projectId: 'proj_1', type: 'query' });
      const m2 = createMail({ toSessionId: 'sess_a', projectId: 'proj_1', type: 'directive' });

      await repo.create(m1);
      await repo.create(m2);

      const inbox = await repo.findInbox('sess_a', 'proj_1', { type: 'query' });
      expect(inbox).toHaveLength(1);
      expect(inbox[0].type).toBe('query');
    });

    it('should filter by since timestamp', async () => {
      const now = Date.now();
      const m1 = createMail({ toSessionId: 'sess_a', projectId: 'proj_1', createdAt: now - 1000 });
      const m2 = createMail({ toSessionId: 'sess_a', projectId: 'proj_1', createdAt: now + 1000 });

      await repo.create(m1);
      await repo.create(m2);

      const inbox = await repo.findInbox('sess_a', 'proj_1', { since: now });
      expect(inbox).toHaveLength(1);
      expect(inbox[0].id).toBe(m2.id);
    });
  });

  describe('findSince', () => {
    it('should return messages since timestamp', async () => {
      const now = Date.now();
      const m1 = createMail({ toSessionId: 'sess_a', projectId: 'proj_1', createdAt: now - 500 });
      const m2 = createMail({ toSessionId: 'sess_a', projectId: 'proj_1', createdAt: now + 500 });

      await repo.create(m1);
      await repo.create(m2);

      const result = await repo.findSince('sess_a', 'proj_1', now);
      expect(result).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('should delete a mail message', async () => {
      const mail = createMail();
      await repo.create(mail);

      await repo.delete(mail.id);

      const found = await repo.findById(mail.id);
      expect(found).toBeNull();
    });

    it('should throw NotFoundError for non-existent mail', async () => {
      await expect(repo.delete('nonexistent')).rejects.toThrow();
    });
  });

  describe('count', () => {
    it('should count inbox messages', async () => {
      await repo.create(createMail({ toSessionId: 'sess_a', projectId: 'proj_1' }));
      await repo.create(createMail({ toSessionId: 'sess_a', projectId: 'proj_1' }));
      await repo.create(createMail({ toSessionId: 'sess_b', projectId: 'proj_1' }));

      const count = await repo.count('sess_a', 'proj_1');
      expect(count).toBe(2);
    });
  });

  describe('persistence', () => {
    it('should reload messages from disk after re-initialization', async () => {
      const mail = createMail();
      await repo.create(mail);

      // Create a new repo instance pointing to the same data dir
      const repo2 = new FileSystemMailRepository(testDataDir.getPath(), mockLogger as any);
      await repo2.initialize();

      const found = await repo2.findById(mail.id);
      expect(found).toEqual(mail);
    });
  });
});
