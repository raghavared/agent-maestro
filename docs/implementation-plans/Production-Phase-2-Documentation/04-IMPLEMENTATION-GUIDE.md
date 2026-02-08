# Implementation Guide - Step by Step

**Version:** 1.0
**Date:** 2026-02-01
**Estimated Time:** 8-12 hours

---

## Prerequisites

- [x] Production Phase 1 complete (session spawning works)
- [x] Maestro server running
- [x] UI connected via WebSocket
- [x] Claude Code CLI installed (with hooks support)

---

## Implementation Timeline

### Day 1: Server Infrastructure (3-4 hours)

**Morning (2 hours):**
- Create webhook endpoint
- Add Storage hook methods
- Mount webhook router

**Afternoon (1-2 hours):**
- Test webhook with curl
- Verify WebSocket broadcasting
- Debug any issues

### Day 2: Hook Scripts (2-3 hours)

**Morning (1.5 hours):**
- Create `.claude/hooks/` directory
- Write 4 hook scripts
- Make scripts executable

**Afternoon (0.5-1.5 hours):**
- Configure `.claude/settings.json`
- Test hooks manually
- Verify scripts work

### Day 3: UI Integration (2-3 hours)

**Morning (1.5 hours):**
- Add WebSocket event handlers
- Create LiveActivityFeed component
- Add to TaskCard

**Afternoon (0.5-1.5 hours):**
- Add pending action badges
- Add ErrorToast component
- Style components

### Day 4: Testing & Polish (2-3 hours)

**All day:**
- End-to-end testing
- Fix bugs
- Update documentation
- Demo preparation

---

## Step-by-Step Instructions

### STEP 1: Create Webhook Endpoint

**File:** `maestro-server/src/api/webhooks.ts`

Create new file and paste the complete webhook router code from [02-WEBHOOK-ARCHITECTURE.md](./02-WEBHOOK-ARCHITECTURE.md).

**Checklist:**
- [ ] File created
- [ ] Imports correct
- [ ] All handler functions implemented
- [ ] No TypeScript errors

---

### STEP 2: Update Storage Class

**File:** `maestro-server/src/storage.ts`

Add these methods to the Storage class:

```typescript
// Add to Storage class
private claudeSessionMap = new Map<string, string>();
private toolMetrics = new Map<string, Map<string, number>>();
private hookEvents: HookEvent[] = [];

mapClaudeSession(claudeSessionId: string, maestroSessionId: string): void {
  this.claudeSessionMap.set(claudeSessionId, maestroSessionId);
}

findSessionByClaudeId(claudeSessionId: string): Session | null {
  const maestroId = this.claudeSessionMap.get(claudeSessionId);
  if (!maestroId) return null;
  return this.getSession(maestroId);
}

incrementToolUsage(sessionId: string, tool: string): void {
  if (!this.toolMetrics.has(sessionId)) {
    this.toolMetrics.set(sessionId, new Map());
  }
  const sessionMetrics = this.toolMetrics.get(sessionId)!;
  const count = sessionMetrics.get(tool) || 0;
  sessionMetrics.set(tool, count + 1);
}

getToolMetrics(sessionId: string): Array<{ tool: string; uses: number }> {
  const metrics = this.toolMetrics.get(sessionId);
  if (!metrics) return [];
  return Array.from(metrics.entries()).map(([tool, uses]) => ({ tool, uses }));
}

addTaskTimelineEvent(taskId: string, event: TimelineEvent): void {
  const task = this.getTask(taskId);
  if (!task) return;
  if (!task.timeline) task.timeline = [];
  task.timeline.push({
    id: this.makeId('evt'),
    ...event,
    timestamp: Date.now()
  });
  this.tasks.set(taskId, task);
  this.emit('task:updated', task);
}
```

**Checklist:**
- [ ] Methods added
- [ ] Type definitions added
- [ ] No TypeScript errors
- [ ] Storage exports updated if needed

---

### STEP 3: Mount Webhook Router

**File:** `maestro-server/src/index.ts`

```typescript
import webhooksRouter from './api/webhooks';

// In app setup, add:
app.use('/api', webhooksRouter(storage));
```

**Checklist:**
- [ ] Import added
- [ ] Router mounted
- [ ] Server restarts successfully

**Test:**
```bash
curl -X POST http://localhost:3000/api/webhooks/hook-event \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read"}'
```

Expected: `{"success":true}`

---

### STEP 4: Update Session Spawn with Environment Variables

