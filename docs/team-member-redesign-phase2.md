# Team Member Redesign - Phase 2: Capability & Command Permission Customization

## Context

Phase 1 established team members as the primary execution unit with mode/strategy fields. Phase 2 makes capabilities and command permissions configurable per team member, allowing fully modular agents.

**Prerequisite**: Phase 1 must be complete. Team members have `mode`, `strategy`, `identity`, `model`, `agentTool` fields.

**Goal**: Let users configure which capabilities and commands each team member has access to. Currently these are computed programmatically from mode+strategy in `manifest.ts:computeCapabilities()` and `command-permissions.ts`. Phase 2 makes them storable per team member and editable in the UI.

## Current System (Pre-Phase 2)

### Capabilities
Computed in `maestro-cli/src/types/manifest.ts` → `computeCapabilities(mode, strategy)`:
- `can_spawn_sessions`: true only if mode === 'coordinate'
- `can_use_queue`: true only if mode === 'execute' AND strategy === 'queue'
- `can_edit_tasks`: always true
- `can_report_task_level`: always true
- `can_report_session_level`: always true

### Command Permissions
Computed in `maestro-cli/src/services/command-permissions.ts`:
- Groups: root, task, session, queue, mail, show, modal
- Each group has individual commands
- Available commands depend on mode + strategy
- Example: queue commands only for queue strategy, spawn commands only for coordinators

### Prompt Injection
- Capabilities → `<capabilities>` XML in system prompt (prompt-builder.ts)
- Commands → `<commands>` XML in system prompt (prompt-builder.ts)

## Architecture

### New Fields on TeamMember

```typescript
// In maestro-server/src/types.ts and maestro-ui/src/app/types/maestro.ts
interface TeamMember {
  // ... existing fields from Phase 1 ...

  // Phase 2: Capability overrides
  capabilities?: {
    can_spawn_sessions?: boolean;
    can_edit_tasks?: boolean;
    can_use_queue?: boolean;
    can_report_task_level?: boolean;
    can_report_session_level?: boolean;
  };

  // Phase 2: Command permission overrides
  commandPermissions?: {
    groups: Record<string, boolean>;  // { task: true, session: false, queue: true, ... }
    commands: Record<string, boolean>;  // { "session:spawn": true, "queue:next": false, ... }
  };
}
```

### Resolution Logic

When generating a manifest:
1. Start with default capabilities computed from mode+strategy (existing `computeCapabilities()`)
2. If `teamMember.capabilities` is set, overlay those values (explicit overrides win)
3. Start with default command permissions computed from mode+strategy
4. If `teamMember.commandPermissions.groups` is set, overlay group enables
5. If `teamMember.commandPermissions.commands` is set, overlay individual commands

This preserves backward compatibility: if no overrides are set, behavior is identical to Phase 1.

## Files to Modify

### Server Types
- **`maestro-server/src/types.ts`** - Add `capabilities` and `commandPermissions` to TeamMember, Create/Update payloads
- **`maestro-ui/src/app/types/maestro.ts`** - Mirror type changes

### Repository
- **`maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts`**
  - Update 5 default definitions with explicit capabilities/commandPermissions matching their mode+strategy
  - Handle serialization of new fields

### Manifest Generator
- **`maestro-cli/src/commands/manifest-generator.ts`**
  - When fetching team member, also read capabilities and commandPermissions
  - Pass them into manifest

### Manifest Types
- **`maestro-cli/src/types/manifest.ts`**
  - Add `capabilities?: Record<string, boolean>` to TeamMemberData
  - Add `commandPermissions?: { groups: Record<string, boolean>; commands: Record<string, boolean> }` to TeamMemberData
  - Update `computeCapabilities()` to accept optional overrides
  - Add `computeCommandPermissions(mode, strategy, overrides?)` function

### Prompt Builder
- **`maestro-cli/src/services/prompt-builder.ts`**
  - Update capability building to use manifest's team member capabilities if present
  - Update command building to use manifest's team member command permissions if present

### Command Permissions
- **`maestro-cli/src/services/command-permissions.ts`**
  - Add ability to accept external overrides
  - `getPermissions(mode, strategy, overrides?)` → merged permissions

### UI: CreateTeamMemberModal & EditTeamMemberModal
- **`maestro-ui/src/components/maestro/CreateTeamMemberModal.tsx`**
- **`maestro-ui/src/components/maestro/EditTeamMemberModal.tsx`**

Add new sections:

#### Capabilities Section
- Checkbox toggles for each capability
- Auto-populated based on mode+strategy selection
- User can override individual capabilities

#### Command Permissions Section
- Expandable command groups (accordion style)
- Group-level toggle enables/disables entire group
- When group is enabled, individual command toggles shown
- Commands list: ~20+ commands across groups (root, task, session, queue, mail, show, modal)

### UI Layout Suggestion
```
[ Mode: Worker ▾ ]  [ Strategy: simple ▾ ]

▸ Capabilities
  ☑ Edit tasks
  ☑ Report task-level
  ☑ Report session-level
  ☐ Spawn sessions
  ☐ Use queue

▸ Command Permissions
  ▾ Root Commands (3/3 enabled)
    ☑ whoami
    ☑ status
    ☑ commands
  ▸ Task Commands (7/7 enabled)
  ▸ Session Commands (4/5 enabled)
  ▸ Queue Commands (0/3 enabled)
  ▸ Mail Commands (0/3 enabled)
```

## Command Reference

Full list of commands by group (from `command-permissions.ts`):

### Root
- `whoami`, `status`, `commands`

### Task
- `task:list`, `task:get`, `task:create`, `task:edit`, `task:delete`
- `task:children`
- `task:report:progress`, `task:report:complete`, `task:report:blocked`, `task:report:error`
- `task:docs:add`, `task:docs:list`

### Session
- `session:info`
- `session:report:progress`, `session:report:complete`, `session:report:blocked`, `session:report:error`
- `session:docs:add`, `session:docs:list`

### Queue (execute+queue only)
- `queue:status`, `queue:next`, `queue:skip`

### Mail
- `mail:send`, `mail:inbox`, `mail:reply`

### Show
- `show:modal`

### Modal
- `modal:events`

## Testing

1. Create custom team member with capability overrides → verify manifest has correct capabilities
2. Create custom team member with command overrides → verify only allowed commands in system prompt
3. Verify default team members have correct auto-computed capabilities
4. Verify UI shows capability/command toggles
5. Verify group toggle enables/disables all commands in group
6. Verify overrides persist through save/reload cycle
