# Maestro Hooks Integration Guide

**Version:** 1.0
**Date:** 2026-02-01
**Status:** Planning Document for Review

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Claude Code Hooks Overview](#claude-code-hooks-overview)
3. [Maestro Integration Architecture](#maestro-integration-architecture)
4. [Implementation Options (Multiple Approaches)](#implementation-options-multiple-approaches)
5. [Detailed Use Cases for Maestro UI](#detailed-use-cases-for-maestro-ui)
6. [Hook Implementation Examples](#hook-implementation-examples)
7. [Recommended Architecture](#recommended-architecture)
8. [Implementation Plan](#implementation-plan)
9. [Security Considerations](#security-considerations)
10. [Appendix: Complete Hook Reference](#appendix-complete-hook-reference)

---

## Executive Summary

### What Are Hooks?

Hooks are event-driven callbacks in Claude Code CLI that execute shell commands at specific lifecycle points. They enable:

- **Real-time monitoring** of session progress
- **Blocking/validation** of dangerous operations
- **UI updates** based on tool usage
- **Metrics collection** and logging
- **Custom workflows** and automation

### Why Hooks for Maestro?

Your Maestro orchestration system spawns Claude Code sessions to execute tasks. Without hooks, you have limited visibility into:

- What tools the agent is using
- When tasks are blocked waiting for permission
- Progress updates during long-running operations
- Whether operations succeeded or failed
- Session lifecycle events

**With hooks**, you can transform spawned Claude Code sessions into **observable, controllable, and integrated** components of your orchestration system.

### Key Benefits

| Benefit | Impact |
|---------|--------|
| **Real-time UI updates** | Show users exactly what each agent is doing |
| **Progress tracking** | Update task timelines as agents work |
| **Permission management** | Auto-approve safe operations, block dangerous ones |
| **Metrics & analytics** | Track tool usage, success rates, session duration |
| **Error handling** | Detect failures and update task status automatically |
| **Audit trail** | Complete log of all agent actions |

---

## Claude Code Hooks Overview

### Available Hooks (12 Events)

| Hook | Triggers | Blockable | Primary Use Case |
|------|----------|-----------|------------------|
| **SessionStart** | Session begins/resumes | No | Initialize state, inject context |
| **UserPromptSubmit** | User submits prompt | Yes | Validate prompts, add context |
| **PreToolUse** | Before tool execution | Yes | Block dangerous operations |
| **PermissionRequest** | Permission dialog appears | Yes | Auto-approve safe operations |
| **PostToolUse** | After tool succeeds | No | Log usage, update UI |
| **PostToolUseFailure** | After tool fails | No | Handle errors, notify UI |
| **Notification** | Claude sends notification | No | Forward to UI/alerts |
| **SubagentStart** | Subagent spawned | No | Track nested agents |
| **SubagentStop** | Subagent finishes | Yes | Validate completion |
| **Stop** | Claude finishes responding | Yes | Verify task completion |
| **PreCompact** | Before context compaction | No | Save state |
| **SessionEnd** | Session terminates | No | Cleanup, finalize metrics |

### Hook Types

**1. Command Hooks** (`type: "command"`)
- Execute shell scripts
- Read JSON input from stdin
- Return decisions via exit codes
- Support async background execution

**2. Prompt Hooks** (`type: "prompt"`)
- Single LLM evaluation
- Fast yes/no decisions
- Good for validation checks

**3. Agent Hooks** (`type: "agent"`)
- Multi-turn evaluation
- Can use tools for verification
- Best for complex validation

### Configuration Scope

Hooks can be configured at multiple levels:

```
~/.claude/settings.json              → All projects (user-wide)
.claude/settings.json                 → Single project (shareable via git)
.claude/settings.local.json           → Single project (local, gitignored)
~/.claude/plugins/*/hooks/hooks.json  → When plugin enabled
Skill/Agent frontmatter               → While skill/agent active
```

---

## Maestro Integration Architecture

### Current Maestro Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Maestro UI (Tauri)                     │
│  - MaestroPanel, TaskCards, SessionsSection                 │
│  - WebSocket client (useMaestroWebSocket)                   │
│  - Real-time task/session updates                           │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Maestro Server                             │
│  - Express.js + WebSocket Server                            │
│  - Storage (tasks, sessions, subtasks)                      │
│  - REST API (/api/tasks, /api/sessions)                     │
│  - Events: task:created, session:updated, etc.              │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /api/sessions/spawn
                     │
┌────────────────────▼────────────────────────────────────────┐
│          Claude Code Sessions (spawned terminals)           │
│  - Each session assigned to taskIds                         │
│  - Environment: MAESTRO_TASK_IDS, MAESTRO_SESSION_ID        │
│  - Skills: maestro-worker, maestro-orchestrator             │
└─────────────────────────────────────────────────────────────┘
```

### Enhanced Architecture with Hooks

```
┌─────────────────────────────────────────────────────────────┐
│                      Maestro UI (Tauri)                     │
│  ✨ NEW: Real-time progress indicators                      │
│  ✨ NEW: Tool usage timeline                                │
│  ✨ NEW: Pending action badges                              │
│  ✨ NEW: Live session metrics                               │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket (existing + new events)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Maestro Server                             │
│  - Existing REST API + WebSocket                            │
│  ✨ NEW: POST /api/webhooks/hook-event                      │
│  ✨ NEW: Events: hook:tool_use, hook:notification, etc.     │
└────────────────────┬────────────────────────────────────────┘
                     │ spawn with hooks config
                     │
┌────────────────────▼────────────────────────────────────────┐
│          Claude Code Sessions (with hooks enabled)          │
│  ✨ Hooks send events back to Maestro Server                │
│  ✨ Auto-approve safe operations                            │
│  ✨ Block dangerous operations                              │
│  ✨ Real-time progress updates                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Options (Multiple Approaches)

### Option 1: Centralized Webhook Endpoint (Recommended)

**Architecture:**
- All hooks send events to a single Maestro Server endpoint
- Server broadcasts events to UI via WebSocket
- Hooks configured in `.claude/settings.json` at project root

**Pros:**
- ✅ Simple, centralized logging
- ✅ Easy to debug and monitor
- ✅ Consistent event format
- ✅ Works with multiple sessions
- ✅ Can aggregate metrics across sessions

**Cons:**
- ❌ Requires network call from each hook
- ❌ Single point of failure
- ❌ Slight latency overhead

**Best for:** Production systems, multi-session orchestration, comprehensive analytics

**Implementation:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "curl -X POST http://localhost:3000/api/webhooks/hook-event -H 'Content-Type: application/json' -d @- 2>/dev/null",
            "async": true
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "curl -X POST http://localhost:3000/api/webhooks/hook-event -H 'Content-Type: application/json' -d @- 2>/dev/null",
            "async": true
          }
        ]
      }
    ]
  }
}
```

**Server endpoint:**

```typescript
// maestro-server/src/api/webhooks.ts
router.post('/webhooks/hook-event', (req, res) => {
  const { session_id, hook_event_name, ...eventData } = req.body;

  // Find session by Claude session ID
  const session = storage.findSessionByClaudeId(session_id);

  if (session) {
    // Broadcast to UI
    storage.emit('hook:event', {
      sessionId: session.id,
      event: hook_event_name,
      data: eventData,
      timestamp: Date.now()
    });
  }

  res.json({ success: true });
});
```

---

### Option 2: File-Based Communication

**Architecture:**
- Hooks write events to a file queue
- Maestro Server watches file for changes
- Server reads and processes events, broadcasts to UI

**Pros:**
- ✅ No network dependency
- ✅ Works offline
- ✅ Built-in persistence (events logged to file)
- ✅ Can replay events

**Cons:**
- ❌ File I/O overhead
- ❌ Requires file watching
- ❌ Potential race conditions
- ❌ File cleanup needed

**Best for:** Offline systems, development/testing, systems with strict network policies

**Implementation:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "jq -c '. + {\"timestamp\": now}' >> /tmp/maestro-hooks-${MAESTRO_SESSION_ID}.jsonl",
            "async": true
          }
        ]
      }
    ]
  }
}
```

**Server file watcher:**

```typescript
import chokidar from 'chokidar';
import { readFileSync } from 'fs';

const watcher = chokidar.watch('/tmp/maestro-hooks-*.jsonl');

watcher.on('change', (path) => {
  const sessionId = path.match(/maestro-hooks-(.+)\.jsonl/)?.[1];
  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const lastEvent = JSON.parse(lines[lines.length - 1]);

  storage.emit('hook:event', {
    sessionId,
    event: lastEvent.hook_event_name,
    data: lastEvent
  });
});
```

---

### Option 3: Hybrid (File + Webhook)

**Architecture:**
- Critical events (errors, blocks) → Webhook (immediate)
- Non-critical events (logs, metrics) → File (async)
- Best of both worlds

**Pros:**
- ✅ Fast critical event delivery
- ✅ Persistent logging
- ✅ Reduced network load
- ✅ Resilient to server downtime

**Cons:**
- ❌ More complex
- ❌ Two systems to maintain

**Best for:** High-reliability production systems

---

### Option 4: Session-Specific Hook Scripts

**Architecture:**
- Each spawned session gets custom hook scripts
- Scripts injected at spawn time
- Scripts know their session context

**Pros:**
- ✅ Most flexible
- ✅ Can customize per task type
- ✅ No global config needed
- ✅ Easy to test individual sessions

**Cons:**
- ❌ More complex spawn logic
- ❌ Scripts must be managed dynamically
- ❌ Harder to maintain consistency

**Best for:** Advanced use cases with diverse task types

**Implementation:**

```typescript
// When spawning session
const hookScript = `
#!/bin/bash
INPUT=$(cat)
SESSION_ID="${sessionId}"
TASK_IDS="${taskIds.join(',')}"

# Add session context to hook event
echo "$INPUT" | jq --arg sid "$SESSION_ID" --arg tids "$TASK_IDS" \\
  '. + {maestro_session_id: $sid, maestro_task_ids: $tids}' | \\
  curl -X POST http://localhost:3000/api/webhooks/hook-event \\
    -H 'Content-Type: application/json' -d @- 2>/dev/null
`;

fs.writeFileSync(`${projectDir}/.claude/hooks/maestro-hook.sh`, hookScript, { mode: 0o755 });
```

---

### Option 5: Skill-Embedded Hooks

**Architecture:**
- Hooks defined in skill frontmatter
- Automatically active when skill loaded
- Scoped to skill lifecycle

**Pros:**
- ✅ Self-contained skills
- ✅ Portable across projects
- ✅ Only active when skill active
- ✅ Easy to distribute

**Cons:**
- ❌ Limited to skill context
- ❌ Can't use for session-wide hooks
- ❌ Harder to override

**Best for:** Reusable skills with specific monitoring needs

**Implementation:**

```markdown
---
description: Maestro Worker Skill
hooks:
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "curl -X POST http://localhost:3000/api/webhooks/bash-complete -d @-"
          async: true
---

# Maestro Worker Skill

You are a worker agent executing tasks assigned by the Maestro orchestrator.
```

---

## Detailed Use Cases for Maestro UI

### Use Case 1: Real-Time Progress Tracking

**Goal:** Show users what each agent is doing in real-time

**Hooks Used:** `PostToolUse`, `SessionStart`, `SessionEnd`

**UI Enhancement:**

```
┌─────────────────────────────────────────────────────────────┐
│ Task: Implement user authentication                         │
│ Status: In Progress                                         │
│                                                              │
│ Live Activity:                                              │
│ ● 2m ago: Reading src/auth/login.ts                        │
│ ● 1m ago: Writing src/auth/middleware.ts                   │
│ ● 30s ago: Running tests (Bash: npm test)                  │
│ ● Now: Searching for authentication patterns (Grep)        │
│                                                              │
│ Tools Used: Read (12), Write (3), Edit (5), Bash (2)       │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// Hook sends:
{
  "event": "hook:tool_use",
  "sessionId": "s123",
  "tool": "Write",
  "file": "src/auth/middleware.ts",
  "timestamp": 1234567890
}

// UI component:
function TaskLiveActivity({ taskId }: { taskId: string }) {
  const [activity, setActivity] = useState<Activity[]>([]);

  useMaestroWebSocket({
    onHookEvent: (data) => {
      if (data.taskId === taskId) {
        setActivity(prev => [...prev, {
          tool: data.tool,
          description: formatToolUse(data),
          timestamp: data.timestamp
        }].slice(-10)); // Keep last 10 activities
      }
    }
  });

  return (
    <div className="activity-feed">
      {activity.map((a, i) => (
        <div key={i} className="activity-item">
          <span className="timestamp">{formatTimeAgo(a.timestamp)}</span>
          <span className="description">{a.description}</span>
        </div>
      ))}
    </div>
  );
}
```

---

### Use Case 2: Pending Action Badges

**Goal:** Alert users when agents are blocked waiting for permission

**Hooks Used:** `Notification` (matcher: `permission_prompt`)

**UI Enhancement:**

```
┌─────────────────────────────────────────────────────────────┐
│ Task: Deploy to production                                  │
│ Status: Blocked ⚠️                                          │
│                                                              │
│ 🔔 Waiting for permission to run:                          │
│    $ git push origin main --force                          │
│                                                              │
│ [Approve] [Deny] [View Session]                            │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/notify-permission.sh",
            "async": true
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/notify-permission.sh

INPUT=$(cat)
MESSAGE=$(echo "$INPUT" | jq -r '.message')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')

curl -X POST http://localhost:3000/api/webhooks/permission-prompt \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"$MESSAGE\"}" \
  2>/dev/null
```

```typescript
// UI updates task status to "blocked"
useMaestroWebSocket({
  onHookEvent: (data) => {
    if (data.event === 'permission_prompt') {
      updateTaskStatus(data.taskId, 'blocked', {
        reason: data.message,
        timestamp: Date.now()
      });
    }
  }
});
```

---

### Use Case 3: Automatic Task Timeline Updates

**Goal:** Build a detailed timeline of all agent actions

**Hooks Used:** `PostToolUse`, `SessionStart`, `Stop`

**UI Enhancement:**

```
┌─────────────────────────────────────────────────────────────┐
│ Task Timeline                                               │
│                                                              │
│ 10:00 AM - Session started (Worker Agent)                  │
│ 10:01 AM - Read 5 configuration files                      │
│ 10:03 AM - Modified database schema (src/schema.sql)       │
│ 10:05 AM - Ran migrations (Bash: npm run migrate)          │
│ 10:06 AM - Tests passed ✓                                  │
│ 10:07 AM - Session completed                               │
└─────────────────────────────────────────────────────────────┘
```

**Hook Configuration:**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"event\":\"session_start\"}' | curl -X POST http://localhost:3000/api/tasks/$MAESTRO_TASK_IDS/timeline -d @-"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/log-file-change.sh",
            "async": true
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/log-bash-execution.sh",
            "async": true
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"event\":\"session_end\"}' | curl -X POST http://localhost:3000/api/tasks/$MAESTRO_TASK_IDS/timeline -d @-"
          }
        ]
      }
    ]
  }
}
```

---

### Use Case 4: Tool Usage Statistics

**Goal:** Show which tools agents use most, success rates

**Hooks Used:** `PostToolUse`, `PostToolUseFailure`

**UI Enhancement:**

```
┌─────────────────────────────────────────────────────────────┐
│ Session Analytics                                           │
│                                                              │
│ Tool Usage:                                                 │
│ Read         ████████████████████ 45 uses (100% success)   │
│ Write        ████████████ 28 uses (96% success)            │
│ Edit         ██████████ 22 uses (91% success)              │
│ Bash         ███████ 15 uses (87% success)                 │
│ Grep         ████ 8 uses (100% success)                    │
│                                                              │
│ Total Time: 12m 34s                                         │
│ Tools Called: 118                                           │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// maestro-server/src/storage.ts
interface ToolMetrics {
  tool: string;
  uses: number;
  successes: number;
  failures: number;
  totalDuration: number;
}

