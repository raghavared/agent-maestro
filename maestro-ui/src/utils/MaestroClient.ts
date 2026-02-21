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
    TaskList,
    CreateTaskListPayload,
    UpdateTaskListPayload,
    TaskListOrdering,
    CreateSessionPayload,
    UpdateSessionPayload,
    SpawnSessionPayload,
    SpawnSessionResponse,
    DocEntry,
    Ordering,
    TeamMember,
    CreateTeamMemberPayload,
    UpdateTeamMemberPayload,
    Team,
    CreateTeamPayload,
    UpdateTeamPayload,
    WorkflowTemplate,
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

    /**
     * Set or unset master status for a project
     */
    async setProjectMaster(projectId: string, isMaster: boolean): Promise<MaestroProject> {
        return this.fetch<MaestroProject>(`/projects/${projectId}/master`, {
            method: 'PUT',
            body: JSON.stringify({ isMaster }),
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

    // ==================== TASK LISTS ====================

    /**
     * Get all task lists for a project
     */
    async getTaskLists(projectId: string): Promise<TaskList[]> {
        return this.fetch<TaskList[]>(`/task-lists?projectId=${encodeURIComponent(projectId)}`);
    }

    /**
     * Get a single task list by ID
     */
    async getTaskList(id: string): Promise<TaskList> {
        return this.fetch<TaskList>(`/task-lists/${id}`);
    }

    /**
     * Create a new task list
     */
    async createTaskList(data: CreateTaskListPayload): Promise<TaskList> {
        return this.fetch<TaskList>('/task-lists', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Update an existing task list
     */
    async updateTaskList(id: string, updates: UpdateTaskListPayload): Promise<TaskList> {
        return this.fetch<TaskList>(`/task-lists/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    /**
     * Delete a task list
     */
    async deleteTaskList(id: string): Promise<{ success: boolean }> {
        return this.fetch<{ success: boolean }>(`/task-lists/${id}`, {
            method: 'DELETE',
        });
    }

    /**
     * Add a task to a list
     */
    async addTaskToList(listId: string, taskId: string): Promise<TaskList> {
        return this.fetch<TaskList>(`/task-lists/${listId}/tasks/${taskId}`, {
            method: 'POST',
        });
    }

    /**
     * Remove a task from a list
     */
    async removeTaskFromList(listId: string, taskId: string): Promise<TaskList> {
        return this.fetch<TaskList>(`/task-lists/${listId}/tasks/${taskId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Reorder tasks within a list
     */
    async reorderTaskListTasks(listId: string, orderedTaskIds: string[]): Promise<TaskList> {
        return this.fetch<TaskList>(`/task-lists/${listId}/reorder`, {
            method: 'PUT',
            body: JSON.stringify({ orderedTaskIds }),
        });
    }

    /**
     * Get task list ordering for a project
     */
    async getTaskListOrdering(projectId: string): Promise<TaskListOrdering> {
        return this.fetch<TaskListOrdering>(`/ordering/task-list/${encodeURIComponent(projectId)}`);
    }

    /**
     * Save task list ordering for a project
     */
    async saveTaskListOrdering(projectId: string, orderedIds: string[]): Promise<TaskListOrdering> {
        return this.fetch<TaskListOrdering>(`/ordering/task-list/${encodeURIComponent(projectId)}`, {
            method: 'PUT',
            body: JSON.stringify({ orderedIds }),
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
     * @param projectPath Optional project path to also discover project-level skills
     */
    async getSkills(projectPath?: string): Promise<ClaudeCodeSkill[]> {
        const params = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : '';
        return this.fetch<ClaudeCodeSkill[]>(`/skills${params}`);
    }

    // ==================== ORDERING ====================

    /**
     * Get ordering for a project and entity type
     */
    async getOrdering(projectId: string, entityType: 'task' | 'session'): Promise<Ordering> {
        return this.fetch<Ordering>(`/ordering/${entityType}/${encodeURIComponent(projectId)}`);
    }

    /**
     * Save ordering for a project and entity type
     */
    async saveOrdering(projectId: string, entityType: 'task' | 'session', orderedIds: string[]): Promise<Ordering> {
        return this.fetch<Ordering>(`/ordering/${entityType}/${encodeURIComponent(projectId)}`, {
            method: 'PUT',
            body: JSON.stringify({ orderedIds }),
        });
    }

    // ==================== TEAM MEMBERS ====================

    /**
     * Get all team members for a project
     */
    async getTeamMembers(projectId: string): Promise<TeamMember[]> {
        return this.fetch<TeamMember[]>(`/team-members?projectId=${encodeURIComponent(projectId)}`);
    }

    /**
     * Create a new team member
     */
    async createTeamMember(data: CreateTeamMemberPayload): Promise<TeamMember> {
        return this.fetch<TeamMember>('/team-members', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Update an existing team member
     */
    async updateTeamMember(id: string, projectId: string, updates: UpdateTeamMemberPayload): Promise<TeamMember> {
        return this.fetch<TeamMember>(`/team-members/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...updates, projectId }),
        });
    }

    /**
     * Delete a team member
     */
    async deleteTeamMember(id: string, projectId: string): Promise<void> {
        await this.fetch<{ success: boolean }>(`/team-members/${id}?projectId=${encodeURIComponent(projectId)}`, {
            method: 'DELETE',
        });
    }

    /**
     * Archive a team member
     */
    async archiveTeamMember(id: string, projectId: string): Promise<void> {
        await this.fetch<TeamMember>(`/team-members/${id}/archive`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        });
    }

    /**
     * Unarchive a team member
     */
    async unarchiveTeamMember(id: string, projectId: string): Promise<void> {
        await this.fetch<TeamMember>(`/team-members/${id}/unarchive`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        });
    }

    /**
     * Reset a default team member to its default values
     */
    async resetDefaultTeamMember(id: string, projectId: string): Promise<void> {
        await this.fetch<TeamMember>(`/team-members/${id}/reset`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        });
    }

    // ==================== TEAMS ====================

    async getTeams(projectId: string): Promise<Team[]> {
        return this.fetch<Team[]>(`/teams?projectId=${encodeURIComponent(projectId)}`);
    }

    async createTeam(data: CreateTeamPayload): Promise<Team> {
        return this.fetch<Team>('/teams', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateTeam(id: string, projectId: string, updates: UpdateTeamPayload): Promise<Team> {
        return this.fetch<Team>(`/teams/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...updates, projectId }),
        });
    }

    async deleteTeam(id: string, projectId: string): Promise<void> {
        await this.fetch<{ success: boolean }>(`/teams/${id}?projectId=${encodeURIComponent(projectId)}`, {
            method: 'DELETE',
        });
    }

    async archiveTeam(id: string, projectId: string): Promise<void> {
        await this.fetch<Team>(`/teams/${id}/archive`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        });
    }

    async unarchiveTeam(id: string, projectId: string): Promise<void> {
        await this.fetch<Team>(`/teams/${id}/unarchive`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        });
    }

    // ── Workflow Templates ──────────────────────────────────────

    /**
     * Get all workflow templates, optionally filtered by mode.
     */
    async getWorkflowTemplates(mode?: string): Promise<WorkflowTemplate[]> {
        const query = mode ? `?mode=${encodeURIComponent(mode)}` : '';
        return this.fetch<WorkflowTemplate[]>(`/workflow-templates${query}`);
    }

    /**
     * Get a specific workflow template by ID.
     */
    async getWorkflowTemplate(id: string): Promise<WorkflowTemplate> {
        return this.fetch<WorkflowTemplate>(`/workflow-templates/${encodeURIComponent(id)}`);
    }

}

// Export singleton instance
export const maestroClient = new MaestroClient();


// Export types for convenience
export type { MaestroTask as Task, TaskStatus, TaskPriority, MaestroSubtask as Subtask, MaestroSession as Session, MaestroProject, AgentSkill as Skill };
