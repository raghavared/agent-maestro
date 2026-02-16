# Maestro Team Members - Complete Design Plan v3

## Executive Summary

This document defines the complete architecture for Team Members as a **first-class entity** in Maestro, separate from Tasks. Team Members are the identity and configuration layer that sits on top of Sessions. The two defaults — **Worker** and **Coordinator** — are always present per project. The existing Task and Session functionality remains untouched; Team Members layer on top.

---

## 1. Core Entities & Relationships

### 1.1 Entity Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAESTRO ENTITIES                             │
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Task    │    │ Team Member  │    │   Session    │              │
│  │          │    │              │    │              │              │
│  │ - title   │    │ - name       │    │ - status     │              │
│  │ - desc    │◄──►│ - role       │───►│ - strategy   │              │
│  │ - status  │    │ - identity   │    │ - events     │              │
│  │ - priority│    │ - avatar     │    │ - timeline   │              │
│  │ - skills  │    │ - model      │    │ - docs       │              │
│  └──────────┘    │ - agentTool  │    │ - teamMember │              │
│       ▲          │ - mode       │    │   Snapshot   │              │
│       │          │ - skills     │    └──────────────┘              │
│       │          │ - isDefault  │           ▲                      │
│       │          └──────────────┘           │                      │
│       │                                     │                      │
│       └─────────── many:many ──────────────┘                      │
│         (task.sessionIds / session.taskIds)                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Team Member Entity (NEW)

```typescript
interface TeamMember {
  id: string;                    // "tm_<timestamp>_<random>"
  projectId: string;
  name: string;                  // "Worker", "Coordinator", "Frontend Dev"
  role: string;                  // "Default executor", "Task orchestrator"
  identity: string;              // System prompt / persona instructions
  avatar: string;                // Emoji: "🔧", "🎯", "🎨"
  mode: 'execute' | 'coordinate';
  model?: string;                // "opus", "sonnet", "haiku"
  agentTool?: AgentTool;         // "claude-code", "codex", "gemini"
  skillIds?: string[];
  isDefault: boolean;            // true for Worker & Coordinator
  createdAt: string;
  updatedAt: string;
}
```

### 1.3 Default Team Members (Hybrid - Stored with Defaults)

On project creation (or first access), two defaults are auto-created:

```typescript
const DEFAULT_WORKER: Partial<TeamMember> = {
  name: 'Worker',
  role: 'Default executor',
  identity: 'You are a worker agent. You implement tasks directly...',
  avatar: '🔧',
  mode: 'execute',
  isDefault: true,
};

const DEFAULT_COORDINATOR: Partial<TeamMember> = {
  name: 'Coordinator',
  role: 'Task orchestrator',
  identity: 'You are a coordinator agent. You NEVER write code...',
  avatar: '🎯',
  mode: 'coordinate',
  isDefault: true,
};
```

These are stored in the TeamMember repository per project. Users can customize model, agentTool, skills, and even identity — but cannot delete them.

### 1.4 Session Team Member Snapshot

When a session is spawned through a team member, the session stores:

```typescript
// Added to MaestroSession
interface MaestroSession {
  // ... existing fields ...
  teamMemberId?: string;              // Reference to the team member
  teamMemberSnapshot?: {              // Config at spawn time
    name: string;
    avatar: string;
    role: string;
    mode: 'execute' | 'coordinate';
    model?: string;
    agentTool?: AgentTool;
  };
}
```

This ensures historical accuracy — if a team member's config changes, past sessions still reflect what was used at spawn time.

---

## 2. Server Architecture

### 2.1 New Repository: ITeamMemberRepository

```typescript
interface ITeamMemberRepository {
  findById(id: string): Promise<TeamMember | null>;
  findByProjectId(projectId: string): Promise<TeamMember[]>;
  findDefaults(projectId: string): Promise<TeamMember[]>;
  create(member: TeamMember): Promise<TeamMember>;
  update(id: string, updates: Partial<TeamMember>): Promise<TeamMember>;
  delete(id: string): Promise<void>;
  ensureDefaults(projectId: string): Promise<void>;
}
```

