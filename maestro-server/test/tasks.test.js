"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const storage_1 = __importDefault(require("../src/storage"));
const helpers_1 = require("./helpers");
describe('Tasks API', () => {
    let app;
    let storage;
    let testDataDir;
    let projectId;
    beforeEach(async () => {
        testDataDir = new helpers_1.TestDataDir();
        storage = new storage_1.default(testDataDir.getPath());
        await new Promise(resolve => setTimeout(resolve, 100));
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        const projectsRouter = require('../src/api/projects')(storage);
        const tasksRouter = require('../src/api/tasks')(storage);
        app.use('/api', projectsRouter);
        app.use('/api', tasksRouter);
        // Create a test project
        const response = await (0, supertest_1.default)(app)
            .post('/api/projects')
            .send((0, helpers_1.createTestProject)());
        projectId = response.body.id;
    });
    afterEach(async () => {
        await testDataDir.cleanup();
    });
    describe('POST /api/tasks', () => {
        it('should create a new task', async () => {
            const taskData = (0, helpers_1.createTestTask)(projectId);
            const response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send(taskData)
                .expect(201);
            expect(response.body).toMatchObject({
                projectId,
                title: taskData.title,
                description: taskData.description,
                priority: 'medium',
                status: 'pending'
            });
            expect(response.body.id).toMatch(/^task_/);
            expect(response.body.sessionIds).toEqual([]);
            expect(response.body.timeline).toHaveLength(1);
            expect(response.body.timeline[0].type).toBe('created');
        });
        it('should return 400 if projectId is missing', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send({ title: 'Test' })
                .expect(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 400 if title is missing', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send({ projectId })
                .expect(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });
        it('should create hierarchical task with parentId', async () => {
            // Create parent task
            const parentResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Parent Task' }));
            const parentId = parentResponse.body.id;
            // Create child task
            const response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, {
                title: 'Child Task',
                parentId
            }))
                .expect(201);
            expect(response.body.parentId).toBe(parentId);
            expect(response.body.title).toBe('Child Task');
        });
    });
    describe('GET /api/tasks', () => {
        it('should return empty array when no tasks exist', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/tasks')
                .expect(200);
            expect(response.body).toEqual([]);
        });
        it('should return all tasks', async () => {
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Task 1' }));
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Task 2' }));
            const response = await (0, supertest_1.default)(app)
                .get('/api/tasks')
                .expect(200);
            expect(response.body).toHaveLength(2);
        });
        it('should filter tasks by projectId', async () => {
            // Create another project
            const project2Response = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send((0, helpers_1.createTestProject)({ name: 'Project 2' }));
            const projectId2 = project2Response.body.id;
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Task 1' }));
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId2, { title: 'Task 2' }));
            const response = await (0, supertest_1.default)(app)
                .get(`/api/tasks?projectId=${projectId}`)
                .expect(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].title).toBe('Task 1');
        });
        it('should filter tasks by status', async () => {
            const task1Response = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Task 1' }));
            await (0, supertest_1.default)(app)
                .patch(`/api/tasks/${task1Response.body.id}`)
                .send({ status: 'in_progress' });
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Task 2' }));
            const response = await (0, supertest_1.default)(app)
                .get('/api/tasks?status=in_progress')
                .expect(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].status).toBe('in_progress');
        });
        it('should filter tasks by parentId', async () => {
            // Create parent task
            const parentResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Parent' }));
            const parentId = parentResponse.body.id;
            // Create child tasks
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Child 1', parentId }));
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Child 2', parentId }));
            // Create root task
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Root' }));
            const response = await (0, supertest_1.default)(app)
                .get(`/api/tasks?parentId=${parentId}`)
                .expect(200);
            expect(response.body).toHaveLength(2);
            expect(response.body[0].parentId).toBe(parentId);
            expect(response.body[1].parentId).toBe(parentId);
        });
        it('should filter root tasks with parentId=null', async () => {
            // Create parent task
            const parentResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Parent' }));
            const parentId = parentResponse.body.id;
            // Create child task
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Child', parentId }));
            // Create root task
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Root' }));
            const response = await (0, supertest_1.default)(app)
                .get('/api/tasks?parentId=null')
                .expect(200);
            expect(response.body).toHaveLength(2);
            expect(response.body.every((t) => t.parentId === null)).toBe(true);
        });
    });
    describe('GET /api/tasks/:id', () => {
        it('should return a task by ID', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId));
            const taskId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .get(`/api/tasks/${taskId}`)
                .expect(200);
            expect(response.body.id).toBe(taskId);
        });
        it('should return 404 for non-existent task', async () => {
            await (0, supertest_1.default)(app)
                .get('/api/tasks/task_nonexistent')
                .expect(404);
        });
    });
    describe('PATCH /api/tasks/:id', () => {
        it('should update task status', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId));
            const taskId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .patch(`/api/tasks/${taskId}`)
                .send({ status: 'in_progress' })
                .expect(200);
            expect(response.body.status).toBe('in_progress');
            expect(response.body.startedAt).toBeDefined();
        });
        it('should set completedAt when status becomes completed', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId));
            const taskId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .patch(`/api/tasks/${taskId}`)
                .send({ status: 'completed' })
                .expect(200);
            expect(response.body.status).toBe('completed');
            expect(response.body.completedAt).toBeDefined();
        });
        it('should update multiple fields', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId));
            const taskId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .patch(`/api/tasks/${taskId}`)
                .send({
                title: 'Updated Title',
                priority: 'high',
                status: 'in_progress'
            })
                .expect(200);
            expect(response.body.title).toBe('Updated Title');
            expect(response.body.priority).toBe('high');
            expect(response.body.status).toBe('in_progress');
        });
    });
    describe('POST /api/tasks/:id/timeline', () => {
        it('should add timeline event', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId));
            const taskId = createResponse.body.id;
            const initialTimelineLength = createResponse.body.timeline.length;
            const response = await (0, supertest_1.default)(app)
                .post(`/api/tasks/${taskId}/timeline`)
                .send({
                type: 'milestone',
                message: 'Completed implementation'
            })
                .expect(200);
            expect(response.body.timeline).toHaveLength(initialTimelineLength + 1);
            expect(response.body.timeline[initialTimelineLength]).toMatchObject({
                type: 'milestone',
                message: 'Completed implementation'
            });
        });
        it('should return 400 if message is missing', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId));
            const taskId = createResponse.body.id;
            await (0, supertest_1.default)(app)
                .post(`/api/tasks/${taskId}/timeline`)
                .send({ type: 'update' })
                .expect(400);
        });
    });
    describe('DELETE /api/tasks/:id', () => {
        it('should delete a task', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId));
            const taskId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .delete(`/api/tasks/${taskId}`)
                .expect(200);
            expect(response.body).toEqual({
                success: true,
                id: taskId
            });
            await (0, supertest_1.default)(app)
                .get(`/api/tasks/${taskId}`)
                .expect(404);
        });
    });
    describe('GET /api/tasks/:id/children', () => {
        it('should return child tasks', async () => {
            const parentResponse = await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Parent' }));
            const parentId = parentResponse.body.id;
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Child 1', parentId }));
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send((0, helpers_1.createTestTask)(projectId, { title: 'Child 2', parentId }));
            const response = await (0, supertest_1.default)(app)
                .get(`/api/tasks/${parentId}/children`)
                .expect(200);
            expect(response.body).toHaveLength(2);
            expect(response.body.every((t) => t.parentId === parentId)).toBe(true);
        });
        it('should return 404 if parent task does not exist', async () => {
            await (0, supertest_1.default)(app)
                .get('/api/tasks/task_nonexistent/children')
                .expect(404);
        });
    });
});
//# sourceMappingURL=tasks.test.js.map