import type { MaestroManifest } from '../types/manifest.js';
import { getEffectiveStrategy } from '../types/manifest.js';
import { PromptBuilder, type PromptMode } from './prompt-builder.js';
import {
  generateCommandBrief,
  getAvailableCommandsGrouped,
  getCommandSyntax,
  type CommandPermissions,
} from './command-permissions.js';
import { api } from '../api.js';

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
   * Render available commands as XML for system instructions.
   */
  private renderCommandsXml(permissions: CommandPermissions): string {
    const grouped = getAvailableCommandsGrouped(permissions, true);
    const lines: string[] = ['  <commands>'];

    for (const [group, commands] of Object.entries(grouped)) {
      lines.push(`    <group name="${this.esc(group)}">`);
      for (const cmd of commands) {
        const syntax = getCommandSyntax(cmd.name);
        lines.push(
          `      <command name="${this.esc(cmd.name)}" id="${this.esc(cmd.name)}" syntax="${this.esc(syntax)}" description="${this.esc(cmd.description)}" />`
        );
      }
      lines.push('    </group>');
    }

    lines.push('  </commands>');
    return lines.join('\n');
  }

  /**
   * Fetch and render reference task context as XML
   */
  private async renderReferenceTaskContext(referenceTaskIds: string[]): Promise<string> {
    if (!referenceTaskIds || referenceTaskIds.length === 0) return '';

    const lines: string[] = [
      '<reference_task_context>',
    ];

    for (const taskId of referenceTaskIds) {
      try {
        // Fetch task details
        const task = await api.get<any>(`/api/tasks/${taskId}`);
        lines.push(`  <reference_task id="${this.esc(taskId)}">`);
        lines.push(`    <title>${this.esc(task.title || taskId)}</title>`);
        if (task.description) {
          lines.push(`    <description>${this.esc(task.description)}</description>`);
        }

        // Fetch task docs
        try {
          const docs = await api.get<any[]>(`/api/tasks/${taskId}/docs`);
          if (docs && docs.length > 0) {
            lines.push('    <docs>');
            for (const doc of docs) {
              lines.push(`      <doc title="${this.esc(doc.title || '')}" path="${this.esc(doc.filePath || '')}" />`);
            }
            lines.push('    </docs>');
          }
        } catch {
          // Silently skip if docs can't be fetched
        }
        lines.push('  </reference_task>');
      } catch {
        lines.push(`  <reference_task id="${this.esc(taskId)}">`);
        lines.push('    <fetch_error>Could not fetch task details</fetch_error>');
        lines.push('  </reference_task>');
      }
    }

    lines.push('</reference_task_context>');
    return lines.join('\n');
  }

  /**
   * Render the static system prompt (role instructions + compact command reference).
   * Suitable for --append-system-prompt or equivalent system-level injection.
   */
  renderSystemPrompt(
    manifest: MaestroManifest,
    permissions: CommandPermissions,
  ): string {
    const parts: string[] = [];

    // XML-only system content: identity + workflow
    const systemXml = this.promptBuilder.buildSystemXml(manifest);
    const commandsXml = this.renderCommandsXml(permissions);
    parts.push(systemXml.replace('</maestro_system_prompt>', `${commandsXml}\n</maestro_system_prompt>`));

    return parts.join('\n');
  }

  /**
   * Render the dynamic task context (identity header + reference task context).
   * Suitable for passing as the user message / prompt argument.
   */
  async renderTaskContext(
    manifest: MaestroManifest,
    sessionId: string | undefined,
  ): Promise<string> {
    // XML-only task context payload
    const taskXml = this.promptBuilder.buildTaskXml(manifest);
    const taskParts: string[] = [
      '  <session_context>',
      `    <session_id>${this.esc(sessionId || 'N/A')}</session_id>`,
      '  </session_context>',
    ];

    // Reference task context (if any)
    if (manifest.referenceTaskIds && manifest.referenceTaskIds.length > 0) {
      const refContext = await this.renderReferenceTaskContext(manifest.referenceTaskIds);
      if (refContext) {
        const indentedRef = refContext
          .split('\n')
          .map(line => `  ${line}`)
          .join('\n');
        taskParts.push(indentedRef);
      }
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

    // 3. Reference task context (if any)
    if (manifest.referenceTaskIds && manifest.referenceTaskIds.length > 0) {
      const refContext = await this.renderReferenceTaskContext(manifest.referenceTaskIds);
      if (refContext) {
        parts.push(refContext);
      }
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

    const strategy = getEffectiveStrategy(manifest);

    const result: any = {
      mode: manifest.mode,
      strategy,
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

    if (manifest.mode === 'coordinate') {
      result.coordinateStrategy = strategy;
    }

    if (manifest.agentTool) {
      result.agentTool = manifest.agentTool;
    }

    return result;
  }
}