**Implementation:** `FileSystemTeamMemberRepository` — stores in `<dataDir>/team-members/` as JSON files, one per team member.

### 2.2 New Service: TeamMemberService

```typescript
class TeamMemberService {
  // CRUD
  createTeamMember(projectId: string, data: CreateTeamMemberInput): Promise<TeamMember>;
  getTeamMember(id: string): Promise<TeamMember>;
  getProjectTeamMembers(projectId: string): Promise<TeamMember[]>;
  updateTeamMember(id: string, updates: UpdateTeamMemberInput): Promise<TeamMember>;
  deleteTeamMember(id: string): Promise<void>;  // Throws if isDefault

  // Defaults management
  ensureProjectDefaults(projectId: string): Promise<void>;

  // Session integration
  getTeamMemberSnapshot(id: string): Promise<TeamMemberSnapshot>;
}
```

### 2.3 New API Routes: `/api/team-members`

```
GET    /api/team-members?projectId=X          → List all members for project
POST   /api/team-members                       → Create new member
GET    /api/team-members/:id                   → Get member by ID
PATCH  /api/team-members/:id                   → Update member
DELETE /api/team-members/:id                   → Delete member (403 if default)
POST   /api/team-members/:projectId/ensure-defaults → Ensure defaults exist
```

### 2.4 Session Spawn Integration

The existing session spawn flow (`POST /sessions/:id/spawn`) is extended:

```
Current:  spawn(taskIds, strategy, mode, model, agentTool)
Proposed: spawn(taskIds, teamMemberId, strategy?)
```

When `teamMemberId` is provided:
1. Resolve team member from repository
2. Create snapshot of team member config
3. Store `teamMemberId` and `teamMemberSnapshot` on the session
4. Use team member's `mode`, `model`, `agentTool`, `skillIds` for manifest generation
5. Strategy defaults to team member's mode defaults (simple for execute, default for coordinate)
6. Override strategy if explicitly provided

### 2.5 Container Registration

```typescript
// New registrations in container.ts
container.register('teamMemberRepository', new FileSystemTeamMemberRepository(dataDir));
container.register('teamMemberService', new TeamMemberService(
  container.resolve('teamMemberRepository'),
  container.resolve('eventBus'),
  container.resolve('idGenerator'),
));
```

### 2.6 Event Bus Extensions

New events:
```
team_member:created  { teamMember }
team_member:updated  { teamMember }
team_member:deleted  { teamMemberId }
```

WebSocket broadcasts these to connected clients for real-time UI updates.

---

## 3. CLI Integration

### 3.1 Manifest Changes

The `MaestroManifest` gets a new field:

```typescript
interface MaestroManifest {
  // ... existing fields ...
  teamMemberId?: string;
  teamMemberName?: string;
  teamMemberAvatar?: string;
}
```

The `teamMembers[]` array in the manifest (for coordinate mode) now references the new TeamMember entities instead of task-based team member data. The `ManifestGeneratorCLICommand` fetches team members from the new server API instead of reading tasks with `taskType: 'team-member'`.

### 3.2 Prompt Builder Updates

`PromptBuilder.buildTeamMembers()` continues to render `<team_members>` XML. The data source changes from task-based to API-based, but the output XML format stays the same for backward compatibility with existing coordinator prompts.

### 3.3 Spawner Identity

Each spawner can now include team member identity in the system prompt:

```xml
<identity>
  <name>Frontend Dev</name>
  <avatar>🎨</avatar>
  <role>Frontend specialist</role>
  <instructions>You specialize in React, TypeScript, and CSS...</instructions>
</identity>
```

This is injected into the existing `<maestro_system_prompt>` XML.

---

## 4. UI Architecture

### 4.1 New Store Additions (`useMaestroStore.ts`)

