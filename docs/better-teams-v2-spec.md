# Better Teams V2 — Feature Specification

## Overview

Better Teams V2 unifies coordinator + worker sessions under a shared `teamSessionId` field, introduces a dedicated `TeamSessionGroup` UI component, and bridges the formal Teams concept with live session groups.

**Task ID:** task_1771587432425_acwcwya16

---

## Problem Statement

Currently:
- Session grouping in the UI is computed dynamically from `mode === 'coordinate'` + `spawnedBy/parentSessionId`
- The group header is inline JSX with minimal info (just label + count)
- The formal Teams concept (`Team { id, leaderId, memberIds }`) has no connection to live session groups
- No aggregate status/progress shown per group
- `teamSessionId` doesn't exist — groups are ephemeral UI computations, not stored data

---

## Core Concept: Team Session

A **Team Session** = coordinator session + its spawned workers, unified under a shared `teamSessionId`.

- `teamSessionId` = coordinator's own session ID (self-referential for coordinator, inherited for workers)
- Server auto-sets `teamSessionId` on spawned worker sessions (= `parentSessionId`)
- If running via a saved Team, `teamId` is also stored for enrichment

---

## Architecture

### Data Model

```typescript
// Session (server)
interface Session {
  id: string;
  // ... existing fields ...
  teamSessionId?: string | null;  // NEW: coordinator's session ID
  teamId?: string | null;          // NEW: optional saved Team reference
}

// MaestroSession (frontend)
interface MaestroSession {
  // ... existing fields ...
  teamSessionId?: string;
  teamId?: string;
}

// TeamGroup (teamGrouping utility)
interface TeamGroup {
  coordinatorId: string;
  teamSessionId: string;           // NEW: explicit, not computed
  teamId?: string;                 // NEW: saved Team if matched
  workerIds: string[];
  // ... existing fields ...
}
```

---

## Implementation Phases

### Phase 1: Backend — Add `teamSessionId` to Session Schema

**`maestro-server/src/types.ts`**
- Add `teamSessionId?: string | null` to `Session` interface
- Add `teamId?: string | null` to `Session` interface

**`maestro-server/src/api/sessionRoutes.ts`**
When spawning a worker session (`spawnSource === 'session'`):
```typescript
// In spawn handler:
newSession.teamSessionId = parentSessionId;  // inherit coordinator's ID

// Also update coordinator session on first spawn:
if (!coordinatorSession.teamSessionId) {
  coordinatorSession.teamSessionId = coordinatorSession.id;
  await sessionRepo.update(coordinatorSession);
}
```

**`maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts`**
- Persist `teamSessionId` in session JSON
- Support `findByTeamSessionId(teamSessionId: string): Session[]` query

---

### Phase 2: Frontend Types

**`maestro-ui/src/app/types/maestro.ts`**
```typescript
export interface MaestroSession {
  // ... existing fields ...
  teamSessionId?: string;
  teamId?: string;
}
```

**`maestro-ui/src/stores/useMaestroStore.ts`**
- Ensure WebSocket `session:updated` handler preserves new fields:
```typescript
// In update handler, ensure teamSessionId is not dropped during merge
```

---

### Phase 3: Enhanced `teamGrouping.ts`

**`maestro-ui/src/utils/teamGrouping.ts`**

Extended `TeamGroup` interface:
```typescript
export interface TeamGroup {
  coordinatorId: string;
  teamSessionId: string;     // explicit field (coordinator's session ID)
  teamId?: string;           // matched saved Team ID if found
  teamName?: string;         // from saved Team name
  teamAvatar?: string;       // from saved Team avatar
  workerIds: string[];
  status: 'active' | 'idle' | 'done';
  taskProgress?: { done: number; total: number };
}
```

Updated `buildTeamGroups` logic:
1. Prefer explicit `session.teamSessionId` when present
2. Fallback to old `spawnedBy/parentSessionId` matching for backwards compat
3. After grouping, match coordinator's `teamMemberId` against saved Teams `leaderId`
4. If match found, attach `teamId`, `teamName`, `teamAvatar` to group

---

### Phase 4: New `TeamSessionGroup` Component

**New file: `maestro-ui/src/components/maestro/TeamSessionGroup.tsx`**

