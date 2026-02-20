# Team Members, Teams & Siblings - Complete Understanding Guide

## Overview

The maestro system features a sophisticated multi-agent orchestration framework built around **Team Members**, **Teams**, and **Siblings** (peer workers). This document comprehensively explains how these components work together, their execution modes, spawning mechanisms, and UI representation.

---

## 1. TEAM MEMBERS

### 1.1 What is a Team Member?

A **Team Member** is a distinct agent identity with unique capabilities, role, and execution parameters. Each team member represents a specific agent (execution or coordination) that can be spawned as a session to work on tasks.

### 1.2 Team Member Data Structure

```typescript
interface TeamMember {
  id: string;                    // Unique identifier
  projectId: string;             // Project ownership
  name: string;                  // Display name
  role: string;                  // Role description (e.g., "Default executor")
  identity: string;              // System prompt/persona for the agent
  avatar: string;                // Emoji or visual identifier
  model?: ModelType;             // AI model: 'haiku', 'sonnet', 'opus'
  agentTool?: AgentTool;        // Tool: 'claude-code', 'codex', 'gemini'
  mode?: AgentMode;              // Execution mode: 'execute' or 'coordinate'
  permissionMode?: string;       // Permission level: 'acceptEdits', 'interactive', 'readOnly', 'bypassPermissions'
  strategy?: WorkerStrategy | OrchestratorStrategy;
  skillIds?: string[];           // Assigned skills for this member
  isDefault: boolean;            // Whether this is a default team member
  status: TeamMemberStatus;      // 'active' or 'archived'
  soundInstrument?: InstrumentType;  // 'piano', 'guitar', 'violin', 'trumpet', 'drums'
  capabilities?: {
    can_spawn_sessions?: boolean;
    can_edit_tasks?: boolean;
    can_report_task_level?: boolean;
    can_report_session_level?: boolean;
  };
  commandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };
  workflowTemplateId?: string;
  customWorkflow?: string;
  memory?: string[];             // Persistent memory entries for self-awareness
  createdAt: string;
  updatedAt: string;
}
```

### 1.3 Default Team Members

The system comes with built-in default team members:

1. **Simple Worker** ⚡
   - Role: Default executor
   - Mode: execute
   - Identity: "You are a worker agent. You implement tasks directly — write code, run tests, fix bugs."
   - Default model: Sonnet

2. **Coordinator** 🎯
   - Role: Task orchestrator
   - Mode: coordinate
   - Identity: "You are a coordinator agent. You break down complex tasks, assign work to team members, and track progress."
   - Default model: Sonnet

3. **Batch Coordinator** 📦
   - Role: Intelligent batch orchestrator
   - Mode: coordinate
   - Strategy: queue-based batching
   - Identity: "You are a batch coordinator agent. You group related tasks into intelligent batches."

4. **DAG Coordinator** 🔄
   - Role: DAG-based orchestrator
   - Mode: coordinate
   - Strategy: DAG-based dependency management
   - Identity: "You are a DAG coordinator agent. You model task dependencies as a directed acyclic graph."

5. **Recruiter** 🔍
   - Role: Team member recruiter with skill discovery
   - Mode: execute
   - Identity: "You are a recruiter agent. You analyze task requirements, discover and install relevant skills..."

### 1.4 Creating and Managing Team Members

#### Via Backend API (Express Routes)

**GET /team-members?projectId=X**
- Retrieves all team members (defaults merged + custom) for a project

**POST /team-members**
- Creates a custom team member
- Payload: `CreateTeamMemberPayload`

**GET /team-members/:id?projectId=X**
- Retrieves a specific team member by ID

**PATCH /team-members/:id**
- Updates a team member
- Payload: `UpdateTeamMemberPayload`

**DELETE /team-members/:id?projectId=X**
- Deletes a team member (403 if default, 400 if not archived)

**POST /team-members/:id/archive**
- Archives a team member (soft delete)

**POST /team-members/:id/unarchive**
- Restores an archived team member

**POST /team-members/:id/memory**
- Appends entries to team member's persistent memory

**POST /team-members/:id/reset**
- Resets default team member to code values (404 if not default)

#### Via CLI Commands

