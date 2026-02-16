# Maestro Team Members - Complete Design Plan v4

## Executive Summary

Team Members are a **first-class entity** in Maestro, separate from Tasks. They represent the **identity and configuration layer** that sits on top of Sessions. Two defaults — **Worker** and **Coordinator** — are always present (served from code, customizable with per-project disk overrides). The existing Task and Session functionality remains untouched; Team Members layer on top.

**Key changes from v3:**
- `mode` removed from TeamMember (determined at spawn time)
- Old `taskType: 'team-member'` tasks deleted during migration
- Defaults served from code with per-project disk overrides + reset-to-default
- Archive flow with `status: 'active' | 'archived'`
- Implicit task assignment via `session.teamMemberId + session.taskIds`
- Config priority: Team Member > Task > Project default
- CLI uses extended `maestro session spawn --team-member-id`
- Smart Launch Bar deferred to post-v1
- Event names use underscore consistently: `team_member:created`

---

## 1. Core Entities & Relationships

### 1.1 Entity Overview

```
+---------------------------------------------------------------------+
|                        MAESTRO ENTITIES                              |
|                                                                      |
|  +----------+    +--------------+    +--------------+               |
|  |   Task   |    | Team Member  |    |   Session    |               |
|  |          |    |              |    |              |               |
|  | - title   |    | - name       |    | - status     |               |
|  | - desc    |<-->| - role       |--->| - strategy   |               |
|  | - status  |    | - identity   |    | - events     |               |
|  | - priority|    | - avatar     |    | - timeline   |               |
|  +----------+    | - model      |    | - docs       |               |
|       ^          | - agentTool  |    | - teamMember |               |
|       |          | - skills     |    |   Snapshot   |               |
|       |          | - status     |    +--------------+               |
|       |          | - isDefault  |           ^                       |
|       |          +--------------+           |                       |
|       |                                     |                       |
|       +----------- many:many ---------------+                       |
|         (task.sessionIds / session.taskIds)                         |
+---------------------------------------------------------------------+
```

**Key insight:** Team Member defines **who** (identity, skills, model). Session defines **how** (mode, strategy). Task defines **what** (work to be done). Assignment is implicit: `session.teamMemberId + session.taskIds`.

### 1.2 Team Member Entity

```typescript
interface TeamMember {
  id: string;                    // "tm_<timestamp>_<random>"
  projectId: string;
  name: string;                  // "Worker", "Coordinator", "Frontend Dev"
  role: string;                  // "Default executor", "Task orchestrator"
  identity: string;              // Custom instructions / persona prompt
  avatar: string;                // Emoji: "🔧", "🎯", "🎨"
  model?: string;                // "opus", "sonnet", "haiku"
  agentTool?: AgentTool;         // "claude-code", "codex", "gemini"
  skillIds?: string[];
  isDefault: boolean;            // true for Worker & Coordinator
  status: 'active' | 'archived'; // archived members hidden from run-with dropdown
  createdAt: string;
  updatedAt: string;
}
```

**No `mode` field.** Mode (`execute` | `coordinate`) is a session-level concern, set at spawn time. A "Frontend Dev" team member can run in execute mode for implementation or coordinate mode for delegation — the same identity, different operational mode.

### 1.3 Default Team Members (Code Defaults + Disk Overrides)

Defaults are defined in server code and **always returned** when listing team members. Users can customize fields (identity, model, agentTool, skills) which are stored as per-project overrides on disk. A "Reset to Default" action clears the override file.

```typescript
// Canonical defaults in server code (never deleted)
const DEFAULT_WORKER: Omit<TeamMember, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> = {
  name: 'Worker',
  role: 'Default executor',
  identity: 'You are a worker agent. You implement tasks directly...',
  avatar: '🔧',
  isDefault: true,
  status: 'active',
};

const DEFAULT_COORDINATOR: Omit<TeamMember, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> = {
  name: 'Coordinator',
  role: 'Task orchestrator',
  identity: 'You are a coordinator agent. You NEVER write code...',
  avatar: '🎯',
  isDefault: true,
  status: 'active',
};
```

**ID convention for defaults:** Use deterministic IDs: `tm_<projectId>_worker` and `tm_<projectId>_coordinator`. This eliminates race conditions and makes reset trivial (delete the override file, ID stays the same).

**Override storage:** `<dataDir>/team-members/<projectId>/tm_<projectId>_worker.override.json` — only stores fields the user has changed.

