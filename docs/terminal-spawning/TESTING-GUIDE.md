# Maestro Integration Testing Guide

**Quick Start Guide for Testing the Server-Generated Manifests Implementation**

---

## Prerequisites

1. **Build all packages:**
```bash
# From project root
npm run build
```

2. **Start the server:**
```bash
cd maestro-server
npm run dev
```

3. **Verify CLI is available:**
```bash
# Should show manifest commands
maestro manifest --help
```

---

## Test 1: CLI Manifest Generation (5 minutes)

### Step 1: Create Test Data

Create a test project:
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "workingDir": "/tmp/test-project",
    "description": "Testing manifest generation"
  }'
```

Save the project ID from the response: `proj_...`

Create a test task:
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_...",
    "title": "Test Task",
    "description": "Testing manifest generation for this task",
    "initialPrompt": "Implement a test feature",
    "priority": "high"
  }'
```

Save the task ID from the response: `task_...`

### Step 2: Generate Manifest

Replace `<project-id>` and `<task-id>` with your actual IDs:

```bash
maestro manifest generate \
  --role worker \
  --project-id <project-id> \
  --task-ids <task-id> \
  --skills maestro-worker \
  --api-url http://localhost:3000 \
  --output /tmp/test-manifest.json
```

### Step 3: Verify Manifest

```bash
cat /tmp/test-manifest.json | jq .
```

**Expected Output:**
```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "task": {
    "id": "task_...",
    "title": "Test Task",
    "description": "Testing manifest generation for this task",
    "acceptanceCriteria": [],
    "projectId": "proj_...",
    "createdAt": "..."
  },
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits",
    "thinkingMode": "auto",
    "workingDirectory": "/tmp/test-project"
  },
  "skills": ["maestro-worker"]
}
```

**✅ Success Criteria:**
- Command exits with code 0
- Manifest file created
- All fields present and valid
- Working directory matches project

---

## Test 2: Worker Init with Manifest (2 minutes)

### Step 1: Set Environment Variables

```bash
export MAESTRO_SESSION_ID="test-session-123"
export MAESTRO_MANIFEST_PATH="/tmp/test-manifest.json"
export MAESTRO_SERVER_URL="http://localhost:3000"
```

### Step 2: Initialize Worker

```bash
maestro worker init
```

**Expected Output:**
```
🔧 Initializing Maestro Worker Session

📋 Reading manifest...
   Manifest: /tmp/test-manifest.json
   Task: Test Task (task_...)
   Project: proj_...
   Skills: maestro-worker

   Session ID: test-session-123

🚀 Spawning Claude Code session...

✅ Worker session started successfully!
```

**✅ Success Criteria:**
- Claude Code starts without errors
- Task context visible in session
- No manifest-related errors
- Session runs interactively

### Step 3: Verify Context

In the Claude session, ask:
```
What task am I working on?
```

**Expected Response:**
Should mention "Test Task" and the description.

### Step 4: Exit and Verify Cleanup

Exit Claude (Ctrl+D), then:
```bash
ls /tmp/test-manifest.json
```

**Expected:** File should be deleted (manifest cleanup).

---

## Test 3: End-to-End Server Spawn (10 minutes)

### Step 1: Start Server (if not running)

```bash
cd maestro-server
npm run dev
```

### Step 2: Test Spawn API Directly

```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<your-project-id>",
    "taskIds": ["<your-task-id>"],
    "role": "worker",
    "spawnSource": "manual",
    "sessionName": "API Test Session",
    "skills": ["maestro-worker"]
  }'
```

### Step 3: Check Server Console

**Expected Output:**
```
📝 Generating manifest via CLI...
   Command: maestro manifest generate --role worker ...
✅ Manifest generated successfully
   Path: /Users/.../.maestro/sessions/sess_.../manifest.json
📤 Spawn request broadcasted for session sess_...
   Role: worker
   Command: maestro worker init
   Working Directory: /tmp/test-project
   Manifest: /Users/.../.maestro/sessions/sess_.../manifest.json
   Skills: maestro-worker
   Tasks: task_...
```

### Step 4: Verify Manifest File

```bash
# Get session ID from server response
ls ~/.maestro/sessions/

# Check manifest exists
cat ~/.maestro/sessions/sess_.../manifest.json | jq .
```

**✅ Success Criteria:**
- Spawn endpoint returns 201 status
- Manifest file created in correct location
- Server logs show CLI execution
- WebSocket event emitted (check server logs)

---

## Test 4: Environment Variables Verification (Critical)

### Step 1: Create Test Script

```bash
cat > /tmp/check-env.sh << 'EOF'
#!/bin/bash
echo "=== Maestro Environment Variables ==="
env | grep MAESTRO | sort
echo ""
echo "=== Count: $(env | grep MAESTRO | wc -l) variables ==="
EOF

chmod +x /tmp/check-env.sh
```

### Step 2: Test with Spawn

Spawn a session and run:
```bash
/tmp/check-env.sh
```

