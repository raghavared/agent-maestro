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
            } else {
                console.warn(`[App] Could not find UI session for Maestro session ${maestroSessionId}`);
            }
        },
        [sessions, setActiveId]
    );

    const handleAddTaskToSessionRequest = useCallback((taskId: string) => {
        console.log("Request to add task", taskId, "to existing session");
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
                console.log("[App] ⚠️  Session spawn already in progress, skipping:", sessionInfo.name);
                return;
            }

            // Add to set immediately to block duplicates
            spawningSessionsRef.current.add(dedupKey);
            console.log("[App] Spawning terminal session:", sessionInfo.name);

            try {
                console.log("[App] ℹ️  Passing env_vars to Tauri:", {
                    hasEnvVars: !!sessionInfo.envVars,
                    envVarKeys: sessionInfo.envVars ? Object.keys(sessionInfo.envVars) : [],
                    hasMaestroManifestPath: sessionInfo.envVars?.["MAESTRO_MANIFEST_PATH"] ? "YES" : "NO",
                    manifestPathValue: sessionInfo.envVars?.["MAESTRO_MANIFEST_PATH"]?.substring(0, 80),
                });

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

                console.log("[App] ✓ Terminal session spawned:", newSession.id);

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
