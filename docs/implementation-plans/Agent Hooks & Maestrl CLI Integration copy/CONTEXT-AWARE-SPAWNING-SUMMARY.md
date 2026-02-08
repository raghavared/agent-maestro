# Context-Aware Session Spawning: Complete System

## Executive Summary

I've created a **complete implementation guide** for intelligent session spawning where:

- **Orchestrators** receive project context and task lists
- **Workers** receive specific task assignments with objectives and subtasks
- **Initial prompts** are auto-generated based on task data and skill type
- **Commands are determined dynamically** from task requirements
- **Sessions start with full context** - no manual setup needed

**Location:** `Production-Phase-1-Implementation/09-CONTEXT-AWARE-SESSION-SPAWNING.md`

---

## The Complete Flow

### 1. Orchestrator Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  USER: Opens Orchestrator Session (manually or via UI)      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  TERMINAL: claude --skill maestro-orchestrator              │
│                                                              │
│  Auto-displays initial prompt:                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ # Maestro Orchestrator Session                       │  │
│  │                                                       │  │
│  │ ## Your Role                                         │  │
│  │ You are the Maestro Orchestrator. Break down tasks  │  │
│  │ and spawn specialized workers.                       │  │
│  │                                                       │  │
│  │ ## Current Tasks                                     │  │
│  │ - [t1] Implement auth (pending, high)               │  │
│  │ - [t2] Add dark mode (pending, medium)              │  │
│  │                                                       │  │
│  │ ## Your Workflow                                     │  │
│  │ 1. Run maestro status                               │  │
│  │ 2. Analyze tasks needing decomposition             │  │
│  │ 3. Create subtasks: maestro subtask create...       │  │
│  │ 4. Spawn workers: maestro session spawn...          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Auto-runs initial commands:                                │
│  $ maestro whoami                                            │
│  $ maestro task list                                         │
│  $ maestro status                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Orchestrator analyzes and creates subtasks
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR: Creates subtasks for task t1                 │
│                                                              │
│  $ maestro subtask create t1 "Install passport.js"          │
│  $ maestro subtask create t1 "Create User model"            │
│  $ maestro subtask create t1 "Implement login endpoint"     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Orchestrator spawns worker
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR: Spawns worker for task t1                    │
│                                                              │
│  $ maestro session spawn --task t1 --skill maestro-worker   │
│                                                              │
│  CLI fetches task details from server...                    │
│  CLI builds session context (task, subtasks, deps)...       │
│  CLI sends spawn request to server...                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  SERVER: Receives spawn request                             │
│                                                              │
│  1. Generates initial prompt using PromptGenerator          │
│  2. Determines initial commands based on skill              │
│  3. Creates session record in database                      │
│  4. Broadcasts WebSocket event: session:spawn_request       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ WebSocket broadcast
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  TAURI: Receives spawn_request event                        │
│                                                              │
│  1. Saves initial prompt to temp file                       │
│  2. Builds environment variables                            │
│  3. Emits spawn-terminal event to frontend                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: Receives spawn-terminal event                    │
│                                                              │
│  1. Creates new terminal instance                           │
│  2. Creates PTY session with env vars                       │
│  3. Displays initial prompt (formatted)                     │
│  4. Runs initial commands                                   │
│  5. Updates session status to 'active'                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  NEW TERMINAL: Worker Session Opens                         │
│                                                              │
│  Auto-displays initial prompt:                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ # Maestro Worker Session                             │  │
│  │                                                       │  │
│  │ ## Your Assignment                                   │  │
│  │ Task t1: "Implement user authentication"            │  │
│  │                                                       │  │
│  │ **Description:**                                     │  │
│  │ Add JWT-based auth with login and signup endpoints  │  │
│  │                                                       │  │
│  │ **Priority:** high                                   │  │
│  │                                                       │  │
│  │ **Acceptance Criteria:**                             │  │
│  │ 1. Users can sign up with email and password        │  │
│  │ 2. Users can log in and receive JWT token           │  │
│  │ 3. Protected routes require valid JWT               │  │
│  │                                                       │  │
│  │ ## Subtasks                                          │  │
│  │ 1. [⬜] Install passport.js                          │  │
│  │ 2. [⬜] Create User model                            │  │
│  │ 3. [⬜] Implement login endpoint                     │  │
│  │                                                       │  │
│  │ ## Your Workflow                                     │  │
│  │ Step 1: Run maestro task start                      │  │
│  │ Step 2: Work through each subtask                   │  │
│  │ Step 3: Report progress frequently                  │  │
│  │ Step 4: Complete when all verified                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Auto-runs initial commands:                                │
│  $ maestro whoami                                            │
│  $ maestro task get t1                                       │
│  $ maestro task start t1                                     │
│                                                              │
│  ✅ Worker is now ready to begin implementation!            │
└─────────────────────────────────────────────────────────────┘
```

---

## What Makes This System Intelligent

### 1. **Dynamic Prompt Generation**

The `PromptGenerator` service creates role-specific prompts:

**For Orchestrators:**
- Lists all project tasks with status/priority
- Explains delegation workflow
- Provides commands for task decomposition
- Guides on how to spawn workers

**For Workers:**
- Shows assigned task with full description
- Lists acceptance criteria and technical notes
- Displays subtasks with completion status
- Shows dependencies and blockers
- Provides step-by-step execution workflow

### 2. **Context Building**

The CLI `buildSessionContext()` function fetches:
- Full task details (title, description, priority)
- All subtasks with completion status
- Dependency tasks (if any)
- Related tasks (optional with `--include-related`)
- Workflow steps based on skill type

### 3. **Initial Command Generation**

Commands are determined based on:
- **Skill type** (orchestrator vs worker)
- **Task assignment** (has task vs no task)
- **Session purpose** (delegation vs execution)

Example for Worker:
```bash
maestro whoami           # Understand context
maestro task get t1      # See full task details
maestro task start t1    # Mark as in-progress
```

Example for Orchestrator:
```bash
maestro whoami           # Understand context
maestro task list        # See all tasks
maestro status           # Get project overview
```

### 4. **Beautiful Terminal Display**

The initial prompt is displayed with:
- **Color-coded sections** (headers in yellow, subheaders in green)
- **Box drawing** for visual separation
- **Formatted markdown** for readability
- **Progress indicators** (✅ ⬜ for subtasks)

---

## Key Implementation Components

### 1. Prompt Generator (`maestro-server/src/services/promptGenerator.ts`)

**Purpose:** Generate initial prompts based on skill and context

**Key Methods:**
- `generateInitialPrompt(spawnRequest)` - Main entry point
- `generateOrchestratorPrompt(context)` - For planning sessions
- `generateWorkerPrompt(context)` - For execution sessions
- `generateInitialCommands(context)` - Auto-run commands

**Lines of Code:** ~500 lines

### 2. Enhanced CLI Spawn (`maestro-cli/src/commands/session.ts`)

**Purpose:** Build context and send spawn requests

**Key Functions:**
- `buildSessionContext(task, options)` - Fetch and structure context
- `generateSessionName(task, skill)` - Create descriptive names

**New Flags:**
- `--task <id>` - Required task assignment
- `--skill <skill>` - Skill to load (default: maestro-worker)
- `--name <name>` - Custom session name
- `--reason <reason>` - Why spawning
- `--include-related` - Include dependency tasks in context

**Lines of Code:** ~150 lines

### 3. Server Spawn Handler (`maestro-server/src/api/sessions.ts`)

**Purpose:** Generate prompts and broadcast spawn events

**Flow:**
1. Validate spawn request
2. Generate initial prompt using `PromptGenerator`
3. Generate initial commands
4. Create session record
5. Broadcast WebSocket event with full context

**Lines of Code:** ~80 lines

### 4. Tauri WebSocket Handler (`src-tauri/src/websocket.rs`)

**Purpose:** Receive spawn events and trigger terminal creation

**Functions:**
- `handle_spawn_request()` - Process spawn event
- `save_initial_prompt()` - Save prompt to temp file
- `update_session_status()` - Notify server of spawn result

**Lines of Code:** ~100 lines (Rust)

### 5. Terminal Manager (`src/components/TerminalManager.tsx`)

**Purpose:** Create terminals with context injection

**Functions:**
- `displayInitialPrompt()` - Show formatted prompt
- `runInitialCommands()` - Execute startup commands
- `addTerminalTab()` - Add to UI

**Lines of Code:** ~200 lines

---

## Example Session Prompts

### Orchestrator Session Prompt

```markdown
# Maestro Orchestrator Session