**Expected Output:**
```
=== Maestro Environment Variables ===
MAESTRO_MANIFEST_PATH=/Users/.../.maestro/sessions/sess_.../manifest.json
MAESTRO_SERVER_URL=http://localhost:3000
MAESTRO_SESSION_ID=sess_...

=== Count: 3 variables ===
```

**✅ Success Criteria:**
- Exactly 3 MAESTRO_* variables
- No MAESTRO_TASK_IDS
- No MAESTRO_PROJECT_ID
- No MAESTRO_TASK_DATA

**❌ Failure Signs:**
- More than 3 MAESTRO_* variables
- Old variables still present
- Missing manifest path

---

## Test 5: Full UI Integration (15 minutes)

### Prerequisites
- Server running: `cd maestro-server && npm run dev`
- UI running: `cd maestro-ui && npm run dev`

### Step 1: Create Project in UI
1. Open UI in browser
2. Navigate to Projects
3. Create new project with:
   - Name: "UI Test Project"
   - Working Dir: "/tmp/ui-test"

### Step 2: Create Task
1. Click "New Task"
2. Fill in:
   - Title: "UI Test Task"
   - Description: "Testing end-to-end spawn flow"
   - Priority: High
3. Save task

### Step 3: Spawn Session
1. Find task in task list
2. Click "Start Task" or spawn button
3. Observe terminal spawn

### Step 4: Verify in Terminal

**Check Environment:**
```bash
env | grep MAESTRO
```

**Expected:** Only 3 variables

**Check Working Directory:**
```bash
pwd
```

**Expected:** `/tmp/ui-test`

**Check Claude Context:**
Ask Claude: "What task am I working on?"

**Expected:** Should describe "UI Test Task"

**✅ Success Criteria:**
- Terminal spawns automatically
- Only 3 env vars present
- Correct working directory
- Claude has full task context
- Manifest file exists

---

## Common Issues and Solutions

### Issue: "maestro: command not found"

**Solution:**
```bash
cd maestro-cli
npm run build
npm link
```

### Issue: "Failed to fetch task"

**Solution:**
- Verify server is running: `curl http://localhost:3000/api/tasks`
- Check task ID is correct
- Ensure API URL is correct

### Issue: "Manifest validation failed"

**Solution:**
- Check manifest schema in `maestro-cli/src/schemas/manifest-schema.ts`
- Verify all required fields present
- Check field types match schema

### Issue: "Cannot read manifest file"

**Solution:**
- Check `MAESTRO_MANIFEST_PATH` is set
- Verify file exists at path
- Check file permissions

### Issue: Terminal spawns but Claude doesn't start

**Solution:**
- Check server logs for errors
- Verify manifest path is correct
- Run `maestro worker init` manually to see errors

### Issue: More than 3 environment variables

**Solution:**
- This indicates old code is still running
- Rebuild all packages: `npm run build`
- Restart server
- Clear terminal and try again

---

## Troubleshooting Commands

### Check Server Status
```bash
curl http://localhost:3000/api/projects
```

### Check CLI Installation
```bash
which maestro
maestro --version
```

### View Server Logs
```bash
# Server should show manifest generation logs
cd maestro-server
npm run dev
```

### Check Manifest Directory
```bash
ls -la ~/.maestro/sessions/
```

### Clean Up Test Data
```bash
# Remove test manifests
rm -rf ~/.maestro/sessions/test-*
rm /tmp/test-manifest.json

# Remove test directories
rm -rf /tmp/test-project
rm -rf /tmp/ui-test
```

---

## Success Checklist

After completing all tests, verify:

- [ ] Test 1: CLI manifest generation works
- [ ] Test 2: Worker init reads manifest correctly
- [ ] Test 3: Server spawn endpoint works
- [ ] Test 4: Only 3 environment variables
- [ ] Test 5: Full UI integration works
- [ ] Manifest cleanup on session exit
- [ ] No errors in server logs
- [ ] Task context visible in Claude
- [ ] Working directory correct

---

## Performance Benchmarks

Record these times during testing:

- **Manifest Generation:** _____ ms (should be < 500ms)
- **Worker Init:** _____ ms (should be < 2s)
- **Server Spawn API:** _____ ms (should be < 1s)
- **UI to Terminal:** _____ ms (should be < 3s)

---

## Next Steps After Testing

1. **If all tests pass:**
   - Update `maestro-integration/STATUS.md` with results
   - Mark implementation as production-ready
   - Create release notes

2. **If tests fail:**
   - Document specific failures
   - Check error logs
   - Refer to Common Issues section
   - File bug reports with details

3. **Optional enhancements:**
   - Add integration tests
   - Set up CI/CD pipeline
   - Add performance monitoring
   - Implement caching

---

## Support

If you encounter issues not covered in this guide:

1. Check server logs for detailed errors
2. Review `IMPLEMENTATION-COMPLETE.md` for architecture details
3. Examine `maestro-integration/README.md` for full documentation
4. Check individual component READMEs

**Happy Testing! 🚀**