```typescript
interface MaestroState {
  // ... existing state ...

  // Team Members
  teamMembers: Map<string, TeamMember>;

  // Actions
  fetchTeamMembers(projectId: string): Promise<void>;
  createTeamMember(data: CreateTeamMemberInput): Promise<TeamMember>;
  updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<TeamMember>;
  deleteTeamMember(id: string): Promise<void>;
}
```

### 4.2 MaestroClient Extensions

```typescript
class MaestroClient {
  // ... existing methods ...

  // Team Members
  getTeamMembers(projectId: string): Promise<TeamMember[]>;
  createTeamMember(data: CreateTeamMemberInput): Promise<TeamMember>;
  updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<TeamMember>;
  deleteTeamMember(id: string): Promise<void>;
  ensureTeamMemberDefaults(projectId: string): Promise<void>;
}
```

### 4.3 Component Changes

#### MaestroPanel.tsx
- **Team Tab**: Now renders from `teamMembers` store instead of filtering tasks by `taskType`
- Default members (Worker, Coordinator) always shown at top, non-deletable
- Custom members shown below with full CRUD
- "New Team Member" button opens `CreateTeamMemberModal`

#### TaskListItem.tsx — Split Play Button
- Click **▶** → Run with default Worker (simple strategy)
- Click **▾** → Dropdown showing all team members organized by type
- Session chips show team member avatar (from `teamMemberSnapshot`)

#### SessionsSection.tsx
- Session rows show team member avatar prefix: `[🔧] sess_abc WORKING`
- Expanded session shows team member name and role

#### New: CreateTeamMemberModal
- Similar to CreateTaskModal in structure
- Fields: Name, Role, Avatar (emoji picker), Identity (textarea), Model, Agent Tool, Skills
- For defaults: some fields read-only (name, avatar, isDefault)

#### Smart Launch Bar (Multi-Select)
- "Run with" dropdown lists all team members
- Strategy auto-switches based on selected member's mode
- Team pills (for coordinator mode) show available members

### 4.4 WebSocket Event Handling

New events in the store's WebSocket handler:
```typescript
'team_member:created'  → teamMembers.set(id, member)
'team_member:updated'  → teamMembers.set(id, { ...existing, ...updates })
'team_member:deleted'  → teamMembers.delete(id)
```

---

## 5. UI/UX Flows

### 5.1 Single Task Execution (Most Common)

```
User clicks ▶ on task
  → System resolves default Worker team member
  → Spawns session with teamMemberId=worker.id
  → Session stores teamMemberSnapshot
  → Session chip shows [🔧 working]
```

### 5.2 Single Task with Specific Team Member

```
User clicks ▾ on task → selects "🎨 Frontend Dev"
  → Spawns session with teamMemberId=frontendDev.id
  → Session uses Frontend Dev's model, agentTool, identity
  → Session chip shows [🎨 working]
```

### 5.3 Single Task Orchestration

```
User clicks ▾ on task → selects "🎯 Coordinator"
  → Inline panel expands below task:
    ┌──────────────────────────────────────┐
    │ Orchestrate with Coordinator          │
    │ Strategy: [default ▾]                │
    │ Assignment: (●) Auto  ( ) Manual     │
    │ Team: [🔧][🎨][🧪] [+ Add]         │
    │            [Cancel] [▶ Start]        │
    └──────────────────────────────────────┘
  → Coordinator spawns, analyzes task, decomposes
  → Coordinator dynamically assigns subtasks to team members
  → Each assignment spawns a new session with that team member
```

### 5.4 Multi-Task Batch Execution

```
User toggles "Select" → checks 3 tasks
  → Smart Launch Bar slides up:
    ┌────────────────────────────────────────────┐
    │ ☑ 3 tasks   [Select All] [Clear]           │
    │ Run with: [🔧 Worker ▾]  Strategy: [simple]│
    │                    [Cancel] [▶ Run 3 Tasks] │
    └────────────────────────────────────────────┘
  → Each task gets its own session with the selected team member
```

