import { describe, expect, it } from 'vitest';
import {
  AGENT_TOOL_OPTIONS,
  AGENT_TOOL_LABELS,
  CODEX_REASONING_EFFORT_OPTIONS,
  DEFAULT_MODEL_BY_AGENT_TOOL,
  formatProviderModelLabel,
  MODELS_BY_AGENT_TOOL,
} from '../app/constants/agentTools';
import { DEFAULT_AGENT_SHORTCUT_IDS } from '../app/constants/defaults';

describe('agent tool UI constants', () => {
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

  it('formats task launch badges as Provider/Model', () => {
    expect(formatProviderModelLabel('claude-code', 'claude-opus-4-7')).toBe('Claude/Opus 4.7');
    expect(formatProviderModelLabel('codex', 'gpt-5.5')).toBe('OpenAI/Codex 5.5');
  });
});
