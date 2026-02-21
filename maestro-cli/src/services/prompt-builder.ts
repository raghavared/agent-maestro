import type {
  MaestroManifest,
  CodebaseContext,
  RelatedTask,
  ProjectStandards,
  TaskData,
  AgentMode,
  TeamMemberData,
  MasterProjectInfo,
} from '../types/manifest.js';
import { isWorkerMode, isCoordinatorMode } from '../types/manifest.js';
import {
  WORKER_PROFILE,
  COORDINATOR_PROFILE,
  COORDINATED_WORKER_PROFILE,
  COORDINATED_COORDINATOR_PROFILE,
  WORKER_IDENTITY_INSTRUCTION,
  COORDINATOR_IDENTITY_INSTRUCTION,
  COORDINATED_WORKER_IDENTITY_INSTRUCTION,
  COORDINATED_COORDINATOR_IDENTITY_INSTRUCTION,
  buildMultiIdentityInstruction,
  ACCEPTANCE_CRITERIA_PLACEHOLDER_PATTERNS,
} from '../prompts/index.js';

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
    // Master project context (if this is a master session)
    const masterContext = this.buildMasterProjectContext(manifest);
    if (masterContext) parts.push(masterContext);
    // Note: commands_reference is injected by WhoamiRenderer.renderSystemPrompt()
    // using the dynamic compact command brief from command-permissions.ts.
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

    // Master project context (if this is a master session)
    const xmlMasterContext = this.buildMasterProjectContext(manifest);
    if (xmlMasterContext) parts.push(xmlMasterContext);

    parts.push('</maestro_prompt>');

    return parts.join('\n');
  }

  // ── Internal builders ────────────────────────────────────────

  private buildIdentity(mode: AgentMode, manifest?: MaestroManifest): string {
    const lines = ['  <identity>'];

    // Four-mode profile and identity selection
    const profileMap: Record<string, string> = {
      'worker': WORKER_PROFILE,
      'coordinator': COORDINATOR_PROFILE,
      'coordinated-worker': COORDINATED_WORKER_PROFILE,
      'coordinated-coordinator': COORDINATED_COORDINATOR_PROFILE,
    };
    const identityMap: Record<string, string> = {
      'worker': WORKER_IDENTITY_INSTRUCTION,
      'coordinator': COORDINATOR_IDENTITY_INSTRUCTION,
      'coordinated-worker': COORDINATED_WORKER_IDENTITY_INSTRUCTION,
      'coordinated-coordinator': COORDINATED_COORDINATOR_IDENTITY_INSTRUCTION,
    };

    const profile = profileMap[mode] || (isWorkerMode(mode) ? WORKER_PROFILE : COORDINATOR_PROFILE);
    const instruction = identityMap[mode] || (isWorkerMode(mode) ? WORKER_IDENTITY_INSTRUCTION : COORDINATOR_IDENTITY_INSTRUCTION);

    lines.push(`    <profile>${profile}</profile>`);
    lines.push(`    <instruction>${instruction}</instruction>`);

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

      // P1.3: Combined name from all profiles; use first avatar
      const combinedName = profiles.map(p => p.name).join(' + ');
      // P1.5: Use roles (not names) for the expertise instruction
      const roleList = profiles.map(p => p.role || p.name).join(', ');

      const lines = ['  <team_member_identity>'];
      lines.push(`    <name>${this.esc(combinedName)}</name>`);
      lines.push(`    <avatar>${this.esc(profiles[0].avatar)}</avatar>`);
      // P3.1: Combined role element
      lines.push(`    <role>${this.esc(roleList)}</role>`);
      lines.push(`    <instructions>${buildMultiIdentityInstruction(roleList)}</instructions>`);
      for (const profile of profiles) {
        lines.push(`    <expertise source="${this.esc(profile.name)}">${this.raw(profile.identity)}</expertise>`);
      }
      // Add team member expertise blocks if this is a coordinator
      if (isCoordinatorMode(manifest.mode) && manifest.teamMembers) {
        const selfIds = new Set<string>();
        if (manifest.teamMemberId) {
          selfIds.add(manifest.teamMemberId);
        }
        if (manifest.teamMemberProfiles) {
          for (const p of manifest.teamMemberProfiles) {
            if (p.id) selfIds.add(p.id);
          }
        }
        for (const member of manifest.teamMembers) {
          if (selfIds.has(member.id)) continue;
          if (!member.identity) continue;
          lines.push(`    <expertise source="${this.esc(member.name)}">${this.raw(member.identity)}</expertise>`);
        }
      }
      // Merge memory from all profiles with source attribution (P1.6)
      const allMemory = profiles.flatMap(p => (p.memory || []).map(m => ({ source: p.name, text: m })));
      if (allMemory.length > 0) {
        lines.push('    <memory>');
        for (const entry of allMemory) {
          lines.push(`      <entry source="${this.esc(entry.source)}">${this.raw(entry.text)}</entry>`);
        }
        lines.push('    </memory>');
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
      // P3.1: Add role element
      if (profile.role) {
        lines.push(`    <role>${this.esc(profile.role)}</role>`);
      }
      lines.push(`    <instructions>${this.raw(profile.identity)}</instructions>`);
      // Add team member expertise blocks if this is a coordinator
      if (isCoordinatorMode(manifest.mode) && manifest.teamMembers) {
        const selfIds = new Set<string>();
        if (manifest.teamMemberId) {
          selfIds.add(manifest.teamMemberId);
        }
        if (manifest.teamMemberProfiles) {
          for (const p of manifest.teamMemberProfiles) {
            if (p.id) selfIds.add(p.id);
          }
        }
        for (const member of manifest.teamMembers) {
          if (selfIds.has(member.id)) continue;
          if (!member.identity) continue;
          lines.push(`    <expertise source="${this.esc(member.name)}">${this.raw(member.identity)}</expertise>`);
        }
      }
      if (profile.memory && profile.memory.length > 0) {
        lines.push('    <memory>');
        for (const entry of profile.memory) {
          lines.push(`      <entry>${this.raw(entry)}</entry>`);
        }
        lines.push('    </memory>');
      }
      lines.push('  </team_member_identity>');
      return lines.join('\n');
    }

    // Original singular fields (backward compat)
    if (!manifest.teamMemberId || !manifest.teamMemberName) return null;
    if (manifest.teamMemberIdentity === undefined || manifest.teamMemberIdentity === null) return null;

    const lines = ['  <team_member_identity>'];
    lines.push(`    <name>${this.esc(manifest.teamMemberName)}</name>`);
    if (manifest.teamMemberAvatar) {
      lines.push(`    <avatar>${this.esc(manifest.teamMemberAvatar)}</avatar>`);
    }
    // P3.1: Add role element
    if (manifest.teamMemberRole) {
      lines.push(`    <role>${this.esc(manifest.teamMemberRole)}</role>`);
    }
    if (manifest.teamMemberIdentity) {
      lines.push(`    <instructions>${this.raw(manifest.teamMemberIdentity)}</instructions>`);
    }
    // Add team member expertise blocks if this is a coordinator
    if (isCoordinatorMode(manifest.mode) && manifest.teamMembers) {
      const selfIds = new Set<string>();
      if (manifest.teamMemberId) {
        selfIds.add(manifest.teamMemberId);
      }
      for (const member of manifest.teamMembers) {
        if (selfIds.has(member.id)) continue;
        if (!member.identity) continue;
        lines.push(`    <expertise source="${this.esc(member.name)}">${this.raw(member.identity)}</expertise>`);
      }
    }
    if (manifest.teamMemberMemory && manifest.teamMemberMemory.length > 0) {
      lines.push('    <memory>');
      for (const entry of manifest.teamMemberMemory) {
        lines.push(`      <entry>${this.raw(entry)}</entry>`);
      }
      lines.push('    </memory>');
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

    // Filter out team members that form this agent's own identity (P1.7: hardened)
    const selfIds = new Set<string>();
    // Always include singular teamMemberId if set
    if (manifest?.teamMemberId) {
      selfIds.add(manifest.teamMemberId);
    }
    // Include all profile IDs (defensive: skip falsy ids)
    if (manifest?.teamMemberProfiles) {
      for (const p of manifest.teamMemberProfiles) {
        if (p.id) selfIds.add(p.id);
      }
    }
    const visibleMembers = selfIds.size > 0
      ? teamMembers.filter(m => !selfIds.has(m.id))
      : teamMembers;

    if (visibleMembers.length === 0) return null;

    const lines: string[] = [`  <available_team_members count="${visibleMembers.length}">`];
    lines.push(`    <instruction>These are the team members available to you for spawning and delegation. Use their id with --team-member-id when spawning sessions.</instruction>`);
    for (const member of visibleMembers) {
      if (mode && isCoordinatorMode(mode)) {
        // Coordinators need full member details for spawning and delegation (P3.2: enriched)
        lines.push(`    <available_team_member id="${this.esc(member.id)}" name="${this.esc(member.name)}" role="${this.esc(member.role)}">`);
        lines.push(`      <avatar>${this.esc(member.avatar)}</avatar>`);
        if (member.mode) {
          lines.push(`      <mode>${this.esc(member.mode)}</mode>`);
        }
        if (member.permissionMode) {
          lines.push(`      <permission_mode>${this.esc(member.permissionMode)}</permission_mode>`);
        }
        if (member.model) {
          lines.push(`      <model>${this.esc(member.model)}</model>`);
        }
        if (member.agentTool) {
          lines.push(`      <agent_tool>${this.esc(member.agentTool)}</agent_tool>`);
        }
        if (member.capabilities && Object.keys(member.capabilities).length > 0) {
          lines.push('      <capabilities>');
          for (const [cap, enabled] of Object.entries(member.capabilities)) {
            lines.push(`        <capability name="${this.esc(cap)}" enabled="${enabled}" />`);
          }
          lines.push('      </capabilities>');
        }
        lines.push('    </available_team_member>');
      } else {
        // Workers need slim roster with ID for peer discovery (P3.3: added id)
        lines.push(`    <available_team_member id="${this.esc(member.id)}" name="${this.esc(member.name)}" role="${this.esc(member.role)}" />`);
      }
    }
    lines.push('  </available_team_members>');
    return lines.join('\n');
  }


  private buildMasterProjectContext(manifest: MaestroManifest): string | null {
    if (!manifest.isMaster) return null;

    const lines: string[] = ['  <master_project_context>'];
    lines.push('    <description>You are operating in a Master Project session. You have access to ALL projects in the workspace.</description>');

    if (manifest.masterProjects && manifest.masterProjects.length > 0) {
      lines.push('    <projects>');
      for (const p of manifest.masterProjects) {
        const attrs = [
          `id="${this.esc(p.id)}"`,
          `name="${this.esc(p.name)}"`,
          `workingDir="${this.esc(p.workingDir)}"`,
          ...(p.isMaster ? ['isMaster="true"'] : []),
        ].join(' ');
        if (p.description) {
          lines.push(`      <project ${attrs}>`);
          lines.push(`        <description>${this.esc(p.description)}</description>`);
          lines.push('      </project>');
        } else {
          lines.push(`      <project ${attrs} />`);
        }
      }
      lines.push('    </projects>');
    }

    lines.push('    <commands>');
    lines.push('      Use `maestro master projects` to list all projects.');
    lines.push('      Use `maestro master tasks --project &lt;id&gt;` to view tasks in any project.');
    lines.push('      Use `maestro master sessions --project &lt;id&gt;` to view sessions in any project.');
    lines.push('      Use `maestro master context` for a full workspace overview.');
    lines.push('    </commands>');
    lines.push('  </master_project_context>');
    return lines.join('\n');
  }

  // ── Formatting helpers ───────────────────────────────────────

  formatAcceptanceCriteria(criteria?: string[]): string | null {
    if (!criteria || criteria.length === 0) {
      return null;
    }
    // Filter out generic placeholder strings that add no value
    const PLACEHOLDER_PATTERNS = ACCEPTANCE_CRITERIA_PLACEHOLDER_PATTERNS;
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
