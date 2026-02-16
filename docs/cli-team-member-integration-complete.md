# CLI Team Member Integration - Implementation Complete

## Overview
Successfully implemented Phase 2 CLI updates (Steps 2.2-2.7) from the Team Members implementation specification. The CLI now supports team member identity integration for sessions.

## Changes Made

### Step 2.2: CLI Manifest Generator (`maestro-cli/src/commands/manifest-generator.ts`)

**Added:**
- `--team-member-id <id>` option to specify a single team member for the session
- API integration to fetch team member details from `/api/team-members/:id?projectId=X`
- Population of manifest with: `teamMemberId`, `teamMemberName`, `teamMemberAvatar`, `teamMemberIdentity`
- Updated `--team-member-ids` handling to fetch from new Team Member API instead of task storage

**Changes:**
- Added `api` import for API calls
- Extended `execute()` method signature to include `teamMemberId` option
- Added team member fetching logic before manifest generation
- Migrated `teamMembers` array generation from task-based storage to API-based fetching

### Step 2.3: CLI Session Spawn Command (`maestro-cli/src/commands/session.ts`)

**Added:**
- `--team-member-id <id>` option to `maestro session spawn` command
- Field added to spawn request payload to pass team member ID to server

### Step 2.4: Prompt Builder (`maestro-cli/src/services/prompt-builder.ts`)

**Added:**
- `buildTeamMemberIdentity(manifest)` method that generates `<team_member_identity>` XML block
- Logic to detect default team members (Worker/Coordinator) and skip identity emission for them
- Integration into `buildSystemXml()` and `buildTaskXml()` to include team member identity after base identity

**XML Output:**
```xml
<team_member_identity>
  <name>Team Member Name</name>
  <avatar>🎨</avatar>
  <instructions>Custom instructions...</instructions>
</team_member_identity>
```

### Step 2.5: Manifest Types (`maestro-cli/src/types/manifest.ts`)

**Added to `MaestroManifest`:**
- `teamMemberId?: string` - Team member ID for this session
- `teamMemberName?: string` - Team member name
- `teamMemberAvatar?: string` - Team member avatar
- `teamMemberIdentity?: string` - Team member identity/instructions

**Removed from `TaskData`:**
- `taskType?: 'task' | 'team-member'` - Old task-based team member field
- `teamMemberMetadata?: { ... }` - Old task-based team member metadata

### Step 2.6: Command Permissions (`maestro-cli/src/services/command-permissions.ts`)

**Updated:**
- `COMMAND_SYNTAX['session:spawn']` to include `--team-member-id <tmId>` in the syntax string
- Full syntax: `maestro session spawn --task <id> [--team-member-id <tmId>] [--model <model>] [--agent-tool <tool>]`

### Step 2.7: Coordinator Prompt (`maestro-cli/src/services/prompt-builder.ts`)

**Updated workflow instructions for all coordinator strategies:**
- **Default strategy** spawn phase: Added `--team-member-id <tmId>` option with guidance to choose team member based on task requirements
- **Intelligent-batching strategy** execute_batch phase: Added `--team-member-id <tmId>` option
- **DAG strategy** execute_wave phase: Added `--team-member-id <tmId>` option
- **Fallback coordinator** spawn phase: Added `--team-member-id <tmId>` option

### Additional: Manifest Schema (`maestro-cli/src/schemas/manifest-schema.ts`)

**Added validation for:**
- `teamMemberId` (string, nullable)
- `teamMemberName` (string, nullable)
- `teamMemberAvatar` (string, nullable)
- `teamMemberIdentity` (string, nullable)

**Removed from TaskData validation:**
- `taskType` field
- `teamMemberMetadata` object

## Build Status
✅ CLI builds successfully with no TypeScript errors

## API Integration

The CLI now makes the following API calls:

1. **Fetch single team member** (for session identity):
   ```
   GET /api/team-members/:id?projectId=X
   ```

2. **Fetch team members for coordination** (for coordinate mode):
   ```
   GET /api/team-members/:id?projectId=X (for each team member ID)
   ```

## Testing Recommendations

1. **Basic team member identity**:
   - Generate manifest with `--team-member-id` for a custom team member
   - Verify `teamMemberId`, `teamMemberName`, `teamMemberAvatar`, `teamMemberIdentity` appear in manifest
   - Verify `<team_member_identity>` block appears in prompt

2. **Default team members**:
   - Generate manifest with Worker or Coordinator default team member
   - Verify NO `<team_member_identity>` block is emitted (defaults should not override base identity)

3. **Session spawn**:
   - Test `maestro session spawn --task <id> --team-member-id <tmId>`
   - Verify team member ID is passed to server in spawn request

4. **Coordinator workflows**:
   - Verify all coordinator strategies include `--team-member-id` in spawn instructions
   - Verify coordinators are instructed to choose appropriate team members for tasks

5. **Backward compatibility**:
   - Test manifests without team member fields still work
   - Verify old `--team-member-ids` still works for coordinate mode

## Files Modified

1. `maestro-cli/src/types/manifest.ts`
2. `maestro-cli/src/commands/manifest-generator.ts`
3. `maestro-cli/src/commands/session.ts`
4. `maestro-cli/src/services/prompt-builder.ts`
5. `maestro-cli/src/services/command-permissions.ts`
6. `maestro-cli/src/schemas/manifest-schema.ts`

## Next Steps

These CLI changes are now ready for integration with:
- **Server-side changes** (Step 2.1): Session spawn flow to handle `teamMemberId` payload
- **UI changes** (Phase 3): Team member management interface
- **Split play button** (Phase 4): UI to select team members for task execution

## Notes

- Team member identity is only emitted for **custom team members**, not defaults (Worker/Coordinator)
- Default team members are detected by checking if ID contains `_worker` or `_coordinator`
- The `--team-member-ids` option is preserved for backward compatibility and coordinate mode
- All coordinator strategies now include team member selection guidance
