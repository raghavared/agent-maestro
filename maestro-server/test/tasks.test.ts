import { TestDataDir, createTestContainer, createTestProject, createTestTask } from './helpers';

describe('TaskService', () => {
  let testDataDir: TestDataDir;
  let container: Awaited<ReturnType<typeof createTestContainer>>;
  let projectId: string;

  beforeEach(async () => {
    testDataDir = new TestDataDir();
    container = await createTestContainer(testDataDir.getPath());

    // Create a test project
    const project = await container.projectService.createProject(createTestProject());
    projectId = project.id;
  });

  afterEach(async () => {
    await testDataDir.cleanup();
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const input = createTestTask(projectId);
      const task = await container.taskService.createTask(input);

      expect(task).toMatchObject({
        projectId,
        title: input.title,
        description: input.description,
      });
      expect(task.id).toMatch(/^task_/);
      expect(task.createdAt).toBeDefined();
    });

    it('should throw if projectId is missing', async () => {
      await expect(
        container.taskService.createTask({ projectId: '', title: 'Test' })
      ).rejects.toThrow();
    });

    it('should throw if title is missing', async () => {
      await expect(
        container.taskService.createTask({ projectId, title: '' })
      ).rejects.toThrow();
    });

    it('should create a task with parentId', async () => {
      const parent = await container.taskService.createTask(
        createTestTask(projectId, { title: 'Parent Task' })
      );
      const child = await container.taskService.createTask(
        createTestTask(projectId, { title: 'Child Task', parentId: parent.id })
      );
      expect(child.parentId).toBe(parent.id);
    });
  });

  describe('listTasks', () => {
    it('should return empty array when no tasks exist', async () => {
      const tasks = await container.taskService.listTasks();
      expect(tasks).toEqual([]);
    });

    it('should return all tasks', async () => {
      await container.taskService.createTask(createTestTask(projectId, { title: 'Task 1' }));
      await container.taskService.createTask(createTestTask(projectId, { title: 'Task 2' }));

      const tasks = await container.taskService.listTasks();
      expect(tasks).toHaveLength(2);
    });

    it('should filter tasks by projectId', async () => {
      const project2 = await container.projectService.createProject(
        createTestProject({ name: 'Project 2' })
      );

      await container.taskService.createTask(createTestTask(projectId, { title: 'Task 1' }));
      await container.taskService.createTask(createTestTask(project2.id, { title: 'Task 2' }));

      const tasks = await container.taskService.listTasks({ projectId });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Task 1');
    });
  });

  describe('getTask', () => {
    it('should return a task by ID', async () => {
      const created = await container.taskService.createTask(createTestTask(projectId));
      const found = await container.taskService.getTask(created.id);
      expect(found.id).toBe(created.id);
    });

    it('should throw for non-existent task', async () => {
      await expect(
        container.taskService.getTask('task_nonexistent')
      ).rejects.toThrow();
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const created = await container.taskService.createTask(createTestTask(projectId));
      const updated = await container.taskService.updateTask(created.id, {
        title: 'Updated Title',
        priority: 'high',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('high');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const created = await container.taskService.createTask(createTestTask(projectId));
      await container.taskService.deleteTask(created.id);
      await expect(
        container.taskService.getTask(created.id)
      ).rejects.toThrow();
    });
  });

  describe('listChildTasks', () => {
    it('should return child tasks', async () => {
      const parent = await container.taskService.createTask(
        createTestTask(projectId, { title: 'Parent' })
      );
      await container.taskService.createTask(
        createTestTask(projectId, { title: 'Child 1', parentId: parent.id })
      );
      await container.taskService.createTask(
        createTestTask(projectId, { title: 'Child 2', parentId: parent.id })
      );

      const children = await container.taskService.listChildTasks(parent.id);
      expect(children).toHaveLength(2);
      expect(children.every(t => t.parentId === parent.id)).toBe(true);
    });
  });
});
