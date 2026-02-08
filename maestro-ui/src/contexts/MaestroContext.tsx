import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { maestroClient } from '../utils/MaestroClient';
import { useMaestroWebSocket } from '../hooks/useMaestroWebSocket';
import { homeDir } from '@tauri-apps/api/path';
import { SERVER_URL } from '../utils/serverConfig';
import type {
    MaestroTask,
    MaestroSession,
    CreateTaskPayload,
    UpdateTaskPayload,
    CreateSessionPayload,
    UpdateSessionPayload
} from '../app/types/maestro';

// Helper to build session configuration
/**
 * Build session configuration for spawning
 *
 * ARCHITECTURAL NOTE:
 * The UI's ONLY job is to spawn a terminal with environment variables set.
 * The Maestro CLI (via `maestro worker init`) handles EVERYTHING else:
 * - Fetching session metadata
 * - Loading skills and prompts
 * - Executing hooks and scripts
 * - Spawning Claude with proper configuration
 * - Reporting status to server
 *
 * This makes the system portable, testable, and extensible.
 */
async function buildSessionConfig(
    session: MaestroSession,
    projectId: string,
    taskIds: string[],
    skillIds: string[] = ['maestro-worker']
): Promise<{
    envVars: Record<string, string>;
    command: string | null;
    args: string[];
    cwd: string;
    name: string;
}> {
    // 1. Fetch project for working directory
    let project;
    try {
        project = await maestroClient.getProject(projectId);
    } catch (err) {
        console.warn('[buildSessionConfig] Project not found, using defaults:', projectId);
        project = {
            id: projectId,
            name: 'Unknown Project',
            workingDir: null
        };
    }

    // 2. Fetch full task objects for ALL tasks in this session
    // CLI-First Architecture: The CLI needs COMPLETE task objects, not just IDs
    const tasks: MaestroTask[] = [];
    for (const taskId of taskIds) {
        try {
            const task = await maestroClient.getTask(taskId);
            tasks.push(task);
            console.log('[buildSessionConfig] Fetched task:', task.id);
        } catch (err) {
            console.error('[buildSessionConfig] Failed to fetch task:', taskId, err);
            throw new Error(`Cannot spawn session: Task ${taskId} not found`);
        }
    }

    if (tasks.length === 0) {
        throw new Error('Cannot spawn session: No tasks provided');
    }

    const homeDirPath = await homeDir();

    // 3. Set environment variables for the session
    // The Maestro CLI will read these to configure everything
    const envVars: Record<string, string> = {
        // Session identification
        MAESTRO_SESSION_ID: session.id,
        MAESTRO_PROJECT_ID: projectId,

        // Task data (CLI-First Architecture: Primary task as FULL object)
        // For multi-task sessions, the primary task is the first one
        MAESTRO_TASK_DATA: JSON.stringify(tasks[0]),

        // All task IDs (for multi-task sessions, CLI can fetch others if needed)
        MAESTRO_TASK_IDS: taskIds.join(','),

        // Skill configuration (plural: supports comma-separated skills)
        MAESTRO_SKILLS: skillIds.join(','),

        // Server connection
        MAESTRO_API_URL: SERVER_URL,

        // Agent configuration (optional)
        MAESTRO_AGENT_ID: session.agentId || 'claude',
        MAESTRO_AGENT_MODEL: session.model || tasks[0].model || 'sonnet',
    };

    // 4. Command: Just call 'maestro worker init'
    // The CLI takes over from here!
    const command = 'maestro';
    const args = ['worker', 'init'];

    return {
        envVars,
        command,
        args,
        cwd: project.workingDir || homeDirPath,
        name: session.name,
    };
}

// ==================== TYPES ====================

type MaestroState = {
    tasks: Map<string, MaestroTask>;           // taskId -> Task
    sessions: Map<string, MaestroSession>;     // sessionId -> Session
    loading: Set<string>;               // Resource IDs currently loading
    errors: Map<string, string>;        // Resource ID -> error message
};

