import { TEAM_COLORS, type TeamColor } from '../app/constants/teamColors';
import type { MaestroSession } from '../app/types/maestro';

export interface TeamGroup {
  coordinatorMaestroSessionId: string;
  coordinatorLocalSessionId: string | null;
  workerLocalSessionIds: string[];
  color: TeamColor;
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
 */
export function buildTeamGroups(
  localSessions: LocalSession[],
  maestroSessions: Map<string, MaestroSession>
): { groups: TeamGroup[]; sessionColorMap: Map<string, SessionTeamInfo> } {
  // Build a lookup: maestroSessionId -> localSessionId
  const maestroToLocal = new Map<string, string>();
  for (const ls of localSessions) {
    if (ls.maestroSessionId) {
      maestroToLocal.set(ls.maestroSessionId, ls.id);
    }
  }

  // Find all coordinator sessions
  const coordinatorMaestroIds: string[] = [];
  for (const [msId, ms] of maestroSessions) {
    if (ms.mode === 'coordinate') {
      coordinatorMaestroIds.push(msId);
    }
  }

  // Sort for deterministic color assignment
  coordinatorMaestroIds.sort();

  // Build groups
  const groups: TeamGroup[] = [];
  const sessionColorMap = new Map<string, SessionTeamInfo>();

  for (let i = 0; i < coordinatorMaestroIds.length; i++) {
    const coordMsId = coordinatorMaestroIds[i];
    const color = TEAM_COLORS[i % TEAM_COLORS.length];
    const coordLocalId = maestroToLocal.get(coordMsId) ?? null;

    // Find workers: sessions whose spawnedBy or parentSessionId matches this coordinator
    const workerLocalIds: string[] = [];
    for (const [msId, ms] of maestroSessions) {
      if (msId === coordMsId) continue;
      const parentId = ms.spawnedBy ?? (ms as any).parentSessionId;
      if (parentId === coordMsId) {
        const localId = maestroToLocal.get(msId);
        if (localId) {
          workerLocalIds.push(localId);
        }
      }
    }

    // Only create a group if there are workers (a lone coordinator without workers doesn't need grouping)
    // Actually, always create the group so the coordinator gets colored even without workers yet
    groups.push({
      coordinatorMaestroSessionId: coordMsId,
      coordinatorLocalSessionId: coordLocalId,
      workerLocalSessionIds: workerLocalIds,
      color,
    });

    // Map coordinator
    if (coordLocalId) {
      sessionColorMap.set(coordLocalId, {
        teamColor: color,
        coordinatorSessionId: coordMsId,
        isCoordinator: true,
      });
    }

    // Map workers
    for (const wLocalId of workerLocalIds) {
      sessionColorMap.set(wLocalId, {
        teamColor: color,
        coordinatorSessionId: coordMsId,
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
