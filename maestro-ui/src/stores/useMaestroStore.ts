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
import { playEventSound } from '../services/soundManager';

// Global WebSocket singleton
let globalWs: WebSocket | null = null;
let globalConnecting = false;
let globalReconnectTimeout: number | null = null;
let globalReconnectAttempts = 0;

export interface AgentModal {
  sessionId: string;
  modalId: string;
  title: string;
  html: string;
  filePath?: string;
  timestamp: number;
}

interface MaestroState {
  tasks: Map<string, MaestroTask>;
  sessions: Map<string, MaestroSession>;
  activeModals: AgentModal[];
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
  clearNeedsInput: (maestroSessionId: string) => void;
  checkAndClearNeedsInputForActiveSession: () => void;
  showAgentModal: (modal: AgentModal) => void;
  closeAgentModal: (modalId: string) => void;
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

  // Normalize session data to ensure required fields exist
  const normalizeSession = (session: any): any => {
    if (!session) return session;
    if (!Array.isArray(session.taskIds)) {
      console.warn('[useMaestroStore] Session missing taskIds, defaulting to []:', session.id);
      session.taskIds = [];
    }
    if (!Array.isArray(session.timeline)) {
      session.timeline = [];
    }
    if (!Array.isArray(session.events)) {
      session.events = [];
    }
    if (!session.status) {
      console.warn('[useMaestroStore] Session missing status, defaulting to "spawning":', session.id);
      session.status = 'spawning';
    }
    return session;
  };

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
        case 'task:updated': {
          const taskData = message.data;
          // Ensure taskSessionStatuses is always an object (never null/undefined)
          if (!taskData.taskSessionStatuses || typeof taskData.taskSessionStatuses !== 'object') {
            taskData.taskSessionStatuses = {};
          }
          set((prev) => ({ tasks: new Map(prev.tasks).set(taskData.id, taskData) }));
          // Play sound for event
          playEventSound(message.event as any);
          break;
        }
        case 'task:deleted':
          set((prev) => { const tasks = new Map(prev.tasks); tasks.delete(message.data.id); return { tasks }; });
          // Play sound for event
          playEventSound(message.event as any);
          break;
        case 'session:created': {
          const session = normalizeSession(message.data.session || message.data);
          set((prev) => ({ sessions: new Map(prev.sessions).set(session.id, session) }));
          // Play sound for event
          playEventSound(message.event as any);
          break;
        }
        case 'session:updated': {
          const updatedSession = normalizeSession(message.data);
          if (updatedSession.needsInput) {
            console.log('[useMaestroStore] session:updated has needsInput:', updatedSession.id, updatedSession.needsInput);
          }
          set((prev) => ({ sessions: new Map(prev.sessions).set(updatedSession.id, updatedSession) }));

          // Trigger 2: If needsInput just became active and user is viewing this session, auto-clear
          if (updatedSession.needsInput?.active) {
            const activeLocalSession = useSessionStore.getState().sessions.find(
              (s) => s.maestroSessionId === updatedSession.id
            );
            const activeId = useSessionStore.getState().activeId;
            const { activeProjectIdRef } = get();
            if (
              activeLocalSession &&
              activeLocalSession.id === activeId &&
              activeProjectIdRef === updatedSession.projectId
            ) {
              get().clearNeedsInput(updatedSession.id);
            }
          }
          // Play sound for event (only if not a high-frequency update)
          if (shouldLogDetails) {
            playEventSound(message.event as any);
          }
          break;
        }
        case 'session:deleted':
          set((prev) => { const sessions = new Map(prev.sessions); sessions.delete(message.data.id); return { sessions }; });
          // Play sound for event
          playEventSound(message.event as any);
          break;
        case 'session:spawn': {
          const session = normalizeSession(message.data.session || message.data);
          if (!session?.id) {
            console.error('session:spawn event missing session id', message.data);
            break;
          }
          set((prev) => ({ sessions: new Map(prev.sessions).set(session.id, session) }));
          void useSessionStore.getState().handleSpawnTerminalSession({
            maestroSessionId: session.id,
            name: session.name || '',
            command: message.data.command ?? null,
            args: [],
            cwd: message.data.cwd || '',
            envVars: message.data.envVars || {},
            projectId: message.data.projectId || '',
          });
          // Play sound for session creation
          playEventSound('session:created');
          break;
        }
        case 'task:session_added':
        case 'task:session_removed':
          if (message.data?.taskId) get().fetchTask(message.data.taskId);
          // Play sound for event
          playEventSound(message.event as any);
          break;
        case 'session:task_added':
        case 'session:task_removed':
          if (message.data?.sessionId) get().fetchSession(message.data.sessionId);
          // Play sound for event
          playEventSound(message.event as any);
          break;
        // Notification events — play dedicated sounds
        case 'notify:task_completed':
        case 'notify:task_failed':
        case 'notify:task_blocked':
        case 'notify:task_session_completed':
        case 'notify:task_session_failed':
        case 'notify:session_completed':
        case 'notify:session_failed':
        case 'notify:needs_input':
        case 'notify:progress':
          console.log(`[useMaestroStore] 🔔 NOTIFY EVENT RECEIVED: ${message.event}`, JSON.stringify(message.data));
          console.log(`[useMaestroStore] 🔔 Playing sound for: ${message.event}`);
          playEventSound(message.event as any);
          break;
        case 'session:modal': {
          const modalData = message.data as AgentModal;
          console.log(`[useMaestroStore] 📋 MODAL RECEIVED: ${modalData.modalId} (${modalData.title})`);
          get().showAgentModal(modalData);
          break;
        }
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
    activeModals: [],
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
          tasks.forEach((task) => {
            if (!task.taskSessionStatuses || typeof task.taskSessionStatuses !== 'object') {
              task.taskSessionStatuses = {};
            }
            taskMap.set(task.id, task);
          });
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
        if (!task.taskSessionStatuses || typeof task.taskSessionStatuses !== 'object') {
          task.taskSessionStatuses = {};
        }
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
          sessions.forEach((session) => sessionMap.set(session.id, normalizeSession(session)));
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
        const session = normalizeSession(await maestroClient.getSession(sessionId));
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

