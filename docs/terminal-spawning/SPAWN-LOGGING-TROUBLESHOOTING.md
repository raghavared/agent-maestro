# Session Spawn Logging - Troubleshooting Guide

## Quick Reference: What Each Log Section Means

### 1. REQUEST PAYLOAD Validation
```
❌ FAILED: projectId is required
```
**Problem**: Missing required field in spawn request
**Solution**: Ensure all required fields are included in POST /sessions/spawn

### 2. PARSING REQUEST PARAMETERS
```
✅ PARSING REQUEST PARAMETERS:
   • projectId: proj-123
   • taskIds: [task-456]
```
**What to check**: Are all parameters being parsed correctly?
**If incorrect**: Verify the JSON request body format

### 3. VALIDATION PHASE
```
❌ FAILED: taskIds must be a non-empty array
```
**Problem**: taskIds is not an array or is empty
**Solution**: Send taskIds as a non-empty array: `"taskIds": ["task-123"]`

### 4. VERIFYING TASKS
```
❌ FAILED: Task task-456 not found
```
**Problem**: One of the task IDs doesn't exist in the database
**Solution**:
- Check that task-456 exists in the database
- Use `/api/tasks/task-456` to verify
- Ensure task is in the correct project

### 5. VERIFYING PROJECT
```
❌ FAILED: Project proj-123 not found
```
**Problem**: Project doesn't exist
**Solution**:
- Verify project exists: `/api/projects/proj-123`
- Check project ID is correct
- Create project if it doesn't exist

### 6. MANIFEST GENERATION PHASE
```
❌ Manifest generation failed: maestro CLI not found
```
**Problem**: The maestro CLI is not installed or not in PATH
**Solutions**:
1. Install maestro CLI: `npm install -g @maestro/cli`
2. Check PATH: `which maestro`
3. Verify installation: `maestro --version`

### 7. MANIFEST GENERATION - Process Exit Code
```
⏱️  PROCESS COMPLETED:
   • Exit code: 1
   • Duration: 245ms

❌ MANIFEST GENERATION FAILED:
   • Exit code: 1
   • Error output: [stderr]
```
**Problem**: maestro manifest generate command failed
**Solutions**:
1. Check stderr output for specific error message
2. Verify manifest-generator command exists: `maestro manifest --help`
3. Check all required parameters are passed to CLI
4. Verify MAESTRO_PROJECT_ID and MAESTRO_TASK_IDS are valid

### 8. SKILLS CONFIGURATION
```
🎯 SKILLS CONFIGURATION:
   • Requested skills: [code-review, test-writer]
   • Skills to load: [code-review, test-writer]
```
**What to check**: Are the requested skills being loaded?
**If empty**: Skills might not be installed in ~/.skills/
**If warnings**: Use `maestro skill list` to check available skills

### 9. BROADCASTING TO CLIENTS
```
📤 BROADCASTING TO 0 CLIENT(S)
   ✓ Sent to 0/0 connected client(s) in 2ms
```
**Problem**: No UI clients connected
**Solution**:
- Open the UI in browser (it should auto-connect)
- Check UI WebSocket connection: Browser DevTools > Network > WS
- Verify server is accessible from UI

```
❌ Failed to send to client: [error]
```
**Problem**: Client disconnect during broadcast
**Solution**: Reconnect the UI client to receive new spawn events

## Common Issues and Solutions

### Issue: "Manifest generation failed (exit code 1)"
**Debugging Steps**:
1. Check full stderr output in logs
2. Manually run: `maestro manifest generate --role worker --project-id proj-123 --task-ids task-456`
3. Verify task-456 exists in project proj-123
4. Check manifest-generator command: `maestro manifest --help`

### Issue: "Task not found" Error
**Debugging Steps**:
1. Verify task ID is correct: GET `/api/tasks/task-456`
2. Check task is in correct project
3. Create task if needed: POST `/api/tasks`

