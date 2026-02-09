import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  MaestroManifest,
  CodebaseContext,
  RelatedTask,
  ProjectStandards,
} from '../types/manifest.js';

/**
 * Template data from server
 */
interface ServerTemplate {
  id: string;
  name: string;
  role: 'worker' | 'orchestrator';
  content: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * PromptGenerator - Generates role-specific prompts from manifests
 *
 * Fetches templates from server API with fallback to bundled templates.
 */
export class PromptGenerator {
  private templatesDir: string;
  private templateCache: Map<string, string> = new Map();
  private serverUrl: string;

  /**
   * Create a new PromptGenerator
   *
   * @param templatesDir - Directory containing prompt templates (defaults to ../templates)
   * @param serverUrl - Maestro server URL (defaults to MAESTRO_SERVER_URL env or http://localhost:3000)
   */
  constructor(templatesDir?: string, serverUrl?: string) {
    if (templatesDir) {
      this.templatesDir = templatesDir;
    } else {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      this.templatesDir = join(__dirname, '../../templates');
    }

    this.serverUrl = serverUrl || process.env.MAESTRO_SERVER_URL || 'http://localhost:3000';
  }

  /**
   * Fetch template from server by ID
   *
   * @param templateId - Template ID
   * @returns Template content or null if not found
   */
  async fetchTemplateById(templateId: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.serverUrl}/api/templates/${templateId}`);
      if (!response.ok) {
        console.error(`Failed to fetch template ${templateId}: ${response.status}`);
        return null;
      }
      const template = await response.json() as ServerTemplate;
      return template.content;
    } catch (error) {
      console.error(`Error fetching template from server: ${error}`);
      return null;
    }
  }

  /**
   * Fetch template from server by role
   *
   * @param role - Template role ('worker' or 'orchestrator')
   * @returns Template content or null if not found
   */
  async fetchTemplateByRole(role: 'worker' | 'orchestrator'): Promise<string | null> {
    try {
      const response = await fetch(`${this.serverUrl}/api/templates/role/${role}`);
      if (!response.ok) {
        console.error(`Failed to fetch template for role ${role}: ${response.status}`);
        return null;
      }
      const template = await response.json() as ServerTemplate;
      return template.content;
    } catch (error) {
      console.error(`Error fetching template from server: ${error}`);
      return null;
    }
  }

  /**
   * Load a template file (fallback for when server is unavailable)
   *
   * @param templateName - Name of template ('worker' or 'orchestrator')
   * @returns Template content
   * @throws Error if template not found
   */
  loadTemplate(templateName: string): string {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = join(this.templatesDir, `${templateName}-prompt.md`);

    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const template = readFileSync(templatePath, 'utf-8');
    this.templateCache.set(templateName, template);

    return template;
  }

  /**
   * Generate a prompt from a manifest (sync version - uses bundled templates only)
   *
   * @param manifest - The manifest to generate prompt from
   * @returns Generated prompt string
   */
  generatePrompt(manifest: MaestroManifest): string {
    // Load appropriate template based on role + strategy
    const role = manifest.role;

    if (role !== 'worker' && role !== 'orchestrator') {
      throw new Error(`Invalid role: ${role}. Must be 'worker' or 'orchestrator'`);
    }

    const templateName = role === 'worker'
      ? `worker-${manifest.strategy || 'simple'}`
      : `orchestrator-${manifest.orchestratorStrategy || 'default'}`;

    let template = this.loadTemplate(templateName);

    // Substitute all variables
    template = this.substituteVariables(template, manifest);

    return template;
  }

  /**
   * Generate a prompt from a manifest (async version - fetches from server)
   *
   * Tries to fetch template in this order:
   * 1. By templateId if specified in manifest
   * 2. By role from server
   * 3. Falls back to bundled template
   *
   * @param manifest - The manifest to generate prompt from
   * @returns Generated prompt string
   */
  async generatePromptAsync(manifest: MaestroManifest): Promise<string> {
    const role = manifest.role;

    if (role !== 'worker' && role !== 'orchestrator') {
      throw new Error(`Invalid role: ${role}. Must be 'worker' or 'orchestrator'`);
    }

    let templateContent: string | null = null;

    // 1. Try to fetch by templateId if specified
    if (manifest.templateId) {
      console.error(`Fetching template by ID: ${manifest.templateId}`);
      templateContent = await this.fetchTemplateById(manifest.templateId);
    }

    // 2. Try to fetch by role from server
    if (!templateContent) {
      console.error(`Fetching template by role: ${role}`);
      templateContent = await this.fetchTemplateByRole(role);
    }

    // 3. Fall back to bundled template
    if (!templateContent) {
      const templateName = role === 'worker'
        ? `worker-${manifest.strategy || 'simple'}`
        : `orchestrator-${manifest.orchestratorStrategy || 'default'}`;
      console.error(`Using bundled ${templateName} template (server unavailable)`);
      templateContent = this.loadTemplate(templateName);
    }

    // Substitute all variables
    const result = this.substituteVariables(templateContent, manifest);

    return result;
  }

  /**
   * Substitute all variables in template with manifest data
   */
  private substituteVariables(template: string, manifest: MaestroManifest): string {
    const { tasks, context } = manifest;
    // Use first task as primary task for template variables
    const primaryTask = tasks[0];

    const replacements: Record<string, string> = {
      TASK_ID: primaryTask.id,
      TASK_TITLE: primaryTask.title,
      TASK_DESCRIPTION: primaryTask.description,
      TASK_PRIORITY: primaryTask.priority || 'medium',
      ACCEPTANCE_CRITERIA: this.formatAcceptanceCriteria(primaryTask.acceptanceCriteria),
      CODEBASE_CONTEXT: this.formatCodebaseContext(context?.codebaseContext),
      RELATED_TASKS: this.formatRelatedTasks(context?.relatedTasks),
      PROJECT_STANDARDS: this.formatProjectStandards(context?.projectStandards),
      // Multi-task support
      ALL_TASKS: this.formatAllTasks(tasks),
      TASK_COUNT: tasks.length.toString(),
      // Strategy support
      STRATEGY: manifest.strategy || 'simple',
      STRATEGY_INSTRUCTIONS: this.formatStrategyInstructions(manifest.strategy),
      ORCHESTRATOR_STRATEGY: manifest.orchestratorStrategy || 'default',
      ORCHESTRATOR_STRATEGY_INSTRUCTIONS: this.formatOrchestratorStrategyInstructions(manifest.orchestratorStrategy),
    };

    let result = template;

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Format strategy-specific instructions for template variable
   */
  private formatStrategyInstructions(strategy?: string): string {
    if (strategy === 'queue') {
      return `
**Queue Strategy Active**: This session uses FIFO task processing.
Do NOT work on tasks directly. Instead, use the queue commands to process tasks one at a time.
`;
    }
    if (strategy === 'tree') {
      return `
**Tree Strategy Active**: This session owns a root task and its full subtask tree.
Work through all subtasks holistically — you decide the order based on dependencies and logical flow.
Report progress per subtask using \`maestro report progress "SUBTASK COMPLETE [task-id]: summary"\`.
`;
    }
    return '';
  }

  /**
   * Format orchestrator-strategy-specific instructions for template variable
   */
  private formatOrchestratorStrategyInstructions(orchestratorStrategy?: string): string {
    if (orchestratorStrategy === 'intelligent-batching') {
      return `
**Intelligent Batching Strategy Active**: Group related tasks into optimal batches for parallel execution.
Analyze task dependencies and group independent tasks together for maximum throughput.
`;
    }
    if (orchestratorStrategy === 'dag') {
      return `
**DAG Strategy Active**: Tasks are organized as a directed acyclic graph.
Respect dependency edges and execute tasks in topological order, parallelizing independent branches.
`;
    }
    return '';
  }

  /**
   * Get queue-specific instructions to append to prompt
   */
  private getQueueInstructions(): string {
    return `

---

## Queue Worker Instructions

**IMPORTANT**: This is a QUEUE WORKER session. You must follow the queue workflow:

### Queue Workflow

1. **Get next task**: Run \`maestro queue top\` to see the next task to process
2. **Start task**: Run \`maestro queue start\` to claim and begin working on it
3. **Work on task**: Complete the task as described
4. **Complete task**: Run \`maestro queue complete\` when done (or \`maestro queue fail\` if it cannot be completed)
5. **Repeat**: Go back to step 1 for the next task

### Queue Commands

| Command | Description |
|---------|-------------|
| \`maestro queue top\` | Show the next task in the queue |
| \`maestro queue start\` | Start processing the next task |
| \`maestro queue complete\` | Mark current task as completed |
| \`maestro queue fail [reason]\` | Mark current task as failed |
| \`maestro queue skip\` | Skip the current task |
| \`maestro queue list\` | List all tasks in the queue |

### Rules

- Always run \`maestro queue start\` BEFORE working on a task
- Always run \`maestro queue complete\` or \`maestro queue fail\` AFTER finishing a task
- Process tasks in order - do not skip ahead
- If a task cannot be completed, use \`maestro queue fail\` with a reason

**Start now by running \`maestro queue top\` to see your first task.**
`;
  }

  /**
   * Format all tasks for multi-task sessions
   */
  private formatAllTasks(tasks: any[]): string {
    if (tasks.length === 1) {
      return ''; // Single task - already shown in main sections
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
        const complexity = task.complexity ? ` (${task.complexity})` : '';
        return `${num}. **${task.id}** - ${task.title}${priority}${complexity}\n   ${task.description}`;
      })
      .join('\n\n');

    return `
### All Tasks in This Session (${tasks.length} tasks)

**Primary Task**: Task 1 (${tasks[0].id})

${tasksList}

**Note**: Focus on completing these tasks in order or as dependencies allow.
`;
  }

  /**
   * Format tasks as a hierarchical tree using parentId relationships
   */
  private formatTaskTree(tasks: any[]): string {
    const taskMap = new Map<string, any>();
    tasks.forEach(t => taskMap.set(t.id, t));

    // Find root tasks (no parentId or parentId not in this set)
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
   * Format acceptance criteria as numbered list
   */
  formatAcceptanceCriteria(criteria: string[]): string {
    if (!criteria || criteria.length === 0) {
      return 'No acceptance criteria specified.';
    }

    return criteria.map((criterion, index) => `${index + 1}. ${criterion}`).join('\n');
  }

  /**
   * Format codebase context section
   */
  formatCodebaseContext(context?: CodebaseContext): string {
    if (!context) {
      return '';
    }

    const sections: string[] = [];

    if (context.recentChanges && context.recentChanges.length > 0) {
      sections.push('**Recent Changes:**');
      sections.push(context.recentChanges.map(change => `- ${change}`).join('\n'));
    }

    if (context.relevantFiles && context.relevantFiles.length > 0) {
      sections.push('\n**Relevant Files:**');
      sections.push(context.relevantFiles.map(file => `- ${file}`).join('\n'));
    }

    if (context.architecture) {
      sections.push(`\n**Architecture:** ${context.architecture}`);
    }

    if (context.techStack && context.techStack.length > 0) {
      sections.push(`\n**Tech Stack:** ${context.techStack.join(', ')}`);
    }

    if (sections.length === 0) {
      return '';
    }

    return `
### Codebase Context

${sections.join('\n')}
`;
  }

  /**
   * Format related tasks section
   */
  formatRelatedTasks(tasks?: RelatedTask[]): string {
    if (!tasks || tasks.length === 0) {
      return '';
    }

    const tasksList = tasks
      .map(task => {
        const statusEmoji = task.status === 'completed' ? '✅' : '⏳';
        return `- ${statusEmoji} **${task.id}** - ${task.title} (${task.relationship}, ${task.status})`;
      })
      .join('\n');

    return `
### Related Tasks

${tasksList}
`;
  }

  /**
   * Format project standards section
   */
  formatProjectStandards(standards?: ProjectStandards): string {
    if (!standards) {
      return '';
    }

    const sections: string[] = [];

    if (standards.codingStyle) {
      sections.push(`**Coding Style:** ${standards.codingStyle}`);
    }

    if (standards.testingApproach) {
      sections.push(`**Testing Approach:** ${standards.testingApproach}`);
    }

    if (standards.documentation) {
      sections.push(`**Documentation:** ${standards.documentation}`);
    }

    if (standards.branchingStrategy) {
      sections.push(`**Branching Strategy:** ${standards.branchingStrategy}`);
    }

    if (standards.cicdPipeline) {
      sections.push(`**CI/CD Pipeline:** ${standards.cicdPipeline}`);
    }

    if (standards.customGuidelines && standards.customGuidelines.length > 0) {
      sections.push('\n**Custom Guidelines:**');
      sections.push(standards.customGuidelines.map(guideline => `- ${guideline}`).join('\n'));
    }

    if (sections.length === 0) {
      return '';
    }

    return `
### Project Standards

${sections.join('\n')}
`;
  }

  /**
   * Clear template cache (useful for testing)
   */
  clearCache(): void {
    this.templateCache.clear();
  }
}

/**
 * Default instance using default templates directory
 */
export const defaultGenerator = new PromptGenerator();
