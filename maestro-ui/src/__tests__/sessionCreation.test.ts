/**
 * Tests for onNewSubmit terminal creation bug.
 *
 * Root causes confirmed by this test suite (both fail before the fix):
 * 1. homeDirRef.current is always null (App.tsx passes { current: null } and
 *    never updates it), so desiredCwd falls back to '' when the active project
 *    has no basePath. validate_directory('') returns null → silent early return,
 *    no terminal created.
 * 2. setError() writes to useUIStore.error, which no component renders, so the
 *    failure is invisible to the user.
 *
 * Fix: read homeDir from useUIStore.getState().homeDir (not homeDirRef.current),
 * and use showNotice() for user-visible error feedback.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock platform before any store import triggers side effects ────────────
vi.mock('../platform', () => ({
  IS_TAURI: false,
  platform: {
    terminal: {
      onOutput: vi.fn(() => () => {}),
      onSize: undefined,
      onExit: vi.fn(() => () => {}),
    },
  },
}));

// ── Mock Tauri invoke ──────────────────────────────────────────────────────
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// ── Mock sessionService ────────────────────────────────────────────────────
vi.mock('../services/sessionService', () => ({
  createSession: vi.fn(),
  closeSession: vi.fn(),
}));

// ── Mock useUIStore ────────────────────────────────────────────────────────
const mockShowNotice = vi.fn();
const mockReportError = vi.fn();
const mockSetError = vi.fn();

vi.mock('../stores/useUIStore', () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      homeDir: '/home/testuser',
      showNotice: mockShowNotice,
      reportError: mockReportError,
      setError: mockSetError,
    })),
  },
}));

// ── Mock useProjectStore (project with no basePath) ────────────────────────
vi.mock('../stores/useProjectStore', () => ({
  useProjectStore: {
    getState: vi.fn(() => ({
      activeProjectId: null,
      projects: [],
    })),
  },
}));

vi.mock('../stores/useEnvironmentStore', () => ({
  useEnvironmentStore: {
    getState: vi.fn(() => ({ environments: [] })),
  },
}));

vi.mock('../stores/useAssetStore', () => ({
  useAssetStore: {
    getState: vi.fn(() => ({
      ensureAutoAssets: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

// ── Stub stores used in other parts of useSessionStore (not by onNewSubmit) -
vi.mock('../stores/useSshStore', () => ({
  useSshStore: { getState: vi.fn(() => ({})) },
}));
vi.mock('../stores/useWorkspaceStore', () => ({
  useWorkspaceStore: { getState: vi.fn(() => ({})) },
  getActiveWorkspaceView: vi.fn(),
}));
vi.mock('../stores/useRecordingStore', () => ({
  useRecordingStore: { getState: vi.fn(() => ({})) },
}));
vi.mock('../stores/useAgentShortcutStore', () => ({
  useAgentShortcutStore: { getState: vi.fn(() => ({ agentShortcutIds: [] })) },
}));
vi.mock('../stores/usePersistentSessionStore', () => ({
  usePersistentSessionStore: { getState: vi.fn(() => ({})) },
}));
vi.mock('../utils/MaestroClient', () => ({
  maestroClient: {
    on: vi.fn(),
    updateSession: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Imports (after all vi.mock calls) ──────────────────────────────────────
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { createSession } from '../services/sessionService';
import { useSessionStore } from '../stores/useSessionStore';

const mockTauriInvoke = tauriInvoke as ReturnType<typeof vi.fn>;
const mockCreateSession = createSession as ReturnType<typeof vi.fn>;

describe('onNewSubmit — new terminal creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({
      newName: 'my-terminal',
      newCommand: '',
      newPersistent: false,
      newCwd: '',
    });
  });

  it('creates terminal when project has no basePath but homeDir is available', async () => {
    // validate_directory returns the path it receives (simulates a valid dir)
    mockTauriInvoke.mockImplementation((cmd: string, args: { path: string }) => {
      if (cmd === 'validate_directory') return Promise.resolve(args.path || null);
      return Promise.resolve(null);
    });

    const mockSession = { id: 'sess-1', name: 'my-terminal', exited: false, closing: false };
    mockCreateSession.mockResolvedValue(mockSession);

    const e = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await useSessionStore.getState().onNewSubmit(e);

    // FAILS before fix: homeDirRef.current is null → desiredCwd='' →
    // validate_directory('') returns '' (falsy) → silent early return, no terminal.
    // PASSES after fix: homeDir from UIStore ('/home/testuser') is used as cwd.
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/home/testuser' }),
    );
  });

  it('surfaces a visible notice when the working directory cannot be validated', async () => {
    // validate_directory always fails (bad path, permission error, etc.)
    mockTauriInvoke.mockResolvedValue(null);

    const e = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await useSessionStore.getState().onNewSubmit(e);

    // FAILS before fix: setError() is called but nothing in the UI renders
    // useUIStore.error, so the failure is invisible to the user.
    // PASSES after fix: showNotice() is called, which surfaces a visible notice.
    expect(mockShowNotice).toHaveBeenCalledWith(
      expect.stringContaining('Working directory'),
    );
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
