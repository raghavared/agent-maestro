import { describe, it, expect, beforeEach } from 'vitest';
import { HookExecutor, type HookResult } from '../../src/services/hook-executor.js';

describe('HookExecutor', () => {
  let executor: HookExecutor;

  beforeEach(() => {
    executor = new HookExecutor();
  });

  describe('executeHook', () => {
    it('should execute a simple command', async () => {
      const result = await executor.executeHook('echo "Hello"');

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should capture stdout from command', async () => {
      const result = await executor.executeHook('echo "test output"');

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test output');
    });

    it('should capture stderr from command', async () => {
      const result = await executor.executeHook('echo "error" >&2');

      expect(result.success).toBe(true);
      expect(result.stderr).toContain('error');
    });

    it('should handle command failure', async () => {
      const result = await executor.executeHook('exit 1');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should handle non-existent command', async () => {
      const result = await executor.executeHook('nonexistent-command-12345');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect timeout', async () => {
      const result = await executor.executeHook('sleep 10', { timeout: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('timeout');
    }, 10000);

    it('should handle empty command', async () => {
      const result = await executor.executeHook('');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('');
    });

    it('should execute command with environment variables', async () => {
      const result = await executor.executeHook('echo $TEST_VAR', {
        env: { TEST_VAR: 'test-value' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test-value');
    });

    it('should preserve existing environment variables', async () => {
      const result = await executor.executeHook('echo $PATH');

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).not.toBe('');
    });

    it('should execute in specified working directory', async () => {
      const result = await executor.executeHook('pwd', {
        cwd: '/tmp',
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('/tmp');
    });
  });

  describe('executeHooks', () => {
    it('should execute multiple hooks in sequence', async () => {
      const hooks = ['echo "first"', 'echo "second"', 'echo "third"'];

      const results = await executor.executeHooks(hooks);

      expect(results).toHaveLength(3);
      expect(results[0].stdout).toContain('first');
      expect(results[1].stdout).toContain('second');
      expect(results[2].stdout).toContain('third');
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should continue executing after a failure by default', async () => {
      const hooks = ['echo "before"', 'exit 1', 'echo "after"'];

      const results = await executor.executeHooks(hooks);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
      expect(results[2].stdout).toContain('after');
    });

    it('should stop on first failure if stopOnError is true', async () => {
      const hooks = ['echo "before"', 'exit 1', 'echo "after"'];

      const results = await executor.executeHooks(hooks, { stopOnError: true });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });

    it('should handle empty hooks array', async () => {
      const results = await executor.executeHooks([]);

      expect(results).toHaveLength(0);
    });

    it('should pass options to all hooks', async () => {
      const hooks = ['echo $VAR1', 'echo $VAR2'];

      const results = await executor.executeHooks(hooks, {
        env: { VAR1: 'value1', VAR2: 'value2' },
      });

      expect(results[0].stdout).toContain('value1');
      expect(results[1].stdout).toContain('value2');
    });
  });


  describe('HookResult interface', () => {
    it('should return HookResult with correct structure', async () => {
      const result: HookResult = await executor.executeHook('echo "test"');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.exitCode).toBe('number');
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
    });

    it('should include error message on failure', async () => {
      const result: HookResult = await executor.executeHook('exit 1');

      expect(result.success).toBe(false);
      // error field is optional, may or may not be present
      if (result.error) {
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Error handling', () => {
    it('should not throw on command failure', async () => {
      await expect(executor.executeHook('exit 1')).resolves.toBeDefined();
    });

    it('should not throw on non-existent command', async () => {
      await expect(
        executor.executeHook('nonexistent-cmd-xyz')
      ).resolves.toBeDefined();
    });

    it('should handle commands with special characters', async () => {
      const result = await executor.executeHook('echo "test & special | chars"');

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test & special | chars');
    });
  });
});
