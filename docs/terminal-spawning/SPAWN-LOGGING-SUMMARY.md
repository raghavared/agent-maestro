# Session Spawn Event Logging - Implementation Summary

## What Was Added

Comprehensive console logging has been added to the Maestro Server to provide complete visibility into the session spawning process. All major operations, validations, and events are now logged with clear status indicators.

## Changes Made

### 1. `/maestro-server/src/api/sessions.ts` - Enhanced Spawn Endpoint

**File**: `src/api/sessions.ts`
**Lines**: Entire spawn endpoint (267-443) + generateManifestViaCLI function (11-89)

**Added Logging Stages**:
- ✅ Initial spawn request reception with timestamp
- ✅ Parameter parsing and extraction
- ✅ Validation phase (projectId, taskIds, role, spawnSource)
- ✅ Task verification (all taskIds exist)
- ✅ Project verification
- ✅ Skills configuration display
- ✅ Session creation
- ✅ Manifest generation via CLI (with subprocess output)
- ✅ Spawn data preparation
- ✅ Event emissions (spawn_request, session:created, task:session_added)
- ✅ Completion summary
- ✅ Error handling with full error context

**New in generateManifestViaCLI**:
- ✅ CLI parameter logging
- ✅ Directory creation logging
- ✅ CLI command construction display
- ✅ Process spawning notification
- ✅ Subprocess stdout/stderr capture and display
- ✅ Process completion timing
- ✅ Manifest validation and structure logging

### 2. `/maestro-server/src/websocket.ts` - Enhanced WebSocket Broadcasting

**File**: `src/websocket.ts`
**Lines**: Broadcast function (23-43) + spawn_request listener (81-125)

**Added Logging**:
- ✅ Broadcast function now logs timing and client count for spawn events
- ✅ Spawn request event listener logs:
  - Event type and session details
  - Role, project, and task information
  - Command and working directory
  - All environment variables
  - Manifest summary (version, role, model, etc.)
  - Broadcast statistics (clients reached, timing)

## Log Output Examples

### Session Spawn Request (Server-side)
```
================================================================================
🚀 SESSION SPAWN EVENT RECEIVED - 2026-02-03T22:30:45.123Z
================================================================================

📋 REQUEST PAYLOAD:
{
  "projectId": "...",
  "taskIds": ["..."],
  "role": "worker",
  "skills": ["..."]
}

✅ PARSING REQUEST PARAMETERS:
   • projectId: [id]
   • taskIds: [id1, id2]
   • sessionName: (auto-generated)
   • skills: [skill1, skill2]
   • spawnedBy: (not specified)
   • spawnSource: manual
   • role: worker
   • context: (empty)

🔍 VALIDATION PHASE:
   ✓ projectId validated: [id]
   ✓ taskIds validated (2 tasks)
   ✓ spawnSource validated: manual
   ✓ role validated: worker

[... more detailed logging ...]

📊 SPAWN SUMMARY:
   • Session ID: [id]
   • Role: worker
   • Tasks: 2 task(s)
   • Skills: [skills]
   • Command: maestro worker init
   • Timestamp: [timestamp]

================================================================================
✅ SESSION SPAWN COMPLETED SUCCESSFULLY
================================================================================
```

### Manifest Generation Subprocess
```
📝 MANIFEST GENERATION PHASE:
   • Server URL: http://localhost:3000
   • Generating manifest for session: [id]

   📋 GENERATING MANIFEST VIA CLI:
      • Session ID: [id]
      • Role: worker
      • Project ID: [projectId]
      • Task IDs: [taskId]
      • Skills: [skills]
      • API URL: [url]

   🔧 CLI COMMAND:
      maestro manifest generate --role worker --project-id [...] ...

   🚀 SPAWNING MAESTRO PROCESS...
   [STDOUT] ✅ Manifest validation passed

   ⏱️  PROCESS COMPLETED:
      • Exit code: 0
      • Duration: 245ms

   ✅ MANIFEST GENERATED SUCCESSFULLY:
      • Path: [path]
      • Size: 2048 bytes
      • Version: 1.0
      • Skills in manifest: [skills]
```

