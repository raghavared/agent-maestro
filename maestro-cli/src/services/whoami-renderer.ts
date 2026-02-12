import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { MaestroManifest } from '../types/manifest.js';
import { PromptGenerator } from './prompt-generator.js';
import { AgentSpawner } from './agent-spawner.js';
import {
  generateCommandBrief,
  type CommandPermissions,
} from './command-permissions.js';
import { api } from '../api.js';

/**
 * WhoamiRenderer - Renders full session context for the `maestro whoami` command
 *
 * Reads manifest + loads the appropriate template file based on role + strategy,
 * substitutes variables, and produces the full markdown output including:
 * 1. Identity header (role, session ID, strategy, project ID)
 * 2. Template content (loaded and substituted from template file)
 * 3. Available commands (dynamically generated from permissions)
 */
export class WhoamiRenderer {
  private promptGenerator: PromptGenerator;
  private templatesDir: string;

  constructor(templatesDir?: string) {
    if (templatesDir) {
      this.templatesDir = templatesDir;
    } else {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      this.templatesDir = join(__dirname, '../../templates');
    }
    this.promptGenerator = new PromptGenerator(this.templatesDir);
  }

  /**
   * Select the appropriate template name based on role and strategy
   */
  private getTemplateName(manifest: MaestroManifest): string {
    if (manifest.role === 'orchestrator') {
      return `orchestrator-${manifest.orchestratorStrategy || 'default'}`;
    }

    // Worker: select based on strategy
    const strategy = manifest.strategy || 'simple';
    return `worker-${strategy}`;
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
   * Load and substitute template content
   */
  private renderTemplateContent(manifest: MaestroManifest): string {
    const templateName = this.getTemplateName(manifest);
    const templatePath = join(this.templatesDir, `${templateName}-prompt.md`);

    if (!existsSync(templatePath)) {
      // Fall back to role-only template name for backwards compatibility
      const fallbackName = manifest.role;
      try {
        return this.promptGenerator.generatePrompt({
          ...manifest,
          // generatePrompt uses role to select template
        });
      } catch {
        return `_Template not found: ${templatePath}_\n`;
      }
    }

    // Read and substitute template
    let template = readFileSync(templatePath, 'utf-8');

    const primaryTask = manifest.tasks[0];
    const replacements: Record<string, string> = {
      TASK_ID: primaryTask.id,
      TASK_TITLE: primaryTask.title,
      TASK_DESCRIPTION: primaryTask.description,
      TASK_PRIORITY: primaryTask.priority || 'medium',
      ACCEPTANCE_CRITERIA: this.promptGenerator.formatAcceptanceCriteria(primaryTask.acceptanceCriteria),
      CODEBASE_CONTEXT: this.promptGenerator.formatCodebaseContext(manifest.context?.codebaseContext),
      RELATED_TASKS: this.promptGenerator.formatRelatedTasks(manifest.context?.relatedTasks),
      PROJECT_STANDARDS: this.promptGenerator.formatProjectStandards(manifest.context?.projectStandards),
      ALL_TASKS: this.formatAllTasks(manifest.tasks),
      TASK_COUNT: manifest.tasks.length.toString(),
      STRATEGY: manifest.strategy || 'simple',
      STRATEGY_INSTRUCTIONS: '',
      ORCHESTRATOR_STRATEGY: manifest.orchestratorStrategy || 'default',
      ORCHESTRATOR_STRATEGY_INSTRUCTIONS: '',
    };

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      template = template.replace(regex, value);
    }

    // Post-process: remove empty sections (heading followed by only whitespace before next heading or EOF)
    template = template.replace(/^#{1,3} .+\n(?:\s*\n)*(?=^#{1,3} |\s*$)/gm, '');

    // Collapse runs of 3+ blank lines down to 2
    template = template.replace(/\n{3,}/g, '\n\n');

    return template;
  }

  /**
   * Format all tasks for multi-task sessions (reused from PromptGenerator logic)
   */
  private formatAllTasks(tasks: any[]): string {
    if (tasks.length <= 1) {
      return '';
    }

    // Check if tasks have parentId relationships (tree structure)
    const hasTree = tasks.some(t => t.parentId);

    if (hasTree) {
      return this.formatTaskTree(tasks);
    }

    const tasksList = tasks
      .map((task, index) => {
        const num = index + 1;
        const priority = task.priority ? ` [${task.priority}]` : '';
        return `${num}. **${task.id}** - ${task.title}${priority}\n   ${task.description}`;
      })
      .join('\n\n');

    return tasksList;
  }

  /**
   * Format tasks as a hierarchical tree using parentId relationships
   */
  private formatTaskTree(tasks: any[]): string {
    const taskMap = new Map<string, any>();
    tasks.forEach(t => taskMap.set(t.id, t));

    const roots = tasks.filter(t => !t.parentId || !taskMap.has(t.parentId));
    const childrenOf = (parentId: string) => tasks.filter(t => t.parentId === parentId);

    const lines: string[] = [];

    const renderNode = (task: any, prefix: string, isLast: boolean, isRoot: boolean) => {
      const connector = isRoot ? '' : (isLast ? '└─ ' : '├─ ');
      const status = task.status ? `[${task.status}]` : '[todo]';
      const priority = task.priority ? ` (${task.priority})` : '';
      const deps = task.dependencies && task.dependencies.length > 0
        ? ` deps: ${task.dependencies.join(', ')}`
        : '';

      lines.push(`${prefix}${connector}${status} **${task.id}** - ${task.title}${priority}${deps}`);

      if (task.description) {
        const descPrefix = isRoot ? '  ' : (prefix + (isLast ? '   ' : '│  '));
        lines.push(`${descPrefix}  ${task.description}`);
      }

      if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
        const acPrefix = isRoot ? '  ' : (prefix + (isLast ? '   ' : '│  '));
        lines.push(`${acPrefix}  Criteria: ${task.acceptanceCriteria.join('; ')}`);
      }

      const children = childrenOf(task.id);
      children.forEach((child: any, i: number) => {
        const childPrefix = isRoot ? '' : (prefix + (isLast ? '   ' : '│  '));
        renderNode(child, childPrefix, i === children.length - 1, false);
      });
    };

    const completed = tasks.filter(t => t.status === 'completed').length;
    lines.push(`### Task Tree (${completed}/${tasks.length} completed)`);
    lines.push('');

    roots.forEach((root, i) => {
      renderNode(root, '', i === roots.length - 1, true);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Render available commands section
   */
  private renderCommandsSection(permissions: CommandPermissions): string {
    return '\n---\n\n' + generateCommandBrief(permissions) + '\n';
  }

  /**
   * Fetch and render reference task context section
   */
  private async renderReferenceTaskContext(referenceTaskIds: string[]): Promise<string> {
    if (!referenceTaskIds || referenceTaskIds.length === 0) return '';

    const lines: string[] = [
      '',
      '---',
      '',
      '## Reference Task Context',
      '',
      'The following tasks and their documentation have been provided as context for this session:',
      '',
    ];

    for (const taskId of referenceTaskIds) {
      try {
        // Fetch task details
        const task = await api.get<any>(`/api/tasks/${taskId}`);
        lines.push(`### ${task.title}`);
        lines.push(`**Task ID:** ${taskId}`);
        if (task.description) {
          lines.push(`**Description:** ${task.description}`);
        }
        lines.push('');

        // Fetch task docs
        try {
          const docs = await api.get<any[]>(`/api/tasks/${taskId}/docs`);
          if (docs && docs.length > 0) {
            lines.push('**Docs:**');
            for (const doc of docs) {
              lines.push(`- **${doc.title}** (${doc.filePath})`);
              if (doc.content) {
                lines.push('```');
                lines.push(doc.content);
                lines.push('```');
              }
            }
            lines.push('');
          }
        } catch {
          // Silently skip if docs can't be fetched
        }
      } catch {
        lines.push(`### Task ${taskId}`);
        lines.push('_Could not fetch task details_');
        lines.push('');
      }
    }

    return lines.join('\n');
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

    // 2. Template content (role+strategy specific)
    parts.push(this.renderTemplateContent(manifest));

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

    const result: any = {
      role: manifest.role,
      strategy: manifest.strategy || 'simple',
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
      context: manifest.context || null,
    };

    if (manifest.role === 'orchestrator') {
      result.orchestratorStrategy = manifest.orchestratorStrategy || 'default';
    }

    if (manifest.agentTool) {
      result.agentTool = manifest.agentTool;
    }

    return result;
  }
}
