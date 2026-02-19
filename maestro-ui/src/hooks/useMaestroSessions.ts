import { useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TerminalSession, TerminalSessionInfo } from "../app/types/session";

interface UseMaestroSessionsProps {
    sessions: TerminalSession[];
    setSessions: React.Dispatch<React.SetStateAction<TerminalSession[]>>;
    setActiveId: (id: string | null) => void;
    reportError: (title: string, error: unknown) => void;
}

export function useMaestroSessions({
    sessions,
    setSessions,
    setActiveId,
    reportError,
}: UseMaestroSessionsProps) {
    const spawningSessionsRef = useRef<Set<string>>(new Set());

    const handleJumpToSessionFromTask = useCallback(
        (maestroSessionId: string) => {
            const uiSession = sessions.find((s) => s.maestroSessionId === maestroSessionId);
            if (uiSession) {
                setActiveId(uiSession.id);
            }
        },
        [sessions, setActiveId]
    );

    const handleAddTaskToSessionRequest = useCallback((taskId: string) => {
        // TODO: Implement session selection modal
        // For now, we can maybe open ManageTerminalsModal but it doesn't support selection mode yet.
        alert("Select a session to add this task to (Not implemented yet)");
    }, []);

    const handleSpawnTerminalSession = useCallback(
        async (sessionInfo: {
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
                reportError("Failed to spawn terminal session", err);
            }
        },
        [setSessions, setActiveId, reportError]
    );

    return {
        handleJumpToSessionFromTask,
        handleAddTaskToSessionRequest,
        handleSpawnTerminalSession,
    };
}