```tsx
interface TeamSessionGroupProps {
  group: TeamGroup;
  allSessions: Session[];
  maestroSessions: Map<string, MaestroSession>;
  teamsMap: Map<string, Team>;
  renderSessionItem: (sessionId: string, isWorker?: boolean) => React.ReactNode;
}
```

Component structure:
```
TeamSessionGroup
├── .tsGroupHeader
│   ├── Avatar (team avatar or coordinator initials)
│   ├── Name (team name or coordinator label)
│   ├── StatusBadge (◉ Active / ○ Idle / ✓ Done)
│   ├── WorkerCount ("3 workers")
│   └── CollapseToggle (▼ / ▶)
├── .tsGroupMemberChips  (when expanded)
│   └── MemberChip × N  (avatar + name + status dot)
├── .tsGroupProgress  (when expanded, if tasks exist)
│   └── "4 / 7 tasks done"  [progress bar]
└── .tsGroupBody  (when expanded)
    ├── coordinator session item
    └── worker session items × N
```

State: `collapsed: boolean` (default false)

---

### Phase 5: Update `SessionsSection.tsx`

**`maestro-ui/src/components/SessionsSection.tsx`**

Before (inline JSX):
```tsx
<div className="teamGroup">
  <div className="teamGroupHeader">
    <span>{group.label}</span>
    <span>{group.workerIds.length} workers</span>
  </div>
  {/* inline session items */}
</div>
```

After (component):
```tsx
<TeamSessionGroup
  key={group.teamSessionId}
  group={group}
  allSessions={sessions}
  maestroSessions={maestroSessionsMap}
  teamsMap={teamsMap}
  renderSessionItem={renderSessionItem}
/>
```

---

### Phase 6: Styles

**`maestro-ui/src/styles-sessions.css`**

New CSS classes:
```css
.tsGroup { /* container */ }
.tsGroupHeader { /* flex row, clickable, hover state */ }
.tsGroupHeader .avatar { /* team avatar circle */ }
.tsGroupHeader .name { /* team/coordinator name */ }
.tsGroupHeader .statusBadge { /* colored status pill */ }
.tsGroupHeader .workerCount { /* subtle count */ }
.tsGroupHeader .collapseToggle { /* arrow icon */ }
.tsGroupMemberChips { /* horizontal scroll row */ }
.tsGroupMemberChips .chip { /* avatar + name + dot */ }
.tsGroupMemberChips .chip .statusDot { /* colored dot */ }
.tsGroupProgress { /* progress bar + text */ }
.tsGroupBody { /* session items container */ }
```

---

## Testing Checklist

- [ ] Spawn coordinator → `teamSessionId = coordinator.id` is set and persisted
- [ ] Coordinator spawns workers → each worker's `teamSessionId = coordinator.id`
- [ ] Restart server → `teamSessionId` is preserved (persisted in JSON)
- [ ] SessionsSection renders `TeamSessionGroup` with correct header
- [ ] Member chips show correct worker count and status dots
- [ ] Progress line shows task completion ratio
- [ ] Collapse/expand toggle works
- [ ] Saved Team with `leaderId` matching coordinator's `teamMemberId` → shows team name/avatar
- [ ] Existing ungrouped sessions (no coordinator parent) render normally, unaffected
- [ ] Old sessions without `teamSessionId` → fallback grouping still works (backwards compat)

---

## Files Summary

| File | Change Type |
|------|-------------|
| `maestro-server/src/types.ts` | Modify — add `teamSessionId`, `teamId` |
| `maestro-server/src/api/sessionRoutes.ts` | Modify — auto-set `teamSessionId` on spawn |
| `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts` | Modify — persist, add query |
| `maestro-ui/src/app/types/maestro.ts` | Modify — add `teamSessionId`, `teamId` |
| `maestro-ui/src/stores/useMaestroStore.ts` | Modify — preserve new fields in WS handler |
| `maestro-ui/src/utils/teamGrouping.ts` | Modify — enhance TeamGroup, use `teamSessionId` |
| `maestro-ui/src/components/maestro/TeamSessionGroup.tsx` | **New** — dedicated component |
| `maestro-ui/src/components/SessionsSection.tsx` | Modify — use TeamSessionGroup |
| `maestro-ui/src/styles-sessions.css` | Modify — add new styles |