class Storage {
  private toolMetrics = new Map<string, Map<string, ToolMetrics>>();

  recordToolUse(sessionId: string, tool: string, success: boolean, duration: number) {
    if (!this.toolMetrics.has(sessionId)) {
      this.toolMetrics.set(sessionId, new Map());
    }

    const sessionMetrics = this.toolMetrics.get(sessionId)!;
    const current = sessionMetrics.get(tool) || {
      tool, uses: 0, successes: 0, failures: 0, totalDuration: 0
    };

    current.uses++;
    if (success) current.successes++;
    else current.failures++;
    current.totalDuration += duration;

    sessionMetrics.set(tool, current);

    this.emit('session:metrics_updated', {
      sessionId,
      metrics: Array.from(sessionMetrics.values())
    });
  }
}
```

---

### Use Case 5: Smart Auto-Approval

**Goal:** Auto-approve safe operations, block dangerous ones

**Hooks Used:** `PreToolUse`, `PermissionRequest`

**Examples:**

- ✅ Auto-approve: `npm test`, `git status`, reading files
- ⚠️ Ask: `git push`, modifying `.env`, `rm -rf`
- ❌ Block: `curl` to unknown domains, `chmod 777`

**Implementation:**

```bash
#!/bin/bash
# .claude/hooks/validate-bash.sh

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Safe commands - auto-approve
if echo "$COMMAND" | grep -qE '^(npm test|git status|git diff|ls|pwd)'; then
  exit 0
