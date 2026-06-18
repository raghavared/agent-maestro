import { normalizeModelId, LEGACY_MODEL_ALIASES } from '../src/types';

describe('normalizeModelId', () => {
  it('migrates retired Fable 5 to Opus 4.8', () => {
    expect(normalizeModelId('claude-fable-5')).toBe('claude-opus-4-8');
  });

  it('migrates retired Fable 5 1M to Opus 4.8 1M (preserves the 1M variant)', () => {
    expect(normalizeModelId('claude-fable-5[1m]')).toBe('claude-opus-4-8[1m]');
  });

  it('migrates provider-prefixed Fable ids to the Opus equivalent', () => {
    expect(normalizeModelId('anthropic:claude-fable-5')).toBe('anthropic:claude-opus-4-8');
    expect(normalizeModelId('anthropic/claude-fable-5')).toBe('anthropic:claude-opus-4-8');
  });

  it('passes active model ids through unchanged', () => {
    expect(normalizeModelId('claude-opus-4-8')).toBe('claude-opus-4-8');
    expect(normalizeModelId('claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
    expect(normalizeModelId('gpt-5.5')).toBe('gpt-5.5');
  });

  it('passes through undefined (no model configured)', () => {
    expect(normalizeModelId(undefined)).toBeUndefined();
  });

  it('does not list any retired Fable id as an active replacement target', () => {
    for (const target of Object.values(LEGACY_MODEL_ALIASES)) {
      expect(target).not.toContain('fable');
    }
  });
});
