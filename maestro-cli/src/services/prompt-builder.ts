import type {
  MaestroManifest,
  CodebaseContext,
  RelatedTask,
  ProjectStandards,
  TaskData,
} from '../types/manifest.js';

export type PromptMode = 'normal' | 'xml';

/**
 * PromptBuilder - Programmatically constructs prompts from manifest data.
 *
 * Replaces the old template-file + variable-substitution system with
 * a single class that builds XML (or plain text) directly from manifest fields.
 */
export class PromptBuilder {
  private mode: PromptMode;

  constructor(mode: PromptMode = 'xml') {
    this.mode = mode;
  }

  /**
   * Build prompt from manifest using the configured mode.
   */
  build(manifest: MaestroManifest): string {
    if (this.mode === 'normal') {
      return this.buildNormal(manifest);
    }
    return this.buildXml(manifest);
  }

  /**
   * System XML mode — identity + workflow only.
   * Task-specific data is intentionally excluded.
   */
  buildSystemXml(manifest: MaestroManifest): string {
    const role = manifest.role;
    const strategy = role === 'orchestrator'
      ? (manifest.orchestratorStrategy || 'default')
      : (manifest.strategy || 'simple');

    const parts: string[] = [];
    parts.push(`<maestro_system_prompt role="${role}" strategy="${strategy}" version="2.0">`);
    parts.push(this.buildIdentity(role));
    parts.push(this.buildWorkflow(role, strategy));
    parts.push('</maestro_system_prompt>');
    return parts.join('\n');
  }

  /**
   * Task XML mode — task/context payload only.
   * Identity/workflow is intentionally excluded.
   */
  buildTaskXml(manifest: MaestroManifest): string {
    const role = manifest.role;
    const strategy = role === 'orchestrator'
      ? (manifest.orchestratorStrategy || 'default')
      : (manifest.strategy || 'simple');

    const parts: string[] = [];
    parts.push(`<maestro_task_prompt role="${role}" strategy="${strategy}" version="2.0">`);
    parts.push(this.buildTasks(manifest));

    if ((strategy as string) === 'tree' && manifest.tasks.length > 1) {
      const tree = this.buildTaskTree(manifest.tasks);
      if (tree) parts.push(tree);
    }

    const context = this.buildContext(manifest);
    if (context) parts.push(context);

    if (manifest.skills && manifest.skills.length > 0) {
      parts.push(this.buildSkills(manifest.skills));
    }

    parts.push('</maestro_task_prompt>');
    return parts.join('\n');
  }

  /**
   * Plain text mode — just task title + description.
   */
  buildNormal(manifest: MaestroManifest): string {
    const primary = manifest.tasks[0];
    return `${primary.title}\n\n${primary.description}`;
  }

  /**
   * XML mode — structured XML with all manifest fields, workflow, and commands.
   */
  buildXml(manifest: MaestroManifest): string {
    const role = manifest.role;
    const strategy = role === 'orchestrator'
      ? (manifest.orchestratorStrategy || 'default')
      : (manifest.strategy || 'simple');

    const parts: string[] = [];

    parts.push(`<maestro_prompt role="${role}" strategy="${strategy}" version="2.0">`);

    // Identity
    parts.push(this.buildIdentity(role));

    // Tasks
    parts.push(this.buildTasks(manifest));

    // Task tree (only for tree strategy — tree is an informal strategy
    // used when tasks have parentId relationships)
    if ((strategy as string) === 'tree' && manifest.tasks.length > 1) {
      const tree = this.buildTaskTree(manifest.tasks);
      if (tree) parts.push(tree);
    }

    // Context
    const context = this.buildContext(manifest);
    if (context) parts.push(context);

    // Skills
    if (manifest.skills && manifest.skills.length > 0) {
      parts.push(this.buildSkills(manifest.skills));
    }

    // Workflow
    parts.push(this.buildWorkflow(role, strategy));

    parts.push('</maestro_prompt>');

    return parts.join('\n');
  }

  // ── Internal builders ────────────────────────────────────────

  private buildIdentity(role: 'worker' | 'orchestrator'): string {
    const lines = ['  <identity>'];
    if (role === 'worker') {
      lines.push('    <agent>maestro-worker</agent>');
      lines.push('    <instruction>You report progress, blockers, and completion using Maestro CLI commands.</instruction>');
    } else {
      lines.push('    <agent>maestro-orchestrator</agent>');
      lines.push('    <instruction>You coordinate and delegate. You never implement directly.</instruction>');
      lines.push('    <golden_rule>Orchestrators coordinate. Workers implement.</golden_rule>');
    }
    lines.push('  </identity>');
    return lines.join('\n');
  }

