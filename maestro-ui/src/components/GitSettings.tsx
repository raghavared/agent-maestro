import React, { useEffect, useState } from 'react';
import {
  useGitSettingsStore,
  previewBranchName,
  DEFAULT_BRANCH_NAMING_SCHEME,
} from '../stores/useGitSettingsStore';
import { maestroClient } from '../utils/MaestroClient';
import type { GitCapabilities } from '../app/types/maestro';

/**
 * Global git-integration preferences plus a live capability readout (git / gh /
 * gh-auth). The capability row tells the user why PR features may be unavailable
 * — PR UI elsewhere is gated on `hasGh`.
 */
export function GitSettings() {
  const defaultBaseBranch = useGitSettingsStore((s) => s.defaultBaseBranch);
  const branchNamingScheme = useGitSettingsStore((s) => s.branchNamingScheme);
  const autoDiscardOnMerge = useGitSettingsStore((s) => s.autoDiscardOnMerge);
  const setDefaultBaseBranch = useGitSettingsStore((s) => s.setDefaultBaseBranch);
  const setBranchNamingScheme = useGitSettingsStore((s) => s.setBranchNamingScheme);
  const setAutoDiscardOnMerge = useGitSettingsStore((s) => s.setAutoDiscardOnMerge);
  const reset = useGitSettingsStore((s) => s.reset);

  const [caps, setCaps] = useState<GitCapabilities | null>(null);
  const [capsError, setCapsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    maestroClient
      .getGitCapabilities()
      .then((c) => { if (!cancelled) setCaps(c); })
      .catch(() => { if (!cancelled) setCapsError(true); });
    return () => { cancelled = true; };
  }, []);

  const isDefault =
    defaultBaseBranch === '' &&
    branchNamingScheme === DEFAULT_BRANCH_NAMING_SCHEME &&
    autoDiscardOnMerge === false;

  return (
    <div className="gitSettings">
      <div className="gitSettingsSection">
        <div className="gitSettingsLabel">Environment</div>
        <div className="gitSettingsHint">
          Detected git tooling. PR features require GitHub CLI (gh), installed and authenticated.
        </div>
        <div className="gitSettingsCaps">
          {capsError ? (
            <span className="gitSettingsCapsError">Unable to read git capabilities.</span>
          ) : caps === null ? (
            <span className="gitSettingsCapsLoading">Checking…</span>
          ) : (
            <>
              <CapBadge ok={caps.hasGit} label="git" />
              <CapBadge ok={caps.hasGh} label="gh" />
              <CapBadge ok={caps.ghAuthed} label="gh auth" />
            </>
          )}
        </div>
        {caps && !caps.hasGh && (
          <div className="gitSettingsCapsNote">
            Install GitHub CLI from https://cli.github.com to enable pull requests.
          </div>
        )}
        {caps && caps.hasGh && !caps.ghAuthed && (
          <div className="gitSettingsCapsNote">
            Run <code>gh auth login</code> to enable pull requests.
          </div>
        )}
      </div>

      <div className="gitSettingsSection">
        <label className="gitSettingsLabel" htmlFor="gitDefaultBaseBranch">
          Default base branch
        </label>
        <div className="gitSettingsHint">
          Overrides the auto-detected base (origin/HEAD) when merging or opening PRs. Leave blank to auto-detect.
        </div>
        <input
          id="gitDefaultBaseBranch"
          className="gitSettingsInput"
          type="text"
          spellCheck={false}
          placeholder="auto-detect (e.g. main)"
          value={defaultBaseBranch}
          onChange={(e) => setDefaultBaseBranch(e.target.value)}
        />
      </div>

      <div className="gitSettingsSection">
        <label className="gitSettingsLabel" htmlFor="gitBranchScheme">
          Branch naming scheme
        </label>
        <div className="gitSettingsHint">
          Template for worktree branch names. <code>{'{slug}'}</code> = task slug, <code>{'{id}'}</code> = short id.
        </div>
        <input
          id="gitBranchScheme"
          className="gitSettingsInput"
          type="text"
          spellCheck={false}
          placeholder={DEFAULT_BRANCH_NAMING_SCHEME}
          value={branchNamingScheme}
          onChange={(e) => setBranchNamingScheme(e.target.value)}
        />
        <div className="gitSettingsPreview">
          Example: <code>{previewBranchName(branchNamingScheme)}</code>
        </div>
      </div>

      <div className="gitSettingsSection">
        <label className="gitSettingsToggle">
          <input
            type="checkbox"
            checked={autoDiscardOnMerge}
            onChange={(e) => setAutoDiscardOnMerge(e.target.checked)}
          />
          <span className="gitSettingsToggleLabel">Auto-discard worktree after merge</span>
        </label>
        <div className="gitSettingsHint">
          Remove the worktree and its branch automatically once it merges cleanly.
        </div>
      </div>

      {!isDefault && (
        <button type="button" className="gitSettingsReset" onClick={reset}>
          Reset to Default
        </button>
      )}
    </div>
  );
}

function CapBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`gitSettingsCapBadge ${ok ? 'gitSettingsCapBadge--ok' : 'gitSettingsCapBadge--missing'}`}
      title={ok ? `${label} available` : `${label} not available`}
    >
      <span className="gitSettingsCapBadgeIcon" aria-hidden="true">{ok ? '✓' : '✕'}</span>
      {label}
    </span>
  );
}
