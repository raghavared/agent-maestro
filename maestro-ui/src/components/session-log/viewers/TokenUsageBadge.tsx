import React from 'react';

interface TokenUsageBadgeProps {
  inputTokens: number;
  outputTokens: number;
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function TokenUsageBadge({ inputTokens, outputTokens }: TokenUsageBadgeProps) {
  if (inputTokens === 0 && outputTokens === 0) return null;
  return (
    <span className="sessionLogTokenBadge">
      {formatTokenCount(inputTokens)}in / {formatTokenCount(outputTokens)}out
    </span>
  );
}
