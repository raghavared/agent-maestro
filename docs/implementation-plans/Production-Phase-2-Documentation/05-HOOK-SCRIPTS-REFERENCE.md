# Hook Scripts Reference

**Version:** 1.0
**Date:** 2026-02-01

---

## Overview

This document provides the complete, production-ready hook scripts for Maestro Phase 2.

All scripts located in: `.claude/hooks/`

---

## Script 1: session-start.sh

**Purpose:** Initialize session tracking, register Claude session with Maestro

**Fires:** When Claude Code session starts

**File:** `.claude/hooks/session-start.sh`

```bash
#!/bin/bash
# .claude/hooks/session-start.sh
# Purpose: Register Claude session with Maestro and send session start event

set -euo pipefail
IFS=$'\n\t'

# Read hook input from stdin
INPUT=$(cat)

# Extract session info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
SOURCE=$(echo "$INPUT" | jq -r '.source')
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Get Maestro context from environment variables
MAESTRO_SESSION_ID=${MAESTRO_SESSION_ID:-unknown}
MAESTRO_TASK_IDS=${MAESTRO_TASK_IDS:-unknown}
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}
MAESTRO_PROJECT_ID=${MAESTRO_PROJECT_ID:-unknown}

# Log for debugging
echo "[Maestro Hook] Session starting: $SESSION_ID" >&2
echo "[Maestro Hook] Maestro session: $MAESTRO_SESSION_ID" >&2
echo "[Maestro Hook] Task IDs: $MAESTRO_TASK_IDS" >&2

# Step 1: Register Claude session ID with Maestro
if [ "$MAESTRO_SESSION_ID" != "unknown" ]; then
  echo "[Maestro Hook] Registering Claude session with Maestro..." >&2
  
  curl -X POST "${MAESTRO_API_URL}/api/sessions/${MAESTRO_SESSION_ID}/register-claude-session" \
    -H 'Content-Type: application/json' \
    -d "{\"claudeSessionId\": \"$SESSION_ID\"}" \
    --max-time 5 \
    --silent \
    --show-error \
    2>&1 || echo "[Maestro Hook] Failed to register Claude session" >&2
fi

# Step 2: Send session start event to webhook
echo "[Maestro Hook] Sending session start event..." >&2

curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 \
  --silent \
  --show-error \
  2>&1 || echo "[Maestro Hook] Failed to send session start event" >&2

# Step 3: Inject context for Claude (appears in conversation)
echo ""
echo "🎯 Maestro Session Initialized"
echo "   Session ID: $MAESTRO_SESSION_ID"
echo "   Task IDs: $MAESTRO_TASK_IDS"
echo "   Project: $MAESTRO_PROJECT_ID"
echo ""

# Exit successfully
exit 0
```

**Make executable:**
```bash
chmod +x .claude/hooks/session-start.sh
```

**Test:**
```bash
MAESTRO_SESSION_ID=s123 \
MAESTRO_TASK_IDS=t1,t2 \
echo '{"session_id":"test-abc","source":"startup","cwd":"/path"}' | \
.claude/hooks/session-start.sh
```

Expected output:
```
🎯 Maestro Session Initialized
   Session ID: s123
   Task IDs: t1,t2
   Project: unknown
```

---

## Script 2: log-tool-use.sh

**Purpose:** Log all tool usage to Maestro server for real-time UI updates

**Fires:** After every tool call (Read, Write, Edit, Bash, etc.)

**File:** `.claude/hooks/log-tool-use.sh`

```bash
#!/bin/bash
# .claude/hooks/log-tool-use.sh
# Purpose: Log all tool usage to Maestro for real-time activity feed

set -euo pipefail
IFS=$'\n\t'

# Read hook input from stdin
INPUT=$(cat)

# Get Maestro API URL
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}

# Extract tool info for logging (optional, for debugging)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
echo "[Maestro Hook] Tool used: $TOOL" >&2

# Send event to Maestro (async, fire-and-forget)
# Using & to run in background so it doesn't block Claude
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 \
  --silent \
  --show-error \
  2>&1 &

# Exit immediately (don't wait for curl)
exit 0
```

**Make executable:**
```bash
chmod +x .claude/hooks/log-tool-use.sh
```

**Test:**
```bash
echo '{
  "session_id":"test-abc",
  "hook_event_name":"PostToolUse",
  "tool_name":"Read",
  "tool_input":{"file_path":"test.ts"}
}' | .claude/hooks/log-tool-use.sh
```