fi

# Dangerous patterns - block
if echo "$COMMAND" | grep -qE '(rm -rf|chmod 777|sudo|eval)'; then
  echo "{
    \"hookSpecificOutput\": {
      \"hookEventName\": \"PreToolUse\",
      \"permissionDecision\": \"deny\",
      \"permissionDecisionReason\": \"Blocked dangerous command: $COMMAND\"
    }
  }"
  exit 0
fi

# Protected files - block
if echo "$COMMAND" | grep -qE '(\.env|\.git|credentials|secrets)'; then
  echo "{
    \"hookSpecificOutput\": {
      \"hookEventName\": \"PreToolUse\",
      \"permissionDecision\": \"deny\",
      \"permissionDecisionReason\": \"Cannot access protected files\"
    }
  }"
  exit 0
fi

# Unknown - ask user
echo "{
  \"hookSpecificOutput\": {
    \"hookEventName\": \"PreToolUse\",
    \"permissionDecision\": \"ask\"
  }
}"
exit 0
```

---

### Use Case 6: Error Detection and Recovery

**Goal:** Automatically detect failures and update task status

**Hooks Used:** `PostToolUseFailure`

**Implementation:**

```json
{
  "hooks": {
    "PostToolUseFailure": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/handle-failure.sh",
            "async": true
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/handle-failure.sh

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
ERROR=$(echo "$INPUT" | jq -r '.error')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')

# Log failure
curl -X POST http://localhost:3000/api/webhooks/tool-failure \
  -H 'Content-Type: application/json' \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"tool\": \"$TOOL\",
    \"error\": \"$ERROR\",
    \"timestamp\": $(date +%s)
  }" 2>/dev/null
```

---

### Use Case 7: Subagent Tracking

**Goal:** Track when agents spawn subagents, visualize hierarchy

**Hooks Used:** `SubagentStart`, `SubagentStop`

**UI Enhancement:**

```
┌─────────────────────────────────────────────────────────────┐
│ Task: Refactor authentication system                        │
│                                                              │
│ Agent Hierarchy:                                            │
│ ├─ Main Orchestrator (active)                              │
│ │  ├─ Explore Agent (completed)                            │
│ │  │  └─ Found 12 authentication files                     │
│ │  ├─ Plan Agent (active)                                  │
│ │  │  └─ Designing refactoring approach...                 │
│ │  └─ Worker Agent (pending)                               │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
interface SubagentNode {
  id: string;
  type: string;
  status: 'active' | 'completed' | 'pending';
  children: SubagentNode[];
}

useMaestroWebSocket({
  onHookEvent: (data) => {
    if (data.event === 'SubagentStart') {
      addSubagentNode(data.agent_id, data.agent_type, data.parent_id);
    }
    if (data.event === 'SubagentStop') {
      updateSubagentStatus(data.agent_id, 'completed');
    }
  }
});
```

---

### Use Case 8: Session Health Monitoring

**Goal:** Detect stuck sessions, timeout warnings

**Hooks Used:** `SessionStart`, `PostToolUse`, `SessionEnd`

**Implementation:**

```typescript
// Track last activity timestamp
const sessionActivity = new Map<string, number>();

useMaestroWebSocket({
  onHookEvent: (data) => {
    if (data.event === 'PostToolUse') {
      sessionActivity.set(data.sessionId, Date.now());
    }
  }
});

// Check for stale sessions every minute
setInterval(() => {
  const now = Date.now();
  const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  for (const [sessionId, lastActivity] of sessionActivity) {
    if (now - lastActivity > STALE_THRESHOLD) {
      // Mark session as stale, notify user
      updateSessionStatus(sessionId, 'stale');
      notifyUser(`Session ${sessionId} has been idle for 5+ minutes`);
    }
  }
}, 60000);
```

---

## Hook Implementation Examples

### Complete Hook Script Examples

#### 1. Session Start Hook

```bash
#!/bin/bash
# .claude/hooks/session-start.sh

INPUT=$(cat)

# Extract session info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')
SOURCE=$(echo "$INPUT" | jq -r '.source')

# Get Maestro context from environment
MAESTRO_SESSION_ID=${MAESTRO_SESSION_ID:-unknown}
MAESTRO_TASK_IDS=${MAESTRO_TASK_IDS:-unknown}

# Send session start event to Maestro server
curl -X POST http://localhost:3000/api/webhooks/session-start \
  -H 'Content-Type: application/json' \
  -d "{
    \"claudeSessionId\": \"$SESSION_ID\",
    \"maestroSessionId\": \"$MAESTRO_SESSION_ID\",
    \"taskIds\": \"$MAESTRO_TASK_IDS\",
    \"cwd\": \"$CWD\",
    \"source\": \"$SOURCE\",
    \"timestamp\": $(date +%s)
  }" 2>/dev/null

