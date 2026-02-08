import { create } from 'zustand';
import { maestroClient } from '../utils/MaestroClient';
import type {
  MaestroTask,
  MaestroSession,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSessionPayload,
  UpdateSessionPayload,
} from '../app/types/maestro';
import { useSessionStore } from './useSessionStore';
import { WS_URL } from '../utils/serverConfig';

// Global WebSocket singleton
let globalWs: WebSocket | null = null;
let globalConnecting = false;
let globalReconnectTimeout: number | null = null;
let globalReconnectAttempts = 0;

interface MaestroState {
  tasks: Map<string, MaestroTask>;
  sessions: Map<string, MaestroSession>;
  loading: Set<string>;
  errors: Map<string, string>;
  wsConnected: boolean;
  activeProjectIdRef: string | null;
  fetchTasks: (projectId: string) => Promise<void>;
  fetchTask: (taskId: string) => Promise<void>;
  fetchSessions: (taskId?: string) => Promise<void>;
  fetchSession: (sessionId: string) => Promise<void>;
  createTask: (data: CreateTaskPayload) => Promise<MaestroTask>;
  updateTask: (taskId: string, updates: UpdateTaskPayload) => Promise<MaestroTask>;
  deleteTask: (taskId: string) => Promise<void>;
  createMaestroSession: (data: CreateSessionPayload) => Promise<MaestroSession>;
  updateMaestroSession: (sessionId: string, updates: UpdateSessionPayload) => Promise<MaestroSession>;
  deleteMaestroSession: (sessionId: string) => Promise<void>;
  addTaskToSession: (sessionId: string, taskId: string) => Promise<void>;
  removeTaskFromSession: (sessionId: string, taskId: string) => Promise<void>;
  clearCache: () => void;
  hardRefresh: (projectId: string) => Promise<void>;
  initWebSocket: () => void;
  destroyWebSocket: () => void;
}