**Merge at read time:**
```typescript
function resolveTeamMember(codeDefault: TeamMember, override?: Partial<TeamMember>): TeamMember {
  if (!override) return codeDefault;
  return { ...codeDefault, ...override, isDefault: true }; // isDefault always stays true
}
```

**Reset to default:** Delete the override file. Next read returns pure code defaults.

### 1.4 Session Team Member Snapshot

When a session is spawned with a team member, the session stores:

```typescript
// Added to MaestroSession
interface MaestroSession {
  // ... existing fields ...
  teamMemberId?: string;              // Reference to the team member
  teamMemberSnapshot?: {              // Config at spawn time
    name: string;
    avatar: string;
    role: string;
    model?: string;
    agentTool?: AgentTool;
  };
}
```

**No `mode` in snapshot** — mode is already on the session itself (via `session.metadata.mode` or similar).

Archived team members still appear in session history via their snapshot — the snapshot is self-contained and doesn't depend on the team member still being active.

### 1.5 Task Assignment Model (Implicit)

Assignment is **implicit** via the session linkage: `session.teamMemberId + session.taskIds`. To determine which team member is working on a task:

```typescript
// UI helper
function getTaskTeamMember(taskId: string, sessions: Map<string, Session>): TeamMemberSnapshot | null {
  const activeSessions = [...sessions.values()]
    .filter(s => s.taskIds.includes(taskId) && s.status !== 'completed' && s.status !== 'failed');
  if (activeSessions.length === 0) return null;
  // Return the most recent active session's team member
  const latest = activeSessions.sort((a, b) => b.startedAt - a.startedAt)[0];
  return latest.teamMemberSnapshot ?? null;
}
```

This avoids a new assignment entity while still allowing the UI to show "Task X is being handled by Frontend Dev."

---

## 2. Server Architecture

### 2.1 Repository: ITeamMemberRepository

```typescript
interface ITeamMemberRepository {
  // Read
  findById(projectId: string, id: string): Promise<TeamMember | null>;
  findByProjectId(projectId: string): Promise<TeamMember[]>;  // Returns code defaults (merged with overrides) + custom members

  // Write (custom members)
  create(member: TeamMember): Promise<TeamMember>;
  update(id: string, updates: Partial<TeamMember>): Promise<TeamMember>;
  delete(id: string): Promise<void>;  // Throws if isDefault

  // Default overrides
  saveDefaultOverride(projectId: string, defaultId: string, overrides: Partial<TeamMember>): Promise<TeamMember>;
  resetDefault(projectId: string, defaultId: string): Promise<TeamMember>;  // Deletes override file
}
```

**Implementation:** `FileSystemTeamMemberRepository`
- Custom members stored in `<dataDir>/team-members/<projectId>/` as JSON files
- Default overrides stored as `<id>.override.json`
- `findByProjectId` merges code defaults + overrides + custom members

### 2.2 Service: TeamMemberService

```typescript
class TeamMemberService {
  // CRUD
  createTeamMember(projectId: string, data: CreateTeamMemberInput): Promise<TeamMember>;
  getTeamMember(projectId: string, id: string): Promise<TeamMember>;
  getProjectTeamMembers(projectId: string): Promise<TeamMember[]>;
  updateTeamMember(id: string, updates: UpdateTeamMemberInput): Promise<TeamMember>;
  deleteTeamMember(id: string): Promise<void>;  // Throws if isDefault; throws if status !== 'archived'

  // Archive
  archiveTeamMember(id: string): Promise<TeamMember>;   // Sets status to 'archived'
  unarchiveTeamMember(id: string): Promise<TeamMember>;  // Sets status back to 'active'

  // Default management
  updateDefault(projectId: string, defaultId: string, overrides: Partial<TeamMember>): Promise<TeamMember>;
  resetDefault(projectId: string, defaultId: string): Promise<TeamMember>;

  // Session integration
  getTeamMemberSnapshot(projectId: string, id: string): Promise<TeamMemberSnapshot>;
}
```

**Delete guard:** Custom members must be archived before deletion. Default members cannot be deleted (only reset).

### 2.3 API Routes: `/api/team-members`