### 5.5 Multi-Task Orchestration with Auto-Assignment

```
User selects 3 tasks → chooses "🎯 Coordinator" in Launch Bar
  → Launch Bar expands:
    ┌──────────────────────────────────────────────────┐
    │ ☑ 3 tasks   [Select All] [Clear]                  │
    │ Run with: [🎯 Coordinator ▾]  Strategy: [default] │
    │ Assignment: [Auto-assign ▾]                        │
    │ Team: [🔧 Worker ×] [🎨 Frontend ×] [+ Add]      │
    │                   [Cancel] [▶ Orchestrate 3 Tasks] │
    └──────────────────────────────────────────────────┘
  → Single coordinator session spawned
  → Coordinator receives all 3 tasks + available team members
  → Coordinator dynamically assigns each task to best team member
```

### 5.6 Team Member Management

```
User goes to Team tab
  → DEFAULT section: Worker, Coordinator (non-deletable)
  → CUSTOM section: User-created members
  → [+ New Member] → Opens CreateTeamMemberModal
  → [Configure] on any member → Opens modal for editing
  → [...] on custom member → Edit / Delete options
```

---

## 6. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         UI LAYER                                  │
│                                                                   │
│  MaestroPanel ─────┬───── TaskListItem (Split Play)              │
│       │            │           │                                  │
│  Team Tab          │     Click ▶ / ▾                             │
│  (TeamMemberList)  │           │                                  │
│       │            │     Select Team Member                       │
│       │            │           │                                  │
│  useMaestroStore ──┴───────────┘                                 │
│       │                                                           │
│  MaestroClient                                                   │
└──────┬───────────────────────────────────────────────────────────┘
       │  HTTP / WebSocket
┌──────▼───────────────────────────────────────────────────────────┐
│                       SERVER LAYER                                │
│                                                                   │
│  teamMemberRoutes ──► TeamMemberService ──► TeamMemberRepo       │
│       │                     │                     │               │
│  sessionRoutes ────► SessionService              FileSystem      │
│       │                     │                                     │
│       │              On spawn: resolve team member,               │
│       │              create snapshot, generate manifest            │
│       │                     │                                     │
│  EventBus ◄─────────────────┘                                    │
│       │                                                           │
│  WebSocket Gateway ──► Broadcast to UI clients                   │
└──────────────────────────────────────────────────────────────────┘
       │
┌──────▼───────────────────────────────────────────────────────────┐
│                        CLI LAYER                                  │
│                                                                   │
│  ManifestGenerator ──► Fetches team members from server API      │
│       │                                                           │
│  PromptBuilder ──────► Renders <team_members> XML (unchanged)    │
│       │                                                           │
│  AgentSpawner ───────► Injects team member identity into prompt  │
│       │                                                           │
│  Claude/Codex/Gemini Spawner ──► Runs agent with full config     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Migration Strategy

### What Changes
- New `TeamMember` entity, repository, service, and API routes
- Session spawn accepts `teamMemberId` (optional, backward compatible)
- Session model gets `teamMemberId` and `teamMemberSnapshot` fields
- UI Team tab reads from new API instead of task store
- ManifestGenerator fetches from new API for coordinate mode

### What Stays the Same
- All Task CRUD, ordering, dependencies, references
- All Session lifecycle, events, timeline, docs
- Existing session spawn without teamMemberId still works
- Task `taskType: 'team-member'` data is left in place (ignored, not migrated)
- All WebSocket events for tasks and sessions
- PromptBuilder XML output format
- Coordinator prompt structure

### Backward Compatibility
- Sessions spawned without a teamMemberId work exactly as today
- The Play button defaults to Worker, which is the same as current simple execute
- Existing API clients don't need to change (teamMemberId is optional)

---

## 8. Implementation Phases

