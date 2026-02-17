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
    // Team members (coordinate mode)
    const teamMembers = this.buildTeamMembers(manifest.teamMembers);
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

    // Context
    const context = this.buildContext(manifest);
    if (context) parts.push(context);

    // Skills
    if (manifest.skills && manifest.skills.length > 0) {
      parts.push(this.buildSkills(manifest.skills));
    }

    // Team members (coordinate mode)
    const xmlTeamMembers = this.buildTeamMembers(manifest.teamMembers);
    if (xmlTeamMembers) parts.push(xmlTeamMembers);

    // Workflow
    parts.push(this.buildWorkflow(mode, manifest));

    parts.push('</maestro_prompt>');

    return parts.join('\n');
  }

  // ── Internal builders ────────────────────────────────────────

  private buildIdentity(mode: AgentMode, manifest?: MaestroManifest): string {
    const lines = ['  <identity>'];
    lines.push('    <profile>maestro-agent</profile>');
    if (mode === 'execute') {
      lines.push('    <instruction>You are a worker agent. You complete assigned tasks directly. Report progress, blockers, and completion using Maestro CLI commands. Follow the workflow phases in order.</instruction>');
    } else {
      lines.push('    <instruction>You are a coordinator agent. You NEVER do tasks directly. Your job is to decompose tasks into subtasks, spawn worker sessions, monitor their progress, and report results. Follow the workflow phases in order.</instruction>');
    }
    if (manifest) {
      if (manifest.agentTool) {
        lines.push(`    <agent_tool>${this.esc(manifest.agentTool)}</agent_tool>`);
      }
      if (manifest.session?.model) {
        lines.push(`    <model>${this.esc(manifest.session.model)}</model>`);
      }
      const projectId = manifest.tasks[0]?.projectId;
      if (projectId) {
        lines.push(`    <project_id>${this.esc(projectId)}</project_id>`);
      }
    }
    lines.push('  </identity>');
    return lines.join('\n');
  }

  private buildTeamMemberIdentity(manifest: MaestroManifest): string | null {
    // Multi-identity: if teamMemberProfiles has multiple entries, render all
    if (manifest.teamMemberProfiles && manifest.teamMemberProfiles.length > 1) {
      const profiles = manifest.teamMemberProfiles.filter(p => p.identity);
      if (profiles.length === 0) return null;

      const lines = [`  <team_member_identities count="${profiles.length}">`];
      lines.push('    <instruction>You are assuming all the following identities simultaneously. Draw on the combined expertise, perspectives, and domain knowledge of each identity when executing your tasks.</instruction>');
      for (const profile of profiles) {
        lines.push(`    <team_member_identity name="${this.esc(profile.name)}" avatar="${this.esc(profile.avatar)}">`);
        lines.push(`      <instructions>${this.esc(profile.identity)}</instructions>`);
        lines.push('    </team_member_identity>');
      }
      lines.push('  </team_member_identities>');
      return lines.join('\n');
    }

    // Single identity (backward compat): check singular fields or single-element profiles array
    if (manifest.teamMemberProfiles && manifest.teamMemberProfiles.length === 1) {
      const profile = manifest.teamMemberProfiles[0];
      if (!profile.identity) return null;
      const lines = ['  <team_member_identity>'];
      lines.push(`    <name>${this.esc(profile.name)}</name>`);
      lines.push(`    <avatar>${this.esc(profile.avatar)}</avatar>`);
      lines.push(`    <instructions>${this.esc(profile.identity)}</instructions>`);
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
      lines.push(`    <instructions>${this.esc(manifest.teamMemberIdentity)}</instructions>`);
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
      lines.push(`      <description>${this.esc(t.description)}</description>`);
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

  private buildTeamMembers(teamMembers?: TeamMemberData[]): string | null {
    if (!teamMembers || teamMembers.length === 0) return null;

    const lines: string[] = [`  <team_members count="${teamMembers.length}">`];
    for (const member of teamMembers) {
      lines.push(`    <team_member id="${this.esc(member.id)}" name="${this.esc(member.name)}" role="${this.esc(member.role)}">`);
      lines.push(`      <identity>${this.esc(member.identity)}</identity>`);
      lines.push(`      <avatar>${this.esc(member.avatar)}</avatar>`);
      lines.push(`      <mail_id>${this.esc(member.mailId)}</mail_id>`);
      if (member.model) {
        lines.push(`      <model>${this.esc(member.model)}</model>`);
      }
      if (member.agentTool) {
        lines.push(`      <agent_tool>${this.esc(member.agentTool)}</agent_tool>`);
      }
      lines.push('    </team_member>');
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
        for (const phase of allPhases) {
          lines.push(`    <phase name="${phase.name}">${phase.description}</phase>`);
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
        for (const phase of template.phases) {
          lines.push(`    <phase name="${phase.name}">${phase.instruction}</phase>`);
        }
        lines.push('  </workflow>');
        return lines.join('\n');
      }
    }

    // Default: compute from mode
    const phases = this.getWorkflowPhases(mode);
    const lines = ['  <workflow>'];
    for (const phase of phases) {
      lines.push(`    <phase name="${phase.name}">${phase.description}</phase>`);
    }
    lines.push('  </workflow>');
    return lines.join('\n');
  }

  /**
   * Default workflow phases by mode.
   * Custom workflows are handled via team member workflow templates.
   */
  private getWorkflowPhases(mode: AgentMode): { name: string; description: string }[] {
    if (mode === 'execute') {
      return [
        {
          name: 'execute',
          description:
            'Read your assigned tasks in the <tasks> block. Work through each task directly — do not decompose or delegate.\n' +
            'After completing each task (or major sub-step), check your mailbox for directives:\n' +
            '  maestro mail inbox\n' +
            'Mail types you may receive: "directive" (instructions to follow), "query" (questions to answer), "status" (informational).\n' +
            'If you receive a directive, prioritize it over current work. For queries, respond using:\n' +
            '  maestro mail reply <mailId> --message "<response>"\n' +
            'If no mail is present, continue with your tasks.',
        },
        {
          name: 'report',
          description:
            'After each meaningful milestone, report progress:\n' +
            '  maestro session report progress "<what you accomplished>"\n' +
            'If blocked: maestro session report blocked "<reason>"',
        },
        {
          name: 'complete',
          description:
            'When all tasks are done:\n' +
            '  maestro session report complete "<summary>"',
        },
      ];
    }

    // coordinate mode
    return [
      {
        name: 'analyze',
        description:
          'Read all assigned tasks in the <tasks> block. Understand the requirements and acceptance criteria. ' +
          'You must decompose and delegate — do NOT do them yourself.',
      },
      {
        name: 'decompose',
        description:
          'Break tasks into small subtasks, each completable by a single worker:\n' +
          '  maestro task create "<title>" -d "<description with acceptance criteria>" --priority <high|medium|low> --parent <parentTaskId>',
      },
      {
        name: 'spawn',
        description:
          'Spawn worker sessions for subtasks. You can spawn multiple workers in parallel — do NOT wait for each to finish before spawning the next:\n' +
          '  maestro session spawn --task <subtaskId> [--team-member-id <tmId>] [--agent-tool <claude-code|codex|gemini>] [--model <model>]\n' +
          'Collect all session IDs for monitoring.',
      },
      {
        name: 'monitor',
        description:
          'Watch spawned sessions:\n' +
          '  maestro session watch <id1>,<id2>,...\n' +
          'If a worker is BLOCKED, investigate with `maestro task get <taskId>` and review session docs.\n' +
          'You can send directives to running workers via mail:\n' +
          '  maestro mail send <sessionId> --type directive --subject "<subject>" --message "<instructions>"\n' +
          '  maestro mail send --to-team-member <tmId> --type directive --subject "<subject>" --message "<instructions>"\n' +
          'Check your own inbox for status updates from workers:\n' +
          '  maestro mail inbox',
      },
      {
        name: 'recover',
        description:
          'If a worker fails or reports blocked:\n' +
          '  1. Check the error: maestro task get <taskId>\n' +
          '  2. Review session docs: maestro session docs list\n' +
          '  3. Either re-spawn the task with a different approach or reassign to another team member:\n' +
          '     maestro session spawn --task <taskId> [--team-member-id <tmId>]\n' +
          '  4. If the issue is systemic, adjust remaining subtasks before proceeding.',
      },
      {
        name: 'verify',
        description:
          'After workers finish, check subtask statuses with `maestro task children <parentTaskId>`. ' +
          'Retry failures or report blocked.',
      },
      {
        name: 'complete',
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
      lines.push('    maestro session {list|watch|spawn} — Session coordination');
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
    if (criteria.length === 1) {
      return criteria[0];
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
