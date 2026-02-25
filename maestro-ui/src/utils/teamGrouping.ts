import { TEAM_COLORS, type TeamColor } from '../app/constants/teamColors';
import type { MaestroSession, Team } from '../app/types/maestro';

export interface TeamGroup {
  coordinatorMaestroSessionId: string;
  coordinatorLocalSessionId: string | null;
  teamSessionId: string;         // Explicit field (coordinator's session ID)
  teamId?: string;               // Matched saved Team ID if found
  teamName?: string;             // From saved Team name
  teamAvatar?: string;           // From saved Team avatar
  workerLocalSessionIds: string[];
  workerMaestroSessionIds: string[];
  color: TeamColor;
  status: 'active' | 'idle' | 'done';
  taskProgress?: { done: number; total: number };
}

export interface SessionTeamInfo {
  teamColor: TeamColor;
  coordinatorSessionId: string;
  isCoordinator: boolean;
}

interface LocalSession {
  id: string;
  maestroSessionId?: string | null;
}

/**
 * Build team groups from sessions and maestro session data.
 * Groups coordinators with their spawned workers and assigns each group a unique color.
 * Prefers explicit teamSessionId when available, falls back to spawnedBy/parentSessionId.
 */
export function buildTeamGroups(
  localSessions: LocalSession[],
  maestroSessions: Map<string, MaestroSession>,
  teamsMap?: Map<string, Team>
): { groups: TeamGroup[]; sessionColorMap: Map<string, SessionTeamInfo> } {
  // Build a lookup: maestroSessionId -> localSessionId
  const maestroToLocal = new Map<string, string>();
  for (const ls of localSessions) {
    if (ls.maestroSessionId) {
      maestroToLocal.set(ls.maestroSessionId, ls.id);
    }
  }

  // Strategy 1: Group by explicit teamSessionId
  const teamSessionGroups = new Map<string, { coordinatorMsId: string; workerMsIds: string[] }>();

  for (const [msId, ms] of maestroSessions) {
    if (ms.teamSessionId) {
      const tsId = ms.teamSessionId;
      if (!teamSessionGroups.has(tsId)) {
        teamSessionGroups.set(tsId, { coordinatorMsId: tsId, workerMsIds: [] });
      }
      const group = teamSessionGroups.get(tsId)!;
      if (msId !== tsId) {
        group.workerMsIds.push(msId);
      }
    }
  }

  // Strategy 2 (fallback): Find coordinators by mode and match via spawnedBy/parentSessionId
  const assignedByTeamSessionId = new Set<string>();
  for (const [, group] of teamSessionGroups) {
    assignedByTeamSessionId.add(group.coordinatorMsId);
    for (const wId of group.workerMsIds) {
      assignedByTeamSessionId.add(wId);
    }
  }

  const fallbackCoordinators: string[] = [];
  for (const [msId, ms] of maestroSessions) {
    if (assignedByTeamSessionId.has(msId)) continue;
    if (ms.mode === 'coordinator' || ms.mode === 'coordinated-coordinator' || (ms.mode as string) === 'coordinate') {
      fallbackCoordinators.push(msId);
    }
  }
  fallbackCoordinators.sort();

  for (const coordMsId of fallbackCoordinators) {
    if (teamSessionGroups.has(coordMsId)) continue;
    const workerMsIds: string[] = [];
    for (const [msId, ms] of maestroSessions) {
      if (assignedByTeamSessionId.has(msId)) continue;
      if (msId === coordMsId) continue;
      const parentId = ms.spawnedBy ?? (ms as any).parentSessionId;
      if (parentId === coordMsId) {
        workerMsIds.push(msId);
        assignedByTeamSessionId.add(msId);
      }
    }
    assignedByTeamSessionId.add(coordMsId);
    teamSessionGroups.set(coordMsId, { coordinatorMsId: coordMsId, workerMsIds });
  }

  // Build final groups with colors and team matching
  const allGroupKeys = Array.from(teamSessionGroups.keys()).sort();
  const groups: TeamGroup[] = [];
  const sessionColorMap = new Map<string, SessionTeamInfo>();

  for (let i = 0; i < allGroupKeys.length; i++) {
    const tsId = allGroupKeys[i];
    const raw = teamSessionGroups.get(tsId)!;
    const color = TEAM_COLORS[i % TEAM_COLORS.length];
    const coordLocalId = maestroToLocal.get(raw.coordinatorMsId) ?? null;
    const coordMaestroSession = maestroSessions.get(raw.coordinatorMsId);

    const workerLocalIds: string[] = [];
    for (const wMsId of raw.workerMsIds) {
      const localId = maestroToLocal.get(wMsId);
      if (localId) workerLocalIds.push(localId);
    }

    // Determine group status
    let status: 'active' | 'idle' | 'done' = 'idle';
    const allMsIds = [raw.coordinatorMsId, ...raw.workerMsIds];
    const hasActive = allMsIds.some(id => {
      const s = maestroSessions.get(id);
      return s && (s.status === 'working' || s.status === 'spawning');
    });
    const allDone = allMsIds.every(id => {
      const s = maestroSessions.get(id);
      return s && (s.status === 'completed' || s.status === 'failed' || s.status === 'stopped');
    });
    if (hasActive) status = 'active';
    else if (allDone) status = 'done';

    // Match against saved Teams via coordinator's teamMemberId -> team.leaderId
    let matchedTeamId: string | undefined;
    let matchedTeamName: string | undefined;
    let matchedTeamAvatar: string | undefined;

    if (teamsMap && coordMaestroSession?.teamMemberId) {
      for (const [, team] of teamsMap) {
        if (team.leaderId === coordMaestroSession.teamMemberId && team.status === 'active') {
          matchedTeamId = team.id;
          matchedTeamName = team.name;
          matchedTeamAvatar = team.avatar;
          break;
        }
      }
    }

    // Also check teamId from session itself
    if (!matchedTeamId && coordMaestroSession?.teamId) {
      matchedTeamId = coordMaestroSession.teamId;
      if (teamsMap) {
        const t = teamsMap.get(matchedTeamId!);
        if (t) {
          matchedTeamName = t.name;
          matchedTeamAvatar = t.avatar;
        }
      }
    }

    groups.push({
      coordinatorMaestroSessionId: raw.coordinatorMsId,
      coordinatorLocalSessionId: coordLocalId,
      teamSessionId: tsId,
      teamId: matchedTeamId,
      teamName: matchedTeamName,
      teamAvatar: matchedTeamAvatar,
      workerLocalSessionIds: workerLocalIds,
      workerMaestroSessionIds: raw.workerMsIds,
      color,
      status,
    });

    // Map coordinator
    if (coordLocalId) {
      sessionColorMap.set(coordLocalId, {
        teamColor: color,
        coordinatorSessionId: raw.coordinatorMsId,
        isCoordinator: true,
      });
    }

    // Map workers
    for (const wLocalId of workerLocalIds) {
      sessionColorMap.set(wLocalId, {
        teamColor: color,
        coordinatorSessionId: raw.coordinatorMsId,
        isCoordinator: false,
      });
    }
  }

  return { groups, sessionColorMap };
}

/**
 * Reorder sessions so that grouped sessions appear together (coordinator first, then workers),
 * and ungrouped sessions appear at the end.
 */
export function getGroupedSessionOrder<T extends { id: string }>(
  sessions: T[],
  groups: TeamGroup[]
): { grouped: { group: TeamGroup; sessions: T[] }[]; ungrouped: T[] } {
  const assignedIds = new Set<string>();
  const grouped: { group: TeamGroup; sessions: T[] }[] = [];

  for (const group of groups) {
    const groupSessions: T[] = [];

    // Coordinator first
    if (group.coordinatorLocalSessionId) {
      const coordSession = sessions.find(s => s.id === group.coordinatorLocalSessionId);
      if (coordSession) {
        groupSessions.push(coordSession);
        assignedIds.add(coordSession.id);
      }
    }

    // Then workers in their original order
    for (const s of sessions) {
      if (group.workerLocalSessionIds.includes(s.id)) {
        groupSessions.push(s);
        assignedIds.add(s.id);
      }
    }

    if (groupSessions.length > 0) {
      grouped.push({ group, sessions: groupSessions });
    }
  }

  const ungrouped = sessions.filter(s => !assignedIds.has(s.id));

  return { grouped, ungrouped };
}