# Optionally inject context back to Claude
echo "Session initialized for Maestro tasks: $MAESTRO_TASK_IDS"
```

#### 2. Tool Use Logger

```bash
#!/bin/bash
# .claude/hooks/log-tool-use.sh

INPUT=$(cat)

# Extract tool info
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
MAESTRO_SESSION_ID=${MAESTRO_SESSION_ID:-unknown}

# Tool-specific logging
case "$TOOL" in
  "Bash")
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')
    MESSAGE="Executed bash: $COMMAND"
    ;;
  "Write"|"Edit")
    FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path')
    MESSAGE="Modified file: $FILE"
    ;;
  "Read")
    FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path')
    MESSAGE="Read file: $FILE"
    ;;
  *)
    MESSAGE="Used tool: $TOOL"
    ;;
esac

# Send to Maestro server (async, fire-and-forget)
curl -X POST http://localhost:3000/api/webhooks/tool-use \
  -H 'Content-Type: application/json' \
  -d "{
    \"claudeSessionId\": \"$SESSION_ID\",
    \"maestroSessionId\": \"$MAESTRO_SESSION_ID\",
    \"tool\": \"$TOOL\",
    \"message\": \"$MESSAGE\",
    \"timestamp\": $(date +%s)
  }" 2>/dev/null &

