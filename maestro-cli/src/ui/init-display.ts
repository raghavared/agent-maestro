/**
 * Init Display — Beautiful terminal UI for maestro worker/orchestrator initialization
 *
 * Shows a rich, interactive-looking summary before spawning the agent:
 *   - Session banner
 *   - Team member identity
 *   - Tasks overview with priorities
 *   - Configuration (model, permissions, agent tool)
 *   - Team roster (orchestrator mode)
 */

import chalk from 'chalk';
import type { MaestroManifest, TaskData, TeamMemberData } from '../types/manifest.js';
import { isCoordinatorMode } from '../types/manifest.js';
import { AGENT_TOOL_DISPLAY_NAMES } from '../prompts/spawner.js';

// ── Theme ────────────────────────────────────────────────────

const DIM = chalk.dim;
const BOLD = chalk.bold;
const CYAN = chalk.cyan;
const GREEN = chalk.green;
const YELLOW = chalk.yellow;
const MAGENTA = chalk.magenta;
const WHITE = chalk.white;
const GRAY = chalk.gray;
const RED = chalk.red;
const BLUE = chalk.blue;

// Box-drawing characters
const BOX = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
};

// ── Helpers ──────────────────────────────────────────────────

/** Strip ANSI escape codes */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Calculate visual width of a string in the terminal.
 * Emojis and certain Unicode chars occupy 2 columns.
 */
function visualWidth(str: string): number {
  const plain = stripAnsi(str);
  let w = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0)!;
    // Common wide character ranges: CJK, emojis, fullwidth forms
    if (
      (cp >= 0x1F000 && cp <= 0x1FFFF) || // Emoticons, symbols, etc
      (cp >= 0x2600 && cp <= 0x27BF) ||    // Misc symbols, Dingbats
      (cp >= 0x2B50 && cp <= 0x2B55) ||    // Stars, circles
      (cp >= 0xFE00 && cp <= 0xFE0F) ||    // Variation selectors (skip width)
      (cp >= 0x200D && cp <= 0x200D) ||     // ZWJ (skip width)
      (cp >= 0x2300 && cp <= 0x23FF) ||     // Misc technical
      (cp >= 0x2700 && cp <= 0x27BF) ||     // Dingbats
      (cp >= 0xFE10 && cp <= 0xFE1F) ||     // Vertical forms
      (cp >= 0xFF01 && cp <= 0xFF60) ||     // Fullwidth
      (cp >= 0x1F300 && cp <= 0x1F9FF) ||   // Emojis
      (cp >= 0x231A && cp <= 0x231B) ||     // Watch, hourglass
      cp === 0x26A1 ||                       // ⚡
      cp === 0x2615                          // ☕
    ) {
      // Variation selectors and ZWJ don't take width
      if ((cp >= 0xFE00 && cp <= 0xFE0F) || cp === 0x200D) {
        w += 0;
      } else {
        w += 2;
      }
    } else {
      w += 1;
    }
  }
  return w;
}

function hLine(width: number, char = BOX.horizontal): string {
  return char.repeat(width);
}

function boxTop(width: number): string {
  return DIM(`${BOX.topLeft}${hLine(width)}${BOX.topRight}`);
}

function boxBottom(width: number): string {
  return DIM(`${BOX.bottomLeft}${hLine(width)}${BOX.bottomRight}`);
}

function boxDivider(width: number): string {
  return DIM(`${BOX.teeRight}${hLine(width)}${BOX.teeLeft}`);
}

function boxRow(content: string, width: number): string {
  const vw = visualWidth(content);
  const pad = Math.max(0, width - vw);
  return `${DIM(BOX.vertical)} ${content}${' '.repeat(pad)}${DIM(BOX.vertical)}`;
}

function padRight(text: string, len: number): string {
  const vw = visualWidth(text);
  const pad = Math.max(0, len - vw);
  return text + ' '.repeat(pad);
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

// ── Priority / Status Formatting ────────────────────────────

function priorityBadge(priority?: string): string {
  switch (priority) {
    case 'critical': return RED.bold(' CRIT ');
    case 'high':     return RED(' HIGH ');
    case 'medium':   return YELLOW(' MED  ');
    case 'low':      return GREEN(' LOW  ');
    default:         return GRAY('  —   ');
  }
}

function statusIcon(status?: string): string {
  switch (status) {
    case 'completed':   return GREEN('✓');
    case 'in_progress': return CYAN('◉');
    case 'in-progress': return CYAN('◉');
    case 'blocked':     return RED('✕');
    case 'in_review':   return MAGENTA('◎');
    case 'cancelled':   return GRAY('⊘');
    case 'todo':        return WHITE('○');
    default:            return WHITE('○');
  }
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'worker':                  return CYAN('Worker');
    case 'coordinator':             return MAGENTA('Coordinator');
    case 'coordinated-worker':      return CYAN('Coordinated Worker');
    case 'coordinated-coordinator': return MAGENTA('Coordinated Coordinator');
    default:                        return WHITE(mode);
  }
}

