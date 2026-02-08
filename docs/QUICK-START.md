# Maestro Integration Quick Start Guide

Get the complete UI → Server → CLI → Claude integration working in minutes using **server-generated manifests**.

---

## Prerequisites

- ✅ Node.js 18+ installed
- ✅ Claude Code CLI installed (`claude --version`)
- ✅ Git installed

---

## Step 1: Install and Build

```bash
# Navigate to project root
cd /Users/subhang/Desktop/Projects/agents-ui

# Build maestro-server
cd maestro-server
npm install
npm run build

# Build and link maestro-cli
cd ../maestro-cli
npm install
npm run build
npm link  # Makes 'maestro' command globally available

# Verify maestro CLI
maestro --version
which maestro
```

---

## Step 2: Start Maestro Server

```bash
# In a new terminal
cd maestro-server
npm start

# Expected output:
# 🚀 Maestro Server started
#    HTTP: http://localhost:3000
#    WebSocket: ws://localhost:3000
# ✅ Server ready
```

**Keep this terminal open.**

---

## Step 3: Create Test Project and Task

```bash
# Create project
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "workingDir": "/Users/subhang/Desktop/test-project",
    "description": "Testing Maestro"
  }'

# Save the project ID from response
PROJECT_ID="proj_..."

# Create task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'"$PROJECT_ID"'",
    "title": "Write hello world",
    "description": "Create a hello world function",
    "acceptanceCriteria": ["Function returns Hello, World!"],
    "priority": "medium"
  }'

# Save the task ID from response
TASK_ID="task_..."
```

**Create the working directory:**
```bash
mkdir -p /Users/subhang/Desktop/test-project
cd /Users/subhang/Desktop/test-project
git init
```

---

## Step 4: Test Manifest Generation

Test the `maestro manifest generate` command that the server will call:

```bash
# Generate a manifest
maestro manifest generate \
  --role worker \
  --project-id $PROJECT_ID \
  --task-ids $TASK_ID \
  --skills maestro-worker \
  --api-url http://localhost:3000 \
  --output ~/.maestro/sessions/test_session/manifest.json

# Expected output:
# ✅ Manifest generated successfully

# Verify manifest was created
cat ~/.maestro/sessions/test_session/manifest.json
```

You should see a JSON manifest with task details, session config, and working directory.

---

## Step 5: Test Worker Init with Manifest

Test `maestro worker init` with the generated manifest:

```bash
# Set minimal env vars
export MAESTRO_SESSION_ID=test_session
export MAESTRO_MANIFEST_PATH=~/.maestro/sessions/test_session/manifest.json
export MAESTRO_SERVER_URL=http://localhost:3000

# Navigate to project directory
cd /Users/subhang/Desktop/test-project

# Run worker init
maestro worker init

# Expected output:
# 🔧 Initializing Maestro Worker Session
# 📋 Loading manifest: ~/.maestro/sessions/test_session/manifest.json
# ✅ Manifest loaded
#    Task: Write hello world
#    Skills: maestro-worker
# 🚀 Spawning Claude Code session...
# [Claude starts]
```

**If Claude starts successfully, your CLI is working!** Type `exit` to close Claude.

---

## Step 6: Test Server Spawn Endpoint

Test the full server spawn flow that includes manifest generation:

```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'"$PROJECT_ID"'",
    "taskIds": ["'"$TASK_ID"'"],
    "role": "worker",
    "skills": ["maestro-worker"],
    "spawnSource": "manual",
    "sessionName": "Test spawn"
  }'

# Expected response:
# {
#   "success": true,
#   "sessionId": "sess_...",
#   "manifestPath": "~/.maestro/sessions/sess_.../manifest.json",
#   "session": { ... }
# }
```

Verify the manifest was created:
```bash
# Check manifest file exists
SESSION_ID="sess_..."  # From response above
ls -la ~/.maestro/sessions/$SESSION_ID/manifest.json

# View manifest
cat ~/.maestro/sessions/$SESSION_ID/manifest.json
```

---

## Step 7: Test with WebSocket

Connect to WebSocket to see spawn events:

```bash
# Install wscat if needed
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000

# In another terminal, trigger spawn again
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'"$PROJECT_ID"'",
    "taskIds": ["'"$TASK_ID"'"],
    "role": "worker",
    "skills": ["maestro-worker"],
    "spawnSource": "manual"
  }'

# You should see in wscat:
# {
#   "type": "session:spawn_request",
#   "data": {
#     "command": "maestro worker init",
#     "cwd": "/Users/subhang/Desktop/test-project",
#     "envVars": {
#       "MAESTRO_SESSION_ID": "sess_...",
#       "MAESTRO_MANIFEST_PATH": "~/.maestro/sessions/sess_.../manifest.json",
#       "MAESTRO_SERVER_URL": "http://localhost:3000"
#     }
#   }
# }
```

