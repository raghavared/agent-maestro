# Maestro Server Spec Update Summary

**Date:** 2026-02-07
**Version:** 1.0.0 → 1.1.0

---

## Overview

The Maestro Server specifications have been updated to match the current codebase implementation. This update includes type corrections, new API endpoints, and two new specification documents.

---

## Major Changes

### 1. Type Updates

#### TaskStatus Enum
- **Before:** `'pending' | 'in_progress' | 'completed' | 'blocked'`
- **After:** `'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked'`
- **Changes:**
  - Renamed 'pending' → 'todo'
  - Added 'cancelled' status

#### SessionStatus Enum
- **Before:** `'spawning' | 'running' | 'completed' | 'failed'`
- **After:** `'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped'`
- **Changes:**
  - Removed 'running'
  - Added 'idle', 'working', 'stopped'

#### New Types Added
- `WorkerStrategy` = `'simple' | 'queue' | 'tree'`
- `TaskSessionStatus` = `'queued' | 'working' | 'needs_input' | 'blocked' | 'completed' | 'failed' | 'skipped'`
- `SessionTimelineEventType` - 12 event types for session timeline
- `SessionTimelineEvent` - Session activity timeline events
- `QueueItem` - Individual queue item
- `QueueState` - Complete queue state
- `Template` - Template entity
- `TemplateRole` = `'worker' | 'orchestrator'`

---

### 2. Entity Changes

#### Task Entity
**Added:**
- `sessionStatus?: TaskSessionStatus` - Session's status while working on task

**Removed:**
- `timeline: TimelineEvent[]` - Moved to Session entity

#### Session Entity
**Added:**
- `strategy: WorkerStrategy` - Worker strategy ('simple' | 'queue' | 'tree')
- `timeline: SessionTimelineEvent[]` - Session's activity timeline

---

### 3. API Endpoint Changes

#### Tasks API
**Removed:**
- `POST /api/tasks/:id/timeline` - Add timeline event (timeline moved to sessions)

**Updated:**
- Update Task request schema now includes `sessionStatus` and `updateSource` fields

---

#### Queue API (NEW)
8 new endpoints for managing session task queues:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/sessions/:id/queue` | Get queue state and stats |
| `GET /api/sessions/:id/queue/top` | Peek next queued item |
| `POST /api/sessions/:id/queue/start` | Start processing next item |
| `POST /api/sessions/:id/queue/complete` | Complete current item |
| `POST /api/sessions/:id/queue/fail` | Fail current item with reason |
| `POST /api/sessions/:id/queue/skip` | Skip current/next item |
| `GET /api/sessions/:id/queue/items` | List all queue items |
| `POST /api/sessions/:id/queue/push` | Add task to queue |

---

#### Templates API (NEW)
8 new endpoints for managing prompt templates:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/templates` | List all templates |
| `GET /api/templates/:id` | Get template by ID |
| `GET /api/templates/role/:role` | Get template by role |
| `POST /api/templates` | Create new template |
| `PUT /api/templates/:id` | Update template |
| `POST /api/templates/:id/reset` | Reset to default |
| `DELETE /api/templates/:id` | Delete template |
| `GET /api/templates/default/:role` | Get default content |

---

### 4. New Specification Documents

#### 12-QUEUE-SPECIFICATION.md
**Covers:**
- Queue system overview
- QueueState and QueueItem entities
- Queue lifecycle and operations
- Worker strategies comparison
- Queue-specific API endpoints
- Storage format
- Events
- Integration with sessions
- Use cases and examples

**Key Sections:**
- Worker Strategies table (simple, queue, tree)
- Queue state diagram
- Operation preconditions and effects
- Queue statistics
- Error handling
- Batch processing examples

---

#### 13-TEMPLATE-SPECIFICATION.md
**Covers:**
- Template system overview
- Template entity structure
- Worker vs Orchestrator templates
- Default template loading
- Template lifecycle
- API operations
- Integration with session spawning
- Template best practices

**Key Sections:**
- Template roles (worker/orchestrator)
- Default template sources
- Template customization workflow
- Manifest generation integration
- Template content structure guidelines

---

### 5. Documentation Updates

#### 00-INDEX.md
**Added:**
- Reference to 12-QUEUE-SPECIFICATION.md
- Reference to 13-TEMPLATE-SPECIFICATION.md
- Updated JSON schema list
- Updated reading paths
- Added change history for v1.1.0

