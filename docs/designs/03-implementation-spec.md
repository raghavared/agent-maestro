# Maestro Team Members - Implementation Specification

> This document provides **exact file-by-file implementation instructions** for the Team Members feature. An LLM should be able to implement this end-to-end.

---

## Phase 1: Server Foundation + Migration

### Step 1.1: Update `maestro-server/src/types.ts`

**ADD** the TeamMember type and related types:

```typescript
// Team Member entity (first-class, separate from Task)
export type TeamMemberStatus = 'active' | 'archived';

export interface TeamMember {
  id: string;                          // "tm_<timestamp>_<random>" or deterministic for defaults
  projectId: string;
  name: string;                        // "Worker", "Coordinator", "Frontend Dev"
  role: string;                        // "Default executor", "Task orchestrator"
  identity: string;                    // Custom instructions / persona prompt
  avatar: string;                      // Emoji: "🔧", "🎯", "🎨"
  model?: string;                      // "opus", "sonnet", "haiku"
  agentTool?: AgentTool;               // "claude-code", "codex", "gemini"
  skillIds?: string[];
  isDefault: boolean;                  // true for Worker & Coordinator
  status: TeamMemberStatus;            // 'active' | 'archived'
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
}

export interface TeamMemberSnapshot {
  name: string;
  avatar: string;
  role: string;
  model?: string;
  agentTool?: AgentTool;
}

export interface CreateTeamMemberPayload {
  projectId: string;
  name: string;
  role: string;
  identity: string;
  avatar: string;
  model?: string;
  agentTool?: AgentTool;
  skillIds?: string[];
}

export interface UpdateTeamMemberPayload {
  name?: string;
  role?: string;
  identity?: string;
  avatar?: string;
  model?: string;
  agentTool?: AgentTool;
  skillIds?: string[];
  status?: TeamMemberStatus;
}
```

**ADD** to `Session` type:
```typescript
// Inside Session interface, add:
teamMemberId?: string;
teamMemberSnapshot?: TeamMemberSnapshot;
```

**ADD** to `SpawnSessionPayload`:
```typescript
// Inside SpawnSessionPayload, add:
teamMemberId?: string;              // Team member running this session
```

**REMOVE** from types.ts:
```typescript
// DELETE these:
export type TaskType = 'task' | 'team-member';
export interface TeamMemberMetadata { ... }
// REMOVE from Task interface:
taskType?: TaskType;
teamMemberMetadata?: TeamMemberMetadata;
// REMOVE from CreateTaskPayload:
taskType?: TaskType;
teamMemberMetadata?: TeamMemberMetadata;
// REMOVE from UpdateTaskPayload:
taskType?: TaskType;
teamMemberMetadata?: TeamMemberMetadata;
```

### Step 1.2: Create `maestro-server/src/domain/repositories/ITeamMemberRepository.ts`

```typescript
import { TeamMember, CreateTeamMemberPayload, UpdateTeamMemberPayload } from '../../types';

export interface ITeamMemberRepository {
  findById(projectId: string, id: string): Promise<TeamMember | null>;
  findByProjectId(projectId: string): Promise<TeamMember[]>;
  create(member: TeamMember): Promise<TeamMember>;
  update(id: string, updates: Partial<TeamMember>): Promise<TeamMember>;
  delete(id: string): Promise<void>;
  saveDefaultOverride(projectId: string, defaultId: string, overrides: Partial<TeamMember>): Promise<void>;
  resetDefault(projectId: string, defaultId: string): Promise<void>;
  initialize(): Promise<void>;
}
```

### Step 1.3: Create `maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts`

**Storage layout:**
```
{dataDir}/team-members/{projectId}/
  tm_{projectId}_worker.override.json     # Optional: user overrides for Worker default
  tm_{projectId}_coordinator.override.json # Optional: user overrides for Coordinator default
  tm_{timestamp}_{random}.json            # Custom team members
```

**Implementation requirements:**
1. Define `DEFAULT_WORKER` and `DEFAULT_COORDINATOR` as code constants
2. Deterministic IDs: `tm_{projectId}_worker` and `tm_{projectId}_coordinator`
3. `findByProjectId()` must:
   - Start with code defaults
   - Merge any `.override.json` files on top of defaults (spread: `{ ...default, ...override, isDefault: true }`)
   - Add all custom member JSON files
   - Return combined list
