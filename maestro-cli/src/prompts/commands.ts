/**
 * Command Reference Prompts
 *
 * All command-related prompt strings: descriptions, syntax, group metadata,
 * and the static commands reference block used in prompts.
 */

// ── Command group metadata (for compact command briefs) ─────

export const COMMAND_GROUP_META: Record<string, { prefix: string; description: string }> = {
  report: { prefix: 'maestro report', description: 'Status reporting' },
  task: { prefix: 'maestro task', description: 'Task management' },
  session: { prefix: 'maestro session', description: 'Session management' },
  project: { prefix: 'maestro project', description: 'Project management' },
  mail: { prefix: 'maestro mail', description: 'Mailbox coordination' },
  'team-member': { prefix: 'maestro team-member', description: 'Team member management' },
  worker: { prefix: 'maestro worker', description: 'Worker initialization' },
  orchestrator: { prefix: 'maestro orchestrator', description: 'Orchestrator initialization' },
  show: { prefix: 'maestro show', description: 'UI display' },
  modal: { prefix: 'maestro modal', description: 'Modal interaction' },
};

// ── Static commands reference (used in PromptBuilder.buildCommandsReference) ──

export const COMMANDS_REFERENCE_HEADER = '## Maestro Commands';

export const COMMANDS_REFERENCE_CORE = 'maestro {whoami|status|commands} — Core utilities';

export const COMMANDS_REFERENCE_TASK_MGMT = 'maestro task {list|get|create|edit|delete|children} — Task management';
export const COMMANDS_REFERENCE_TASK_REPORT = 'maestro task report {progress|complete|blocked|error} — Task report';
export const COMMANDS_REFERENCE_TASK_DOCS = 'maestro task docs {add|list} — Task docs';

export const COMMANDS_REFERENCE_SESSION_MGMT = 'maestro session {info|prompt} — Session management';
export const COMMANDS_REFERENCE_SESSION_REPORT = 'maestro session report {progress|complete|blocked|error} — Session report';
export const COMMANDS_REFERENCE_SESSION_DOCS = 'maestro session docs {add|list} — Session docs';

export const COMMANDS_REFERENCE_SHOW = 'maestro show {modal} — UI display';
export const COMMANDS_REFERENCE_MODAL = 'maestro modal {events} — Modal interaction';

// Mail commands
export const COMMANDS_REFERENCE_MAIL_SEND = 'maestro mail send [<sessionId>,...] --type <type> --subject "<subject>" [--message "<msg>"] [--to-team-member <tmId>] — Send mail';
export const COMMANDS_REFERENCE_MAIL_INBOX = 'maestro mail inbox [--type <type>] — Check inbox';
export const COMMANDS_REFERENCE_MAIL_REPLY = 'maestro mail reply <mailId> --message "<msg>" — Reply to mail';
export const COMMANDS_REFERENCE_MAIL_WAIT = 'maestro mail wait [--timeout <ms>] — Wait for new mail';

// Coordinate-only commands
export const COMMANDS_REFERENCE_SESSION_COORD = 'maestro session {list|spawn} — Session coordination';
export const COMMANDS_REFERENCE_SESSION_SPAWN = 'maestro session spawn --task <id> [--subject "<directive>"] [--message "<instructions>"] [--team-member-id <tmId>] — Spawn with initial directive';
export const COMMANDS_REFERENCE_MAIL_BROADCAST = 'maestro mail broadcast --type <type> --subject "<subject>" [--message "<msg>"] — Broadcast to all';

export const COMMANDS_REFERENCE_FOOTER = 'Run `maestro commands` for full syntax reference.';

// ── Compact command brief labels ────────────────────────────

export const COMPACT_BRIEF_CORE_LABEL = 'Core utilities';

// ── Command descriptions (used in COMMAND_REGISTRY) ─────────