### Phase 1: Server Foundation
1. Create `TeamMember` type in `types.ts`
2. Create `ITeamMemberRepository` interface
3. Implement `FileSystemTeamMemberRepository`
4. Create `TeamMemberService` with CRUD + ensureDefaults
5. Create `teamMemberRoutes.ts` with REST endpoints
6. Register in `container.ts`
7. Add WebSocket events for team member changes

### Phase 2: Session Integration
1. Add `teamMemberId` and `teamMemberSnapshot` to `MaestroSession` type
2. Update session spawn flow to resolve team member and create snapshot
3. Update manifest generation to use new team member API
4. Update CLI `ManifestGeneratorCLICommand` to fetch from new API

### Phase 3: UI - Store & Client
1. Add `teamMembers` to `useMaestroStore`
2. Add team member methods to `MaestroClient`
3. Add WebSocket handlers for team member events
4. Fetch team members on project load

### Phase 4: UI - Team Tab
1. Update MaestroPanel Team tab to use new store
2. Create `CreateTeamMemberModal` (similar to CreateTaskModal)
3. Show defaults section (non-deletable) + custom section
4. Configure button → opens modal for editing

### Phase 5: UI - Task List Item Redesign
1. Replace Pin + Play with Split Play + Three-Dot Menu
2. Implement split-play dropdown with team member picker
3. Add team member avatar to session chips
4. Implement three-dot management menu

### Phase 6: UI - Smart Launch Bar
1. Replace ExecutionBar execute/orchestrate buttons with Select toggle
2. Implement sticky bottom Launch Bar
3. "Run with" dropdown with team members
4. Strategy auto-switching based on member mode
5. Coordinator-specific: assignment mode + team pills

### Phase 7: Session Panel Integration
1. Show team member avatar on session rows
2. Expanded session shows team member info
3. Filter sessions by team member

---

## 9. File Changes Summary

### New Files
```
maestro-server/src/domain/repositories/ITeamMemberRepository.ts
maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts
maestro-server/src/application/services/TeamMemberService.ts
maestro-server/src/api/teamMemberRoutes.ts
maestro-ui/src/components/maestro/CreateTeamMemberModal.tsx
maestro-ui/src/components/maestro/TeamMemberCard.tsx
maestro-ui/src/components/maestro/SplitPlayButton.tsx
maestro-ui/src/components/maestro/SmartLaunchBar.tsx
maestro-ui/src/components/maestro/ThreeDotMenu.tsx
```

### Modified Files
```
maestro-server/src/types.ts                    — Add TeamMember type, update MaestroSession
maestro-server/src/container.ts                — Register new service & repo
maestro-server/src/server.ts                   — Mount teamMemberRoutes
maestro-ui/src/app/types/maestro.ts            — Add TeamMember type, update Session
maestro-ui/src/stores/useMaestroStore.ts       — Add teamMembers state & actions
maestro-ui/src/utils/MaestroClient.ts          — Add team member API methods
maestro-ui/src/components/maestro/MaestroPanel.tsx  — Update Team tab
maestro-ui/src/components/maestro/TaskListItem.tsx  — Split play + three-dot
maestro-ui/src/components/SessionsSection.tsx       — Team member avatars
maestro-cli/src/types/manifest.ts              — Add teamMemberId to manifest
maestro-cli/src/commands/manifest-generator.ts — Fetch from new API
```

---

## 10. Open Design Decisions (Resolved)

| Question | Decision |
|----------|----------|
| Storage for team members | **Separate repository** — own entity, not tasks |
| Default team members | **Hybrid** — stored with defaults, customizable per project |
| Session ↔ team member link | **Snapshot** — store both ID and config snapshot at spawn time |
| Coordinator auto-assignment | **Dynamic** — coordinator decides during execution |
| Team member config UI | **Modal** — similar to CreateTaskModal |
| Migration | **No migration** — ignore old task-based team members, new functionality works independently |
| Team member scope | **Project-scoped** — each project has its own members |