    clearNeedsInput: (maestroSessionId) => {
      const session = get().sessions.get(maestroSessionId);
      if (!session?.needsInput?.active) return;
      // Optimistically update local state
      set((prev) => {
        const sessions = new Map(prev.sessions);
        const s = sessions.get(maestroSessionId);
        if (s) {
          sessions.set(maestroSessionId, { ...s, needsInput: { active: false } });
        }
        return { sessions };
      });
      // PATCH server
      maestroClient.updateSession(maestroSessionId, { needsInput: { active: false } }).catch((err) => {
        console.error('[useMaestroStore] Failed to clear needsInput:', err);
      });
    },

    checkAndClearNeedsInputForActiveSession: () => {
      const activeId = useSessionStore.getState().activeId;
      if (!activeId) return;
      const activeLocalSession = useSessionStore.getState().sessions.find((s) => s.id === activeId);
      if (!activeLocalSession?.maestroSessionId) return;
      const maestroSession = get().sessions.get(activeLocalSession.maestroSessionId);
      if (!maestroSession?.needsInput?.active) return;
      const { activeProjectIdRef } = get();
      if (activeProjectIdRef !== maestroSession.projectId) return;
      get().clearNeedsInput(activeLocalSession.maestroSessionId);
    },

    showAgentModal: (modal) => {
      set((prev) => {
        // Don't add duplicate modals
        if (prev.activeModals.some((m) => m.modalId === modal.modalId)) return prev;
        return { activeModals: [...prev.activeModals, modal] };
      });
    },

    closeAgentModal: (modalId) => {
      set((prev) => ({
        activeModals: prev.activeModals.filter((m) => m.modalId !== modalId),
      }));
    },

    clearCache: () => set({ tasks: new Map(), sessions: new Map(), activeModals: [], loading: new Set(), errors: new Map() }),

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
