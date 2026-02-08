# Potential Problems

## Overview

This document identifies potential problems, risks, and failure modes, along with suggested mitigations.

---

## 1. Agent Behavior Problems

### 1.1 Agent Forgets to Run Commands

**Problem:**
Agent completes work but forgets to run `maestro queue complete`.

```
Agent: "I've finished implementing the feature."
Agent: [Does not run maestro queue complete]
UI: Task still shows "processing"
Queue: Stuck, can't proceed to next task
```

**Mitigations:**
- Strong system prompt reinforcement
- Periodic reminders in agent context
- Timeout detection: "Task processing for >30 min without status update"
- User intervention option: Manual status override

### 1.2 Agent Runs Wrong Command

**Problem:**
Agent runs command for wrong worker type.

```
Session type: Queue Worker
Agent runs: `maestro stack push task_123`
Error: Command 'stack push' not available for Queue Worker
Agent: Confused, may retry wrong command
```

**Mitigations:**
- Clear error messages with guidance
- `who-am-i` command always available
- Command validation before execution
- Suggest correct commands in error response

### 1.3 Agent Gets Stuck in Loop

**Problem:**
Agent keeps retrying failed task.

```
Agent: maestro queue start
Agent: [work fails]
Agent: maestro queue fail --retry
Agent: maestro queue start  # Same task again
Agent: [work fails again]
... infinite loop
```

**Mitigations:**
- Maximum retry count per task
- Backoff between retries
- After N retries, fail permanently
- Alert user of repeated failures

### 1.4 Agent Hallucinates Commands

**Problem:**
Agent invents commands that don't exist.

```
Agent: maestro queue pause  # Doesn't exist
Agent: maestro queue resume # Doesn't exist
```

**Mitigations:**
- Comprehensive error handling
- Suggest similar valid commands
- Include command list in system prompt
- `maestro help` always available

---

## 2. State Synchronization Problems

### 2.1 Race Conditions

**Problem:**
User and agent modify simultaneously.

```
Time T1: User clicks "Add Task" in UI
Time T1: Agent runs `maestro queue start`
Time T2: Both hit server nearly simultaneously
Result: Unpredictable state
```

**Mitigations:**
- Optimistic locking with `updatedAt`
- Server-side transaction handling
- Conflict resolution strategies
- Queue modifications vs queue reads

### 2.2 WebSocket Disconnection

**Problem:**
UI misses events during disconnection.

```
1. WebSocket disconnects
2. Agent completes 3 tasks
3. WebSocket reconnects
4. UI shows stale state (3 tasks behind)
```

**Mitigations:**
- Reconnection with state resync
- Fetch full state on reconnect
- Event sequence numbers for gap detection
- Periodic state polling as backup

### 2.3 Stale State in CLI

**Problem:**
CLI operates on cached data that's outdated.

```
1. CLI caches session state
2. User modifies via UI
3. CLI uses stale state for next command
```

**Mitigations:**
- Always fetch fresh state before operations
- Short cache TTL or no caching
- Include state version in requests
- Reject stale requests

### 2.4 Event Ordering

**Problem:**
Events arrive out of order.

```
Sent order: item_added → item_status_changed
Received:   item_status_changed → item_added
Result: Status change for unknown item
```

**Mitigations:**
- Include sequence numbers
- Buffer and reorder
- Idempotent event handlers
- Ignore events for unknown items (will arrive later)

---

## 3. Data Structure Problems

### 3.1 Corrupted Data Structure

**Problem:**
Data structure ends in invalid state.

```
{
  "items": [],
  "currentItem": { "taskId": "task_123" }  // Item not in list!
}
```

**Mitigations:**
- Invariant validation on every write
- Repair utilities
- Backup before modifications
- Atomic operations

### 3.2 DAG Cycles

**Problem:**
User creates circular dependency.

```
Task A depends on Task B
Task B depends on Task C
Task C depends on Task A  // Cycle!
```

**Mitigations:**
- Cycle detection on add
- Reject cyclic dependencies
- Clear error message
- Suggest resolution

### 3.3 Orphaned Items

**Problem:**
Tasks deleted but items remain in data structure.

```
1. Task added to queue
2. Task deleted via task management
3. Queue still has item referencing deleted task
```

**Mitigations:**
- Cascade delete: Remove from DS when task deleted
- Validation on access: Check task exists
- Periodic cleanup job
- Mark items as "orphaned"

### 3.4 Large Data Structures

**Problem:**
Performance degrades with many items.

```
Queue with 10,000 items:
- List operation: Slow
- Visualization: Laggy
- WebSocket: Many events
```

**Mitigations:**
- Pagination for list operations
- Virtual scrolling in UI
- Batch events
- Warn users about large queues
- Consider limits

---

## 4. Recovery Problems

### 4.1 Worker Crash Recovery

**Problem:**
Worker crashes mid-task, state unclear.

```
1. Agent starts task
2. Agent crashes
3. Session status: "working"
4. Current item: "processing"
5. Actual state: Unknown
```

**Mitigations:**
- Configurable crash behavior
- `retryOnCrash` vs `failOnCrash`
- Session heartbeat monitoring
- Manual recovery option in UI
- Detailed crash logging

### 4.2 Server Restart

**Problem:**
Server restarts, in-memory state lost.

```
1. Server holding active sessions in memory
2. Server restarts
3. Active session states lost
```