# Optional: Also log to file for persistence
echo "$INPUT" | jq -c '. + {maestro_session_id: $mid}' \
  --arg mid "$MAESTRO_SESSION_ID" \
  >> "/tmp/maestro-tools-${MAESTRO_SESSION_ID}.jsonl"
```

#### 3. Permission Validator

```bash
#!/bin/bash
# .claude/hooks/validate-permission.sh

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

# Bash command validation
if [ "$TOOL" = "Bash" ]; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

  # Safe commands - auto-approve
  if echo "$COMMAND" | grep -qE '^(npm test|npm run test|jest|vitest|playwright test)'; then
    echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'
    exit 0
  fi

  if echo "$COMMAND" | grep -qE '^(git (status|diff|log)|ls|pwd|cat)'; then
    echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'
    exit 0
  fi

  # Dangerous patterns - deny
  if echo "$COMMAND" | grep -qE '(rm -rf|--force|sudo|eval|chmod 777)'; then
    echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","reason":"Blocked dangerous command"}}}'
    exit 0
  fi
fi

# Write/Edit validation
if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ]; then
  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path')

  # Protected files - deny
  if echo "$FILE" | grep -qE '(\.env|\.git/|credentials|secrets|private-key)'; then
    echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","reason":"Protected file"}}}'
    exit 0
  fi