4. `create()` writes custom member JSON file (must have `isDefault: false`)
5. `update()` for default members writes to `.override.json`; for custom members updates the main JSON
6. `delete()` throws `ForbiddenError` if `isDefault === true`; otherwise deletes the JSON file
7. `saveDefaultOverride()` writes only changed fields to `.override.json`
8. `resetDefault()` deletes the `.override.json` file

### Step 1.4: Create `maestro-server/src/application/services/TeamMemberService.ts`

```typescript
class TeamMemberService {
  constructor(
    private teamMemberRepo: ITeamMemberRepository,
    private eventBus: IEventBus,
    private idGenerator: IIdGenerator,
  ) {}

  async createTeamMember(projectId: string, data: CreateTeamMemberPayload): Promise<TeamMember>;
  async getTeamMember(projectId: string, id: string): Promise<TeamMember>;
  async getProjectTeamMembers(projectId: string): Promise<TeamMember[]>;
  async updateTeamMember(projectId: string, id: string, updates: UpdateTeamMemberPayload): Promise<TeamMember>;
  async deleteTeamMember(id: string): Promise<void>;  // Throws if isDefault; throws if status !== 'archived'
  async archiveTeamMember(projectId: string, id: string): Promise<TeamMember>;
  async unarchiveTeamMember(projectId: string, id: string): Promise<TeamMember>;
  async resetDefault(projectId: string, defaultId: string): Promise<TeamMember>;
  async getTeamMemberSnapshot(projectId: string, id: string): Promise<TeamMemberSnapshot>;
}
```

**Business rules:**
- `createTeamMember()`: Generate ID with `idGenerator.generate('tm')`, set `isDefault: false`, `status: 'active'`
- `deleteTeamMember()`: Must check `isDefault === false` AND `status === 'archived'`
- `archiveTeamMember()`: Sets `status: 'archived'`, emits `team_member:archived`
- `updateTeamMember()`: For defaults, delegates to `saveDefaultOverride()`. Emits `team_member:updated`
- `resetDefault()`: Calls `repo.resetDefault()`, emits `team_member:updated`

### Step 1.5: Create `maestro-server/src/api/teamMemberRoutes.ts`

```typescript
export function createTeamMemberRoutes(teamMemberService: TeamMemberService) {
  const router = express.Router();

  // GET /team-members?projectId=X         -> List all (defaults merged + custom)
  // POST /team-members                     -> Create custom member
  // GET /team-members/:id?projectId=X      -> Get by ID
  // PATCH /team-members/:id                -> Update (custom or default override)
  // DELETE /team-members/:id               -> Delete (403 if default, 400 if not archived)
  // POST /team-members/:id/archive         -> Archive
  // POST /team-members/:id/unarchive       -> Unarchive
  // POST /team-members/:id/reset           -> Reset default to code values (404 if not default)

  return router;
}
```

**All endpoints require `projectId`** either as query param or in request body.

### Step 1.6: Update `maestro-server/src/container.ts`

Add to Container interface:
```typescript
teamMemberRepo: ITeamMemberRepository;
teamMemberService: TeamMemberService;
```

Add to `createContainer()`:
```typescript
const teamMemberRepo = new FileSystemTeamMemberRepository(config.dataDir, idGenerator, logger);
const teamMemberService = new TeamMemberService(teamMemberRepo, eventBus, idGenerator);
```

Add to `initialize()`:
```typescript
await teamMemberRepo.initialize();
```

### Step 1.7: Update `maestro-server/src/server.ts`

```typescript
import { createTeamMemberRoutes } from './api/teamMemberRoutes';

// In startServer():
const teamMemberRoutes = createTeamMemberRoutes(container.teamMemberService);
app.use('/api', teamMemberRoutes);
```

### Step 1.8: Update Event System

In `maestro-server/src/domain/events/DomainEvents.ts`, add:
```typescript
export interface TeamMemberCreatedEvent { type: 'team_member:created'; data: TeamMember; }
export interface TeamMemberUpdatedEvent { type: 'team_member:updated'; data: TeamMember; }
export interface TeamMemberDeletedEvent { type: 'team_member:deleted'; data: { id: string }; }
export interface TeamMemberArchivedEvent { type: 'team_member:archived'; data: TeamMember; }
```