**Notes:**
- Runs asynchronously (async: true in config)
- Fire-and-forget (doesn't wait for response)
- Minimal latency impact on Claude

---

## Script 3: notify-permission.sh

**Purpose:** Notify Maestro when agent is blocked waiting for permission

**Fires:** When Claude shows a permission prompt

**File:** `.claude/hooks/notify-permission.sh`

```bash
#!/bin/bash
# .claude/hooks/notify-permission.sh
# Purpose: Notify Maestro UI when agent needs permission

set -euo pipefail
IFS=$'\n\t'

# Read hook input from stdin
INPUT=$(cat)

# Get Maestro API URL
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}

# Extract notification info for logging
NOTIF_TYPE=$(echo "$INPUT" | jq -r '.notification_type // "unknown"')
MESSAGE=$(echo "$INPUT" | jq -r '.message // ""')

echo "[Maestro Hook] Notification: $NOTIF_TYPE" >&2
echo "[Maestro Hook] Message: $MESSAGE" >&2

# Send event to Maestro (async)
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 \
  --silent \
  --show-error \
  2>&1 &

# Exit immediately
exit 0
```

**Make executable:**
```bash
chmod +x .claude/hooks/notify-permission.sh
```

**Test:**
```bash
echo '{
  "session_id":"test-abc",
  "hook_event_name":"Notification",
  "notification_type":"permission_prompt",
  "message":"Claude needs permission to use Bash"
}' | .claude/hooks/notify-permission.sh
```

---

## Script 4: session-end.sh

**Purpose:** Finalize session metrics when Claude session ends

**Fires:** When Claude session terminates

**File:** `.claude/hooks/session-end.sh`

```bash
#!/bin/bash
# .claude/hooks/session-end.sh
# Purpose: Finalize Maestro session when Claude session ends

set -euo pipefail
IFS=$'\n\t'

# Read hook input from stdin
INPUT=$(cat)

# Get Maestro API URL
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}

# Extract session end info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
REASON=$(echo "$INPUT" | jq -r '.reason // "unknown"')

echo "[Maestro Hook] Session ending: $SESSION_ID" >&2
echo "[Maestro Hook] Reason: $REASON" >&2

# Send session end event (synchronous - wait for confirmation)
# This is important so the server can finalize metrics
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 \
  --silent \
  --show-error \
  2>&1 || echo "[Maestro Hook] Failed to send session end event" >&2

# Cleanup (optional)
# Remove temporary files if any
# rm -f /tmp/maestro-session-${MAESTRO_SESSION_ID:-unknown}.log 2>/dev/null || true

echo "[Maestro Hook] Session end event sent" >&2

# Exit successfully
exit 0
```

**Make executable:**
```bash
chmod +x .claude/hooks/session-end.sh
```

**Test:**
```bash
echo '{
  "session_id":"test-abc",
  "hook_event_name":"SessionEnd",
  "reason":"other"
}' | .claude/hooks/session-end.sh
```

---

## Quick Setup Script

Create all scripts at once:

```bash
#!/bin/bash
# setup-hooks.sh - Quick setup for Maestro hooks

cd /Users/subhang/Desktop/Projects/agents-ui

# Create directory
mkdir -p .claude/hooks

# Create session-start.sh
cat > .claude/hooks/session-start.sh << 'EOF'
#!/bin/bash
set -euo pipefail
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
MAESTRO_SESSION_ID=${MAESTRO_SESSION_ID:-unknown}
MAESTRO_TASK_IDS=${MAESTRO_TASK_IDS:-unknown}
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}
MAESTRO_PROJECT_ID=${MAESTRO_PROJECT_ID:-unknown}

if [ "$MAESTRO_SESSION_ID" != "unknown" ]; then
  curl -X POST "${MAESTRO_API_URL}/api/sessions/${MAESTRO_SESSION_ID}/register-claude-session" \
    -H 'Content-Type: application/json' \
    -d "{\"claudeSessionId\": \"$SESSION_ID\"}" \
    --max-time 5 --silent 2>&1 || true
fi

curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 --silent 2>&1 || true

echo ""
echo "🎯 Maestro Session Initialized"
echo "   Session ID: $MAESTRO_SESSION_ID"
echo "   Task IDs: $MAESTRO_TASK_IDS"
echo ""
EOF

# Create log-tool-use.sh
cat > .claude/hooks/log-tool-use.sh << 'EOF'
#!/bin/bash
set -euo pipefail
INPUT=$(cat)
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 --silent 2>&1 &
EOF

# Create notify-permission.sh
cat > .claude/hooks/notify-permission.sh << 'EOF'
#!/bin/bash
set -euo pipefail
INPUT=$(cat)
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 --silent 2>&1 &
EOF

# Create session-end.sh
cat > .claude/hooks/session-end.sh << 'EOF'
#!/bin/bash
set -euo pipefail
INPUT=$(cat)
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 --silent 2>&1 || true
EOF

# Make all executable
chmod +x .claude/hooks/*.sh

echo "✅ Hook scripts created and made executable"
echo ""
echo "Next steps:"
echo "1. Create .claude/settings.json with hook configuration"
echo "2. Test hooks: echo '{...}' | .claude/hooks/session-start.sh"
echo "3. Start a Claude session and verify hooks fire"
```

---

## Environment Variables Used

| Variable | Set By | Purpose | Example |
|----------|--------|---------|---------|
| `MAESTRO_SESSION_ID` | Session spawn | Maestro session ID | `s123` |
| `MAESTRO_TASK_IDS` | Session spawn | Task IDs (comma-separated) | `t1,t2` |
| `MAESTRO_API_URL` | Session spawn | Maestro server URL | `http://localhost:3000` |
| `MAESTRO_PROJECT_ID` | Session spawn | Project ID | `p1` |
| `CLAUDE_PROJECT_DIR` | Claude Code | Project root directory | `/Users/user/project` |

---

## Debugging

### Enable Debug Output

Add to scripts:
```bash
set -x  # Print commands as they execute
```

### Test Individual Script

```bash
# Set environment
export MAESTRO_SESSION_ID=s123
export MAESTRO_TASK_IDS=t1,t2
export MAESTRO_API_URL=http://localhost:3000

# Test script
echo '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read"}' | \
bash -x .claude/hooks/log-tool-use.sh
```

### Check Server Logs

```bash
# In maestro-server
tail -f logs/server.log | grep "Webhook"
```

---

## Common Issues

### Scripts Not Executable

**Error:** `Permission denied`

**Fix:**
```bash
chmod +x .claude/hooks/*.sh
```

### jq Not Found

**Error:** `jq: command not found`

**Fix:**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

### curl Timeout

**Error:** `curl: (28) Operation timed out`

**Fix:**
- Check Maestro server is running
- Verify MAESTRO_API_URL is correct
- Increase timeout: `--max-time 10`

---

**Next:** See [04-IMPLEMENTATION-GUIDE.md](./04-IMPLEMENTATION-GUIDE.md) for full implementation steps.

