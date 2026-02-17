import type { MaestroManifest } from '../types/manifest.js';
import { PromptBuilder, type PromptMode } from './prompt-builder.js';
import {
  generateCommandBrief,
  generateCompactCommandBrief,
  type CommandPermissions,
} from './command-permissions.js';


/**
 * WhoamiRenderer - Renders full session context for the `maestro whoami` command
 *
 * Uses PromptBuilder to programmatically construct XML (or plain text) from
 * manifest data. No template files needed.
 *
 * Produces:
 * 1. Identity header (mode, session ID, strategy, project ID)
 * 2. Prompt content (via PromptBuilder)
 * 3. Available commands (dynamically generated from permissions)
 */
export class WhoamiRenderer {
  private promptBuilder: PromptBuilder;

  constructor(mode: PromptMode = 'xml') {
    this.promptBuilder = new PromptBuilder(mode);
  }

  /**
   * Render identity header section
   */
  private renderIdentityHeader(
    manifest: MaestroManifest,
    sessionId: string | undefined,
  ): string {
    const lines: string[] = [
      `**Session:** ${sessionId || 'N/A'}`,
      '',
    ];

    // List all assigned tasks
    for (const task of manifest.tasks) {
      lines.push(`**Task:** ${task.id}`);
      lines.push(`**Title:** ${task.title}`);
      if (task.description) {
        lines.push(`**Description:** ${task.description}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Render available commands section
   */
  private renderCommandsSection(permissions: CommandPermissions): string {
    return '\n---\n\n' + generateCommandBrief(permissions) + '\n';
  }

  /**
   * Escape XML special characters
   */
  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Render reference task IDs as XML.
   * Only includes IDs — agents should run `maestro task get <id>` to fetch details.
   */
  private renderReferenceTaskIds(referenceTaskIds: string[]): string {
    if (!referenceTaskIds || referenceTaskIds.length === 0) return '';
    const lines: string[] = [];
    lines.push('  <reference_tasks>');
    lines.push('    <instruction>IMPORTANT: Before starting your assigned tasks, you MUST read each reference task and its docs. Reference tasks provide critical context, examples, or prior work that directly informs your current work. For each reference task ID below, run BOTH commands:</instruction>');
    lines.push('    <steps>');
    lines.push('      <step>maestro task get &lt;id&gt; — Read the task details (title, description, acceptance criteria)</step>');
    lines.push('      <step>maestro task docs list &lt;id&gt; — List all attached docs, then read each doc thoroughly</step>');
    lines.push('    </steps>');
    lines.push('    <task_ids>');
    for (const id of referenceTaskIds) {
      lines.push(`      <task_id>${this.esc(id)}</task_id>`);
    }
    lines.push('    </task_ids>');
    lines.push('  </reference_tasks>');
    return lines.join('\n');
  }

  /**
   * Render the static system prompt (role instructions + compact command reference).
   * Suitable for --append-system-prompt or equivalent system-level injection.
   *
   * Uses compact command brief (one-liner-per-group) instead of full XML commands
   * to minimize token count. Agents can run `maestro commands` for full syntax.
   */
  renderSystemPrompt(
    manifest: MaestroManifest,
    permissions: CommandPermissions,
  ): string {
    const parts: string[] = [];

    // XML system content: identity + capabilities + workflow (no commands XML)
    const systemXml = this.promptBuilder.buildSystemXml(manifest);

    // Inject compact command brief inside the system prompt XML
    const compactCommands = generateCompactCommandBrief(permissions);
    const commandsBlock = `  <commands_reference>\n${compactCommands.split('\n').map(l => `    ${l}`).join('\n')}\n  </commands_reference>`;
    parts.push(systemXml.replace('</maestro_system_prompt>', `${commandsBlock}\n</maestro_system_prompt>`));

    return parts.join('\n');
  }

  /**
   * Render the dynamic task context (session ID + reference task IDs).
   * Suitable for passing as the user message / prompt argument.
   */
  async renderTaskContext(
    manifest: MaestroManifest,
    sessionId: string | undefined,
  ): Promise<string> {
    const taskXml = this.promptBuilder.buildTaskXml(manifest);
    const taskParts: string[] = [
      '  <session_context>',
      `    <session_id>${this.esc(sessionId || 'N/A')}</session_id>`,
      `    <project_id>${this.esc(manifest.tasks[0]?.projectId || 'N/A')}</project_id>`,
      `    <mode>${this.esc(manifest.mode)}</mode>`,
    ];
    if (manifest.agentTool) {
      taskParts.push(`    <agent_tool>${this.esc(manifest.agentTool)}</agent_tool>`);
    }
    if (manifest.session?.model) {
      taskParts.push(`    <model>${this.esc(manifest.session.model)}</model>`);
    }
    taskParts.push('  </session_context>');

    // Reference task IDs only — agents fetch details lazily
    if (manifest.referenceTaskIds && manifest.referenceTaskIds.length > 0) {
      taskParts.push(this.renderReferenceTaskIds(manifest.referenceTaskIds));
    }

    return taskXml.replace(
      '</maestro_task_prompt>',
      `${taskParts.join('\n')}\n</maestro_task_prompt>`
    );
  }

  /**
   * Render full whoami output (markdown)
   *
   * @param manifest - The session manifest
   * @param permissions - Command permissions for this session
   * @param sessionId - Current session ID
   * @returns Full markdown output for whoami
   */
  async render(
    manifest: MaestroManifest,
    permissions: CommandPermissions,
    sessionId: string | undefined,
  ): Promise<string> {
    const parts: string[] = [];

    // 1. Identity header
    parts.push(this.renderIdentityHeader(manifest, sessionId));

    // 2. Prompt content (role+strategy specific)
    parts.push(this.promptBuilder.build(manifest));

    // 3. Reference task IDs (if any)
    if (manifest.referenceTaskIds && manifest.referenceTaskIds.length > 0) {
      parts.push(`**Reference Tasks:** ${manifest.referenceTaskIds.join(', ')}\n> Before starting work, run \`maestro task get <id>\` AND \`maestro task docs list <id>\` for each reference task to get full context and docs.`);
    }

    // 4. Available commands
    parts.push(this.renderCommandsSection(permissions));

    return parts.join('\n');
  }

  /**
   * Render JSON output for --json flag
   */
  renderJSON(
    manifest: MaestroManifest,
    permissions: CommandPermissions,
    sessionId: string | undefined,
  ): object {
    const primaryTask = manifest.tasks[0];

    const result: any = {
      mode: manifest.mode,
      sessionId: sessionId || null,
      projectId: primaryTask.projectId,
      tasks: manifest.tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority || 'medium',
        acceptanceCriteria: t.acceptanceCriteria,
        status: t.status,
      })),
      permissions: {
        allowedCommands: permissions.allowedCommands,
        hiddenCommands: permissions.hiddenCommands,
      },
      capabilities: permissions.capabilities,
      context: manifest.context || null,
    };

    if (manifest.agentTool) {
      result.agentTool = manifest.agentTool;
    }

    return result;
  }
}
