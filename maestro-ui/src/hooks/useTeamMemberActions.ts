import { useMemo, useEffect, useCallback } from "react";
import { useMaestroStore } from "../stores/useMaestroStore";
import { MaestroProject, MaestroTask, TeamMember, CreateMaestroSessionInput, CreateTaskPayload } from "../app/types/maestro";

export function useTeamMemberActions(projectId: string, project: MaestroProject, onCreateMaestroSession: (input: CreateMaestroSessionInput) => Promise<void>, createTask: (input: CreateTaskPayload) => Promise<MaestroTask>, onError: (msg: string) => void) {
    const teamMembersMap = useMaestroStore(s => s.teamMembers);
    const fetchTeamMembers = useMaestroStore(s => s.fetchTeamMembers);
    const archiveTeamMember = useMaestroStore(s => s.archiveTeamMember);
    const unarchiveTeamMember = useMaestroStore(s => s.unarchiveTeamMember);
    const deleteTeamMember = useMaestroStore(s => s.deleteTeamMember);
    const wsConnected = useMaestroStore(s => s.wsConnected);
    const teamMembersLoading = useMaestroStore(s => s.loading.has(`teamMembers:${projectId}`));

    useEffect(() => {
        if (projectId) {
            fetchTeamMembers(projectId);
        }
    }, [projectId, fetchTeamMembers, wsConnected]);

    const teamMembers = useMemo(() => {
        return Array.from(teamMembersMap.values()).filter(tm => tm.projectId === projectId);
    }, [teamMembersMap, projectId]);

    const handleArchive = useCallback(async (memberId: string) => {
        try {
            await archiveTeamMember(memberId, projectId);
        } catch {
            onError("Failed to archive team member");
        }
    }, [archiveTeamMember, projectId, onError]);

    const handleUnarchive = useCallback(async (memberId: string) => {
        try {
            await unarchiveTeamMember(memberId, projectId);
        } catch {
            onError("Failed to unarchive team member");
        }
    }, [unarchiveTeamMember, projectId, onError]);

    const handleDelete = useCallback(async (memberId: string) => {
        try {
            await deleteTeamMember(memberId, projectId);
        } catch {
            onError("Failed to delete team member");
        }
    }, [deleteTeamMember, projectId, onError]);

    const handleRun = useCallback(async (member: TeamMember) => {
        try {
            const task = await createTask({
                projectId,
                title: `Session with ${member.name}`,
                description: `Ad-hoc session started from team member: ${member.name}`,
                priority: 'medium',
                teamMemberId: member.id,
            });
            const mode = member.mode || 'worker';
            await onCreateMaestroSession({
                task,
                project,
                mode,
                teamMemberId: member.id,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            onError(`Failed to start session: ${message}`);
        }
    }, [projectId, project, createTask, onCreateMaestroSession, onError]);

    return {
        teamMembers,
        teamMembersMap,
        teamMembersLoading,
        handleArchive,
        handleUnarchive,
        handleDelete,
        handleRun,
    };
}
