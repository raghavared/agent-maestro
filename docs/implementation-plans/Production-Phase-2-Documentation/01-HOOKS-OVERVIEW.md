# Claude Code Hooks - Complete Reference

**Version:** 1.0
**Date:** 2026-02-01

---

## What Are Hooks?

**Hooks** are event-driven callbacks in Claude Code CLI that execute shell commands at specific lifecycle points during a coding session.

### Purpose

Hooks enable:
- 🔍 **Observability** - See what agents are doing in real-time
- 🎯 **Control** - Block dangerous operations, auto-approve safe ones
- 📊 **Analytics** - Track tool usage, success rates, session duration
- 🔔 **Notifications** - Alert when agents need attention
- 📝 **Audit trails** - Complete log of all agent actions

---

## All Available Hooks (12 Events)

| Hook | When It Fires | Can Block? | Use in Maestro |
|------|--------------|------------|----------------|
| **SessionStart** | Session begins/resumes | No | Initialize session tracking |
| **UserPromptSubmit** | User submits prompt | Yes | Validate prompts, add context |
| **PreToolUse** | Before tool executes | Yes | Block dangerous operations |
| **PermissionRequest** | Permission dialog appears | Yes | Auto-approve safe operations |
| **PostToolUse** | After tool succeeds | No | **Log to UI (PRIMARY)** |
| **PostToolUseFailure** | After tool fails | No | **Error notifications** |
| **Notification** | Claude sends notification | No | **Detect blocked agents** |
| **SubagentStart** | Subagent spawned | No | Track nested agents |
| **SubagentStop** | Subagent finishes | Yes | Validate completion |
| **Stop** | Claude finishes responding | Yes | Verify task completion |
| **PreCompact** | Before context compaction | No | Save state |
| **SessionEnd** | Session terminates | No | **Finalize metrics** |

---

## Hooks Used in Maestro (Phase 2)

### Core 4 Hooks (Week 1 Implementation)

#### 1. SessionStart ⭐

**Fires:** When Claude Code session begins, resumes, or after `/clear`

**Input Data:**
```json
{
  "session_id": "abc123-def456",
  "cwd": "/Users/user/project",
  "source": "startup",  // startup|resume|clear|compact
  "model": "claude-sonnet-4-5-20250929",
  "hook_event_name": "SessionStart"
}
```

**Maestro Use:**
- Register Claude session ID with Maestro session
- Send "Session started" event to UI
- Initialize session tracking
- Inject task context for Claude

**UI Updates:**
- Session status badge → "🟢 Active"
- Timeline: "Session started at 10:00 AM"
- Session start timestamp recorded

**Hook Script:** `session-start.sh`

---

#### 2. PostToolUse ⭐⭐⭐ (MOST IMPORTANT)

**Fires:** After every successful tool call

**Input Data:**
```json
{
  "session_id": "abc123",
  "hook_event_name": "PostToolUse",
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/path/to/file.ts"
  },
  "tool_response": {
    "success": true
  },
  "tool_use_id": "toolu_01ABC123"
}
```

**Tool-Specific Data:**

**Bash:**
```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite",
    "timeout": 120000
  }
}
```

**Write/Edit:**
```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "content": "..."
  }
}
```

**Read:**
```json
{
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/path/to/file.ts"
  }
}
```

**Grep:**
```json
{
  "tool_name": "Grep",
  "tool_input": {
    "pattern": "TODO",
    "path": "/src"
  }
}
```

**Maestro Use:**
- Log all tool usage to UI in real-time
- Build timeline of agent actions
- Track tool usage metrics
- Update session activity timestamp

**UI Updates:**
- **Live activity feed:** "Reading auth.ts" (appears instantly)
- **Timeline:** "10:05 AM - Read src/auth/login.ts"
- **Tool usage chart:** Read counter incremented
- **Session metrics:** Total tools used updated
- **Last activity timestamp:** Updated to now

**Hook Script:** `log-tool-use.sh`

**Frequency:** HIGH (fires on every tool call)

---

#### 3. Notification ⭐⭐

**Fires:** When Claude sends a notification

**Matcher Values:**
- `permission_prompt` - Needs permission (MOST IMPORTANT)
- `idle_prompt` - Claude has been idle
- `auth_success` - Authentication succeeded
- `elicitation_dialog` - Feedback requested

