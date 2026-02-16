import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorInitCommand } from '../../src/commands/orchestrator-init.js';

describe('OrchestratorInitCommand', () => {
  let command: OrchestratorInitCommand;

  beforeEach(() => {
    command = new OrchestratorInitCommand();
  });

  describe('getManifestPath', () => {
    it('should read manifest path from MAESTRO_MANIFEST_PATH', () => {
      const originalEnv = process.env.MAESTRO_MANIFEST_PATH;

      try {
        process.env.MAESTRO_MANIFEST_PATH = '/path/to/manifest.json';

        const path = command.getManifestPath();

        expect(path).toBe('/path/to/manifest.json');
      } finally {
        if (originalEnv) {
          process.env.MAESTRO_MANIFEST_PATH = originalEnv;
        } else {
          delete process.env.MAESTRO_MANIFEST_PATH;
        }
      }
    });

    it('should throw error if MAESTRO_MANIFEST_PATH not set', () => {
      const originalEnv = process.env.MAESTRO_MANIFEST_PATH;

      try {
        delete process.env.MAESTRO_MANIFEST_PATH;

        expect(() => {
          command.getManifestPath();
        }).toThrow(/MAESTRO_MANIFEST_PATH/);
      } finally {
        if (originalEnv) {
          process.env.MAESTRO_MANIFEST_PATH = originalEnv;
        }
      }
    });
  });

  describe('getSessionId', () => {
    it('should read session ID from env', () => {
      const originalEnv = process.env.MAESTRO_SESSION_ID;

      try {
        process.env.MAESTRO_SESSION_ID = 'test-session-456';

        const sessionId = command.getSessionId();

        expect(sessionId).toBe('test-session-456');
      } finally {
        if (originalEnv) {
          process.env.MAESTRO_SESSION_ID = originalEnv;
        } else {
          delete process.env.MAESTRO_SESSION_ID;
        }
      }
    });

    it('should generate session ID if not in env', () => {
      const originalEnv = process.env.MAESTRO_SESSION_ID;

      try {
        delete process.env.MAESTRO_SESSION_ID;

        const sessionId = command.getSessionId();

        expect(sessionId).toBeDefined();
        expect(sessionId).toContain('session-');
      } finally {
        if (originalEnv) {
          process.env.MAESTRO_SESSION_ID = originalEnv;
        }
      }
    });
  });

  describe('validation', () => {
    it('should validate coordinate mode', () => {
      const manifest = {
        manifestVersion: '1.0',
        mode: 'coordinate' as const,
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'opus' as const,
          permissionMode: 'interactive' as const,
        },
      };

      const isValid = command.validateOrchestratorManifest(manifest);

      expect(isValid).toBe(true);
    });

    it('should reject execute mode', () => {
      const manifest = {
        manifestVersion: '1.0',
        mode: 'execute' as const,
        task: {
          id: 'task-1',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Done'],
          projectId: 'proj-1',
          createdAt: '2026-02-02T00:00:00Z',
        },
        session: {
          model: 'sonnet' as const,
          permissionMode: 'acceptEdits' as const,
        },
      };

      const isValid = command.validateOrchestratorManifest(manifest);

      expect(isValid).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should provide helpful error for missing manifest file', () => {
      const error = command.formatError('manifest_not_found', '/nonexistent/path');

      expect(error).toContain('manifest');
      expect(error).toContain('not found');
      expect(error).toContain('/nonexistent/path');
    });

    it('should provide helpful error for invalid manifest', () => {
      const error = command.formatError('invalid_manifest', 'missing required fields');

      expect(error.toLowerCase()).toContain('invalid');
      expect(error.toLowerCase()).toContain('manifest');
    });

    it('should provide helpful error for wrong mode', () => {
      const error = command.formatError('wrong_mode', 'execute');

      expect(error).toContain('coordinate');
      expect(error.toLowerCase()).toContain('execute');
    });
  });
});
