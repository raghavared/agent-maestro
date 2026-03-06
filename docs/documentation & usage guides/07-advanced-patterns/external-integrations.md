# Integrating with External Tools

**Maestro is designed to integrate with external systems — from displaying interactive modals to piping output into scripts. This guide covers the integration points available.**

---

## Modal System

Agents can display interactive HTML modals to the user via the Maestro UI. This enables rich interactions — forms, visualizations, confirmations — beyond plain text.

### Showing a Modal

```bash
maestro show modal <html-file-path> \
  --title "Review Results" \
  --id my-modal \
  --interactive \
  --timeout 60000
```

| Flag | Description |
|------|-------------|
| `<html-file-path>` | Path to an HTML file to display |
| `--title` | Modal title bar text |
| `--id` | Custom modal identifier (auto-generated if omitted) |
| `--interactive` | Keep the CLI process alive and stream user actions back |
| `--timeout` | Auto-close after N milliseconds |

### How Modals Work

1. The CLI reads the HTML file and injects a JavaScript bridge
2. Sends the content to the server via `POST /api/sessions/{sessionId}/modal`
3. Server emits a `session:modal` WebSocket event to the UI
4. The Maestro desktop app renders the HTML in an iframe
5. User interactions are sent back through the bridge

### The Bridge API

Every modal gets a `window.maestro` object injected automatically:

```javascript
window.maestro = {
  modalId: "my-modal",

  // Send an action to the listening CLI process
  sendAction: function(action, data) { ... },

  // Close the modal
  close: function() { ... }
};
```

### Example: Interactive Form Modal

```html
<!DOCTYPE html>
<html>
<body>
  <h2>Deploy Configuration</h2>
  <select id="env">
    <option value="staging">Staging</option>
    <option value="production">Production</option>
  </select>
  <button onclick="submit()">Deploy</button>
  <button onclick="window.maestro.close()">Cancel</button>

  <script>
    function submit() {
      const env = document.getElementById('env').value;
      window.maestro.sendAction('deploy', { environment: env });
    }
  </script>
</body>
</html>
```

### Listening for Modal Events

When launched with `--interactive`, the CLI streams events as JSONL:

```bash
maestro show modal deploy.html --interactive
```

Output:

```json
{"event":"action","modalId":"my-modal","action":"deploy","data":{"environment":"staging"},"timestamp":1706000000000}
{"event":"closed","modalId":"my-modal","timestamp":1706000005000}
```

You can also listen separately:

```bash
maestro modal events <modal-id> --timeout 30000
```

### Modal Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions/:id/modal` | POST | Create and display a modal |
| `/api/sessions/:id/modal/:modalId/actions` | POST | Send action from modal to CLI |
| `/api/sessions/:id/modal/:modalId/close` | POST | Close a modal |

## Scripting with --json

Every Maestro CLI command supports `--json` for machine-readable output. This enables piping Maestro data into other tools.

### Basic Usage

```bash
# Get task data as JSON
maestro task get <task-id> --json

# List sessions as JSON
maestro session list --json

# Get current context
maestro whoami --json
```

### Piping into Other Tools

```bash
# Get all in-progress tasks and extract IDs
maestro task list --status in_progress --json | jq -r '.[].id'

# Count sessions by status
maestro session list --json | jq 'group_by(.status) | map({status: .[0].status, count: length})'

# Get a task description for another tool
TASK_DESC=$(maestro task get <task-id> --json | jq -r '.description')
echo "$TASK_DESC" | some-other-tool
```

### Scripting Workflows

```bash
#!/bin/bash
# Script: spawn workers for all pending tasks

TASKS=$(maestro task list --status todo --json | jq -r '.[].id')

for TASK_ID in $TASKS; do
  echo "Spawning worker for task: $TASK_ID"
  maestro session spawn --task "$TASK_ID" --mode worker
done
```

```bash
#!/bin/bash
# Script: wait for all sessions to complete

while true; do
  ACTIVE=$(maestro session list --status working --json | jq 'length')
  if [ "$ACTIVE" -eq 0 ]; then
    echo "All sessions complete."
    break
  fi
  echo "$ACTIVE sessions still working..."
  sleep 10
done
```

## Agent Tool Support

Maestro supports three agent backends, not just Claude Code:

| Tool | CLI Command | Models |
|------|------------|--------|
| `claude-code` | `claude` | sonnet, opus, haiku |
| `codex` | `codex` | Codex models |
| `gemini` | `gemini` | gemini-3-pro-preview, gemini-2.5-pro, gemini-2.5-flash |

### Spawning with Different Tools

```bash
# Use Gemini instead of Claude
maestro session spawn --task <task-id> --agent-tool gemini --model gemini-2.5-pro

# Use Codex
maestro session spawn --task <task-id> --agent-tool codex
```

### Per-Team-Member Tool Assignment

```bash
# Create a team member that uses Gemini
maestro team-member create "Gemini Worker" \
  --role "Developer" \
  --agent-tool gemini \
  --model gemini-2.5-pro
```

### Model Mapping

When switching agent tools, Maestro maps model names across platforms:

| Maestro Name | Claude Code | Gemini |
|-------------|-------------|--------|
| `opus` | claude-opus | gemini-3-pro-preview |
| `sonnet` | claude-sonnet | gemini-2.5-pro |
| `haiku` | claude-haiku | gemini-2.5-flash |

## Skills System Integration

Skills are markdown instruction files that inject domain-specific capabilities into any agent session.

### Skill Locations

```
# Global (personal)
~/.claude/skills/<skill-name>/SKILL.md
~/.agents/skills/<skill-name>/SKILL.md

# Project-scoped (overrides global)
<project>/.claude/skills/<skill-name>/SKILL.md
<project>/.agents/skills/<skill-name>/SKILL.md
```

### Installing Skills

```bash
# Install from GitHub
maestro skill install owner/repo --scope global

# Browse the marketplace
maestro skill browse "code review"
```

### Skill Management

```bash
# List available skills
maestro skill list --scope all

# Get skill details
maestro skill info <skill-name>

# Validate all skills
maestro skill validate
```

### SKILL.md Format

```markdown
---
name: my-skill
description: "What this skill does"
version: "1.0.0"
triggers: ["keyword1", "keyword2"]
tags: ["category"]
---

# Instructions

Your skill instructions here. This content is injected into the agent's system prompt.
```

Skills are loaded via `--plugin-dir` flags when spawning Claude Code sessions, making them available automatically.

## Notification Hooks

Use hooks to trigger external notifications on session lifecycle events.

### Custom Notification on Session Complete

Add a notification hook to your plugin's `hooks.json`:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "maestro session complete",
            "timeout": 3
          },
          {
            "type": "command",
            "command": "curl -s -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL -H 'Content-Type: application/json' -d '{\"text\": \"Session '$MAESTRO_SESSION_ID' completed\"}'",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### Notification Patterns

| Event | Hook | Use Case |
|-------|------|----------|
| Session starts | `SessionStart` | Notify team that work began |
| Session blocked | `Stop` | Alert human to unblock |
| Session completes | `SessionEnd` | Trigger CI pipeline |
| Tool fails | `PostToolUseFailure` | Log errors to monitoring |
| Permission needed | `PermissionRequest` | Ping someone to approve |

Environment variables (`MAESTRO_SESSION_ID`, `MAESTRO_TASK_IDS`, etc.) are available in all hooks for context.

## WebSocket Events

For real-time integration, connect to Maestro's WebSocket server:

```
ws://localhost:3000/ws
```

Events emitted:

| Event | Payload | When |
|-------|---------|------|
| `session:created` | Session object | New session spawned |
| `session:updated` | Session object | Status change, progress report |
| `session:modal` | Modal content | Agent shows a modal |
| `session:modal_action` | Action data | User interacts with modal |
| `session:prompt_send` | Prompt data | Session receives a message |

### Example: WebSocket Listener

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  if (event.type === 'session:updated' && event.data.status === 'completed') {
    console.log(`Session ${event.data.id} finished!`);
    // Trigger your integration
  }
});
```

## REST API

The full Maestro API is available for custom integrations:

```bash
# Base URL
http://localhost:3000/api

# Key endpoints
GET  /api/projects              # List projects
GET  /api/tasks                 # List tasks
GET  /api/sessions              # List sessions
POST /api/sessions/spawn        # Spawn a session
POST /api/sessions/:id/prompt   # Send message to session
GET  /api/skills                # List skills
GET  /api/health                # Health check
```

All endpoints return JSON. Use them to build custom dashboards, automation scripts, or integrations with your existing tools.
