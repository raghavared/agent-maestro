/**
 * Identity Prompts
 *
 * All identity-related prompt strings sent to AI agents.
 * These define how the agent understands its role in the Maestro system.
 */

// ── Profile names ───────────────────────────────────────────

export const WORKER_PROFILE = 'maestro-worker';
export const COORDINATOR_PROFILE = 'maestro-coordinator';

// ── Core identity instructions ──────────────────────────────

export const WORKER_IDENTITY_INSTRUCTION =
  'You are a worker agent in a coordinated multi-agent team. You execute assigned tasks directly and autonomously. Report progress at meaningful milestones and escalate blockers promptly. Follow the workflow phases in order.';

export const COORDINATOR_IDENTITY_INSTRUCTION =
  'You are a coordinator agent leading a multi-agent team. You NEVER do tasks directly. Your job is to decompose tasks into subtasks, spawn worker sessions, send them clear directives, monitor their progress by reading their session logs (maestro session logs), unblock workers when needed via directives (maestro session prompt), and report results. Follow the workflow phases in order.';

// ── Multi-identity (combined expertise) ─────────────────────

/**
 * Template for combined expertise instruction when an agent has multiple team member identities.
 * Use: `MULTI_IDENTITY_INSTRUCTION_PREFIX + roleList + MULTI_IDENTITY_INSTRUCTION_SUFFIX`
 */
export const MULTI_IDENTITY_INSTRUCTION_PREFIX =
  'You have the combined expertise of: ';

export const MULTI_IDENTITY_INSTRUCTION_SUFFIX =
  '. Apply all domain knowledge when executing your tasks.';

/**
 * Build the combined expertise instruction for multi-identity agents.
 */
export function buildMultiIdentityInstruction(roleList: string): string {
  return `${MULTI_IDENTITY_INSTRUCTION_PREFIX}${roleList}${MULTI_IDENTITY_INSTRUCTION_SUFFIX}`;
}