## Your Role
You are the **Maestro Orchestrator**, responsible for managing this project's workflow by:
- Analyzing requirements and breaking them down into actionable tasks
- Creating subtasks with clear deliverables
- Spawning specialized Worker sessions to execute tasks
- Monitoring progress and unblocking workers when needed

## Current Tasks
  - [t1] Implement user authentication (pending, priority: high)
  - [t2] Add dark mode toggle (pending, priority: medium)
  - [t3] Write API documentation (pending, priority: low)

## Your Workflow

### Step 1: Analyze the Current State
```bash
maestro whoami          # Understand your context
maestro task list       # See all tasks
maestro status          # Get project summary
```

### Step 2: Plan the Work
For each task that needs decomposition:
1. Review the task details: `maestro task get <id>`
2. Break it down into subtasks
3. Ensure subtasks are atomic and testable

### Step 3: Delegate to Workers
```bash
maestro session spawn --task t1 --skill maestro-worker
```

### Step 4: Monitor Progress
- Check status: `maestro task list --status in_progress`
- Unblock workers: `maestro task start <id>`

## Get Started
Run `maestro status` to see the project overview.
```

### Worker Session Prompt

```markdown
# Maestro Worker Session

## Your Assignment
Task **t1**: "Implement user authentication"

**Description:**
Add JWT-based authentication to the API with login and signup endpoints.

