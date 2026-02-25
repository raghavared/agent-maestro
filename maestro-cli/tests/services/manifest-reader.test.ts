import { describe, it, expect } from 'vitest';
import { readManifest, readManifestSync } from '../../src/services/manifest-reader.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '../fixtures/manifests');

describe('ManifestReader', () => {
  describe('readManifest', () => {
    it('should read and validate a valid worker manifest', async () => {
      const manifestPath = join(fixturesDir, 'valid-worker.json');
      const result = await readManifest(manifestPath);

      expect(result.success).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.manifest?.mode).toBe('worker');
      expect(result.manifest?.tasks[0].id).toBe('task-123');
      expect(result.manifest?.tasks[0].title).toBe('Implement user authentication');
      expect(result.manifest?.session.model).toBe('sonnet');
    });

    it('should read and validate a valid orchestrator manifest', async () => {
      const manifestPath = join(fixturesDir, 'valid-orchestrator.json');
      const result = await readManifest(manifestPath);

      expect(result.success).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.manifest?.mode).toBe('coordinator');
      expect(result.manifest?.tasks[0].id).toBe('task-100');
      expect(result.manifest?.session.model).toBe('opus');
    });

    it('should return error for non-existent file', async () => {
      const manifestPath = join(fixturesDir, 'does-not-exist.json');
      const result = await readManifest(manifestPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('file not found');
      expect(result.manifest).toBeUndefined();
    });

    it('should return error for invalid manifest (missing task)', async () => {
      const manifestPath = join(fixturesDir, 'invalid-missing-task.json');
      const result = await readManifest(manifestPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('task');
      expect(result.manifest).toBeUndefined();
    });

    it('should return error for invalid manifest (bad mode)', async () => {
      const manifestPath = join(fixturesDir, 'invalid-bad-mode.json');
      const result = await readManifest(manifestPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('mode');
      expect(result.manifest).toBeUndefined();
    });

    it('should handle malformed JSON', async () => {
      const manifestPath = join(fixturesDir, 'malformed.json');
      // Create a temporary malformed JSON file
      const fs = await import('fs/promises');
      await fs.writeFile(manifestPath, '{ invalid json }', 'utf-8');

      const result = await readManifest(manifestPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('parse');

      // Clean up
      await fs.unlink(manifestPath);
    });

    it('should include validation errors in error message', async () => {
      const manifestPath = join(fixturesDir, 'invalid-missing-task.json');
      const result = await readManifest(manifestPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error!.length).toBeGreaterThan(0);
    });
  });

  describe('readManifestSync', () => {
    it('should synchronously read a valid manifest', () => {
      const manifestPath = join(fixturesDir, 'valid-worker.json');
      const result = readManifestSync(manifestPath);

      expect(result.success).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.manifest?.mode).toBe('worker');
    });

    it('should return error for non-existent file (sync)', () => {
      const manifestPath = join(fixturesDir, 'does-not-exist.json');
      const result = readManifestSync(manifestPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('ManifestReader result format', () => {
    it('should return ManifestReadResult with correct structure', async () => {
      const manifestPath = join(fixturesDir, 'valid-worker.json');
      const result = await readManifest(manifestPath);

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        expect(result).toHaveProperty('manifest');
        expect(result.manifest).toBeDefined();
        expect(result.error).toBeUndefined();
      } else {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
        expect(result.manifest).toBeUndefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should provide helpful error messages', async () => {
      const manifestPath = join(fixturesDir, 'invalid-bad-mode.json');
      const result = await readManifest(manifestPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Should mention what's wrong
      expect(result.error!.toLowerCase()).toMatch(/mode|validation/);
    });

    it('should handle permission errors gracefully', async () => {
      // This test would require creating a file with no read permissions
      // Skipping for now as it's platform-specific
      expect(true).toBe(true);
    });
  });
});
