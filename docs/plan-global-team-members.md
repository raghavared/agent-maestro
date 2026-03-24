# Plan: Global Team Members

## Problem

Currently, team members are scoped to individual projects (`projectId` is a required field). This means:
- A user who creates a useful team member in Project A must manually recreate it in Project B
- Default team members are duplicated per project (each project gets its own Worker, Coordinator, etc.)
- There's no way to share custom team members across projects

## Proposed Solution: `scope` field on TeamMember

Add a `scope` field to the `TeamMember` interface:

```typescript
export interface TeamMember {
  // ...existing fields...
  scope: 'project' | 'global';  // NEW — defaults to 'project' for backward compat
  projectId: string;             // For global members, this would be a sentinel value like '__global__'
}
```

### Key Design Decisions

1. **Global members stored separately**: `{dataDir}/team-members/__global__/` directory
2. **`projectId` stays required**: For global members, use sentinel `__global__` to avoid breaking the existing schema
3. **Defaults stay project-scoped**: The 5 built-in defaults (Worker, Coordinator, etc.) remain per-project since their IDs are deterministic based on `projectId`
4. **Global members appear in all projects**: When fetching team members for a project, global members are included alongside project-specific ones

---

## Implementation Plan

### Phase 1: Backend — Data Model & Repository

**File: `maestro-server/src/types.ts`**
- Add `scope?: 'project' | 'global'` to `TeamMember` interface (optional for backward compat, defaults to `'project'`)

**File: `maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts`**
- Add constant `GLOBAL_PROJECT_ID = '__global__'`
- Update `findByProjectId(projectId)` to also load global members from `__global__/` directory
- Update `create()` to support `scope: 'global'` — store in `__global__/` dir
- Update `findById()` to check `__global__/` if not found in project dir
- Update `update()` / `delete()` to handle global member paths

### Phase 2: Backend — Service & API

**File: `maestro-server/src/application/services/TeamMemberService.ts`**
- Update `createTeamMember()` to accept optional `scope` param
- Update `getProjectTeamMembers()` to merge project + global members
- Add `convertToGlobal(id)` / `convertToProject(id, targetProjectId)` methods

**File: `maestro-server/src/api/teamMemberRoutes.ts`**
- Update `POST /team-members` to accept `scope` in body
- Add `PATCH /team-members/:id/scope` endpoint to toggle scope
- Update `GET /team-members?projectId=X` to include global members in response
- Add `GET /team-members?scope=global` to list only global members

### Phase 3: Frontend — Store & Hooks

**File: `maestro-ui/src/stores/useMaestroStore.ts`**
- Update `fetchTeamMembers()` — global members come with the project fetch (server merges them)
- No major store changes needed since the server returns merged lists

**File: `maestro-ui/src/hooks/useTeamMemberActions.ts`**
- Update filter to include both `tm.projectId === projectId` and `tm.scope === 'global'`

### Phase 4: Frontend — UI

**File: `maestro-ui/src/components/maestro/TeamMemberModal.tsx`**
- Add a "Global" toggle/checkbox when creating or editing a team member
- Show a badge/indicator on global members in the list

**File: `maestro-ui/src/components/maestro/TeamMemberList.tsx`**
- Add visual indicator (e.g., 🌐 icon) for global members
- Optional: group global members separately in the list

---

## Migration

- Existing members have no `scope` field → treat as `'project'` (backward compatible)
- No data migration needed — absence of `scope` = project-scoped

## Edge Cases

- **Naming conflicts**: A global member and project member can have the same name — this is acceptable since they have different IDs
- **Archiving global members**: Archiving a global member removes it from all projects
- **Overrides for defaults**: Defaults remain project-scoped (not eligible for global scope since their IDs embed `projectId`)
