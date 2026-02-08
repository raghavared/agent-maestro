import { describe, it, expect } from 'vitest';
import { validateManifest, type ValidationResult } from '../../src/schemas/manifest-schema.js';

describe('Manifest Schema Validation', () => {
  describe('Valid manifests', () => {
    it('should validate a minimal worker manifest', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test task',
          description: 'Test description',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate a full worker manifest with all optional fields', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Complex task',
          description: 'Complex description',
          parentId: 'task-0',
          acceptanceCriteria: ['AC1', 'AC2'],
          technicalNotes: 'Use TypeScript',
          dependencies: ['task-0'],
          complexity: 'high',
          estimatedHours: 8,
          priority: 'critical',
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
          metadata: {
            assignee: 'agent-1',
          },
        },
        session: {
          model: 'opus',
          permissionMode: 'interactive',
          thinkingMode: 'interleaved',
          maxTurns: 100,
          timeout: 3600000,
          workingDirectory: '/path/to/project',
        },
        context: {
          codebaseContext: {
            recentChanges: ['Change 1'],
            relevantFiles: ['file.ts'],
            architecture: 'microservices',
            techStack: ['TypeScript'],
          },
          relatedTasks: [
            {
              id: 'task-0',
              title: 'Related',
              relationship: 'blocks',
              status: 'completed',
            },
          ],
          projectStandards: {
            codingStyle: 'airbnb',
            testingApproach: 'TDD',
          },
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate orchestrator manifest', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'orchestrator',
        task: {
          id: 'task-1',
          title: 'Orchestrator task',
          description: 'Manage subtasks',
          acceptanceCriteria: ['All subtasks done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'opus',
          permissionMode: 'interactive',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(true);
    });

    it('should validate manifest with empty skills array', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test task',
          description: 'Test description',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
        skills: [],
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate manifest with skills array', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test task',
          description: 'Test description',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
        skills: ['skill-1', 'skill-2'],
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate manifest without skills field (optional)', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test task',
          description: 'Test description',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Invalid manifests', () => {
    it('should reject manifest without manifestVersion', () => {
      const manifest = {
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('manifestVersion');
    });

    it('should reject manifest with invalid role', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'invalid',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('role');
    });

    it('should reject manifest without task', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('task');
    });

    it('should reject task without required fields', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          // missing description, acceptanceCriteria, projectId, createdAt
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject manifest with invalid model', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'gpt-4',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('model');
    });

    it('should reject manifest with invalid permissionMode', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'fullAccess',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('permissionMode');
    });

    it('should reject manifest with invalid complexity', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
          complexity: 'extreme',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('complexity');
    });

    it('should reject manifest with invalid priority', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
          priority: 'urgent',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('priority');
    });

    it('should reject manifest with non-array acceptanceCriteria', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: 'Done',
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('acceptanceCriteria');
    });

    it('should reject manifest with invalid relationship type', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
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
          relatedTasks: [
            {
              id: 'task-0',
              title: 'Related',
              relationship: 'causes',
              status: 'done',
            },
          ],
        },
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('relationship');
    });

    it('should reject manifest with non-array skills', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
        skills: 'skill-1',
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('skills');
    });

    it('should reject manifest with non-string items in skills array', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
        skills: ['skill-1', 123],
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Validation result format', () => {
    it('should return ValidationResult with valid=true for valid manifest', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'worker',
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const result: ValidationResult = validateManifest(manifest);

      expect(result).toHaveProperty('valid');
      expect(result.valid).toBe(true);
    });

    it('should return ValidationResult with valid=false and errors for invalid manifest', () => {
      const manifest = {
        manifestVersion: '1.0',
        role: 'invalid',
      };

      const result: ValidationResult = validateManifest(manifest);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(typeof result.errors).toBe('string');
    });
  });
});