Add to `DomainEvent` union, `TypedEventMap`, and `EventName`.

In `WebSocketBridge.ts`, add to the events array:
```typescript
'team_member:created',
'team_member:updated',
'team_member:deleted',
'team_member:archived',
```

### Step 1.9: Migration - Delete Old Team Member Tasks

Add a migration function called during `container.initialize()`:

```typescript
// In container.ts initialize():
async function migrateTeamMemberTasks(taskRepo: ITaskRepository, logger: ILogger) {
  // Scan all tasks, delete any with taskType === 'team-member'
  // This is a one-time migration
}
```

### Step 1.10: Clean up Task filtering

In `maestro-server/src/api/taskRoutes.ts`, remove the `taskType` query parameter filter from `GET /tasks`.

---

## Phase 2: Session Integration + CLI

### Step 2.1: Update Session Spawn Flow

In `maestro-server/src/api/sessionRoutes.ts` `POST /sessions/spawn`:

1. Extract `teamMemberId` from request body
2. If `teamMemberId` provided:
   - Resolve team member via `teamMemberService.getTeamMember(projectId, teamMemberId)`
   - Create snapshot: `{ name, avatar, role, model, agentTool }`
   - Apply config priority: spawn-time explicit > team member > task > default
   - Store `teamMemberId` and `teamMemberSnapshot` in session metadata
3. Pass `--team-member-id` to manifest generator CLI if present
4. If mode not explicitly provided and team member is Coordinator default, default mode to 'coordinate'

Update session creation to include:
```typescript
const session = await sessionService.createSession({
  ...existing,
  metadata: {
    ...existing.metadata,
    teamMemberId: teamMemberId || null,
    teamMemberSnapshot: snapshot || null,
  },
});
```

### Step 2.2: Update CLI Manifest Generator

In `maestro-cli/src/commands/manifest-generator.ts`:

1. Add `--team-member-id <id>` option (single team member for this session)
2. When provided, fetch team member from server API: `GET /api/team-members/:id?projectId=X`
3. Add to manifest: `teamMemberId`, `teamMemberName`, `teamMemberAvatar`
4. **Keep existing `--team-member-ids` for coordinate mode** (list of available team members)
5. For `--team-member-ids`, fetch from new API instead of reading task storage

### Step 2.3: Update CLI Session Spawn Command

In `maestro-cli/src/commands/session.ts`, add `--team-member-id <id>` option to `maestro session spawn`.

### Step 2.4: Update Prompt Builder

In `maestro-cli/src/services/prompt-builder.ts`:

Add method `buildTeamMemberIdentity(manifest)`:
```typescript
buildTeamMemberIdentity(manifest: MaestroManifest): string {
  if (!manifest.teamMemberId || !manifest.teamMemberName) return '';
  // Only emit for custom team members (not Worker/Coordinator defaults)
  return `
  <team_member_identity>
    <name>${manifest.teamMemberName}</name>
    <avatar>${manifest.teamMemberAvatar}</avatar>
    <instructions>${manifest.teamMemberIdentity}</instructions>
  </team_member_identity>`;
}
```

Call this from `buildSystemXml()` after `buildIdentity()`.

### Step 2.5: Update Manifest Types

In `maestro-cli/src/types/manifest.ts`:

Add to `MaestroManifest`:
```typescript
teamMemberId?: string;
teamMemberName?: string;
teamMemberAvatar?: string;
teamMemberIdentity?: string;
```

**REMOVE** from `TaskData`:
```typescript
taskType?: 'task' | 'team-member';
teamMemberMetadata?: { ... };
```

### Step 2.6: Update Command Permissions

In `maestro-cli/src/services/command-permissions.ts`:

Add to `COMMAND_SYNTAX`:
```typescript
'session:spawn': 'maestro session spawn --task-ids <ids> [--team-member-id <tmId>] [--mode <mode>]',
```

### Step 2.7: Update Coordinator Prompt

The coordinator's workflow XML should include spawn instructions:

```xml
<spawn_instructions>
  When spawning a worker session for a specific team member:
    maestro session spawn --task-ids <taskId> --team-member-id <teamMemberId> --mode execute
  Choose the best team member based on the task requirements and team member roles/skills.
</spawn_instructions>
```

This should be added in `PromptBuilder.buildWorkflow()` for coordinate mode.

---

## Phase 3: UI - Store, Client, & Team Tab

### Step 3.1: Update `maestro-ui/src/app/types/maestro.ts`

**ADD:**
```typescript
export type TeamMemberStatus = 'active' | 'archived';

export interface TeamMember {
  id: string;
  projectId: string;
  name: string;
  role: string;
  identity: string;
  avatar: string;
  model?: ModelType;
  agentTool?: AgentTool;
  skillIds?: string[];
  isDefault: boolean;
  status: TeamMemberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberSnapshot {
  name: string;
  avatar: string;
  role: string;
  model?: string;
  agentTool?: AgentTool;
}

export interface CreateTeamMemberPayload {
  projectId: string;
  name: string;
  role: string;
  identity: string;
  avatar: string;
  model?: ModelType;
  agentTool?: AgentTool;
  skillIds?: string[];
}

export interface UpdateTeamMemberPayload {
  name?: string;
  role?: string;
  identity?: string;
  avatar?: string;
  model?: ModelType;
  agentTool?: AgentTool;
  skillIds?: string[];
  status?: TeamMemberStatus;
}
```

**ADD to `MaestroSession`:**
```typescript
teamMemberId?: string;
teamMemberSnapshot?: TeamMemberSnapshot;
```

**REMOVE:**
```typescript
export type TaskType = 'task' | 'team-member';
export interface TeamMemberMetadata { ... }
// Remove taskType, teamMemberMetadata from MaestroTask, CreateTaskPayload, UpdateTaskPayload
```

### Step 3.2: Update `maestro-ui/src/utils/MaestroClient.ts`

Add methods:
```typescript
async getTeamMembers(projectId: string): Promise<TeamMember[]>
async createTeamMember(data: CreateTeamMemberPayload): Promise<TeamMember>
async updateTeamMember(id: string, projectId: string, updates: UpdateTeamMemberPayload): Promise<TeamMember>
async deleteTeamMember(id: string): Promise<void>
async archiveTeamMember(id: string, projectId: string): Promise<void>
async unarchiveTeamMember(id: string, projectId: string): Promise<void>
async resetDefaultTeamMember(id: string, projectId: string): Promise<void>
```

### Step 3.3: Update `maestro-ui/src/stores/useMaestroStore.ts`

Add to state:
```typescript
teamMembers: Map<string, TeamMember>;
```

Add actions:
```typescript
fetchTeamMembers(projectId: string): Promise<void>;
createTeamMember(data: CreateTeamMemberPayload): Promise<TeamMember>;
updateTeamMember(id: string, projectId: string, updates: UpdateTeamMemberPayload): Promise<TeamMember>;
deleteTeamMember(id: string): Promise<void>;
archiveTeamMember(id: string, projectId: string): Promise<void>;
unarchiveTeamMember(id: string, projectId: string): Promise<void>;
resetDefaultTeamMember(id: string, projectId: string): Promise<void>;
```

Add WebSocket handlers:
```typescript
case 'team_member:created':
case 'team_member:updated':
case 'team_member:archived':
  teamMembers.set(data.id, data);
  break;
case 'team_member:deleted':
  teamMembers.delete(data.id);
  break;
```

Add `lastUsedTeamMember: Record<string, string>` persisted to localStorage.

Fetch team members in the project load flow (same place `fetchTasks` and `fetchSessions` are called).

### Step 3.4: Update `MaestroPanel.tsx` Team Tab

Replace current team-member-task-based rendering with:
- Read from `teamMembers` store
- **Active section:** Default members (show "Configure" + "Reset to Default" buttons) + custom active members
- **Archived section:** Collapsed, shows archived members with "Unarchive" / "Delete" actions
- "+ New Team Member" button opens `CreateTeamMemberModal`

### Step 3.5: Create `CreateTeamMemberModal.tsx`

Fields: Name (text), Role (text), Avatar (emoji picker or text), Identity (textarea), Model (dropdown: haiku/sonnet/opus), Agent Tool (dropdown: claude-code/codex/gemini), Skills (multi-select).