### Issue: "No clients connected" During Broadcast
**Debugging Steps**:
1. Open UI: http://localhost:3000
2. Wait 2-3 seconds for WebSocket connection
3. Check browser console for connection errors
4. Verify server URL is correct (check SESSION_SPAWN request)

### Issue: Session Created But Not Spawning
**Debugging Steps**:
1. Look for "📡 EMITTING SPAWN REQUEST EVENT" log
2. Check if any client is listening to session:spawn_request
3. Verify environment variables are correct:
   - MAESTRO_SESSION_ID
   - MAESTRO_MANIFEST_PATH
   - MAESTRO_SERVER_URL

### Issue: Manifest Path Wrong or Not Found
**Debugging Steps**:
1. Check manifest path in logs: `/home/user/.maestro/sessions/[sessionId]/manifest.json`
2. Verify directory was created: Check logs for "✓ Directory created successfully"
3. Manually verify file exists: `ls -la /home/user/.maestro/sessions/[sessionId]/`
4. Check permissions: `ls -la /home/user/.maestro/`

## Log Sections Checklist

✅ **Everything Passed?**
- [ ] REQUEST PAYLOAD visible
- [ ] PARSING REQUEST PARAMETERS - all fields present
- [ ] VALIDATION PHASE - all checks passed
- [ ] VERIFYING TASKS - all tasks found
- [ ] VERIFYING PROJECT - project found
- [ ] CREATING SESSION - session ID shows
- [ ] MANIFEST GENERATION - exit code 0
- [ ] PREPARING SPAWN DATA - environment variables correct
- [ ] EMITTING SPAWN REQUEST EVENT - event emitted
- [ ] BROADCASTING TO CLIENTS - clients count > 0
- [ ] SESSION SPAWN COMPLETED SUCCESSFULLY

❌ **Something Failed?**
1. Find the first ❌ or error message
2. Look at what was logged before it (check parameters)
3. Verify the relevant database objects exist
4. Check external command outputs (maestro CLI)

## Performance Monitoring

**Slow manifest generation?**
```
⏱️  PROCESS COMPLETED:
   • Exit code: 0
   • Duration: 5000ms  <-- This seems slow
```
- Check maestro CLI performance: `time maestro manifest generate ...`
- Verify network connectivity (if fetching task data from server)
- Check system resources: CPU, memory, disk I/O

**Slow broadcast?**
```
✓ Sent to 50/50 connected client(s) in 1500ms  <-- Many clients = slower
```
- This is expected with many connected clients
- Consider implementing message queuing for very large client counts

## Debug Mode

Enable detailed logging (environment variable):
```bash
DEBUG=1 npm start
```

This will show additional logs:
- Each WebSocket message broadcast
- Detailed event listener activities
- Other verbose operations

## Quick Test

Make a test spawn request:
```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-proj",
    "taskIds": ["test-task"],
    "role": "worker",
    "spawnSource": "manual"
  }'
```

Then check the server logs for the complete spawn logging output.

## Checking Specific Components

### 1. Verify maestro CLI is working
```bash
maestro --version
maestro manifest --help
maestro skill list
```

### 2. Verify tasks exist
```bash
curl http://localhost:3000/api/tasks/[taskId]
```

### 3. Verify project exists
```bash
curl http://localhost:3000/api/projects/[projectId]
```

### 4. Check manifest file was created
```bash
cat ~/.maestro/sessions/[sessionId]/manifest.json | jq .
```

### 5. Monitor WebSocket connections
- Open UI: http://localhost:3000
- DevTools > Network > WS tab
- Should see connection to /ws
- Should see spawn_request message after spawning

## Reading the Visual Indicators

- 🚀 = Important start point (session spawn event received)
- ✅ = Success, validation passed
- ❌ = Error/failure
- 📋 = Data/information display
- 📝 = Generation/creation
- 📡 = Broadcasting
- ⏱️ = Timing/performance

Use these indicators to quickly scan logs for issues.
