/**
 * Session Brief Prompts
 *
 * Display strings used in the session brief shown before an agent spawns.
 * These are user-facing (CLI output), not sent to the AI.
 */

// ── Mode titles ─────────────────────────────────────────────

export const MODE_TITLE_EXECUTE = 'EXECUTE';
export const MODE_TITLE_COORDINATE = 'COORDINATE';

// ── Brief section headers ───────────────────────────────────

export const BRIEF_TITLE_TEMPLATE = (modeTitle: string) => `MAESTRO ${modeTitle} SESSION BRIEF`;

export const BRIEF_PRIMARY_TASK_HEADER = (total: number) => `# Primary Task (1 of ${total})\n\n`;
export const BRIEF_SINGLE_TASK_HEADER = '# Your Task\n\n';

export const BRIEF_ACCEPTANCE_CRITERIA_HEADER = '## Acceptance Criteria\n\n';
export const BRIEF_ACCEPTANCE_CRITERIA_INTRO = 'When this task is complete, the following must be true:\n\n';

export const BRIEF_ADDITIONAL_TASKS_HEADER = '## Additional Tasks\n\n';

export const BRIEF_DEPENDENCIES_HEADER = '## Dependencies\n\n';
export const BRIEF_DEPENDENCIES_INTRO = 'This task depends on:\n';

export const BRIEF_SKILLS_HEADER = '## Skills Loaded\n\n';

export const BRIEF_SESSION_CONFIG_HEADER = '## Session Configuration\n\n';

// ── Default acceptance criteria placeholder ─────────────────

export const DEFAULT_ACCEPTANCE_CRITERIA = 'Task completion as described';

// ── Acceptance criteria placeholder patterns to filter out ──

export const ACCEPTANCE_CRITERIA_PLACEHOLDER_PATTERNS = [
  'task completion as described',
  'complete the task',
  'as described',
  'n/a',
  'none',
  'tbd',
];