**Mitigations:**
- Persistent storage for all state
- No critical in-memory-only data
- Graceful shutdown: Persist before exit
- Quick state reload on startup

### 4.3 Task Timeout

**Problem:**
Task runs forever, never completes.

```
Agent: maestro queue start
Agent: [works for hours without finishing]
Other tasks: Waiting forever
```

**Mitigations:**
- Configurable task timeout
- Timeout action: fail | skip | retry
- User notification on timeout
- Stuck task detection algorithm

### 4.4 Partial Failures

**Problem:**
Some operations succeed, others fail.

```
1. maestro queue complete: Succeeds on server
2. Task status update: Fails
3. Inconsistent state: Item complete but task not updated
```

**Mitigations:**
- Transactional operations
- Rollback on failure
- Compensation logic
- Consistency checks

---

## 5. User Experience Problems

### 5.1 Wrong Worker Type Choice

**Problem:**
User chooses inappropriate worker type.

```
User: Creates DAG worker for independent tasks
Result: Unnecessary complexity, no benefit
User: Creates queue for dependent tasks
Result: Wrong execution order, failures
```

**Mitigations:**
- Guidance UI: Suggest worker type based on tasks
- Preview of what will happen
- Easy session recreation
- Educational content

### 5.2 Confusing Status Display

**Problem:**
Multiple status types confuse users.

```
Task status: "done"
Session item status: "processing"
User: "Is it done or not??"
```

**Mitigations:**
- Clear visual distinction
- Tooltips explaining each status
- Unified view option
- Status legend

### 5.3 Lost Work

**Problem:**
User's modifications lost due to sync issues.

```
1. User reorders queue in UI
2. Agent completes task, triggers update
3. Reorder lost, reverts to server state
```

**Mitigations:**
- Optimistic UI with rollback
- Conflict notification
- Undo functionality
- Lock during modification

### 5.4 No Undo

**Problem:**
Can't undo completed/failed status.

```
Agent: maestro queue complete
User: "Wait, that wasn't actually done!"
System: No undo available
```

**Mitigations:**
- Add requeue capability
- "Undo" within time window
- Status history with rollback
- Confirmation for critical actions

---

## 6. Security Problems

### 6.1 Command Injection

**Problem:**
Malicious task data injected into commands.

```
Task title: "; rm -rf /"
Command: maestro queue start --task-title "; rm -rf /"
```

**Mitigations:**
- Sanitize all inputs
- Use structured data, not string interpolation
- Validate task IDs (alphanumeric only)
- Escape shell characters

### 6.2 Unauthorized Session Access

**Problem:**
Agent accesses wrong session's data structure.

```
Agent A: maestro queue complete --session sess_other
Result: Modifies session A doesn't own
```

**Mitigations:**
- Session ownership validation
- Agent-to-session binding
- Token-based authentication per session
- Audit logging

### 6.3 Resource Exhaustion

**Problem:**
Malicious actor creates many items.

```
for i in {1..100000}; do
  maestro queue add task_$i
done
```

**Mitigations:**
- Rate limiting
- Maximum items per session
- Resource quotas
- Abuse detection

---

## 7. Integration Problems

### 7.1 API Version Mismatch

**Problem:**
CLI version doesn't match server version.

```
CLI v1.0: Uses old API format
Server v2.0: Expects new format
Result: Mysterious failures
```

**Mitigations:**
- API versioning
- Version negotiation
- Clear error on mismatch
- Upgrade prompts

### 7.2 Manifest Incompatibility

**Problem:**
Old manifest format with new server.

```
Old manifest: No workerType field
New server: Requires workerType
```

**Mitigations:**
- Default values for missing fields
- Manifest version field
- Migration on read
- Backward compatibility layer

### 7.3 Third-Party Tool Integration

**Problem:**
External tools expect old session format.

```
External tool: Reads session.tasks directly
New format: Tasks in data structure, not session
Tool: Breaks
```

**Mitigations:**
- Maintain backward-compatible fields
- Migration period
- Documentation of changes
- API stability guarantees

---

## Risk Matrix

| Problem | Likelihood | Impact | Priority |
|---------|------------|--------|----------|
| Agent forgets commands | High | Medium | P1 |
| Race conditions | Medium | High | P1 |
| WebSocket disconnection | High | Medium | P1 |
| DAG cycles | Low | Medium | P2 |
| Worker crash recovery | Medium | High | P1 |
| Wrong worker type choice | High | Low | P2 |
| Command injection | Low | Critical | P1 |
| API version mismatch | Medium | Medium | P2 |

---

## Monitoring & Alerts

Implement monitoring for:
1. Tasks stuck in "processing" > 30 min
2. Sessions with no activity > 1 hour
3. Repeated task failures
4. WebSocket connection drops
5. API error rates
6. Data structure corruption
7. Resource usage anomalies

```typescript
// Example alert rules
const alertRules = [
  {
    name: 'stuck_task',
    condition: 'task.status == "processing" && now - task.startedAt > 30min',
    action: 'notify_user'
  },
  {
    name: 'repeated_failures',
    condition: 'task.failCount >= 3',
    action: 'notify_user, stop_retrying'
  },
  {
    name: 'orphaned_items',
    condition: 'item.taskId not in tasks',
    action: 'cleanup_item, log_warning'
  }
];
```