export const useMaestroStore = create<MaestroState>((set, get) => {
  // High-frequency events to exclude from detailed logging (reduce noise)
  const HIGH_FREQUENCY_EVENTS = new Set([
    'heartbeat',
    'ping',
    'pong',
    'status:ping',
    'keepalive',
  ]);

  const setLoading = (key: string, isLoading: boolean) => {
    set((prev) => {
      const loading = new Set(prev.loading);
      if (isLoading) loading.add(key); else loading.delete(key);
      return { loading };
    });
  };

  const setError = (key: string, error: string | null) => {
    set((prev) => {
      const errors = new Map(prev.errors);
      if (error) errors.set(key, error); else errors.delete(key);
      return { errors };
    });
  };

  const handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      const timestamp = new Date().toISOString();
      const shouldLogDetails = !HIGH_FREQUENCY_EVENTS.has(message.event);

      // Log incoming event with full details
      if (shouldLogDetails) {
        console.log('\n' + '━'.repeat(80));
        console.log(`📥 CLIENT EVENT RECEIVED`);
        console.log('━'.repeat(80));
        console.log(`🕐 Timestamp: ${timestamp}`);
        console.log(`📡 Event Type: ${message.event}`);
        console.log('\n📦 Event Payload:');
        console.log(JSON.stringify(message.data, null, 2));
        console.log('━'.repeat(80) + '\n');
      }

      switch (message.event) {
        case 'task:created':
        case 'task:updated':
          set((prev) => ({ tasks: new Map(prev.tasks).set(message.data.id, message.data) }));
          break;
        case 'task:deleted':
          set((prev) => { const tasks = new Map(prev.tasks); tasks.delete(message.data.id); return { tasks }; });
          break;
        case 'session:created': {
          const session = message.data.session || message.data;
          set((prev) => ({ sessions: new Map(prev.sessions).set(session.id, session) }));
          break;
        }
        case 'session:updated':
          set((prev) => ({ sessions: new Map(prev.sessions).set(message.data.id, message.data) }));
          break;
        case 'session:deleted':
          set((prev) => { const sessions = new Map(prev.sessions); sessions.delete(message.data.id); return { sessions }; });
          break;
        case 'session:spawn': {
          const session = message.data.session || message.data;
          set((prev) => ({ sessions: new Map(prev.sessions).set(session.id, session) }));
          void useSessionStore.getState().handleSpawnTerminalSession({
            maestroSessionId: session.id,
            name: session.name,
            command: message.data.command,
            args: [],
            cwd: message.data.cwd,
            envVars: message.data.envVars,
            projectId: message.data.projectId,
          });
          break;
        }
        case 'task:session_added':
        case 'task:session_removed':
          get().fetchTask(message.data.taskId);
          break;
        case 'session:task_added':
        case 'session:task_removed':
          get().fetchSession(message.data.sessionId);
          break;
      }
    } catch (err) {
      console.error('\n' + '⚠️'.repeat(40));
      console.error('❌ CLIENT ERROR: Failed to handle WebSocket message');
      console.error('⚠️'.repeat(40));
      console.error('Error:', err);
      console.error('Raw event data:', event.data);
      console.error('⚠️'.repeat(40) + '\n');
    }
  };

  const connectGlobal = () => {
    console.log('[useMaestroStore.connectGlobal] Attempting to connect to WebSocket...');
    console.log('[useMaestroStore.connectGlobal] WS_URL:', WS_URL);
    console.log('[useMaestroStore.connectGlobal] globalConnecting:', globalConnecting);
    console.log('[useMaestroStore.connectGlobal] globalWs state:', globalWs?.readyState);

    if (globalConnecting || (globalWs && globalWs.readyState === WebSocket.OPEN)) {
      console.log('[useMaestroStore.connectGlobal] Skipping - already connecting or connected');
      return;
    }
    globalConnecting = true;
    if (globalWs) { globalWs.close(); globalWs = null; }

    try {
      console.log('[useMaestroStore.connectGlobal] Creating new WebSocket connection...');
      const ws = new WebSocket(WS_URL);
      globalWs = ws;
      console.log('[useMaestroStore.connectGlobal] WebSocket object created');

      ws.onopen = () => {
        const timestamp = new Date().toISOString();
        console.log('\n' + '✅'.repeat(40));
        console.log(`🔌 CLIENT WEBSOCKET CONNECTED`);
        console.log('✅'.repeat(40));
        console.log(`🕐 Timestamp: ${timestamp}`);
        console.log(`🌐 URL: ${WS_URL}`);
        console.log(`🔄 Reconnect attempts: ${globalReconnectAttempts}`);
        console.log('✅'.repeat(40) + '\n');
        set({ wsConnected: true });
        globalConnecting = false;
        globalReconnectAttempts = 0;
        const { activeProjectIdRef } = get();
        if (activeProjectIdRef) {
          get().fetchTasks(activeProjectIdRef);
          get().fetchSessions();
        }
      };

      ws.onmessage = handleMessage;

      ws.onerror = (err) => {
        const timestamp = new Date().toISOString();
        console.error('\n' + '❌'.repeat(40));
        console.error(`🔌 CLIENT WEBSOCKET ERROR`);
        console.error('❌'.repeat(40));
        console.error(`🕐 Timestamp: ${timestamp}`);
        console.error('Error:', err);
        console.error('❌'.repeat(40) + '\n');
      };

      ws.onclose = () => {
        const timestamp = new Date().toISOString();
        const delay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 30000);
        console.log('\n' + '⚠️'.repeat(40));
        console.log(`🔌 CLIENT WEBSOCKET DISCONNECTED`);
        console.log('⚠️'.repeat(40));
        console.log(`🕐 Timestamp: ${timestamp}`);
        console.log(`🌐 URL: ${WS_URL}`);
        console.log(`🔄 Reconnect attempts: ${globalReconnectAttempts}`);
        console.log(`⏱️  Reconnecting in: ${delay}ms`);
        console.log('⚠️'.repeat(40) + '\n');
        set({ wsConnected: false });
        globalConnecting = false;
        globalWs = null;
        if (globalReconnectTimeout) clearTimeout(globalReconnectTimeout);
        globalReconnectTimeout = window.setTimeout(() => {
          globalReconnectAttempts++;
          connectGlobal();
        }, delay);
      };
    } catch (err) {
      const timestamp = new Date().toISOString();
      console.error('\n' + '❌'.repeat(40));
      console.error('🔌 FAILED TO CREATE WEBSOCKET CONNECTION');
      console.error('❌'.repeat(40));
      console.error(`🕐 Timestamp: ${timestamp}`);
      console.error('🌐 URL:', WS_URL);
      console.error('Error:', err);
      console.error('❌'.repeat(40) + '\n');
      globalConnecting = false;
    }
  };

  return {
    tasks: new Map(),
    sessions: new Map(),
    loading: new Set(),
    errors: new Map(),
    wsConnected: false,
    activeProjectIdRef: null,

    fetchTasks: async (projectId) => {
      const key = `tasks:${projectId}`;
      set({ activeProjectIdRef: projectId });
      setLoading(key, true);
      setError(key, null);
      try {
        const tasks = await maestroClient.getTasks(projectId);
        set((prev) => {
          const taskMap = new Map(prev.tasks);
          tasks.forEach((task) => taskMap.set(task.id, task));
          return { tasks: taskMap };
        });
      } catch (err) {
        setError(key, err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(key, false);
      }
    },

    fetchTask: async (taskId) => {
      const key = `task:${taskId}`;
      setLoading(key, true);
      setError(key, null);
      try {
        const task = await maestroClient.getTask(taskId);
        set((prev) => ({ tasks: new Map(prev.tasks).set(task.id, task) }));
      } catch (err) {
        setError(key, err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(key, false);
      }
    },

    fetchSessions: async (taskId) => {
      const key = taskId ? `sessions:task:${taskId}` : 'sessions';
      setLoading(key, true);
      setError(key, null);
      try {
        const sessions = await maestroClient.getSessions(taskId);
        set((prev) => {
          const sessionMap = new Map(prev.sessions);
          sessions.forEach((session) => sessionMap.set(session.id, session));
          return { sessions: sessionMap };
        });
      } catch (err) {
        setError(key, err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(key, false);
      }
    },

    fetchSession: async (sessionId) => {
      const key = `session:${sessionId}`;
      setLoading(key, true);
      setError(key, null);
      try {
        const session = await maestroClient.getSession(sessionId);
        set((prev) => ({ sessions: new Map(prev.sessions).set(session.id, session) }));
        for (const taskId of session.taskIds) {
          if (!get().tasks.has(taskId)) get().fetchTask(taskId);
        }
      } catch (err) {
        setError(key, err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(key, false);
      }
    },

    createTask: async (data) => await maestroClient.createTask(data),
    updateTask: async (taskId, updates) => await maestroClient.updateTask(taskId, updates),
    deleteTask: async (taskId) => { await maestroClient.deleteTask(taskId); },
    createMaestroSession: async (data) => await maestroClient.createSession(data),
    updateMaestroSession: async (sessionId, updates) => await maestroClient.updateSession(sessionId, updates),
    deleteMaestroSession: async (sessionId) => { await maestroClient.deleteSession(sessionId); },
    addTaskToSession: async (sessionId, taskId) => { await maestroClient.addTaskToSession(sessionId, taskId); },
    removeTaskFromSession: async (sessionId, taskId) => { await maestroClient.removeTaskFromSession(sessionId, taskId); },

    clearCache: () => set({ tasks: new Map(), sessions: new Map(), loading: new Set(), errors: new Map() }),

    hardRefresh: async (projectId) => {
      get().clearCache();
      if (projectId) {
        await get().fetchTasks(projectId);
        await get().fetchSessions();
      }
    },

    initWebSocket: () => {
      console.log('[useMaestroStore.initWebSocket] Called - initiating WebSocket connection');
      connectGlobal();
    },
    destroyWebSocket: () => {
      if (globalReconnectTimeout) { clearTimeout(globalReconnectTimeout); globalReconnectTimeout = null; }
      if (globalWs) { globalWs.close(); globalWs = null; }
      globalConnecting = false;
    },
  };
});
