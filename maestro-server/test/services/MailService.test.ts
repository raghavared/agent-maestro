import { MailService } from '../../src/application/services/MailService';
import { MailMessage, SendMailPayload } from '../../src/types';

const mockMailRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findInbox: jest.fn(),
  findSince: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  initialize: jest.fn(),
};

const mockEventBus = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  removeAllListeners: jest.fn(),
};

let idCounter = 0;
const mockIdGenerator = {
  generate: jest.fn(() => `mail_${Date.now()}_test${idCounter++}`),
};

describe('MailService', () => {
  let service: MailService;

  beforeEach(() => {
    jest.clearAllMocks();
    idCounter = 0;
    service = new MailService(mockMailRepo as any, mockEventBus as any, mockIdGenerator as any);
  });

  describe('sendMail', () => {
    it('should create a mail message and emit event', async () => {
      const payload: SendMailPayload = {
        projectId: 'proj_1',
        fromSessionId: 'sess_sender',
        toSessionId: 'sess_receiver',
        type: 'notification',
        subject: 'Hello',
        body: { message: 'world' },
      };

      mockMailRepo.create.mockImplementation((mail: MailMessage) => Promise.resolve(mail));

      const result = await service.sendMail(payload);

      expect(result.projectId).toBe('proj_1');
      expect(result.fromSessionId).toBe('sess_sender');
      expect(result.toSessionId).toBe('sess_receiver');
      expect(result.type).toBe('notification');
      expect(result.subject).toBe('Hello');
      expect(result.body).toEqual({ message: 'world' });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();

      expect(mockMailRepo.create).toHaveBeenCalledTimes(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith('mail:received', result);
    });

    it('should set toSessionId to null for broadcast', async () => {
      const payload: SendMailPayload = {
        projectId: 'proj_1',
        fromSessionId: 'sess_sender',
        type: 'directive',
        subject: 'Broadcast',
      };

      mockMailRepo.create.mockImplementation((mail: MailMessage) => Promise.resolve(mail));

      const result = await service.sendMail(payload);

      expect(result.toSessionId).toBeNull();
      expect(result.replyToMailId).toBeNull();
      expect(result.body).toEqual({});
    });
  });

  describe('getInbox', () => {
    it('should delegate to repository', async () => {
      const messages: MailMessage[] = [];
      mockMailRepo.findInbox.mockResolvedValue(messages);

      const result = await service.getInbox('sess_1', 'proj_1');

      expect(mockMailRepo.findInbox).toHaveBeenCalledWith('sess_1', 'proj_1', undefined);
      expect(result).toEqual(messages);
    });

    it('should pass filter through', async () => {
      mockMailRepo.findInbox.mockResolvedValue([]);

      await service.getInbox('sess_1', 'proj_1', { type: 'query' });

      expect(mockMailRepo.findInbox).toHaveBeenCalledWith('sess_1', 'proj_1', { type: 'query' });
    });
  });

  describe('getMail', () => {
    it('should return mail by ID', async () => {
      const mail: MailMessage = {
        id: 'mail_123',
        projectId: 'proj_1',
        fromSessionId: 'sess_sender',
        toSessionId: 'sess_receiver',
        replyToMailId: null,
        type: 'notification',
        subject: 'Test',
        body: {},
        createdAt: Date.now(),
      };
      mockMailRepo.findById.mockResolvedValue(mail);

      const result = await service.getMail('mail_123');
      expect(result).toEqual(mail);
    });

    it('should throw NotFoundError for non-existent mail', async () => {
      mockMailRepo.findById.mockResolvedValue(null);

      await expect(service.getMail('nonexistent')).rejects.toThrow();
    });
  });

  describe('waitForMail', () => {
    it('should return existing messages if found', async () => {
      const messages: MailMessage[] = [{
        id: 'mail_1',
        projectId: 'proj_1',
        fromSessionId: 'sess_sender',
        toSessionId: 'sess_receiver',
        replyToMailId: null,
        type: 'notification',
        subject: 'Test',
        body: {},
        createdAt: Date.now(),
      }];
      mockMailRepo.findSince.mockResolvedValue(messages);

      const result = await service.waitForMail('sess_receiver', 'proj_1', { since: 0 });

      expect(result).toEqual(messages);
    });

    it('should return empty array on timeout when no messages arrive', async () => {
      mockMailRepo.findSince.mockResolvedValue([]);

      const result = await service.waitForMail('sess_receiver', 'proj_1', { timeout: 100, since: 0 });

      expect(result).toEqual([]);
    }, 5000);

    it('should return new mail when it arrives during wait', async () => {
      mockMailRepo.findSince.mockResolvedValue([]);

      const newMail: MailMessage = {
        id: 'mail_new',
        projectId: 'proj_1',
        fromSessionId: 'sess_sender',
        toSessionId: 'sess_receiver',
        replyToMailId: null,
        type: 'notification',
        subject: 'New Mail',
        body: {},
        createdAt: Date.now(),
      };

      // Capture the handler registered on eventBus.on
      let capturedHandler: any;
      mockEventBus.on.mockImplementation((event: string, handler: any) => {
        if (event === 'mail:received') {
          capturedHandler = handler;
        }
      });

      const waitPromise = service.waitForMail('sess_receiver', 'proj_1', { timeout: 5000, since: 0 });

      // Simulate mail arriving after a short delay
      await new Promise(resolve => setTimeout(resolve, 50));
      capturedHandler(newMail);

      const result = await waitPromise;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mail_new');
      expect(mockEventBus.off).toHaveBeenCalled();
    });
  });

  describe('deleteMail', () => {
    it('should delete and emit event', async () => {
      mockMailRepo.delete.mockResolvedValue(undefined);

      await service.deleteMail('mail_123');

      expect(mockMailRepo.delete).toHaveBeenCalledWith('mail_123');
      expect(mockEventBus.emit).toHaveBeenCalledWith('mail:deleted', { id: 'mail_123' });
    });
  });
});
