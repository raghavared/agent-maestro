"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const express_1 = __importDefault(require("express"));
const ws_2 = require("ws");
const http_1 = __importDefault(require("http"));
const storage_1 = __importDefault(require("../src/storage"));
const websocket_1 = __importDefault(require("../src/websocket"));
const helpers_1 = require("./helpers");
describe('WebSocket Events', () => {
    let app;
    let server;
    let wss;
    let storage;
    let testDataDir;
    let client1;
    let client2;
    let receivedMessages1;
    let receivedMessages2;
    beforeEach(async () => {
        testDataDir = new helpers_1.TestDataDir();
        storage = new storage_1.default(testDataDir.getPath());
        await new Promise(resolve => setTimeout(resolve, 100));
        // Create Express app with all routers
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        const projectsRouter = require('../src/api/projects')(storage);
        const tasksRouter = require('../src/api/tasks')(storage);
        const sessionsRouter = require('../src/api/sessions')(storage);
        app.use('/api', projectsRouter);
        app.use('/api', tasksRouter);
        app.use('/api', sessionsRouter);
        // Start HTTP server
        server = http_1.default.createServer(app);
        await new Promise((resolve) => {
            server.listen(0, () => resolve()); // Use random port
        });
        // Start WebSocket server
        wss = new ws_2.WebSocketServer({ server });
        (0, websocket_1.default)(wss, storage);
        // Get server address
        const address = server.address();
        const port = typeof address === 'object' && address !== null ? address.port : 3000;
        // Create test clients
        receivedMessages1 = [];
        receivedMessages2 = [];
        client1 = new ws_1.default(`ws://localhost:${port}`);
        client2 = new ws_1.default(`ws://localhost:${port}`);
        client1.on('message', (data) => {
            receivedMessages1.push(JSON.parse(data.toString()));
        });
        client2.on('message', (data) => {
            receivedMessages2.push(JSON.parse(data.toString()));
        });
        // Wait for connections
        await (0, helpers_1.waitFor)(() => client1.readyState === ws_1.default.OPEN);
        await (0, helpers_1.waitFor)(() => client2.readyState === ws_1.default.OPEN);
    });
    afterEach(async () => {
        client1.close();
        client2.close();
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
        wss.close();
        await testDataDir.cleanup();
    });
    describe('Connection', () => {
        it('should establish WebSocket connection', () => {
            expect(client1.readyState).toBe(ws_1.default.OPEN);
            expect(client2.readyState).toBe(ws_1.default.OPEN);
        });
    });
    describe('Project Events', () => {
        it('should broadcast project:created event', async () => {
            const projectData = (0, helpers_1.createTestProject)();
            // Create project via API
            const response = await fetch(`http://localhost:${server.address().port}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
            const project = await response.json();
            // Wait for WebSocket events
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0);
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
            const createResponse = await fetch(`http://localhost:${server.address().port}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, helpers_1.createTestProject)())
            });
            const project = await createResponse.json();
            receivedMessages1 = []; // Clear messages
            // Update project
            await fetch(`http://localhost:${server.address().port}/api/projects/${project.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Updated Project' })
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0);
            const event = receivedMessages1[0];
            expect(event.type).toBe('project:updated');
            expect(event.data.name).toBe('Updated Project');
        });
        it('should broadcast project:deleted event', async () => {
            // Create project
            const createResponse = await fetch(`http://localhost:${server.address().port}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, helpers_1.createTestProject)())
            });
            const project = await createResponse.json();
            receivedMessages1 = [];
            // Delete project
            await fetch(`http://localhost:${server.address().port}/api/projects/${project.id}`, {
                method: 'DELETE'
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0);
            const event = receivedMessages1[0];
            expect(event.type).toBe('project:deleted');
            expect(event.data.id).toBe(project.id);
        });
    });
    describe('Task Events', () => {
        let projectId;
        beforeEach(async () => {
            // Create test project
            const response = await fetch(`http://localhost:${server.address().port}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, helpers_1.createTestProject)())
            });
            const project = await response.json();
            projectId = project.id;
            receivedMessages1 = [];
            receivedMessages2 = [];
        });
        it('should broadcast task:created event', async () => {
            const taskData = (0, helpers_1.createTestTask)(projectId);
            await fetch(`http://localhost:${server.address().port}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0);
            const event = receivedMessages1[0];
            expect(event.type).toBe('task:created');
            expect(event.data.title).toBe(taskData.title);
        });
        it('should broadcast task:updated event', async () => {
            // Create task
            const createResponse = await fetch(`http://localhost:${server.address().port}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, helpers_1.createTestTask)(projectId))
            });
            const task = await createResponse.json();
            receivedMessages1 = [];
            // Update task
            await fetch(`http://localhost:${server.address().port}/api/tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' })
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0);
            const event = receivedMessages1[0];
            expect(event.type).toBe('task:updated');
            expect(event.data.status).toBe('in_progress');
        });
        it('should broadcast task:deleted event', async () => {
            // Create task
            const createResponse = await fetch(`http://localhost:${server.address().port}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, helpers_1.createTestTask)(projectId))
            });
            const task = await createResponse.json();
            receivedMessages1 = [];
            // Delete task
            await fetch(`http://localhost:${server.address().port}/api/tasks/${task.id}`, {
                method: 'DELETE'
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0);
            const event = receivedMessages1[0];
            expect(event.type).toBe('task:deleted');
            expect(event.data.id).toBe(task.id);
        });
    });
    describe('Session Events', () => {
        let projectId;
        let taskId;
        beforeEach(async () => {
            // Create test project and task
            const projectResponse = await fetch(`http://localhost:${server.address().port}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, helpers_1.createTestProject)())
            });
            const project = await projectResponse.json();
            projectId = project.id;
            const taskResponse = await fetch(`http://localhost:${server.address().port}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, helpers_1.createTestTask)(projectId))
            });
            const task = await taskResponse.json();
            taskId = task.id;
            receivedMessages1 = [];
            receivedMessages2 = [];
        });
        it('should broadcast session:created event', async () => {
            await fetch(`http://localhost:${server.address().port}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    taskIds: [taskId],
                    name: 'Test Session'
                })
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0);
            const event = receivedMessages1[0];
            expect(event.type).toBe('session:created');
            expect(event.data.name).toBe('Test Session');
        });
        it('should broadcast session:updated event', async () => {
            // Create session
            const createResponse = await fetch(`http://localhost:${server.address().port}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    taskIds: [taskId],
                    name: 'Test Session'
                })
            });
            const session = await createResponse.json();
            receivedMessages1 = [];
            // Update session
            await fetch(`http://localhost:${server.address().port}/api/sessions/${session.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' })
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0);
            const event = receivedMessages1[0];
            expect(event.type).toBe('session:updated');
            expect(event.data.status).toBe('completed');
        });
        it('should broadcast session:spawn_request event', async () => {
            await fetch(`http://localhost:${server.address().port}/api/sessions/spawn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    taskIds: [taskId],
                    skills: ['test-skill']
                })
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0);
            const event = receivedMessages1[0];
            expect(event.type).toBe('session:spawn_request');
            expect(event.data.session).toBeDefined();
            expect(event.data.session.status).toBe('spawning');
            expect(event.data.skillIds).toEqual(['test-skill']);
        });
    });
    describe('Bidirectional Relationship Events', () => {
        let projectId;
        let taskId;
        let sessionId;
        beforeEach(async () => {
            // Create test project and task
            const projectResponse = await fetch(`http://localhost:${server.address().port}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, helpers_1.createTestProject)())
            });
            const project = await projectResponse.json();
            projectId = project.id;
            const taskResponse = await fetch(`http://localhost:${server.address().port}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify((0, helpers_1.createTestTask)(projectId))
            });
            const task = await taskResponse.json();
            taskId = task.id;
            const sessionResponse = await fetch(`http://localhost:${server.address().port}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    taskIds: [],
                    name: 'Test Session'
                })
            });
            const session = await sessionResponse.json();
            sessionId = session.id;
            receivedMessages1 = [];
            receivedMessages2 = [];
        });
        it('should broadcast session:task_added and task:session_added events', async () => {
            await fetch(`http://localhost:${server.address().port}/api/sessions/${sessionId}/tasks/${taskId}`, {
                method: 'POST'
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length >= 2);
            const eventTypes = receivedMessages1.map(e => e.type);
            expect(eventTypes).toContain('session:task_added');
            expect(eventTypes).toContain('task:session_added');
        });
        it('should broadcast session:task_removed and task:session_removed events', async () => {
            // First add task to session
            await fetch(`http://localhost:${server.address().port}/api/sessions/${sessionId}/tasks/${taskId}`, {
                method: 'POST'
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length >= 2);
            receivedMessages1 = [];
            // Then remove it
            await fetch(`http://localhost:${server.address().port}/api/sessions/${sessionId}/tasks/${taskId}`, {
                method: 'DELETE'
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length >= 2);
            const eventTypes = receivedMessages1.map(e => e.type);
            expect(eventTypes).toContain('session:task_removed');
            expect(eventTypes).toContain('task:session_removed');
        });
    });
    describe('Multiple Clients', () => {
        it('should broadcast to all connected clients', async () => {
            const projectData = (0, helpers_1.createTestProject)();
            await fetch(`http://localhost:${server.address().port}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
            await (0, helpers_1.waitFor)(() => receivedMessages1.length > 0 && receivedMessages2.length > 0);
            // Both clients should receive the same event
            expect(receivedMessages1[0].type).toBe(receivedMessages2[0].type);
            expect(receivedMessages1[0].data.id).toBe(receivedMessages2[0].data.id);
        });
    });
});
//# sourceMappingURL=websocket.test.js.map