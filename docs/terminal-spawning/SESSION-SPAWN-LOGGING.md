# Session Spawn Event Logging - Complete Implementation

## Overview
Added comprehensive console logging throughout the session spawn pipeline to provide full visibility into the session spawning process. All major steps are logged with clear status indicators and detailed information.

## Files Modified

### 1. `/maestro-server/src/api/sessions.ts`

#### A. Enhanced `POST /sessions/spawn` Endpoint (Lines 267-443)

**Logging Stages:**

1. **Initial Request Reception**
   ```
   🚀 SESSION SPAWN EVENT RECEIVED - [timestamp]
   ```
   - Timestamp when spawn request is received
   - Full request payload (JSON)

2. **Parameter Parsing**
   ```
   ✅ PARSING REQUEST PARAMETERS:
      • projectId: [id]
      • taskIds: [id1, id2, ...]
      • sessionName: [name or auto-generated]
      • skills: [skill1, skill2, ...] or default
      • spawnedBy: [user] or not specified
      • spawnSource: manual|orchestrator
      • role: worker|orchestrator
      • context: [JSON] or empty
   ```

3. **Validation Phase**
   ```
   🔍 VALIDATION PHASE:
      ✓ projectId validated
      ✓ taskIds validated (N tasks)
      ✓ spawnSource validated: [source]
      ✓ role validated: [role]
   ```
   - Each validation step is checked and logged
   - Fails with clear error messages if validation fails

4. **Task Verification**
   ```
   📦 VERIFYING TASKS:
      ✓ Task found: [taskId] - "[task title]"
      ✓ Task found: [taskId] - "[task title]"
   ```

5. **Project Verification**
   ```
   🏗️  VERIFYING PROJECT:
      ✓ Project found: [projectId]
      • Name: [project name]
      • Working Directory: [path]
   ```

6. **Skills Configuration**
   ```
   🎯 SKILLS CONFIGURATION:
      • Requested skills: [skill1, skill2, ...]
      • Skills to load: [skill1, skill2, ...] or none
   ```

7. **Session Creation**
   ```
   💾 CREATING SESSION:
      ✓ Session created: [sessionId]
      • Name: [session name]
      • Status: spawning
      • Associated tasks: [taskId1, taskId2, ...]
   ```

8. **Manifest Generation**
   ```
   📝 MANIFEST GENERATION PHASE:
      • Server URL: [url]
      • Generating manifest for session: [sessionId]
      ✅ Manifest generated successfully
      • Path: [path]
      • Manifest version: [version]
      • Role: [role]
      • Session model: [model]
      • Skills in manifest: [skill1, skill2, ...]
   ```

9. **Spawn Data Preparation**
   ```
   ⚙️  PREPARING SPAWN DATA:
      • Command: maestro [role] init
      • Working directory: [path]
      • Environment variables:
        - MAESTRO_SESSION_ID=[id]
        - MAESTRO_MANIFEST_PATH=[path]
        - MAESTRO_SERVER_URL=[url]
   ```

10. **Event Emission**
    ```
    📡 EMITTING SPAWN REQUEST EVENT:
       • Event: session:spawn_request
       • Session ID: [id]
       • Role: [role]
       • Tasks: [taskId1, taskId2, ...]
       ✓ Spawn request event emitted

    📢 EMITTING SESSION CREATED EVENT:
       ✓ session:created event emitted

    🔗 EMITTING TASK-SESSION ASSOCIATION EVENTS:
       ✓ task:session_added - taskId: [id], sessionId: [sessionId]
    ```

11. **Completion Summary**
    ```
    ✅ SESSION SPAWN COMPLETED SUCCESSFULLY

    📊 SPAWN SUMMARY:
       • Session ID: [id]
       • Session Name: [name]
       • Role: [role]
       • Spawn Source: [source]
       • Tasks: N task(s) - [task ids]
       • Skills: [skills] or (none)
       • Project: [projectId] ([project name])
       • Manifest: [path]
       • Command: [command]
       • Working Dir: [directory]
       • Timestamp: [timestamp]
    ```

#### B. Enhanced `generateManifestViaCLI()` Function (Lines 11-89)

**Logging Stages:**

1. **Function Entry**
   ```
   📋 GENERATING MANIFEST VIA CLI:
      • Session ID: [id]
      • Role: [role]
      • Project ID: [projectId]
      • Task IDs: [taskIds]
      • Skills: [skills] or (none)
      • API URL: [url]
   ```

2. **Directory Creation**
   ```
   📂 CREATING SESSION DIRECTORY:
      • Path: [path]
      ✓ Directory created successfully
   ```