**Input Data:**
```json
{
  "hook_event_name": "Notification",
  "notification_type": "permission_prompt",
  "message": "Claude needs your permission to use Bash",
  "title": "Permission needed"
}
```

**Maestro Use (permission_prompt):**
- Detect when agent is blocked waiting for permission
- Update task status to "blocked"
- Show pending action badge in UI
- Optionally auto-approve based on rules

**UI Updates:**
- **Task status badge:** "⚠️ Blocked" appears (red/yellow)
- **Permission modal:** Shows blocked command
- **Task status:** Changes from "in_progress" to "blocked"
- **Timeline:** "Waiting for permission: git push"
- **Notification:** Desktop/toast notification (optional)

**Hook Script:** `notify-permission.sh`

**Frequency:** LOW (only when permission needed)

---

#### 4. SessionEnd ⭐

**Fires:** When session terminates

**Matcher Values:**
- `clear` - `/clear` command
- `logout` - User logout
- `prompt_input_exit` - User exited at prompt
- `other` - Other reasons

**Input Data:**
```json
{
  "hook_event_name": "SessionEnd",
  "session_id": "abc123",
  "reason": "other"
}
```

**Maestro Use:**
- Finalize session metrics
- Mark session as completed
- Calculate total duration
- Save final timeline

**UI Updates:**
- **Session status badge:** "✓ Completed" (green)
- **Timeline:** "Session ended at 10:07 AM"
- **Session duration:** "Duration: 7m 34s"
- **Final metrics:** Tool usage summary saved

**Hook Script:** `session-end.sh`

**Frequency:** LOW (once per session)

---

### Enhanced Hooks (Phase 2B - Future)

#### 5. PostToolUseFailure

**Fires:** When a tool call fails

**Input Data:**
```json
{
  "hook_event_name": "PostToolUseFailure",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  },
  "error": "Command exited with non-zero status code 1",
  "is_interrupt": false
}
```

**Maestro Use:**
- Detect errors immediately
- Send error notifications
- Update task timeline with error
- Track error rates

**UI Updates:**
- **Error toast:** "Test failed: exit code 1"
- **Timeline:** "10:05 AM - ❌ npm test failed"
- **Error log panel:** Error details added
- **Session metrics:** Error count incremented

---

#### 6. PreToolUse

**Fires:** Before tool executes (for validation/blocking)

**Input Data:**
```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "rm -rf node_modules"
  }
}
```

**Maestro Use:**
- Block dangerous commands
- Validate file paths
- Enforce security policies
- Auto-approve safe operations

**Can Return:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Blocked dangerous command: rm -rf"
  }
}
```

**UI Updates:**
- **Task status:** "blocked" (if denied)
- **Timeline:** "Blocked dangerous operation"
- **Notification:** "Operation blocked by security policy"

---

#### 7. SubagentStart / SubagentStop

**Fires:** When agents spawn subagents (via Task tool)

**Input Data:**
```json
{
  "hook_event_name": "SubagentStart",
  "agent_id": "agent-abc123",
  "agent_type": "Explore"
}
```

**Maestro Use:**
- Track agent hierarchy
- Show nested agent activity
- Monitor subagent progress

**UI Updates:**
- **Agent tree:** Shows parent/child relationships
- **Timeline:** "Spawned Explore agent"
- **Subagent panel:** Shows active subagents

---

#### 8. Stop

**Fires:** When Claude finishes responding

**Maestro Use:**
- Verify task completion
- Prevent premature stopping
- Check if all work is done

**Can Block:** Yes (to keep agent working)

**Example with Prompt Hook:**
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Are all tasks complete? Task IDs: $MAESTRO_TASK_IDS. Return {\"ok\": true} if done, {\"ok\": false, \"reason\": \"...\"} if not."
          }
        ]
      }
    ]
  }
}
```

---

## Hook Types

### 1. Command Hooks (`type: "command"`)

Execute shell scripts:

```json
{
  "type": "command",
  "command": "/path/to/script.sh",
  "async": true  // Optional: run in background
}
```

**Input:** JSON on stdin
**Output:** Exit code + JSON/text on stdout

**Exit Codes:**
- `0` - Success (process output)
- `2` - Blocking error (prevent action)
- Other - Non-blocking error

---

### 2. Prompt Hooks (`type: "prompt"`)

