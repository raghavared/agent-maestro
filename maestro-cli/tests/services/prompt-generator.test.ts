import { describe, it, expect, beforeAll } from 'vitest';
import { PromptGenerator } from '../../src/services/prompt-generator.js';
import type { MaestroManifest } from '../../src/types/manifest.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatesDir = join(__dirname, '../../templates');

describe('PromptGenerator', () => {
  let workerManifest: MaestroManifest;
  let orchestratorManifest: MaestroManifest;
  let generator: PromptGenerator;

  beforeAll(() => {
    generator = new PromptGenerator(templatesDir);

    workerManifest = {
      manifestVersion: '1.0',
      role: 'worker',
      task: {
        id: 'task-123',
        title: 'Implement authentication',
        description: 'Add OAuth2 authentication to the API',
        acceptanceCriteria: [
          'Users can log in with OAuth2',
          'Access tokens are validated',
          'Session management works',
        ],
        technicalNotes: 'Use Passport.js library',
        complexity: 'high',
        priority: 'critical',
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
      },
      session: {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      },
      context: {
        codebaseContext: {
          recentChanges: ['Added user model', 'Set up database'],
          relevantFiles: ['src/auth/index.ts', 'src/models/user.ts'],
          architecture: 'microservices',
          techStack: ['TypeScript', 'Express', 'PostgreSQL'],
        },
        relatedTasks: [
          {
            id: 'task-122',
            title: 'Set up database',
            relationship: 'blocks',
            status: 'completed',
          },
        ],
        projectStandards: {
          codingStyle: 'Airbnb',
          testingApproach: 'TDD',
          documentation: 'JSDoc',
        },
      },
    };

    orchestratorManifest = {
      manifestVersion: '1.0',
      role: 'orchestrator',
      task: {
        id: 'task-100',
        title: 'Build user management system',
        description: 'Coordinate all subtasks to build user management',
        acceptanceCriteria: [
          'All subtasks completed',
          'Integration tests pass',
          'System deployed',
        ],
        priority: 'high',
        projectId: 'proj-1',
        createdAt: '2026-02-02T09:00:00Z',
      },
      session: {
        model: 'opus',
        permissionMode: 'interactive',
      },
    };
  });

  describe('Template Loading', () => {
    it('should load worker template', () => {
      const template = generator.loadTemplate('worker');
      expect(template).toBeDefined();
      expect(template).toContain('Maestro Worker Session');
      expect(template).toContain('${TASK_ID}');
    });

    it('should load orchestrator template', () => {
      const template = generator.loadTemplate('orchestrator');
      expect(template).toBeDefined();
      expect(template).toContain('Maestro Orchestrator Session');
      expect(template).toContain('${TASK_ID}');
    });

    it('should throw error for missing template', () => {
      expect(() => {
        generator.loadTemplate('nonexistent');
      }).toThrow(/template not found/i);
    });
  });

  describe('Worker Prompt Generation', () => {
    it('should generate worker prompt from manifest', () => {
      const prompt = generator.generatePrompt(workerManifest);

      expect(prompt).toBeDefined();
      expect(prompt).toContain('task-123');
      expect(prompt).toContain('Implement authentication');
      expect(prompt).toContain('Add OAuth2 authentication to the API');
    });

    it('should substitute all basic variables', () => {
      const prompt = generator.generatePrompt(workerManifest);

      expect(prompt).toContain('task-123'); // TASK_ID
      expect(prompt).toContain('Implement authentication'); // TASK_TITLE
      expect(prompt).toContain('Add OAuth2 authentication'); // TASK_DESCRIPTION
      expect(prompt).toContain('critical'); // TASK_PRIORITY
      expect(prompt).toContain('high'); // TASK_COMPLEXITY
    });

    it('should format acceptance criteria as numbered list', () => {
      const prompt = generator.generatePrompt(workerManifest);

      expect(prompt).toContain('1. Users can log in with OAuth2');
      expect(prompt).toContain('2. Access tokens are validated');
      expect(prompt).toContain('3. Session management works');
    });

    it('should include technical notes when present', () => {
      const prompt = generator.generatePrompt(workerManifest);

      expect(prompt).toContain('Use Passport.js library');
    });

    it('should include codebase context when present', () => {
      const prompt = generator.generatePrompt(workerManifest);

      expect(prompt).toContain('Added user model');
      expect(prompt).toContain('src/auth/index.ts');
      expect(prompt).toContain('microservices');
      expect(prompt).toContain('TypeScript');
    });

    it('should include related tasks when present', () => {
      const prompt = generator.generatePrompt(workerManifest);

      expect(prompt).toContain('task-122');
      expect(prompt).toContain('Set up database');
      expect(prompt).toContain('blocks');
      expect(prompt).toContain('completed');
    });

    it('should include project standards when present', () => {
      const prompt = generator.generatePrompt(workerManifest);

      expect(prompt).toContain('Airbnb');
      expect(prompt).toContain('TDD');
      expect(prompt).toContain('JSDoc');
    });

    it('should handle manifest without optional fields', () => {
      const minimalManifest: MaestroManifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Simple task',
          description: 'Do something',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'haiku',
          permissionMode: 'readOnly',
        },
      };

      const prompt = generator.generatePrompt(minimalManifest);

      expect(prompt).toBeDefined();
      expect(prompt).toContain('task-1');
      expect(prompt).toContain('Simple task');
      // Should not have errors or undefined strings
      expect(prompt).not.toContain('undefined');
      expect(prompt).not.toContain('${');
    });
  });

  describe('Orchestrator Prompt Generation', () => {
    it('should generate orchestrator prompt from manifest', () => {
      const prompt = generator.generatePrompt(orchestratorManifest);

      expect(prompt).toBeDefined();
      expect(prompt).toContain('task-100');
      expect(prompt).toContain('Build user management system');
      expect(prompt).toContain('Maestro Orchestrator');
    });

    it('should substitute all variables in orchestrator template', () => {
      const prompt = generator.generatePrompt(orchestratorManifest);

      expect(prompt).toContain('task-100'); // TASK_ID
      expect(prompt).toContain('Build user management system'); // TASK_TITLE
      expect(prompt).toContain('Coordinate all subtasks'); // TASK_DESCRIPTION
      expect(prompt).toContain('high'); // TASK_PRIORITY
    });

    it('should format acceptance criteria in orchestrator prompt', () => {
      const prompt = generator.generatePrompt(orchestratorManifest);

      expect(prompt).toContain('1. All subtasks completed');
      expect(prompt).toContain('2. Integration tests pass');
      expect(prompt).toContain('3. System deployed');
    });
  });

  describe('Variable Substitution', () => {
    it('should replace all occurrences of a variable', () => {
      const manifest: MaestroManifest = {
        ...workerManifest,
        task: {
          ...workerManifest.task,
          id: 'repeated-id',
        },
      };

      const prompt = generator.generatePrompt(manifest);
      const matches = prompt.match(/repeated-id/g);

      expect(matches).toBeDefined();
      expect(matches!.length).toBeGreaterThan(1);
    });

    it('should handle empty strings gracefully', () => {
      const manifest: MaestroManifest = {
        ...workerManifest,
        task: {
          ...workerManifest.task,
          technicalNotes: '',
        },
      };

      const prompt = generator.generatePrompt(manifest);

      expect(prompt).toBeDefined();
      expect(prompt).not.toContain('undefined');
    });

    it('should handle missing optional fields gracefully', () => {
      const manifest: MaestroManifest = {
        ...workerManifest,
        context: undefined,
      };

      const prompt = generator.generatePrompt(manifest);

      expect(prompt).toBeDefined();
      expect(prompt).not.toContain('undefined');
      expect(prompt).not.toContain('${');
    });
  });

  describe('Formatting Helpers', () => {
    it('should format acceptance criteria as numbered list', () => {
      const criteria = [
        'First criterion',
        'Second criterion',
        'Third criterion',
      ];

      const formatted = generator.formatAcceptanceCriteria(criteria);

      expect(formatted).toContain('1. First criterion');
      expect(formatted).toContain('2. Second criterion');
      expect(formatted).toContain('3. Third criterion');
    });

    it('should handle empty acceptance criteria', () => {
      const formatted = generator.formatAcceptanceCriteria([]);

      expect(formatted).toBeDefined();
      expect(formatted.toLowerCase()).toContain('no acceptance criteria');
    });

    it('should format codebase context', () => {
      const context = workerManifest.context!.codebaseContext!;
      const formatted = generator.formatCodebaseContext(context);

      expect(formatted).toBeDefined();
      expect(formatted).toContain('Added user model');
      expect(formatted).toContain('src/auth/index.ts');
    });

    it('should format related tasks', () => {
      const tasks = workerManifest.context!.relatedTasks!;
      const formatted = generator.formatRelatedTasks(tasks);

      expect(formatted).toBeDefined();
      expect(formatted).toContain('task-122');
      expect(formatted).toContain('Set up database');
      expect(formatted).toContain('blocks');
    });

    it('should format project standards', () => {
      const standards = workerManifest.context!.projectStandards!;
      const formatted = generator.formatProjectStandards(standards);

      expect(formatted).toBeDefined();
      expect(formatted).toContain('Airbnb');
      expect(formatted).toContain('TDD');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid role', () => {
      const invalidManifest = {
        ...workerManifest,
        role: 'invalid' as any,
      };

      expect(() => {
        generator.generatePrompt(invalidManifest);
      }).toThrow(/invalid role/i);
    });

    it('should provide helpful error messages', () => {
      try {
        generator.loadTemplate('nonexistent');
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).toBeDefined();
        expect(err.message.toLowerCase()).toContain('template');
      }
    });
  });
});
