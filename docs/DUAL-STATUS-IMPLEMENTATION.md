# Dual-Status Tracking System Implementation

## Overview
Implemented a dual-status tracking system where:
- **User Status** (`status`): Updated manually by users in the UI
- **Agent Status** (`agentStatus`): Updated by AI agents as they work on tasks

Both statuses are tracked separately across all systems (Server, CLI, UI).

---

## Changes Made

### 1. Server Types (`maestro-server/src/types.ts`)

**Added:**
- `AgentStatus` type definition:
  ```typescript
  export type AgentStatus = 'working' | 'blocked' | 'needs_input' | 'completed' | 'failed';
  ```

- `agentStatus` field to `Task` interface:
  ```typescript
  export interface Task {
    // ... existing fields
    status: TaskStatus;
    agentStatus?: AgentStatus;   // NEW: Agent's status while working on task
    // ... rest of fields
  }
  ```

- `agentStatus` to `UpdateTaskPayload`:
  ```typescript
  export interface UpdateTaskPayload {
    // ... existing fields
    status?: TaskStatus;
    agentStatus?: AgentStatus;  // NEW
    // ... rest of fields
  }
  ```

---

### 2. CLI Types (`maestro-cli/src/types/storage.ts`)

**Added:**
- `agentStatus` field to `StoredTask` interface:
  ```typescript
  export interface StoredTask {
    // ... existing fields
    status: string;
    agentStatus?: string;        // NEW: Agent's status while working on task
    // ... rest of fields
  }
  ```

---

### 3. CLI Commands (`maestro-cli/src/commands/task.ts`)

**Updated `task update` command:**
- Added `--agent-status` flag with description
- Supports updating both `status` and `agentStatus` independently
- Usage:
  ```bash
  maestro task update <taskId> --status completed           # Update user status
  maestro task update <taskId> --agent-status working       # Update agent status
  maestro task update <taskId> --status in_progress --agent-status working  # Update both
  ```

**Updated `task get` command:**
- Now displays `agentStatus` if present:
  ```
  ID: task-123
  Title: Implement feature X
  Status: in_progress
  Agent Status: working
  Priority: high
  ```

---

### 4. UI Components (`maestro-ui/src/components/maestro/TaskListItem.tsx`)

**Added:**
- `handleCompleteTask()` function that updates user `status` to 'completed'
- Complete Task button (green, terminal-styled)
- Delete Task button (red, terminal-styled)
- Actions bar positioned at the bottom of expanded section
- Complete button only shows when task status is not 'completed'

**Button Behavior:**
- **Complete Task**: Updates `status: 'completed'` and sets `completedAt` timestamp
- **Delete Task**: Removes the task entirely (with confirmation)

---

### 5. UI Styles (`maestro-ui/src/styles.css`)

**Added:**
- `.terminalCompleteBtn`: Green button styled to match terminal theme
- Updated `.terminalTaskActionsBar`: Positioned at bottom with border-top
- Hover effects with glow and scale animations

---

## How It Works

### User Updates (Manual)
- User clicks "Complete Task" button → Updates `status: 'completed'`
- User can manually update task status via UI controls
- CLI: `maestro task update <id> --status completed` (from terminal)

### Agent Updates (Automated)
- Agent updates `agentStatus` as it works (via API calls)
- CLI: `maestro task update <id> --agent-status working` (from agent session)
- Agent can set: `working`, `blocked`, `needs_input`, `completed`, `failed`

### Timeline Tracking
- Both updates should create timeline events (existing system)
- `updateSource` field tracks whether update came from 'user' or 'session'

---

## Status Values

### TaskStatus (User Status)
- `pending`: Not started
- `in_progress`: User marked as started
- `completed`: User marked as done
- `blocked`: User marked as blocked

### AgentStatus (Agent Status)
- `working`: Agent is actively working
- `blocked`: Agent is blocked by something
- `needs_input`: Agent needs user input
- `completed`: Agent finished its work
- `failed`: Agent encountered an error

---

## UI Display

Tasks now show:
1. **Main status badge**: User status (pending/in_progress/completed/blocked)
2. **Agent status badge**: Agent status (if present)
3. **Complete Task button**: Updates user status (hidden when already completed)
4. **Delete Task button**: Removes task entirely

---

## Next Steps

### Required Rebuilds
```bash
# Rebuild server
cd maestro-server
npm run build

# Rebuild CLI
cd maestro-cli
npm run build

# Rebuild UI
cd maestro-ui
npm run build
```

### Testing Checklist
- [ ] Create a task via UI
- [ ] Mark task as complete via UI button
- [ ] Update agent status via CLI: `maestro task update <id> --agent-status working`
- [ ] Verify both statuses display correctly
- [ ] Check timeline events are created
- [ ] Test delete task functionality
- [ ] Verify WebSocket updates work correctly

---

## API Integration

The server API now accepts both fields in update requests:
```typescript
PATCH /api/tasks/:taskId
{
  "status": "completed",        // User status
  "agentStatus": "working",     // Agent status
  "completedAt": 1234567890
}
```

Both fields are optional and can be updated independently.

---

## Architecture Notes

- **Separation of Concerns**: User and agent updates are tracked separately
- **Backward Compatible**: `agentStatus` is optional, existing code still works
- **Timeline Events**: Both status changes should create timeline entries
- **Update Source Tracking**: CLI tracks `updateSource: 'user' | 'session'`