fi

# Default: ask user
exit 0
```

#### 4. Stop Hook (Task Completion Check)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Review the conversation and determine if all assigned tasks are complete. The assigned task IDs are: ${MAESTRO_TASK_IDS}. Respond with {\"ok\": true} if ALL tasks are fully completed, or {\"ok\": false, \"reason\": \"explanation\"} if work remains. Be strict - only return true if everything is done."
          }
        ]
      }
    ]
  }
}
```

#### 5. Session End Hook

```bash
#!/bin/bash
# .claude/hooks/session-end.sh

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
REASON=$(echo "$INPUT" | jq -r '.reason')
MAESTRO_SESSION_ID=${MAESTRO_SESSION_ID:-unknown}

# Finalize session in Maestro
curl -X POST http://localhost:3000/api/webhooks/session-end \
  -H 'Content-Type: application/json' \
  -d "{
    \"claudeSessionId\": \"$SESSION_ID\",
    \"maestroSessionId\": \"$MAESTRO_SESSION_ID\",
    \"reason\": \"$REASON\",
    \"timestamp\": $(date +%s)
  }" 2>/dev/null

# Cleanup logs
rm -f "/tmp/maestro-tools-${MAESTRO_SESSION_ID}.jsonl"
```

---

## Recommended Architecture

### Phase 1: Foundation (Recommended Starting Point)

**Goal:** Get basic hook integration working with minimal complexity

**Components:**
1. **Centralized webhook endpoint** (`POST /api/webhooks/hook-event`)
2. **Four core hooks:**
   - `SessionStart` - Track session initialization
   - `PostToolUse` - Log all tool usage
   - `Notification` - Detect permission prompts
   - `SessionEnd` - Finalize session