```bash
maestro team-member list [--all] [--status active|archived] [--mode execute|coordinate]
maestro team-member get <teamMemberId>
maestro team-member edit <teamMemberId> [options]
  --name <name>
  --role <role>
  --avatar <emoji>
  --mode execute|coordinate
  --model <model>
  --agent-tool <tool>
  --permission-mode <mode>
  --identity <instructions>
  --skills <skills>
  --workflow-template <templateId>
  --custom-workflow <workflow>
```

### 1.5 Team Member UI Components

**TeamMemberModal.tsx** - Comprehensive team member editor
- Full CRUD operations
- Visual builder for capabilities and permissions
- Mentions integration for identity templates
- Sound instrument assignment
- Default configuration templates

**TeamMemberList.tsx** - List display with actions
- Shows all team members
- Archive/unarchive/delete actions
- Edit, run, and status indicators
- Filter by archived status

---

## 2. TEAMS

### 2.1 What is a Team?

A **Team** is a container that groups together multiple Team Members (workers and a leader/coordinator). Teams provide organization and collective task management capabilities.

### 2.2 Team Data Structure

```typescript
interface Team {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  avatar?: string;
  leaderId: string;              // Team leader (usually a coordinator)
  memberIds: string[];           // Worker team members
  subTeamIds: string[];          // Child teams (hierarchical)
  parentTeamId?: string;
  status: TeamStatus;            // 'active' or 'archived'
  createdAt: string;
  updatedAt: string;
}
```

### 2.3 Team Hierarchy

Teams can be hierarchical:
- **Parent Teams** → contain multiple child teams (subTeamIds)
- **Sub-Teams** → belong to a parent team (parentTeamId)
- This allows for complex organizational structures

### 2.4 Managing Teams

#### Via Backend API (Express Routes)

**GET /teams?projectId=X**
- Lists all active teams for a project

**POST /teams**
- Creates a new team

**GET /teams/:id?projectId=X**
- Gets team details

**PATCH /teams/:id**
- Updates team properties

**DELETE /teams/:id?projectId=X**
- Deletes a team (must be archived first)

**POST /teams/:id/archive**
- Archives a team

**POST /teams/:id/unarchive**
- Restores an archived team

**POST /teams/:id/members**
- Adds members to a team

**DELETE /teams/:id/members**
- Removes members from a team

**POST /teams/:id/sub-teams**
- Adds a sub-team

**DELETE /teams/:id/sub-teams**
- Removes a sub-team

### 2.5 Team UI Components

**TeamModal.tsx** - Team creation/editing interface
**TeamListItem.tsx** - Individual team display with:
  - Team name, avatar, leader info
  - Member count
  - Sub-team hierarchy
  - Archive/delete controls
  - Expandable details view

---

## 3. SESSIONS & TEAM MEMBER BINDING

### 3.1 Single vs. Multiple Team Members per Session

Sessions can be bound to:

**Single Team Member Mode:**
```typescript
teamMemberId: string;              // One agent identity
teamMemberSnapshot: TeamMemberSnapshot;
```

**Multiple Team Members Mode:**
```typescript
teamMemberIds: string[];           // Multiple agents
teamMemberSnapshots: TeamMemberSnapshot[];
```

### 3.2 Session Spawning with Team Members

When a session is spawned (via `handleSpawnTerminalSession`):

1. **Data is embedded** from the team member at spawn time:
   ```typescript
   teamMemberSnapshot: {
     name: member.name,
     avatar: member.avatar,
     role: member.role,
     model?: member.model,
     agentTool?: member.agentTool,
     permissionMode?: member.permissionMode,
   }
   ```

2. **Session records reference** the team member(s):
   - For single: `session.teamMemberId` (e.g., "Simple Worker")
   - For multiple: `session.teamMemberIds` (e.g., ["⚡", "🎯", "📦"])

3. **Identity propagation**: The team member's `identity` field becomes the system prompt for the spawned agent session

### 3.3 MaestroSession Fields