type MaestroContextValue = {
    state: MaestroState;
    // Fetch methods
    fetchTasks: (projectId: string) => Promise<void>;
    fetchTask: (taskId: string) => Promise<void>;
    fetchSessions: (taskId?: string) => Promise<void>;
    fetchSession: (sessionId: string) => Promise<void>;
    // Mutation methods
    createTask: (data: CreateTaskPayload) => Promise<MaestroTask>;
    updateTask: (taskId: string, updates: UpdateTaskPayload) => Promise<MaestroTask>;
    deleteTask: (taskId: string) => Promise<void>;
    createSession: (data: CreateSessionPayload) => Promise<MaestroSession>;
    updateSession: (sessionId: string, updates: UpdateSessionPayload) => Promise<MaestroSession>;
    deleteSession: (sessionId: string) => Promise<void>;
    addTaskToSession: (sessionId: string, taskId: string) => Promise<void>;
    removeTaskFromSession: (sessionId: string, taskId: string) => Promise<void>;
    // Cache management
    clearCache: () => void;
    hardRefresh: (projectId: string) => Promise<void>;
};

// ==================== CONTEXT ====================

const MaestroContext = createContext<MaestroContextValue | null>(null);

// ==================== PROVIDER ====================

type MaestroProviderProps = {
    children: React.ReactNode;
    onSpawnTerminalSession?: (sessionInfo: {
        name: string;
        command: string | null;
        args: string[];
        cwd: string;
        envVars: Record<string, string>;
        projectId: string;
    }) => Promise<void>;
};

