import { spawnSessionSchema } from '../src/api/validation';

/**
 * Regression tests for the spawn wire-contract.
 *
 * PR #83 introduced `launchConfig` as the canonical launch override and tightened
 * validation (strict enum for `agentTool`, `.strict()` on launchConfig). That broke
 * backward compatibility: legacy/older clients and a UI sending `launchConfig` could
 * be hard-rejected with HTTP 400 "Unrecognized key". These tests pin the contract so
 * the schema stays tolerant of legacy values and forward-compatible extra fields,
 * while still accepting new model names.
 */
describe('spawnSessionSchema — backward & forward compatibility', () => {
  const base = { projectId: 'proj_1', taskIds: ['task_1'] };

  it('accepts the canonical launchConfig the post-PR83 UI sends', () => {
    const result = spawnSessionSchema.safeParse({
      ...base,
      launchConfig: {
        provider: 'claude',
        model: 'claude-opus-4-8',
        reasoningEffort: 'max',
        accessMode: 'fullAccess',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a legacy bare agentTool value ("claude") instead of failing as an unknown enum', () => {
    const result = spawnSessionSchema.safeParse({ ...base, agentTool: 'claude', model: 'opus' });
    expect(result.success).toBe(true);
  });

  it('accepts legacy top-level model + agentTool (pre-launchConfig clients)', () => {
    const result = spawnSessionSchema.safeParse({ ...base, agentTool: 'codex', model: 'gpt-5.5' });
    expect(result.success).toBe(true);
  });

  it('tolerates unknown/future fields inside launchConfig (not .strict())', () => {
    const result = spawnSessionSchema.safeParse({
      ...base,
      launchConfig: { provider: 'openai', model: 'gpt-5.5', temperature: 0.4 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts arbitrary (new) model names — model is a free string, not an enum', () => {
    const result = spawnSessionSchema.safeParse({
      ...base,
      launchConfig: { provider: 'claude', model: 'claude-opus-9-9-future' },
    });
    expect(result.success).toBe(true);
  });

  it('still rejects a launchConfig missing required provider/model', () => {
    const result = spawnSessionSchema.safeParse({
      ...base,
      launchConfig: { reasoningEffort: 'high' },
    });
    expect(result.success).toBe(false);
  });

  it('still rejects unknown keys at the top level of the spawn body', () => {
    const result = spawnSessionSchema.safeParse({ ...base, bogusTopLevelKey: true });
    expect(result.success).toBe(false);
  });
});
