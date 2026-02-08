import React, { MutableRefObject, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TerminalSession } from "../app/types/session";
import { MaestroProject } from "../app/types/maestro";
import { EnvironmentConfig } from "../app/types/app";
import { PendingDataBuffer } from "../app/types/app-state";
import { WorkspaceView } from "../app/types/workspace";
import { buildSshCommandAtRemoteDir, parsePort } from "../app/utils/ssh";
import { envVarsForProjectId } from "../app/utils/env";
import { shortenPathSmart } from "../pathDisplay";
import { createSession, closeSession } from "../services/sessionService";
import { deleteSession as deleteMaestroSession } from "../utils/maestroHelpers";
import { formatError } from "../utils/formatters";
import { sleep } from "../utils/domUtils";

function basenamePath(input: string): string {
  const normalized = input.trim().replace(/[\\/]+$/, "");
  if (!normalized) return "";
  if (normalized === "/") return "/";
  const parts = normalized.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? "";
}

interface SshForward {
  type: "local" | "remote" | "dynamic";
  listenPort: string;
  destinationHost: string;
  destinationPort: string;
}

interface UseSessionActionsProps {
  sessions: TerminalSession[];
  setSessions: React.Dispatch<React.SetStateAction<TerminalSession[]>>;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  sessionsRef: MutableRefObject<TerminalSession[]>;
  homeDirRef: MutableRefObject<string | null>;
  pendingData: MutableRefObject<PendingDataBuffer>;
  closingSessions: MutableRefObject<Map<string, number>>;
  active: TerminalSession | null;
  activeProject: MaestroProject | null;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeWorkspaceView: WorkspaceView;
  projects: MaestroProject[];
  environments: EnvironmentConfig[];
  applyPendingExit: (session: TerminalSession) => TerminalSession;
  clearAgentIdleTimer: (id: string) => void;
  lastResizeAtRef: MutableRefObject<Map<string, number>>;
  ensureAutoAssets: (cwd: string, projectId: string) => Promise<void>;
  showNotice: (message: string, duration?: number) => void;
  reportError: (title: string, error: unknown) => void;
  setError: (error: string | null) => void;
  refreshPersistentSessions: () => Promise<void>;
  // New session form
  newName: string;
  newCommand: string;
  newPersistent: boolean;
  newCwd: string;
  setNewOpen: (open: boolean) => void;
  resetNewSessionForm: () => void;
  // SSH
  sshHost: string;
  sshPersistent: boolean;
  sshForwards: SshForward[];
  sshCommandPreview: string | null;
  setSshError: (error: string | null) => void;
  setSshManagerOpen: (open: boolean) => void;
}

