import { describe, expect, it } from 'vitest';
import {
  AGENT_TOOL_OPTIONS,
  AGENT_TOOL_LABELS,
  DEFAULT_MODEL_BY_AGENT_TOOL,
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
      expect.arrayContaining(['codex', 'claude', 'hermes']),
    );
  });
});
