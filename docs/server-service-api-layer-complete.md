# Server Service & API Layer Implementation Complete

## Overview
Successfully implemented the server service and API layer for Team Members feature (Steps 1.4-1.7, 1.9, 1.10 from implementation spec).

## Changes Made

### 1. Created `TeamMemberService.ts` (Step 1.4)

**Location:** `maestro-server/src/application/services/TeamMemberService.ts`

**Implements all required methods:**
- ✅ `createTeamMember()` - Creates custom team member with generated ID, `isDefault: false`, `status: 'active'`
- ✅ `getTeamMember()` - Gets team member by ID with validation
- ✅ `getProjectTeamMembers()` - Returns all team members (defaults + custom)
- ✅ `updateTeamMember()` - Updates team member (delegates to saveDefaultOverride for defaults)
- ✅ `deleteTeamMember()` - Deletes team member (enforces isDefault=false and status='archived')
- ✅ `archiveTeamMember()` - Sets status to 'archived', emits team_member:archived
- ✅ `unarchiveTeamMember()` - Sets status to 'active'
- ✅ `resetDefault()` - Resets default to code values, throws NotFoundError if not default
- ✅ `getTeamMemberSnapshot()` - Returns lightweight snapshot for session metadata

**Business Rules Enforced:**
- Custom members must have `isDefault: false`
- Default members cannot be archived or deleted
- Team members must be archived before deletion
- All validation with proper error types (ValidationError, NotFoundError, ForbiddenError, BusinessRuleError)

### 2. Created `teamMemberRoutes.ts` (Step 1.5)

**Location:** `maestro-server/src/api/teamMemberRoutes.ts`

**Implements all required endpoints:**
- ✅ `GET /api/team-members?projectId=X` - List all team members (defaults + custom)
- ✅ `POST /api/team-members` - Create custom team member
- ✅ `GET /api/team-members/:id?projectId=X` - Get team member by ID
- ✅ `PATCH /api/team-members/:id` - Update team member (projectId in body)
- ✅ `DELETE /api/team-members/:id?projectId=X` - Delete team member (403 if default, 400 if not archived)
- ✅ `POST /api/team-members/:id/archive` - Archive team member
- ✅ `POST /api/team-members/:id/unarchive` - Unarchive team member
- ✅ `POST /api/team-members/:id/reset` - Reset default to code values (404 if not default)

**Features:**
- Consistent error handling with AppError types
- Proper validation of required projectId parameter
- RESTful API design following existing patterns

### 3. Updated `container.ts` (Step 1.6)

**Changes:**
- ✅ Added import for `FileSystemTeamMemberRepository`
- ✅ Added import for `TeamMemberService`
- ✅ Added import for `ITeamMemberRepository`
- ✅ Added `teamMemberRepo: ITeamMemberRepository` to Container interface
- ✅ Added `teamMemberService: TeamMemberService` to Container interface
- ✅ Instantiated `FileSystemTeamMemberRepository` in createContainer()
- ✅ Instantiated `TeamMemberService` in createContainer()
- ✅ Added teamMemberRepo and teamMemberService to container object
- ✅ Added `await teamMemberRepo.initialize()` in initialize() method

### 4. Updated `server.ts` (Step 1.7)

**Changes:**
- ✅ Added import for `createTeamMemberRoutes`
- ✅ Extracted `teamMemberService` from container
- ✅ Created team member routes: `const teamMemberRoutes = createTeamMemberRoutes(teamMemberService)`
- ✅ Mounted routes: `app.use('/api', teamMemberRoutes)`

### 5. Added Migration for Old Team Member Tasks (Step 1.9)

**Location:** `maestro-server/src/container.ts` (migrateTeamMemberTasks function)

