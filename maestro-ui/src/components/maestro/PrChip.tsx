import React from 'react';
import type { MaestroSession } from '../../app/types/maestro';

export interface PrInfo {
  url: string;
  number?: number;
}

/** Extract PR identity persisted on a session's metadata (F1/F2). Returns null when none. */
export function getPrInfo(session: Pick<MaestroSession, 'metadata'>): PrInfo | null {
  const url = session.metadata?.prUrl as string | undefined;
  if (!url) return null;
  const number = session.metadata?.prNumber as number | undefined;
  return { url, number };
}

interface PrChipProps {
  url: string;
  number?: number;
  compact?: boolean;
}

/** Read-only clickable chip linking to a session's pull request (🔀 PR #N ↗). */
export function PrChip({ url, number, compact = false }: PrChipProps) {
  const label = number != null ? `#${number}` : 'PR';
  return (
    <a
      className={`prChip${compact ? ' prChip--compact' : ''}`}
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`Open pull request ${label} on GitHub`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="prChip__icon" aria-hidden="true">🔀</span>
      <span className="prChip__label">PR {label}</span>
      <span className="prChip__open" aria-hidden="true">↗</span>
    </a>
  );
}