**Priority:** high
**Status:** pending

**Acceptance Criteria:**
1. Users can sign up with email and password
2. Users can log in and receive a JWT token
3. Protected routes require valid JWT
4. Passwords are hashed with bcrypt

**Technical Notes:**
Use passport.js for authentication middleware. Store tokens in HTTP-only cookies for security.

## Subtasks
  1. [⬜] Install and configure passport.js
  2. [⬜] Create User model with password hashing
  3. [⬜] Implement POST /auth/signup endpoint
  4. [⬜] Implement POST /auth/login endpoint
  5. [⬜] Add JWT middleware for protected routes
  6. [⬜] Write integration tests for auth flow

## Dependencies
None

## Your Workflow

### Step 1: Start the Task
```bash
maestro task start
```

### Step 2: Execute Subtasks
Work through each subtask:

**Subtask 1: Install and configure passport.js**
1. Install dependencies: `npm install passport passport-jwt bcryptjs`
2. Configure passport in `server/auth/passport.js`
3. Mark complete: `maestro subtask complete t1 st1`

[... continues for each subtask ...]

### Step 3: Report Progress
```bash
maestro update "Completed passport.js setup"
```

### Step 4: Complete Task
```bash
maestro task complete
maestro update "Task completed. All tests passing."
```

## Get Started
Run `maestro task start` to begin.
```

---

## Implementation Checklist

### ✅ What You Get

1. **Prompt Generator Service**
   - Orchestrator prompt generation
   - Worker prompt generation
   - Initial command generation
   - Context-aware prompt customization

2. **Enhanced CLI**
   - `maestro session spawn` with context building
   - Flags: `--task`, `--skill`, `--name`, `--reason`, `--include-related`
   - Automatic session naming
   - Task detail fetching

3. **Server Integration**
   - Updated spawn endpoint
   - Prompt generation on spawn
   - Context included in WebSocket broadcast

4. **Tauri Handler**
   - Prompt file saving
   - Environment variable injection
   - Session status updates

5. **Frontend Terminal**
   - Formatted prompt display
   - Initial command execution
   - Terminal tab management

6. **Testing**
   - End-to-end spawn test script
   - Prompt validation
   - Command execution verification

---

## How to Implement

### Step 1: Read the Guide

```bash
open Production-Phase-1-Implementation/09-CONTEXT-AWARE-SESSION-SPAWNING.md
```

### Step 2: Implement in Order

**Phase 1: Data Model & Prompt Generation (4 hours)**
- Add types to `maestro-server/src/types.ts`
- Create `maestro-server/src/services/promptGenerator.ts`
- Implement prompt generation methods
- Test with sample tasks

**Phase 2: CLI Enhancement (3 hours)**
- Update `maestro-cli/src/commands/session.ts`
- Add context building functions
- Test spawn command with various scenarios

**Phase 3: Server Integration (2 hours)**
- Update `maestro-server/src/api/sessions.ts`
- Integrate PromptGenerator
- Test WebSocket broadcast

**Phase 4: Tauri Handler (3 hours)**
- Update `src-tauri/src/websocket.rs`
- Implement prompt file saving
- Test spawn request handling

**Phase 5: Frontend Terminal (4 hours)**
- Create `src/components/TerminalManager.tsx`
- Implement prompt display and command execution
- Test terminal spawning

**Phase 6: Testing (2 hours)**
- Create test script
- Verify end-to-end flow
- Validate prompt content

**Total:** 18 hours (revised from 12-16)

### Step 3: Test the Complete Flow

```bash
# Run the test script
./tests/test-context-spawning.sh

