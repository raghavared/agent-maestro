import React, { useEffect, useState, useCallback } from 'react';
import type { GitDiffSummary, GitPrInfo } from '../../app/types/maestro';
import { maestroClient } from '../../utils/MaestroClient';

export interface GitPanelProps {
  sessionId: string;
  compact?: boolean;
  onAction?: (a: 'merged' | 'pr-created' | 'discarded' | 'renamed') => void;
}

interface GitState {
  hasWorktree: boolean;
  summary?: GitDiffSummary;
  pr?: GitPrInfo;
  loading: boolean;
  error?: string;
}

export function GitPanel({ sessionId, compact = false, onAction }: GitPanelProps) {
  const [state, setState] = useState<GitState>({ hasWorktree: false, loading: true });

  const fetchGitState = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      const result = await maestroClient.getSessionGit(sessionId);
      setState({ ...result, loading: false });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load git state',
      }));
    }
  }, [sessionId]);

  useEffect(() => {
    fetchGitState();
  }, [fetchGitState]);

  if (state.loading) {
    return <div className="git-panel git-panel--loading">Loading git info…</div>;
  }

  if (state.error) {
    return <div className="git-panel git-panel--error">{state.error}</div>;
  }

  if (!state.hasWorktree) {
    return null;
  }

  return (
    <div className={`git-panel${compact ? ' git-panel--compact' : ''}`}>
      {/* Header — D1 fills branch + base + ahead/dirty */}
      <GitPanelHeader summary={state.summary} onRefresh={fetchGitState} />

      {/* Changes summary + file list — C1 fills */}
      <GitPanelChanges summary={state.summary} />

      {/* Diff viewer — C2 fills */}
      <GitPanelDiff sessionId={sessionId} summary={state.summary} />

      {/* Branch rename — D2 fills */}
      <GitPanelBranchRename
        sessionId={sessionId}
        summary={state.summary}
        onAction={onAction}
        onRefresh={fetchGitState}
      />

      {/* Merge action — E1 fills */}
      <GitPanelMerge
        sessionId={sessionId}
        summary={state.summary}
        onAction={onAction}
        onRefresh={fetchGitState}
      />

      {/* PR form + PR chip — F1/F2 fills */}
      <GitPanelPR
        sessionId={sessionId}
        pr={state.pr}
        summary={state.summary}
        onAction={onAction}
        onRefresh={fetchGitState}
      />

      {/* Discard worktree — B3 fills */}
      <GitPanelDiscard
        sessionId={sessionId}
        onAction={onAction}
        onRefresh={fetchGitState}
      />
    </div>
  );
}

// ── Sub-section stubs ─────────────────────────────────────────────────────────

interface HeaderProps {
  summary?: GitDiffSummary;
  onRefresh: () => void;
}

function GitPanelHeader({ summary, onRefresh }: HeaderProps) {
  return (
    <div className="git-panel__header">
      <span className="git-panel__branch">
        {summary ? summary.branch : '—'}
      </span>
      {summary && (
        <span className="git-panel__base">↩ {summary.baseBranch}</span>
      )}
      <button type="button" className="git-panel__refresh-btn" onClick={onRefresh} title="Refresh">
        ↻
      </button>
    </div>
  );
}

interface ChangesProps {
  summary?: GitDiffSummary;
}

function GitPanelChanges({ summary }: ChangesProps) {
  if (!summary) return null;
  return (
    <div className="git-panel__section git-panel__changes">
      {/* C1 worker fills: file list + stats */}
      <div className="git-panel__section-title">Changes</div>
      <div className="git-panel__stub">+{summary.insertions} −{summary.deletions} across {summary.filesChanged} files</div>
    </div>
  );
}

interface DiffProps {
  sessionId: string;
  summary?: GitDiffSummary;
}

function GitPanelDiff({ sessionId: _sessionId, summary: _summary }: DiffProps) {
  return null; // C2 worker fills
}

interface BranchRenameProps {
  sessionId: string;
  summary?: GitDiffSummary;
  onAction?: (a: 'renamed') => void;
  onRefresh: () => void;
}

function GitPanelBranchRename({ sessionId: _sessionId, summary: _summary, onAction: _onAction, onRefresh: _onRefresh }: BranchRenameProps) {
  return null; // D2 worker fills
}

interface MergeProps {
  sessionId: string;
  summary?: GitDiffSummary;
  onAction?: (a: 'merged') => void;
  onRefresh: () => void;
}

function GitPanelMerge({ sessionId: _sessionId, summary: _summary, onAction: _onAction, onRefresh: _onRefresh }: MergeProps) {
  return null; // E1 worker fills
}

interface PRProps {
  sessionId: string;
  pr?: GitPrInfo;
  summary?: GitDiffSummary;
  onAction?: (a: 'pr-created') => void;
  onRefresh: () => void;
}

function GitPanelPR({ sessionId: _sessionId, pr: _pr, summary: _summary, onAction: _onAction, onRefresh: _onRefresh }: PRProps) {
  return null; // F1/F2 workers fill
}

interface DiscardProps {
  sessionId: string;
  onAction?: (a: 'discarded') => void;
  onRefresh: () => void;
}

function GitPanelDiscard({ sessionId: _sessionId, onAction: _onAction, onRefresh: _onRefresh }: DiscardProps) {
  return null; // B3 worker fills
}