### WebSocket Broadcast
```
📡 SESSION SPAWN REQUEST EVENT BROADCAST

📋 EVENT DATA:
   • Event: session:spawn_request
   • Session ID: [id]
   • Role: worker
   • Project ID: [projectId]
   • Task IDs: [taskIds]
   • Command: maestro worker init
   • Skills: [skills]

🔐 ENVIRONMENT VARIABLES:
   • MAESTRO_SESSION_ID = [id]
   • MAESTRO_MANIFEST_PATH = [path]
   • MAESTRO_SERVER_URL = http://localhost:3000

📊 MANIFEST SUMMARY:
   • Version: 1.0
   • Role: worker
   • Session Model: sonnet
   • Permission Mode: acceptEdits

📤 BROADCASTING TO 1 CLIENT(S)
   ✓ Sent to 1/1 connected client(s) in 2ms

✅ BROADCAST COMPLETE
```

## Visual Indicators Used

| Icon | Meaning |
|------|---------|
| 🚀 | Spawn event/process start |
| ✅ | Success, validation passed, step completed |
| ❌ | Error or failure |
| 📋 | Information/data display |
| 📝 | Generation/creation process |
| 📂 | File/directory operations |
| 🔐 | Security/credentials/environment |
| 📊 | Summary/statistics |
| 📡 | Broadcasting/communication |
| 🔗 | Associations/relationships |
| ⚙️ | Configuration/setup |
| 🔍 | Validation |
| 🏗️ | Infrastructure/project |
| 🎯 | Configuration/targeting |
| 💾 | Database/storage |
| 📤 | Output/transmission |
| ⏱️ | Timing information |

## Information Captured

### Session Spawn Request
- Request timestamp
- All request parameters
- Validation results for each field
- Task existence verification
- Project details
- Skills configuration

### Manifest Generation
- Session directory creation
- CLI command construction
- Subprocess execution with full output
- Process timing and exit code
- Manifest file location and contents
- Manifest structure validation

### Event Broadcasting
- Event type and target
- Session details
- Environment variables
- Manifest configuration
- Broadcast statistics

## Error Logging

All errors are logged with full context:
```
❌ SESSION SPAWN ERROR
Error: [specific error message]
Stack: [full stack trace]
```

Specific errors logged:
- Missing required fields
- Invalid field formats
- Non-existent tasks/projects
- Manifest generation failures
- CLI execution errors
- Broadcast failures

## Benefits

1. **Debugging**: See exactly where and why spawn operations fail
2. **Monitoring**: Track session creation pipeline end-to-end
3. **Performance**: Identify slow operations (e.g., manifest generation)
4. **Transparency**: Full visibility into session spawning process
5. **Troubleshooting**: Complete information for support/debugging

## Documentation

Three comprehensive documentation files have been created:

1. **`SESSION-SPAWN-LOGGING.md`** - Complete technical documentation
   - All logging stages explained
   - Full example logs
   - Output format details
   - Future enhancement ideas

2. **`SPAWN-LOGGING-TROUBLESHOOTING.md`** - Troubleshooting guide
   - Common issues and solutions
   - Debug checklist
   - Performance monitoring tips
   - Component verification steps

3. **`SPAWN-LOGGING-SUMMARY.md`** - This file
   - Implementation summary
   - Quick reference
   - What was added and why

## Testing the Logging

Make a spawn request to see all the logs:

```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "taskIds": ["test-task"],
    "role": "worker",
    "spawnSource": "manual"
  }'
```

Server console will show:
1. Full spawn request reception logs
2. Manifest generation logs
3. Event emission logs
4. Completion summary

Watch the UI to see if spawn request is received (should see terminal/session spawn).

## Files Modified

```
maestro-server/src/api/sessions.ts    (Enhanced spawn endpoint + CLI function)
maestro-server/src/websocket.ts       (Enhanced broadcast system)
```

## Backward Compatibility

✅ All logging is non-breaking
✅ No API changes
✅ No functional changes
✅ Pure logging additions
✅ Existing tests still pass

## Next Steps

Once verified working, consider:
1. Add similar logging to other critical paths (task updates, etc.)
2. Add request ID tracing across the entire pipeline
3. Add metrics/timing collection
4. Add debug mode for more verbose output