export const CMD_DESC = {
  // Core
  whoami: 'Print current context',
  status: 'Show project status',
  commands: 'Show available commands',

  // Task
  'task:list': 'List tasks',
  'task:get': 'Get task details',
  'task:create': 'Create new task',
  'task:edit': 'Edit task fields',
  'task:delete': 'Delete a task',
  'task:update': 'Update task status/priority',
  'task:complete': 'Mark task completed',
  'task:block': 'Mark task blocked',
  'task:children': 'List child tasks',
  'task:tree': 'Show task tree',
  'task:report:progress': 'Report task progress',
  'task:report:complete': 'Report task completion',
  'task:report:blocked': 'Report task blocked',
  'task:report:error': 'Report task error',
  'task:docs:add': 'Add doc to task',
  'task:docs:list': 'List task docs',

  // Session
  'session:list': 'List sessions',
  'session:info': 'Get session info',
  'session:watch': 'Watch sessions in real-time',
  'session:spawn': 'Spawn new session',
  'session:prompt': 'Send an input prompt to another active session',
  'session:register': 'Register session',
  'session:complete': 'Complete session',
  'session:report:progress': 'Report work progress',
  'session:report:complete': 'Report completion',
  'session:report:blocked': 'Report blocker',
  'session:report:error': 'Report error',
  'session:docs:add': 'Add doc to session',
  'session:docs:list': 'List session docs',

  // Legacy report
  'report:progress': 'Report work progress',
  'report:complete': 'Report completion',
  'report:blocked': 'Report blocker',
  'report:error': 'Report error',

  // Project
  'project:list': 'List projects',
  'project:get': 'Get project details',
  'project:create': 'Create project',
  'project:delete': 'Delete project',

  // Mail
  'mail:send': 'Send mail to session(s) or team member',
  'mail:inbox': 'List inbox for current session',
  'mail:reply': 'Reply to a mail',
  'mail:broadcast': 'Send to all sessions',
  'mail:wait': 'Long-poll, block until mail arrives',

  // Init
  'worker:init': 'Initialize execute-mode session',
  'orchestrator:init': 'Initialize coordinate-mode session',

  // Team member
  'team-member:create': 'Create a new team member',
  'team-member:list': 'List team members',
  'team-member:get': 'Get team member details',
  'team-member:edit': 'Edit a team member',

  // Show/Modal
  'show:modal': 'Show HTML modal in UI',
  'modal:events': 'Listen for modal user actions',

  // Utility
  'track-file': 'Track file modification',
  'debug-prompt': 'Show system and initial prompts sent to agent',
} as const;

// ── Command syntax (used for help and prompt generation) ────

