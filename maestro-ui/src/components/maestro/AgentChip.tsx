import type { AgentTool } from "../../app/types/maestro";

type LogoProps = { size?: number };

// Monochrome brand marks. All use currentColor so they inherit the chip's
// accent color (set per-tool in CSS via `.agentChip--<tool>`).

function ClaudeLogo({ size = 12 }: LogoProps) {
  // Anthropic-style radial sunburst.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="12" y1="3.5" x2="12" y2="20.5" />
      <line x1="3.5" y1="12" x2="20.5" y2="12" />
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function CodexLogo({ size = 12 }: LogoProps) {
  // OpenAI-style six-petal rosette.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <ellipse cx="12" cy="12" rx="3.4" ry="8" />
      <ellipse cx="12" cy="12" rx="3.4" ry="8" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="3.4" ry="8" transform="rotate(120 12 12)" />
    </svg>
  );
}

function GeminiLogo({ size = 12 }: LogoProps) {
  // Gemini four-point sparkle.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1c.5 5.9 5.1 10.5 11 11-5.9.5-10.5 5.1-11 11-.5-5.9-5.1-10.5-11-11C6.9 11.5 11.5 6.9 12 1Z" />
    </svg>
  );
}

function HermesLogo({ size = 12 }: LogoProps) {
  // Six-spoke asterisk.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="4.2" y1="7.5" x2="19.8" y2="16.5" />
      <line x1="4.2" y1="16.5" x2="19.8" y2="7.5" />
    </svg>
  );
}

const AGENT_LOGOS: Record<AgentTool, (props: LogoProps) => JSX.Element> = {
  "claude-code": ClaudeLogo,
  codex: CodexLogo,
  hermes: HermesLogo,
  gemini: GeminiLogo,
};

const AGENT_CHIP_NAMES: Record<AgentTool, string> = {
  "claude-code": "Claude",
  codex: "Codex",
  hermes: "Hermes",
  gemini: "Gemini",
};

export function AgentLogo({ agentTool, size = 12, className }: { agentTool?: AgentTool | null; size?: number; className?: string }) {
  if (!agentTool) return null;
  const Logo = AGENT_LOGOS[agentTool];
  if (!Logo) return null;
  return (
    <span className={`agentChip__logo${className ? ` ${className}` : ""}`} aria-hidden="true">
      <Logo size={size} />
    </span>
  );
}

export function AgentChip({
  agentTool,
  model,
  size = 12,
  className,
  title,
}: {
  agentTool?: AgentTool | null;
  model?: string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  if (!agentTool) return null;
  const name = AGENT_CHIP_NAMES[agentTool] ?? agentTool;
  return (
    <span className={`agentChip agentChip--${agentTool}${className ? ` ${className}` : ""}`} title={title ?? name}>
      <AgentLogo agentTool={agentTool} size={size} />
      <span className="agentChip__name">{name}</span>
      {model && <span className="agentChip__model">{model}</span>}
    </span>
  );
}
