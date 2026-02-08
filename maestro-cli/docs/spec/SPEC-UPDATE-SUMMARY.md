# Spec Update Summary - February 2026

## Overview

This document summarizes the updates made to the Maestro CLI specification to match the actual implementation.

**Update Date**: 2026-02-06
**Status**: ✅ Complete
**Changed Files**: 3 modified, 1 new

---

## Changes Made

### 1. ✅ Updated Status Model (01-MANIFEST-SCHEMA.md)

**Changed From**: Dual Status Model (agentStatus + status + archived)
**Changed To**: Unified Status Model (status + sessionStatus)

#### What Changed

**Removed**:
- `agentStatus` field and types (`AgentStatus` enum)
- `agentStatusUpdatedAt`, `agentStatusReason` fields
- `archived`, `archivedAt`, `archivedBy` fields
- Complex dual-status workflow with human approval
- Terminal states (`done`, `cancelled`, `wont_do`)

**Added**:
- Simplified `TaskStatus` enum: `todo | in_progress | completed | cancelled | blocked`
- `UpdateSource` type: `user | session`
- Concept of session-specific status (tracked separately, not in manifest)
- Clearer separation: task status (persistent) vs session status (ephemeral)

#### Why

The implementation uses a simpler unified status model where:
- Task status is the single source of truth
- Session status is tracked separately for real-time agent activity
- Both agents and users can update task status
- No separate archival system

#### Impact

- **Breaking**: Old manifests with `agentStatus` fields will need migration
- **Simplified**: Easier to understand and implement
- **Flexible**: Both agents and users control task status

---

### 2. ✅ Added Strategy Field (01-MANIFEST-SCHEMA.md)

**Added To**: `MaestroManifest` interface

```typescript
// Worker strategy (for worker role only)
strategy?: 'simple' | 'queue';
```

#### What It Does

- **Simple Strategy** (default): Traditional single/multi-task execution
- **Queue Strategy**: FIFO queue-based task processing with special commands

#### New Features

**Queue Strategy Enables**:
- `maestro queue top` - Show next task
- `maestro queue start` - Start processing
- `maestro queue complete` - Complete task
- `maestro queue fail` - Fail task
- `maestro queue skip` - Skip task
- `maestro queue list` - List queue items

**Manifest Example**:
```json
{
  "role": "worker",
  "strategy": "queue",
  "tasks": []  // Empty - tasks pulled from queue
}
```

#### Why

The implementation supports queue-based workflows for batch processing and sequential task execution.

---

### 3. ✅ Added Command Permissions System (NEW FILE)

**Created**: `12-COMMAND-PERMISSIONS.md`

#### What It Does

Controls which CLI commands are available based on:
- **Role**: `worker` or `orchestrator`
- **Strategy**: `simple` or `queue`
- **Explicit Override**: Optional `session.allowedCommands` array

#### Default Permissions

**Worker (Simple)**:
- Context: `whoami`, `commands`
- Task: `task:get`, `task:list`
- Updates: `update:progress`, `update:blocked`, etc.

**Worker (Queue)**:
- Context: `whoami`, `commands`
- Queue: `queue:top`, `queue:start`, `queue:complete`, etc.
- Updates: `update:progress`, `update:blocked`, etc.

**Orchestrator**:
- All worker commands PLUS:
- Task: `task:create`, `task:update`
- Session: `session:spawn`, `session:stop`

#### New Commands

- `maestro commands` - List available commands
- `maestro commands --check <command>` - Check if command is allowed
- `maestro commands --json` - JSON output

#### Why

Needed to document the sophisticated permission system that prevents agents from executing inappropriate commands based on their role and workflow.

---

### 4. ✅ Added Queue Commands Documentation (07-CLI-COMMANDS-REFERENCE.md)

**Added**: Complete "Queue Commands" section with 6 new commands

#### Commands Added

1. `maestro queue top` - Preview next task
2. `maestro queue start` - Begin processing
3. `maestro queue complete` - Mark complete
4. `maestro queue fail` - Mark failed
5. `maestro queue skip` - Skip and return to queue
6. `maestro queue list` - List all queue items

Each includes:
- Purpose and description
- Arguments and options
- Usage examples
- API endpoints
- Response formats
- Complete workflow example

---

### 5. ✅ Updated Manifest Examples (01-MANIFEST-SCHEMA.md)

**Added**: Queue Strategy Worker Manifest example

```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "strategy": "queue",
  "tasks": [],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits",
    "allowedCommands": [
      "whoami", "queue:start", "queue:complete", ...
    ]
  }
}
```

**Updated**: All existing examples to use `tasks` array consistently

---

### 6. ✅ Added allowedCommands to SessionConfig (01-MANIFEST-SCHEMA.md)

**Added To**: `SessionConfig` interface

```typescript
// Explicit list of allowed commands for this session
// If not specified, defaults are determined by role and strategy
allowedCommands?: string[];
```

#### Why

Allows fine-grained control over which commands agents can execute.

---

### 7. ✅ Added templateId Field (01-MANIFEST-SCHEMA.md)

**Added To**: `MaestroManifest` interface

```typescript
// Optional: Template ID for server-side prompt generation
templateId?: string;
```

#### Why

Implementation includes template system for dynamic prompt generation.

---

### 8. ✅ Updated Validation Rules (01-MANIFEST-SCHEMA.md)

**Changed**:
- Fixed `task` → `tasks` (array) throughout
- Added exception for queue strategy (empty tasks array allowed)
- Updated validation examples

**Before**:
```json
{
  "task": { ... }  // Single task object
}
```

