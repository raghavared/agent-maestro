# Disadvantages

## Overview

While the Worker Strategy System provides many benefits, it also introduces tradeoffs and limitations that should be understood.

---

## 1. Increased Complexity

### 1.1 More Moving Parts

**Before:**
```
Session → Tasks (simple binding)
```

**After:**
```
Session → WorkerType → DataStructure → Items → Tasks
           ↓
       WorkerConfig
           ↓
       AllowedCommands
```

**Impact:**
- More code to maintain
- More potential failure points
- Steeper learning curve

### 1.2 Multiple Status Types

**Before:**
- One task status: `todo | in_progress | done`

**After:**
- User status: `todo | in_progress | done | archived`
- Session item status: `queued | processing | completed | failed | skipped | blocked`
- Session status: `spawning | idle | working | completed | failed | stopped`

**Impact:**
- Status confusion for users
- More UI states to handle
- Status synchronization challenges

### 1.3 New Concepts to Learn

Users must understand:
- Worker types and their differences
- Data structures (queue vs stack vs DAG)
- How status flows work
- Available commands per worker type

---

## 2. Architectural Constraints

### 2.1 Immutable Worker Type

Once a session is spawned, its worker type cannot change:

```
Session created as Queue Worker
     ↓
Worker type added to system prompt
     ↓
Cannot change to Stack Worker mid-session
```

**Why:**
- System prompt is set at spawn time
- Agent has learned queue commands
- Changing would confuse the agent

**Workaround:**
- Create new session with different type
- Transfer remaining tasks

### 2.2 CLI Dependency

Agent must use CLI commands for status updates:

```
Agent MUST run: `maestro queue complete`
Agent CANNOT: Just say "I'm done with this task"
```

**Risks:**
- Agent might forget to run commands
- Agent might run wrong commands
- Network issues between agent and server

### 2.3 Sequential Processing by Default

Most worker types process one task at a time:

```
Queue: Task 1 → Task 2 → Task 3 (sequential)
Stack: Same
Priority: Same
```

**Impact:**
- Can't leverage parallel processing
- Slower for independent tasks
- DAG is the exception (but more complex)

---

## 3. Development Overhead

### 3.1 More Code to Write

Each worker type requires:
- Data structure implementation (~200-400 LOC)
- API routes (~100-200 LOC)
- CLI commands (~300-500 LOC)
- UI components (~400-600 LOC)
- Tests (~500+ LOC)

**Total per worker type: ~1500-2000 LOC**

### 3.2 Synchronization Challenges

Multiple components must stay in sync:
- Server state
- CLI state cache
- UI state
- Agent's understanding

**Example failure:**
```
1. Agent runs `maestro queue complete`
2. Server processes, emits event
3. WebSocket disconnected (network blip)
4. UI doesn't receive update
5. UI shows stale state
```

### 3.3 Testing Complexity

Must test:
- Each data structure operation
- Each CLI command
- Each API endpoint
- WebSocket events
- UI updates
- Integration flows
- Edge cases per worker type

---

## 4. Performance Considerations

### 4.1 Additional API Calls

Each task iteration requires multiple calls:

```
Before: 1 API call to get all tasks

After:
  1. maestro queue start      (API call)
  2. [agent works]
  3. maestro queue complete   (API call)
  4. [repeat for each task]
```

**Impact:**
- Higher latency per task
- More server load
- More network traffic

### 4.2 Storage Overhead

New data stored per session:
- Data structure state
- Item history
- Operation logs

**Example:**
```
Session with 100 tasks:
- 100 DataStructureItem objects
- 100+ operations logged
- ~50KB additional storage per session
```

### 4.3 WebSocket Event Volume

More events emitted:
- `ds:item_added`
- `ds:item_status_changed`
- `ds:current_item_changed`
- `ds:reordered`
- etc.

**Impact:**
- More messages to process
- Higher bandwidth usage
- Potential for event storms

---

## 5. User Experience Tradeoffs

### 5.1 More Decisions Required

When creating a session, users must now:
1. Select tasks (existing)
2. Choose worker type (new)
3. Configure worker-specific options (new)
   - Queue: Task order
   - Priority: Priorities per task
   - DAG: Dependencies

**Impact:**
- Slower session creation
- Decision fatigue
- Potential for wrong choices

### 5.2 Cognitive Load

```
"What worker type should I use?"
"Should this be priority 3 or 4?"
"Does task A depend on task B or the other way?"
"Why is my task blocked?"
```

### 5.3 UI Complexity

More UI elements to display:
- Worker type indicators
- Data structure visualizations
- Multiple status types
- Session item statuses vs task statuses

**Risk:** Cluttered, confusing interface

---

## 6. Compatibility & Migration

### 6.1 Breaking Changes

Existing sessions won't have worker types:
- Need migration strategy
- Legacy sessions need handling
- Default to queue worker?

### 6.2 Manifest Changes

Manifest format changes:
```json
// Old
{
  "sessionId": "...",
  "tasks": [...]
}

// New
{
  "sessionId": "...",
  "workerType": "queue",
  "workerConfig": {...},
  "tasks": [...]
}
```

**Impact:**
- Old manifests incompatible
- Migration needed
- Version handling

### 6.3 Agent Compatibility

Agents must understand new commands:
- New CLI commands to learn
- New workflow patterns
- Updated system prompts

---

## 7. Edge Cases & Failure Modes

### 7.1 Empty Data Structure

```
Agent: maestro queue start
System: "Queue is empty"
Agent: ???
```

Agent must handle gracefully.

### 7.2 No Current Item

```
Agent: maestro queue complete
System: "No task is currently being processed"
Agent: ???
```

### 7.3 Concurrent Modifications

```
1. User adds task via UI
2. Agent starts task via CLI
3. Race condition on currentItem
```

### 7.4 Network Partitions

```
1. Agent starts task (succeeds)
2. Network disconnects
3. Agent completes task (fails to reach server)
4. Agent thinks complete, server thinks processing
```

---

## 8. Limitations

### 8.1 Single Agent per Session

Current design assumes one agent per session:
- One worker processing tasks
- One `currentItem` at a time
- No parallel execution within session

### 8.2 No Cross-Session Dependencies

Cannot express:
- "Task in Session A must complete before Task in Session B"
- Sessions are independent

### 8.3 No Dynamic Worker Reconfiguration

Cannot:
- Change worker type mid-session
- Change DAG dependencies while processing
- Modify priority scheme on the fly

### 8.4 Fixed Data Structure Operations

Each worker type has fixed operations:
- Can't add custom operations
- Can't extend without code changes

---

## Mitigation Strategies

| Disadvantage | Mitigation |
|--------------|------------|
| Complexity | Good defaults, progressive disclosure UI |
| Immutable worker type | Clear documentation, session cloning |
| CLI dependency | Robust error handling, retries |
| More decisions | Smart defaults, presets |
| Breaking changes | Migration scripts, version handling |
| Edge cases | Comprehensive error handling, clear messages |
| Single agent | Document as limitation, future multi-agent support |

---

## When NOT to Use Worker Strategy

Consider simpler approach when:
1. Single task per session
2. No need for dynamic task injection
3. Order doesn't matter
4. No dependencies between tasks
5. Simple, one-off work

For these cases, legacy static task binding may be simpler.
