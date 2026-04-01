# Maestro Team Members & Claude Agents: Comprehensive Research

## Table of Contents

1. [Maestro Team Members](#1-maestro-team-members)
2. [Claude Code Agents & Subagents](#2-claude-code-agents--subagents)
3. [Claude Agent SDK](#3-claude-agent-sdk)
4. [Claude Code Agent Teams (Experimental)](#4-claude-code-agent-teams-experimental)
5. [Comparison: Maestro vs Claude Native](#5-comparison-maestro-vs-claude-native)
6. [Key Files Reference](#6-key-files-reference)

---

## 1. Maestro Team Members

### 1.1 What Are Team Members?

Team members are **first-class entities** in maestro that represent persistent agent identities. Each team member has a name, role, avatar, custom identity prompt, model preference, capabilities, permissions, skills, and persistent memory. They are the foundation of maestro's multi-agent orchestration — when a session is spawned, it runs "as" a team member.

### 1.2 Core Data Model

```typescript
interface TeamMember {
  id: string;                    // tm_<timestamp>_<random> or deterministic for defaults
  projectId: string;
  scope?: 'project' | 'global'; // Global members shared across all projects
  name: string;                  // Display name (e.g., "Worker", "Frontend Dev")
  role: string;                  // Description (e.g., "Default executor")
  identity?: string;             // Custom persona/instructions prompt
  avatar: string;                // Emoji identifier (e.g., "⚡", "🎯")
  model?: string;                // opus, sonnet, haiku
  agentTool?: string;            // claude-code, codex, gemini
  mode?: AgentMode;              // worker | coordinator | coordinated-worker | coordinated-coordinator
  permissionMode?: string;       // acceptEdits | interactive | readOnly | bypassPermissions
  skillIds?: string[];           // Assigned skills
  soundInstrument?: string;      // piano | guitar | violin | trumpet | drums
  isDefault: boolean;            // true for built-in Worker & Coordinator
  status: 'active' | 'archived';
  memory?: string[];             // Persistent memory across sessions
  commandPermissions?: {         // Fine-grained command access
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };
  capabilities: {                // Feature flags
    can_spawn_sessions: boolean;
    can_edit_tasks: boolean;
    can_report_task_level: boolean;
    can_report_session_level: boolean;
  };
}
```

### 1.3 Default Team Members

Maestro ships with **5 built-in defaults** (deterministic IDs, cannot be deleted):

| Name | Mode | Key Trait |
|------|------|-----------|
| **Simple Worker** | worker | Default task executor, no session spawning |
| **Coordinator** | coordinator | Task orchestrator, can spawn sessions and monitor workers |
| **Batch Coordinator** | coordinator | Parallel batch execution orchestrator |
| **DAG Coordinator** | coordinator | Dependency-aware DAG-based orchestrator |
| **Recruiter** | worker | Skill discovery agent that creates new team members |

### 1.4 Four-Mode Agent Model

Maestro uses a strict four-mode identity model:

| Mode | Description | Can Spawn? |
|------|-------------|------------|
| `worker` | Standalone worker, no parent | No |
| `coordinator` | Standalone coordinator | Yes |
| `coordinated-worker` | Worker spawned by a coordinator | No |
| `coordinated-coordinator` | Sub-coordinator spawned by parent coordinator | No (hard-blocked) |

Legacy aliases: `execute` → worker, `coordinate` → coordinator.

### 1.5 Identity & Prompt System

Each mode has specific identity instructions injected into the agent's system prompt:

- **Worker**: "You are an autonomous agent. Understand assigned tasks and plan for them, create subtasks if required. Work through completion. Update key milestones using `maestro task {report,complete,blocked}` commands."

- **Coordinator**: "You are a team coordination agent. Decompose work into explicit subtasks. Spawn sessions using `maestro session spawn`. Actively monitor all workers via `maestro session logs --my-workers`. Synthesize prompt directives with specific file paths and line numbers — never delegate understanding to workers."

- **Coordinated-Worker**: "You are a worker agent in a coordinated multi-agent team. Spawned by a coordinator. Use `maestro session siblings` to inspect team roster and communicate with siblings via `maestro session prompt <sessionId>`."

- **Coordinated-Coordinator**: "You are a sub-coordinator in a hierarchical multi-agent team. Coordinate only within the existing assigned team. Do not spawn new sessions."

The prompt is structured as XML (version 3.0):
```xml
<maestro_system_prompt mode="worker" version="3.0">
  <identity_kernel>        <!-- Mode identity + self identity + team context -->
  <capability_summary>     <!-- Allowed capabilities -->
  <commands_reference>     <!-- Available CLI commands -->
</maestro_system_prompt>
<maestro_task_prompt>
  <tasks>                  <!-- Assigned tasks -->
  <skills>                 <!-- Loaded skills -->
  <session_context>        <!-- Session metadata -->
</maestro_task_prompt>
```

### 1.6 Memory System

- Stored as a `string[]` on each team member
- **Persistent across sessions** — memory survives after a session ends
- Appended atomically via the `/team-members/:id/memory` API endpoint
- Rendered in prompts as `<memory>` XML block
- Supports merged memory when multiple team member identities are combined

### 1.7 CRUD Operations

**CLI Commands:**
```bash
maestro team-member list                    # List all team members
maestro team-member get <id>                # Get details
maestro team-member create <name>           # Create new member
maestro team-member edit <id>               # Update properties
maestro team-member archive <id>            # Soft delete
maestro team-member unarchive <id>          # Restore
maestro team-member delete <id>             # Hard delete (must be archived first)
maestro team-member reset <id>              # Reset default to code values
maestro team-member update-identity <id>    # Update own persona
maestro team-member memory append <id>      # Add memory entries
maestro team-member memory list <id>        # View memory
maestro team-member memory clear <id>       # Clear memory
```

**API Endpoints:**
| Operation | Method | Endpoint |
|-----------|--------|----------|
| List | GET | `/team-members?projectId=X` |
| Get | GET | `/team-members/:id?projectId=X` |
| Create | POST | `/team-members` |
| Update | PATCH | `/team-members/:id` |
| Archive | POST | `/team-members/:id/archive` |
| Unarchive | POST | `/team-members/:id/unarchive` |
| Delete | DELETE | `/team-members/:id?projectId=X` |
| Memory | POST | `/team-members/:id/memory` |
| Reset | POST | `/team-members/:id/reset` |
| Scope | PATCH | `/team-members/:id/scope` |

### 1.8 Teams (Group Coordination)

Teams group multiple team members for coordinated work:

```typescript
interface Team {
  id: string;            // team_<timestamp>_<random>
  projectId: string;
  name: string;
  description?: string;
  avatar?: string;
  leaderId: string;      // Must be in memberIds
  memberIds: string[];
  subTeamIds: string[];  // Nested team hierarchy
  parentTeamId?: string;
  status: 'active' | 'archived';
}
```

### 1.9 Task Assignment

Tasks reference team members for assignment:
```typescript
// In Task type:
teamMemberId?: string;            // Single assigned team member
teamMemberIds?: string[];         // Multiple team members
memberOverrides?: Record<string, MemberLaunchOverride>;  // Per-member overrides
```

### 1.10 Session Spawning

When a coordinator spawns a session:
1. `maestro session spawn --task <id> --team-member-id <tmId>` is called
2. Server generates a **manifest** with team member data, task context, and skills
3. Claude Code session is launched with plugin directories and permission flags
4. The spawned session receives the team member's identity, memory, and capabilities in its system prompt

### 1.11 Command Permissions

Two-level granularity:
- **Group level**: `task`, `session`, `team-member`, `show`, `modal`, `root`
- **Command level**: Fine-grained (e.g., `task:create`, `session:spawn`)

Coordinators can spawn sessions and monitor workers; workers cannot. Coordinated-coordinators are hard-blocked from spawning.

### 1.12 Sound Identity

Each team member can have a `soundInstrument` (piano, guitar, violin, trumpet, drums) creating an "ensemble" audio identity when multiple agents work concurrently.

### 1.13 File System Storage

```
{dataDir}/team-members/{projectId}/
  tm_{projectId}_worker.override.json       # User overrides for Worker default
  tm_{projectId}_coordinator.override.json  # User overrides for Coordinator default
  tm_{timestamp}_{random}.json              # Custom team members
```

### 1.14 Business Rules

1. Default members (Worker/Coordinator) cannot be deleted, only archived or customized
2. Custom members must be archived before deletion
3. Team leader must be a member of the team
4. Memory append is atomic (avoids race conditions)
5. Command permissions cascade (group-level overrides individual)
6. Empty identity means no persona (system default behavior only)
7. Global-scoped members are visible across all projects

---

## 2. Claude Code Agents & Subagents

### 2.1 The Agent Tool

Claude Code has a built-in **Agent tool** (renamed from "Task tool" in v2.1.63) that spawns subagents — separate Claude instances that handle focused subtasks.

**How it works:**
- Parent agent uses the Agent tool with a prompt string
- Each subagent runs in its **own isolated context window** (up to 200K tokens)
- Intermediate tool calls stay inside the subagent; only the **final message** returns to the parent
- Multiple subagents can run **concurrently** in parallel
- **Key limitation**: Subagents **cannot spawn other subagents** (no nesting)

### 2.2 Built-in Subagent Types

| Type | Model | Tools | Purpose |
|------|-------|-------|---------|
| **Explore** | Haiku (fast) | Read-only (Glob, Grep, Read, Bash, WebFetch, WebSearch) | Codebase search and analysis |
| **Plan** | Inherits parent | Read-only | Research during plan mode |
| **General-purpose** | Inherits parent | Full access | Complex multi-step tasks |
| **statusline-setup** | — | Read, Edit | Configure status line |
| **claude-code-guide** | — | Glob, Grep, Read, WebFetch, WebSearch | Answer Claude Code questions |

### 2.3 Custom Subagents

Defined as Markdown files in `.claude/agents/` (project) or `~/.claude/agents/` (user):

```markdown
---
name: my-agent
description: What this agent does
model: sonnet          # sonnet, opus, haiku, or inherit
tools:
  allowed: [Read, Glob, Grep, Bash]
  # OR
  disallowed: [Edit, Write]
permission_mode: bypassPermissions
mcp_servers: [my-server]
memory:
  scope: project       # user, project, or local
max_turns: 50
skills: [my-skill]
---

Custom system prompt for this agent...
```

### 2.4 Foreground vs Background

- **Foreground** (default): Blocking — parent waits for result before continuing
- **Background**: Concurrent — parent continues working, gets notified when subagent completes

Background subagents get permissions pre-approved before launching.

### 2.5 Git Worktree Isolation

Subagents can run in isolated git worktrees (`isolation: "worktree"`), giving them a separate copy of the repository to avoid file conflicts.

---

## 3. Claude Agent SDK

### 3.1 Overview

The **Claude Agent SDK** (formerly "Claude Code SDK") is a programmable SDK in **Python** and **TypeScript** that provides the same tools, agent loop, and context management as Claude Code.

- **NPM**: `@anthropic-ai/claude-agent-sdk`
- **Python**: `claude-agent-sdk`
- **Released**: September 29, 2025

### 3.2 Core Capabilities

- **Built-in tools**: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion
- **Agentic loop**: Gather Context → Take Action → Verify Work → Repeat (no manual loop needed)
- **Subagents**: Define and spawn via `AgentDefinition` objects in `query()` options
- **Hooks**: PreToolUse, PostToolUse, Stop, SessionStart, SessionEnd callbacks
- **MCP integration**: Connect external systems via Model Context Protocol
- **Sessions**: Maintain context across exchanges, resume or fork sessions
- **Authentication**: Anthropic API, Amazon Bedrock, Google Vertex AI, Microsoft Azure AI Foundry

### 3.3 Subagents in the SDK

```typescript
const agent = new AgentDefinition({
  description: "Code reviewer",
  prompt: "Review code for bugs and style issues",
  tools: ["Read", "Glob", "Grep"],
  model: "sonnet",
  skills: ["code-review"],
  memory: { scope: "project" }
});

// Passed in query options
const result = await sdk.query("Review the auth module", {
  agents: [agent]
});
```

---

## 4. Claude Code Agent Teams (Experimental)

### 4.1 Overview

An experimental feature (requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, v2.1.32+) that enables multiple independent Claude Code sessions to collaborate as a team.

### 4.2 How It Works

- One session acts as **team lead** — creates the team, spawns teammates, assigns tasks, synthesizes results
- **Teammates** are independent Claude Code instances with their own context windows
- Teammates have **names** used for messaging and task assignment

### 4.3 Coordination Primitives

- **Shared task list** with dependency tracking and auto-unblocking
- **Peer-to-peer messaging** between teammates (inbox-based mailbox)
- **File locking** to prevent conflicts
- Tasks have states: pending → in progress → completed

### 4.4 Key Differences from Subagents

| Aspect | Subagents | Agent Teams |
|--------|-----------|-------------|
| Context | Own window; results return to caller | Own window; fully independent |
| Communication | Report back to parent only | Direct peer-to-peer messaging |
| Coordination | Parent manages all work | Shared task list, self-coordination |
| Nesting | Cannot nest | Flat team structure |
| Persistence | None across sessions | None across team lifecycle |
| Best for | Focused tasks | Complex collaborative work |
| Token cost | Lower | Higher (each is a full Claude instance) |

### 4.5 Limitations

- **No persistent identity** — teammates exist only for the team's lifecycle
- However, teammates can reference **subagent definitions** (`.claude/agents/`) to inherit predefined roles
- Subagent definitions can have **persistent memory** via the `memory` frontmatter field

---

## 5. Comparison: Maestro vs Claude Native

| Feature | Maestro Team Members | Claude Code Subagents | Claude Agent Teams |
|---------|---------------------|-----------------------|-------------------|
| **Persistent Identity** | ✅ Full persistence across sessions | ❌ None (ephemeral) | ❌ None (team lifecycle only) |
| **Persistent Memory** | ✅ String array, survives sessions | ⚠️ Via agent definition files | ⚠️ Via agent definition files |
| **Custom Persona/Instructions** | ✅ Identity field per member | ✅ Via agent markdown files | ✅ Via agent markdown files |
| **Model Selection** | ✅ Per-member (opus/sonnet/haiku) | ✅ Per-agent definition | ✅ Per-teammate |
| **Multi-Tool Support** | ✅ claude-code, codex, gemini | ❌ Claude Code only | ❌ Claude Code only |
| **Permission Control** | ✅ Fine-grained command + group level | ✅ Tool allowlist/denylist | ✅ Basic permission modes |
| **Skills System** | ✅ Skill IDs assigned per member | ✅ Skills in agent definitions | ❌ Not applicable |
| **Hierarchical Orchestration** | ✅ 4-mode model with nesting | ❌ No nesting allowed | ❌ Flat team |
| **Task Management** | ✅ Full CRUD, assignment, dependencies | ❌ None (prompt-based) | ⚠️ Shared task list (basic) |
| **Peer Communication** | ✅ Via `maestro session prompt` | ❌ Parent-child only | ✅ Direct messaging |
| **Sound Identity** | ✅ Instrument per member | ❌ | ❌ |
| **UI Management** | ✅ Full CRUD UI panels | ❌ File-based only | ❌ CLI-based only |
| **Scope** | ✅ Project or global | ⚠️ Project or user directory | ❌ Team-scoped only |
| **Archival/Lifecycle** | ✅ Active/archived with soft delete | ❌ | ❌ |

### Key Insight

**Maestro team members are a superset** of what Claude's native subagent and agent teams systems provide. Maestro adds:
- True persistent identity and memory that survives across arbitrary sessions
- Hierarchical four-mode orchestration (including coordinated-coordinators)
- Fine-grained command-level permissions
- Multi-tool support (not just Claude Code)
- Server-managed lifecycle with API, CLI, and UI
- Team composition with leader/member/sub-team hierarchy
- Sound/ensemble identity for multi-agent awareness

---

## 6. Key Files Reference

### Server
| File | Purpose |
|------|---------|
| `maestro-server/src/types.ts` | Core TeamMember, Team, Task type definitions |
| `maestro-server/src/api/teamMemberRoutes.ts` | HTTP endpoints |
| `maestro-server/src/application/services/TeamMemberService.ts` | Business logic |
| `maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts` | File storage |

### CLI
| File | Purpose |
|------|---------|
| `maestro-cli/src/commands/team-member.ts` | CLI commands |
| `maestro-cli/src/prompts/identity.ts` | Identity prompt strings |
| `maestro-cli/src/prompting/prompt-composer.ts` | Prompt composition |
| `maestro-cli/src/services/prompt-builder.ts` | Manifest-to-prompt rendering |
| `maestro-cli/src/prompting/capability-policy.ts` | Mode-based capability rules |
| `maestro-cli/src/prompting/command-catalog.ts` | Command definitions and mode restrictions |

### UI
| File | Purpose |
|------|---------|
| `maestro-ui/src/components/maestro/TeamMemberModal.tsx` | Create/edit form |
| `maestro-ui/src/components/maestro/TeamMemberList.tsx` | List view |
| `maestro-ui/src/components/maestro/TeamMemberSelector.tsx` | Assignment dropdown |
| `maestro-ui/src/hooks/useTeamMemberActions.ts` | CRUD hook |

### Sources (Claude Agents Research)
- [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [How We Built Our Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Building Effective AI Agents](https://www.anthropic.com/research/building-effective-agents)
- [Building Agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
