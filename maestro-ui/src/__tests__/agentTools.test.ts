import { describe, expect, it } from 'vitest';
import {
  AGENT_TOOL_OPTIONS,
  AGENT_TOOL_LABELS,
  CODEX_REASONING_EFFORT_OPTIONS,
  DEFAULT_MODEL_BY_AGENT_TOOL,
  createLaunchConfigFromLegacy,
  formatProviderModelLabel,
  getModelDisplayLabel,
  getReasoningOptionsForProvider,
  MODEL_POWER,
  MODELS_BY_AGENT_TOOL,
  normalizeModelId,
  pickTopMember,
  sanitizeLaunchConfig,
  supportsLaunchSpeed,
} from '../app/constants/agentTools';
import { DEFAULT_AGENT_SHORTCUT_IDS } from '../app/constants/defaults';

describe('agent tool UI constants', () => {
  const claudeModels = MODELS_BY_AGENT_TOOL['claude-code'].map((model) => model.value);
  const codexModels = MODELS_BY_AGENT_TOOL.codex.map((model) => model.value);
  const claudeReasoningEfforts = ['low', 'medium', 'high', 'xhigh', 'max'];
  const codexReasoningEfforts = ['low', 'medium', 'high', 'xhigh'];
  const fastCodexModels = ['gpt-5.5', 'gpt-5.4'];

  it('exposes Hermes beside Claude and Codex in user-facing pickers', () => {
    expect(AGENT_TOOL_OPTIONS.map((tool) => tool.id)).toEqual(
      expect.arrayContaining(['claude-code', 'codex', 'hermes']),
    );
    expect(AGENT_TOOL_LABELS.hermes).toBe('Hermes');
  });

  it('provides a default Hermes model and selectable model list', () => {
    expect(DEFAULT_MODEL_BY_AGENT_TOOL.hermes).toBe('hermes-default');
    expect(MODELS_BY_AGENT_TOOL.hermes).toContainEqual({
      value: 'hermes-default',
      label: 'Hermes default',
    });
    expect(MODELS_BY_AGENT_TOOL.hermes).toContainEqual({
      value: 'anthropic:claude-opus-4-8',
      label: 'Anthropic Claude Opus 4.8',
    });
    expect(MODELS_BY_AGENT_TOOL.hermes).toContainEqual({
      value: 'nous:anthropic/claude-opus-4.8',
      label: 'Nous Claude Opus 4.8',
    });
    expect(MODELS_BY_AGENT_TOOL.hermes).toContainEqual({
      value: 'openrouter:anthropic/claude-opus-4.8',
      label: 'OpenRouter Claude Opus 4.8',
    });
    expect(MODELS_BY_AGENT_TOOL.hermes).toContainEqual({
      value: 'openai/gpt-5.5',
      label: 'Codex OAuth GPT 5.5',
    });
  });

  it('pins Hermes in the default quick-launch shortcuts', () => {
    expect(DEFAULT_AGENT_SHORTCUT_IDS).toEqual(
      expect.arrayContaining(['codex', 'claude', 'hermes', 'gemini']),
    );
  });

  it('exposes OpenAI reasoning effort options for Codex launches', () => {
    expect(CODEX_REASONING_EFFORT_OPTIONS.map((item) => item.value)).toEqual([
      'low',
      'medium',
      'high',
      'xhigh',
    ]);
  });

  it('matches Claude CLI effort support and excludes speed', () => {
    expect(DEFAULT_MODEL_BY_AGENT_TOOL['claude-code']).toBe('claude-opus-4-8');
    expect(MODELS_BY_AGENT_TOOL['claude-code'][0]).toEqual({
      value: 'claude-opus-4-8',
      label: 'Opus 4.8',
    });
    expect(getReasoningOptionsForProvider('claude').map((item) => item.value)).toEqual(claudeReasoningEfforts);

    for (const model of claudeModels) {
      expect(supportsLaunchSpeed('claude', model)).toBe(false);
      for (const effort of claudeReasoningEfforts) {
        expect(sanitizeLaunchConfig({
          provider: 'claude',
          model,
          reasoningEffort: effort as any,
          speed: 'fast',
          accessMode: 'fullAccess',
        })).toEqual({
          provider: 'claude',
          model,
          reasoningEffort: effort,
          accessMode: 'fullAccess',
        });
      }
    }

    expect(sanitizeLaunchConfig({
      provider: 'claude',
      model: 'claude-opus-4-8',
      reasoningEffort: 'minimal' as any,
    })).toEqual({
      provider: 'claude',
      model: 'claude-opus-4-8',
    });
  });

  it('matches Codex CLI reasoning and speed-tier support', () => {
    expect(getReasoningOptionsForProvider('openai').map((item) => item.value)).toEqual(codexReasoningEfforts);

    for (const model of codexModels) {
      for (const effort of codexReasoningEfforts) {
        const sanitized = sanitizeLaunchConfig({
          provider: 'openai',
          model,
          reasoningEffort: effort as any,
          speed: 'fast',
          accessMode: 'acceptEdits',
        });
        expect(sanitized).toEqual({
          provider: 'openai',
          model,
          reasoningEffort: effort,
          ...(fastCodexModels.includes(model) ? { speed: 'fast' } : {}),
          accessMode: 'acceptEdits',
        });
      }
    }

    expect(sanitizeLaunchConfig({
      provider: 'openai',
      model: 'gpt-5.5',
      reasoningEffort: 'max',
    })).toEqual({
      provider: 'openai',
      model: 'gpt-5.5',
    });
  });

  it('formats task launch badges as Provider/Model', () => {
    expect(formatProviderModelLabel('claude-code', 'claude-opus-4-8')).toBe('Claude/Opus 4.8');
    expect(formatProviderModelLabel('claude-code', 'claude-opus-4-7')).toBe('Claude/Opus 4.7');
    expect(formatProviderModelLabel('hermes', 'anthropic:claude-opus-4-8')).toBe('Hermes/Claude Opus 4.8');
    expect(formatProviderModelLabel('codex', 'gpt-5.5')).toBe('OpenAI/Codex 5.5');
  });

  it('limits speed to supported OpenAI Codex models', () => {
    expect(supportsLaunchSpeed('claude', 'claude-opus-4-8')).toBe(false);
    expect(supportsLaunchSpeed('claude', 'claude-opus-4-7')).toBe(false);
    expect(supportsLaunchSpeed('hermes', 'anthropic:claude-opus-4-8')).toBe(false);
    expect(supportsLaunchSpeed('openai', 'gpt-5.5')).toBe(true);
    expect(supportsLaunchSpeed('openai', 'gpt-5.4-mini')).toBe(false);
  });

  it('sanitizes provider-specific launch settings', () => {
    expect(sanitizeLaunchConfig({
      provider: 'claude',
      model: 'claude-opus-4-8',
      reasoningEffort: 'max',
      speed: 'fast',
    })).toEqual({
      provider: 'claude',
      model: 'claude-opus-4-8',
      reasoningEffort: 'max',
    });

    expect(sanitizeLaunchConfig({
      provider: 'hermes',
      model: 'anthropic:claude-opus-4-8',
      reasoningEffort: 'high',
      speed: 'fast',
    })).toEqual({
      provider: 'hermes',
      model: 'anthropic:claude-opus-4-8',
    });

    expect(sanitizeLaunchConfig({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      reasoningEffort: 'high',
      speed: 'fast',
    })).toEqual({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
    });
  });

  it('normalizes legacy team-member launch fields without requiring a new storage shape', () => {
    expect(createLaunchConfigFromLegacy('claude-code', 'sonnet', undefined, 'acceptEdits')).toEqual({
      provider: 'claude',
      model: 'sonnet',
      accessMode: 'acceptEdits',
    });

    expect(createLaunchConfigFromLegacy('codex', 'gpt-5.2-codex', 'high', 'bypassPermissions')).toEqual({
      provider: 'openai',
      model: 'gpt-5.2-codex',
      reasoningEffort: 'high',
      accessMode: 'fullAccess',
    });

    expect(createLaunchConfigFromLegacy(undefined, 'opus', undefined, undefined)).toEqual({
      provider: 'claude',
      model: 'opus',
    });
  });

  it('keeps legacy model names supported without showing alias choices in pickers', () => {
    expect(MODELS_BY_AGENT_TOOL['claude-code'].map((model) => model.value)).not.toEqual(
      expect.arrayContaining(['sonnet', 'sonnet[1m]', 'opus', 'opus[1m]', 'haiku']),
    );
    expect(MODELS_BY_AGENT_TOOL.codex.map((model) => model.value)).not.toContain('gpt-5.2-codex');

    expect(getModelDisplayLabel('sonnet')).toBe('Sonnet');
    expect(getModelDisplayLabel('opus[1m]')).toBe('Opus 1M');
    expect(getModelDisplayLabel('gpt-5.2-codex')).toBe('Codex 5.2');
  });

  it('no longer offers retired Claude Fable 5 and tops the Claude list with Opus 4.8', () => {
    const claudeValues = MODELS_BY_AGENT_TOOL['claude-code'].map((model) => model.value);
    expect(claudeValues).not.toContain('claude-fable-5');
    expect(claudeValues).not.toContain('claude-fable-5[1m]');
    expect(claudeValues[0]).toBe('claude-opus-4-8');
    expect(DEFAULT_MODEL_BY_AGENT_TOOL['claude-code']).toBe('claude-opus-4-8');
    expect(MODELS_BY_AGENT_TOOL.hermes.map((m) => m.value)).not.toContain('anthropic:claude-fable-5');
    expect(MODEL_POWER['claude-fable-5']).toBeUndefined();
    expect(MODEL_POWER['claude-fable-5[1m]']).toBeUndefined();
  });

  it('migrates retired Fable 5 model ids to their Opus 4.8 replacements', () => {
    // Fable 5 -> Opus 4.8; Fable 5 1M -> Opus 4.8 1M (per-variant migration).
    expect(normalizeModelId('claude-fable-5')).toBe('claude-opus-4-8');
    expect(normalizeModelId('claude-fable-5[1m]')).toBe('claude-opus-4-8[1m]');
    expect(normalizeModelId('anthropic:claude-fable-5')).toBe('anthropic:claude-opus-4-8');
    expect(normalizeModelId('anthropic/claude-fable-5')).toBe('anthropic:claude-opus-4-8');
    // Non-retired ids pass through unchanged.
    expect(normalizeModelId('claude-opus-4-8')).toBe('claude-opus-4-8');
    expect(normalizeModelId(undefined)).toBeUndefined();
  });

  it('keeps legacy Fable setups working: display, ranking, and launch config resolve to Opus', () => {
    // A persisted team member still on Fable shows and launches as Opus 4.8.
    expect(getModelDisplayLabel('claude-fable-5')).toBe('Opus 4.8');
    expect(getModelDisplayLabel('claude-fable-5[1m]')).toBe('Opus 4.8 1M');
    expect(sanitizeLaunchConfig({ provider: 'claude', model: 'claude-fable-5' })).toEqual({
      provider: 'claude',
      model: 'claude-opus-4-8',
    });
    // Ranking treats a legacy Fable member as its Opus 4.8 equivalent (not unranked/0).
    const members = [{ model: 'claude-fable-5' }, { model: 'claude-sonnet-4-6' }];
    expect(pickTopMember(members)?.model).toBe('claude-fable-5');
  });
});