3. **UI enhancements:**
   - Live activity feed on task cards
   - Pending action badges
   - Basic timeline

**Implementation Steps:**

1. Create webhook endpoint in maestro-server
2. Add hook scripts to `.claude/hooks/`
3. Configure hooks in `.claude/settings.json`
4. Add WebSocket event handlers in UI
5. Update UI components to display hook data

**Estimated Effort:** 8-12 hours

---

### Phase 2: Advanced Monitoring

**Goal:** Add comprehensive analytics and safety features

**New Components:**
1. **Permission validation** (`PreToolUse` hook)
2. **Error handling** (`PostToolUseFailure` hook)
3. **Subagent tracking** (`SubagentStart`, `SubagentStop` hooks)
4. **Tool usage analytics**
5. **Session health monitoring**

**Estimated Effort:** 12-16 hours

---

### Phase 3: Intelligent Automation

**Goal:** Autonomous decision-making and optimization

**New Components:**
1. **Smart auto-approval** (ML-based pattern recognition)
2. **Task completion verification** (`Stop` hook with agent validation)
3. **Context injection** (dynamic task context in `SessionStart`)
4. **Adaptive timeout management**
5. **Performance optimization**

**Estimated Effort:** 16-20 hours

---

## Implementation Plan

### Recommended Sequence

#### Week 1: Core Integration (Phase 1)

**Day 1: Server Infrastructure**
- [ ] Create `/api/webhooks/hook-event` endpoint
- [ ] Add hook event types to WebSocket
- [ ] Test webhook with curl

**Day 2: Hook Scripts**
- [ ] Create `.claude/hooks/` directory
- [ ] Write `session-start.sh`
- [ ] Write `log-tool-use.sh`
- [ ] Write `session-end.sh`
- [ ] Make scripts executable
- [ ] Test scripts with sample input

**Day 3: Hook Configuration**
- [ ] Create `.claude/settings.json`
- [ ] Configure `SessionStart` hook
- [ ] Configure `PostToolUse` hook
- [ ] Configure `SessionEnd` hook
- [ ] Test hooks with Claude Code session

**Day 4: UI Integration**
- [ ] Add hook event handlers to `useMaestroWebSocket`
- [ ] Create `LiveActivityFeed` component
- [ ] Add activity feed to task cards
- [ ] Test real-time updates

**Day 5: Testing & Polish**
- [ ] End-to-end testing
- [ ] Fix bugs
- [ ] Documentation
- [ ] Demo preparation

#### Week 2: Advanced Features (Phase 2)

**Day 1: Permission System**
- [ ] Write `validate-permission.sh`
- [ ] Configure `PreToolUse` hook
- [ ] Test auto-approval
- [ ] Test blocking

**Day 2: Error Handling**
- [ ] Write `handle-failure.sh`
- [ ] Configure `PostToolUseFailure` hook
- [ ] Add error notifications to UI
- [ ] Test error recovery

**Day 3: Analytics**
- [ ] Add tool metrics tracking
- [ ] Create analytics dashboard
- [ ] Add charts/visualizations
- [ ] Test metrics collection

**Day 4: Subagent Tracking**
- [ ] Configure `SubagentStart`/`SubagentStop` hooks
- [ ] Create agent hierarchy visualization
- [ ] Test with nested subagents

**Day 5: Integration & Testing**
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation updates

---

## Security Considerations

### Critical Security Rules

1. **Never trust hook input**
   - Validate all data from hooks
   - Sanitize before displaying in UI
   - Use parameterized queries

2. **Protect sensitive data**
   - Don't log credentials or secrets
   - Block access to `.env`, `.git`, key files
   - Use allowlists, not denylists

3. **Limit hook permissions**
   - Hooks run with user permissions
   - Don't run hooks as root
   - Use principle of least privilege

4. **Secure webhook endpoint**
   - Add authentication (API key, JWT)
   - Rate limiting
   - Input validation

5. **Prevent command injection**
   - Never use `eval` in hooks
   - Escape shell variables properly
   - Use jq for JSON parsing, not string manipulation

### Example: Secure Webhook Endpoint

```typescript
// maestro-server/src/api/webhooks.ts
import { randomBytes } from 'crypto';

// Generate and store API key
const HOOK_API_KEY = process.env.MAESTRO_HOOK_KEY || randomBytes(32).toString('hex');

router.post('/webhooks/hook-event', (req, res) => {
  // Verify API key
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${HOOK_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate input
  if (!req.body.session_id || !req.body.hook_event_name) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // Sanitize data before processing
  const sanitized = {
    session_id: String(req.body.session_id).substring(0, 100),
    hook_event_name: String(req.body.hook_event_name).substring(0, 50),
    // ... sanitize other fields
  };

  // Process event
  processHookEvent(sanitized);

  res.json({ success: true });
});
```

