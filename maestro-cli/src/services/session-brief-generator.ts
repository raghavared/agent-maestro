import type { MaestroManifest } from '../types/manifest.js';
import {
  MODE_TITLE_EXECUTE,
  MODE_TITLE_COORDINATE,
  BRIEF_TITLE_TEMPLATE,
  BRIEF_PRIMARY_TASK_HEADER,
  BRIEF_SINGLE_TASK_HEADER,
  BRIEF_ACCEPTANCE_CRITERIA_HEADER,
  BRIEF_ACCEPTANCE_CRITERIA_INTRO,
  BRIEF_ADDITIONAL_TASKS_HEADER,
  BRIEF_DEPENDENCIES_HEADER,
  BRIEF_DEPENDENCIES_INTRO,
  BRIEF_SKILLS_HEADER,
  BRIEF_SESSION_CONFIG_HEADER,
} from '../prompts/index.js';

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
    const modeTitle = manifest.mode === 'execute' ? MODE_TITLE_EXECUTE : MODE_TITLE_COORDINATE;
    const primaryTask = manifest.tasks[0];
    const isMultiTask = manifest.tasks.length > 1;

    let brief = this.renderHeader(modeTitle);

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

    brief += this.renderFooter();

    return brief;
  }

  /**
   * Render header
   */
  private renderHeader(modeTitle: string): string {
    const title = BRIEF_TITLE_TEMPLATE(modeTitle);
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
      ? BRIEF_PRIMARY_TASK_HEADER(totalTasks)
      : BRIEF_SINGLE_TASK_HEADER;

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

    let section = BRIEF_ACCEPTANCE_CRITERIA_HEADER;
    section += BRIEF_ACCEPTANCE_CRITERIA_INTRO;

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

    let section = BRIEF_ADDITIONAL_TASKS_HEADER;

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
    let section = BRIEF_DEPENDENCIES_HEADER;
    section += BRIEF_DEPENDENCIES_INTRO;

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
    let section = BRIEF_SKILLS_HEADER;

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
    let section = BRIEF_SESSION_CONFIG_HEADER;
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
