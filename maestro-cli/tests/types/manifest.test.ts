import { describe, it, expect } from 'vitest';
import type {
  MaestroManifest,
  TaskData,
  SessionConfig,
  AdditionalContext,
  CodebaseContext,
  RelatedTask,
  ProjectStandards
} from '../../src/types/manifest.js';

describe('Manifest Types', () => {
  describe('MaestroManifest', () => {
    it('should define valid worker manifest', () => {
      const manifest: MaestroManifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Implement authentication',
          description: 'Add OAuth2 authentication to the API',
          acceptanceCriteria: [
            'User can log in with OAuth2',
            'Tokens are stored securely',
            'Session management works'
          ],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      expect(manifest).toBeDefined();
      expect(manifest.role).toBe('worker');
      expect(manifest.manifestVersion).toBe('1.0');
      expect(manifest.task.id).toBe('task-1');
      expect(manifest.session.model).toBe('sonnet');
    });

    it('should define valid orchestrator manifest', () => {
      const manifest: MaestroManifest = {
        manifestVersion: '1.0',
        role: 'orchestrator',
        task: {
          id: 'task-2',
          title: 'Build user management system',
          description: 'Complete user management with auth and profiles',
          acceptanceCriteria: ['All subtasks completed'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'opus',
          permissionMode: 'interactive',
        },
      };

      expect(manifest.role).toBe('orchestrator');
      expect(manifest.session.model).toBe('opus');
    });

    it('should include optional skills array', () => {
      const manifest: MaestroManifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-3',
          title: 'Test task',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'haiku',
          permissionMode: 'readOnly',
        },
      };

      expect(manifest.manifestVersion).toBe('1.0');
      expect(manifest.role).toBe('worker');
    });

    it('should include optional context', () => {
      const manifest: MaestroManifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-4',
          title: 'Test task',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
        context: {
          codebaseContext: {
            recentChanges: ['Added auth module'],
            relevantFiles: ['src/auth/index.ts'],
          },
          relatedTasks: [
            {
              id: 'task-0',
              title: 'Setup project',
              relationship: 'blocks',
              status: 'completed',
            },
          ],
        },
      };

      expect(manifest.context).toBeDefined();
      expect(manifest.context?.codebaseContext?.recentChanges).toHaveLength(1);
      expect(manifest.context?.relatedTasks).toHaveLength(1);
    });
  });

  describe('TaskData', () => {
    it('should define required task fields', () => {
      const task: TaskData = {
        id: 'task-1',
        title: 'Task title',
        description: 'Task description',
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
      };

      expect(task.id).toBe('task-1');
      expect(task.acceptanceCriteria).toHaveLength(2);
    });

    it('should include optional task fields', () => {
      const task: TaskData = {
        id: 'task-2',
        title: 'Complex task',
        description: 'A complex task',
        acceptanceCriteria: ['Done'],
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
        parentId: 'task-1',
        technicalNotes: 'Use TypeScript',
        dependencies: ['task-0'],
        complexity: 'high',
        estimatedHours: 8,
        priority: 'critical',
        metadata: {
          assignee: 'agent-1',
          tags: ['backend', 'auth'],
        },
      };

      expect(task.parentId).toBe('task-1');
      expect(task.complexity).toBe('high');
      expect(task.priority).toBe('critical');
      expect(task.metadata?.assignee).toBe('agent-1');
    });

    it('should allow null parentId for root tasks', () => {
      const task: TaskData = {
        id: 'task-1',
        title: 'Root task',
        description: 'A root task',
        acceptanceCriteria: ['Done'],
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
        parentId: null,
      };

      expect(task.parentId).toBeNull();
    });
  });

  describe('SessionConfig', () => {
    it('should define required session config', () => {
      const config: SessionConfig = {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      };

      expect(config.model).toBe('sonnet');
      expect(config.permissionMode).toBe('acceptEdits');
    });

    it('should include optional session fields', () => {
      const config: SessionConfig = {
        model: 'opus',
        permissionMode: 'interactive',
        thinkingMode: 'interleaved',
        maxTurns: 100,
        timeout: 3600000,
        workingDirectory: '/path/to/project',
      };

      expect(config.thinkingMode).toBe('interleaved');
      expect(config.maxTurns).toBe(100);
      expect(config.timeout).toBe(3600000);
      expect(config.workingDirectory).toBe('/path/to/project');
    });

    it('should accept all valid model types', () => {
      const models: Array<'sonnet' | 'opus' | 'haiku'> = ['sonnet', 'opus', 'haiku'];

      models.forEach(model => {
        const config: SessionConfig = {
          model,
          permissionMode: 'acceptEdits',
        };
        expect(config.model).toBe(model);
      });
    });

    it('should accept all valid permission modes', () => {
      const modes: Array<'acceptEdits' | 'interactive' | 'readOnly'> = [
        'acceptEdits',
        'interactive',
        'readOnly',
      ];

      modes.forEach(mode => {
        const config: SessionConfig = {
          model: 'sonnet',
          permissionMode: mode,
        };
        expect(config.permissionMode).toBe(mode);
      });
    });
  });

  describe('AdditionalContext', () => {
    it('should define optional context fields', () => {
      const context: AdditionalContext = {
        codebaseContext: {
          recentChanges: ['Change 1'],
          relevantFiles: ['file1.ts'],
          architecture: 'microservices',
          techStack: ['TypeScript', 'Node.js'],
        },
        relatedTasks: [
          {
            id: 'task-1',
            title: 'Related task',
            relationship: 'depends_on',
            status: 'completed',
          },
        ],
        projectStandards: {
          codingStyle: 'airbnb',
          testingApproach: 'TDD',
          documentation: 'JSDoc',
          customGuidelines: ['Always use async/await'],
        },
        custom: {
          apiVersion: 'v2',
          environment: 'staging',
        },
      };

      expect(context.codebaseContext).toBeDefined();
      expect(context.relatedTasks).toHaveLength(1);
      expect(context.projectStandards).toBeDefined();
      expect(context.custom).toBeDefined();
    });
  });

  describe('CodebaseContext', () => {
    it('should define codebase context fields', () => {
      const context: CodebaseContext = {
        recentChanges: ['Added feature X', 'Fixed bug Y'],
        relevantFiles: ['src/index.ts', 'src/utils.ts'],
        architecture: 'monolithic',
        techStack: ['TypeScript', 'Express', 'PostgreSQL'],
        dependencies: {
          express: '^4.18.0',
          typescript: '^5.0.0',
        },
      };

      expect(context.recentChanges).toHaveLength(2);
      expect(context.relevantFiles).toHaveLength(2);
      expect(context.architecture).toBe('monolithic');
      expect(context.dependencies).toBeDefined();
    });
  });

  describe('RelatedTask', () => {
    it('should define related task with all relationships', () => {
      const relationships: Array<'blocks' | 'blocked_by' | 'depends_on' | 'related_to'> = [
        'blocks',
        'blocked_by',
        'depends_on',
        'related_to',
      ];

      relationships.forEach(relationship => {
        const task: RelatedTask = {
          id: 'task-1',
          title: 'Related task',
          relationship,
          status: 'in_progress',
          description: 'Task description',
        };

        expect(task.relationship).toBe(relationship);
      });
    });
  });

  describe('ProjectStandards', () => {
    it('should define project standards', () => {
      const standards: ProjectStandards = {
        codingStyle: 'Google Style Guide',
        testingApproach: 'BDD',
        documentation: 'Markdown',
        branchingStrategy: 'Git Flow',
        cicdPipeline: 'GitHub Actions',
        customGuidelines: [
          'Use feature flags',
          'Write integration tests',
        ],
      };

      expect(standards.codingStyle).toBe('Google Style Guide');
      expect(standards.testingApproach).toBe('BDD');
      expect(standards.customGuidelines).toHaveLength(2);
    });
  });
});
