import { describe, expect, it } from 'vitest';
import { resolveSpawnModeFromSkillAndTeamMemberMode } from '../../src/commands/session-spawn-mode.js';

describe('resolveSpawnModeFromSkillAndTeamMemberMode', () => {
  it('keeps worker mode when no team member mode is provided', () => {
    const result = resolveSpawnModeFromSkillAndTeamMemberMode('maestro-worker');
    expect(result).toEqual({
      mode: 'worker',
      adjustedSkill: 'maestro-worker',
      source: 'skill',
    });
  });

  it('keeps coordinator mode when skill is orchestrator and no team member mode is provided', () => {
    const result = resolveSpawnModeFromSkillAndTeamMemberMode('maestro-orchestrator');
    expect(result).toEqual({
      mode: 'coordinator',
      adjustedSkill: 'maestro-orchestrator',
      source: 'skill',
    });
  });

  it('prefers coordinator mode from team member and aligns default skill', () => {
    const result = resolveSpawnModeFromSkillAndTeamMemberMode('maestro-worker', 'coordinator');
    expect(result).toEqual({
      mode: 'coordinator',
      adjustedSkill: 'maestro-orchestrator',
      source: 'team-member',
    });
  });

  it('accepts legacy team member mode aliases for coordinator', () => {
    const result = resolveSpawnModeFromSkillAndTeamMemberMode('maestro-worker', 'coordinate');
    expect(result.mode).toBe('coordinator');
    expect(result.adjustedSkill).toBe('maestro-orchestrator');
  });

  it('prefers worker mode from team member and aligns default skill', () => {
    const result = resolveSpawnModeFromSkillAndTeamMemberMode('maestro-orchestrator', 'execute');
    expect(result).toEqual({
      mode: 'worker',
      adjustedSkill: 'maestro-worker',
      source: 'team-member',
    });
  });

  it('does not override custom skill values', () => {
    const result = resolveSpawnModeFromSkillAndTeamMemberMode('custom-skill', 'coordinator');
    expect(result).toEqual({
      mode: 'coordinator',
      adjustedSkill: 'custom-skill',
      source: 'team-member',
    });
  });
});