Single LLM evaluation:

```json
{
  "type": "prompt",
  "prompt": "Check if tests pass. Return {\"ok\": true} or {\"ok\": false, \"reason\": \"...\"}"
}
```

**Uses:** Haiku model (fast)
**Output:** `{ok: boolean, reason?: string}`
**Best for:** Simple yes/no decisions

---

### 3. Agent Hooks (`type: "agent"`)

Multi-turn subagent:

```json
{
  "type": "agent",
  "agent": "custom-validator",
  "max_turns": 10
}
```

**Can use tools:** Yes
**Best for:** Complex validation requiring tool use

---

## Hook Configuration Locations

Hooks can be configured at multiple levels:

### 1. User-Wide (All Projects)
```
~/.claude/settings.json
```
Applies to all Claude Code sessions.

### 2. Project-Wide (Shareable)
```
.claude/settings.json
```
Checked into git, shared with team.

### 3. Project-Local (Not Shared)
```
.claude/settings.local.json
```
Gitignored, local overrides.

### 4. Maestro Configuration (Recommended)

For Maestro, hooks are configured at **project level**:

```
/Users/user/project/.claude/settings.json
/Users/user/project/.claude/hooks/
  ├── session-start.sh
  ├── log-tool-use.sh
  ├── notify-permission.sh
  └── session-end.sh
```

---

## Hook Configuration Format

### Basic Structure

```json
{
  "hooks": {
    "HookEventName": [
      {
        "matcher": "pattern",  // Optional
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/script.sh"
          }
        ]
      }
    ]
  }
}
```

### With Matchers

Matchers filter when hooks run:

**Tool name matching:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",  // Only for Bash tool
        "hooks": [...]
      },
      {
        "matcher": "Write|Edit",  // For Write OR Edit
        "hooks": [...]
      },
      {
        "matcher": ".*",  // All tools
        "hooks": [...]
      }
    ]
  }
}
```

**Notification type matching:**
```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",  // Only permission prompts
        "hooks": [...]
      }
    ]
  }
}
```

**Session source matching:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",  // Only on fresh startup
        "hooks": [...]
      }
    ]
  }
}
```

---

## Maestro Hook Configuration (Complete)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-start.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/log-tool-use.sh",
            "async": true
          }
        ]
      }
    ],
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
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-end.sh"
          }
        ]
      }
    ]
  }
}
```

---

## Environment Variables

Available in hook scripts:

### Claude-Provided
- `$CLAUDE_PROJECT_DIR` - Project root directory
- `${CLAUDE_PLUGIN_ROOT}` - Plugin directory (if applicable)
- `CLAUDE_ENV_FILE` - Path to env file (SessionStart only)

### Maestro-Provided (Set at Session Spawn)
- `MAESTRO_SESSION_ID` - Maestro session ID (e.g., "s123")
- `MAESTRO_TASK_IDS` - Comma-separated task IDs (e.g., "t1,t2")
- `MAESTRO_API_URL` - Maestro server URL (e.g., "http://localhost:3000")
- `MAESTRO_PROJECT_ID` - Project ID (e.g., "p1")

**Usage in scripts:**
```bash
#!/bin/bash
SESSION_ID=${MAESTRO_SESSION_ID:-unknown}
TASK_IDS=${MAESTRO_TASK_IDS:-unknown}
API_URL=${MAESTRO_API_URL:-http://localhost:3000}
```

---

## Hook Input Format

All hooks receive JSON on stdin:

### Common Fields (All Hooks)
```json
{
  "session_id": "abc123-def456",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/Users/user/project",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse"
}
```

### Event-Specific Fields

Different hooks add different fields (see individual hook sections above).

---

## Hook Output Format

### Command Hooks

**Exit Code + Optional JSON:**

```bash
#!/bin/bash
# Success (allow action)
exit 0

# Block action
echo "Dangerous operation detected" >&2
exit 2
```

**With JSON output:**
```bash
#!/bin/bash
echo '{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Protected file"
  }
}'
exit 0
```

### Prompt/Agent Hooks

**Must return:**
```json
{
  "ok": true  // or false
}
```

**Or with reason:**
```json
{
  "ok": false,
  "reason": "Tests are still failing"
}
```

---

## Best Practices

### 1. Use Async for Non-Critical Hooks

```json
{
  "type": "command",
  "command": "/path/to/script.sh",
  "async": true  // Don't block Claude waiting for response
}
```

**Use async for:**
- Logging hooks (PostToolUse)
- Notification hooks
- Metrics collection

**Don't use async for:**
- Validation hooks (PreToolUse)
- Session initialization (SessionStart)
- Blocking hooks (Stop)

---

### 2. Always Quote Path Variables

```bash
# CORRECT
"$CLAUDE_PROJECT_DIR"/.claude/hooks/script.sh