Notice the **minimal env vars** - only 3 variables! All task/project data is in the manifest.

---

## Step 8: Implement UI Integration

### Simple WebSocket Listener

Add to `maestro-ui/src/contexts/MaestroContext.tsx`:

```typescript
useEffect(() => {
  if (!ws) return;

  const handleMessage = async (event: MessageEvent) => {
    const message = JSON.parse(event.data);

    if (message.type === 'session:spawn_request') {
      const { command, cwd, envVars } = message.data;

      console.log(`🚀 Spawning: ${envVars.MAESTRO_SESSION_ID}`);

      try {
        await invoke('create_session', { command, cwd, envVars });
        console.log('✅ Terminal spawned');
      } catch (error) {
        console.error('❌ Spawn failed:', error);
      }
    }
  };

  ws.addEventListener('message', handleMessage);
  return () => ws.removeEventListener('message', handleMessage);
}, [ws]);
```

### Spawn Request Handler

Add to `maestro-ui/src/components/maestro/MaestroPanel.tsx`:

```typescript
const handleStartTask = async (task: Task) => {
  const response = await fetch('http://localhost:3000/api/sessions/spawn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: currentProject.id,
      taskIds: [task.id],
      role: 'worker',
      skills: ['maestro-worker'],
      spawnSource: 'manual',
    }),
  });

  if (!response.ok) throw new Error('Spawn failed');
  console.log('✅ Spawn requested');
};
```

**That's it!** The UI is extremely simple - just call the API and handle the WebSocket event.

---

## Step 9: Test Full Integration

1. **Start the UI:**
```bash
cd maestro-ui
npm run dev
```

2. **In the browser:**
   - Navigate to your project
   - Find your task
   - Click "Start Task"

3. **Expected flow:**
   - Console: "✅ Spawn requested"
   - Terminal opens automatically
   - Terminal: "🔧 Initializing Maestro Worker Session"
   - Terminal: "📋 Loading manifest: ~/.maestro/sessions/sess_.../manifest.json"
   - Claude starts with task context
   - Task status changes to "in_progress"

---

## Troubleshooting

### "maestro: command not found"

```bash
cd maestro-cli
npm link
which maestro
```

### "MAESTRO_MANIFEST_PATH not set"

The terminal didn't receive env vars. Ensure your Tauri `create_session` command passes `envVars` properly.

### "Manifest file not found"

Check if server successfully generated manifest:
```bash
ls -la ~/.maestro/sessions/*/manifest.json
```

If missing, manually test:
```bash
maestro manifest generate \
  --role worker \
  --project-id $PROJECT_ID \
  --task-ids $TASK_ID \
  --api-url http://localhost:3000 \
  --output ~/.maestro/sessions/test/manifest.json
```

### "Failed to fetch project/task"

Verify server is reachable:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/projects/$PROJECT_ID
curl http://localhost:3000/api/tasks/$TASK_ID
```

---

## Verification Checklist

- [ ] `maestro --version` works
- [ ] `maestro manifest generate` creates manifest file
- [ ] `maestro worker init` starts Claude with manifest
- [ ] Server spawn endpoint creates manifest and session
- [ ] WebSocket emits spawn_request with minimal env vars
- [ ] UI can spawn terminal automatically
- [ ] Terminal runs `maestro worker init` successfully
- [ ] Claude starts with full task context
- [ ] Only 3 env vars passed (SESSION_ID, MANIFEST_PATH, SERVER_URL)

---

## Key Points

✅ **Server generates manifests** by calling `maestro manifest generate`
✅ **Manifest is pre-generated** before terminal spawns
✅ **Only 3 env vars** passed to terminal
✅ **All data in manifest** (task, project, skills, working dir)
✅ **UI is simple** - just receives and spawns

---

## Summary

The manifest-driven flow:

1. UI calls `POST /api/sessions/spawn`
2. Server executes `maestro manifest generate` (CLI)
3. CLI fetches data and writes manifest file
4. Server broadcasts spawn request with manifest path
5. UI spawns terminal with 3 env vars
6. Terminal runs `maestro worker init`
7. CLI loads pre-generated manifest
8. CLI spawns Claude with full context
9. Worker executes task

**You now have a clean, manifest-driven Maestro integration!** 🎉

---

## Additional Resources

- [README.md](./README.md) - Complete integration guide
- [FINAL-ARCHITECTURE.md](./FINAL-ARCHITECTURE.md) - Architecture reference
- [Maestro Server Docs](../maestro-server/docs/)
- [Maestro CLI Docs](../maestro-cli/docs/)