```
GET    /api/team-members?projectId=X              -> List all members (defaults + custom, merged)
POST   /api/team-members                           -> Create new custom member
GET    /api/team-members/:id?projectId=X           -> Get member by ID
PATCH  /api/team-members/:id                       -> Update member (custom or default override)
DELETE /api/team-members/:id                       -> Delete member (403 if default, 400 if not archived)
POST   /api/team-members/:id/archive               -> Archive member
POST   /api/team-members/:id/unarchive             -> Unarchive member
POST   /api/team-members/:id/reset                 -> Reset default to code values (404 if not default)
```

No `ensureDefaults` endpoint — defaults are always present via code.

### 2.4 Session Spawn Integration

The existing spawn flow is **extended, not replaced:**

```typescript
// SpawnSessionPayload (updated)
interface SpawnSessionPayload {
  projectId: string;
  taskIds: string[];
  mode?: AgentMode;                    // Session-level: 'execute' or 'coordinate'
  strategy?: string;
  spawnSource?: 'ui' | 'session';
  sessionId?: string;
  sessionName?: string;
  skills?: string[];
  model?: string;
  agentTool?: AgentTool;
  context?: Record<string, any>;
  teamMemberIds?: string[];           // Team members for coordinate mode
  teamMemberId?: string;              // NEW: Team member running this session
}
```

**Resolution order when `teamMemberId` is provided:**
1. Resolve team member from repository
2. Create snapshot of team member config
3. Store `teamMemberId` and `teamMemberSnapshot` on the session
4. **Config priority for model/agentTool:** Spawn-time explicit > Team Member > Task > Project default
5. If `mode` not explicitly provided: default to `execute` for Worker, `coordinate` for Coordinator
6. Generate manifest using resolved config

**When `teamMemberId` is NOT provided:** Existing flow works exactly as today (backward compatible).

### 2.5 Container Registration

```typescript
// New registrations in container.ts
container.register('teamMemberRepo', new FileSystemTeamMemberRepository(dataDir));
container.register('teamMemberService', new TeamMemberService(
  container.resolve('teamMemberRepo'),
  container.resolve('eventBus'),
  container.resolve('idGenerator'),
));
```

### 2.6 Event Bus Extensions

New events (underscore convention, matching existing patterns like `task:session_added`):
```
team_member:created   { teamMember }
team_member:updated   { teamMember }
team_member:deleted   { teamMemberId }
team_member:archived  { teamMember }
```

WebSocket broadcasts these to connected clients for real-time UI updates.

---

## 3. CLI Integration

### 3.1 Extended Session Spawn Command

```bash
# Existing (still works)
maestro session spawn --task-ids <ids> --mode execute --strategy simple

# New: with team member
maestro session spawn --task-ids <ids> --team-member-id <tmId> --mode execute
```

The coordinator prompt includes instructions to use `--team-member-id` when spawning worker sessions:

```xml
<spawn_instructions>
  When spawning a worker session, specify the team member:
    maestro session spawn --task-ids <taskId> --team-member-id <teamMemberId> --mode execute
  Choose the best team member from the available team based on task requirements.
</spawn_instructions>
```

### 3.2 Manifest Changes

```typescript
interface MaestroManifest {
  // ... existing fields ...
  teamMemberId?: string;
  teamMemberName?: string;
  teamMemberAvatar?: string;
}
```

`ManifestGeneratorCLICommand` updated to:
1. Accept `--team-member-id` flag
2. Fetch team member from server API (new endpoint)
3. Include team member config in manifest

### 3.3 Prompt Builder Updates

`PromptBuilder.buildSystemXml()` now injects team member identity as an **additional block** alongside the default identity (append, not replace):

```xml
<maestro_system_prompt mode="execute" strategy="simple" version="3.0">
  <identity>
    <profile>maestro-agent</profile>
    <instruction>You are a worker agent. You implement tasks directly...</instruction>
  </identity>
  <team_member_identity>
    <name>Frontend Dev</name>
    <avatar>🎨</avatar>
    <role>Frontend specialist</role>
    <instructions>You specialize in React, TypeScript, and CSS. Focus on component architecture and accessibility...</instructions>
  </team_member_identity>
  <!-- ... capabilities, workflow, commands ... -->
</maestro_system_prompt>
```

Default Worker/Coordinator: no `<team_member_identity>` block (their identity IS the default).
Custom members: `<team_member_identity>` appended after `<identity>`.

### 3.4 Team Members XML for Coordinators

`PromptBuilder.buildTeamMembers()` continues to render `<team_members>` XML. Data source changes from task-based to API-based, but output XML format stays the same:

```xml
<team_members count="N">
  <team_member id="tm_..." name="Frontend Dev" role="Frontend specialist">
    <identity>persona prompt</identity>
    <avatar>🎨</avatar>
    <model>sonnet</model>
    <agent_tool>claude-code</agent_tool>
  </team_member>
</team_members>
```

---

## 4. Migration: Cleanup of Old Team Member Tasks

### 4.1 Type System Cleanup

Remove from **server** `types.ts`:
- `TaskType` type alias
- `TeamMemberMetadata` interface
- `taskType` field from `Task`, `CreateTaskPayload`, `UpdateTaskPayload`
- `teamMemberMetadata` field from `Task`, `CreateTaskPayload`, `UpdateTaskPayload`

Remove from **UI** `maestro.ts`:
- Same fields mirrored on client types

Remove from **CLI** `manifest.ts`:
- `taskType` and `teamMemberMetadata` from `TaskData`

### 4.2 Data Cleanup

On server startup (or as a one-time migration):
1. Scan all task files in `<dataDir>/tasks/`
2. Delete any task file where `taskType === 'team-member'`
3. Log deleted task IDs for audit

```typescript
// In container.initialize() or a dedicated migration
async function migrateTeamMemberTasks(taskRepo: ITaskRepository, logger: ILogger) {
  const allTasks = await taskRepo.findAll();
  const teamMemberTasks = allTasks.filter(t => t.taskType === 'team-member');
  for (const task of teamMemberTasks) {
    await taskRepo.delete(task.id);
    logger.info(`Migrated: deleted team-member task ${task.id} (${task.title})`);
  }
}
```

### 4.3 UI Code Cleanup

- Remove `taskType` filtering from `TaskFilters.tsx`
- Remove team-member-specific rendering from `TaskListItem.tsx`
- Remove `teamMemberMetadata` handling from create/update task flows
- Update Team tab to read from new `teamMembers` store instead of filtering tasks

---

## 5. UI Architecture

### 5.1 Store Additions (`useMaestroStore.ts`)

```typescript
interface MaestroState {
  // ... existing state ...

  // Team Members
  teamMembers: Map<string, TeamMember>;
  lastUsedTeamMember: Map<string, string>;  // taskId -> teamMemberId (persisted to localStorage)

  // Actions
  fetchTeamMembers(projectId: string): Promise<void>;
  createTeamMember(data: CreateTeamMemberInput): Promise<TeamMember>;
  updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<TeamMember>;
  deleteTeamMember(id: string): Promise<void>;
  archiveTeamMember(id: string): Promise<void>;
  unarchiveTeamMember(id: string): Promise<void>;
  resetDefaultTeamMember(id: string): Promise<void>;
  setLastUsedTeamMember(taskId: string, teamMemberId: string): void;
}
```

### 5.2 MaestroClient Extensions

```typescript
class MaestroClient {
  // ... existing methods ...

  // Team Members
  getTeamMembers(projectId: string): Promise<TeamMember[]>;
  createTeamMember(data: CreateTeamMemberInput): Promise<TeamMember>;
  updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<TeamMember>;
  deleteTeamMember(id: string): Promise<void>;
  archiveTeamMember(id: string): Promise<void>;
  unarchiveTeamMember(id: string): Promise<void>;
  resetDefaultTeamMember(id: string): Promise<void>;
}
```

### 5.3 Component Changes

#### MaestroPanel.tsx — Team Tab
- Renders from `teamMembers` store (not filtered tasks)
- **Active section:** Default members (non-deletable, with "Configure" + "Reset") + custom active members
- **Archived section:** Collapsed by default, shows archived members with "Unarchive" / "Delete" actions
- "+ New Team Member" button opens `CreateTeamMemberModal`

#### TaskListItem.tsx — Split Play Button
- Click **Play icon** -> Run with last-used team member for this task (default: Worker)
- Click **Chevron** -> Dropdown showing all active team members grouped by:
  - **Defaults:** Worker, Coordinator
  - **Custom:** User-created active members
- Selecting a team member stores it as `lastUsedTeamMember[taskId]` in localStorage
- Session chips show team member avatar from `teamMemberSnapshot`

#### SessionsSection.tsx
- Session rows show team member avatar prefix: `[🔧] sess_abc WORKING`
- Expanded session shows team member name and role (from snapshot)
- Archived team members still visible in session history via snapshot data