export function useSessionActions({
  setSessions,
  setActiveId,
  sessionsRef,
  homeDirRef,
  pendingData,
  closingSessions,
  active,
  activeProject,
  activeProjectId,
  setActiveProjectId,
  activeWorkspaceView,
  projects,
  environments,
  applyPendingExit,
  clearAgentIdleTimer,
  lastResizeAtRef,
  ensureAutoAssets,
  showNotice,
  reportError,
  setError,
  refreshPersistentSessions,
  newName,
  newCommand,
  newPersistent,
  newCwd,
  setNewOpen,
  resetNewSessionForm,
  sshHost,
  sshPersistent,
  sshForwards,
  sshCommandPreview,
  setSshError,
  setSshManagerOpen,
}: UseSessionActionsProps) {
  const handleOpenTerminalAtPath = useCallback(
    async (path: string, provider: "local" | "ssh", sshTarget: string | null) => {
      const desiredPath = path.trim();
      if (!desiredPath) return;

      const projectId = activeProjectId;
      const envVars = envVarsForProjectId(projectId, projects, environments);

      if (provider === "local") {
        const validatedCwd = await invoke<string | null>("validate_directory", { path: desiredPath }).catch(() => null);
        if (!validatedCwd) {
          showNotice("Working directory must be an existing folder.");
          return;
        }
        await ensureAutoAssets(validatedCwd, projectId);
        try {
          const createdRaw = await createSession({
            projectId,
            name: basenamePath(validatedCwd) || undefined,
            cwd: validatedCwd,
            envVars,
          });
          const s = applyPendingExit(createdRaw);
          setSessions((prev) => [...prev, s]);
          setActiveId(s.id);
        } catch (err) {
          reportError("Failed to create session", err);
        }
        return;
      }

      const target = (sshTarget ?? "").trim();
      if (!target) {
        showNotice("Missing SSH target.");
        return;
      }

      const localDesiredCwd = activeProject?.basePath ?? homeDirRef.current ?? "";
      const localValidatedCwd = await invoke<string | null>("validate_directory", { path: localDesiredCwd }).catch(
        () => null,
      );
      if (localValidatedCwd) {
        await ensureAutoAssets(localValidatedCwd, projectId);
      }

      const baseCommandLine = (active?.restoreCommand ?? active?.launchCommand ?? "").trim() || null;
      const launchCommand = buildSshCommandAtRemoteDir({
        baseCommandLine,
        target,
        remoteDir: desiredPath,
      });

      try {
        const createdRaw = await createSession({
          projectId,
          name: `ssh ${target}: ${shortenPathSmart(desiredPath, 48)}`,
          launchCommand,
          cwd: localValidatedCwd ?? localDesiredCwd ?? null,
          envVars,
          sshTarget: target,
          sshRootDir:
            (activeWorkspaceView.fileExplorerRootDir ?? activeWorkspaceView.codeEditorRootDir ?? active?.sshRootDir) ??
            null,
        });
        const s = applyPendingExit(createdRaw);
        setSessions((prev) => [...prev, s]);
        setActiveId(s.id);
      } catch (err) {
        reportError("Failed to create SSH session", err);
      }
    },
    [
      active?.launchCommand,
      active?.restoreCommand,
      active?.sshRootDir,
      activeProject?.basePath,
      activeProjectId,
      activeWorkspaceView.codeEditorRootDir,
      activeWorkspaceView.fileExplorerRootDir,
      applyPendingExit,
      environments,
      projects,
    ],
  );

  async function onNewSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim() || undefined;
    try {
      const launchCommand = newCommand.trim() || null;
      if (newPersistent && launchCommand) {
        setError("Persistent terminals require an empty command (run commands inside the terminal).");
        return;
      }
      const desiredCwd =
        newCwd.trim() || activeProject?.basePath || homeDirRef.current || "";
      const validatedCwd = await invoke<string | null>("validate_directory", {
        path: desiredCwd,
      }).catch(() => null);
      if (!validatedCwd) {
        setError("Working directory must be an existing folder.");
        return;
      }
      await ensureAutoAssets(validatedCwd, activeProjectId);
      const createdRaw = await createSession({
        projectId: activeProjectId,
        name,
        launchCommand,
        persistent: newPersistent,
        cwd: validatedCwd,
        envVars: envVarsForProjectId(activeProjectId, projects, environments),
      });
      const s = applyPendingExit(createdRaw);
      setSessions((prev) => [...prev, s]);
      setActiveId(s.id);
      setNewOpen(false);
      resetNewSessionForm();
    } catch (err) {
      reportError("Failed to create session", err);
    }
  }

  async function onSshConnect() {
    setSshError(null);

    const target = sshHost.trim();
    if (!target) {
      setSshError("Pick an SSH host.");
      return;
    }

    for (const [idx, f] of sshForwards.entries()) {
      const listenPort = parsePort(f.listenPort);
      if (!listenPort) {
        setSshError(`Forward #${idx + 1}: invalid listen port.`);
        return;
      }
      if (f.type !== "dynamic") {
        if (!f.destinationHost.trim()) {
          setSshError(`Forward #${idx + 1}: destination host is required.`);
          return;
        }
        const destPort = parsePort(f.destinationPort);
        if (!destPort) {
          setSshError(`Forward #${idx + 1}: invalid destination port.`);
          return;
        }
      }
    }

    const command = sshCommandPreview;
    if (!command) {
      setSshError("Invalid SSH configuration.");
      return;
    }

    try {
      const desiredCwd = activeProject?.basePath ?? homeDirRef.current ?? "";
      const validatedCwd = await invoke<string | null>("validate_directory", {
        path: desiredCwd,
      }).catch(() => null);
      if (!validatedCwd) {
        setSshError("Working directory must be an existing folder.");
        return;
      }

      await ensureAutoAssets(validatedCwd, activeProjectId);

      const name = `ssh ${target}`;
      const createdRaw = await createSession({
        projectId: activeProjectId,
        name,
        launchCommand: sshPersistent ? null : command,
        restoreCommand: sshPersistent ? command : null,
        persistent: sshPersistent,
        cwd: validatedCwd,
        envVars: envVarsForProjectId(activeProjectId, projects, environments),
      });
      const s = applyPendingExit(createdRaw);
      setSessions((prev) => [...prev, s]);
      setActiveId(s.id);
      setSshManagerOpen(false);

      if (sshPersistent) {
        void (async () => {
          try {
            await invoke("write_to_session", { id: s.id, data: command, source: "system" });
            await sleep(30);
            await invoke("write_to_session", { id: s.id, data: "\r", source: "system" });
          } catch (err) {
            reportError("Failed to start SSH inside persistent session", err);
          }
        })();
      }
    } catch (err) {
      setSshError(formatError(err));
    }
  }

  async function onClose(id: string) {
    clearAgentIdleTimer(id);
    lastResizeAtRef.current.delete(id);
    const session = sessionsRef.current.find((s) => s.id === id) ?? null;
    const wasPersistent = Boolean(session?.persistent && !session?.exited);

    if (session?.maestroSessionId) {
      void deleteMaestroSession(session.maestroSessionId).catch(() => {});
    }

    if (session?.recordingActive) {
      try {
        await invoke("stop_session_recording", { id });
      } catch {
        // ignore
      }
    }
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, closing: true } : s)));

    if (!closingSessions.current.has(id)) {
      const timeout = window.setTimeout(() => {
        closingSessions.current.delete(id);
        pendingData.current.delete(id);
      }, 30_000);
      closingSessions.current.set(id, timeout);
    }

    pendingData.current.delete(id);

    let killErr: string | null = null;
    let killedPersistent = false;
    let closeErr: unknown | null = null;
    try {
      try {
        await closeSession(id);
      } catch (err) {
        closeErr = err;
      }

      if (wasPersistent && session?.persistId) {
        try {
          await invoke("kill_persistent_session", { persistId: session.persistId });
          killedPersistent = true;
        } catch (err) {
          killErr = formatError(err);
        } finally {
          void refreshPersistentSessions();
        }
      }

      if (closeErr) throw closeErr;
    } catch (err) {
      const timeout = closingSessions.current.get(id);
      if (timeout !== undefined) window.clearTimeout(timeout);
      closingSessions.current.delete(id);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, closing: false } : s)),
      );
      reportError("Failed to close session", err);
      return;
    }

    if (wasPersistent && session) {
      if (killedPersistent) {
        showNotice(`Closed "${session.name}" and killed persistent terminal.`);
      } else if (killErr) {
        showNotice(
          `Closed "${session.name}" but failed to kill persistent terminal. Manage via Persistent terminals (\u221E).`,
        );
      } else {
        showNotice(`Closed "${session.name}".`);
      }
    }

    setSessions((prev) => {
      const closing = prev.find((s) => s.id === id);
      const next = prev.filter((s) => s.id !== id);
      setActiveId((prevActive) => {
        if (prevActive !== id) return prevActive;
        if (!closing) return next.length ? next[0].id : null;
        const sameProject = next.filter((s) => s.projectId === closing.projectId);
        return sameProject.length ? sameProject[0].id : null;
      });
      return next;
    });
  }

  async function attachPersistentSession(persistId: string) {
    const existing = sessionsRef.current.find((s) => s.persistId === persistId) ?? null;
    if (existing && !existing.exited && !existing.closing) {
      setActiveProjectId(existing.projectId);
      setActiveId(existing.id);
      return;
    }

    const cwd = activeProject?.basePath ?? homeDirRef.current ?? null;
    try {
      if (cwd) await ensureAutoAssets(cwd, activeProjectId);
      const createdRaw = await createSession({
        projectId: activeProjectId,
        name: `persist ${persistId.slice(0, 8)}`,
        persistent: true,
        persistId,
        cwd,
        envVars: envVarsForProjectId(activeProjectId, projects, environments),
      });
      const created = applyPendingExit(createdRaw);
      setSessions((prev) => [...prev, created]);
      setActiveId(created.id);
    } catch (err) {
      reportError("Failed to attach persistent session", err);
    }
  }

  async function quickStart(preset: { id: string; title: string; command: string | null }) {
    try {
      const cwd = activeProject?.basePath ?? homeDirRef.current ?? null;
      if (cwd) await ensureAutoAssets(cwd, activeProjectId);
      const createdRaw = await createSession({
        projectId: activeProjectId,
        name: preset.title,
        launchCommand: null,
        cwd,
        envVars: envVarsForProjectId(activeProjectId, projects, environments),
      });
      const created = applyPendingExit(createdRaw);
      setSessions((prev) => [...prev, created]);
      setActiveId(created.id);

      const commandLine = (preset.command ?? "").trim();
      if (commandLine) {
        void invoke("write_to_session", { id: created.id, data: `${commandLine}\r`, source: "ui" }).catch((err) =>
          reportError(`Failed to start ${preset.title}`, err),
        );
      }
    } catch (err) {
      reportError(`Failed to start ${preset.title}`, err);
    }
  }

  return {
    onClose,
    quickStart,
    onNewSubmit,
    onSshConnect,
    attachPersistentSession,
    handleOpenTerminalAtPath,
  };
}