function permissionLabel(perm: string): string {
  switch (perm) {
    case 'bypassPermissions': return RED.bold('bypass');
    case 'acceptEdits':       return GREEN('accept-edits');
    case 'interactive':       return YELLOW('interactive');
    case 'readOnly':          return BLUE('read-only');
    default:                  return GRAY(perm);
  }
}

function modelLabel(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes('opus'))   return MAGENTA.bold(model);
  if (lower.includes('sonnet')) return CYAN(model);
  if (lower.includes('haiku'))  return GREEN(model);
  if (lower.includes('gpt'))    return YELLOW(model);
  if (lower.includes('gemini')) return BLUE(model);
  return WHITE(model);
}

// ── Sections ─────────────────────────────────────────────────

const INNER_WIDTH = 62;
const BOX_WIDTH = INNER_WIDTH + 1; // +1 for left padding inside boxRow

function renderBanner(manifest: MaestroManifest, sessionId: string): string[] {
  const lines: string[] = [];
  const agentTool = AGENT_TOOL_DISPLAY_NAMES[manifest.agentTool || 'claude-code'] || 'Claude Code';

  lines.push('');
  lines.push(boxTop(BOX_WIDTH));

  // Title line
  const title = `  ⚡ MAESTRO  ${DIM('—')}  ${modeLabel(manifest.mode)} Session`;
  lines.push(boxRow(title, BOX_WIDTH));

  lines.push(boxDivider(BOX_WIDTH));

  // Identity row
  if (manifest.teamMemberName || manifest.teamMemberAvatar) {
    const avatar = manifest.teamMemberAvatar || '🤖';
    const name = manifest.teamMemberName || 'Agent';
    const role = manifest.teamMemberRole ? DIM(` · ${manifest.teamMemberRole}`) : '';
    lines.push(boxRow(`  ${avatar}  ${BOLD(name)}${role}`, BOX_WIDTH));
  }

  // Session / Project
  lines.push(boxRow(`  ${DIM('Session')}  ${GRAY(truncate(sessionId, 44))}`, BOX_WIDTH));

  // Config row
  const configParts = [
    `${DIM('Model')} ${modelLabel(manifest.session.model)}`,
    `${DIM('Perms')} ${permissionLabel(manifest.session.permissionMode)}`,
    `${DIM('Tool')} ${WHITE(agentTool)}`,
  ];
  lines.push(boxRow(`  ${configParts.join(DIM('  │  '))}`, BOX_WIDTH));

  // Thinking / Max turns if set
  const extras: string[] = [];
  if (manifest.session.thinkingMode && manifest.session.thinkingMode !== 'auto') {
    extras.push(`${DIM('Thinking')} ${WHITE(manifest.session.thinkingMode)}`);
  }
  if (manifest.session.maxTurns) {
    extras.push(`${DIM('Max turns')} ${WHITE(String(manifest.session.maxTurns))}`);
  }
  if (extras.length > 0) {
    lines.push(boxRow(`  ${extras.join(DIM('  │  '))}`, BOX_WIDTH));
  }

  lines.push(boxBottom(BOX_WIDTH));

  return lines;
}

function renderTasks(tasks: TaskData[]): string[] {
  if (tasks.length === 0) return [];

  const lines: string[] = [];
  const heading = tasks.length === 1 ? ' Task' : ` Tasks (${tasks.length})`;

  lines.push('');
  lines.push(boxTop(BOX_WIDTH));
  lines.push(boxRow(`  📋${BOLD(heading)}`, BOX_WIDTH));
  lines.push(boxDivider(BOX_WIDTH));

  // Column header
  const hdrPri = padRight(DIM('  PRI'), 10);
  const hdrStatus = DIM('ST');
  const hdrTitle = DIM('Title');
  lines.push(boxRow(`  ${hdrPri} ${hdrStatus}  ${hdrTitle}`, BOX_WIDTH));
  lines.push(boxRow(`  ${DIM(hLine(INNER_WIDTH - 3))}`, BOX_WIDTH));

  for (const task of tasks.slice(0, 8)) {
    const pri = padRight(priorityBadge(task.priority), 10);
    const st = statusIcon(task.status);
    const title = truncate(task.title, 40);
    lines.push(boxRow(`  ${pri} ${st}  ${WHITE(title)}`, BOX_WIDTH));

    // Acceptance criteria preview (first 2)
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      for (const ac of task.acceptanceCriteria.slice(0, 2)) {
        lines.push(boxRow(`            ${DIM('▸')} ${GRAY(truncate(ac, 44))}`, BOX_WIDTH));
      }
      if (task.acceptanceCriteria.length > 2) {
        lines.push(boxRow(`            ${DIM(`  +${task.acceptanceCriteria.length - 2} more`)}`, BOX_WIDTH));
      }
    }
  }

  if (tasks.length > 8) {
    lines.push(boxRow(`  ${DIM(`  … and ${tasks.length - 8} more tasks`)}`, BOX_WIDTH));
  }

  lines.push(boxBottom(BOX_WIDTH));
  return lines;
}

