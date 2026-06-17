/**
 * Tests for onNewSubmit terminal creation across desktop (Tauri) and web modes.
 *
 * Desktop (IS_TAURI === true):
 *   - validate_directory is invoked; a failed validation surfaces a visible
 *     notice and creates no terminal.
 *   - homeDir (from useUIStore) is used as the cwd fallback when the active
 *     project has no basePath.
 *
 * Web / browser (IS_TAURI === false):
 *   - There is NO Tauri runtime, so invoke('validate_directory') throws. The
 *     pre-fix code swallowed that rejection (.catch(() => null)) and returned
 *     early, so the [NEW TERMINAL] modal NEVER created a terminal in the web
 *     build. The fix skips Tauri validation in browser mode and passes the cwd
 *     through (project basePath when present, otherwise null so the server —
 *     sessionRoutes.ts — defaults it to its own home dir).
 *
 * IS_TAURI is mutable per-test via vi.hoisted so the same suite can exercise
 * both the desktop and the browser branch of onNewSubmit.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mutable mock state (hoisted so vi.mock factories may reference it) ───────
const h = vi.hoisted(() => ({
  isTauri: true,
  homeDir: '/home/testuser' as string | null,
  activeProjectId: null as string | null,
  projects: [] as Array<{ id: string; basePath?: string | null }>,
  showNotice: vi.fn(),
  reportError: vi.fn(),
  setError: vi.fn(),
}));

// ── Mock platform; IS_TAURI is a getter so it stays mutable across tests ─────
vi.mock('../platform', () => ({
  get IS_TAURI() {
    return h.isTauri;
  },
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
vi.mock('../stores/useUIStore', () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      homeDir: h.homeDir,
      showNotice: h.showNotice,
      reportError: h.reportError,
      setError: h.setError,
    })),
  },
}));

// ── Mock useProjectStore (driven by hoisted state) ─────────────────────────
vi.mock('../stores/useProjectStore', () => ({
  useProjectStore: {
    getState: vi.fn(() => ({
      activeProjectId: h.activeProjectId,
      projects: h.projects,
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

const submit = () =>
  useSessionStore
    .getState()
    .onNewSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);

describe('onNewSubmit — new terminal creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isTauri = true;
    h.homeDir = '/home/testuser';
    h.activeProjectId = null;
    h.projects = [];
    useSessionStore.setState({
      newName: 'my-terminal',
      newCommand: '',
      newPersistent: false,
      newCwd: '',
    });
  });

  describe('desktop (IS_TAURI)', () => {
    it('creates terminal using homeDir when project has no basePath', async () => {
      // validate_directory echoes the path it receives (simulates a valid dir)
      mockTauriInvoke.mockImplementation((cmd: string, args: { path: string }) =>
        cmd === 'validate_directory'
          ? Promise.resolve(args.path || null)
          : Promise.resolve(null),
      );
      mockCreateSession.mockResolvedValue({
        id: 'sess-1',
        name: 'my-terminal',
        exited: false,
        closing: false,
      });

      await submit();

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: '/home/testuser' }),
      );
    });

    it('surfaces a visible notice when the working directory cannot be validated', async () => {
      // validate_directory always fails (bad path, permission error, etc.)
      mockTauriInvoke.mockResolvedValue(null);

      await submit();

      expect(h.showNotice).toHaveBeenCalledWith(
        expect.stringContaining('Working directory'),
      );
      expect(mockCreateSession).not.toHaveBeenCalled();
    });
  });

  describe('web / browser (no Tauri runtime)', () => {
    beforeEach(() => {
      h.isTauri = false;
      // In the browser, initApp only resolves homeDir under IS_TAURI, so it is null.
      h.homeDir = null;
      // Simulate the browser: any invoke() throws because there is no Tauri IPC.
      mockTauriInvoke.mockRejectedValue(
        new Error('Tauri IPC unavailable in browser'),
      );
      mockCreateSession.mockResolvedValue({
        id: 'sess-web',
        name: 'my-terminal',
        exited: false,
        closing: false,
      });
    });

    it('creates the terminal with cwd=null (server defaults it) instead of returning early', async () => {
      await submit();

      // Before the fix: invoke('validate_directory') rejects → caught → null →
      // showNotice + early return → createSession is NEVER called (this assertion fails).
      // After the fix: browser mode skips Tauri validation → createSession runs once.
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: null }),
      );
      expect(h.showNotice).not.toHaveBeenCalled();
    });

    it('passes the active project basePath through as cwd without invoking Tauri', async () => {
      h.activeProjectId = 'proj-1';
      h.projects = [{ id: 'proj-1', basePath: '/work/project' }];

      await submit();

      expect(mockTauriInvoke).not.toHaveBeenCalled();
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: '/work/project' }),
      );
    });
  });
});