# Manual test
maestro task create "Test Task" --desc "Test spawning" --priority high
maestro subtask create <task-id> "First step"
maestro session spawn --task <task-id> --skill maestro-worker
```

---

## Benefits of This System

### 1. **Zero Manual Setup**
- Workers don't need to ask "What should I do?"
- Context is injected automatically
- Commands run on session start

### 2. **Clear Objectives**
- Every session knows its purpose
- Acceptance criteria are visible
- Workflow is documented

### 3. **Autonomous Operation**
- Agents can work independently
- Orchestrators know how to delegate
- Workers know how to execute

### 4. **Audit Trail**
- Session spawning is logged
- Spawn reasons are recorded
- Parent-child relationships tracked

### 5. **Scalability**
- Orchestrator can spawn multiple workers
- Workers can focus on single tasks
- Parallel execution enabled

---

## What's Next

After implementing context-aware spawning, you'll have:

✅ **Fully autonomous orchestration** - Orchestrators can plan and delegate
✅ **Workers with context** - Every worker knows exactly what to do
✅ **Beautiful terminal UX** - Initial prompts guide the agent
✅ **Testable workflows** - End-to-end spawn verification

### Future Enhancements (Phase 2+)

1. **Multi-level orchestration** - Workers can spawn sub-workers
2. **Dynamic skill selection** - Choose skill based on task type
3. **Prompt templates** - Customizable prompt formats
4. **Session handoff** - Transfer context between sessions
5. **Progress tracking** - Real-time session progress in UI

---

## Questions?

Refer to:
- **Full Implementation Guide:** `09-CONTEXT-AWARE-SESSION-SPAWNING.md`
- **CLI Reference:** `Production-Phase-1-Plan/03-CLI-REFERENCE.md`
- **Skill Specifications:** `Production-Phase-1-Plan/SKILL-SPECIFICATIONS.md`

---

**Document Version:** 1.0
**Created:** 2026-02-01
**Implementation Time:** 18 hours
**Status:** 📋 Ready to Implement

This completes the session spawning system with full context awareness! 🚀
