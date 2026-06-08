import { create } from 'zustand';

/**
 * User-configurable git integration preferences, persisted in localStorage so
 * they survive reloads. These are global (not per-project) defaults:
 *  - `defaultBaseBranch` overrides the auto-detected base branch (origin/HEAD)
 *    used to pre-fill merge targets and PR bases. Empty string = auto-detect.
 *  - `branchNamingScheme` is the template Maestro uses for worktree branch names.
 *    `{slug}` expands to the task slug and `{id}` to a short unique suffix.
 *  - `autoDiscardOnMerge` removes the worktree automatically after a successful
 *    merge so finished sessions don't accumulate stale worktrees.
 */
export interface GitSettings {
  defaultBaseBranch: string;
  branchNamingScheme: string;
  autoDiscardOnMerge: boolean;
}

export const DEFAULT_BRANCH_NAMING_SCHEME = 'maestro/{slug}-{id}';

const STORAGE_KEYS = {
  defaultBaseBranch: 'maestro.git.defaultBaseBranch',
  branchNamingScheme: 'maestro.git.branchNamingScheme',
  autoDiscardOnMerge: 'maestro.git.autoDiscardOnMerge',
} as const;

function readString(key: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? raw : fallback;
  } catch {
    return fallback;
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch {
    // best-effort
  }
  return fallback;
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // best-effort
  }
}

/**
 * Render a concrete branch name from a naming scheme template, for previews.
 * Unknown placeholders are left intact; a blank scheme falls back to the default.
 */
export function previewBranchName(
  scheme: string,
  slug = 'my-task',
  id = 'a1b2',
): string {
  const template = scheme.trim() || DEFAULT_BRANCH_NAMING_SCHEME;
  return template.replace(/\{slug\}/g, slug).replace(/\{id\}/g, id);
}

interface GitSettingsState extends GitSettings {
  setDefaultBaseBranch: (value: string) => void;
  setBranchNamingScheme: (value: string) => void;
  setAutoDiscardOnMerge: (value: boolean) => void;
  reset: () => void;
}

export const useGitSettingsStore = create<GitSettingsState>((set) => ({
  defaultBaseBranch: readString(STORAGE_KEYS.defaultBaseBranch, ''),
  branchNamingScheme: readString(STORAGE_KEYS.branchNamingScheme, DEFAULT_BRANCH_NAMING_SCHEME),
  autoDiscardOnMerge: readBool(STORAGE_KEYS.autoDiscardOnMerge, false),

  setDefaultBaseBranch: (value) => {
    const trimmed = value.trim();
    set({ defaultBaseBranch: trimmed });
    persist(STORAGE_KEYS.defaultBaseBranch, trimmed);
  },
  setBranchNamingScheme: (value) => {
    set({ branchNamingScheme: value });
    persist(STORAGE_KEYS.branchNamingScheme, value);
  },
  setAutoDiscardOnMerge: (value) => {
    set({ autoDiscardOnMerge: value });
    persist(STORAGE_KEYS.autoDiscardOnMerge, value ? '1' : '0');
  },
  reset: () => {
    set({
      defaultBaseBranch: '',
      branchNamingScheme: DEFAULT_BRANCH_NAMING_SCHEME,
      autoDiscardOnMerge: false,
    });
    persist(STORAGE_KEYS.defaultBaseBranch, '');
    persist(STORAGE_KEYS.branchNamingScheme, DEFAULT_BRANCH_NAMING_SCHEME);
    persist(STORAGE_KEYS.autoDiscardOnMerge, '0');
  },
}));