export const CMD_SYNTAX: Record<string, string> = {
  'whoami': 'maestro whoami',
  'status': 'maestro status',
  'commands': 'maestro commands',
  'track-file': 'maestro track-file <filePath>',
  // Legacy report aliases
  'report:progress': 'maestro report progress "<message>"',
  'report:complete': 'maestro report complete "<summary>"',
  'report:blocked': 'maestro report blocked "<reason>"',
  'report:error': 'maestro report error "<description>"',
  // Task commands
  'task:list': 'maestro task list [taskId] [--status <status>] [--priority <priority>]',
  'task:get': 'maestro task get <taskId>',
  'task:create': 'maestro task create "<title>" [-d "<description>"] [--priority <high|medium|low>] [--parent <parentId>]',
  'task:edit': 'maestro task edit <taskId> [--title "<title>"] [--desc "<description>"] [--priority <priority>]',
  'task:delete': 'maestro task delete <taskId> [--cascade]',
  'task:update': 'maestro task update <taskId> [--status <status>] [--priority <priority>] [--title "<title>"]',
  'task:complete': 'maestro task complete <taskId>',
  'task:block': 'maestro task block <taskId> --reason "<reason>"',
  'task:children': 'maestro task children <taskId> [--recursive]',
  'task:tree': 'maestro task tree [--root <taskId>] [--depth <n>] [--status <status>]',
  'task:report:progress': 'maestro task report progress <taskId> "<message>"',
  'task:report:complete': 'maestro task report complete <taskId> "<summary>"',
  'task:report:blocked': 'maestro task report blocked <taskId> "<reason>"',
  'task:report:error': 'maestro task report error <taskId> "<description>"',
  'task:docs:add': 'maestro task docs add <taskId> "<title>" --file <filePath>',
  'task:docs:list': 'maestro task docs list <taskId>',
  // Session commands
  'session:list': 'maestro session list [--team-member-id <tmId>] [--active]',
  'session:info': 'maestro session info',
  'session:watch': 'maestro session watch <sessionId1>,<sessionId2>,...',
  'session:spawn': 'maestro session spawn --task <id> [--team-member-id <tmId>] [--model <model>] [--agent-tool <tool>]',
  'session:prompt': 'maestro session prompt <targetSessionId> --message "<text>" [--mode send|paste]',
  'session:register': 'maestro session register',
  'session:complete': 'maestro session complete',
  'session:report:progress': 'maestro session report progress "<message>"',
  'session:report:complete': 'maestro session report complete "<summary>"',
  'session:report:blocked': 'maestro session report blocked "<reason>"',
  'session:report:error': 'maestro session report error "<description>"',
  'session:docs:add': 'maestro session docs add "<title>" --file <filePath>',
  'session:docs:list': 'maestro session docs list',
  // Project commands
  'project:list': 'maestro project list',
  'project:get': 'maestro project get <projectId>',
  'project:create': 'maestro project create "<name>"',
  'project:delete': 'maestro project delete <projectId>',
  // Mail commands
  'mail:send': 'maestro mail send [<sessionId1>,<sessionId2>,...] --type <type> --subject "<subject>" [--message "<message>"] [--to-team-member <tmId>]',
  'mail:inbox': 'maestro mail inbox [--type <type>]',
  'mail:reply': 'maestro mail reply <mailId> --message "<message>"',
  'mail:broadcast': 'maestro mail broadcast --type <type> --subject "<subject>" [--message "<message>"]',
  'mail:wait': 'maestro mail wait [--timeout <ms>] [--since <timestamp>]',
  // Team member commands
  'team-member:create': 'maestro team-member create "<name>" --role "<role>" --avatar "<emoji>" --mode <execute|coordinate> [--model <model>] [--agent-tool <tool>] [--identity "<instructions>"]',
  'team-member:list': 'maestro team-member list',
  'team-member:get': 'maestro team-member get <teamMemberId>',
  'team-member:edit': 'maestro team-member edit <teamMemberId> [--name "<name>"] [--role "<role>"] [--avatar "<emoji>"] [--mode <execute|coordinate>] [--model <model>] [--agent-tool <tool>] [--identity "<instructions>"] [--workflow-template <templateId>] [--custom-workflow "<workflow>"]',
  'worker:init': 'maestro worker init',
  'orchestrator:init': 'maestro orchestrator init',
};

// ── Guard error messages ────────────────────────────────────

export const COMMAND_NOT_ALLOWED_PREFIX = "Command '";
export const COMMAND_NOT_ALLOWED_SUFFIX = "' is not allowed for ";
export const COMMAND_NOT_ALLOWED_HINT = 'Run "maestro commands" to see available commands.';

export function formatCommandNotAllowed(commandName: string, mode: string): string {
  return `${COMMAND_NOT_ALLOWED_PREFIX}${commandName}${COMMAND_NOT_ALLOWED_SUFFIX}${mode} mode.\n${COMMAND_NOT_ALLOWED_HINT}`;
}

// ── CLI output labels ───────────────────────────────────────

export const AVAILABLE_COMMANDS_HEADER = '\nAvailable Commands:';
export const AVAILABLE_COMMANDS_SEPARATOR = '-------------------';
export const HIDDEN_COMMANDS_LABEL = (count: number) => `(${count} commands hidden based on mode)`;
