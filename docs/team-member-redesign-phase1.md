# Team Member Redesign - Phase 1: Core Model + Task Assignment + Wiring

## Context

The current system has a split model where "team members" (Worker, Coordinator) exist as entities, but launching a task still relies on separate `mode` + `strategy` parameters passed through the spawn flow. The SplitPlayButton shows hardcoded Worker/Coordinator sections with strategy sub-menus. The `onWorkOnWithTeamMember` callback in TaskListItem is not wired up in MaestroPanel.

**Goal**: Make team members the single source of truth for how a task gets executed. A team member encapsulates mode, strategy, identity, model, and agent tool. Tasks get assigned a team member, and launching uses that assignment.

## Architecture Decisions

- **`mode` and `strategy` become fields on TeamMember** - stored on the entity, used by manifest generator
- **Strategy is also reflected in identity prompt** - the identity instructions describe behavioral strategy, but mode/strategy fields gate capabilities/commands/workflow programmatically
- **5 default team members** replace the previous 2 (Worker + Coordinator)
- **`teamMemberId` added to Task** - each task stores its assigned team member
- **SplitPlayButton becomes a team member picker** - clicking a member assigns it to the task; play button launches with the assigned member

## Files to Modify

### Server Types
- **`maestro-server/src/types.ts`**
  - Add `mode?: AgentMode` and `strategy?: string` to `TeamMember` interface (lines 82-96)
  - Add `mode` and `strategy` to `CreateTeamMemberPayload` (lines 106-115)
  - Add `mode` and `strategy` to `UpdateTeamMemberPayload` (lines 117-126)
  - Add `teamMemberId?: string` to `Task` interface (after line 161)
  - Add `teamMemberId?: string` to `CreateTaskPayload` (after line 254)
  - Add `teamMemberId?: string` to `UpdateTaskPayload` (after line 276)

### UI Types
- **`maestro-ui/src/app/types/maestro.ts`**
  - Mirror all the above type changes
  - Add `mode?: AgentMode` and `strategy?: string` to `TeamMember` (lines 26-40)
  - Add `teamMemberId?: string` to `MaestroTask` (after line 204)
  - Add to `CreateTaskPayload`, `UpdateTaskPayload`
  - Add to `CreateTeamMemberPayload`, `UpdateTeamMemberPayload`

### Default Team Members
- **`maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts`**
  - Expand from 2 defaults to 5 (lines 12-37)
  - New defaults:
    1. **Simple Worker** - `tm_{projectId}_simple_worker`, avatar `⚡`, mode=execute, strategy=simple
    2. **Queue Worker** - `tm_{projectId}_queue_worker`, avatar `📋`, mode=execute, strategy=queue
    3. **Default Coordinator** - `tm_{projectId}_coordinator`, avatar `🎯`, mode=coordinate, strategy=default
    4. **Batch Coordinator** - `tm_{projectId}_batch_coordinator`, avatar `📦`, mode=coordinate, strategy=intelligent-batching
    5. **DAG Coordinator** - `tm_{projectId}_dag_coordinator`, avatar `🔀`, mode=coordinate, strategy=dag
  - Update `getDefaultId()` to handle 5 types
  - Update `createDefaultTeamMember()` for 5 types
  - Update `findByProjectId()` to return all 5 defaults

### Task Repository
- **`maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts`**
  - Add `teamMemberId` to `create()` method (line ~114)
  - Add `teamMemberId` update handling in `update()` method (line ~210)

### SplitPlayButton Redesign
- **`maestro-ui/src/components/maestro/SplitPlayButton.tsx`**
  - Remove hardcoded WORKER_STRATEGIES and COORDINATOR_STRATEGIES
  - Change to flat list of all team members
  - Each member shows: avatar + name + mode badge (execute/coordinate)
  - Clicking a member calls `onSelectTeamMember(teamMemberId)` instead of launching
  - Show current assigned member's avatar on the play button
  - Keep "+ New Team Member..." at bottom (opens create modal)
  - New props: `assignedTeamMemberId?: string`, `onSelectTeamMember?: (id: string) => void`

### MaestroPanel Wiring
- **`maestro-ui/src/components/maestro/MaestroPanel.tsx`**
  - Wire up `onWorkOnWithTeamMember` in `renderTaskNode` (line ~513)
  - Create `handleWorkOnWithTeamMember(taskId, teamMemberId)` that:
    1. Fetches team member from store
    2. Calls `onCreateMaestroSession` with member's mode, strategy, teamMemberId
  - Create `handleAssignTeamMember(taskId, teamMemberId)` that:
    1. Calls `updateTask(taskId, { teamMemberId })`
  - Update `handleWorkOnTask` to read task's `teamMemberId` and use that member's mode/strategy
  - Pass team member assignment handler to SplitPlayButton

### CreateTeamMemberModal
- **`maestro-ui/src/components/maestro/CreateTeamMemberModal.tsx`**
  - Add mode selector (Worker / Orchestrator segmented control)
  - When mode changes, update default strategy accordingly
  - Include mode and strategy in CreateTeamMemberPayload

### EditTeamMemberModal
- **`maestro-ui/src/components/maestro/EditTeamMemberModal.tsx`**
  - Show mode as read-only badge for defaults
  - Allow mode change for custom members
  - Display strategy info

### Spawn Flow Updates
- **`maestro-ui/src/services/maestroService.ts`**
  - Update `createMaestroSession` to accept `teamMemberId` and pass it through
  - When teamMemberId is provided, use the team member's mode/strategy

- **`maestro-server/src/api/sessionRoutes.ts`**
  - Accept `teamMemberId` in spawn payload (already partially supported)
  - When `teamMemberId` is provided, fetch the team member and use its mode/strategy as defaults (override only if explicitly passed)

- **`maestro-cli/src/commands/manifest-generator.ts`**
  - When `teamMemberId` is provided, fetch member and use its mode/strategy for manifest generation
  - Already fetches identity/name/avatar (lines 245-256), just need to also use mode/strategy

- **`maestro-cli/src/types/manifest.ts`**
  - No changes needed (already has teamMember fields)

### Store Updates
- **`maestro-ui/src/stores/useMaestroStore.ts`**
  - Ensure `updateTask` properly handles `teamMemberId` field

## Spawn Flow (After Changes)

```
User clicks Play on task
  → Read task.teamMemberId (default: simple worker ID)
  → Fetch team member from store
  → Call createMaestroSession({
      task, project,
      mode: teamMember.mode,
      strategy: teamMember.strategy,
      teamMemberId: teamMember.id,
      model: teamMember.model || task.model,
      agentTool: teamMember.agentTool || task.agentTool,
    })
  → POST /sessions/spawn with mode, strategy, teamMemberId
  → Server generates manifest with team member's mode/strategy/identity
  → CLI builds prompts with correct workflow/capabilities/commands
```

## Testing

1. Verify 5 default team members appear in Team Members list
2. Verify SplitPlayButton shows flat list of all members
3. Verify clicking a member in dropdown assigns it to the task
4. Verify play button launches with assigned member's mode/strategy
5. Verify task row shows assigned member's avatar
6. Verify CreateTeamMemberModal has mode selector
7. Verify custom team members with mode=coordinate can spawn sessions
