"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const storage_1 = __importDefault(require("../src/storage"));
const helpers_1 = require("./helpers");
describe('Projects API', () => {
    let app;
    let storage;
    let testDataDir;
    beforeEach(async () => {
        // Create isolated test data directory
        testDataDir = new helpers_1.TestDataDir();
        storage = new storage_1.default(testDataDir.getPath());
        await new Promise(resolve => setTimeout(resolve, 100));
        // Set up Express app
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        const projectsRouter = require('../src/api/projects')(storage);
        app.use('/api', projectsRouter);
    });
    afterEach(async () => {
        await testDataDir.cleanup();
    });
    describe('POST /api/projects', () => {
        it('should create a new project', async () => {
            const projectData = (0, helpers_1.createTestProject)();
            const response = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send(projectData)
                .expect(201);
            expect(response.body).toMatchObject({
                name: projectData.name,
                workingDir: projectData.workingDir,
                description: projectData.description
            });
            expect(response.body.id).toMatch(/^proj_/);
            expect(response.body.createdAt).toBeDefined();
            expect(response.body.updatedAt).toBeDefined();
        });
        it('should return 400 if name is missing', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send({ workingDir: '/tmp/test' })
                .expect(400);
            expect(response.body).toMatchObject({
                error: true,
                code: 'VALIDATION_ERROR',
                message: 'name is required'
            });
        });
        it('should create project with minimal data', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send({ name: 'Minimal Project' })
                .expect(201);
            expect(response.body.name).toBe('Minimal Project');
            expect(response.body.workingDir).toBe('');
            expect(response.body.description).toBe('');
        });
    });
    describe('GET /api/projects', () => {
        it('should return empty array when no projects exist', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/projects')
                .expect(200);
            expect(response.body).toEqual([]);
        });
        it('should return all projects', async () => {
            // Create multiple projects
            await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send((0, helpers_1.createTestProject)({ name: 'Project 1' }));
            await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send((0, helpers_1.createTestProject)({ name: 'Project 2' }));
            const response = await (0, supertest_1.default)(app)
                .get('/api/projects')
                .expect(200);
            expect(response.body).toHaveLength(2);
            expect(response.body[0].name).toBe('Project 1');
            expect(response.body[1].name).toBe('Project 2');
        });
    });
    describe('GET /api/projects/:id', () => {
        it('should return a project by ID', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send((0, helpers_1.createTestProject)());
            const projectId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .get(`/api/projects/${projectId}`)
                .expect(200);
            expect(response.body.id).toBe(projectId);
            expect(response.body.name).toBe('Test Project');
        });
        it('should return 404 for non-existent project', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/projects/proj_nonexistent')
                .expect(404);
            expect(response.body).toMatchObject({
                error: true,
                code: 'PROJECT_NOT_FOUND'
            });
        });
    });
    describe('PUT /api/projects/:id', () => {
        it('should update a project', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send((0, helpers_1.createTestProject)());
            const projectId = createResponse.body.id;
            const originalUpdatedAt = createResponse.body.updatedAt;
            // Wait a bit to ensure updatedAt changes
            await new Promise(resolve => setTimeout(resolve, 10));
            const response = await (0, supertest_1.default)(app)
                .put(`/api/projects/${projectId}`)
                .send({ name: 'Updated Project' })
                .expect(200);
            expect(response.body.name).toBe('Updated Project');
            expect(response.body.id).toBe(projectId);
            expect(response.body.updatedAt).toBeGreaterThan(originalUpdatedAt);
            expect(response.body.createdAt).toBe(createResponse.body.createdAt);
        });
        it('should return 404 for non-existent project', async () => {
            await (0, supertest_1.default)(app)
                .put('/api/projects/proj_nonexistent')
                .send({ name: 'Updated' })
                .expect(404);
        });
        it('should allow partial updates', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send((0, helpers_1.createTestProject)());
            const projectId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .put(`/api/projects/${projectId}`)
                .send({ description: 'New description only' })
                .expect(200);
            expect(response.body.name).toBe('Test Project'); // Unchanged
            expect(response.body.description).toBe('New description only');
        });
    });
    describe('DELETE /api/projects/:id', () => {
        it('should delete a project', async () => {
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send((0, helpers_1.createTestProject)());
            const projectId = createResponse.body.id;
            const response = await (0, supertest_1.default)(app)
                .delete(`/api/projects/${projectId}`)
                .expect(200);
            expect(response.body).toEqual({
                success: true,
                id: projectId
            });
            // Verify project is deleted
            await (0, supertest_1.default)(app)
                .get(`/api/projects/${projectId}`)
                .expect(404);
        });
        it('should return 404 for non-existent project', async () => {
            await (0, supertest_1.default)(app)
                .delete('/api/projects/proj_nonexistent')
                .expect(404);
        });
        it('should return 400 if project has tasks', async () => {
            // Create project
            const projectResponse = await (0, supertest_1.default)(app)
                .post('/api/projects')
                .send((0, helpers_1.createTestProject)());
            const projectId = projectResponse.body.id;
            // Create task in project
            const tasksRouter = require('../src/api/tasks')(storage);
            app.use('/api', tasksRouter);
            await (0, supertest_1.default)(app)
                .post('/api/tasks')
                .send({
                projectId,
                title: 'Test Task'
            });
            // Try to delete project
            const response = await (0, supertest_1.default)(app)
                .delete(`/api/projects/${projectId}`)
                .expect(400);
            expect(response.body).toMatchObject({
                error: true,
                code: 'PROJECT_HAS_DEPENDENCIES'
            });
        });
    });
});
//# sourceMappingURL=projects.test.js.map