3. **CLI Command Construction**
   ```
   📄 MANIFEST PATH:
      • [full path]

   🔧 CLI COMMAND:
      maestro manifest generate --role [...] --project-id [...] ...

   🚀 SPAWNING MAESTRO PROCESS...
   ```

4. **Process Execution with Output**
   ```
   [STDOUT] [output from maestro CLI]
   [STDERR] [any errors from maestro CLI]
   ```

5. **Process Completion**
   ```
   ⏱️  PROCESS COMPLETED:
      • Exit code: 0
      • Duration: Xms

   ✅ MANIFEST GENERATED SUCCESSFULLY:
      • Path: [path]
      • Size: X bytes
      • Version: [version]
      • Role in manifest: [role]
      • Tasks in manifest: [taskId]
      • Skills in manifest: [skill1, skill2, ...]
   ```

### 2. `/maestro-server/src/websocket.ts`

#### Enhanced Broadcast System

1. **Broadcast Function Enhancement** (Lines 23-43)
   - Logs all spawn request broadcasts
   - Tracks timing of broadcast operation
   - Shows number of clients reached: `Sent to N/M connected client(s) in Xms`

2. **Spawn Request Event Listener** (Lines 81-125)
   ```
   📡 SESSION SPAWN REQUEST EVENT BROADCAST

   📋 EVENT DATA:
      • Event: session:spawn_request
      • Session ID: [id]
      • Session Name: [name]
      • Role: [role]
      • Project ID: [projectId]
      • Task IDs: [taskIds]
      • Command: [command]
      • Working Directory: [cwd]
      • Skills: [skills]

   🔐 ENVIRONMENT VARIABLES:
      • MAESTRO_SESSION_ID = [id]
      • MAESTRO_MANIFEST_PATH = [path]
      • MAESTRO_SERVER_URL = [url]

   📊 MANIFEST SUMMARY:
      • Version: [version]
      • Role: [role]
      • Task ID: [taskId]
      • Task Title: [title]
      • Session Model: [model]
      • Permission Mode: [mode]
      • Thinking Mode: [mode]
      • Max Turns: [number]

   📤 BROADCASTING TO N CLIENT(S)
      ✓ Sent to M/N connected client(s) in Xms

   ✅ BROADCAST COMPLETE
   ```

## Error Handling & Logging

When errors occur, comprehensive error logs are shown:

```
===========================================
❌ SESSION SPAWN ERROR
===========================================
Error: [error message]
Stack: [stack trace]
===========================================
```

For manifest generation errors:
```
❌ MANIFEST GENERATION FAILED:
   • Exit code: [code]
   • Error output:
      [full stderr output]
```

## Visual Indicators

The logging uses visual indicators for clarity:

- `🚀` - Spawn event/process start
- `✅` - Success, validation passed, step completed
- `❌` - Error or failure
- `📋` - Information/data display
- `📝` - Generation/creation process
- `📂` - File/directory operations
- `🔐` - Security/credentials
- `📊` - Summary/statistics
- `📡` - Broadcasting/communication
- `🔗` - Associations/relationships
- `⚙️` - Configuration/setup
- `🔍` - Validation
- `🏗️` - Infrastructure/project
- `🎯` - Configuration/targeting
- `💾` - Database/storage
- `📤` - Output/transmission
- `⏱️` - Timing information

## Output Format

All major operations are separated by `=` lines for clarity:

```
================================================================================
🚀 SESSION SPAWN EVENT RECEIVED - [timestamp]
================================================================================

[logging details]

================================================================================
✅ SESSION SPAWN COMPLETED SUCCESSFULLY
================================================================================
```

## Example Complete Log

When you make a spawn request, you'll see something like:

```
================================================================================
🚀 SESSION SPAWN EVENT RECEIVED - 2026-02-03T22:30:45.123Z
================================================================================

📋 REQUEST PAYLOAD:
{
  "projectId": "proj-123",
  "taskIds": ["task-456"],
  "role": "worker",
  "spawnSource": "manual",
  "skills": ["code-review"]
}

✅ PARSING REQUEST PARAMETERS:
   • projectId: proj-123
   • taskIds: [task-456]
   • sessionName: (auto-generated)
   • skills: [code-review]
   • spawnedBy: (not specified)
   • spawnSource: manual
   • role: worker
   • context: (empty)

🔍 VALIDATION PHASE:
   ✓ projectId validated: proj-123
   ✓ taskIds validated (1 tasks)
   ✓ spawnSource validated: manual
   ✓ role validated: worker

📦 VERIFYING TASKS:
   ✓ Task found: task-456 - "Implement authentication"

🏗️  VERIFYING PROJECT:
   ✓ Project found: proj-123
   • Name: My Project
   • Working Directory: /home/user/projects/my-project

🎯 SKILLS CONFIGURATION:
   • Requested skills: [code-review]
   • Skills to load: [code-review]

💾 CREATING SESSION:
   ✓ Session created: sess-123abc
   • Name: Worker for task-456
   • Status: spawning
   • Associated tasks: task-456

📝 MANIFEST GENERATION PHASE:
   • Server URL: http://localhost:3000
   • Generating manifest for session: sess-123abc

   📋 GENERATING MANIFEST VIA CLI:
      • Session ID: sess-123abc
      • Role: worker
      • Project ID: proj-123
      • Task IDs: task-456
      • Skills: code-review
      • API URL: http://localhost:3000

   📂 CREATING SESSION DIRECTORY:
      • Path: /home/user/.maestro/sessions/sess-123abc
      ✓ Directory created successfully

   📄 MANIFEST PATH:
      • /home/user/.maestro/sessions/sess-123abc/manifest.json

   🔧 CLI COMMAND:
      maestro manifest generate --role worker --project-id proj-123 ...

   🚀 SPAWNING MAESTRO PROCESS...
   [STDOUT] ✅ Manifest validation passed
   ⏱️  PROCESS COMPLETED:
      • Exit code: 0
      • Duration: 245ms

   ✅ MANIFEST GENERATED SUCCESSFULLY:
      • Path: /home/user/.maestro/sessions/sess-123abc/manifest.json
      • Size: 2048 bytes
      • Version: 1.0
      • Role in manifest: worker
      • Tasks in manifest: task-456
      • Skills in manifest: code-review

⚙️  PREPARING SPAWN DATA:
   • Command: maestro worker init
   • Working directory: /home/user/projects/my-project
   • Environment variables:
     - MAESTRO_SESSION_ID=sess-123abc
     - MAESTRO_MANIFEST_PATH=/home/user/.maestro/sessions/sess-123abc/manifest.json
     - MAESTRO_SERVER_URL=http://localhost:3000

📡 EMITTING SPAWN REQUEST EVENT:
   • Event: session:spawn_request
   • Session ID: sess-123abc
   • Role: worker
   • Tasks: task-456
   ✓ Spawn request event emitted

📢 EMITTING SESSION CREATED EVENT:
   ✓ session:created event emitted

🔗 EMITTING TASK-SESSION ASSOCIATION EVENTS:
   ✓ task:session_added - taskId: task-456, sessionId: sess-123abc

================================================================================
✅ SESSION SPAWN COMPLETED SUCCESSFULLY
================================================================================

📊 SPAWN SUMMARY:
   • Session ID: sess-123abc
   • Session Name: Worker for task-456
   • Role: worker
   • Spawn Source: manual
   • Tasks: 1 task(s) - [task-456]
   • Skills: code-review
   • Project: proj-123 (My Project)
   • Manifest: /home/user/.maestro/sessions/sess-123abc/manifest.json
   • Command: maestro worker init
   • Working Dir: /home/user/projects/my-project
   • Timestamp: 2026-02-03T22:30:45.123Z

================================================================================

📡 SESSION SPAWN REQUEST EVENT BROADCAST

📋 EVENT DATA:
   • Event: session:spawn_request
   • Session ID: sess-123abc
   • Session Name: Worker for task-456
   • Role: worker
   • Project ID: proj-123
   • Task IDs: task-456
   • Command: maestro worker init
   • Working Directory: /home/user/projects/my-project
   • Skills: code-review

🔐 ENVIRONMENT VARIABLES:
   • MAESTRO_SESSION_ID = sess-123abc
   • MAESTRO_MANIFEST_PATH = /home/user/.maestro/sessions/sess-123abc/manifest.json
   • MAESTRO_SERVER_URL = http://localhost:3000

📊 MANIFEST SUMMARY:
   • Version: 1.0
   • Role: worker
   • Task ID: task-456
   • Task Title: Implement authentication
   • Session Model: sonnet
   • Permission Mode: acceptEdits

📤 BROADCASTING TO 1 CLIENT(S)
   ✓ Sent to 1/1 connected client(s) in 2ms

✅ BROADCAST COMPLETE
================================================================================
```

## Debugging Tips

1. **Check Validation**: Look for which validation step fails (if any)
2. **Monitor Manifest Generation**: See the maestro CLI output directly
3. **Verify Environment Variables**: Confirm all environment vars are set correctly
4. **Track Broadcasting**: See how many clients received the spawn event
5. **Timing Analysis**: Check duration of manifest generation and broadcasts

## Future Enhancements

Potential logging additions:
- Hook execution logs (when worker-init runs)
- Claude process spawn logs
- Session completion logs
- Error recovery logs
- Performance profiling across the entire spawn pipeline
