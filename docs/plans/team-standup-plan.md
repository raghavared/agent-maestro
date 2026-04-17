# Team Standup Feature — Design Plan

**Status: IMPLEMENTED**

## Overview

A "Team Standup" button in the team members panel that launches a session to audit, optimize, and evolve the team roster. The agent reviews all existing team members, removes redundant ones, merges duplicates, updates outdated identities, and creates new members if gaps are identified.

## Design Decisions (Confirmed)

1. **Confirmation required** — Agent presents diff-style report, waits for user approval before executing
2. **Opus model** — Better reasoning for team composition analysis
3. **Context-aware** — Reads codebase structure and task history to identify skill gaps
4. **Can modify defaults** — Via identity overrides, with before/after diffs shown
5. **Agent decides merge strategy** — Different scenarios handled differently; team member names are important
6. **Optional skill discovery** — At the end, agent can offer to discover/add new skills; skills accounted for during merges

---

## Current System Context

### How the Recruiter Works Today
- Default team member (`tm_{projectId}_recruiter`) with identity focused on **creating** new team members
- Permissions: `team-member:create`, `team-member:list`, `team-member:get`, `team-member:edit`
- Uses `find-skills` skill to discover and install skills
- Does NOT have archive/delete permissions — it only builds, doesn't prune

### How "Run" Works on a Team Member
1. `handleRun(member)` in `useTeamMemberActions.ts` creates a task: `"Session with {member.name}"`
2. Spawns a session via `onCreateMaestroSession({ task, project, mode, teamMemberId })`
3. Server creates session → generates manifest → emits spawn event → UI opens terminal

---

## Design Options

### Option A: New Default Team Member — "Standup Agent" (Recommended)

Add a 6th default team member alongside simple_worker, coordinator, batch_coordinator, dag_coordinator, and recruiter.

**Implementation:**
1. Add `DEFAULT_STANDUP` config in `FileSystemTeamMemberRepository.ts`
2. Register in `DEFAULT_CONFIGS` and `ALL_DEFAULT_TYPES`
3. Add "Team Standup" button in `PanelIconBar.tsx` or `TeamMembersPanel.tsx`
4. Button click → same flow as `handleRun(standupMember)`

**Agent Config:**
```typescript
const DEFAULT_STANDUP = {
  name: 'Standup',
  role: 'Team roster auditor and optimizer',
  avatar: '📋',
  model: 'sonnet', // or opus for better reasoning?
  agentTool: 'claude-code',
  mode: 'worker',
  skillIds: [],
  isDefault: true,
  status: 'active',
  capabilities: {
    can_spawn_sessions: false,
    can_edit_tasks: true,
    can_report_task_level: true,
    can_report_session_level: true,
  },
  commandPermissions: {
    commands: {
      'team-member:list': true,
      'team-member:get': true,
      'team-member:create': true,
      'team-member:edit': true,
      'team-member:archive': true,
      'team-member:delete': true,
      'team-member:memory:append': true,
      'team-member:memory:list': true,
      'team-member:memory:clear': true,
    },
  },
  workflowTemplateId: 'execute-standup',
};
```

**Pros:**
- Consistent with existing patterns (just another default member)
- User can customize identity/model via the Configure modal
- Reuses entire Run/spawn infrastructure unchanged
- Shows up in the team member list so users understand what it is

**Cons:**
- Adds another default member to the list (6 total)
- The "Team Standup" button is slightly redundant with the Run button on the Standup member

---

### Option B: Dedicated UI Action (No New Team Member)

The "Team Standup" button creates a task and session with an inline/ephemeral config. No new team member entity.

**Implementation:**
1. Add button in `TeamMembersPanel.tsx` or `PanelIconBar.tsx`
2. Create `handleTeamStandup()` function that:
   - Creates a task with a specific title + rich description containing the standup prompt
   - Spawns session with inline config (no teamMemberId, just mode + description)

**Pros:**
- Doesn't add another default member to the list
- Clean, single-purpose action

**Cons:**
- Breaks the pattern — every other session is tied to a team member
- No way for users to customize the standup agent's identity/model
- Requires special handling in the spawn flow for "no team member" sessions

---

### Option C: Extend the Recruiter

Repurpose/extend the Recruiter to handle both creation and auditing. The "Team Standup" button runs the Recruiter with a special task description.

**Implementation:**
1. Update Recruiter identity to include audit/optimization capabilities
2. Add archive/delete permissions to Recruiter
3. "Team Standup" button → `handleRun(recruiter)` with a custom task description

**Pros:**
- No new default member
- Recruiter already has team management DNA

**Cons:**
- Overloads the Recruiter's purpose (creation vs. auditing are different concerns)
- Users who run the Recruiter normally now get audit behavior mixed in
- Task description would need to be hardcoded differently from normal Run

---

## Recommendation: Option A

Option A is the cleanest because:
1. It follows the established pattern exactly
2. Each default member has a single, clear purpose
3. Users can customize it like any other member
4. The UI change is minimal — just a button that triggers `handleRun(standupMember)`

