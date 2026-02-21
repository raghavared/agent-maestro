/**
 * Reference Task Prompts
 *
 * Prompt strings related to reference tasks — instructions that tell agents
 * how to fetch and use reference task context before starting their work.
 */

// ── Reference task instruction (XML block in prompt composer) ──

export const REFERENCE_TASKS_INSTRUCTION =
  'IMPORTANT: Before starting your assigned tasks, you MUST read each reference task and its docs. Reference tasks provide critical context, examples, or prior work that directly informs your current work. For each reference task ID below, run BOTH commands:';

export const REFERENCE_TASKS_STEP_GET =
  'maestro task get &lt;id&gt; — Read the task details (title, description, acceptance criteria)';

export const REFERENCE_TASKS_STEP_DOCS =
  'maestro task docs list &lt;id&gt; — List all attached docs, then read each doc thoroughly';

// ── Reference task inline hint (whoami markdown) ────────────

export const REFERENCE_TASKS_INLINE_HINT =
  'Before starting work, run `maestro task get <id>` AND `maestro task docs list <id>` for each reference task to get full context and docs.';
