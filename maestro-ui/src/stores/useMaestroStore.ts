import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { maestroClient } from '../utils/MaestroClient';
import type {
  MaestroTask,
  MaestroSession,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSessionPayload,
  UpdateSessionPayload,
  Ordering,
  TeamMember,
  CreateTeamMemberPayload,
  UpdateTeamMemberPayload,
  Team,
  CreateTeamPayload,
  UpdateTeamPayload,
  WorkflowTemplate,
} from '../app/types/maestro';
import { useSessionStore } from './useSessionStore';
import { WS_URL } from '../utils/serverConfig';
import { playEventSound, soundManager } from '../services/soundManager';
import { usePromptAnimationStore } from './usePromptAnimationStore';

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
  teamMembers: Map<string, TeamMember>;
  teams: Map<string, Team>;
  activeModals: AgentModal[];
  loading: Set<string>;
  errors: Map<string, string>;
  wsConnected: boolean;
  activeProjectIdRef: string | null;
  // Ordering state
  taskOrdering: Map<string, string[]>;    // projectId -> orderedIds
  sessionOrdering: Map<string, string[]>; // projectId -> orderedIds
  // Workflow templates
  workflowTemplates: WorkflowTemplate[];
  // Last used team member per task (persisted to localStorage)
  lastUsedTeamMember: Record<string, string>;
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
  // Ordering actions
  fetchTaskOrdering: (projectId: string) => Promise<void>;
  fetchSessionOrdering: (projectId: string) => Promise<void>;
  saveTaskOrdering: (projectId: string, orderedIds: string[]) => Promise<void>;
  saveSessionOrdering: (projectId: string, orderedIds: string[]) => Promise<void>;
  // Team member actions
  fetchTeamMembers: (projectId: string) => Promise<void>;
  createTeamMember: (data: CreateTeamMemberPayload) => Promise<TeamMember>;
  updateTeamMember: (id: string, projectId: string, updates: UpdateTeamMemberPayload) => Promise<TeamMember>;
  deleteTeamMember: (id: string, projectId: string) => Promise<void>;
  archiveTeamMember: (id: string, projectId: string) => Promise<void>;
  unarchiveTeamMember: (id: string, projectId: string) => Promise<void>;
  resetDefaultTeamMember: (id: string, projectId: string) => Promise<void>;
  setLastUsedTeamMember: (taskId: string, teamMemberId: string) => void;
  fetchWorkflowTemplates: () => Promise<void>;
  // Team actions
  fetchTeams: (projectId: string) => Promise<void>;
  createTeam: (data: CreateTeamPayload) => Promise<Team>;
  updateTeam: (id: string, projectId: string, updates: UpdateTeamPayload) => Promise<Team>;
  deleteTeam: (id: string, projectId: string) => Promise<void>;
  archiveTeam: (id: string, projectId: string) => Promise<void>;
  unarchiveTeam: (id: string, projectId: string) => Promise<void>;
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
      session.taskIds = [];
    }
    if (!Array.isArray(session.timeline)) {
      session.timeline = [];
    }
    if (!Array.isArray(session.events)) {
      session.events = [];
    }
    if (!session.status) {
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
      const shouldLogDetails = !HIGH_FREQUENCY_EVENTS.has(message.event);

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
          set((prev) => ({ sessions: new Map(prev.sessions).set(updatedSession.id, updatedSession) }));
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
        case 'session:prompt_send': {
          const { sessionId: maestroSessionId, content, mode: promptMode, senderSessionId } = message.data;

          // Trigger flying dot animation
          usePromptAnimationStore.getState().addAnimation({
            senderMaestroSessionId: senderSessionId || null,
            targetMaestroSessionId: maestroSessionId,
            content: content || '',
          });

          const sessions = useSessionStore.getState().sessions;
          const terminalSession = sessions.find(
            (s) => s.maestroSessionId === maestroSessionId && !s.exited
          );
          if (!terminalSession) {
            break;
          }
          // Write directly to PTY with 'system' source to distinguish programmatic input from user keyboard input
          const ptyId = terminalSession.id;
          const text = content.replace(/[\r\n]+$/, '');
          (async () => {
            try {
              if (promptMode === 'paste') {
                await invoke('write_to_session', { id: ptyId, data: text, source: 'system' });
              } else {
                if (text) {
                  await invoke('write_to_session', { id: ptyId, data: text, source: 'system' });
                  await new Promise(r => setTimeout(r, 200));
                }
                await invoke('write_to_session', { id: ptyId, data: '\r', source: 'system' });
              }
            } catch {
            }
          })();
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
        // Notification events — play dedicated sounds using team member ensemble if available
        case 'notify:task_completed':
        case 'notify:task_failed':
        case 'notify:task_blocked':
        case 'notify:task_session_completed':
        case 'notify:task_session_failed':
        case 'notify:session_completed':
        case 'notify:session_failed':
        case 'notify:needs_input':
        case 'notify:progress': {
          // Try to get team member IDs from the associated session for ensemble sound
          const sessionId = message.data?.sessionId;
          let teamMemberIds: string[] = [];
          if (sessionId) {
            const session = get().sessions.get(sessionId);
            if (session?.teamMemberIds?.length) {
              teamMemberIds = session.teamMemberIds;
            } else if (session?.teamMemberId) {
              teamMemberIds = [session.teamMemberId];
            }
          }
          if (teamMemberIds.length > 0) {
            soundManager.playSessionEventSound(message.event as any, teamMemberIds).catch(() => {});
          } else {
            playEventSound(message.event as any);
          }
          break;
        }
        case 'session:modal': {
          const modalData = message.data as AgentModal;
          get().showAgentModal(modalData);
          break;
        }
        case 'team_member:created':
        case 'team_member:updated':
        case 'team_member:archived': {
          const teamMember = message.data;
          set((prev) => ({ teamMembers: new Map(prev.teamMembers).set(teamMember.id, teamMember) }));
          // Sync instrument with sound manager
          if (teamMember.soundInstrument) {
            soundManager.registerTeamMember(teamMember.id, teamMember.soundInstrument);
          }
          // Play sound for event
          playEventSound(message.event as any);
          break;
        }
        case 'team_member:deleted': {
          set((prev) => {
            const teamMembers = new Map(prev.teamMembers);
            teamMembers.delete(message.data.id);
            return { teamMembers };
          });
          // Unregister from sound manager
          soundManager.unregisterTeamMember(message.data.id);
          // Play sound for event
          playEventSound(message.event as any);
          break;
        }
        case 'team:created':
        case 'team:updated':
        case 'team:archived': {
          const team = message.data;
          set((prev) => ({ teams: new Map(prev.teams).set(team.id, team) }));
          playEventSound(message.event as any);
          break;
        }
        case 'team:deleted': {
          set((prev) => {
            const teams = new Map(prev.teams);
            teams.delete(message.data.id);
            return { teams };
          });
          playEventSound(message.event as any);
          break;
        }
      }
    } catch {
    }
  };

  const connectGlobal = () => {
    if (globalConnecting || (globalWs && globalWs.readyState === WebSocket.OPEN)) {
      return;
    }
    globalConnecting = true;
    if (globalWs) { globalWs.close(); globalWs = null; }

    try {
      const ws = new WebSocket(WS_URL);
      globalWs = ws;

      ws.onopen = () => {
        set({ wsConnected: true });
        globalConnecting = false;
        globalReconnectAttempts = 0;
        const { activeProjectIdRef } = get();
        if (activeProjectIdRef) {
          get().fetchTasks(activeProjectIdRef);
          get().fetchSessions();
          get().fetchTeamMembers(activeProjectIdRef);
          get().fetchTeams(activeProjectIdRef);
        }
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
      };

      ws.onclose = () => {
        // Guard: if this WebSocket is no longer the active one (replaced by a newer
        // connection or intentionally destroyed), ignore this close event entirely.
        // Without this guard, React StrictMode's double-invoke of effects creates
        // a stale ws1 whose onclose fires after ws2 is established, nulling globalWs
        // and scheduling a spurious reconnect (ws3). This causes the server to
        // broadcast session:prompt_send to ws1+ws2+ws3, tripling PTY injection.
        if (globalWs !== ws) return;

        const delay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 30000);
        set({ wsConnected: false });
        globalConnecting = false;
        globalWs = null;
        if (globalReconnectTimeout) clearTimeout(globalReconnectTimeout);
        globalReconnectTimeout = window.setTimeout(() => {
          globalReconnectAttempts++;
          connectGlobal();
        }, delay);
      };
    } catch {
      globalConnecting = false;
    }
  };

  // Load lastUsedTeamMember from localStorage
  const loadLastUsedTeamMember = (): Record<string, string> => {
    try {
      const stored = localStorage.getItem('maestro:lastUsedTeamMember');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  return {
    tasks: new Map(),
    sessions: new Map(),
    teamMembers: new Map(),
    teams: new Map(),
    activeModals: [],
    loading: new Set(),
    errors: new Map(),
    wsConnected: false,
    activeProjectIdRef: null,
    taskOrdering: new Map(),
    sessionOrdering: new Map(),
    workflowTemplates: [],
    lastUsedTeamMember: loadLastUsedTeamMember(),

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

    createTask: async (data) => {
      const task = await maestroClient.createTask(data);
      // Optimistic update — add task to store immediately instead of waiting for WebSocket event
      if (!task.taskSessionStatuses || typeof task.taskSessionStatuses !== 'object') {
        task.taskSessionStatuses = {};
      }
      set((prev) => ({ tasks: new Map(prev.tasks).set(task.id, task) }));
      return task;
    },
    updateTask: async (taskId, updates) => {
      const task = await maestroClient.updateTask(taskId, updates);
      // Optimistic update — apply changes immediately instead of waiting for WebSocket event
      if (!task.taskSessionStatuses || typeof task.taskSessionStatuses !== 'object') {
        task.taskSessionStatuses = {};
      }
      set((prev) => ({ tasks: new Map(prev.tasks).set(task.id, task) }));
      return task;
    },
    deleteTask: async (taskId) => {
      await maestroClient.deleteTask(taskId);
      // Optimistic update — remove from store immediately instead of waiting for WebSocket event
      set((prev) => { const tasks = new Map(prev.tasks); tasks.delete(taskId); return { tasks }; });
    },
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
      maestroClient.updateSession(maestroSessionId, { needsInput: { active: false } }).catch(() => {});
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

    clearCache: () => set({ tasks: new Map(), sessions: new Map(), teamMembers: new Map(), teams: new Map(), activeModals: [], loading: new Set(), errors: new Map(), taskOrdering: new Map(), sessionOrdering: new Map(), workflowTemplates: [] }),

    hardRefresh: async (projectId) => {
      get().clearCache();
      if (projectId) {
        await Promise.all([
          get().fetchTasks(projectId),
          get().fetchSessions(),
          get().fetchTeamMembers(projectId),
          get().fetchTeams(projectId),
        ]);
      }
    },

    fetchTaskOrdering: async (projectId) => {
      try {
        const ordering = await maestroClient.getOrdering(projectId, 'task');
        set((prev) => {
          const taskOrdering = new Map(prev.taskOrdering);
          taskOrdering.set(projectId, ordering.orderedIds);
          return { taskOrdering };
        });
      } catch {
      }
    },

    fetchSessionOrdering: async (projectId) => {
      try {
        const ordering = await maestroClient.getOrdering(projectId, 'session');
        set((prev) => {
          const sessionOrdering = new Map(prev.sessionOrdering);
          sessionOrdering.set(projectId, ordering.orderedIds);
          return { sessionOrdering };
        });
      } catch {
      }
    },

    saveTaskOrdering: async (projectId, orderedIds) => {
      // Optimistic update
      set((prev) => {
        const taskOrdering = new Map(prev.taskOrdering);
        taskOrdering.set(projectId, orderedIds);
        return { taskOrdering };
      });
      try {
        await maestroClient.saveOrdering(projectId, 'task', orderedIds);
      } catch {
      }
    },

    saveSessionOrdering: async (projectId, orderedIds) => {
      // Optimistic update
      set((prev) => {
        const sessionOrdering = new Map(prev.sessionOrdering);
        sessionOrdering.set(projectId, orderedIds);
        return { sessionOrdering };
      });
      try {
        await maestroClient.saveOrdering(projectId, 'session', orderedIds);
      } catch {
      }
    },

    fetchTeamMembers: async (projectId) => {
      const key = `teamMembers:${projectId}`;
      // Ensure activeProjectIdRef is set so WebSocket onopen can use it
      if (!get().activeProjectIdRef) {
        set({ activeProjectIdRef: projectId });
      }
      setLoading(key, true);
      setError(key, null);
      try {
        const teamMembers = await maestroClient.getTeamMembers(projectId);
        set((prev) => {
          // Remove old entries for this project, then add fresh data
          const teamMemberMap = new Map(prev.teamMembers);
          for (const [id, tm] of teamMemberMap) {
            if (tm.projectId === projectId) {
              teamMemberMap.delete(id);
            }
          }
          teamMembers.forEach((tm) => teamMemberMap.set(tm.id, tm));
          return { teamMembers: teamMemberMap };
        });
      } catch (err) {
        setError(key, err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(key, false);
      }
    },

    createTeamMember: async (data) => {
      const teamMember = await maestroClient.createTeamMember(data);
      set((prev) => ({ teamMembers: new Map(prev.teamMembers).set(teamMember.id, teamMember) }));
      return teamMember;
    },

    updateTeamMember: async (id, projectId, updates) => {
      const teamMember = await maestroClient.updateTeamMember(id, projectId, updates);
      set((prev) => ({ teamMembers: new Map(prev.teamMembers).set(teamMember.id, teamMember) }));
      return teamMember;
    },

    deleteTeamMember: async (id, projectId) => {
      await maestroClient.deleteTeamMember(id, projectId);
      set((prev) => {
        const teamMembers = new Map(prev.teamMembers);
        teamMembers.delete(id);
        return { teamMembers };
      });
    },

    archiveTeamMember: async (id, projectId) => {
      await maestroClient.archiveTeamMember(id, projectId);
      // The server will emit team_member:archived which will update the store
    },

    unarchiveTeamMember: async (id, projectId) => {
      await maestroClient.unarchiveTeamMember(id, projectId);
      // The server will emit team_member:updated which will update the store
    },

    resetDefaultTeamMember: async (id, projectId) => {
      await maestroClient.resetDefaultTeamMember(id, projectId);
      // The server will emit team_member:updated which will update the store
    },

    setLastUsedTeamMember: (taskId, teamMemberId) => {
      set((prev) => {
        const lastUsedTeamMember = { ...prev.lastUsedTeamMember, [taskId]: teamMemberId };
        // Persist to localStorage
        try {
          localStorage.setItem('maestro:lastUsedTeamMember', JSON.stringify(lastUsedTeamMember));
        } catch {
        }
        return { lastUsedTeamMember };
      });
    },

    // ==================== TEAMS ====================

    fetchTeams: async (projectId) => {
      const key = `teams:${projectId}`;
      setLoading(key, true);
      setError(key, null);
      try {
        const teams = await maestroClient.getTeams(projectId);
        set((prev) => {
          const teamMap = new Map(prev.teams);
          // Remove old entries for this project, then add fresh data
          for (const [id, t] of teamMap) {
            if (t.projectId === projectId) {
              teamMap.delete(id);
            }
          }
          teams.forEach((t) => teamMap.set(t.id, t));
          return { teams: teamMap };
        });
      } catch (err) {
        setError(key, err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(key, false);
      }
    },

    createTeam: async (data) => {
      const team = await maestroClient.createTeam(data);
      set((prev) => ({ teams: new Map(prev.teams).set(team.id, team) }));
      return team;
    },

    updateTeam: async (id, projectId, updates) => {
      const team = await maestroClient.updateTeam(id, projectId, updates);
      set((prev) => ({ teams: new Map(prev.teams).set(team.id, team) }));
      return team;
    },

    deleteTeam: async (id, projectId) => {
      await maestroClient.deleteTeam(id, projectId);
      set((prev) => {
        const teams = new Map(prev.teams);
        teams.delete(id);
        return { teams };
      });
    },

    archiveTeam: async (id, projectId) => {
      await maestroClient.archiveTeam(id, projectId);
    },

    unarchiveTeam: async (id, projectId) => {
      await maestroClient.unarchiveTeam(id, projectId);
    },

    fetchWorkflowTemplates: async () => {
      try {
        const templates = await maestroClient.getWorkflowTemplates();
        set({ workflowTemplates: templates });
      } catch (err) {
        console.error('[useMaestroStore] Failed to fetch workflow templates:', err);
      }
    },

    initWebSocket: () => {
      console.log('[useMaestroStore.initWebSocket] Called - initiating WebSocket connection');
      connectGlobal();
    },
    destroyWebSocket: () => {
      if (globalReconnectTimeout) { clearTimeout(globalReconnectTimeout); globalReconnectTimeout = null; }
      if (globalWs) {
        // Null out handlers before closing so the stale WebSocket cannot:
        // 1. Process any in-flight messages (onmessage → write_to_session)
        // 2. Schedule a spurious reconnect when its close handshake completes (onclose)
        globalWs.onmessage = null;
        globalWs.onclose = null;
        globalWs.close();
        globalWs = null;
      }
      globalConnecting = false;
    },
  };
});
