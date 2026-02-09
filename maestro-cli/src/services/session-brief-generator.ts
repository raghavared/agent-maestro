import type { MaestroManifest } from '../types/manifest.js';

/**
 * SessionBriefGenerator - Generate formatted session brief for display before Claude spawns
 *
 * Shows task context, acceptance criteria, skills, and session configuration
 * to give the user a clear view of what's about to happen.
 */
export class SessionBriefGenerator {
  /**
   * Generate complete session brief
   */
  generate(manifest: MaestroManifest): string {
    const roleTitle = manifest.role === 'worker' ? 'WORKER' : 'ORCHESTRATOR';
    const primaryTask = manifest.tasks[0];
    const isMultiTask = manifest.tasks.length > 1;

    let brief = this.renderHeader(roleTitle);

    // Task information
    brief += this.renderTaskInfo(primaryTask, isMultiTask, manifest.tasks.length);

    // Acceptance criteria
    brief += this.renderAcceptanceCriteria(primaryTask.acceptanceCriteria);

    // Additional tasks (if multi-task session)
    if (isMultiTask) {
      brief += this.renderAdditionalTasks(manifest.tasks.slice(1));
    }

    // Dependencies
    if (primaryTask.dependencies && primaryTask.dependencies.length > 0) {
      brief += this.renderDependencies(primaryTask.dependencies);
    }

    // Skills
    if (manifest.skills && manifest.skills.length > 0) {
      brief += this.renderSkills(manifest.skills);
    }

    // Session configuration
    brief += this.renderSessionConfig(manifest.session);

    // Strategy information
    if (manifest.strategy === 'queue') {
      brief += this.renderQueueStrategy();
    }

    // Orchestrator strategy information
    if (manifest.role === 'orchestrator') {
      brief += this.renderOrchestratorStrategy(manifest.orchestratorStrategy);
    }

    brief += this.renderFooter();

    return brief;
  }

  /**
   * Render queue strategy instructions
   */
  private renderQueueStrategy(): string {
    let section = `## Queue Strategy\n\n`;
    section += `This session uses the **queue** strategy for FIFO task processing.\n\n`;
    section += `Tasks are processed one at a time in order. Use these commands:\n\n`;
    section += `  maestro queue top       - Show the next task to process\n`;
    section += `  maestro queue start     - Start processing the next task\n`;
    section += `  maestro queue complete  - Mark current task as completed\n`;
    section += `  maestro queue fail      - Mark current task as failed\n`;
    section += `  maestro queue skip      - Skip the current task\n`;
    section += `  maestro queue list      - List all tasks in the queue\n`;
    section += `\n`;
    return section;
  }

  /**
   * Render orchestrator strategy information
   */
  private renderOrchestratorStrategy(orchestratorStrategy?: string): string {
    const strategy = orchestratorStrategy || 'default';

    const descriptions: Record<string, string> = {
      'default': 'The default orchestrator coordinates worker sessions, distributes tasks, and monitors progress.',
      'intelligent-batching': 'Groups related tasks into optimal batches for parallel execution to maximize throughput.',
      'dag': 'Organizes tasks as a directed acyclic graph, executing in topological order with parallel branches.',
    };

    const description = descriptions[strategy] || descriptions['default'];

    let section = `## Orchestrator Strategy\n\n`;
    section += `**Strategy**: ${strategy}\n\n`;
    section += `${description}\n\n`;
    return section;
  }

  /**
   * Render header
   */
  private renderHeader(roleTitle: string): string {
    const title = `MAESTRO ${roleTitle} SESSION BRIEF`;
    return `
╔${'═'.repeat(60)}╗
║${this.center(title, 60)}║
╚${'═'.repeat(60)}╝

`;
  }

  /**
   * Render task information
   */
  private renderTaskInfo(task: any, isMultiTask: boolean, totalTasks: number): string {
    let section = isMultiTask
      ? `# Primary Task (1 of ${totalTasks})\n\n`
      : `# Your Task\n\n`;

    section += `**Title**: ${task.title}\n`;
    section += `**ID**: ${task.id}\n`;
    section += `**Priority**: ${task.priority || 'medium'}\n\n`;
    section += `**Description**:\n${task.description}\n\n`;

    return section;
  }

  /**
   * Render acceptance criteria
   */
  private renderAcceptanceCriteria(criteria: string[]): string {
    if (!criteria || criteria.length === 0) {
      return '';
    }

    let section = `## Acceptance Criteria\n\n`;
    section += `When this task is complete, the following must be true:\n\n`;

    for (const criterion of criteria) {
      section += `  ✓ ${criterion}\n`;
    }

    section += '\n';
    return section;
  }

  /**
   * Render additional tasks (for multi-task sessions)
   */
  private renderAdditionalTasks(tasks: any[]): string {
    if (tasks.length === 0) {
      return '';
    }

    let section = `## Additional Tasks\n\n`;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      section += `${i + 2}. **${task.title}** (${task.id})\n`;
      section += `   Priority: ${task.priority || 'medium'}\n`;
    }

    section += '\n';
    return section;
  }

  /**
   * Render dependencies
   */
  private renderDependencies(dependencies: string[]): string {
    let section = `## Dependencies\n\n`;
    section += `This task depends on:\n`;

    for (const dep of dependencies) {
      section += `  • ${dep}\n`;
    }

    section += '\n';
    return section;
  }

  /**
   * Render loaded skills
   */
  private renderSkills(skills: string[]): string {
    let section = `## Skills Loaded\n\n`;

    for (const skill of skills) {
      section += `  • ${skill}\n`;
    }

    section += '\n';
    return section;
  }

  /**
   * Render session configuration
   */
  private renderSessionConfig(session: any): string {
    let section = `## Session Configuration\n\n`;
    section += `**Model**: ${session.model}\n`;
    section += `**Permission Mode**: ${session.permissionMode}\n`;

    if (session.thinkingMode) {
      section += `**Thinking Mode**: ${session.thinkingMode}\n`;
    }

    if (session.maxTurns) {
      section += `**Max Turns**: ${session.maxTurns}\n`;
    }

    section += '\n';
    return section;
  }

  /**
   * Render footer
   */
  private renderFooter(): string {
    return `${'═'.repeat(60)}\n\n`;
  }

  /**
   * Center text within a given width
   */
  private center(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }
}
