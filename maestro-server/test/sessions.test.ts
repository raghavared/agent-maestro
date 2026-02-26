import { TestDataDir, createTestContainer, createTestProject, createTestTask, createTestSession } from './helpers';

describe('SessionService', () => {
  let testDataDir: TestDataDir;
  let container: Awaited<ReturnType<typeof createTestContainer>>;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    testDataDir = new TestDataDir();
    container = await createTestContainer(testDataDir.getPath());

    // Create test project and task
    const project = await container.projectService.createProject(createTestProject());
    projectId = project.id;

    const task = await container.taskService.createTask(createTestTask(projectId));
    taskId = task.id;
  });

  afterEach(async () => {
    await testDataDir.cleanup();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const input = createTestSession(projectId, [taskId]);
      const session = await container.sessionService.createSession(input);

      expect(session).toMatchObject({
        projectId,
        taskIds: [taskId],
        name: input.name,
      });
      expect(session.id).toMatch(/^sess_/);
      expect(session.startedAt).toBeDefined();
    });

    it('should throw if projectId is invalid', async () => {
      await expect(
        container.sessionService.createSession({
          projectId: 'proj_nonexistent',
          taskIds: [taskId],
          name: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should associate session with tasks', async () => {
      const session = await container.sessionService.createSession(
        createTestSession(projectId, [taskId])
      );

      // Verify task was updated with session ID
      const task = await container.taskService.getTask(taskId);
      expect(task.sessionIds).toContain(session.id);
    });
  });

  describe('listSessions', () => {
    it('should return empty array when no sessions exist', async () => {
      const sessions = await container.sessionService.listSessions();
      expect(sessions).toEqual([]);
    });

    it('should return all sessions', async () => {
      await container.sessionService.createSession(
        createTestSession(projectId, [taskId], { name: 'Session 1' })
      );
      await container.sessionService.createSession(
        createTestSession(projectId, [taskId], { name: 'Session 2' })
      );

      const sessions = await container.sessionService.listSessions();
      expect(sessions).toHaveLength(2);
    });

    it('should filter sessions by projectId', async () => {
      const project2 = await container.projectService.createProject(
        createTestProject({ name: 'Project 2' })
      );
      const task2 = await container.taskService.createTask(
        createTestTask(project2.id)
      );

      await container.sessionService.createSession(
        createTestSession(projectId, [taskId])
      );
      await container.sessionService.createSession(
        createTestSession(project2.id, [task2.id])
      );

      const sessions = await container.sessionService.listSessions({ projectId });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].projectId).toBe(projectId);
    });
  });

  describe('getSession', () => {
    it('should return a session by ID', async () => {
      const created = await container.sessionService.createSession(
        createTestSession(projectId, [taskId])
      );
      const found = await container.sessionService.getSession(created.id);
      expect(found.id).toBe(created.id);
    });

    it('should throw for non-existent session', async () => {
      await expect(
        container.sessionService.getSession('sess_nonexistent')
      ).rejects.toThrow();
    });
  });

  describe('updateSession', () => {
    it('should update session status', async () => {
      const created = await container.sessionService.createSession(
        createTestSession(projectId, [taskId])
      );
      const updated = await container.sessionService.updateSession(created.id, {
        status: 'completed',
      });
      expect(updated.status).toBe('completed');
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const created = await container.sessionService.createSession(
        createTestSession(projectId, [taskId])
      );
      await container.sessionService.deleteSession(created.id);
      await expect(
        container.sessionService.getSession(created.id)
      ).rejects.toThrow();
    });
  });

  describe('addTaskToSession', () => {
    it('should add a task to a session', async () => {
      const task2 = await container.taskService.createTask(
        createTestTask(projectId, { title: 'Task 2' })
      );
      const session = await container.sessionService.createSession(
        createTestSession(projectId, [taskId])
      );

      await container.sessionService.addTaskToSession(session.id, task2.id);
      const updated = await container.sessionService.getSession(session.id);
      expect(updated.taskIds).toContain(task2.id);
    });
  });
});