export function MaestroProvider({ children, onSpawnTerminalSession }: MaestroProviderProps) {
    const [state, setState] = useState<MaestroState>({
        tasks: new Map(),
        sessions: new Map(),
        loading: new Set(),
        errors: new Map(),
    });

    // Track active project for reconnection
    const activeProjectIdRef = useRef<string | null>(null);

    // ==================== HELPERS ====================

    const setLoading = useCallback((key: string, isLoading: boolean) => {
        setState(prev => {
            const loading = new Set(prev.loading);
            if (isLoading) {
                loading.add(key);
            } else {
                loading.delete(key);
            }
            return { ...prev, loading };
        });
    }, []);

    const setError = useCallback((key: string, error: string | null) => {
        setState(prev => {
            const errors = new Map(prev.errors);
            if (error) {
                errors.set(key, error);
            } else {
                errors.delete(key);
            }
            return { ...prev, errors };
        });
    }, []);

    // ==================== WEBSOCKET HANDLERS ====================

    // Initialize ref with current value immediately
    const onSpawnTerminalSessionRef = useRef(onSpawnTerminalSession);
    // Keep ref updated
    onSpawnTerminalSessionRef.current = onSpawnTerminalSession;

    const websocketCallbacks = React.useMemo(() => ({
        onTaskCreated: (task: MaestroTask) => {
            console.log('[MaestroContext] WebSocket: Task created', task.id);
            setState(prev => ({
                ...prev,
                tasks: new Map(prev.tasks).set(task.id, task),
            }));
        },

        onTaskUpdated: (task: MaestroTask) => {
            console.log('[MaestroContext] WebSocket: Task updated', task.id);
            setState(prev => ({
                ...prev,
                tasks: new Map(prev.tasks).set(task.id, task),
            }));
        },

        onTaskDeleted: (data: { id: string }) => {
            console.log('[MaestroContext] WebSocket: Task deleted', data.id);
            setState(prev => {
                const tasks = new Map(prev.tasks);
                tasks.delete(data.id);
                return { ...prev, tasks };
            });
        },

        onSessionCreated: async (data: any) => {
            console.log('[MaestroContext] WebSocket: Session created', data.session?.id || data.id);

            // Check if this is a spawn-created session with spawn data
            const isSpawnCreated = data._isSpawnCreated || (data.command && data.envVars);

            if (isSpawnCreated) {
                console.log('[MaestroContext] Maestro spawn session detected - spawning terminal');
                console.log('[MaestroContext] Spawn source:', data.spawnSource || 'unknown');
                if (data.parentSessionId) {
                    console.log('[MaestroContext] Parent session:', data.parentSessionId);
                }

                // Extract session object - could be nested or top level
                const session = data.session || data;
                const callback = onSpawnTerminalSessionRef.current;

                if (!callback) {
                    console.error('[MaestroContext] onSpawnTerminalSession callback not provided');
                    return;
                }

                try {
                    console.log('[MaestroContext] Calling onSpawnTerminalSession callback...');
                    console.log('[MaestroContext] Command:', data.command);
                    console.log('[MaestroContext] Env vars:', Object.keys(data.envVars || {}));

                    // Spawn terminal with data from the event
                    await callback({
                        name: session.name,
                        command: data.command,
                        args: [],
                        cwd: data.cwd,
                        envVars: data.envVars,
                        projectId: data.projectId,
                    });

                    console.log('[MaestroContext] Session spawned successfully');
                } catch (err) {
                    console.error('[MaestroContext] Failed to spawn session:', err);
                }
            }

            // Update session cache for all sessions (regular or spawn)
            const session = data.session || data;
            setState(prev => ({
                ...prev,
                sessions: new Map(prev.sessions).set(session.id, session),
            }));
        },

        onSessionUpdated: (session: MaestroSession) => {
            console.log('[MaestroContext] WebSocket: Session updated', session.id);
            setState(prev => ({
                ...prev,
                sessions: new Map(prev.sessions).set(session.id, session),
            }));
        },

        onSessionDeleted: (data: { id: string }) => {
            console.log('[MaestroContext] WebSocket: Session deleted', data.id);
            setState(prev => {
                const sessions = new Map(prev.sessions);
                const deleted = sessions.delete(data.id);
                console.log('[MaestroContext] Session deleted from cache?', deleted);
                return { ...prev, sessions };
            });
        },

        onConnected: () => {
            console.log('[MaestroContext] WebSocket reconnected - refreshing data');
            // Refetch active project tasks
            if (activeProjectIdRef.current) {
                fetchTasks(activeProjectIdRef.current);
            }
        },

        onDisconnected: () => {
            console.warn('[MaestroContext] WebSocket disconnected');
        },
    }), []); // Empty deps - callbacks use refs and setState which are stable

    useMaestroWebSocket(websocketCallbacks);

    // ==================== FETCH METHODS ====================

    const fetchTasks = useCallback(async (projectId: string) => {
        const key = `tasks:${projectId}`;
        console.log('[MaestroContext] Fetching tasks for project:', projectId);

        activeProjectIdRef.current = projectId;
        setLoading(key, true);
        setError(key, null);

        try {
            const tasks = await maestroClient.getTasks(projectId);
            console.log('[MaestroContext] ✓ Fetched', tasks.length, 'tasks');

            setState(prev => {
                const taskMap = new Map(prev.tasks);
                tasks.forEach(task => taskMap.set(task.id, task));
                return { ...prev, tasks: taskMap };
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[MaestroContext] ✗ Failed to fetch tasks:', errorMsg);
            setError(key, errorMsg);
        } finally {
            setLoading(key, false);
        }
    }, [setLoading, setError]);

    const fetchTask = useCallback(async (taskId: string) => {
        const key = `task:${taskId}`;
        setLoading(key, true);
        setError(key, null);

        try {
            const task = await maestroClient.getTask(taskId);
            setState(prev => ({
                ...prev,
                tasks: new Map(prev.tasks).set(task.id, task),
            }));
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(key, errorMsg);
        } finally {
            setLoading(key, false);
        }
    }, [setLoading, setError]);

    const fetchSessions = useCallback(async (taskId?: string) => {
        const key = taskId ? `sessions:task:${taskId}` : 'sessions';
        console.log('[MaestroContext] Fetching sessions', taskId ? `for task ${taskId}` : '');

        setLoading(key, true);
        setError(key, null);

        try {
            const sessions = await maestroClient.getSessions(taskId);
            console.log('[MaestroContext] ✓ Fetched', sessions.length, 'sessions');

            setState(prev => {
                const sessionMap = new Map(prev.sessions);
                sessions.forEach(session => sessionMap.set(session.id, session));
                return { ...prev, sessions: sessionMap };
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[MaestroContext] ✗ Failed to fetch sessions:', errorMsg);
            setError(key, errorMsg);
        } finally {
            setLoading(key, false);
        }
    }, [setLoading, setError]);

    const fetchSession = useCallback(async (sessionId: string) => {
        const key = `session:${sessionId}`;
        setLoading(key, true);
        setError(key, null);

        try {
            const session = await maestroClient.getSession(sessionId);
            setState(prev => ({
                ...prev,
                sessions: new Map(prev.sessions).set(session.id, session),
            }));

            // Also fetch all tasks for this session
            for (const taskId of session.taskIds) {
                if (!state.tasks.has(taskId)) {
                    fetchTask(taskId);
                }
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(key, errorMsg);
        } finally {
            setLoading(key, false);
        }
    }, [setLoading, setError, state.tasks, fetchTask]);

    // ==================== MUTATION METHODS ====================

    const createTask = useCallback(async (data: CreateTaskPayload): Promise<MaestroTask> => {
        console.log('[MaestroContext] Creating task:', data.title);
        const task = await maestroClient.createTask(data);
        // Task will be added via WebSocket event
        return task;
    }, []);

    const updateTask = useCallback(async (taskId: string, updates: UpdateTaskPayload): Promise<MaestroTask> => {
        console.log('[MaestroContext] Updating task:', taskId);
        const task = await maestroClient.updateTask(taskId, updates);
        // Task will be updated via WebSocket event
        return task;
    }, []);

    const deleteTask = useCallback(async (taskId: string): Promise<void> => {
        console.log('[MaestroContext] Deleting task:', taskId);
        await maestroClient.deleteTask(taskId);
        // Task will be removed via WebSocket event
    }, []);

    const createSession = useCallback(async (data: CreateSessionPayload): Promise<MaestroSession> => {
        console.log('[MaestroContext] Creating session:', data.name);
        const session = await maestroClient.createSession(data);
        // Session will be added via WebSocket event
        return session;
    }, []);

    const updateSession = useCallback(async (sessionId: string, updates: UpdateSessionPayload): Promise<MaestroSession> => {
        console.log('[MaestroContext] Updating session:', sessionId);
        const session = await maestroClient.updateSession(sessionId, updates);
        // Session will be updated via WebSocket event
        return session;
    }, []);

    const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
        console.log('[MaestroContext] Deleting session:', sessionId);
        await maestroClient.deleteSession(sessionId);
        // Session will be removed via WebSocket event
    }, []);

    const addTaskToSession = useCallback(async (sessionId: string, taskId: string): Promise<void> => {
        console.log('[MaestroContext] Adding task', taskId, 'to session', sessionId);
        await maestroClient.addTaskToSession(sessionId, taskId);
        // Relationship will be updated via WebSocket events
    }, []);

    const removeTaskFromSession = useCallback(async (sessionId: string, taskId: string): Promise<void> => {
        console.log('[MaestroContext] Removing task', taskId, 'from session', sessionId);
        await maestroClient.removeTaskFromSession(sessionId, taskId);
        // Relationship will be updated via WebSocket events
    }, []);

    // ==================== CACHE MANAGEMENT ====================

    const clearCache = useCallback(() => {
        console.log('[MaestroContext] 🗑️  Clearing all cache');
        setState({
            tasks: new Map(),
            sessions: new Map(),
            loading: new Set(),
            errors: new Map(),
        });
    }, []);

    const hardRefresh = useCallback(async (projectId: string) => {
        console.log('[MaestroContext] 🔄 Hard refresh - clearing cache and refetching');

        // Clear all cache first
        clearCache();

        // Refetch tasks for the project
        if (projectId) {
            await fetchTasks(projectId);
            console.log('[MaestroContext] ✓ Hard refresh complete');
        }
    }, [clearCache, fetchTasks]);

    // ==================== CONTEXT VALUE ====================

    const value: MaestroContextValue = {
        state,
        fetchTasks,
        fetchTask,
        fetchSessions,
        fetchSession,
        createTask,
        updateTask,
        deleteTask,
        createSession,
        updateSession,
        deleteSession,
        addTaskToSession,
        removeTaskFromSession,
        clearCache,
        hardRefresh,
    };

    return (
        <MaestroContext.Provider value={value}>
            {children}
        </MaestroContext.Provider>
    );
}

// ==================== HOOK ====================

export function useMaestroContext() {
    const context = useContext(MaestroContext);
    if (!context) {
        throw new Error('useMaestroContext must be used within MaestroProvider');
    }
    return context;
}
