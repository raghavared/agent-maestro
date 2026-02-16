import express from 'express';
import request from 'supertest';
import { createMailRoutes } from '../src/api/mailRoutes';
import { MailService } from '../src/application/services/MailService';
import { FileSystemMailRepository } from '../src/infrastructure/repositories/FileSystemMailRepository';
import { InMemoryEventBus } from '../src/infrastructure/events/InMemoryEventBus';
import { TimestampIdGenerator } from '../src/infrastructure/common/TimestampIdGenerator';
import { TestDataDir } from './helpers';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Mail API', () => {
  let app: express.Application;
  let mailService: MailService;
  let testDataDir: TestDataDir;

  beforeEach(async () => {
    testDataDir = new TestDataDir();
    const mailRepo = new FileSystemMailRepository(testDataDir.getPath(), mockLogger as any);
    await mailRepo.initialize();

    const eventBus = new InMemoryEventBus(mockLogger as any);
    const idGenerator = new TimestampIdGenerator();

    mailService = new MailService(mailRepo, eventBus, idGenerator);

    const mailRoutes = createMailRoutes({ mailService });

    app = express();
    app.use(express.json());
    app.use('/api', mailRoutes);
  });

  afterEach(async () => {
    await testDataDir.cleanup();
  });

  describe('POST /api/mail', () => {
    it('should send a mail message', async () => {
      const res = await request(app)
        .post('/api/mail')
        .send({
          projectId: 'proj_1',
          fromSessionId: 'sess_sender',
          toSessionId: 'sess_receiver',
          type: 'notification',
          subject: 'Hello World',
          body: { message: 'test' },
        })
        .expect(201);

      expect(res.body.id).toMatch(/^mail_/);
      expect(res.body.projectId).toBe('proj_1');
      expect(res.body.fromSessionId).toBe('sess_sender');
      expect(res.body.toSessionId).toBe('sess_receiver');
      expect(res.body.type).toBe('notification');
      expect(res.body.subject).toBe('Hello World');
      expect(res.body.body).toEqual({ message: 'test' });
    });

    it('should send a broadcast message (toSessionId null)', async () => {
      const res = await request(app)
        .post('/api/mail')
        .send({
          projectId: 'proj_1',
          fromSessionId: 'sess_coordinator',
          toSessionId: null,
          type: 'directive',
          subject: 'All workers stop',
        })
        .expect(201);

      expect(res.body.toSessionId).toBeNull();
    });

    it('should return 400 for invalid payload', async () => {
      await request(app)
        .post('/api/mail')
        .send({
          // Missing required fields
          subject: 'test',
        })
        .expect(400);
    });
  });

  describe('GET /api/mail/inbox/:id', () => {
    it('should return inbox messages for a session', async () => {
      // Send some messages
      await request(app).post('/api/mail').send({
        projectId: 'proj_1',
        fromSessionId: 'sess_a',
        toSessionId: 'sess_b',
        type: 'query',
        subject: 'Question 1',
      });

      await request(app).post('/api/mail').send({
        projectId: 'proj_1',
        fromSessionId: 'sess_a',
        toSessionId: 'sess_c',
        type: 'query',
        subject: 'Question 2',
      });

      const res = await request(app)
        .get('/api/mail/inbox/sess_b?projectId=proj_1')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].subject).toBe('Question 1');
    });

    it('should include broadcast messages in inbox', async () => {
      await request(app).post('/api/mail').send({
        projectId: 'proj_1',
        fromSessionId: 'sess_coord',
        toSessionId: null,
        type: 'notification',
        subject: 'Broadcast',
      });

      await request(app).post('/api/mail').send({
        projectId: 'proj_1',
        fromSessionId: 'sess_coord',
        toSessionId: 'sess_worker',
        type: 'assignment',
        subject: 'Direct',
      });

      const res = await request(app)
        .get('/api/mail/inbox/sess_worker?projectId=proj_1')
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('should filter by type', async () => {
      await request(app).post('/api/mail').send({
        projectId: 'proj_1',
        fromSessionId: 'sess_a',
        toSessionId: 'sess_b',
        type: 'query',
        subject: 'Q',
      });

      await request(app).post('/api/mail').send({
        projectId: 'proj_1',
        fromSessionId: 'sess_a',
        toSessionId: 'sess_b',
        type: 'notification',
        subject: 'N',
      });

      const res = await request(app)
        .get('/api/mail/inbox/sess_b?projectId=proj_1&type=query')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].type).toBe('query');
    });
  });

  describe('GET /api/mail/:id', () => {
    it('should return a single mail message', async () => {
      const created = await request(app).post('/api/mail').send({
        projectId: 'proj_1',
        fromSessionId: 'sess_a',
        toSessionId: 'sess_b',
        type: 'notification',
        subject: 'Test',
      });

      const res = await request(app)
        .get(`/api/mail/${created.body.id}`)
        .expect(200);

      expect(res.body.id).toBe(created.body.id);
      expect(res.body.subject).toBe('Test');
    });

    it('should return 404 for non-existent mail', async () => {
      await request(app)
        .get('/api/mail/mail_nonexistent')
        .expect(404);
    });
  });

  describe('DELETE /api/mail/:id', () => {
    it('should delete a mail message', async () => {
      const created = await request(app).post('/api/mail').send({
        projectId: 'proj_1',
        fromSessionId: 'sess_a',
        toSessionId: 'sess_b',
        type: 'notification',
        subject: 'Delete me',
      });

      await request(app)
        .delete(`/api/mail/${created.body.id}`)
        .expect(200);

      // Verify deleted
      await request(app)
        .get(`/api/mail/${created.body.id}`)
        .expect(404);
    });
  });

  describe('GET /api/mail/wait/:id', () => {
    it('should return immediately if messages exist', async () => {
      const now = Date.now();

      await request(app).post('/api/mail').send({
        projectId: 'proj_1',
        fromSessionId: 'sess_a',
        toSessionId: 'sess_b',
        type: 'notification',
        subject: 'Existing',
      });

      const res = await request(app)
        .get(`/api/mail/wait/sess_b?projectId=proj_1&since=0&timeout=5000`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].subject).toBe('Existing');
    });

    it('should return empty array on timeout', async () => {
      const res = await request(app)
        .get(`/api/mail/wait/sess_nobody?projectId=proj_1&since=${Date.now()}&timeout=1000`)
        .expect(200);

      expect(res.body).toEqual([]);
    }, 10000);
  });
});
