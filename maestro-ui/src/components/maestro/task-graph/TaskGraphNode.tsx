import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MaestroTask, TeamMember } from '../../../app/types/maestro';

export interface TaskGraphNodeData {
  task: MaestroTask;
  teamMember?: TeamMember;
  executionStatus?: string;
  [key: string]: unknown;
}

const statusColors: Record<string, { border: string; bg: string }> = {
  completed: { border: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  in_progress: { border: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  working: { border: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  failed: { border: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  blocked: { border: '#eab308', bg: 'rgba(234,179,8,0.1)' },
  todo: { border: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
};

function TaskGraphNodeComponent({ data }: NodeProps) {
  const { task, teamMember, executionStatus } = data as TaskGraphNodeData;
  const status = executionStatus || task?.status || 'todo';
  const colors = statusColors[status] || statusColors.todo;

  return (
    <div
      style={{
        border: `2px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 160,
        maxWidth: 220,
        fontSize: 12,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#6b7280', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#6b7280', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>{teamMember?.avatar || '📋'}</span>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task?.title || 'Untitled'}
          </div>
          <div style={{ opacity: 0.6, fontSize: 11 }}>
            {teamMember?.name || 'Unassigned'}
          </div>
        </div>
      </div>
      {executionStatus && (
        <div style={{ marginTop: 4, fontSize: 10, textTransform: 'uppercase', color: colors.border, fontWeight: 600 }}>
          {executionStatus}
        </div>
      )}
    </div>
  );
}

export const TaskGraphNodeMemo = memo(TaskGraphNodeComponent);
