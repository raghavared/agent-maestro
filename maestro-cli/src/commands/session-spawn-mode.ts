export type SessionSpawnMode = 'worker' | 'coordinator';

export interface SpawnModeResolution {
  mode: SessionSpawnMode;
  adjustedSkill: string;
  source: 'team-member' | 'skill';
}

function modeFromSkill(skill: string): SessionSpawnMode {
  return skill === 'maestro-orchestrator' ? 'coordinator' : 'worker';
}

function defaultSkillForMode(mode: SessionSpawnMode): string {
  return mode === 'coordinator' ? 'maestro-orchestrator' : 'maestro-worker';
}

function normalizeTeamMemberMode(mode: string | undefined | null): SessionSpawnMode | null {
  if (!mode) return null;

  const normalized = String(mode).trim().toLowerCase();
  if (
    normalized === 'coordinator' ||
    normalized === 'coordinate' ||
    normalized === 'coordinated-coordinator'
  ) {
    return 'coordinator';
  }

  if (
    normalized === 'worker' ||
    normalized === 'execute' ||
    normalized === 'coordinated-worker'
  ) {
    return 'worker';
  }

  return null;
}

export function resolveSpawnModeFromSkillAndTeamMemberMode(
  skill: string,
  teamMemberMode?: string | null,
): SpawnModeResolution {
  const teamMemberSpawnMode = normalizeTeamMemberMode(teamMemberMode);
  if (teamMemberSpawnMode) {
    const adjustedSkill =
      skill === 'maestro-worker' || skill === 'maestro-orchestrator'
        ? defaultSkillForMode(teamMemberSpawnMode)
        : skill;
    return {
      mode: teamMemberSpawnMode,
      adjustedSkill,
      source: 'team-member',
    };
  }

  return {
    mode: modeFromSkill(skill),
    adjustedSkill: skill,
    source: 'skill',
  };
}
