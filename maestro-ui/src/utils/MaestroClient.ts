import type {
    MaestroTask,
    TaskStatus,
    TaskPriority,
    MaestroSubtask,
    MaestroProject,
    MaestroSession,
    AgentSkill,
    ClaudeCodeSkill,
    CreateTaskPayload,
    UpdateTaskPayload,
    CreateSessionPayload,
    UpdateSessionPayload,
    SpawnSessionPayload,
    SpawnSessionResponse,
    DocEntry,
} from '../app/types/maestro';

import { API_BASE_URL } from './serverConfig';

/**
 * Maestro API Client
 * 
 * Provides methods to interact with the Maestro server REST API.
 */
class MaestroClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    /**
     * Generic fetch wrapper with error handling
     */
    private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers,
                },
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[MaestroClient] Request failed:', { endpoint, error });
            throw error;
        }
    }

    // ==================== PROJECTS ====================

    /**
     * Get all projects
     */
    async getProjects(): Promise<MaestroProject[]> {
        return this.fetch<MaestroProject[]>('/projects');
    }

    /**
     * Get a single project by ID
     */
    async getProject(id: string): Promise<MaestroProject> {
        return this.fetch<MaestroProject>(`/projects/${id}`);
    }

    /**
     * Create a new project
     */
    async createProject(data: { name: string; workingDir?: string; description?: string; createdAt?: number; updatedAt?: number }): Promise<MaestroProject> {
        return this.fetch<MaestroProject>('/projects', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Update an existing project
     */
    async updateProject(id: string, data: { name?: string; workingDir?: string; description?: string; createdAt?: number; updatedAt?: number }): Promise<MaestroProject> {
        return this.fetch<MaestroProject>(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * Delete a project
     */
    async deleteProject(id: string): Promise<{ success: boolean; id: string }> {
        return this.fetch<{ success: boolean; id: string }>(`/projects/${id}`, {
            method: 'DELETE',
        });
    }

    // ==================== TASKS ====================

    /**
     * Get all tasks for a project
     */
    async getTasks(projectId?: string): Promise<MaestroTask[]> {
        const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
        return this.fetch<MaestroTask[]>(`/tasks${query}`);
    }

    /**
     * Get a single task by ID
     */
    async getTask(id: string): Promise<MaestroTask> {
        return this.fetch<MaestroTask>(`/tasks/${id}`);
    }

    /**
     * Create a new task
     */
    async createTask(data: CreateTaskPayload): Promise<MaestroTask> {
        return this.fetch<MaestroTask>('/tasks', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Update an existing task
     */
    async updateTask(id: string, updates: UpdateTaskPayload): Promise<MaestroTask> {
        return this.fetch<MaestroTask>(`/tasks/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    /**
     * Delete a task
     */
    async deleteTask(id: string): Promise<{ success: boolean }> {
        return this.fetch<{ success: boolean }>(`/tasks/${id}`, {
            method: 'DELETE',
        });
    }

    // ==================== SESSIONS ====================

    /**
     * Get all sessions
     */
    async getSessions(taskId?: string): Promise<MaestroSession[]> {
        const query = taskId ? `?taskId=${encodeURIComponent(taskId)}` : '';
        return this.fetch<MaestroSession[]>(`/sessions${query}`);
    }

    /**
     * Get a single session by ID
     */
    async getSession(id: string): Promise<MaestroSession> {
        return this.fetch<MaestroSession>(`/sessions/${id}`);
    }

    /**
     * Create a new session
     */
    async createSession(data: CreateSessionPayload): Promise<MaestroSession> {
        return this.fetch<MaestroSession>('/sessions', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Update an existing session
     */
    async updateSession(id: string, updates: UpdateSessionPayload): Promise<MaestroSession> {
        return this.fetch<MaestroSession>(`/sessions/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    /**
     * Delete a session
     */
    async deleteSession(id: string): Promise<{ success: boolean }> {
        return this.fetch<{ success: boolean }>(`/sessions/${id}`, {
            method: 'DELETE',
        });
    }

    // PHASE IV-A: New bidirectional relationship methods

    /**
     * Add a task to an existing session
     */
    async addTaskToSession(sessionId: string, taskId: string): Promise<MaestroSession> {
        return this.fetch<MaestroSession>(`/sessions/${sessionId}/tasks/${taskId}`, {
            method: 'POST',
        });
    }

    /**
     * Remove a task from an existing session
     */
    async removeTaskFromSession(sessionId: string, taskId: string): Promise<MaestroSession> {
        return this.fetch<MaestroSession>(`/sessions/${sessionId}/tasks/${taskId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Spawn a session (triggers server to generate manifest and emit spawn request)
     */
    async spawnSession(data: SpawnSessionPayload): Promise<SpawnSessionResponse> {
        return this.fetch<SpawnSessionResponse>('/sessions/spawn', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getTaskChildren(taskId: string): Promise<MaestroTask[]> {
        return this.fetch<MaestroTask[]>(`/tasks/${taskId}/children`);
    }

    // NOTE: Task timeline removed - use addSessionTimelineEvent instead

    /**
     * Add a timeline event to a session
     */
    async addSessionTimelineEvent(sessionId: string, event: { type: string; message?: string; taskId?: string; metadata?: Record<string, any> }): Promise<MaestroSession> {
        return this.fetch<MaestroSession>(`/sessions/${sessionId}/timeline`, {
            method: 'POST',
            body: JSON.stringify(event),
        });
    }

    // ==================== DOCS ====================

    async getSessionDocs(sessionId: string): Promise<DocEntry[]> {
        return this.fetch<DocEntry[]>(`/sessions/${sessionId}/docs`);
    }

    async getTaskDocs(taskId: string): Promise<DocEntry[]> {
        return this.fetch<DocEntry[]>(`/tasks/${taskId}/docs`);
    }

    // ==================== SKILLS ====================

    /**
     * Get all available Claude Code skills
     */
    async getSkills(): Promise<ClaudeCodeSkill[]> {
        return this.fetch<ClaudeCodeSkill[]>('/skills');
    }

}

// Export singleton instance
export const maestroClient = new MaestroClient();


// Export types for convenience
export type { MaestroTask as Task, TaskStatus, TaskPriority, MaestroSubtask as Subtask, MaestroSession as Session, MaestroProject, AgentSkill as Skill };
