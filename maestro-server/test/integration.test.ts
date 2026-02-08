import request from 'supertest';
import WebSocket from 'ws';
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import Storage from '../src/storage';
import setupWebSocket from '../src/websocket';
import { TestDataDir, createTestProject, createTestTask, waitFor } from './helpers';

describe('Integration Tests - Full Workflows', () => {
  let app: express.Application;
  let server: http.Server;
  let wss: WebSocketServer;
  let storage: Storage;
  let testDataDir: TestDataDir;
  let wsClient: WebSocket;
  let receivedEvents: any[];

  beforeEach(async () => {
    testDataDir = new TestDataDir();
    storage = new Storage(testDataDir.getPath());
    await new Promise(resolve => setTimeout(resolve, 100));

    app = express();
    app.use(express.json());

    const projectsRouter = require('../src/api/projects')(storage);
    const tasksRouter = require('../src/api/tasks')(storage);
    const sessionsRouter = require('../src/api/sessions')(storage);
    app.use('/api', projectsRouter);
    app.use('/api', tasksRouter);
    app.use('/api', sessionsRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    wss = new WebSocketServer({ server });
    setupWebSocket(wss, storage);

    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 3000;

    receivedEvents = [];
    wsClient = new WebSocket(`ws://localhost:${port}`);
    wsClient.on('message', (data) => {
      receivedEvents.push(JSON.parse(data.toString()));
    });

    await waitFor(() => wsClient.readyState === WebSocket.OPEN);
  });

  afterEach(async () => {
    wsClient.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    wss.close();
    await testDataDir.cleanup();
  });

  describe('Complete Task Workflow', () => {
    it('should complete full project → task → session → spawn workflow', async () => {
      // 1. Create project
      const projectResponse = await request(app)
        .post('/api/projects')
        .send(createTestProject({ name: 'Integration Test Project' }))
        .expect(201);

      const projectId = projectResponse.body.id;

      // Verify project:created event
      await waitFor(() => receivedEvents.some(e => e.type === 'project:created'));
      const projectCreatedEvent = receivedEvents.find(e => e.type === 'project:created');
      expect(projectCreatedEvent.data.id).toBe(projectId);

      // 2. Create parent task
      const parentTaskResponse = await request(app)
        .post('/api/tasks')
        .send(createTestTask(projectId, {
          title: 'Implement Feature X',
          priority: 'high'
        }))
        .expect(201);

      const parentTaskId = parentTaskResponse.body.id;

      // Verify task:created event
      await waitFor(() => receivedEvents.some(e =>
        e.type === 'task:created' && e.data.id === parentTaskId
      ));

      // 3. Create child tasks
      const childTask1Response = await request(app)
        .post('/api/tasks')
        .send(createTestTask(projectId, {
          title: 'Subtask 1: Design',
          parentId: parentTaskId
        }))
        .expect(201);

      const childTask2Response = await request(app)
        .post('/api/tasks')
        .send(createTestTask(projectId, {
          title: 'Subtask 2: Implementation',
          parentId: parentTaskId
        }))
        .expect(201);

      const childTaskId1 = childTask1Response.body.id;
      const childTaskId2 = childTask2Response.body.id;

      // Verify child tasks
      const childrenResponse = await request(app)
        .get(`/api/tasks/${parentTaskId}/children`)
        .expect(200);

      expect(childrenResponse.body).toHaveLength(2);

      // 4. Spawn worker session for first child task
      const spawnResponse = await request(app)
        .post('/api/sessions/spawn')
        .send({
          projectId,
          taskIds: [childTaskId1],
          sessionName: 'Worker: Design',
          skills: ['maestro-worker']
        })
        .expect(201);

      const sessionId = spawnResponse.body.sessionId;

      // Verify session:spawn_request event
      await waitFor(() => receivedEvents.some(e =>
        e.type === 'session:spawn_request' && e.data.session.id === sessionId
      ));

      const spawnEvent = receivedEvents.find(e =>
        e.type === 'session:spawn_request' && e.data.session.id === sessionId
      );

      expect(spawnEvent.data.session.status).toBe('spawning');
      expect(spawnEvent.data.taskIds).toEqual([childTaskId1]);

      // 5. Verify task was updated with session
      const updatedTaskResponse = await request(app)
        .get(`/api/tasks/${childTaskId1}`)
        .expect(200);

      expect(updatedTaskResponse.body.sessionIds).toContain(sessionId);

      // 6. Update session to running (simulating CLI initialization)
      await request(app)
        .patch(`/api/sessions/${sessionId}`)
        .send({ status: 'running' })
        .expect(200);

      // Verify session:updated event
      await waitFor(() => receivedEvents.some(e =>
        e.type === 'session:updated' &&
        e.data.id === sessionId &&
        e.data.status === 'running'
      ));

      // 7. Start working on task
      await request(app)
        .patch(`/api/tasks/${childTaskId1}`)
        .send({ status: 'in_progress' })
        .expect(200);

      // 8. Add timeline events
      await request(app)
        .post(`/api/tasks/${childTaskId1}/timeline`)
        .send({
          type: 'update',
          message: 'Design mockups created'
        })
        .expect(200);

      // 9. Complete the task
      await request(app)
        .patch(`/api/tasks/${childTaskId1}`)
        .send({ status: 'completed' })
        .expect(200);

      const completedTaskResponse = await request(app)
        .get(`/api/tasks/${childTaskId1}`)
        .expect(200);

      expect(completedTaskResponse.body.status).toBe('completed');
      expect(completedTaskResponse.body.completedAt).toBeDefined();

      // 10. Complete the session
      await request(app)
        .patch(`/api/sessions/${sessionId}`)
        .send({ status: 'completed' })
        .expect(200);

      // 11. Start second child task
      const session2Response = await request(app)
        .post('/api/sessions/spawn')
        .send({
          projectId,
          taskIds: [childTaskId2],
          sessionName: 'Worker: Implementation'
        })
        .expect(201);

      // 12. Verify all events were broadcast
      const eventTypes = new Set(receivedEvents.map(e => e.type));

      expect(eventTypes).toContain('project:created');
      expect(eventTypes).toContain('task:created');
      expect(eventTypes).toContain('task:updated');
      expect(eventTypes).toContain('session:created');
      expect(eventTypes).toContain('session:updated');
      expect(eventTypes).toContain('session:spawn_request');
      expect(eventTypes).toContain('task:session_added');

      // 13. Verify project has all tasks
      const allTasksResponse = await request(app)
        .get(`/api/tasks?projectId=${projectId}`)
        .expect(200);

      expect(allTasksResponse.body).toHaveLength(3); // 1 parent + 2 children
    });
  });

  describe('Multi-Session Task Coordination', () => {
    it('should handle multiple sessions working on same task', async () => {
      // Create project and task
      const projectResponse = await request(app)
        .post('/api/projects')
        .send(createTestProject())
        .expect(201);

      const projectId = projectResponse.body.id;

      const taskResponse = await request(app)
        .post('/api/tasks')
        .send(createTestTask(projectId, {
          title: 'Complex Task Requiring Multiple Workers'
        }))
        .expect(201);

      const taskId = taskResponse.body.id;

      // Spawn first worker
      const worker1Response = await request(app)
        .post('/api/sessions/spawn')
        .send({
          projectId,
          taskIds: [taskId],
          sessionName: 'Worker 1'
        })
        .expect(201);

      const worker1Id = worker1Response.body.sessionId;

      // Spawn second worker
      const worker2Response = await request(app)
        .post('/api/sessions/spawn')
        .send({
          projectId,
          taskIds: [taskId],
          sessionName: 'Worker 2'
        })
        .expect(201);

      const worker2Id = worker2Response.body.sessionId;

      // Verify task has both sessions
      const taskWithSessionsResponse = await request(app)
        .get(`/api/tasks/${taskId}`)
        .expect(200);

      expect(taskWithSessionsResponse.body.sessionIds).toContain(worker1Id);
      expect(taskWithSessionsResponse.body.sessionIds).toContain(worker2Id);

      // Verify sessions can be filtered by task
      const sessionsForTaskResponse = await request(app)
        .get(`/api/sessions?taskId=${taskId}`)
        .expect(200);

      expect(sessionsForTaskResponse.body).toHaveLength(2);
    });
  });

  describe('Orchestrator Workflow', () => {
    it('should handle orchestrator spawning workers', async () => {
      // Create project
      const projectResponse = await request(app)
        .post('/api/projects')
        .send(createTestProject({ name: 'Orchestrated Project' }))
        .expect(201);

      const projectId = projectResponse.body.id;

      // Create multiple tasks
      const task1Response = await request(app)
        .post('/api/tasks')
        .send(createTestTask(projectId, { title: 'Task 1' }))
        .expect(201);

      const task2Response = await request(app)
        .post('/api/tasks')
        .send(createTestTask(projectId, { title: 'Task 2' }))
        .expect(201);

      const task1Id = task1Response.body.id;
      const task2Id = task2Response.body.id;

      // Create orchestrator session
      const orchestratorResponse = await request(app)
        .post('/api/sessions')
        .send({
          projectId,
          taskIds: [task1Id, task2Id],
          name: 'Orchestrator',
          metadata: {
            role: 'orchestrator',
            skills: ['maestro-orchestrator']
          }
        })
        .expect(201);

      const orchestratorId = orchestratorResponse.body.id;

      // Orchestrator spawns worker for task 1
      const worker1Response = await request(app)
        .post('/api/sessions/spawn')
        .send({
          projectId,
          taskIds: [task1Id],
          sessionName: 'Worker for Task 1',
          spawnedBy: orchestratorId,
          spawnReason: 'Task delegation'
        })
        .expect(201);

      const worker1Id = worker1Response.body.sessionId;

      // Verify spawn metadata
      const worker1Data = await request(app)
        .get(`/api/sessions/${worker1Id}`)
        .expect(200);

      expect(worker1Data.body.metadata.spawnedBy).toBe(orchestratorId);
      expect(worker1Data.body.metadata.spawnReason).toBe('Task delegation');

      // Verify orchestrator session still has both tasks
      const orchestratorData = await request(app)
        .get(`/api/sessions/${orchestratorId}`)
        .expect(200);

      expect(orchestratorData.body.taskIds).toContain(task1Id);
      expect(orchestratorData.body.taskIds).toContain(task2Id);
    });
  });

  describe('Project Deletion Workflow', () => {
    it('should prevent deletion of project with active tasks', async () => {
      // Create project
      const projectResponse = await request(app)
        .post('/api/projects')
        .send(createTestProject())
        .expect(201);

      const projectId = projectResponse.body.id;

      // Create task
      await request(app)
        .post('/api/tasks')
        .send(createTestTask(projectId))
        .expect(201);

      // Try to delete project (should fail)
      const deleteResponse = await request(app)
        .delete(`/api/projects/${projectId}`)
        .expect(400);

      expect(deleteResponse.body.code).toBe('PROJECT_HAS_DEPENDENCIES');

      // Delete task
      const tasksResponse = await request(app)
        .get(`/api/tasks?projectId=${projectId}`)
        .expect(200);

      const taskId = tasksResponse.body[0].id;

      await request(app)
        .delete(`/api/tasks/${taskId}`)
        .expect(200);

      // Now deletion should succeed
      await request(app)
        .delete(`/api/projects/${projectId}`)
        .expect(200);

      // Verify project is deleted
      await request(app)
        .get(`/api/projects/${projectId}`)
        .expect(404);
    });
  });
});