#### New: CreateTeamMemberModal
- Fields: Name, Role, Avatar (emoji picker), Identity (textarea), Model (dropdown), Agent Tool (dropdown), Skills (multi-select)
- Validation: Name required, unique within project

#### New: EditTeamMemberModal
- Same fields as create
- For defaults: shows "Reset to Default" button, some fields show "(Default: ...)" hints
- For custom: shows archive/delete options

### 5.4 WebSocket Event Handling

```typescript
'team_member:created'   -> teamMembers.set(id, member)
'team_member:updated'   -> teamMembers.set(id, { ...existing, ...updates })
'team_member:deleted'   -> teamMembers.delete(id)
'team_member:archived'  -> teamMembers.set(id, { ...existing, status: 'archived' })
```

---

## 6. UI/UX Flows

### 6.1 Single Task Execution (Most Common)

```
User clicks Play on task
  -> System checks lastUsedTeamMember[taskId] (default: Worker)
  -> Spawns session with teamMemberId=worker.id, mode='execute'
  -> Session stores teamMemberSnapshot
  -> Session chip shows [🔧 working]
```

### 6.2 Single Task with Specific Team Member

```
User clicks Chevron on task -> selects "🎨 Frontend Dev"
  -> Stores lastUsedTeamMember[taskId] = frontendDev.id
  -> Spawns session with teamMemberId=frontendDev.id, mode='execute'
  -> Session uses Frontend Dev's model, agentTool, identity
  -> Session chip shows [🎨 working]
```

### 6.3 Single Task Orchestration

```
User clicks Chevron on task -> selects "🎯 Coordinator"
  -> Inline panel expands below task:
    +--------------------------------------+
    | Orchestrate with Coordinator          |
    | Strategy: [default v]                |
    | Team: [🔧][🎨][🧪] [+ Add]         |
    |            [Cancel] [Play Start]      |
    +--------------------------------------+
  -> Coordinator spawns with mode='coordinate', strategy selected
  -> Coordinator receives task + available team members
  -> Coordinator dynamically assigns subtasks via:
      maestro session spawn --task-ids <id> --team-member-id <tmId> --mode execute
```

### 6.4 Team Member Management

```
User goes to Team tab
  -> ACTIVE section:
     Defaults: Worker [Configure] [Reset], Coordinator [Configure] [Reset]
     Custom: Frontend Dev [...], Tester [...]
  -> ARCHIVED section (collapsed):
     Old Member [Unarchive] [Delete]
  -> [+ New Member] -> Opens CreateTeamMemberModal
  -> [Configure] on any member -> Opens EditTeamMemberModal
  -> [...] on custom member -> Archive / Edit
```

---

## 7. Config Priority

When resolving `model` and `agentTool` for a session:

```
Priority (highest to lowest):
1. Spawn-time explicit params (from SpawnSessionPayload.model / .agentTool)
2. Team Member config (teamMember.model / .agentTool)
3. Task config (task.model / .agentTool)
4. Project default (from project settings or global defaults)
```

```typescript
function resolveModel(spawn: SpawnSessionPayload, teamMember?: TeamMember, task?: Task): string {
  return spawn.model
    ?? teamMember?.model
    ?? task?.model
    ?? 'sonnet';  // project/global default
}
```

---

## 8. Implementation Phases

### Phase 1: Server Foundation + Migration
1. Create `TeamMember` type in `types.ts` (without `mode`)
2. Remove `TaskType`, `TeamMemberMetadata`, `taskType`, `teamMemberMetadata` from types
3. Create `ITeamMemberRepository` interface
4. Implement `FileSystemTeamMemberRepository` with code defaults + override merge
5. Create `TeamMemberService` with CRUD + archive + reset
6. Create `teamMemberRoutes.ts` with REST endpoints
7. Register in `container.ts`
8. Add migration to delete old `taskType: 'team-member'` tasks on startup
9. Add WebSocket events for team member changes

### Phase 2: Session Integration + CLI
1. Add `teamMemberId` and `teamMemberSnapshot` to `MaestroSession` type
2. Update session spawn flow to resolve team member, create snapshot, apply config priority
3. Add `--team-member-id` flag to `maestro session spawn` CLI command
4. Update manifest generation to include team member data from new API
5. Update `PromptBuilder` to inject `<team_member_identity>` block
6. Update coordinator prompt to include spawn instructions with `--team-member-id`

