import { describe, it, expect, beforeEach } from 'vitest';
import { ManifestGenerator } from '../../src/commands/manifest-generator.js';
import type { MaestroManifest } from '../../src/types/manifest.js';

describe('ManifestGenerator', () => {
  let generator: ManifestGenerator;

  beforeEach(() => {
    generator = new ManifestGenerator();
  });

  describe('generateManifest', () => {
    it('should generate valid worker manifest', () => {
      const taskData = {
        id: 'task-123',
        title: 'Implement feature',
        description: 'Add new feature',
        acceptanceCriteria: ['Feature works', 'Tests pass'],
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
        priority: 'high' as const,
        complexity: 'medium' as const,
      };

      const manifest = generator.generateManifest('worker', taskData, {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      });

      expect(manifest.manifestVersion).toBe('1.0');
      expect(manifest.mode).toBe('worker');
      expect(manifest.tasks[0].id).toBe('task-123');
      expect(manifest.tasks[0].title).toBe('Implement feature');
      expect(manifest.session.model).toBe('sonnet');
      expect(manifest.session.permissionMode).toBe('acceptEdits');
    });

    it('should generate valid orchestrator manifest', () => {
      const taskData = {
        id: 'task-100',
        title: 'Manage project',
        description: 'Coordinate all work',
        acceptanceCriteria: ['All tasks done'],
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
      };

      const manifest = generator.generateManifest('coordinator', taskData, {
        model: 'opus',
        permissionMode: 'interactive',
      });

      expect(manifest.mode).toBe('coordinator');
      expect(manifest.session.model).toBe('opus');
      expect(manifest.session.permissionMode).toBe('interactive');
    });

    it('should handle optional fields', () => {
      const taskData = {
        id: 'task-1',
        title: 'Test',
        description: 'Test',
        acceptanceCriteria: ['Done'],
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
        dependencies: ['task-0'],
        priority: 'high' as const,
      };

      const manifest = generator.generateManifest('worker', taskData, {
        model: 'haiku',
        permissionMode: 'readOnly',
      });

      expect(manifest.tasks[0].dependencies).toEqual(['task-0']);
      expect(manifest.tasks[0].priority).toBe('high');
    });

    it('should add context if provided', () => {
      const taskData = {
        id: 'task-1',
        title: 'Test',
        description: 'Test',
        acceptanceCriteria: ['Done'],
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
      };

      const context = {
        codebaseContext: {
          recentChanges: ['Added auth'],
          relevantFiles: ['src/auth.ts'],
        },
      };

      const manifest = generator.generateManifest('worker', taskData, {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
        context,
      });

      expect(manifest.context).toBeDefined();
      expect(manifest.context?.codebaseContext?.recentChanges).toEqual(['Added auth']);
    });

    it('should normalize legacy mode aliases to canonical modes', () => {
      const taskData = {
        id: 'task-legacy',
        title: 'Legacy mode task',
        description: 'Test legacy mode normalization',
        acceptanceCriteria: ['Done'],
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
      };

      const manifest = generator.generateManifest('execute' as any, taskData, {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      });

      expect(manifest.mode).toBe('worker');
    });
  });

  describe('generateFromApi', () => {
    it('should generate manifest from task ID', async () => {
      // Mock the API call (would need actual implementation)
      const taskId = 'task-123';

      // This test would require mocking the API
      // For now, just verify the method exists
      expect(generator.generateFromApi).toBeDefined();
    });
  });

  describe('serializeManifest', () => {
    it('should serialize manifest to JSON', () => {
      const manifest: MaestroManifest = {
        manifestVersion: '1.0',
        mode: 'worker',
        tasks: [{
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        }],
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const json = generator.serializeManifest(manifest);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.mode).toBe('worker');
      expect(parsed.tasks[0].id).toBe('task-1');
    });

    it('should format JSON prettily', () => {
      const manifest: MaestroManifest = {
        manifestVersion: '1.0',
        mode: 'worker',
        tasks: [{
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        }],
        session: {
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        },
      };

      const json = generator.serializeManifest(manifest);

      // Should have indentation
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });

  describe('validation', () => {
    it('should validate generated manifest', () => {
      const taskData = {
        id: 'task-1',
        title: 'Test',
        description: 'Test',
        acceptanceCriteria: ['Done'],
        projectId: 'proj-1',
        createdAt: '2026-02-02T00:00:00Z',
      };

      const manifest = generator.generateManifest('worker', taskData, {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      });

      const isValid = generator.validateGeneratedManifest(manifest);

      expect(isValid).toBe(true);
    });
  });
});
