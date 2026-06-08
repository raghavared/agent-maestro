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
  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);

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

  const actionState = deriveBranchHeader(state.summary);

  return (
    <div className={`git-panel${compact ? ' git-panel--compact' : ''}`}>
      {/* Header — branch + base + ahead/behind + dirty (D1) */}
      <GitPanelHeader summary={state.summary} onRefresh={fetchGitState} />

      {/* Changes summary + file list — C1 fills */}
      <GitPanelChanges summary={state.summary} selectedFile={selectedFile} onFileClick={setSelectedFile} />

      {/* Diff viewer — C2 fills */}
      <GitPanelDiff sessionId={sessionId} summary={state.summary} selectedFile={selectedFile} />

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
        disabled={actionState.mutationDisabled}
        disabledReason={actionState.disabledReason}
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

export interface GitActionState {
  branch: string;
  baseBranch?: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  /** True when mutating actions (merge/PR/discard) should be blocked. */
  mutationDisabled: boolean;
  /** Human-readable reason a mutation is disabled, if any. */
  disabledReason?: string;
}

/**
 * Pure derivation of the branch-header presentation + action gating from C1's
 * diff summary. Exported so it can be unit-tested without rendering.
 */
export function deriveBranchHeader(summary?: GitDiffSummary): GitActionState {
  if (!summary) {
    return {
      branch: '—',
      ahead: 0,
      behind: 0,
      dirty: false,
      mutationDisabled: true,
      disabledReason: 'No git summary available',
    };
  }
  const { branch, baseBranch, ahead, behind, dirty } = summary;
  return {
    branch,
    baseBranch,
    ahead,
    behind,
    dirty,
    mutationDisabled: dirty,
    disabledReason: dirty ? 'Worktree has uncommitted changes' : undefined,
  };
}

function GitPanelHeader({ summary, onRefresh }: HeaderProps) {
  const { branch, baseBranch, ahead, behind, dirty } = deriveBranchHeader(summary);
  return (
    <div className="git-panel__header">
      <span className="git-panel__branch" title={branch}>{branch}</span>
      {baseBranch && (
        <span className="git-panel__base" title={`Base branch: ${baseBranch}`}>↩ {baseBranch}</span>
      )}
      {summary && (ahead > 0 || behind > 0) && (
        <span className="git-panel__divergence">
          {ahead > 0 && (
            <span className="git-panel__ahead" title={`${ahead} commit${ahead === 1 ? '' : 's'} ahead of ${baseBranch ?? 'base'}`}>↑{ahead}</span>
          )}
          {behind > 0 && (
            <span className="git-panel__behind" title={`${behind} commit${behind === 1 ? '' : 's'} behind ${baseBranch ?? 'base'}`}>↓{behind}</span>
          )}
        </span>
      )}
      {dirty && (
        <span className="git-panel__dirty" title="Worktree has uncommitted changes">● uncommitted</span>
      )}
      <button type="button" className="git-panel__refresh-btn" onClick={onRefresh} title="Refresh">
        ↻
      </button>
    </div>
  );
}

interface ChangesProps {
  summary?: GitDiffSummary;
  selectedFile?: string;
  onFileClick?: (file: string | undefined) => void;
}

const STATUS_LABELS: Record<string, string> = {
  A: 'A',
  M: 'M',
  D: 'D',
  R: 'R',
  '?': '?',
};

function GitPanelChanges({ summary, selectedFile, onFileClick }: ChangesProps) {
  if (!summary) return null;

  const { filesChanged, insertions, deletions, commitCount, files } = summary;
  const clickable = typeof onFileClick === 'function';

  return (
    <div className="git-panel__section git-panel__changes">
      <div className="git-panel__section-title">Changes</div>
      <div className="git-panel__changes-meta">
        <span className="git-panel__changes-count">{filesChanged} {filesChanged === 1 ? 'file' : 'files'}</span>
        <span className="git-panel__changes-ins">+{insertions}</span>
        <span className="git-panel__changes-del">−{deletions}</span>
        {commitCount > 0 && (
          <span className="git-panel__changes-commits">{commitCount} {commitCount === 1 ? 'commit' : 'commits'}</span>
        )}
      </div>
      {files.length > 0 && (
        <div className="git-panel__file-list">
          {files.map(f => {
            const isSelected = selectedFile === f.path;
            const classes = [
              'git-panel__file-row',
              clickable ? 'git-panel__file-row--clickable' : '',
              isSelected ? 'git-panel__file-row--selected' : '',
            ].filter(Boolean).join(' ');
            return (
              <div
                key={f.path}
                className={classes}
                onClick={clickable ? () => onFileClick!(isSelected ? undefined : f.path) : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onFileClick!(isSelected ? undefined : f.path);
                  }
                } : undefined}
                title={clickable ? `Show diff for ${f.path}` : f.path}
              >
                <span className={`git-panel__file-status git-panel__file-status--${f.status.toLowerCase()}`}>
                  {STATUS_LABELS[f.status] ?? f.status}
                </span>
                <span className="git-panel__file-path" title={f.path}>{f.path}</span>
                <span className="git-panel__file-stats">
                  {f.insertions > 0 && <span className="git-panel__file-ins">+{f.insertions}</span>}
                  {f.deletions > 0 && <span className="git-panel__file-del">−{f.deletions}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DiffProps {
  sessionId: string;
  summary?: GitDiffSummary;
  selectedFile?: string;
}

interface DiffState {
  expanded: boolean;
  loading: boolean;
  diff?: string;
  error?: string;
  loadedKey?: string; // marker for which (sessionId, file) combination is loaded
}

function GitPanelDiff({ sessionId, summary, selectedFile }: DiffProps) {
  const [state, setState] = useState<DiffState>({ expanded: false, loading: false });

  const hasChanges = !!summary && summary.filesChanged > 0;
  const currentKey = `${sessionId}::${selectedFile ?? '__all__'}`;

  const loadDiff = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      const result = await maestroClient.getSessionGitDiff(sessionId, selectedFile);
      setState({
        expanded: true,
        loading: false,
        diff: result.diff,
        loadedKey: currentKey,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load diff',
      }));
    }
  }, [sessionId, selectedFile, currentKey]);

  // Auto-refetch when the selected file changes while the panel is open
  useEffect(() => {
    if (state.expanded && state.loadedKey !== currentKey && !state.loading) {
      loadDiff();
    }
  }, [state.expanded, state.loadedKey, currentKey, state.loading, loadDiff]);

  if (!hasChanges) return null;

  const toggle = () => {
    if (state.expanded) {
      setState(prev => ({ ...prev, expanded: false }));
      return;
    }
    // First expand → fetch if not yet loaded for this key
    if (state.loadedKey === currentKey && state.diff !== undefined) {
      setState(prev => ({ ...prev, expanded: true }));
    } else {
      loadDiff();
    }
  };

  return (
    <div className="git-panel__section git-panel__diff">
      <button
        type="button"
        className="git-panel__diff-toggle"
        onClick={toggle}
        aria-expanded={state.expanded}
      >
        <span className="git-panel__diff-caret">{state.expanded ? '▾' : '▸'}</span>
        <span className="git-panel__diff-title">
          Diff{selectedFile ? <>: <span className="git-panel__diff-file">{selectedFile}</span></> : null}
        </span>
      </button>

      {state.expanded && (
        <div className="git-panel__diff-body">
          {state.loading && <div className="git-panel__diff-loading">Loading diff…</div>}
          {state.error && <div className="git-panel__diff-error">{state.error}</div>}
          {!state.loading && !state.error && (
            state.diff && state.diff.trim().length > 0
              ? <DiffRender diff={state.diff} />
              : <div className="git-panel__diff-empty">No changes to display.</div>
          )}
        </div>
      )}
    </div>
  );
}

function classifyDiffLine(line: string): string {
  if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) return 'file';
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'del';
  return 'ctx';
}

function DiffRender({ diff }: { diff: string }) {
  const lines = diff.split('\n');
  return (
    <pre className="git-panel__diff-pre">
      {lines.map((line, i) => {
        const kind = classifyDiffLine(line);
        return (
          <div key={i} className={`diff-line diff-line--${kind}`}>
            {line || ' '}
          </div>
        );
      })}
    </pre>
  );
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
  /** Set by D1 header logic: merge is blocked while the worktree is dirty. */
  disabled?: boolean;
  disabledReason?: string;
}

function GitPanelMerge({
  sessionId: _sessionId,
  summary: _summary,
  onAction: _onAction,
  onRefresh: _onRefresh,
  disabled: _disabled,
  disabledReason: _disabledReason,
}: MergeProps) {
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