---

## Implementation Plan

### Phase 1: Server — Add Standup Default Member
**File: `maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts`**
- Add `DEFAULT_STANDUP` config with appropriate identity prompt and command permissions
- Add `'standup'` to `DefaultTeamMemberType` union and `ALL_DEFAULT_TYPES` array
- Register in `DEFAULT_CONFIGS`

**File: `maestro-server/src/types.ts`**
- Add `'standup'` to `DefaultTeamMemberType` if it's a union type there

### Phase 2: Craft the Standup Prompt
The identity prompt is the most critical piece. It needs to instruct the agent to:

1. **Audit**: List all team members, understand each one's role/identity/skills
2. **Analyze**: Identify redundancies, gaps, and optimization opportunities
3. **Plan**: Present a clear plan of proposed changes (create/update/archive/merge)
4. **Execute**: After presenting the plan, make the changes using CLI commands
5. **Report**: Summarize what was done

**Draft identity prompt:**
```
You are a team standup agent. Your job is to audit and optimize the current team roster.

Steps:
1. Run `maestro team-member list --all` to see all team members
2. For each custom (non-default) member, run `maestro team-member get <id>` to inspect their full config
3. Analyze the roster for:
   - Redundant members (similar role/identity, doing the same thing)
   - Outdated members (stale identity, skills no longer needed)
   - Missing capabilities (gaps in the team's skillset based on project context)
   - Members that could be merged (combine skills/identity into one)
4. Present a standup report with proposed changes:
   - Members to UPDATE (identity, skills, role improvements)
   - Members to ARCHIVE/DELETE (redundant or obsolete)
   - Members to MERGE (combine into one, archive the others)
   - NEW members to CREATE (fill identified gaps)
5. Execute the approved changes using:
   - `maestro team-member edit <id> ...` for updates
   - `maestro team-member archive <id>` then `maestro team-member delete <id>` for removals
   - `maestro team-member create ...` for new members
6. Report completion with a summary of all changes made.

Important:
- NEVER modify default team members (simple_worker, coordinator, batch_coordinator, dag_coordinator, recruiter, standup)
- Always present the plan BEFORE making changes
- When merging, pick the better member as the base, update it, and archive the other
- Consider the project's working directory and codebase when suggesting new members
```

### Phase 3: UI — Add Team Standup Button
**File: `maestro-ui/src/components/maestro/PanelIconBar.tsx`**
- Add a "Team Standup" button next to the existing "+ New Member" button
- Style it distinctly (e.g., different color or icon)

**File: `maestro-ui/src/hooks/useTeamMemberActions.ts`**
- Add `handleTeamStandup()` function that finds the standup member and calls `handleRun(standupMember)`

**File: `maestro-ui/src/components/maestro/TeamMembersPanel.tsx`**
- Wire the button to the handler

### Phase 4: UI Template (TeamMemberModal)
**File: `maestro-ui/src/components/maestro/TeamMemberModal.tsx`**
- Add `standup` to the default templates object so "Configure" works on it

---

## Clarifying Questions

### 1. Should the standup agent auto-execute changes or require confirmation?
- **Option A**: Present plan → wait for user approval in chat → execute (safer, more controlled)
- **Option B**: Present plan → execute immediately (faster, more autonomous)
- The current prompt draft uses "present plan then execute" — should it pause for approval?

### 2. What model should the standup agent use?
- **Sonnet**: Faster, cheaper, good enough for roster analysis
- **Opus**: Better reasoning about team composition and gaps, but slower/more expensive
- Default members all use sonnet currently

### 3. Should the standup consider project context when suggesting new members?
- **Minimal**: Only look at existing team members and optimize them
- **Context-aware**: Read the project's codebase/task history to identify skill gaps and suggest new members for unaddressed needs
- Context-aware is more useful but makes the standup longer and more complex

### 4. Should the standup agent be allowed to modify default members?
- Current plan: NO — defaults are code-defined and should stay pristine
- Alternative: Allow updating identity overrides on defaults (via `.override.json`)
- This matters because users might have customized defaults that are now stale

### 5. How should "merge" work technically?
- **Option A**: Edit the "better" member with combined attributes, archive the other
- **Option B**: Create a new member with combined attributes, archive both originals
- Option A preserves history/memory of the surviving member

### 6. Should the standup agent have access to `find-skills` like the Recruiter?
- If yes: It can discover and assign new skills during the standup
- If no: It only optimizes what's already there (simpler, faster)

### 7. Where should the button be placed?
- **Option A**: In `PanelIconBar.tsx` next to "+ New Member" (always visible)
- **Option B**: As a section header action in `TeamMemberList.tsx` (contextual)
- **Option C**: As a dropdown/menu item under the team tab

### 8. Should this be visible to all projects or only configurable per-project?
- The standup member is project-scoped by default (each project gets its own)
- Should there be a global standup option?
