# Phase 1 Implementation Complete: Server Types & Repository Layer

## Overview
Successfully implemented Phase 1 foundation for Team Members feature as specified in `03-implementation-spec.md`.

## Changes Made

### 1. Updated `maestro-server/src/types.ts` (Step 1.1)

#### Added:
- `TeamMemberStatus` type: `'active' | 'archived'`
- `TeamMember` interface: Complete team member entity with all required fields
- `TeamMemberSnapshot` interface: Lightweight snapshot for session tracking
- `CreateTeamMemberPayload` interface: Payload for creating team members
- `UpdateTeamMemberPayload` interface: Payload for updating team members

#### Modified:
- `Session` interface: Added `teamMemberId?: string` and `teamMemberSnapshot?: TeamMemberSnapshot`
- `SpawnSessionPayload` interface: Added `teamMemberId?: string`

#### Removed:
- `TaskType` type (`'task' | 'team-member'`)
- `TeamMemberMetadata` interface
- `taskType?: TaskType` field from `Task`, `CreateTaskPayload`, and `UpdateTaskPayload`
- `teamMemberMetadata?: TeamMemberMetadata` field from `Task`, `CreateTaskPayload`, and `UpdateTaskPayload`

### 2. Created `maestro-server/src/domain/repositories/ITeamMemberRepository.ts` (Step 1.2)

Complete repository interface with methods:
- `findById(projectId, id)`: Find team member by ID
- `findByProjectId(projectId)`: Get all team members (defaults + custom)
- `create(member)`: Create custom team member
- `update(id, updates)`: Update team member (handles defaults with overrides)
- `delete(id)`: Delete custom team member (throws for defaults)
- `saveDefaultOverride(projectId, defaultId, overrides)`: Save default overrides
- `resetDefault(projectId, defaultId)`: Reset default to code values
- `initialize()`: Initialize repository

### 3. Created `maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts` (Step 1.3)

Full implementation with:

#### Default Team Members:
- **Worker**: `🔧` Default executor
- **Coordinator**: `🎯` Task orchestrator
- Deterministic IDs: `tm_{projectId}_worker` and `tm_{projectId}_coordinator`

#### Storage Layout:
```
{dataDir}/team-members/{projectId}/
  tm_{projectId}_worker.override.json      # Optional: user overrides
  tm_{projectId}_coordinator.override.json # Optional: user overrides
  tm_{timestamp}_{random}.json             # Custom team members
```

#### Features:
- Defaults defined as code constants
- Override system for customizing defaults
- Separate storage for custom members
- Proper error handling (ForbiddenError for default deletion)

### 4. Updated Domain Events (Step 1.8)

#### `maestro-server/src/domain/events/DomainEvents.ts`:
- Added `TeamMemberCreatedEvent`
- Added `TeamMemberUpdatedEvent`
- Added `TeamMemberDeletedEvent`
- Added `TeamMemberArchivedEvent`
- Added events to `DomainEvent` union type
- Added events to `TypedEventMap`

#### `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`:
- Added team member events to WebSocket bridge:
  - `'team_member:created'`
  - `'team_member:updated'`
  - `'team_member:deleted'`
  - `'team_member:archived'`

### 5. Cleaned Up Task Repository

#### `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts`:
- Removed `taskType` and `teamMemberMetadata` from task creation
- Removed `taskType` filter handling
- Removed `taskType` and `teamMemberMetadata` from task updates

#### `maestro-server/src/domain/repositories/ITaskRepository.ts`:
- Removed `taskType` from `TaskFilter` interface

#### `maestro-server/src/api/taskRoutes.ts`:
- Removed `taskType` query parameter handling

## Build Status
✅ Server builds successfully with no TypeScript errors

## Next Steps
The following implementation steps remain:
- **Step 1.4**: Create `TeamMemberService`
- **Step 1.5**: Create `teamMemberRoutes`
- **Step 1.6**: Update `container.ts`
- **Step 1.7**: Update `server.ts`
- **Step 1.9**: Migration for old team member tasks
- **Step 1.10**: Already complete (task filtering cleanup done)

## Files Modified
1. `maestro-server/src/types.ts`
2. `maestro-server/src/domain/events/DomainEvents.ts`
3. `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`
4. `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts`
5. `maestro-server/src/domain/repositories/ITaskRepository.ts`
6. `maestro-server/src/api/taskRoutes.ts`

## Files Created
1. `maestro-server/src/domain/repositories/ITeamMemberRepository.ts`
2. `maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts`

## Testing Notes
All type definitions are in place and the server builds successfully. The repository layer is ready for service layer integration.