  private buildTasks(manifest: MaestroManifest): string {
    const tasks = manifest.tasks;
    const lines: string[] = [];

    if (tasks.length === 1) {
      const t = tasks[0];
      lines.push('  <task>');
      lines.push(`    <id>${this.esc(t.id)}</id>`);
      lines.push(`    <title>${this.esc(t.title)}</title>`);
      lines.push(`    <description>${this.esc(t.description)}</description>`);
      lines.push(`    <parent_id>${this.esc(t.parentId ?? '')}</parent_id>`);
      lines.push(`    <priority>${t.priority || 'medium'}</priority>`);
      lines.push(`    <acceptance_criteria>${this.formatAcceptanceCriteria(t.acceptanceCriteria)}</acceptance_criteria>`);
      if (t.dependencies && t.dependencies.length > 0) {
        lines.push('    <dependencies>' + t.dependencies.map(d => `<dep>${this.esc(d)}</dep>`).join('') + '</dependencies>');
      }
      lines.push('  </task>');
    } else {
      lines.push(`  <tasks count="${tasks.length}">`);
      tasks.forEach((t, i) => {
        const primary = i === 0 ? ' primary="true"' : '';
        lines.push(`    <task id="${this.esc(t.id)}"${primary}>`);
        lines.push(`      <title>${this.esc(t.title)}</title>`);
        lines.push(`      <description>${this.esc(t.description)}</description>`);
        lines.push(`      <parent_id>${this.esc(t.parentId ?? '')}</parent_id>`);
        lines.push(`      <priority>${t.priority || 'medium'}</priority>`);
        lines.push(`      <acceptance_criteria>`);
        (t.acceptanceCriteria || []).forEach(c => {
          lines.push(`        <criterion>${this.esc(c)}</criterion>`);
        });
        lines.push('      </acceptance_criteria>');
        if (t.dependencies && t.dependencies.length > 0) {
          lines.push('      <dependencies>' + t.dependencies.map(d => `<dep>${this.esc(d)}</dep>`).join('') + '</dependencies>');
        }
        lines.push('    </task>');
      });
      lines.push('  </tasks>');
    }
    return lines.join('\n');
  }

  private buildTaskTree(tasks: TaskData[]): string | null {
    const hasTree = tasks.some(t => t.parentId);
    if (!hasTree) return null;

    const taskMap = new Map<string, TaskData>();
    tasks.forEach(t => taskMap.set(t.id, t));

    const roots = tasks.filter(t => !t.parentId || !taskMap.has(t.parentId));
    const childrenOf = (parentId: string) => tasks.filter(t => t.parentId === parentId);

    const lines: string[] = ['  <task_tree>'];

    const renderNode = (task: TaskData, indent: string) => {
      const status = task.status || 'todo';
      const attrs = [`id="${this.esc(task.id)}"`, `status="${status}"`];
      if (task.priority) attrs.push(`priority="${task.priority}"`);
      if (task.dependencies && task.dependencies.length > 0) {
        attrs.push(`deps="${task.dependencies.join(',')}"`);
      }
      lines.push(`${indent}<node ${attrs.join(' ')}>`);
      lines.push(`${indent}  <title>${this.esc(task.title)}</title>`);
      if (task.description) {
        lines.push(`${indent}  <description>${this.esc(task.description)}</description>`);
      }
      const children = childrenOf(task.id);
      children.forEach(child => renderNode(child, indent + '  '));
      lines.push(`${indent}</node>`);
    };

    roots.forEach(root => renderNode(root, '    '));
    lines.push('  </task_tree>');
    return lines.join('\n');
  }

  private buildContext(manifest: MaestroManifest): string | null {
    const ctx = manifest.context;
    const sections: string[] = [];

    // Codebase
    const codebase = this.buildCodebaseContext(ctx?.codebaseContext);
    if (codebase) sections.push(codebase);

    // Related tasks
    const related = this.buildRelatedTasks(ctx?.relatedTasks);
    if (related) sections.push(related);

    // Project standards
    const standards = this.buildProjectStandards(ctx?.projectStandards);
    if (standards) sections.push(standards);

    if (sections.length === 0) return null;

    return '  <context>\n' + sections.join('\n') + '\n  </context>';
  }

  private buildCodebaseContext(ctx?: CodebaseContext): string | null {
    if (!ctx) return null;
    const lines: string[] = [];
    let hasContent = false;

    lines.push('    <codebase>');

    if (ctx.recentChanges && ctx.recentChanges.length > 0) {
      lines.push('      <recent_changes>');
      ctx.recentChanges.forEach(c => lines.push(`        <change>${this.esc(c)}</change>`));
      lines.push('      </recent_changes>');
      hasContent = true;
    }

    if (ctx.relevantFiles && ctx.relevantFiles.length > 0) {
      lines.push('      <relevant_files>');
      ctx.relevantFiles.forEach(f => lines.push(`        <file>${this.esc(f)}</file>`));
      lines.push('      </relevant_files>');
      hasContent = true;
    }

    if (ctx.architecture) {
      lines.push(`      <architecture>${this.esc(ctx.architecture)}</architecture>`);
      hasContent = true;
    }

    if (ctx.techStack && ctx.techStack.length > 0) {
      lines.push('      <tech_stack>');
      ctx.techStack.forEach(t => lines.push(`        <technology>${this.esc(t)}</technology>`));
      lines.push('      </tech_stack>');
      hasContent = true;
    }

    lines.push('    </codebase>');

    return hasContent ? lines.join('\n') : null;
  }

