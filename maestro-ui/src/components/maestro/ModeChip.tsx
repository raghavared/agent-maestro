import React from 'react';
import type { AgentMode } from '../../app/types/maestro';
import { isCoordinatorRole } from '../../utils/coordinatorRole';

interface ModeChipProps {
  mode: AgentMode | undefined;
}

function getModeLabel(mode: AgentMode | undefined): string {
  switch (mode) {
    case 'coordinator': return 'Coordinator';
    case 'coordinated-coordinator': return 'Coordinated · Coordinator';
    case 'coordinated-worker': return 'Coordinated · Worker';
    case 'worker':
    default: return 'Worker';
  }
}

export const ModeChip = React.memo(function ModeChip({ mode }: ModeChipProps) {
  const isCoordinator = isCoordinatorRole(mode);
  return (
    <span
      className={`modeChip ${isCoordinator ? 'modeChip--coordinator' : 'modeChip--worker'}`}
      title={`Session role: ${getModeLabel(mode)}`}
    >
      {getModeLabel(mode)}
    </span>
  );
});