**After**:
```json
{
  "tasks": [ ... ]  // Always an array
}
```

---

## Files Modified

### Modified

1. **01-MANIFEST-SCHEMA.md** - Major updates
   - Updated status model (removed dual status)
   - Added strategy field
   - Added allowedCommands
   - Added templateId
   - Updated examples
   - Fixed validation rules

2. **07-CLI-COMMANDS-REFERENCE.md** - Added queue section
   - Added complete queue commands documentation
   - Added workflow examples

3. **00-README.md** - Updated index
   - Added reference to new file

### Created

4. **12-COMMAND-PERMISSIONS.md** - New file
   - Complete command permissions documentation
   - Default permission sets
   - Usage examples
   - Implementation details

---

## Migration Guide

### For Old Manifests

If you have manifests using the old schema:

#### 1. Update Status Fields

```json
// Old
{
  "task": {
    "agentStatus": "completed",
    "status": "review",
    "archived": false
  }
}

// New
{
  "tasks": [{
    "status": "completed"
  }]
}
```

#### 2. Convert task → tasks

```json
// Old
{ "task": { ... } }

// New
{ "tasks": [ { ... } ] }
```

#### 3. Remove Archival Fields

```json
// Old
{
  "archived": true,
  "archivedAt": "...",
  "archivedBy": "..."
}

// New
// (Archival handled by server, not in manifest)
```

---

## Testing Checklist

- [x] Validate all example manifests
- [x] Test queue strategy workflow
- [x] Test command permissions system
- [x] Verify status updates work correctly
- [x] Test with both simple and queue strategies
- [x] Verify backward compatibility where possible

---

## Breaking Changes

⚠️ **Breaking Changes**:

1. **Status Model**: Old manifests with `agentStatus` fields will not validate
2. **Task Field**: Manifests with `task` (singular) must be updated to `tasks` (array)
3. **Archival**: `archived` field removed from manifest

**Migration Required**: Yes, for old manifests

---

## Benefits of Updates

✅ **Accuracy**: Spec now matches actual implementation
✅ **Completeness**: All features documented (strategy, queue, permissions)
✅ **Clarity**: Simpler status model, easier to understand
✅ **Discoverability**: Command permissions system documented
✅ **Examples**: Queue strategy examples added

---

## Related Documentation

- [01-MANIFEST-SCHEMA.md](./01-MANIFEST-SCHEMA.md) - Manifest schema (updated)
- [07-CLI-COMMANDS-REFERENCE.md](./07-CLI-COMMANDS-REFERENCE.md) - CLI commands (updated)
- [12-COMMAND-PERMISSIONS.md](./12-COMMAND-PERMISSIONS.md) - Command permissions (new)
- [00-README.md](./00-README.md) - Documentation index (updated)

---

---

## Report Command Migration (2026-02-06)

### Overview

Replaced all `update:*` commands with a new `maestro report <subcommand>` command group. This fixes critical bugs in the old update system and enforces the two-status ownership model.

### What Changed

**Removed**:
- `maestro update <message>` command
- `maestro update:progress`, `update:complete`, `update:blocked`, `update:needs-input`, `update:error` commands
- All `update:*` entries from command registry and default permissions
- References to `update:*` commands throughout all spec files

**Added**:
- `maestro report progress <message>` - Reports `sessionStatus: working`
- `maestro report complete <summary>` - Reports `sessionStatus: completed`
- `maestro report blocked <reason>` - Reports `sessionStatus: blocked`
- `maestro report error <description>` - Reports `sessionStatus: failed`
- `maestro report needs-input <question>` - Reports `sessionStatus: needs_input`

**Key Behavior Changes**:
1. Report commands update `sessionStatus` (not `status`) - workers cannot change task lifecycle status
2. Timeline events are posted to `POST /api/sessions/{id}/timeline` (not `/api/tasks/{id}/timeline`)
3. All report commands call `guardCommand()` for permission validation
4. Legacy `update:*` commands remain as thin deprecation wrappers that delegate to `report` logic

### Two-Status Ownership Model

| Field | Owner | Modified By |
|-------|-------|-------------|
| `task.status` | User / Orchestrator | `maestro task update`, `maestro task complete`, `maestro task block` (orchestrator only) |
| `task.sessionStatus` | Worker session | `maestro report progress/complete/blocked/error/needs-input` |

Workers are restricted from using `task:update`, `task:complete`, and `task:block`.

### Files Modified

| File | Changes |
|------|---------|
| `00-README.md` | Updated command references |
| `01-MANIFEST-SCHEMA.md` | Rewrote "Unified Status Model" → "Two-Status Model" with ownership rules; updated queue manifest example |
| `02-CLI-ARCHITECTURE.md` | Replaced update references, updated API endpoints and session lifecycle |
| `03-SYSTEM-PROMPTS.md` | Replaced with redirect to actual template files |
| `07-CLI-COMMANDS-REFERENCE.md` | Replaced `maestro update` section with `maestro report` section; updated queue workflow |
| `08-SESSION-INITIALIZATION.md` | Replaced update:* with report commands in agent commands section |
| `09-ARCHITECTURE-DIAGRAMS.md` | Updated command lists and API endpoints |
| `10-FUTURE-ENHANCEMENTS.md` | Updated update reference |
| `12-COMMAND-PERMISSIONS.md` | Full rewrite with report commands, worker restrictions, guard system |
| `SPEC-UPDATE-SUMMARY.md` | Added this section |

---

**Last Updated**: 2026-02-06
**Reviewed By**: Implementation analysis
**Status**: ✅ Ready for use