#### 02-CORE-CONCEPTS.md
**Updated:**
- All type definitions
- Task entity definition (removed timeline, added sessionStatus)
- Session entity definition (added strategy, timeline)
- Field detail tables
- Example JSON objects
- Lifecycle diagrams
- Status transition tables
- API request/response type definitions

#### 03-API-SPECIFICATION.md
**Updated:**
- Endpoint catalog with Queue and Template sections
- Removed Add Timeline Event section
- Updated all task/session response examples
- Changed all 'pending' → 'todo' in examples
- Added strategy field to session creation
- Updated session status examples
- Added comprehensive Queue API documentation
- Added comprehensive Template API documentation

---

## File Changes Summary

### Modified Files
1. `spec/00-INDEX.md` - Added new specs, updated version
2. `spec/02-CORE-CONCEPTS.md` - Updated types and entities
3. `spec/03-API-SPECIFICATION.md` - Added Queue/Template APIs, updated types

### New Files
1. `spec/12-QUEUE-SPECIFICATION.md` - Complete queue system spec
2. `spec/13-TEMPLATE-SPECIFICATION.md` - Complete template system spec

---

## Breaking Changes

### For API Consumers

1. **TaskStatus values changed:**
   - Code expecting 'pending' must use 'todo'
   - New 'cancelled' status may appear

2. **SessionStatus values changed:**
   - 'running' no longer exists, use 'idle' or 'working'
   - New 'stopped' status may appear

3. **Task.timeline removed:**
   - Endpoint `POST /api/tasks/:id/timeline` no longer exists
   - Timeline data moved to Session.timeline

4. **New required Session fields:**
   - `strategy` field now required (defaults to 'simple')
   - `timeline` field now included in responses

### For Database/Storage

1. **Task JSON format:**
   - `timeline` array removed
   - `sessionStatus` field added (optional)

2. **Session JSON format:**
   - `strategy` field added (required)
   - `timeline` array added (required)

3. **New storage files:**
   - Queue files: `~/.maestro/data/queues/{sessionId}.json`
   - Template files: `~/.maestro/data/templates/{id}.json`

---

## Migration Notes

### Existing Tasks
- Tasks with `timeline` field: Data will be ignored by current implementation
- Status 'pending' → Should be migrated to 'todo'

### Existing Sessions
- Sessions without `strategy`: Should default to 'simple'
- Sessions without `timeline`: Should initialize to empty array `[]`
- Status 'running' → Should be migrated to 'idle' or 'working' based on context

---

## Validation Checklist

- [x] All type mismatches resolved
- [x] All missing endpoints documented
- [x] All missing entity fields added
- [x] New entities (Queue, Template) fully specified
- [x] Examples updated with correct types
- [x] Cross-references between specs updated
- [x] Index updated with new specs
- [x] Version numbers incremented

---

## Next Steps

### Recommended Actions

1. **Update client code** to use 'todo' instead of 'pending'
2. **Update session handling** for new status values
3. **Implement queue features** in UI if not already done
4. **Implement template management** in UI if not already done
5. **Migrate existing data** if needed
6. **Update tests** to reflect new types
7. **Review WebSocket spec** (04-WEBSOCKET-SPECIFICATION.md) for event consistency

### Future Enhancements

1. **Tree Strategy**: Document the 'tree' worker strategy when implemented
2. **Session Timeline Events**: Document all 12+ event types in WebSocket spec
3. **Queue Events**: Add queue-specific events to WebSocket spec
4. **Template Events**: Add template-specific events to WebSocket spec
5. **JSON Schemas**: Create/update JSON schema files for new types

---

## Questions Answered

✅ **TaskStatus standardization:** Using 'todo' (from codebase) instead of 'pending' (from old spec)
✅ **'cancelled' status:** Added as official status
✅ **SessionStatus:** Using codebase values ('idle', 'working', 'stopped') instead of spec's 'running'
✅ **Queue System:** New spec document created (12-QUEUE-SPECIFICATION.md)
✅ **Template System:** New spec document created (13-TEMPLATE-SPECIFICATION.md)
✅ **Session/Task Timeline:** Following code - timeline moved to Session, removed from Task
✅ **Worker Strategies:** Documented all three: simple, queue, tree

---

## Spec Consistency Status

✅ **Consistent** - Spec now matches codebase implementation
✅ **Complete** - All implemented features documented
✅ **Current** - Version 1.1.0 reflects latest changes (2026-02-07)

---

**Last Updated:** 2026-02-07
**Spec Version:** 1.1.0
**Codebase Status:** Synchronized
