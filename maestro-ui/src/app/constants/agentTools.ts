import type { AgentTool, ModelType } from "../types/maestro";

export type AgentToolOption = {
  id: AgentTool;
  label: string;
  shortLabel: string;
  symbol: string;
  models: { value: ModelType; id: ModelType; label: string }[];
};

const withIds = (models: { value: ModelType; label: string }[]) =>
  models.map((model) => ({ ...model, id: model.value }));

export const MODELS_BY_AGENT_TOOL: Record<AgentTool, { value: ModelType; label: string }[]> = {
  "claude-code": [
    { value: "haiku", label: "Haiku" },
    { value: "sonnet", label: "Sonnet" },
    { value: "sonnet[1m]", label: "Sonnet [1M]" },
    { value: "opus", label: "Opus" },
    { value: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { value: "claude-opus-4-7[1m]", label: "Claude Opus 4.7 [1M]" },
    { value: "opus[1m]", label: "Opus [1M]" },
  ],
  codex: [
    { value: "gpt-5.5", label: "GPT 5.5" },
    { value: "gpt-5.4", label: "GPT 5.4" },
    { value: "gpt-5.3-codex", label: "GPT 5.3 Codex" },
    { value: "gpt-5.2-codex", label: "GPT 5.2 Codex" },
  ],
  hermes: [
    { value: "hermes-default", label: "Hermes default" },
    { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
    { value: "openai/gpt-5.5", label: "OpenAI GPT 5.5" },
    { value: "openai/gpt-5.4", label: "OpenAI GPT 5.4" },
    { value: "gpt-5.4", label: "GPT 5.4" },
  ],
  gemini: [
    { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
};

export const DEFAULT_MODEL_BY_AGENT_TOOL: Record<AgentTool, ModelType> = {
  "claude-code": "sonnet",
  codex: "gpt-5.4",
  hermes: "hermes-default",
  gemini: "gemini-3-pro-preview",
};

export const AGENT_TOOL_LABELS: Record<AgentTool, string> = {
  "claude-code": "Claude Code",
  codex: "OpenAI Codex",
  hermes: "Hermes",
  gemini: "Google Gemini",
};

export const AGENT_TOOL_SHORT_LABELS: Record<AgentTool, string> = {
  "claude-code": "Claude",
  codex: "Codex",
  hermes: "Hermes",
  gemini: "Gemini",
};

export const AGENT_TOOL_SYMBOLS: Record<AgentTool, string> = {
  "claude-code": "◈",
  codex: "◇",
  hermes: "✶",
  gemini: "◆",
};

export const AGENT_TOOLS: AgentTool[] = ["claude-code", "codex", "hermes", "gemini"];

export const AGENT_TOOL_OPTIONS: AgentToolOption[] = AGENT_TOOLS.map((id) => ({
  id,
  label: AGENT_TOOL_LABELS[id],
  shortLabel: AGENT_TOOL_SHORT_LABELS[id],
  symbol: AGENT_TOOL_SYMBOLS[id],
  models: withIds(MODELS_BY_AGENT_TOOL[id]),
}));