```typescript
interface MaestroSession {
  id: string;
  projectId: string;
  name: string;
  status: MaestroSessionStatus;   // 'spawning', 'idle', 'working', 'completed', 'failed', 'stopped'

  // Single team member
  teamMemberId?: string;
  teamMemberSnapshot?: TeamMemberSnapshot;

  // Multiple team members
  teamMemberIds?: string[];
  teamMemberSnapshots?: TeamMemberSnapshot[];

  // Execution parameters
  mode?: AgentMode;               // 'execute' or 'coordinate'
  strategy?: WorkerStrategy;      // 'simple' or 'queue'
  orchestratorStrategy?: OrchestratorStrategy;
  model?: ModelType;

  // Additional fields
  taskIds: string[];
  timeline: SessionTimelineEvent[];
  events: MaestroSessionEvent[];
  env: Record<string, string>;
  // ... more fields
}
```

---

## 4. SIBLINGS - PEER WORKERS

### 4.1 What are Siblings?

**Siblings** are peer worker sessions that are spawned as part of the same coordination effort. They can communicate with each other via messaging and share context.

### 4.2 Sibling Discovery and Communication

#### Discovery
Siblings discover each other through the maestro session system:
- All active sessions for the same task/project can see each other
- Session registry maintains `agentIdleTimersRef` and other peer data

#### Communication
Via **maestro CLI** (from within an agent session):

**Peer Discovery:**
```bash
maestro session siblings
# Returns: session ID, name, role, status for each active peer
```

**Peer Messaging:**
```bash
maestro session prompt <siblingSessionId> --message "<your question or info>"
# or persistent message:
maestro session notify <siblingSessionId> --message "<brief>" [--detail "<longer context>"]
```

**Reading Messages:**
```bash
maestro session mail read
# Reads messages sent by sibling sessions
```

### 4.3 Sibling Coordination Patterns

**Pattern 1: Direct Messaging**
```
Coordinator → Worker 1: "Analyze the API"
Coordinator → Worker 2: "Write tests"
Worker 1 ↔ Worker 2: "Share findings"
```

**Pattern 2: PTY Injection**
- Server broadcasts `session:prompt_send` events to multiple sessions
- Agents can inject commands/prompts directly into peer terminals

**Pattern 3: Shared Task Context**
- All siblings can access the same task definitions
- Each maintains its own session state
- Coordinated via task status updates

---

## 5. EXECUTION MODES IN UI SESSION VIEW

### 5.1 Display States

Sessions are displayed in the **MultiProjectSessionsView** with:

1. **Terminal Display** - Raw terminal output and interaction
2. **Timeline Display** - Session events in chronological order

### 5.2 Session Status Indicators

Each session shows:
- Status badge: `spawning`, `idle`, `working`, `completed`, `failed`, `stopped`
- Team member avatar/name if bound
- Working indicator: flashing when agent is actively processing
- Project association (color-coded)

### 5.3 Grouped vs. Unified View

**Grouped Mode:**
- Sessions organized by project
- Each project gets its own container
- Easy to work within a single project context

**Unified Mode:**
- All sessions across projects in one view
- Customizable ordering (persisted to localStorage)
- Better for cross-project coordination

---

## 6. SYNCHRONIZATION & REAL-TIME UPDATES

### 6.1 WebSocket Events

The system uses global WebSocket singleton for real-time updates:

```typescript
// Global WebSocket singleton
let globalWs: WebSocket | null = null;

// Events handled:
case 'session:created'
case 'session:updated'
case 'session:deleted'
case 'session:spawn'
case 'session:prompt_send'
case 'team_member:created'
case 'team_member:updated'
case 'team_member:archived'
case 'team_member:deleted'
case 'team:created'
case 'team:updated'
case 'team:archived'
case 'team:deleted'
case 'notify:*' (task/session notifications)
```

### 6.2 Store Synchronization

**useMaestroStore** maintains:
- `Map<string, MaestroSession>` - All maestro sessions
- `Map<string, TeamMember>` - All team members
- `Map<string, Team>` - All teams
- `Map<string, string[]>` - Session/task ordering per project

### 6.3 Optimistic Updates

The store performs optimistic updates for immediate UI feedback:
```typescript
// Immediately update local state
set((prev) => ({ sessions: new Map(prev.sessions).set(session.id, session) }));
// WebSocket will confirm or correct
```

---

## 7. TEAM MEMBER LIFECYCLE

### 7.1 Default to Custom

**Default Team Members:**
- Built-in with fixed configurations
- Cannot be deleted (403 Forbidden)
- Can be reset to defaults with POST `/reset`
- Can be overridden per-project