# WRONG (fails with spaces in path)
$CLAUDE_PROJECT_DIR/.claude/hooks/script.sh
```

---

### 3. Use jq for JSON Parsing

```bash
#!/bin/bash
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path')
```

Never use string manipulation for JSON.

---

### 4. Set Secure Defaults

```bash
#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures
IFS=$'\n\t'        # Safe word splitting
```

---

### 5. Handle Errors Gracefully

```bash
#!/bin/bash
curl -X POST "$API_URL/webhook" \
  -d "$INPUT" \
  --max-time 5 \
  --silent \
  --show-error \
  2>/dev/null || true  # Don't fail hook if curl fails
```

---

### 6. Use Timeouts

```bash
curl --max-time 5 ...  # Timeout after 5 seconds
```

Prevents hung hooks.

---

## Security Considerations

### Protected Files (Never Access)
- `.env` files
- `.git` directory
- `credentials.*`
- `secrets.*`
- `private-key.*`
- `*.pem`, `*.key`

### Dangerous Commands (Block in PreToolUse)
- `rm -rf`
- `sudo`
- `eval`
- `chmod 777`
- `--force` flags

### Input Validation
```bash
# Validate session ID format (UUID)
if ! echo "$SESSION_ID" | grep -qE '^[a-f0-9-]{36}$'; then
  echo "Invalid session ID" >&2
  exit 1
fi
```

---

## Debugging Hooks

### Enable Debug Mode
```bash
claude --debug
```

Shows hook execution details.

### Test Hooks Manually

```bash
# Test session-start.sh
echo '{
  "session_id": "test-123",
  "source": "startup"
}' | .claude/hooks/session-start.sh
```

### Check Hook Execution in Transcript

Hooks are logged in transcript:
```
~/.claude/projects/<project>/transcript.jsonl
```

---

## Performance Considerations

### Hook Overhead

**Typical latencies:**
- Hook execution: 10-50ms
- Network POST: 5-20ms
- WebSocket broadcast: 1-5ms
- **Total:** ~20-75ms end-to-end

**High-frequency hooks:**
- PostToolUse: Can fire 100+ times per session
- Use `async: true` to avoid blocking

**Optimization tips:**
- Keep scripts fast (< 50ms)
- Use async for logging
- Batch events if needed

---

## Troubleshooting

### Hook Not Firing

**Check:**
1. Is `.claude/settings.json` valid JSON?
2. Are scripts executable? (`chmod +x .claude/hooks/*.sh`)
3. Are matchers correct?
4. Is Claude in the right project directory?

**Debug:**
```bash
# Validate JSON
jq empty < .claude/settings.json

# Test script
bash -x .claude/hooks/session-start.sh
```

---

### Hook Firing But No UI Update

**Check:**
1. Is Maestro server running?
2. Is webhook endpoint accessible?
3. Is WebSocket connected?
4. Check server logs for errors

**Debug:**
```bash
# Test webhook directly
curl -X POST http://localhost:3000/api/webhooks/hook-event \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read"}'
```

---

## Summary

### For Maestro Phase 2, We Use:

**4 Core Hooks:**
1. **SessionStart** - Initialize tracking
2. **PostToolUse** - Real-time activity (MOST IMPORTANT)
3. **Notification** - Detect blocked agents
4. **SessionEnd** - Finalize metrics

**Configuration:**
- Location: `.claude/settings.json` (project root)
- Scripts: `.claude/hooks/*.sh`
- Delivery: HTTP POST to webhook endpoint

**UI Impact:**
- Live activity feeds
- Pending action badges
- Automatic timelines
- Tool usage analytics
- Error notifications

**Next:** See [02-WEBHOOK-ARCHITECTURE.md](./02-WEBHOOK-ARCHITECTURE.md) for server implementation.

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