**File:** `maestro-server/src/api/sessions.ts`

Update the spawn endpoint to include environment variables:

```typescript
storage.emit('session:spawn_request', {
  session,
  projectId,
  taskIds,
  skillIds: skillIds || ['maestro-worker'],
  envVars: {
    MAESTRO_SESSION_ID: session.id,
    MAESTRO_TASK_IDS: taskIds.join(','),
    MAESTRO_API_URL: 'http://localhost:3000',
    MAESTRO_PROJECT_ID: projectId
  }
});
```

Add registration endpoint:

```typescript
router.post('/sessions/:id/register-claude-session', async (req, res) => {
  const { claudeSessionId } = req.body;
  if (!claudeSessionId) {
    return res.status(400).json({ error: true, message: 'claudeSessionId required' });
  }
  const session = storage.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: true, message: 'Session not found' });
  }
  storage.mapClaudeSession(claudeSessionId, session.id);
  storage.updateSession(session.id, { claudeSessionId });
  res.json({ success: true });
});
```

**Checklist:**
- [ ] envVars added to spawn event
- [ ] Registration endpoint added
- [ ] No TypeScript errors

---

### STEP 5: Create Hook Scripts Directory

```bash
cd /Users/subhang/Desktop/Projects/agents-ui
mkdir -p .claude/hooks
```

**Checklist:**
- [ ] Directory created
- [ ] In project root

---

### STEP 6: Create Hook Scripts

See [05-HOOK-SCRIPTS-REFERENCE.md](./05-HOOK-SCRIPTS-REFERENCE.md) for complete scripts.

**Quick create:**

```bash
cd .claude/hooks

# session-start.sh
cat > session-start.sh << 'EOF'
#!/bin/bash
set -euo pipefail
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
MAESTRO_SESSION_ID=${MAESTRO_SESSION_ID:-unknown}
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}

if [ "$MAESTRO_SESSION_ID" != "unknown" ]; then
  curl -X POST "${MAESTRO_API_URL}/api/sessions/${MAESTRO_SESSION_ID}/register-claude-session" \
    -H 'Content-Type: application/json' \
    -d "{\"claudeSessionId\": \"$SESSION_ID\"}" \
    --max-time 5 --silent || true
fi

curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 --silent || true

echo "Session initialized for Maestro"
EOF

# log-tool-use.sh
cat > log-tool-use.sh << 'EOF'
#!/bin/bash
set -euo pipefail
INPUT=$(cat)
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 --silent &>/dev/null &
EOF

# notify-permission.sh
cat > notify-permission.sh << 'EOF'
#!/bin/bash
set -euo pipefail
INPUT=$(cat)
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 --silent &>/dev/null &
EOF

# session-end.sh
cat > session-end.sh << 'EOF'
#!/bin/bash
set -euo pipefail
INPUT=$(cat)
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 --silent || true
EOF

# Make executable
chmod +x *.sh
```

**Checklist:**
- [ ] All 4 scripts created
- [ ] Scripts executable (`ls -la` shows `-rwxr-xr-x`)
- [ ] No syntax errors (`bash -n script.sh`)

---

### STEP 7: Configure Hooks

**File:** `.claude/settings.json`

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

**Checklist:**
- [ ] File created
- [ ] Valid JSON (`jq empty < .claude/settings.json`)
- [ ] Paths correct

---

### STEP 8: Test Hooks Manually

```bash
# Test session-start.sh
echo '{"session_id":"test-123","source":"startup"}' | .claude/hooks/session-start.sh
# Should output: "Session initialized for Maestro"

# Check server logs for webhook hit
# Should see: [Webhook] SessionStart from Claude session test-123...
```

**Checklist:**
- [ ] Scripts execute without errors
- [ ] Server receives webhook requests
- [ ] No 404 or 500 errors

---

### STEP 9: Add WebSocket Hook Handlers to UI

**File:** `src/hooks/useMaestroWebSocket.ts`

Add event types and callbacks as shown in [03-UI-INTEGRATION.md](./03-UI-INTEGRATION.md).

**Checklist:**
- [ ] Event types added
- [ ] Callbacks added
- [ ] Switch cases added
- [ ] No TypeScript errors

---

### STEP 10: Create LiveActivityFeed Component

**File:** `src/components/maestro/LiveActivityFeed.tsx`

Copy complete component from [03-UI-INTEGRATION.md](./03-UI-INTEGRATION.md).