### Example: Secure Hook Script

```bash
#!/bin/bash
# .claude/hooks/secure-tool-use.sh

# Set secure defaults
set -euo pipefail
IFS=$'\n\t'

# Read and validate input
INPUT=$(cat)

# Validate JSON structure
if ! echo "$INPUT" | jq empty 2>/dev/null; then
  echo "Invalid JSON input" >&2
  exit 1
fi

# Extract fields safely with jq (not string manipulation)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')

# Validate session ID format (UUID)
if ! echo "$SESSION_ID" | grep -qE '^[a-f0-9-]{36}$'; then
  echo "Invalid session ID format" >&2
  exit 1
fi

# Use API key from environment (never hardcode)
API_KEY=${MAESTRO_HOOK_KEY:-}
if [ -z "$API_KEY" ]; then
  echo "MAESTRO_HOOK_KEY not set" >&2
  exit 1
fi

# Make secure API request
curl -X POST http://localhost:3000/api/webhooks/hook-event \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d "$INPUT" \
  --max-time 5 \
  --fail-with-body \
  2>/dev/null
```

---

## Appendix: Complete Hook Reference

### All 12 Hook Events

| Hook | When | Input | Output | Blockable |
|------|------|-------|--------|-----------|
| `SessionStart` | Session begins | `{session_id, cwd, source, model}` | Context injection | No |
| `UserPromptSubmit` | User submits prompt | `{prompt}` | Context / block | Yes |
| `PreToolUse` | Before tool call | `{tool_name, tool_input}` | Allow/deny/ask | Yes |
| `PermissionRequest` | Permission dialog | `{tool_name, tool_input}` | Allow/deny/modify | Yes |
| `PostToolUse` | After tool success | `{tool_name, tool_input, tool_response}` | Context | No |
| `PostToolUseFailure` | After tool failure | `{tool_name, tool_input, error}` | Context | No |
| `Notification` | Claude notification | `{notification_type, message, title}` | None | No |
| `SubagentStart` | Subagent spawned | `{agent_id, agent_type}` | Context injection | No |
| `SubagentStop` | Subagent finishes | `{agent_id, agent_type, transcript_path}` | Block/allow | Yes |
| `Stop` | Claude finishes | `{stop_hook_active}` | Block/allow | Yes |
| `PreCompact` | Before compaction | `{trigger, custom_instructions}` | None | No |
| `SessionEnd` | Session terminates | `{reason}` | None | No |

### Exit Codes

| Code | Meaning | Effect |
|------|---------|--------|
| 0 | Success | Continue, process output |
| 2 | Blocking error | Prevent action, show stderr to Claude |
| Other | Non-blocking error | Continue, stderr in verbose mode |

### JSON Output Structure

```json
{
  "continue": true,
  "stopReason": "Optional stop message",
  "systemMessage": "Optional warning",
  "suppressOutput": false,
  "hookSpecificOutput": {
    "hookEventName": "EventName",
    "...": "event-specific fields"
  }
}
```

### Environment Variables

- `$CLAUDE_PROJECT_DIR` - Project root
- `${CLAUDE_PLUGIN_ROOT}` - Plugin directory
- `CLAUDE_ENV_FILE` - Path to env file (SessionStart only)
- `MAESTRO_SESSION_ID` - Maestro session ID (custom)
- `MAESTRO_TASK_IDS` - Comma-separated task IDs (custom)

---

## Conclusion

This document provides multiple options for integrating Claude Code hooks into the Maestro orchestration system. The recommended approach is:

1. **Start with Phase 1** (Centralized Webhook + Core Hooks)
2. **Validate with real usage** (spawn sessions, test hooks)
3. **Iterate based on needs** (add Phase 2 features as required)

**Next Steps:**
1. Review this document
2. Choose implementation option (recommend Option 1: Centralized Webhook)
3. Decide on initial hook set (recommend Phase 1: 4 core hooks)
4. Begin implementation following the Week 1 plan

**Questions to Consider:**
- Should permission auto-approval be enabled by default?
- What level of logging detail is desired?
- Should hooks be project-wide or session-specific?
- What analytics/metrics are most valuable?
- How should errors be surfaced to users?

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
**Status:** Ready for Review
**Next Review:** After implementation decision