### Step 3.6: Create `EditTeamMemberModal.tsx`

Same fields as create. For defaults: show "Reset to Default" button, show hint text for default values.

### Step 3.7: Remove old team member code from task components

- `TaskFilters.tsx`: Remove any `taskType` filtering
- `TaskListItem.tsx`: Remove team-member-specific rendering
- `MaestroPanel.tsx`: Remove task-based team member filtering in the Team tab

---

## Phase 4: UI - Split Play Button & Session Integration

### Step 4.1: Create `SplitPlayButton.tsx`

Component with two zones:
- **Left (Play icon):** Click runs task with `lastUsedTeamMember[taskId]` (default: Worker)
- **Right (Chevron down):** Opens dropdown with all active team members

Dropdown structure:
```
DEFAULTS
  🔧 Worker
  🎯 Coordinator
CUSTOM
  🎨 Frontend Dev
  🧪 Tester
```

On selection: updates `lastUsedTeamMember[taskId]` in localStorage, triggers spawn.

### Step 4.2: Update `TaskListItem.tsx`

Replace existing play button with `SplitPlayButton`.

Update spawn call to include `teamMemberId` in the payload:
```typescript
const spawnPayload = {
  projectId,
  taskIds: [task.id],
  teamMemberId: selectedTeamMember.id,
  mode: selectedTeamMember is Coordinator ? 'coordinate' : 'execute',
  // ... existing fields
};
```

### Step 4.3: Update `SessionsSection.tsx`

Show team member avatar from `session.teamMemberSnapshot`:
```tsx
{session.teamMemberSnapshot && (
  <span className="sessionTeamMemberAvatar">
    {session.teamMemberSnapshot.avatar}
  </span>
)}
```

### Step 4.4: Orchestration Inline Panel

When Coordinator is selected from the dropdown, show an inline panel below the task:
- Strategy dropdown (default, intelligent-batching, dag)
- Team member pills (select which team members are available)
- Start button

This triggers spawn with `mode: 'coordinate'`, `teamMemberIds: [selected member IDs]`.

---

## Config Priority Resolution

When spawning, resolve model and agentTool:

```typescript
function resolveConfig(
  spawnPayload: SpawnSessionPayload,
  teamMember?: TeamMember,
  task?: Task,
): { model: string; agentTool: AgentTool } {
  return {
    model: spawnPayload.model
      ?? teamMember?.model
      ?? task?.model
      ?? 'sonnet',
    agentTool: spawnPayload.agentTool
      ?? teamMember?.agentTool
      ?? task?.agentTool
      ?? 'claude-code',
  };
}
```

---

## Testing Checklist

### Phase 1
- [ ] `GET /api/team-members?projectId=X` returns Worker + Coordinator defaults
- [ ] `POST /api/team-members` creates a custom member
- [ ] `PATCH /api/team-members/:id` on a default creates an override
- [ ] `POST /api/team-members/:id/reset` on a default removes the override
- [ ] `DELETE /api/team-members/:id` on a default returns 403
- [ ] `DELETE /api/team-members/:id` on active custom returns 400
- [ ] `POST /api/team-members/:id/archive` then `DELETE` works
- [ ] WebSocket receives `team_member:created`, `team_member:updated`, `team_member:deleted`, `team_member:archived`
- [ ] Old `taskType: 'team-member'` tasks are deleted on startup

### Phase 2
- [ ] `POST /sessions/spawn` with `teamMemberId` stores snapshot on session
- [ ] Config priority: spawn model > team member model > task model > default
- [ ] Manifest includes `teamMemberId`, `teamMemberName`, `teamMemberAvatar`
- [ ] Coordinator prompt includes `<spawn_instructions>` with `--team-member-id`
- [ ] Custom team member identity appears in `<team_member_identity>` XML block

### Phase 3
- [ ] Team tab shows defaults + custom members from new API
- [ ] Create/edit/delete/archive works through UI
- [ ] WebSocket updates team member list in real-time
- [ ] Old task-based team member code removed

### Phase 4
- [ ] Split play button defaults to last-used team member per task
- [ ] Dropdown shows all active team members
- [ ] Session rows show team member avatar from snapshot
- [ ] Coordinator selection shows orchestration inline panel