  private buildRelatedTasks(tasks?: RelatedTask[]): string | null {
    if (!tasks || tasks.length === 0) return null;

    const lines = ['    <related_tasks>'];
    tasks.forEach(t => {
      lines.push(`      <task id="${this.esc(t.id)}" relationship="${t.relationship}" status="${t.status}">`);
      lines.push(`        <title>${this.esc(t.title)}</title>`);
      lines.push('      </task>');
    });
    lines.push('    </related_tasks>');
    return lines.join('\n');
  }

  private buildProjectStandards(standards?: ProjectStandards): string | null {
    if (!standards) return null;
    const lines: string[] = [];
    let hasContent = false;

    lines.push('    <project_standards>');

    if (standards.codingStyle) {
      lines.push(`      <coding_style>${this.esc(standards.codingStyle)}</coding_style>`);
      hasContent = true;
    }
    if (standards.testingApproach) {
      lines.push(`      <testing_approach>${this.esc(standards.testingApproach)}</testing_approach>`);
      hasContent = true;
    }
    if (standards.documentation) {
      lines.push(`      <documentation>${this.esc(standards.documentation)}</documentation>`);
      hasContent = true;
    }
    if (standards.branchingStrategy) {
      lines.push(`      <branching_strategy>${this.esc(standards.branchingStrategy)}</branching_strategy>`);
      hasContent = true;
    }
    if (standards.cicdPipeline) {
      lines.push(`      <cicd_pipeline>${this.esc(standards.cicdPipeline)}</cicd_pipeline>`);
      hasContent = true;
    }
    if (standards.customGuidelines && standards.customGuidelines.length > 0) {
      lines.push('      <custom_guidelines>');
      standards.customGuidelines.forEach(g => lines.push(`        <guideline>${this.esc(g)}</guideline>`));
      lines.push('      </custom_guidelines>');
      hasContent = true;
    }

    lines.push('    </project_standards>');

    return hasContent ? lines.join('\n') : null;
  }

  private buildSkills(skills: string[]): string {
    const lines = ['  <skills>'];
    skills.forEach(s => lines.push(`    <skill>${this.esc(s)}</skill>`));
    lines.push('  </skills>');
    return lines.join('\n');
  }

  private buildWorkflow(role: 'worker' | 'orchestrator', strategy: string): string {
    const steps = this.getWorkflowSteps(role, strategy);
    const lines = ['  <workflow>'];
    steps.forEach(s => lines.push(`    <step>${s}</step>`));
    lines.push('  </workflow>');
    return lines.join('\n');
  }

  /**
   * Hardcoded workflow steps per role+strategy combination.
   */
  private getWorkflowSteps(role: 'worker' | 'orchestrator', strategy: string): string[] {
    if (role === 'worker') {
      if (strategy === 'queue') {
        return [
          'Run maestro queue top to see next task.',
          'Run maestro queue start to claim and begin working.',
          'Implement the task requirements.',
          'Report milestones with: maestro session report progress "<message>"',
          'Run maestro queue complete when done, or maestro queue fail "reason" if blocked.',
          'Repeat from step 1. Do not exit when queue is empty — wait/poll for new work.',
        ];
      }
      if (strategy === 'tree') {
        return [
          'Review full task tree and dependency flow.',
          'Choose an execution order based on dependencies.',
          'Implement each subtask.',
          'Report progress per subtask with: maestro task report progress <taskId> "<message>"',
          'Report blockers with: maestro session report blocked "<reason>"',
          'Complete session only when all subtasks are done with: maestro session report complete "<summary>"',
        ];
      }
      // simple (default)
      return [
        'Implement assigned tasks.',
        'Report milestones with: maestro session report progress "<message>"',
        'Report blockers with: maestro session report blocked "<reason>"',
        'Report completion with: maestro session report complete "<summary>"',
        'Add docs when relevant with task/session docs commands.',
      ];
    }

    // orchestrator
    if (strategy === 'intelligent-batching') {
      return [
        'Analyze current state with maestro status.',
        'Plan and decompose into testable subtasks.',
        'Group related independent tasks into batches for parallel execution.',
        'Create subtasks and spawn workers for each batch.',
        'Track progress via task/session list.',
        'Report progress and complete when done.',
      ];
    }
    if (strategy === 'dag') {
      return [
        'Analyze current state with maestro status.',
        'Plan and decompose into a directed acyclic graph of subtasks.',
        'Respect dependency edges — execute in topological order.',
        'Parallelize independent branches by spawning workers.',
        'Track progress via task/session list.',
        'Report progress and complete when done.',
      ];
    }
    // default orchestrator
    return [
      'Analyze current state with maestro status.',
      'Plan and decompose into testable subtasks.',
      'Create subtasks under the primary task.',
      'Spawn workers for subtasks.',
      'Track via task/session list.',
      'Report progress and complete when done.',
    ];
  }

  // ── Formatting helpers ───────────────────────────────────────

  formatAcceptanceCriteria(criteria?: string[]): string {
    if (!criteria || criteria.length === 0) {
      return 'No acceptance criteria specified.';
    }
    return criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
  }

  /**
   * Escape XML special characters.
   */
  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
