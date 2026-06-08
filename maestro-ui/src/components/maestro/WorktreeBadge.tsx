import React from 'react';
import type { MaestroSession } from '../../app/types/maestro';

export interface WorktreeInfo {
  branch: string;
  path: string;
}

/** Extract worktree info from a session's metadata. Returns null when none. */
export function getWorktreeInfo(session: Pick<MaestroSession, 'metadata'>): WorktreeInfo | null {
  const branch = session.metadata?.worktreeBranch as string | undefined;
  const path = session.metadata?.worktreePath as string | undefined;
  if (!branch) return null;
  return { branch, path: path ?? '' };
}

interface WorktreeBadgeProps {
  branch: string;
  compact?: boolean;
}

/** Read-only badge showing the worktree branch (🌿 maestro/<branch>). */
export function WorktreeBadge({ branch, compact = false }: WorktreeBadgeProps) {
  return (
    <span
      className={`worktreeBadge${compact ? ' worktreeBadge--compact' : ''}`}
      title={`Worktree branch: ${branch}`}
    >
      <span className="worktreeBadge__leaf" aria-hidden="true">🌿</span>
      <span className="worktreeBadge__branch">{branch}</span>
    </span>
  );
}