**Implementation:**
- ✅ Created `migrateTeamMemberTasks()` function
- ✅ Scans all tasks for `taskType === 'team-member'`
- ✅ Deletes old team member tasks
- ✅ Logs migration progress
- ✅ Idempotent (safe to run multiple times)
- ✅ Non-blocking (errors don't prevent server startup)
- ✅ Called during container initialization

### 6. Updated Service Index (Step 1.10)

**Location:** `maestro-server/src/application/services/index.ts`

**Changes:**
- ✅ Added export for TeamMemberService

## Build Status

✅ **Server builds successfully with no TypeScript errors**

```bash
npm run build
# Output: Success - no errors
```

## API Endpoints Summary

All endpoints require `projectId` either as query parameter or in request body:

| Method | Endpoint | Description | Status Codes |
|--------|----------|-------------|--------------|
| GET | `/api/team-members?projectId=X` | List all team members | 200, 400 |
| POST | `/api/team-members` | Create custom team member | 201, 400 |
| GET | `/api/team-members/:id?projectId=X` | Get team member by ID | 200, 400, 404 |
| PATCH | `/api/team-members/:id` | Update team member | 200, 400, 404 |
| DELETE | `/api/team-members/:id?projectId=X` | Delete team member | 200, 400, 403, 404, 422 |
| POST | `/api/team-members/:id/archive` | Archive team member | 200, 400, 403, 404 |
| POST | `/api/team-members/:id/unarchive` | Unarchive team member | 200, 400, 403, 404 |
| POST | `/api/team-members/:id/reset` | Reset default to code values | 200, 400, 404 |

## Event System Integration

The service emits the following domain events (already configured in Phase 1):
- `team_member:created` - When a custom team member is created
- `team_member:updated` - When a team member is updated or reset
- `team_member:deleted` - When a team member is deleted
- `team_member:archived` - When a team member is archived

All events are bridged to WebSocket clients via the WebSocketBridge.

## Files Modified

1. `maestro-server/src/container.ts` - Added team member repo, service, initialization, and migration
2. `maestro-server/src/server.ts` - Added team member routes
3. `maestro-server/src/application/services/index.ts` - Exported TeamMemberService

## Files Created

1. `maestro-server/src/application/services/TeamMemberService.ts` - Service layer implementation
2. `maestro-server/src/api/teamMemberRoutes.ts` - API routes implementation

## Testing Checklist

The implementation is ready for testing:

- [ ] `GET /api/team-members?projectId=X` returns Worker + Coordinator defaults
- [ ] `POST /api/team-members` creates a custom member
- [ ] `PATCH /api/team-members/:id` on a default creates an override
- [ ] `POST /api/team-members/:id/reset` on a default removes the override
- [ ] `DELETE /api/team-members/:id` on a default returns 403
- [ ] `DELETE /api/team-members/:id` on active custom returns 400 (must archive first)
- [ ] `POST /api/team-members/:id/archive` then `DELETE` works
- [ ] WebSocket receives `team_member:created`, `team_member:updated`, `team_member:deleted`, `team_member:archived`
- [ ] Old `taskType: 'team-member'` tasks are deleted on server startup

## Next Steps

Phase 1 is now **COMPLETE**. The following remain for full team member feature:

**Phase 2: Session Integration + CLI**
- Step 2.1: Update Session Spawn Flow
- Step 2.2: Update CLI Manifest Generator
- Step 2.3: Update CLI Session Spawn Command
- Step 2.4: Update Prompt Builder
- Step 2.5: Update Manifest Types
- Step 2.6: Update Command Permissions
- Step 2.7: Update Coordinator Prompt

**Phase 3: UI - Store, Client, & Team Tab**
- Update UI types, client, store
- Update Team tab rendering
- Create team member modals

**Phase 4: UI - Split Play Button & Session Integration**
- Create SplitPlayButton component
- Update task list items
- Update session display

## Notes

- All code follows existing patterns from TaskService and taskRoutes
- Error handling is consistent with the rest of the codebase
- The migration is idempotent and non-blocking
- The implementation is fully type-safe with no TypeScript errors