**File:** `src/components/maestro/LiveActivityFeed.css`

Copy styles from documentation.

**Checklist:**
- [ ] Component created
- [ ] Styles created
- [ ] Imports CSS
- [ ] No TypeScript errors

---

### STEP 11: Update TaskCard with LiveActivityFeed

**File:** `src/components/maestro/TaskCard.tsx`

```typescript
import { LiveActivityFeed } from './LiveActivityFeed';

// Inside TaskCard component:
<LiveActivityFeed taskId={task.id} />
```

**Checklist:**
- [ ] Import added
- [ ] Component rendered
- [ ] UI compiles

---

### STEP 12: Add Pending Action Badge

In `TaskCard.tsx`, add hook handler:

```typescript
const [blocked, setBlocked] = useState<string | null>(null);

useMaestroWebSocket({
  onHookNotification: (data) => {
    if (data.taskIds.includes(task.id) && data.type === 'permission_prompt') {
      setBlocked(data.message);
    }
  },
  onHookToolUse: (data) => {
    if (data.taskIds.includes(task.id)) {
      setBlocked(null);
    }
  }
});

// In JSX:
{blocked && (
  <span className="badge badge-warning">⚠️ Blocked</span>
)}
```

**Checklist:**
- [ ] State added
- [ ] Hook handler added
- [ ] Badge renders conditionally
- [ ] Styles applied

---

### STEP 13: Add ErrorToast Component

**File:** `src/components/maestro/ErrorToast.tsx`

Copy complete component from [03-UI-INTEGRATION.md](./03-UI-INTEGRATION.md).

**File:** `src/App.tsx`

```typescript
import { ErrorToastContainer } from './components/maestro/ErrorToast';

// In render:
<ErrorToastContainer />
```

**Checklist:**
- [ ] Component created
- [ ] Added to App.tsx
- [ ] Toasts appear on errors

---

### STEP 14: End-to-End Testing

**Test Flow:**

1. Start Maestro server
2. Start UI
3. Create a task
4. Spawn a session for that task
5. In Claude session:
   ```
   Read the package.json file
   ```
6. Verify:
   - [ ] "Reading package.json" appears in activity feed
   - [ ] Timeline updated
   - [ ] Tool usage chart shows Read: 1

7. Run a command:
   ```
   Run `ls` to see files
   ```
8. Verify:
   - [ ] "Executed: ls" appears
   - [ ] No errors

9. Trigger permission (if not auto-approved):
   ```
   Push to git
   ```
10. Verify:
    - [ ] "⚠️ Blocked" badge appears
    - [ ] Permission message shown

11. Complete session (Ctrl+D or type `/exit`)
12. Verify:
    - [ ] "✓ Completed" badge
    - [ ] Duration shown

**Checklist:**
- [ ] All features work end-to-end
- [ ] No console errors
- [ ] UI updates in real-time
- [ ] Latency < 200ms

---

## Troubleshooting

### Hooks Not Firing

**Check:**
1. Is `.claude/settings.json` valid JSON?
   ```bash
   jq empty < .claude/settings.json
   ```
2. Are scripts executable?
   ```bash
   ls -la .claude/hooks/
   ```
3. Test hook manually:
   ```bash
   echo '{"session_id":"test"}' | .claude/hooks/session-start.sh
   ```

### Webhook Not Receiving Events

**Check:**
1. Is server running?
   ```bash
   curl http://localhost:3000/api/webhooks/hook-event
   ```
2. Check server logs for errors
3. Test webhook directly:
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/hook-event \
     -H 'Content-Type: application/json' \
     -d '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read"}'
   ```

### UI Not Updating

**Check:**
1. Is WebSocket connected? (Browser DevTools > Network > WS)
2. Are events being broadcast? (Check server logs)
3. Are handlers registered? (Add console.log in handlers)

---

## Deployment Checklist

- [ ] All server code committed
- [ ] All UI code committed
- [ ] `.claude/hooks/` scripts in repo
- [ ] `.claude/settings.json` in repo
- [ ] Documentation updated
- [ ] Tests passing
- [ ] Demo prepared

---

## Success Metrics

After implementation:
- ✅ Real-time activity feed working
- ✅ Pending action badges appear
- ✅ Timeline auto-populates
- ✅ Tool usage analytics display
- ✅ Error toasts appear
- ✅ Session status tracked
- ✅ Latency < 100ms

---

**Next:** See [IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md) for detailed progress tracking.

