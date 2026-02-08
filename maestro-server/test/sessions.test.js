"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const storage_1 = __importDefault(require("../src/storage"));
const helpers_1 = require("./helpers");
describe('Sessions API', () => {
    let app;
    let storage;
    let testDataDir;
    let projectId;
    let taskId;
    beforeEach(async () => {
        testDataDir = new helpers_1.TestDataDir();
        storage = new storage_1.default(testDataDir.getPath());
        await new Promise(resolve => setTimeout(resolve, 100));
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        const projectsRouter = require('../src/api/projects')(storage);
        const tasksRouter = require('../src/api/tasks')(storage);
        const sessionsRouter = require('../src/api/sessions')(storage);
        app.use('/api', projectsRouter);
        app.use('/api', tasksRouter);
        app.use('/api', sessionsRouter);
        // Create test project and task
        const projectResponse = await (0, supertest_1.default)(app)
            .post('/api/projects')
            .send((0, helpers_1.createTestProject)());
        projectId = projectResponse.body.id;
        const taskResponse = await (0, supertest_1.default)(app)
            .post('/api/tasks')
            .send((0, helpers_1.createTestTask)(projectId));
        taskId = taskResponse.body.id;
    });
    afterEach(async () => {
        await testDataDir.cleanup();
    });
    describe('POST /api/sessions', () => {
        it('should create a new session', async () => {
            const sessionData = (0, helpers_1.createTestSession)(projectId, [taskId]);
            const response = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send(sessionData)
                .expect(201);
            expect(response.body).toMatchObject({
                projectId,
                taskIds: [taskId],
                name: sessionData.name,
                status: 'running'
            });
            expect(response.body.id).toMatch(/^sess_/);
            expect(response.body.hostname).toBeDefined();
            expect(response.body.platform).toBeDefined();
        });
        it('should return 400 if taskIds is missing', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send({ projectId })
                .expect(400);
            expect(response.body.error).toBe(true);
        });
        it('should accept backward compatible taskId field', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send({
                projectId,
                taskId, // Old format (singular)
                name: 'Test Session'
            })
                .expect(201);
            expect(response.body.taskIds).toEqual([taskId]);
        });
        it('should update tasks with session ID', async () => {
            const sessionResponse = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            const sessionId = sessionResponse.body.id;
            // Verify task was updated
            const taskResponse = await (0, supertest_1.default)(app)
                .get(`/api/tasks/${taskId}`)
                .expect(200);
            expect(taskResponse.body.sessionIds).toContain(sessionId);
            expect(taskResponse.body.timeline.some((e) => e.type === 'session_started' && e.sessionId === sessionId)).toBe(true);
        });
    });
    describe('GET /api/sessions', () => {
        it('should return empty array when no sessions exist', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/sessions')
                .expect(200);
            expect(response.body).toEqual([]);
        });
        it('should return all sessions', async () => {
            await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId], { name: 'Session 1' }));
            await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId], { name: 'Session 2' }));
            const response = await (0, supertest_1.default)(app)
                .get('/api/sessions')
                .expect(200);
            expect(response.body).toHaveLength(2);
        });
        it('should filter sessions by projectId', async () => {
            const project2Response = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send((0, helpers_1.createTestProject)({ name: 'Project 2' }));
            const projectId2 = project2Response.body.id;
            const task2Response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId2));
            const taskId2 = task2Response.body.id;
            await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId2, [taskId2]));
            const response = await (0, supertest_1.default)(app)
                .get(`/api/sessions?projectId=${projectId}`)
                .expect(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].projectId).toBe(projectId);
        });
        it('should filter sessions by taskId', async () => {
            const task2Response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Task 2' }));
            const taskId2 = task2Response.body.id;
            await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId2]));
            const response = await (0, supertest_1.default)(app)
                .get(`/api/sessions?taskId=${taskId}`)
                .expect(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].taskIds).toContain(taskId);
        });
        it('should filter active sessions', async () => {
            const session1Response = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            // Complete first session
            await (0, supertest_1.default)(app)
                .patch(`/api/sessions/${session1Response.body.id}`)
                .send({ status: 'completed' });
            const response = await (0, supertest_1.default)(app)
                .get('/api/sessions?active=true')
                .expect(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].status).toBe('running');
        });
    });
    describe('GET /api/sessions/:id', () => {
        it('should return a session by ID', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            const sessionId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .get(`/api/sessions/${sessionId}`)
                .expect(200);
            expect(response.body.id).toBe(sessionId);
        });
        it('should return 404 for non-existent session', async () => {
            await (0, supertest_1.default)(app)
                .get('/api/sessions/sess_nonexistent')
                .expect(404);
        });
    });
    describe('PATCH /api/sessions/:id', () => {
        it('should update session status', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            const sessionId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .patch(`/api/sessions/${sessionId}`)
                .send({ status: 'completed' })
                .expect(200);
            expect(response.body.status).toBe('completed');
            expect(response.body.lastActivity).toBeGreaterThan(createResponse.body.lastActivity);
        });
        it('should update session taskIds', async () => {
            const task2Response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Task 2' }));
            const taskId2 = task2Response.body.id;
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            const sessionId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .patch(`/api/sessions/${sessionId}`)
                .send({ taskIds: [taskId, taskId2] })
                .expect(200);
            expect(response.body.taskIds).toEqual([taskId, taskId2]);
        });
    });
    describe('DELETE /api/sessions/:id', () => {
        it('should delete a session', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            const sessionId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .delete(`/api/sessions/${sessionId}`)
                .expect(200);
            expect(response.body).toEqual({
                success: true,
                id: sessionId
            });
            await (0, supertest_1.default)(app)
                .get(`/api/sessions/${sessionId}`)
                .expect(404);
        });
        it('should remove session ID from tasks', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            const sessionId = createResponse.body.id;
            await (0, supertest_1.default)(app)
                .delete(`/api/sessions/${sessionId}`)
                .expect(200);
            // Verify task was updated
            const taskResponse = await (0, supertest_1.default)(app)
                .get(`/api/tasks/${taskId}`)
                .expect(200);
            expect(taskResponse.body.sessionIds).not.toContain(sessionId);
            expect(taskResponse.body.timeline.some((e) => e.type === 'session_ended' && e.sessionId === sessionId)).toBe(true);
        });
    });
    describe('POST /api/sessions/:id/tasks/:taskId', () => {
        it('should add task to session', async () => {
            const task2Response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Task 2' }));
            const taskId2 = task2Response.body.id;
            const sessionResponse = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            const sessionId = sessionResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .post(`/api/sessions/${sessionId}/tasks/${taskId2}`)
                .expect(200);
            expect(response.body.taskIds).toContain(taskId2);
            // Verify task was updated
            const updatedTask = await (0, supertest_1.default)(app)
                .get(`/api/tasks/${taskId2}`)
                .expect(200);
            expect(updatedTask.body.sessionIds).toContain(sessionId);
        });
        it('should return 404 if session not found', async () => {
            await (0, supertest_1.default)(app)
                .post(`/api/sessions/sess_nonexistent/tasks/${taskId}`)
                .expect(404);
        });
        it('should return 404 if task not found', async () => {
            const sessionResponse = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId]));
            const sessionId = sessionResponse.body.id;
            await (0, supertest_1.default)(app)
                .post(`/api/sessions/${sessionId}/tasks/task_nonexistent`)
                .expect(404);
        });
    });
    describe('DELETE /api/sessions/:id/tasks/:taskId', () => {
        it('should remove task from session', async () => {
            const task2Response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Task 2' }));
            const taskId2 = task2Response.body.id;
            const sessionResponse = await (0, supertest_1.default)(app)
                .post('/api/sessions')
                .send((0, helpers_1.createTestSession)(projectId, [taskId, taskId2]));
            const sessionId = sessionResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .delete(`/api/sessions/${sessionId}/tasks/${taskId}`)
                .expect(200);
            expect(response.body.taskIds).not.toContain(taskId);
            expect(response.body.taskIds).toContain(taskId2);
            // Verify task was updated
            const updatedTask = await (0, supertest_1.default)(app)
                .get(`/api/tasks/${taskId}`)
                .expect(200);
            expect(updatedTask.body.sessionIds).not.toContain(sessionId);
        });
    });
    describe('POST /api/sessions/spawn', () => {
        it('should spawn a session', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/sessions/spawn')
                .send({
                projectId,
                taskIds: [taskId],
                sessionName: 'Test Spawn',
                skills: ['test-skill']
            })
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.sessionId).toMatch(/^sess_/);
            expect(response.body.session).toBeDefined();
            expect(response.body.session.status).toBe('spawning');
            expect(response.body.session.metadata.skills).toEqual(['test-skill']);
        });
        it('should return 400 if projectId is missing', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/sessions/spawn')
                .send({ taskIds: [taskId] })
                .expect(400);
            expect(response.body.code).toBe('missing_project_id');
        });
        it('should return 400 if taskIds is empty', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/sessions/spawn')
                .send({ projectId, taskIds: [] })
                .expect(400);
            expect(response.body.code).toBe('invalid_task_ids');
        });
        it('should return 404 if task does not exist', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/sessions/spawn')
                .send({ projectId, taskIds: ['task_nonexistent'] })
                .expect(404);
            expect(response.body.code).toBe('task_not_found');
        });
        it('should use default skills if not provided', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/sessions/spawn')
                .send({ projectId, taskIds: [taskId] })
                .expect(201);
            expect(response.body.session.metadata.skills).toEqual(['maestro-worker']);
        });
    });
});
//# sourceMappingURL=sessions.test.js.map