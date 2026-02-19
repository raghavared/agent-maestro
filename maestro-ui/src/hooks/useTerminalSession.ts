import React, { useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TerminalSession, TerminalSessionInfo } from "../app/types/session";

export function useTerminalSession(
  setSessions: React.Dispatch<React.SetStateAction<TerminalSession[]>>,
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>,
  reportError: (prefix: string, err: unknown) => void
) {
  const reportErrorRef = useRef(reportError);
  reportErrorRef.current = reportError;

  const spawningSessionsRef = useRef<Set<string>>(new Set());

  const spawnTerminalSession = useCallback(async (sessionInfo: {
    name: string;
    command: string | null;
    args: string[];
    cwd: string;
    envVars: Record<string, string>;
    projectId: string;
  }) => {
    // Use session name + project as dedup key
    const dedupKey = `${sessionInfo.projectId}:${sessionInfo.name}`;

    // Prevent duplicate spawns - check and add atomically
    if (spawningSessionsRef.current.has(dedupKey)) {
      return;
    }

    // Add to set immediately to block duplicates
    spawningSessionsRef.current.add(dedupKey);

    try {
      const info = await invoke<TerminalSessionInfo>("create_session", {
        name: sessionInfo.name,
        command: sessionInfo.command,
        cwd: sessionInfo.cwd,
        cols: 200,
        rows: 50,
        env_vars: sessionInfo.envVars,
        persistent: false,
      });

      const newSession: TerminalSession = {
        ...info,
        projectId: sessionInfo.projectId,
        persistId: "",
        persistent: false,
        createdAt: Date.now(),
        launchCommand: sessionInfo.command,
        sshTarget: null,
        sshRootDir: null,
        cwd: sessionInfo.cwd,
        agentWorking: false,
        exited: false,
      };

      setSessions((prev) => [...prev, newSession]);
      setActiveId(newSession.id);

      // Clean up dedup key after a short delay
      setTimeout(() => {
        spawningSessionsRef.current.delete(dedupKey);
      }, 2000);
    } catch (err) {
      reportErrorRef.current("Failed to spawn terminal session", err);
      // Clean up dedup key immediately on error so user can retry
      spawningSessionsRef.current.delete(dedupKey);
    }
  }, [setSessions, setActiveId]);

  return { spawnTerminalSession };
}
