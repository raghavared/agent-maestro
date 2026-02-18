import React, { useState } from 'react';
import type { ParsedTeammateContent } from '../../../utils/claude-log';
import { getTeamColorSet } from '../../../utils/claude-log';

interface TeammateMessageCardProps {
  message: ParsedTeammateContent;
}

const NOISE_TYPES = new Set([
  'idle_notification', 'shutdown_approved', 'teammate_terminated', 'shutdown_request',
]);

const NOISE_LABELS: Record<string, string> = {
  idle_notification: 'Idle',
  shutdown_approved: 'Shutdown confirmed',
  teammate_terminated: 'Terminated',
  shutdown_request: 'Shutdown requested',
};

function detectNoise(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as { type?: string; message?: string };
    if (parsed.type && NOISE_TYPES.has(parsed.type)) {
      return parsed.message ?? NOISE_LABELS[parsed.type] ?? parsed.type;
    }
  } catch {
    // Not JSON
  }
  return null;
}

export function TeammateMessageCard({ message }: TeammateMessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = getTeamColorSet(message.color);
  const noiseLabel = detectNoise(message.content);

  // Noise: minimal inline row
  if (noiseLabel) {
    return (
      <div className="sessionLogTeammateNoise">
        <span className="sessionLogTeammateDot" style={{ backgroundColor: colors.border }} />
        <span className="sessionLogTeammateNoiseName">{message.teammateId}</span>
        <span className="sessionLogTeammateNoiseLabel">{noiseLabel}</span>
      </div>
    );
  }

  const truncatedSummary = message.summary.length > 80
    ? message.summary.slice(0, 80) + '...'
    : message.summary;

  return (
    <div
      className="sessionLogTeammateCard"
      style={{ borderLeftColor: colors.border }}
    >
      <div
        className="sessionLogTeammateHeader"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="sessionLogToolCardChevron">{expanded ? '▾' : '▸'}</span>
        <span className="sessionLogTeammateDot" style={{ backgroundColor: colors.border }} />
        <span
          className="sessionLogTeammateBadge"
          style={{ backgroundColor: colors.badge, color: colors.text, borderColor: `${colors.border}40` }}
        >
          {message.teammateId}
        </span>
        <span className="sessionLogTeammateType">Message</span>
        <span className="sessionLogTeammateSummary">{truncatedSummary || 'Teammate message'}</span>
      </div>
      {expanded && (
        <div className="sessionLogTeammateBody">
          {message.content}
        </div>
      )}
    </div>
  );
}