**Custom Team Members:**
- Created via UI or API
- Full CRUD operations available
- Can be archived/unarchived
- Can be deleted if archived

### 7.2 Status Transitions

```
        ↓
    ACTIVE ←→ ARCHIVED
        ↓
    (deleted)
```

### 7.3 Memory Management

Team members can have persistent memory:
```typescript
memory?: string[];  // Array of memory entries

// Append memory:
POST /team-members/:id/memory
{ projectId, entries: ["entry1", "entry2"] }
```

---

## 8. EXECUTION MODES & STRATEGIES

### 8.1 Agent Modes

**Execute Mode:**
- Focus: Direct task implementation
- Capabilities: Write code, fix bugs, run tests
- Default strategy: 'simple' (single-threaded)
- Permissions: Can spawn sub-sessions if capability enabled

**Coordinate Mode:**
- Focus: Task decomposition & delegation
- Capabilities: Break down tasks, assign workers, track progress
- Strategies:
  - 'default' - Basic task orchestration
  - 'intelligent-batching' - Group related tasks
  - 'dag' - Model dependencies as DAG

### 8.2 Worker Strategy

**Simple:**
- Sequential task execution
- Single worker handling all tasks
- Minimal coordination overhead

**Queue:**
- Task queueing system
- Better for batch processing
- Enables batching optimizations

### 8.3 Orchestrator Strategy

**Default:**
- Basic task assignment
- Linear progression

**Intelligent-Batching:**
- Groups related tasks into efficient batches
- Reduces context switching
- Batch Coordinator role

**DAG (Directed Acyclic Graph):**
- Models task dependencies
- Parallel execution where possible
- Optimizes for dependency graphs
- DAG Coordinator role

---

## 9. TEAM MEMBER REFERENCE IN UI

### 9.1 Task Assignment

Tasks can be assigned to team members:
```typescript
interface MaestroTask {
  teamMemberId?: string;      // Single assignment
  teamMemberIds?: string[];   // Multiple assignments
}
```

When executing a task:
1. UI displays assigned team member(s) as chips/badges
2. Session is spawned with that team member's identity
3. Session maintains reference to team member(s)

### 9.2 Session Spawning with Team Members

In **MaestroPanel.tsx**:
```typescript
const handleCreateMaestroSession = async (task, teamMemberId) => {
  // 1. Look up team member
  const member = teamMembersMap.get(teamMemberId);

  // 2. Create session with member's configuration
  await createMaestroSession({
    projectId,
    taskIds: [task.id],
    teamMemberId: member.id,
    agentTool: member.agentTool,
    model: member.model,
    mode: member.mode,
    teamMemberIds: [member.id],
  });
};
```

### 9.3 Multi-Session Execution

For batch/DAG orchestration:
1. Coordinator is spawned with `mode: 'coordinate'`
2. Coordinator spawns worker sessions for each task
3. Workers are siblings with direct communication
4. All linked to the same team context

---

## 10. SOUND & IDENTITY

### 10.1 Sound Configuration

Each team member can have a sound instrument:
```typescript
soundInstrument?: 'piano' | 'guitar' | 'violin' | 'trumpet' | 'drums';
```

When multiple team members work together:
- Each plays their instrument for events they trigger
- Creates an "ensemble" effect for multi-agent work
- Auditory feedback for agent activity

### 10.2 Team Member Identity

The `identity` field contains system instructions:
```typescript
identity: "You are a worker agent. You implement tasks directly — write code, run tests, fix bugs."
```

This becomes the system prompt when the session is spawned, enabling role-based behavior.

---

## 11. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────┐
│         UI (React Components)                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ MaestroPanel                                     │  │
│  │  - TeamMemberList (display)                      │  │
│  │  - TeamMemberModal (create/edit)                 │  │
│  │  - MultiProjectSessionsView (session display)    │  │
│  └──────────────────────────────────────────────────┘  │
└────────────┬──────────────────────────────────────────┘
             │ useMaestroStore
             ↓
    ┌─────────────────────┐
    │  Zustand Store      │
    │  - teamMembers Map  │
    │  - teams Map        │
    │  - sessions Map     │
    │  - WebSocket sync   │
    └────────┬────────────┘
             │ WebSocket
             ↓