function renderTeamRoster(members: TeamMemberData[]): string[] {
  if (!members || members.length === 0) return [];

  const lines: string[] = [];

  lines.push('');
  lines.push(boxTop(BOX_WIDTH));
  lines.push(boxRow(`  👥${BOLD(` Team Roster (${members.length})`)}`, BOX_WIDTH));
  lines.push(boxDivider(BOX_WIDTH));

  for (const m of members.slice(0, 10)) {
    const avatar = m.avatar || '🤖';
    const name = padRight(BOLD(m.name), 18);
    const role = m.role ? DIM(truncate(m.role, 28)) : '';
    const tool = m.agentTool ? GRAY(` [${m.agentTool}]`) : '';
    lines.push(boxRow(`  ${avatar}  ${name} ${role}${tool}`, BOX_WIDTH));
  }

  if (members.length > 10) {
    lines.push(boxRow(`  ${DIM(`  … and ${members.length - 10} more members`)}`, BOX_WIDTH));
  }

  lines.push(boxBottom(BOX_WIDTH));
  return lines;
}

function renderSkills(skills: string[]): string[] {
  if (!skills || skills.length === 0) return [];

  const lines: string[] = [];

  lines.push('');
  lines.push(boxTop(BOX_WIDTH));
  lines.push(boxRow(`  🧩${BOLD(` Skills (${skills.length})`)}`, BOX_WIDTH));
  lines.push(boxDivider(BOX_WIDTH));

  const perRow = 3;
  for (let i = 0; i < skills.length; i += perRow) {
    const chunk = skills.slice(i, i + perRow);
    const formatted = chunk.map(s => CYAN(padRight(s, 18))).join(' ');
    lines.push(boxRow(`  ${formatted}`, BOX_WIDTH));
  }

  lines.push(boxBottom(BOX_WIDTH));
  return lines;
}

function renderInitDirective(manifest: MaestroManifest): string[] {
  if (!manifest.initialDirective) return [];

  const lines: string[] = [];

  lines.push('');
  lines.push(boxTop(BOX_WIDTH));
  lines.push(boxRow(`  📨${BOLD(' Initial Directive')}`, BOX_WIDTH));
  lines.push(boxDivider(BOX_WIDTH));
  lines.push(boxRow(`  ${BOLD(truncate(manifest.initialDirective.subject, INNER_WIDTH - 4))}`, BOX_WIDTH));

  // Wrap message into lines
  const words = manifest.initialDirective.message.split(' ');
  let line = '  ';
  for (const word of words) {
    if (line.length + word.length + 1 > INNER_WIDTH - 2) {
      lines.push(boxRow(DIM(line), BOX_WIDTH));
      line = '  ' + word;
    } else {
      line += (line.length > 2 ? ' ' : '') + word;
    }
  }
  if (line.length > 2) {
    lines.push(boxRow(DIM(line), BOX_WIDTH));
  }

  lines.push(boxBottom(BOX_WIDTH));
  return lines;
}

function renderSpawningFooter(agentTool: string): string[] {
  const toolName = AGENT_TOOL_DISPLAY_NAMES[agentTool] || agentTool;
  return [
    '',
    `  ${DIM('▶')}  ${DIM('Spawning')} ${BOLD(toolName)}${DIM('…')}`,
    '',
  ];
}

// ── Main Export ──────────────────────────────────────────────

/**
 * Display the init summary UI in the terminal.
 *
 * Called after manifest is validated and before spawning the agent.
 */
export function displayInitUI(manifest: MaestroManifest, sessionId: string): void {
  const output: string[] = [];

  // 1. Banner (identity + config)
  output.push(...renderBanner(manifest, sessionId));

  // 2. Tasks
  output.push(...renderTasks(manifest.tasks));

  // 3. Team roster (orchestrator mode)
  if (isCoordinatorMode(manifest.mode) && manifest.availableTeamMembers) {
    output.push(...renderTeamRoster(manifest.availableTeamMembers));
  }

  // 4. Skills
  if (manifest.skills && manifest.skills.length > 0) {
    output.push(...renderSkills(manifest.skills));
  }

  // 5. Initial directive (coordinated mode)
  output.push(...renderInitDirective(manifest));

  // 6. Spawning footer
  output.push(...renderSpawningFooter(manifest.agentTool || 'claude-code'));

  // Print all at once for clean rendering
  console.log(output.join('\n'));
}
