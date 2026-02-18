import type {
  MaestroManifest,
  CodebaseContext,
  RelatedTask,
  ProjectStandards,
  TaskData,
  AgentMode,
  TeamMemberData,
} from '../types/manifest.js';
import type { CapabilityOverrides } from '../types/manifest.js';
import { getWorkflowTemplate } from './workflow-templates.js';

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

    const parts: string[] = [];
    parts.push(`<maestro_system_prompt mode="${mode}" version="3.0">`);
    parts.push(this.buildIdentity(mode, manifest));
    // Team member identity (if this session is for a custom team member)
    const teamMemberIdentity = this.buildTeamMemberIdentity(manifest);
    if (teamMemberIdentity) parts.push(teamMemberIdentity);
    // Team members roster
    const teamMembers = this.buildTeamMembers(manifest.teamMembers, mode, manifest);
    if (teamMembers) parts.push(teamMembers);
    parts.push(this.buildWorkflow(mode, manifest));
    // Note: commands_reference is injected by WhoamiRenderer.renderSystemPrompt()
    // using the dynamic compact command brief from command-permissions.ts.
    // Do NOT add buildCommandsReference() here — it would create a duplicate block.
    parts.push('</maestro_system_prompt>');
    return parts.join('\n');
  }

  /**
   * Task XML mode — task/context payload only.
   * Identity/workflow is intentionally excluded.
   */
  buildTaskXml(manifest: MaestroManifest): string {
    const mode = manifest.mode;

    const parts: string[] = [];
    parts.push(`<maestro_task_prompt mode="${mode}" version="3.0">`);
    parts.push(this.buildTasks(manifest));

    // Include task tree if tasks have parent-child relationships
    if (manifest.tasks.length > 1) {
      const tree = this.buildTaskTree(manifest.tasks);
      if (tree) parts.push(tree);
    }

    // Session context (session ID, coordinator, project, mode)
    const taskSessionContext = this.buildSessionContext(manifest);
    if (taskSessionContext) parts.push(taskSessionContext);

    // Coordinator directive (if present in manifest)
    const taskDirective = this.buildCoordinatorDirective(manifest);
    if (taskDirective) parts.push(taskDirective);

    const context = this.buildContext(manifest);
    if (context) parts.push(context);

    // Only include skills for Claude (other agent tools don't support plugin-based skills)
    const agentTool = manifest.agentTool || 'claude-code';
    if (manifest.skills && manifest.skills.length > 0 && agentTool === 'claude-code') {
      parts.push(this.buildSkills(manifest.skills));
    }

    parts.push('</maestro_task_prompt>');
    return parts.join('\n');
  }

  /**
   * Plain text mode — just task title + description.
   */
  buildNormal(manifest: MaestroManifest): string {
    return manifest.tasks.map(t => `${t.title}\n\n${t.description}`).join('\n\n---\n\n');
  }

  /**
   * XML mode — structured XML with all manifest fields, workflow, and commands.
   */
  buildXml(manifest: MaestroManifest): string {
    const mode = manifest.mode;

    const parts: string[] = [];

    parts.push(`<maestro_prompt mode="${mode}" version="3.0">`);

    // Identity
    parts.push(this.buildIdentity(mode, manifest));

    // Tasks
    parts.push(this.buildTasks(manifest));

    // Task tree (if tasks have parent-child relationships)
    if (manifest.tasks.length > 1) {
      const tree = this.buildTaskTree(manifest.tasks);
      if (tree) parts.push(tree);
    }

    // Session context
    const sessionContext = this.buildSessionContext(manifest);
    if (sessionContext) parts.push(sessionContext);

    // Coordinator directive
    const directive = this.buildCoordinatorDirective(manifest);
    if (directive) parts.push(directive);

    // Context
    const context = this.buildContext(manifest);
    if (context) parts.push(context);

    // Skills
    if (manifest.skills && manifest.skills.length > 0) {
      parts.push(this.buildSkills(manifest.skills));
    }

    // Team members roster
    const xmlTeamMembers = this.buildTeamMembers(manifest.teamMembers, mode, manifest);
    if (xmlTeamMembers) parts.push(xmlTeamMembers);

    // Workflow
    parts.push(this.buildWorkflow(mode, manifest));

    parts.push('</maestro_prompt>');

    return parts.join('\n');
  }

  // ── Internal builders ────────────────────────────────────────

  private buildIdentity(mode: AgentMode, manifest?: MaestroManifest): string {
    const lines = ['  <identity>'];
    // Use role-specific profile names for clearer identity signal
    lines.push(`    <profile>${mode === 'execute' ? 'maestro-worker' : 'maestro-coordinator'}</profile>`);
    if (mode === 'execute') {
      lines.push('    <instruction>You are a worker agent in a coordinated multi-agent team. You execute assigned tasks directly and autonomously. You communicate with your coordinator and peers via the Maestro mailbox. Report progress at meaningful milestones and escalate blockers promptly. Follow the workflow phases in order.</instruction>');
    } else {
      lines.push('    <instruction>You are a coordinator agent leading a multi-agent team. You NEVER do tasks directly. Your job is to decompose tasks into subtasks, spawn worker sessions, send them clear directives, monitor their progress via mailbox, unblock workers when needed, and report results. Follow the workflow phases in order.</instruction>');
    }
    if (manifest) {
      const projectId = manifest.tasks[0]?.projectId;
      if (projectId) {
        lines.push(`    <project_id>${this.esc(projectId)}</project_id>`);
      }
    }
    lines.push('  </identity>');
    return lines.join('\n');
  }

  private buildTeamMemberIdentity(manifest: MaestroManifest): string | null {
    // Multi-identity: merge into a single unified identity block
    if (manifest.teamMemberProfiles && manifest.teamMemberProfiles.length > 1) {
      const profiles = manifest.teamMemberProfiles.filter(p => p.identity);
      if (profiles.length === 0) return null;

      const lines = ['  <team_member_identity>'];
      lines.push(`    <name>${this.esc(profiles[0].name)}</name>`);
      lines.push(`    <avatar>${this.esc(profiles[0].avatar)}</avatar>`);
      const roleList = profiles.map(p => p.name).join(', ');
      lines.push(`    <instructions>You have the combined expertise of: ${roleList}. Apply all domain knowledge when executing your tasks.</instructions>`);
      for (const profile of profiles) {
        lines.push(`    <expertise source="${this.esc(profile.name)}">${this.raw(profile.identity)}</expertise>`);
      }
      lines.push('  </team_member_identity>');
      return lines.join('\n');
    }

    // Single identity (backward compat): check singular fields or single-element profiles array
    if (manifest.teamMemberProfiles && manifest.teamMemberProfiles.length === 1) {
      const profile = manifest.teamMemberProfiles[0];
      if (!profile.identity) return null;
      const lines = ['  <team_member_identity>'];
      lines.push(`    <name>${this.esc(profile.name)}</name>`);
      lines.push(`    <avatar>${this.esc(profile.avatar)}</avatar>`);
      lines.push(`    <instructions>${this.raw(profile.identity)}</instructions>`);
      lines.push('  </team_member_identity>');
      return lines.join('\n');
    }

    // Original singular fields (backward compat)
    if (!manifest.teamMemberId || !manifest.teamMemberName) return null;
    if (!manifest.teamMemberIdentity) return null;

    const lines = ['  <team_member_identity>'];
    lines.push(`    <name>${this.esc(manifest.teamMemberName)}</name>`);
    if (manifest.teamMemberAvatar) {
      lines.push(`    <avatar>${this.esc(manifest.teamMemberAvatar)}</avatar>`);
    }
    if (manifest.teamMemberIdentity) {
      lines.push(`    <instructions>${this.raw(manifest.teamMemberIdentity)}</instructions>`);
    }
    lines.push('  </team_member_identity>');
    return lines.join('\n');
  }

  private buildTasks(manifest: MaestroManifest): string {
    const tasks = manifest.tasks;
    const lines: string[] = [];

    lines.push(`  <tasks count="${tasks.length}">`);
    for (const t of tasks) {
      lines.push(`    <task id="${this.esc(t.id)}">`);
      lines.push(`      <title>${this.esc(t.title)}</title>`);
      lines.push(`      <description>${this.raw(t.description)}</description>`);
      if (t.parentId) {
        lines.push(`      <parent_id>${this.esc(t.parentId)}</parent_id>`);
      }
      if (t.status) {
        lines.push(`      <status>${this.esc(t.status)}</status>`);
      }
      lines.push(`      <priority>${t.priority || 'medium'}</priority>`);
      const ac = this.formatAcceptanceCriteria(t.acceptanceCriteria);
      if (ac) {
        lines.push(`      <acceptance_criteria>${ac}</acceptance_criteria>`);
      }
      if (t.dependencies && t.dependencies.length > 0) {
        lines.push('      <dependencies>' + t.dependencies.map(d => `<dep>${this.esc(d)}</dep>`).join('') + '</dependencies>');
      }
      lines.push('    </task>');
    }
    lines.push('  </tasks>');
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
        lines.push(`${indent}  <description>${this.raw(task.description)}</description>`);
      }
      const children = childrenOf(task.id);
      children.forEach(child => renderNode(child, indent + '  '));
      lines.push(`${indent}</node>`);
    };

    roots.forEach(root => renderNode(root, '    '));
    lines.push('  </task_tree>');
    return lines.join('\n');
  }

  private buildSessionContext(manifest: MaestroManifest): string | null {
    const projectId = manifest.tasks[0]?.projectId;
    const sessionId = process.env.MAESTRO_SESSION_ID;

    if (!sessionId && !projectId && !manifest.coordinatorSessionId) return null;

    const lines: string[] = ['  <session_context>'];
    if (sessionId) {
      lines.push(`    <session_id>${this.esc(sessionId)}</session_id>`);
    }
    if (manifest.coordinatorSessionId) {
      lines.push(`    <coordinator_session_id>${this.esc(manifest.coordinatorSessionId)}</coordinator_session_id>`);
    }
    if (projectId) {
      lines.push(`    <project_id>${this.esc(projectId)}</project_id>`);
    }
    lines.push(`    <mode>${manifest.mode}</mode>`);
    lines.push('  </session_context>');
    return lines.join('\n');
  }

  private buildCoordinatorDirective(manifest: MaestroManifest): string | null {
    if (!manifest.initialDirective) return null;

    const lines: string[] = ['  <coordinator_directive>'];
    lines.push(`    <subject>${this.raw(manifest.initialDirective.subject)}</subject>`);
    lines.push(`    <message>${this.raw(manifest.initialDirective.message)}</message>`);
    lines.push('  </coordinator_directive>');
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
      lines.push(`      <architecture>${this.raw(ctx.architecture)}</architecture>`);
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

  private buildTeamMembers(teamMembers?: TeamMemberData[], mode?: AgentMode, manifest?: MaestroManifest): string | null {
    if (!teamMembers || teamMembers.length === 0) return null;

    // Filter out team members that form this agent's own identity
    const selfIds = new Set<string>();
    if (manifest?.teamMemberId) selfIds.add(manifest.teamMemberId);
    if (manifest?.teamMemberProfiles) {
      for (const p of manifest.teamMemberProfiles) selfIds.add(p.id);
    }
    const visibleMembers = selfIds.size > 0
      ? teamMembers.filter(m => !selfIds.has(m.id))
      : teamMembers;

    if (visibleMembers.length === 0) return null;

    const lines: string[] = [`  <team_members count="${visibleMembers.length}">`];
    for (const member of visibleMembers) {
      if (mode === 'coordinate') {
        // Coordinators need full member details for spawning and delegation
        lines.push(`    <team_member id="${this.esc(member.id)}" name="${this.esc(member.name)}" role="${this.esc(member.role)}">`);
        lines.push(`      <avatar>${this.esc(member.avatar)}</avatar>`);
        lines.push(`      <mail_id>${this.esc(member.mailId)}</mail_id>`);
        if (member.model) {
          lines.push(`      <model>${this.esc(member.model)}</model>`);
        }
        if (member.agentTool) {
          lines.push(`      <agent_tool>${this.esc(member.agentTool)}</agent_tool>`);
        }
        lines.push('    </team_member>');
      } else {
        // Workers only need a slim roster for communication (name + mail_id)
        lines.push(`    <team_member name="${this.esc(member.name)}" role="${this.esc(member.role)}" mail_id="${this.esc(member.mailId)}" />`);
      }
    }
    lines.push('  </team_members>');
    return lines.join('\n');
  }

  private buildWorkflow(mode: AgentMode, manifest?: MaestroManifest): string {
    // Multi-identity: merge workflows from all profiles
    if (manifest?.teamMemberProfiles && manifest.teamMemberProfiles.length > 1) {
      const allPhases: { name: string; description: string }[] = [];
      const seenPhaseNames = new Set<string>();

      for (const profile of manifest.teamMemberProfiles) {
        if (profile.customWorkflow) {
          // Custom freeform — add as a single phase
          const phaseName = `custom_${profile.name.toLowerCase().replace(/\s+/g, '_')}`;
          if (!seenPhaseNames.has(phaseName)) {
            allPhases.push({ name: phaseName, description: profile.customWorkflow });
            seenPhaseNames.add(phaseName);
          }
        } else if (profile.workflowTemplateId) {
          const template = getWorkflowTemplate(profile.workflowTemplateId);
          if (template) {
            for (const phase of template.phases) {
              if (!seenPhaseNames.has(phase.name)) {
                allPhases.push({ name: phase.name, description: phase.instruction });
                seenPhaseNames.add(phase.name);
              }
            }
          }
        }
      }

      // If we collected phases from profiles, use them; otherwise fall through to defaults
      if (allPhases.length > 0) {
        const lines = ['  <workflow>'];
        for (let i = 0; i < allPhases.length; i++) {
          const phase = allPhases[i];
          lines.push(`    <phase name="${phase.name}" order="${i + 1}">${phase.description}</phase>`);
        }
        lines.push('  </workflow>');
        return lines.join('\n');
      }
      // Fall through to default mode-based workflow
    }

    // Phase 3: Check for custom workflow or template from team member (singular)
    if (manifest?.teamMemberCustomWorkflow) {
      const lines = ['  <workflow>'];
      lines.push(`    ${manifest.teamMemberCustomWorkflow}`);
      lines.push('  </workflow>');
      return lines.join('\n');
    }

    if (manifest?.teamMemberWorkflowTemplateId) {
      const template = getWorkflowTemplate(manifest.teamMemberWorkflowTemplateId);
      if (template) {
        const lines = ['  <workflow>'];
        for (let i = 0; i < template.phases.length; i++) {
          const phase = template.phases[i];
          const order = phase.order ?? (i + 1);
          lines.push(`    <phase name="${phase.name}" order="${order}">${phase.instruction}</phase>`);
        }
        lines.push('  </workflow>');
        return lines.join('\n');
      }
    }

    // Default: compute from mode
    const phases = this.getWorkflowPhases(mode);
    const lines = ['  <workflow>'];
    for (const phase of phases) {
      lines.push(`    <phase name="${phase.name}" order="${phase.order}">${phase.description}</phase>`);
    }
    lines.push('  </workflow>');
    return lines.join('\n');
  }

  /**
   * Default workflow phases by mode.
   * Custom workflows are handled via team member workflow templates.
   */
  private getWorkflowPhases(mode: AgentMode): { name: string; description: string; order: number }[] {
    if (mode === 'execute') {
      return [
        {
          name: 'init',
          order: 1,
          description:
            'Read your assigned tasks in the <tasks> block.\n' +
            'If a <reference_tasks> block is present, you MUST first fetch each reference task and its docs BEFORE starting work:\n' +
            '  1. maestro task get <refTaskId>  — read the reference task details\n' +
            '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
            'Reference task docs contain critical context, examples, or prior work. Read them thoroughly.\n' +
            'If a <coordinator_directive> is present, read it carefully — it contains your coordinator\'s specific instructions.\n' +
            'Check `maestro mail inbox` for any initial messages from your coordinator.',
        },
        {
          name: 'execute',
          order: 2,
          description:
            'Work through each task directly — do not decompose or delegate.\n' +
            'IMPORTANT: Before starting each task, check for new directives from your coordinator:\n' +
            '  maestro mail inbox\n' +
            'If you receive a directive that changes your priorities or approach, adjust accordingly.\n' +
            'If blocked, notify your coordinator:\n' +
            '  maestro mail send --to-coordinator --type query --subject "<what you need>" --message "<details>"\n' +
            'Then wait for a response: maestro mail wait --timeout 30000\n' +
            'After completing each task, report it:\n' +
            '  maestro task report complete <taskId> "<summary of what was done>"',
        },
        {
          name: 'complete',
          order: 3,
          description:
            'When all tasks are done:\n' +
            '  maestro session report complete "<summary of all work completed>"',
        },
      ];
    }

    // coordinate mode
    return [
      {
        name: 'analyze',
        order: 1,
        description:
          'Read all assigned tasks in the <tasks> block. Understand the requirements and acceptance criteria. ' +
          'If a <reference_tasks> block is present, first fetch each reference task and its docs:\n' +
          '  1. maestro task get <refTaskId>  — read the reference task details\n' +
          '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
          'Reference task docs provide critical context for planning. ' +
          'You must decompose and delegate — do NOT do them yourself.',
      },
      {
        name: 'decompose',
        order: 2,
        description:
          'Break tasks into small subtasks, each completable by a single worker:\n' +
          '  maestro task create "<title>" -d "<description with acceptance criteria>" --priority <high|medium|low> --parent <parentTaskId>',
      },
      {
        name: 'spawn',
        order: 3,
        description:
          'Spawn worker sessions for subtasks. IMPORTANT: Include an initial directive with each spawn using --subject and --message. ' +
          'This ensures workers receive instructions BEFORE they start working:\n' +
          '  maestro session spawn --task <subtaskId> --subject "<clear directive>" --message "<detailed instructions, context, and guidance>" [--team-member-id <tmId>] [--agent-tool <claude-code|codex|gemini>] [--model <model>]\n' +
          'You can spawn multiple workers in parallel — do NOT wait for each to finish before spawning the next.\n' +
          'Collect all session IDs for monitoring.',
      },
      {
        name: 'monitor',
        order: 4,
        description:
          'Monitor workers using an event-driven loop (do NOT poll on a timer):\n' +
          '  1. maestro mail wait --timeout 60000     — block until a worker message arrives\n' +
          '  2. maestro mail inbox                    — read ALL pending messages\n' +
          '  3. maestro task children <parentTaskId>  — check subtask statuses\n' +
          '  4. React to each message:\n' +
          '     - status_update → acknowledge, adjust plan if needed\n' +
          '     - query → answer via maestro mail reply <mailId> --message "<answer>"\n' +
          '     - blocked → investigate and send a directive to unblock\n' +
          '  5. Repeat until all subtasks are completed\n' +
          'If a worker goes silent for too long, send a status query:\n' +
          '  maestro mail send <sessionId> --type query --subject "Status check" --message "Please report your current progress."',
      },
      {
        name: 'recover',
        order: 5,
        description:
          'If a worker fails or reports blocked:\n' +
          '  1. Diagnose: maestro task get <taskId> — read error details\n' +
          '  2. Decide: Can the worker be unblocked with a directive, or does the task need re-spawning?\n' +
          '  3. Unblock: maestro mail send <sessionId> --type directive --subject "<guidance>" --message "<specific fix instructions>"\n' +
          '  4. Re-spawn if needed: maestro session spawn --task <taskId> --subject "<new approach>" --message "<revised instructions>" [--team-member-id <tmId>]\n' +
          '  5. If the issue is systemic, adjust remaining subtasks before proceeding.',
      },
      {
        name: 'verify',
        order: 6,
        description:
          'After workers finish, verify all subtask statuses:\n' +
          '  maestro task children <parentTaskId>\n' +
          'Ensure all are completed. Retry any failures or report blocked if unresolvable.',
      },
      {
        name: 'complete',
        order: 7,
        description:
          'When all subtasks are done:\n' +
          '  maestro task report complete <parentTaskId> "<summary>"\n' +
          '  maestro session report complete "<overall summary>"',
      },
    ];
  }

  private buildCommandsReference(mode: AgentMode): string {
    const lines = ['  <commands_reference>'];
    lines.push('    ## Maestro Commands');
    lines.push('    maestro {whoami|status|commands} — Core utilities');
    lines.push('    maestro task {list|get|create|edit|delete|children} — Task management');
    lines.push('    maestro task report {progress|complete|blocked|error} — Task report');
    lines.push('    maestro task docs {add|list} — Task docs');
    lines.push('    maestro session {info} — Session management');
    lines.push('    maestro session report {progress|complete|blocked|error} — Session report');
    lines.push('    maestro session docs {add|list} — Session docs');
    lines.push('    maestro show {modal} — UI display');
    lines.push('    maestro modal {events} — Modal interaction');

    // Mail commands - available for both modes
    lines.push('    maestro mail send [<sessionId>,...] --type <type> --subject "<subject>" [--message "<msg>"] [--to-team-member <tmId>] — Send mail');
    lines.push('    maestro mail inbox [--type <type>] — Check inbox');
    lines.push('    maestro mail reply <mailId> --message "<msg>" — Reply to mail');
    lines.push('    maestro mail wait [--timeout <ms>] — Wait for new mail');

    if (mode === 'coordinate') {
      lines.push('    maestro session {list|spawn} — Session coordination');
      lines.push('    maestro session spawn --task <id> [--subject "<directive>"] [--message "<instructions>"] [--team-member-id <tmId>] — Spawn with initial directive');
      lines.push('    maestro mail broadcast --type <type> --subject "<subject>" [--message "<msg>"] — Broadcast to all');
    }

    lines.push('    Run `maestro commands` for full syntax reference.');
    lines.push('  </commands_reference>');
    return lines.join('\n');
  }

  // ── Formatting helpers ───────────────────────────────────────

  formatAcceptanceCriteria(criteria?: string[]): string | null {
    if (!criteria || criteria.length === 0) {
      return null;
    }
    // Filter out generic placeholder strings that add no value
    const PLACEHOLDER_PATTERNS = [
      'task completion as described',
      'complete the task',
      'as described',
      'n/a',
      'none',
      'tbd',
    ];
    const meaningful = criteria.filter(c => {
      const lower = c.trim().toLowerCase();
      return lower.length > 0 && !PLACEHOLDER_PATTERNS.includes(lower);
    });
    if (meaningful.length === 0) {
      return null;
    }
    if (meaningful.length === 1) {
      return meaningful[0];
    }
    return meaningful.map((c, i) => `${i + 1}. ${c}`).join('\n');
  }

  /**
   * Escape XML special characters in attribute values and short structured fields.
   * NOT for freeform text content (identity, descriptions) — use raw() for those.
   */
  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Pass through freeform text content as-is (no escaping).
   * Used for identity instructions, task descriptions, workflow phases, etc.
   * LLMs read these as natural text — escaping makes them harder to parse.
   */
  private raw(str: string): string {
    return str;
  }
}