### Phase 3: UI - Store, Client, & Team Tab
1. Add `teamMembers` + `lastUsedTeamMember` to `useMaestroStore`
2. Add team member methods to `MaestroClient`
3. Add WebSocket handlers for team member events
4. Fetch team members on project load
5. Update MaestroPanel Team tab to use new store
6. Create `CreateTeamMemberModal` and `EditTeamMemberModal`
7. Show defaults (non-deletable, configurable, resettable) + custom + archived sections
8. Remove old team-member task filtering/rendering from task components

### Phase 4: UI - Split Play Button & Session Integration
1. Implement split play button (Play + Chevron) on TaskListItem
2. Team member picker dropdown (defaults + custom active members)
3. Last-used team member per task (localStorage)
4. Team member avatar on session chips (from snapshot)
5. Expanded session shows team member info
6. Orchestration inline panel for coordinator selection

### Phase 5 (Future): Smart Launch Bar
- Multi-task batch execution
- Multi-task orchestration with team selection
- Deferred until single-task flow is validated

---

## 9. File Changes Summary

### New Files
```
maestro-server/src/domain/repositories/ITeamMemberRepository.ts
maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts
maestro-server/src/application/services/TeamMemberService.ts
maestro-server/src/api/teamMemberRoutes.ts
maestro-ui/src/components/maestro/CreateTeamMemberModal.tsx
maestro-ui/src/components/maestro/EditTeamMemberModal.tsx
maestro-ui/src/components/maestro/TeamMemberCard.tsx
maestro-ui/src/components/maestro/SplitPlayButton.tsx
```

### Modified Files
```
maestro-server/src/types.ts                    -- Add TeamMember type; REMOVE TaskType, TeamMemberMetadata
maestro-server/src/container.ts                -- Register new service & repo; add migration
maestro-server/src/server.ts                   -- Mount teamMemberRoutes
maestro-ui/src/app/types/maestro.ts            -- Add TeamMember type; REMOVE TaskType, TeamMemberMetadata
maestro-ui/src/stores/useMaestroStore.ts       -- Add teamMembers state & actions
maestro-ui/src/utils/MaestroClient.ts          -- Add team member API methods
maestro-ui/src/components/maestro/MaestroPanel.tsx  -- Update Team tab
maestro-ui/src/components/maestro/TaskListItem.tsx  -- Split play button
maestro-ui/src/components/maestro/TaskFilters.tsx   -- Remove taskType filtering
maestro-ui/src/components/SessionsSection.tsx       -- Team member avatars
maestro-cli/src/types/manifest.ts              -- Add teamMemberId; REMOVE taskType/teamMemberMetadata from TaskData
maestro-cli/src/commands/manifest-generator.ts -- Fetch team member from new API
maestro-cli/src/commands/session.ts            -- Add --team-member-id flag to spawn
maestro-cli/src/services/prompt-builder.ts     -- Add <team_member_identity> block
```

### Deleted Code (Migration)
```
- TaskType type alias (server + UI + CLI)
- TeamMemberMetadata interface (server + UI)
- taskType field on Task, CreateTaskPayload, UpdateTaskPayload (server + UI + CLI)
- teamMemberMetadata field on Task, CreateTaskPayload, UpdateTaskPayload (server + UI + CLI)
- Team-member-specific filtering in TaskFilters.tsx
- Team-member-specific rendering in TaskListItem.tsx
```

---

## 10. Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mode on TeamMember | **Removed** | Mode is session-level; TM defines identity, not behavior |
| Default storage | **Code defaults + disk overrides** | No race conditions; easy reset; version-safe |
| Default IDs | **Deterministic** (`tm_<projectId>_worker`) | Idempotent; no ensureDefaults needed |
| Task assignment | **Implicit** via session linkage | Avoids new entity; UI resolves via helper |
| Config priority | **TM > Task > Project** | Team member represents the executor; their config wins |
| Prompt injection | **Append** alongside default identity | Both default instructions and custom identity visible |
| CLI spawn | **Extend** existing `session spawn` | Fewer commands; backward compatible |
| Archive flow | **status field** + delete guard | Archive before delete; archived visible in history |
| Smart Launch Bar | **Deferred** to Phase 5 | Validate single-task flow first |
| Old team-member tasks | **Delete** on migration | Clean break; no zombie data |
| Event naming | **Underscore** (`team_member:created`) | Consistent with `task:session_added` pattern |
| Team member scope | **Project-scoped** | Simple; no cross-project concerns |
| Play button default | **Remember last-used** per task | Better UX for repeated operations |
