import React, { useState, useMemo, useCallback } from 'react';
import type { TeamGroup } from '../../utils/teamGrouping';
import type { MaestroSession, MaestroTask, Team } from '../../app/types/maestro';
import { useUIStore } from '../../stores/useUIStore';

interface TeamSessionGroupProps {
  group: TeamGroup;
  maestroSessions: Map<string, MaestroSession>;
  maestroTasks: Map<string, MaestroTask>;
  teamsMap: Map<string, Team>;
  renderSessionItem: (isWorker?: boolean) => React.ReactNode;
  renderAllSessionItems: () => React.ReactNode;
  renderCoordinatorOnly: () => React.ReactNode;
}

export function TeamSessionGroup({
  group,
  maestroSessions,
  maestroTasks,
  teamsMap,
  renderSessionItem,
  renderAllSessionItems,
  renderCoordinatorOnly,
}: TeamSessionGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Resolve the coordinator maestro session
  const coordMaestroSession = maestroSessions.get(group.coordinatorMaestroSessionId);

  // Build group label
  const groupLabel = useMemo(() => {
    if (group.teamName) {
      return `${group.teamAvatar || '\u{1F46A}'} ${group.teamName}`;
    }
    // Fall back to coordinator session/team member name
    const coordSnap = coordMaestroSession?.teamMemberSnapshots?.[0] || coordMaestroSession?.teamMemberSnapshot;
    if (coordSnap) {
      return `${coordSnap.avatar} ${coordSnap.name}`;
    }
    return coordMaestroSession?.name || 'Team';
  }, [group.teamName, group.teamAvatar, coordMaestroSession]);

  // Collect worker snapshots for member chips
  const workerChips = useMemo(() => {
    return group.workerMaestroSessionIds.map(msId => {
      const ms = maestroSessions.get(msId);
      const snap = ms?.teamMemberSnapshots?.[0] || ms?.teamMemberSnapshot;
      return {
        msId,
        name: snap?.name || ms?.name || 'Worker',
        avatar: snap?.avatar || '\u26A1',
        status: ms?.status || 'idle',
      };
    });
  }, [group.workerMaestroSessionIds, maestroSessions]);

  // Task progress
  const taskProgress = useMemo(() => {
    const allMsIds = [group.coordinatorMaestroSessionId, ...group.workerMaestroSessionIds];
    const taskIds = new Set<string>();
    for (const msId of allMsIds) {
      const ms = maestroSessions.get(msId);
      if (ms?.taskIds) {
        for (const tid of ms.taskIds) taskIds.add(tid);
      }
    }
    if (taskIds.size === 0) return null;

    let done = 0;
    let total = 0;
    for (const tid of taskIds) {
      const task = maestroTasks.get(tid);
      if (task) {
        total++;
        if (task.status === 'completed') done++;
      }
    }
    return total > 0 ? { done, total } : null;
  }, [group, maestroSessions, maestroTasks]);

  // Status badge
  const statusLabel = group.status === 'active' ? 'Active' : group.status === 'done' ? 'Done' : 'Idle';
  const totalMembers = 1 + group.workerMaestroSessionIds.length; // coordinator + workers

  // Team view button handler
  const handleOpenTeamView = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useUIStore.getState().setTeamViewGroupId(group.teamSessionId);
  }, [group.teamSessionId]);

  return (
    <div
      className="tsGroup"
      style={{
        '--team-color': group.color.primary,
        '--team-color-dim': group.color.dim,
      } as React.CSSProperties}
    >
      {/* Header */}
      <div
        className="tsGroupHeader"
        onClick={() => setCollapsed(prev => !prev)}
      >
        <span className="tsGroupHeader__dot" />
        <span className={`tsGroupHeader__arrow ${collapsed ? 'tsGroupHeader__arrow--collapsed' : ''}`}>
          \u25BE
        </span>
        <span className="tsGroupHeader__label">{groupLabel}</span>
        <span className={`tsGroupHeader__statusBadge tsGroupHeader__statusBadge--${group.status}`}>
          {statusLabel}
        </span>
        <span className="tsGroupHeader__workerCount">
          {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
        </span>
        <button
          className="tsGroupHeader__teamViewBtn"
          onClick={handleOpenTeamView}
          title="Open team view"
        >
          \u229E
        </button>
      </div>

      {/* Member chips strip (expanded only) */}
      {!collapsed && workerChips.length > 0 && (
        <div className="tsGroupMemberChips">
          {workerChips.map(chip => (
            <span key={chip.msId} className="tsGroupMemberChips__chip" title={`${chip.name} (${chip.status})`}>
              <span className="tsGroupMemberChips__avatar">{chip.avatar}</span>
              <span className="tsGroupMemberChips__name">{chip.name}</span>
              <span className={`tsGroupMemberChips__statusDot tsGroupMemberChips__statusDot--${chip.status}`} />
            </span>
          ))}
        </div>
      )}

      {/* Progress line (expanded only) */}
      {!collapsed && taskProgress && (
        <div className="tsGroupProgress">
          <div className="tsGroupProgress__bar">
            <div
              className="tsGroupProgress__fill"
              style={{ width: `${(taskProgress.done / taskProgress.total) * 100}%` }}
            />
          </div>
          <span className="tsGroupProgress__text">
            {taskProgress.done} / {taskProgress.total} tasks done
          </span>
        </div>
      )}

      {/* Session items */}
      <div className="tsGroupBody">
        {collapsed ? renderCoordinatorOnly() : renderAllSessionItems()}
      </div>
    </div>
  );
}
