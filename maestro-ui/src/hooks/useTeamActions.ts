import { useMemo, useEffect, useCallback } from "react";
import { useMaestroStore } from "../stores/useMaestroStore";
import { MaestroProject, MaestroTask, TeamMember } from "../app/types/maestro";

export function useTeamActions(projectId: string, project: MaestroProject, teamMembersMap: Map<string, TeamMember>, onCreateMaestroSession: (input: any) => Promise<any>, createTask: (input: any) => Promise<MaestroTask>, onError: (msg: string) => void) {
    const teamsMap = useMaestroStore(s => s.teams);
    const fetchTeams = useMaestroStore(s => s.fetchTeams);
    const wsConnected = useMaestroStore(s => s.wsConnected);

    useEffect(() => {
        if (projectId) {
            fetchTeams(projectId);
        }
    }, [projectId, fetchTeams, wsConnected]);

    const teams = useMemo(() => {
        return Array.from(teamsMap.values()).filter(t => t.projectId === projectId);
    }, [teamsMap, projectId]);

    const activeTeams = useMemo(() => {
        return teams.filter(t => t.status === 'active');
    }, [teams]);

    const topLevelTeams = useMemo(() => {
        const teamIdSet = new Set(teams.map(t => t.id));
        return teams.filter(t => !t.parentTeamId || !teamIdSet.has(t.parentTeamId));
    }, [teams]);

    const handleRun = useCallback(async (team: any) => {
        try {
            const leader = teamMembersMap.get(team.leaderId);
            if (!leader) { onError("Team has no valid leader"); return; }

            const task = await createTask({
                projectId,
                title: `Team: ${team.name}`,
                description: `Coordinator session for team: ${team.name}`,
                priority: 'medium',
                teamMemberId: leader.id,
            });

            const delegateIds = team.memberIds.filter((id: string) => id !== team.leaderId);

            await onCreateMaestroSession({
                task,
                project,
                mode: 'coordinator',
                teamMemberId: leader.id,
                delegateTeamMemberIds: delegateIds.length > 0 ? delegateIds : undefined,
            });
        } catch (err: any) {
            onError(`Failed to start team session: ${err.message}`);
        }
    }, [projectId, project, teamMembersMap, createTask, onCreateMaestroSession, onError]);

    return {
        teams,
        activeTeams,
        topLevelTeams,
        handleRun,
    };
}
