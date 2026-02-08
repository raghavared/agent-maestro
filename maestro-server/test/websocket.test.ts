import WebSocket from 'ws';
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import Storage from '../src/storage';
import setupWebSocket from '../src/websocket';
import { TestDataDir, createTestProject, createTestTask, waitFor, wait } from './helpers';

describe('WebSocket Events', () => {
  let app: express.Application;
  let server: http.Server;
  let wss: WebSocketServer;
  let storage: Storage;
  let testDataDir: TestDataDir;
  let client1: WebSocket;
  let client2: WebSocket;
  let receivedMessages1: any[];
  let receivedMessages2: any[];

  beforeEach(async () => {
    testDataDir = new TestDataDir();
    storage = new Storage(testDataDir.getPath());
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create Express app with all routers
    app = express();
    app.use(express.json());

    const projectsRouter = require('../src/api/projects')(storage);
    const tasksRouter = require('../src/api/tasks')(storage);
    const sessionsRouter = require('../src/api/sessions')(storage);
    app.use('/api', projectsRouter);
    app.use('/api', tasksRouter);
    app.use('/api', sessionsRouter);

    // Start HTTP server
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve()); // Use random port
    });

    // Start WebSocket server
    wss = new WebSocketServer({ server });
    setupWebSocket(wss, storage);

    // Get server address
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? (address as any).port : 3000;

    // Create test clients
    receivedMessages1 = [];
    receivedMessages2 = [];

    client1 = new WebSocket(`ws://localhost:${port}`);
    client2 = new WebSocket(`ws://localhost:${port}`);

    client1.on('message', (data) => {
      receivedMessages1.push(JSON.parse(data.toString()));
    });

    client2.on('message', (data) => {
      receivedMessages2.push(JSON.parse(data.toString()));
    });

    // Wait for connections
    await waitFor(() => client1.readyState === WebSocket.OPEN);
    await waitFor(() => client2.readyState === WebSocket.OPEN);
  });

  afterEach(async () => {
    client1.close();
    client2.close();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    wss.close();
    await testDataDir.cleanup();
  });

  describe('Connection', () => {
    it('should establish WebSocket connection', () => {
      expect(client1.readyState).toBe(WebSocket.OPEN);
      expect(client2.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe('Project Events', () => {
    it('should broadcast project:created event', async () => {
      const projectData = createTestProject();

      // Create project via API
      const response = await fetch(`http://localhost:${(server.address() as any).port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });

      const project: any = await response.json();

      // Wait for WebSocket events
      await waitFor(() => receivedMessages1.length > 0);

      // Both clients should receive the event
      expect(receivedMessages1).toHaveLength(1);
      expect(receivedMessages2).toHaveLength(1);

      const event = receivedMessages1[0];
      expect(event.type).toBe('project:created');
      expect(event.event).toBe('project:created');
      expect(event.data.id).toBe(project.id);
      expect(event.data.name).toBe(projectData.name);
    });

    it('should broadcast project:updated event', async () => {
      // Create project
      const createResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTestProject())
      });

      const project: any = await createResponse.json();
      receivedMessages1 = []; // Clear messages

      // Update project
      await fetch(`http://localhost:${(server.address() as any).port}/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Project' })
      });

      await waitFor(() => receivedMessages1.length > 0);

      const event = receivedMessages1[0];
      expect(event.type).toBe('project:updated');
      expect(event.data.name).toBe('Updated Project');
    });

    it('should broadcast project:deleted event', async () => {
      // Create project
      const createResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTestProject())
      });

      const project: any = await createResponse.json();
      receivedMessages1 = [];

      // Delete project
      await fetch(`http://localhost:${(server.address() as any).port}/api/projects/${project.id}`, {
        method: 'DELETE'
      });

      await waitFor(() => receivedMessages1.length > 0);

      const event = receivedMessages1[0];
      expect(event.type).toBe('project:deleted');
      expect(event.data.id).toBe(project.id);
    });
  });

  describe('Task Events', () => {
    let projectId: string;

    beforeEach(async () => {
      // Create test project
      const response = await fetch(`http://localhost:${(server.address() as any).port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTestProject())
      });
      const project = await response.json() as any;
      projectId = project.id;

      receivedMessages1 = [];
      receivedMessages2 = [];
    });

    it('should broadcast task:created event', async () => {
      const taskData = createTestTask(projectId);

      await fetch(`http://localhost:${(server.address() as any).port}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      await waitFor(() => receivedMessages1.length > 0);

      const event = receivedMessages1[0];
      expect(event.type).toBe('task:created');
      expect(event.data.title).toBe(taskData.title);
    });

    it('should broadcast task:updated event', async () => {
      // Create task
      const createResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTestTask(projectId))
      });

      const task = await createResponse.json() as any;
      receivedMessages1 = [];

      // Update task
      await fetch(`http://localhost:${(server.address() as any).port}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      });

      await waitFor(() => receivedMessages1.length > 0);

      const event = receivedMessages1[0];
      expect(event.type).toBe('task:updated');
      expect(event.data.status).toBe('in_progress');
    });

    it('should broadcast task:deleted event', async () => {
      // Create task
      const createResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTestTask(projectId))
      });

      const task = await createResponse.json() as any;
      receivedMessages1 = [];

      // Delete task
      await fetch(`http://localhost:${(server.address() as any).port}/api/tasks/${task.id}`, {
        method: 'DELETE'
      });

      await waitFor(() => receivedMessages1.length > 0);

      const event = receivedMessages1[0];
      expect(event.type).toBe('task:deleted');
      expect(event.data.id).toBe(task.id);
    });
  });

  describe('Session Events', () => {
    let projectId: string;
    let taskId: string;

    beforeEach(async () => {
      // Create test project and task
      const projectResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTestProject())
      });
      const project = await projectResponse.json() as any;
      projectId = project.id;

      const taskResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTestTask(projectId))
      });
      const task: any = await taskResponse.json();
      taskId = task.id;

      receivedMessages1 = [];
      receivedMessages2 = [];
    });

    it('should broadcast session:created event', async () => {
      await fetch(`http://localhost:${(server.address() as any).port}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          taskIds: [taskId],
          name: 'Test Session'
        })
      });

      await waitFor(() => receivedMessages1.length > 0);

      const event = receivedMessages1[0];
      expect(event.type).toBe('session:created');
      expect(event.data.name).toBe('Test Session');
    });

    it('should broadcast session:updated event', async () => {
      // Create session
      const createResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          taskIds: [taskId],
          name: 'Test Session'
        })
      });

      const session = await createResponse.json() as any;
      receivedMessages1 = [];

      // Update session
      await fetch(`http://localhost:${(server.address() as any).port}/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });

      await waitFor(() => receivedMessages1.length > 0);

      const event = receivedMessages1[0];
      expect(event.type).toBe('session:updated');
      expect(event.data.status).toBe('completed');
    });

    it('should broadcast session:spawn_request event', async () => {
      await fetch(`http://localhost:${(server.address() as any).port}/api/sessions/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          taskIds: [taskId],
          skills: ['test-skill']
        })
      });

      await waitFor(() => receivedMessages1.length > 0);

      const event = receivedMessages1[0];
      expect(event.type).toBe('session:spawn_request');
      expect(event.data.session).toBeDefined();
      expect(event.data.session.status).toBe('spawning');
      expect(event.data.skillIds).toEqual(['test-skill']);
    });
  });

  describe('Bidirectional Relationship Events', () => {
    let projectId: string;
    let taskId: string;
    let sessionId: string;

    beforeEach(async () => {
      // Create test project and task
      const projectResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTestProject())
      });
      const project = await projectResponse.json() as any;
      projectId = project.id;

      const taskResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTestTask(projectId))
      });
      const task: any = await taskResponse.json();
      taskId = task.id;

      const sessionResponse = await fetch(`http://localhost:${(server.address() as any).port}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          taskIds: [],
          name: 'Test Session'
        })
      });
      const session: any = await sessionResponse.json();
      sessionId = session.id;

      receivedMessages1 = [];
      receivedMessages2 = [];
    });

    it('should broadcast session:task_added and task:session_added events', async () => {
      await fetch(`http://localhost:${(server.address() as any).port}/api/sessions/${sessionId}/tasks/${taskId}`, {
        method: 'POST'
      });

      await waitFor(() => receivedMessages1.length >= 2);

      const eventTypes = receivedMessages1.map(e => e.type);
      expect(eventTypes).toContain('session:task_added');
      expect(eventTypes).toContain('task:session_added');
    });

    it('should broadcast session:task_removed and task:session_removed events', async () => {
      // First add task to session
      await fetch(`http://localhost:${(server.address() as any).port}/api/sessions/${sessionId}/tasks/${taskId}`, {
        method: 'POST'
      });

      await waitFor(() => receivedMessages1.length >= 2);
      receivedMessages1 = [];

      // Then remove it
      await fetch(`http://localhost:${(server.address() as any).port}/api/sessions/${sessionId}/tasks/${taskId}`, {
        method: 'DELETE'
      });

      await waitFor(() => receivedMessages1.length >= 2);

      const eventTypes = receivedMessages1.map(e => e.type);
      expect(eventTypes).toContain('session:task_removed');
      expect(eventTypes).toContain('task:session_removed');
    });
  });

  describe('Multiple Clients', () => {
    it('should broadcast to all connected clients', async () => {
      const projectData = createTestProject();

      await fetch(`http://localhost:${(server.address() as any).port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });

      await waitFor(() => receivedMessages1.length > 0 && receivedMessages2.length > 0);

      // Both clients should receive the same event
      expect(receivedMessages1[0].type).toBe(receivedMessages2[0].type);
      expect(receivedMessages1[0].data.id).toBe(receivedMessages2[0].data.id);
    });
  });
});
