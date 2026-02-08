import { MutableRefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TerminalSession } from "../app/types/session";
import { MaestroProject } from "../app/types/maestro";
import { TerminalRegistry } from "../SessionTerminal";
import { EnvironmentConfig } from "../app/types/app";
import { Prompt } from "../app/types/app-state";
import { getProcessEffectById } from "../processEffects";
import { envVarsForProjectId } from "../app/utils/env";
import { createSession } from "../services/sessionService";
import { sleep } from "../utils/domUtils";

interface UsePromptSenderProps {
  registry: MutableRefObject<TerminalRegistry>;
  activeIdRef: MutableRefObject<string | null>;
  sessions: TerminalSession[];
  setSessions: React.Dispatch<React.SetStateAction<TerminalSession[]>>;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  activeProjectId: string;
  activeProject: MaestroProject | null;
  agentShortcutIds: string[];
  projects: MaestroProject[];
  environments: EnvironmentConfig[];
  homeDirRef: MutableRefObject<string | null>;
  applyPendingExit: (session: TerminalSession) => TerminalSession;
  ensureAutoAssets: (cwd: string, projectId: string) => Promise<void>;
  reportError: (title: string, error: unknown) => void;
  activeId: string | null;
}

export function usePromptSender({
  registry,
  activeIdRef,
  sessions,
  setSessions,
  setActiveId,
  activeProjectId,
  activeProject,
  agentShortcutIds,
  projects,
  environments,
  homeDirRef,
  applyPendingExit,
  ensureAutoAssets,
  reportError,
  activeId,
}: UsePromptSenderProps) {
  async function sendPromptToSession(sessionId: string, prompt: Prompt, mode: "paste" | "send") {
    if (mode === "paste") {
      try {
        registry.current.get(sessionId)?.term.focus();
        await invoke("write_to_session", { id: sessionId, data: prompt.content, source: "user" });
      } catch (err) {
        reportError("Failed to send prompt", err);
      }
      return;
    }

    const text = prompt.content.replace(/[\r\n]+$/, "");
    try {
      registry.current.get(sessionId)?.term.focus();
      if (text) {
        await invoke("write_to_session", { id: sessionId, data: text, source: "user" });
      }
      if (text) await sleep(30);
      await invoke("write_to_session", { id: sessionId, data: "\r", source: "user" });
    } catch (err) {
      reportError("Failed to send prompt", err);
    }
  }

  async function sendPromptToActive(prompt: Prompt, mode: "paste" | "send") {
    const sessionId = activeIdRef.current;
    if (!sessionId) return;
    await sendPromptToSession(sessionId, prompt, mode);
  }

  async function sendPromptFromCommandPalette(prompt: Prompt, mode: "paste" | "send") {
    const projectId = activeProjectId;

    const activeSessionId = activeId;
    const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) ?? null : null;

    const defaultAgentId = agentShortcutIds[0] ?? null;
    const effect =
      getProcessEffectById(activeSession?.effectId) ?? getProcessEffectById(defaultAgentId);

    if (!effect) {
      await sendPromptToActive(prompt, mode);
      return;
    }

    const cwd =
      activeSession?.cwd ?? activeProject?.basePath ?? homeDirRef.current ?? null;
    try {
      if (cwd) await ensureAutoAssets(cwd, projectId);
      const createdRaw = await createSession({
        projectId,
        name: prompt.title.trim() ? prompt.title.trim() : effect.label,
        launchCommand: effect.matchCommands[0] ?? effect.label,
        cwd,
        envVars: envVarsForProjectId(projectId, projects, environments),
      });
      const s = applyPendingExit(createdRaw);
      setSessions((prev) => [...prev, s]);
      setActiveId(s.id);
      await sleep(50);
      await sendPromptToSession(s.id, prompt, mode);
    } catch (err) {
      reportError("Failed to start new session for prompt", err);
    }
  }

  return {
    sendPromptToSession,
    sendPromptToActive,
    sendPromptFromCommandPalette,
  };
}
