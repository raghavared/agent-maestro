import { TestDataDir, createTestContainer, createTestProject } from './helpers';

describe('ProjectService', () => {
  let testDataDir: TestDataDir;
  let container: Awaited<ReturnType<typeof createTestContainer>>;

  beforeEach(async () => {
    testDataDir = new TestDataDir();
    container = await createTestContainer(testDataDir.getPath());
  });

  afterEach(async () => {
    await testDataDir.cleanup();
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      const input = createTestProject();
      const project = await container.projectService.createProject(input);

      expect(project).toMatchObject({
        name: input.name,
        workingDir: input.workingDir,
        description: input.description,
      });
      expect(project.id).toMatch(/^proj_/);
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
    });

    it('should throw if name is missing', async () => {
      await expect(
        container.projectService.createProject({ name: '', workingDir: '/tmp' })
      ).rejects.toThrow('required');
    });

    it('should create project with minimal data', async () => {
      const project = await container.projectService.createProject({ name: 'Minimal', workingDir: '' });
      expect(project.name).toBe('Minimal');
      expect(project.workingDir).toBe('');
    });
  });

  describe('listProjects', () => {
    it('should return empty array when no projects exist', async () => {
      const projects = await container.projectService.listProjects();
      expect(projects).toEqual([]);
    });

    it('should return all projects', async () => {
      await container.projectService.createProject(createTestProject({ name: 'Project 1' }));
      await container.projectService.createProject(createTestProject({ name: 'Project 2' }));

      const projects = await container.projectService.listProjects();
      expect(projects).toHaveLength(2);
    });
  });

  describe('getProject', () => {
    it('should return a project by ID', async () => {
      const created = await container.projectService.createProject(createTestProject());
      const found = await container.projectService.getProject(created.id);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Test Project');
    });

    it('should throw 404 for non-existent project', async () => {
      await expect(
        container.projectService.getProject('proj_nonexistent')
      ).rejects.toThrow();
    });
  });

  describe('updateProject', () => {
    it('should update a project', async () => {
      const created = await container.projectService.createProject(createTestProject());
      const updated = await container.projectService.updateProject(created.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
      expect(updated.id).toBe(created.id);
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const created = await container.projectService.createProject(createTestProject());
      await container.projectService.deleteProject(created.id);
      await expect(
        container.projectService.getProject(created.id)
      ).rejects.toThrow();
    });

    it('should throw for non-existent project', async () => {
      await expect(
        container.projectService.deleteProject('proj_nonexistent')
      ).rejects.toThrow();
    });
  });
});
