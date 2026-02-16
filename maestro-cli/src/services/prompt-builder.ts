import type {
  MaestroManifest,
  CodebaseContext,
  RelatedTask,
  ProjectStandards,
  TaskData,
  AgentMode,
  Capability,
} from '../types/manifest.js';
import { getEffectiveStrategy, computeCapabilities } from '../types/manifest.js';

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
   * System XML mode — identity + workflow + capabilities + commands only.
   * Task-specific data is intentionally excluded.
   */
  buildSystemXml(manifest: MaestroManifest): string {
    const mode = manifest.mode;
    const strategy = getEffectiveStrategy(manifest);
    const capabilities = computeCapabilities(mode, strategy);

    const parts: string[] = [];
    parts.push(`<maestro_system_prompt mode="${mode}" strategy="${strategy}" version="3.0">`);
    parts.push(this.buildIdentity(mode));
    parts.push(this.buildCapabilities(capabilities));
    parts.push(this.buildWorkflow(mode, strategy));
    parts.push(this.buildCommandsSection(mode));
    parts.push('</maestro_system_prompt>');
    return parts.join('\n');
  }

  /**
   * Task XML mode — task/context payload only.
   * Identity/workflow is intentionally excluded.
   */
  buildTaskXml(manifest: MaestroManifest): string {
    const mode = manifest.mode;
    const strategy = getEffectiveStrategy(manifest);

    const parts: string[] = [];
    parts.push(`<maestro_task_prompt mode="${mode}" strategy="${strategy}" version="3.0">`);
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
    const mode = manifest.mode;
    const strategy = getEffectiveStrategy(manifest);
    const capabilities = computeCapabilities(mode, strategy);

    const parts: string[] = [];

    parts.push(`<maestro_prompt mode="${mode}" strategy="${strategy}" version="3.0">`);

    // Identity
    parts.push(this.buildIdentity(mode));

    // Capabilities
    parts.push(this.buildCapabilities(capabilities));

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
    parts.push(this.buildWorkflow(mode, strategy));

    parts.push('</maestro_prompt>');

    return parts.join('\n');
  }

  // ── Internal builders ────────────────────────────────────────

  private buildIdentity(mode: AgentMode): string {
    const lines = ['  <identity>'];
    lines.push('    <profile>maestro-agent</profile>');
    if (mode === 'execute') {
      lines.push('    <instruction>You are a worker agent. You implement tasks directly — write code, run tests, fix bugs. You report progress, blockers, and completion using Maestro CLI commands. Follow the workflow phases in order.</instruction>');
    } else {
      lines.push('    <instruction>You are a coordinator agent. You NEVER write code or implement anything directly. Your job is to decompose tasks into subtasks, spawn worker sessions to do the work, monitor their progress, and report results. Follow the workflow phases in order.</instruction>');
    }
    lines.push('  </identity>');
    return lines.join('\n');
  }

  private buildCapabilities(capabilities: Capability[]): string {
    const lines = ['  <capabilities>'];
    for (const cap of capabilities) {
      lines.push(`    <capability name="${cap.name}" enabled="${cap.enabled}" />`);
    }
    lines.push('  </capabilities>');
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

  private buildWorkflow(mode: AgentMode, strategy: string): string {
    const phases = this.getWorkflowPhases(mode, strategy);
    const lines = ['  <workflow>'];
    for (const phase of phases) {
      lines.push(`    <phase name="${phase.name}">${phase.description}</phase>`);
    }
    lines.push('  </workflow>');
    return lines.join('\n');
  }

  /**
   * Workflow phases per mode+strategy combination (three-axis model).
   */
  private getWorkflowPhases(mode: AgentMode, strategy: string): { name: string; description: string }[] {
    // ── Execute strategies ──────────────────────────────────────

    if (mode === 'execute') {
      if (strategy === 'simple') {
        return [
          {
            name: 'execute',
            description:
              'You have ONE task. Read it carefully, then implement it directly. ' +
              'Work through the requirements methodically — write code, run tests, fix issues. ' +
              'Do not decompose or delegate. You are the executor.',
          },
          {
            name: 'report',
            description:
              'After each meaningful milestone (file created, test passing, feature working), report progress:\n' +
              '  maestro session report progress "<what you just accomplished>"\n' +
              'If you hit a blocker you cannot resolve:\n' +
              '  maestro session report blocked "<what is blocking and why>"',
          },
          {
            name: 'complete',
            description:
              'When all acceptance criteria are met and the task is fully done:\n' +
              '  maestro session report complete "<summary of what was delivered>"\n' +
              'If you produced important artifacts, add docs:\n' +
              '  maestro session docs add "<title>" --file <path>',
          },
        ];
      }

      if (strategy === 'queue') {
        return [
          {
            name: 'pull',
            description:
              'Run `maestro queue top` to see the next task in the queue. ' +
              'If the queue is empty, wait — do NOT exit. Poll periodically with `maestro queue status`.',
          },
          {
            name: 'claim',
            description:
              'Run `maestro queue start` to claim the task. This marks it as "processing" and prevents other workers from taking it.',
          },
          {
            name: 'execute',
            description:
              'Implement the claimed task. Work through it completely — write code, run tests, verify.',
          },
          {
            name: 'report',
            description:
              'Report progress on milestones:\n' +
              '  maestro session report progress "<message>"',
          },
          {
            name: 'finish',
            description:
              'When done: `maestro queue complete`. If you cannot finish: `maestro queue fail "<reason>"`. ' +
              'Then loop back to the PULL phase to get the next task. ' +
              'Continue this loop until the queue is empty and no new work arrives.',
          },
        ];
      }

      if (strategy === 'tree') {
        return [
          {
            name: 'analyze',
            description:
              'Run `maestro task children <taskId> --recursive` to see the full task tree. ' +
              'Identify leaf tasks (no children) and check dependencies between them.',
          },
          {
            name: 'plan',
            description:
              'Determine execution order: tasks with no unresolved dependencies go first. ' +
              'If a task depends on another, the dependency must complete before it starts. ' +
              'Group independent siblings that can be done in sequence.',
          },
          {
            name: 'execute',
            description:
              'Work through tasks in the planned order. For each task:\n' +
              '  1. Run `maestro task report progress <taskId> "Starting work"`\n' +
              '  2. Implement it fully\n' +
              '  3. Run `maestro task report complete <taskId> "<summary>"`\n' +
              'Then move to the next task in order.',
          },
          {
            name: 'report',
            description:
              'Report per-task progress as you go:\n' +
              '  maestro task report progress <taskId> "<message>"\n' +
              'Report session-level blockers:\n' +
              '  maestro session report blocked "<reason>"',
          },
          {
            name: 'complete',
            description:
              'Only when ALL subtasks in the tree are done:\n' +
              '  maestro session report complete "<summary of all completed work>"',
          },
        ];
      }

      // fallback for unknown execute strategies
      return [
        { name: 'execute', description: 'Implement the assigned task.' },
        { name: 'report', description: 'Report milestones with: maestro session report progress "<message>"' },
        { name: 'complete', description: 'Report completion with: maestro session report complete "<summary>"' },
      ];
    }

    // ── Coordinate strategies ───────────────────────────────────

    if (strategy === 'default') {
      return [
        {
          name: 'analyze',
          description:
            'Your assigned task is in the <task> block above. Read the title, description, and acceptance criteria carefully. ' +
            'This is the task you must decompose and delegate — do NOT implement it yourself.',
        },
        {
          name: 'decompose',
          description:
            'Break the task into small, testable subtasks. Each subtask should be independently completable by a single worker. ' +
            'For each subtask:\n' +
            '  maestro task create "<title>" -d "<clear description with acceptance criteria>" --priority <high|medium|low> --parent <parentTaskId>\n' +
            'Subtasks should be ordered so that dependencies are created first.',
        },
        {
          name: 'spawn',
          description:
            'For each subtask, spawn a worker session:\n' +
            '  maestro session spawn --task <subtaskId>\n' +
            'Spawn them ONE AT A TIME, sequentially. Wait for the spawn confirmation (session ID) before spawning the next. ' +
            'Collect all spawned session IDs.',
        },
        {
          name: 'monitor',
          description:
            'Watch all spawned sessions until they complete:\n' +
            '  maestro session watch <sessionId1>,<sessionId2>,...\n' +
            'This blocks and streams real-time status updates. It exits automatically when all watched sessions reach completed/failed/stopped. ' +
            'If a worker reports BLOCKED or NEEDS INPUT, investigate with `maestro session list` and `maestro task get <taskId>` to understand the issue.',
        },
        {
          name: 'verify',
          description:
            'After all workers finish, verify results:\n' +
            '  1. Run `maestro task children <parentTaskId>` to check all subtask statuses\n' +
            '  2. If any failed, decide whether to retry (spawn again) or report blocked\n' +
            '  3. If all succeeded, verify the parent task acceptance criteria are met',
        },
        {
          name: 'complete',
          description:
            'When all subtasks are done and verified:\n' +
            '  maestro task report complete <parentTaskId> "<summary>"\n' +
            '  maestro session report complete "<overall summary>"',
        },
      ];
    }

    if (strategy === 'intelligent-batching') {
      return [
        {
          name: 'analyze',
          description:
            'Your assigned task is in the <task> block above. Read it carefully. ' +
            'Identify the scope and figure out which pieces of work are independent vs dependent on each other.',
        },
        {
          name: 'decompose',
          description:
            'Break the task into subtasks, then group them into BATCHES. ' +
            'A batch is a set of subtasks that have NO dependencies on each other and CAN run in parallel. ' +
            'Order batches so that later batches depend on earlier ones.\n\n' +
            'Example: if task A and B are independent, but C depends on both → Batch 1: [A, B], Batch 2: [C].\n\n' +
            'Create all subtasks upfront:\n' +
            '  maestro task create "<title>" -d "<description>" --parent <parentTaskId>',
        },
        {
          name: 'execute_batch',
          description:
            'Process batches sequentially. For each batch:\n' +
            '  1. Spawn ALL workers in the batch:\n' +
            '     maestro session spawn --task <subtaskId>  (for each task in the batch)\n' +
            '  2. Collect all session IDs from the batch\n' +
            '  3. Watch the entire batch:\n' +
            '     maestro session watch <id1>,<id2>,<id3>\n' +
            '  4. Wait for the watch to complete (all sessions in batch done)\n' +
            '  5. Check results: `maestro task children <parentTaskId>`\n' +
            '  6. If any task in the batch failed, decide: retry or abort\n' +
            '  7. Only proceed to the next batch when ALL tasks in this batch succeeded\n\n' +
            'Repeat for each batch in order.',
        },
        {
          name: 'verify',
          description:
            'After all batches complete, verify:\n' +
            '  maestro task children <parentTaskId>\n' +
            'Ensure every subtask is completed. Handle any failures.',
        },
        {
          name: 'complete',
          description:
            'When all batches succeeded:\n' +
            '  maestro task report complete <parentTaskId> "<summary>"\n' +
            '  maestro session report complete "<summary with batch count and results>"',
        },
      ];
    }

    if (strategy === 'dag') {
      return [
        {
          name: 'analyze',
          description:
            'Your assigned task is in the <task> block above. Read it carefully. ' +
            'Map out the work and identify dependency relationships between the pieces.',
        },
        {
          name: 'build_dag',
          description:
            'Decompose the task into subtasks with explicit dependency edges, forming a directed acyclic graph (DAG).\n\n' +
            'For each subtask, create it and note which other subtasks it depends on:\n' +
            '  maestro task create "<title>" -d "<description. DEPENDS ON: <taskId1>, <taskId2>>" --parent <parentTaskId>\n\n' +
            'Track the dependency graph yourself. A subtask is READY when all its dependencies are completed. ' +
            'Root nodes (no dependencies) are ready immediately.',
        },
        {
          name: 'execute_wave',
          description:
            'Execute the DAG in waves (topological layers):\n\n' +
            '  WAVE LOOP:\n' +
            '  1. Identify all READY tasks (dependencies all completed, not yet spawned)\n' +
            '  2. Spawn a worker for each ready task:\n' +
            '     maestro session spawn --task <subtaskId>\n' +
            '  3. Watch this wave:\n' +
            '     maestro session watch <id1>,<id2>,...\n' +
            '  4. When the wave completes, check results\n' +
            '  5. Mark completed tasks, unlock downstream tasks whose dependencies are now met\n' +
            '  6. If any task failed: decide to retry, skip, or abort the whole DAG\n' +
            '  7. Repeat — find newly ready tasks and spawn the next wave\n' +
            '  8. Stop when no more tasks remain\n\n' +
            'This maximizes parallelism: independent branches of the DAG execute simultaneously.',
        },
        {
          name: 'verify',
          description:
            'After all waves complete:\n' +
            '  maestro task children <parentTaskId>\n' +
            'Ensure every node in the DAG reached completed status.',
        },
        {
          name: 'complete',
          description:
            'When the full DAG is resolved:\n' +
            '  maestro task report complete <parentTaskId> "<summary>"\n' +
            '  maestro session report complete "<summary with wave count and parallelism stats>"',
        },
      ];
    }

    // fallback for unknown coordinate strategies
    return [
      { name: 'analyze', description: 'Your assigned task is in the <task> block above. Read it carefully.' },
      { name: 'decompose', description: 'Break the task into subtasks with maestro task create --parent <parentTaskId>.' },
      { name: 'spawn', description: 'Spawn workers with maestro session spawn --task <subtaskId>.' },
      { name: 'monitor', description: 'Watch sessions with maestro session watch <id1>,<id2>,...' },
      { name: 'complete', description: 'Report completion with maestro session report complete "<summary>".' },
    ];
  }

  // ── Commands section ────────────────────────────────────────

  private buildCommandsSection(mode: AgentMode): string {
    const lines: string[] = ['  <commands>'];

    // Core commands
    lines.push('    <group name="root">');
    lines.push('      <command name="whoami" id="whoami" syntax="maestro whoami" description="Print current context" />');
    lines.push('      <command name="status" id="status" syntax="maestro status" description="Show project status" />');
    lines.push('      <command name="commands" id="commands" syntax="maestro commands" description="Show available commands" />');
    lines.push('    </group>');

    // Task commands
    lines.push('    <group name="task">');
    lines.push('      <command name="task:list" id="task:list" syntax="maestro task list [taskId] [--status &lt;status&gt;] [--priority &lt;priority&gt;]" description="List tasks" />');
    lines.push('      <command name="task:get" id="task:get" syntax="maestro task get &lt;taskId&gt;" description="Get task details" />');
    lines.push('      <command name="task:create" id="task:create" syntax="maestro task create &quot;&lt;title&gt;&quot; [-d &quot;&lt;description&gt;&quot;] [--priority &lt;high|medium|low&gt;] [--parent &lt;parentId&gt;]" description="Create new task" />');
    lines.push('      <command name="task:edit" id="task:edit" syntax="maestro task edit &lt;taskId&gt; [--title &quot;&lt;title&gt;&quot;] [--desc &quot;&lt;description&gt;&quot;] [--priority &lt;priority&gt;]" description="Edit task fields" />');
    lines.push('      <command name="task:delete" id="task:delete" syntax="maestro task delete &lt;taskId&gt; [--cascade]" description="Delete a task" />');
    lines.push('      <command name="task:children" id="task:children" syntax="maestro task children &lt;taskId&gt; [--recursive]" description="List child tasks" />');
    lines.push('      <command name="task:report:progress" id="task:report:progress" syntax="maestro task report progress &lt;taskId&gt; &quot;&lt;message&gt;&quot;" description="Report task progress" />');
    lines.push('      <command name="task:report:complete" id="task:report:complete" syntax="maestro task report complete &lt;taskId&gt; &quot;&lt;summary&gt;&quot;" description="Report task completion" />');
    lines.push('      <command name="task:report:blocked" id="task:report:blocked" syntax="maestro task report blocked &lt;taskId&gt; &quot;&lt;reason&gt;&quot;" description="Report task blocked" />');
    lines.push('      <command name="task:report:error" id="task:report:error" syntax="maestro task report error &lt;taskId&gt; &quot;&lt;description&gt;&quot;" description="Report task error" />');
    lines.push('      <command name="task:docs:add" id="task:docs:add" syntax="maestro task docs add &lt;taskId&gt; &quot;&lt;title&gt;&quot; --file &lt;filePath&gt;" description="Add doc to task" />');
    lines.push('      <command name="task:docs:list" id="task:docs:list" syntax="maestro task docs list &lt;taskId&gt;" description="List task docs" />');
    lines.push('    </group>');

    // Session commands
    lines.push('    <group name="session">');
    lines.push('      <command name="session:info" id="session:info" syntax="maestro session info" description="Get session info" />');
    lines.push('      <command name="session:report:progress" id="session:report:progress" syntax="maestro session report progress &quot;&lt;message&gt;&quot;" description="Report work progress" />');
    lines.push('      <command name="session:report:complete" id="session:report:complete" syntax="maestro session report complete &quot;&lt;summary&gt;&quot;" description="Report completion" />');
    lines.push('      <command name="session:report:blocked" id="session:report:blocked" syntax="maestro session report blocked &quot;&lt;reason&gt;&quot;" description="Report blocker" />');
    lines.push('      <command name="session:report:error" id="session:report:error" syntax="maestro session report error &quot;&lt;description&gt;&quot;" description="Report error" />');
    lines.push('      <command name="session:docs:add" id="session:docs:add" syntax="maestro session docs add &quot;&lt;title&gt;&quot; --file &lt;filePath&gt;" description="Add doc to session" />');
    lines.push('      <command name="session:docs:list" id="session:docs:list" syntax="maestro session docs list" description="List session docs" />');
    lines.push('    </group>');

    // Mail commands
    lines.push('    <group name="mail">');
    lines.push('      <command name="mail:send" id="mail:send" syntax="maestro mail send &lt;sessionId1&gt;,&lt;sessionId2&gt;,... --type &lt;type&gt; --subject &quot;...&quot; [--message &quot;...&quot;]" description="Send mail to one or more sessions" />');
    lines.push('      <command name="mail:inbox" id="mail:inbox" syntax="maestro mail inbox [--type &lt;type&gt;]" description="List inbox for current session" />');
    lines.push('      <command name="mail:reply" id="mail:reply" syntax="maestro mail reply &lt;mailId&gt; --message &quot;...&quot;" description="Reply to a mail" />');
    if (mode === 'coordinate') {
      lines.push('      <command name="mail:broadcast" id="mail:broadcast" syntax="maestro mail broadcast --type &lt;type&gt; --subject &quot;...&quot; [--message &quot;...&quot;]" description="Send to all sessions" />');
      lines.push('      <command name="mail:wait" id="mail:wait" syntax="maestro mail wait [--timeout &lt;ms&gt;] [--since &lt;timestamp&gt;]" description="Long-poll, block until mail arrives" />');
    }
    lines.push('    </group>');

    // Show commands
    lines.push('    <group name="show">');
    lines.push('      <command name="show:modal" id="show:modal" syntax="maestro show modal" description="Show HTML modal in UI" />');
    lines.push('    </group>');

    // Modal commands
    lines.push('    <group name="modal">');
    lines.push('      <command name="modal:events" id="modal:events" syntax="maestro modal events" description="Listen for modal user actions" />');
    lines.push('    </group>');

    lines.push('  </commands>');
    return lines.join('\n');
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