┌─────────────────────────────────────────────────────────┐
│         Backend Server (Express + WebSocket)            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Routes:                                          │  │
│  │  - /team-members (CRUD)                          │  │
│  │  - /teams (CRUD)                                 │  │
│  │  - /sessions (spawn, update)                     │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Services:                                        │  │
│  │  - TeamMemberService                             │  │
│  │  - TeamService                                   │  │
│  │  - SessionService                                │  │
│  └──────────────────────────────────────────────────┘  │
└────────────┬──────────────────────────────────────────┘
             │ CLI API
             ↓
┌─────────────────────────────────────────────────────────┐
│         Agent Sessions (PTY)                            │
│  - Spawned with team member identity                   │
│  - Can discover siblings                               │
│  - Can send/receive messages                           │
│  - Report progress via maestro commands                │
└─────────────────────────────────────────────────────────┘
```

---

## 12. KEY CONCEPTS SUMMARY

| Concept | Purpose | Example |
|---------|---------|---------|
| **Team Member** | Agent identity with configuration | Simple Worker ⚡, Coordinator 🎯 |
| **Team** | Container for multiple members | "Backend Team", "Frontend Team" |
| **Session** | Running instance of team member | ⚡ Terminal #1 working on task-123 |
| **Siblings** | Peer sessions in same context | Multiple workers under one coordinator |
| **Mode** | Execution style | execute (implement) vs coordinate (delegate) |
| **Strategy** | Task handling approach | simple, queue, DAG |
| **Identity** | System prompt for agent | "You are a worker agent..." |
| **Snapshot** | Team member state at spawn | Embedded in session for immutability |
| **Memory** | Persistent agent knowledge | "Handled auth tokens last week" |
| **Instrument** | Audio feedback | Piano, Guitar, Violin, etc. |

---

## 13. COMMON WORKFLOWS

### 13.1 Simple Single-Agent Execution

```
1. User selects task
2. User chooses team member (e.g., Simple Worker ⚡)
3. Session spawned with member's config
4. Agent executes task
5. Reports progress via maestro commands
6. Session completes/fails
```

### 13.2 Multi-Agent Coordination

```
1. Coordinator 🎯 session spawned for task
2. Coordinator breaks task into subtasks
3. For each subtask:
   - Coordinator spawns Worker session (sibling)
   - Injects task via maestro prompt
4. Workers execute independently
5. Coordinator monitors progress
6. Workers complete/report
7. Coordinator consolidates results
```

### 13.3 Team-Based Execution

```
1. Team (e.g., "Backend Team") selected
2. Team's leader (Coordinator) spawned
3. Team's members registered as available workers
4. Coordinator spawns workers for subtasks
5. Team members are siblings within the team context
6. Communication and coordination happens at team level
```

---

## 14. IMPORTANT FILES REFERENCE

| File | Purpose |
|------|---------|
| `maestro-ui/src/stores/useMaestroStore.ts` | Central state management |
| `maestro-ui/src/components/maestro/TeamMemberModal.tsx` | Team member editor UI |
| `maestro-ui/src/components/maestro/TeamListItem.tsx` | Team display component |
| `maestro-ui/src/components/maestro/MultiProjectSessionsView.tsx` | Session visualization |
| `maestro-server/src/api/teamMemberRoutes.ts` | Team member endpoints |
| `maestro-server/src/api/teamRoutes.ts` | Team endpoints |
| `maestro-cli/src/commands/team-member.ts` | CLI team member commands |
| `maestro-ui/src/app/types/maestro.ts` | Type definitions |

---

## 15. CONCLUSION

The team member system in maestro provides:

1. **Flexibility** - Create custom agents with specific roles and capabilities
2. **Organization** - Group members into teams for collective work
3. **Multi-Agent Coordination** - Siblings communicate and coordinate seamlessly
4. **Persistence** - Team member memory for contextual awareness
5. **Real-Time Sync** - WebSocket-driven updates across UI and sessions
6. **Rich Configuration** - Fine-grained control over permissions, strategies, and models
7. **Audio Feedback** - Ensemble-based sound for multi-agent orchestration

This architecture enables sophisticated multi-agent workflows while maintaining clarity and control over agent identities and capabilities.
