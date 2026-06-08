import React, { useEffect, useState, useCallback } from 'react';
import type { GitDiffSummary, GitPrInfo, MaestroSessionStatus } from '../../app/types/maestro';
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
  suggestedPr?: { title: string; body: string };
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
        suggestedPr={state.suggestedPr}
        onAction={onAction}
        onRefresh={fetchGitState}
        disabled={actionState.mutationDisabled}
        disabledReason={actionState.disabledReason}
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

/** Mirror of the server-side git ref validation for instant client feedback. */
export function validateBranchName(raw: string): string | undefined {
  const name = raw.trim();
  if (!name) return 'Branch name cannot be empty';
  if (/\s/.test(name)) return 'Branch name cannot contain spaces';
  // Reject characters/sequences git itself forbids in ref names.
  if (/[~^:?*[\\]/.test(name)) return 'Branch name contains invalid characters';
  if (/\.\.|@\{|\/\/|^\/|\/$|\.$|^-|\.lock$/.test(name)) return 'Branch name is not a valid git ref';
  return undefined;
}

function GitPanelBranchRename({ sessionId, summary, onAction, onRefresh }: BranchRenameProps) {
  const currentBranch = summary?.branch ?? '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentBranch);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  if (!summary) return null;

  const startEdit = () => {
    setValue(currentBranch);
    setError(undefined);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(undefined);
  };

  const save = async () => {
    const name = value.trim();
    if (name === currentBranch) {
      cancel();
      return;
    }
    const validationError = validateBranchName(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await maestroClient.renameSessionBranch(sessionId, name);
      setEditing(false);
      onAction?.('renamed');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename branch');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="git-panel__section git-panel__branch-rename">
      <div className="git-panel__section-title">Branch</div>
      {!editing ? (
        <button
          type="button"
          className="git-panel__branch-name-btn"
          onClick={startEdit}
          title="Click to rename branch"
        >
          <span className="git-panel__branch-name-text">{currentBranch || '—'}</span>
          <span className="git-panel__branch-name-edit" aria-hidden="true">✎</span>
        </button>
      ) : (
        <div className="git-panel__branch-edit-row">
          <input
            className="git-panel__branch-input"
            type="text"
            value={value}
            autoFocus
            spellCheck={false}
            disabled={busy}
            onChange={(e) => { setValue(e.target.value); if (error) setError(undefined); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
          />
          <button
            type="button"
            className="git-panel__branch-save"
            onClick={save}
            disabled={busy || !value.trim()}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="git-panel__branch-cancel"
            onClick={cancel}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      )}
      {error && <div className="git-panel__branch-error">{error}</div>}
    </div>
  );
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

interface MergeResult {
  success: boolean;
  message: string;
  conflicts?: string[];
}

function GitPanelMerge({
  sessionId,
  summary,
  onAction,
  onRefresh,
  disabled,
  disabledReason,
}: MergeProps) {
  const defaultTarget = summary?.baseBranch ?? '';
  const [target, setTarget] = useState(defaultTarget);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MergeResult | null>(null);

  // Keep the target input in sync if the base branch resolves later.
  useEffect(() => {
    setTarget(prev => (prev ? prev : defaultTarget));
  }, [defaultTarget]);

  if (!summary) return null;

  const trimmedTarget = target.trim();

  const doMerge = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await maestroClient.mergeSessionWorktree(sessionId, trimmedTarget || undefined);
      setResult(r);
      if (r.success) {
        onAction?.('merged');
        onRefresh();
      }
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Merge failed' });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="git-panel__section git-panel__merge">
      <div className="git-panel__section-title">Merge</div>
      <div className="git-panel__merge-row">
        <label className="git-panel__merge-label">
          <span className="git-panel__merge-label-text">Into</span>
          <input
            className="git-panel__merge-target"
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={defaultTarget || 'target branch'}
            disabled={busy || disabled}
            spellCheck={false}
          />
        </label>
        {!confirming ? (
          <button
            type="button"
            className="git-panel__merge-btn"
            disabled={disabled || busy || !trimmedTarget}
            title={disabled ? disabledReason : `Merge ${summary.branch} into ${trimmedTarget || defaultTarget}`}
            onClick={() => { setResult(null); setConfirming(true); }}
          >
            Merge
          </button>
        ) : (
          <span className="git-panel__merge-confirm">
            <span className="git-panel__merge-confirm-text" title={`${summary.branch} → ${trimmedTarget}`}>
              Merge into {trimmedTarget}?
            </span>
            <button
              type="button"
              className="git-panel__merge-confirm-yes"
              disabled={busy || !trimmedTarget}
              onClick={doMerge}
            >
              {busy ? 'Merging…' : 'Confirm'}
            </button>
            <button
              type="button"
              className="git-panel__merge-confirm-no"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {disabled && disabledReason && (
        <div className="git-panel__merge-disabled-reason">{disabledReason}</div>
      )}

      {result && (
        result.success ? (
          <div className="git-panel__merge-success">{result.message || 'Merged successfully.'}</div>
        ) : (
          <div className="git-panel__merge-error">
            <div className="git-panel__merge-error-msg">{result.message || 'Merge failed.'}</div>
            {result.conflicts && result.conflicts.length > 0 && (
              <div className="git-panel__merge-conflicts">
                <div className="git-panel__merge-conflicts-title">
                  Conflicting file{result.conflicts.length === 1 ? '' : 's'}:
                </div>
                <ul className="git-panel__merge-conflicts-list">
                  {result.conflicts.map((f) => (
                    <li key={f} className="git-panel__merge-conflict-file" title={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

interface PRProps {
  sessionId: string;
  pr?: GitPrInfo;
  summary?: GitDiffSummary;
  suggestedPr?: { title: string; body: string };
  onAction?: (a: 'pr-created') => void;
  onRefresh: () => void;
  /** Set by D1 header logic: PR creation is blocked while the worktree is dirty. */
  disabled?: boolean;
  disabledReason?: string;
}

const PR_STATE_LABELS: Record<GitPrInfo['state'], string> = {
  OPEN: 'Open',
  MERGED: 'Merged',
  CLOSED: 'Closed',
  DRAFT: 'Draft',
};

function GitPanelPR({
  sessionId,
  pr,
  summary,
  suggestedPr,
  onAction,
  onRefresh,
  disabled,
  disabledReason,
}: PRProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);

  const suggestedTitle = suggestedPr?.title ?? '';
  const suggestedBody = suggestedPr?.body ?? '';
  const defaultBase = summary?.baseBranch ?? '';

  // Pre-fill the form from the server suggestion until the user edits it.
  useEffect(() => {
    if (!touched) {
      setTitle(suggestedTitle);
      setBody(suggestedBody);
    }
  }, [suggestedTitle, suggestedBody, touched]);

  useEffect(() => {
    setBase(prev => (prev ? prev : defaultBase));
  }, [defaultBase]);

  // Once a PR exists, show the chip instead of the form.
  if (pr) {
    return (
      <div className="git-panel__section git-panel__pr">
        <div className="git-panel__section-title">Pull request</div>
        <a
          className={`git-panel__pr-chip git-panel__pr-chip--${pr.state.toLowerCase()}`}
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          title={pr.url}
        >
          <span className="git-panel__pr-number">#{pr.number}</span>
          <span className="git-panel__pr-state">{PR_STATE_LABELS[pr.state] ?? pr.state}</span>
          <span className="git-panel__pr-open">↗</span>
        </a>
      </div>
    );
  }

  if (!summary) return null;

  const trimmedTitle = title.trim();
  const trimmedBase = base.trim();

  const submit = async () => {
    if (!trimmedTitle) {
      setError('A PR title is required');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await maestroClient.createSessionPr(sessionId, {
        title: trimmedTitle,
        body,
        baseBranch: trimmedBase || undefined,
      });
      onAction?.('pr-created');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open pull request');
      setBusy(false);
    }
    // On success the parent refetches and the chip replaces the form.
  };

  return (
    <div className="git-panel__section git-panel__pr">
      <div className="git-panel__section-title">Pull request</div>
      {!open ? (
        <button
          type="button"
          className="git-panel__pr-toggle"
          disabled={disabled}
          title={disabled ? disabledReason : 'Push branch and open a pull request'}
          onClick={() => { setError(undefined); setOpen(true); }}
        >
          Open pull request…
        </button>
      ) : (
        <div className="git-panel__pr-form">
          <label className="git-panel__pr-field">
            <span className="git-panel__pr-field-label">Title</span>
            <input
              className="git-panel__pr-title"
              type="text"
              value={title}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => { setTouched(true); setTitle(e.target.value); if (error) setError(undefined); }}
            />
          </label>
          <label className="git-panel__pr-field">
            <span className="git-panel__pr-field-label">Body</span>
            <textarea
              className="git-panel__pr-body"
              rows={6}
              value={body}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => { setTouched(true); setBody(e.target.value); }}
            />
          </label>
          <label className="git-panel__pr-field">
            <span className="git-panel__pr-field-label">Base</span>
            <input
              className="git-panel__pr-base"
              type="text"
              value={base}
              disabled={busy}
              spellCheck={false}
              placeholder={defaultBase || 'base branch'}
              onChange={(e) => setBase(e.target.value)}
            />
          </label>
          <div className="git-panel__pr-actions">
            <button
              type="button"
              className="git-panel__pr-submit"
              disabled={busy || disabled || !trimmedTitle}
              title={disabled ? disabledReason : undefined}
              onClick={submit}
            >
              {busy ? 'Opening…' : 'Open PR'}
            </button>
            <button
              type="button"
              className="git-panel__pr-cancel"
              disabled={busy}
              onClick={() => { setOpen(false); setError(undefined); }}
            >
              Cancel
            </button>
          </div>
          {disabled && disabledReason && (
            <div className="git-panel__pr-disabled-reason">{disabledReason}</div>
          )}
          {error && <div className="git-panel__pr-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

interface DiscardProps {
  sessionId: string;
  onAction?: (a: 'discarded') => void;
  onRefresh: () => void;
}

/** Session states in which discarding the worktree is permitted (mirrors the server's 409 gate). */
const TERMINAL_SESSION_STATUSES: readonly MaestroSessionStatus[] = ['completed', 'failed', 'stopped'];

/** Pure gate: discard is only allowed once the session has finished. Exported for unit testing. */
export function canDiscardWorktree(status?: MaestroSessionStatus): boolean {
  return status !== undefined && TERMINAL_SESSION_STATUSES.includes(status);
}

function GitPanelDiscard({ sessionId, onAction, onRefresh }: DiscardProps) {
  const [status, setStatus] = useState<MaestroSessionStatus | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    maestroClient
      .getSession(sessionId)
      .then(session => { if (!cancelled) setStatus(session.status); })
      .catch(() => { /* leave status undefined → discard stays gated */ });
    return () => { cancelled = true; };
  }, [sessionId]);

  const allowed = canDiscardWorktree(status);

  const discard = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await maestroClient.discardSessionWorktree(sessionId);
      onAction?.('discarded');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discard worktree');
      setBusy(false);
      setConfirming(false);
    }
    // On success the parent refetches and this panel unmounts (hasWorktree → false),
    // so no need to reset local busy state.
  };

  return (
    <div className="git-panel__section git-panel__discard">
      <div className="git-panel__section-title">Worktree</div>
      {!confirming ? (
        <div className="git-panel__discard-row">
          <button
            type="button"
            className="git-panel__discard-btn"
            disabled={!allowed || busy}
            title={allowed ? 'Remove this worktree and delete its branch' : 'Available after the session finishes'}
            onClick={() => { setError(undefined); setConfirming(true); }}
          >
            Discard worktree
          </button>
        </div>
      ) : (
        <div className="git-panel__discard-confirm">
          <span className="git-panel__discard-confirm-text">
            Permanently delete this worktree and its branch? Uncommitted changes will be lost.
          </span>
          <div className="git-panel__discard-confirm-actions">
            <button
              type="button"
              className="git-panel__discard-keep"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Keep
            </button>
            <button
              type="button"
              className="git-panel__discard-confirm-yes"
              disabled={busy}
              onClick={discard}
            >
              {busy ? 'Discarding…' : 'Discard'}
            </button>
          </div>
        </div>
      )}

      {!allowed && (
        <div className="git-panel__discard-disabled-reason">
          Discard is available once the session has completed, stopped, or failed.
        </div>
      )}

      {error && <div className="git-panel__discard-error">{error}</div>}
    </div>
  );
}
