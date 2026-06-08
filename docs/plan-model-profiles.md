# Plan: Model Profiles

## Problem

Every `TeamMember` hardcodes a `model` string (and increasingly a full `launchConfig`).
When a new model ships (e.g. Opus 4.7 → Opus 4.8 → Opus 4.8 1M), the user has to
hand-edit **every** team member across **every** project to point at the new model.
There is no indirection layer.

The user wants **model profiles**: a named, reusable model configuration
(`name → launch config`). Team members reference a profile instead of a raw model.
Updating the profile once re-points every member that uses it — dependency inversion
for model selection. New models get adopted by editing a handful of profiles instead
of dozens of team members.

> Note: The standalone ask "add Opus 4.8 1M model" is **already implemented** in code
> (`claude-opus-4-8[1m]`). This plan covers only the profiles feature.

## Decisions (confirmed with user)

1. **A profile captures the full launch config**, not just a model string:
   `{ provider, model, reasoningEffort?, speed?, accessMode? }` (the existing
   `LaunchConfig` shape). One profile fully defines how a member launches.
2. **Team members reference a profile with per-member override.** A member stores
   `modelProfileId`. At spawn, the profile resolves to a `LaunchConfig`; any explicit
   per-member `launchConfig`/`model` overrides individual fields. Raw `model` stays as
   a legacy fallback when no profile is set.
3. **Profiles are per-project** (scoped like project team members, stored under the
   project's data dir). See "Open question: global team members" below.
4. **Managed in the team/settings area** of the UI — a "Model Profiles" section beside
   team member management (list / create / edit / delete).

---

## Data Model

### New entity: `ModelProfile`

```typescript
// maestro-server/src/types.ts
export interface ModelProfile {
  id: string;            // "mp_<timestamp>_<random>"
  projectId: string;
  name: string;          // "Heavy", "Cheap", "Default", "Long-context"
  description?: string;
  launchConfig: LaunchConfig;  // { provider, model, reasoningEffort?, speed?, accessMode? }
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

export interface CreateModelProfilePayload {
  projectId: string;
  name: string;
  description?: string;
  launchConfig: LaunchConfig;
}

export interface UpdateModelProfilePayload {
  name?: string;
  description?: string;
  launchConfig?: LaunchConfig;
}
```

### `TeamMember` change

```typescript
export interface TeamMember {
  // ...existing fields...
  modelProfileId?: string;   // NEW — when set, resolves to the profile's launchConfig at spawn
}
```

Also add `modelProfileId?` to `CreateTeamMemberPayload`, `UpdateTeamMemberPayload`,
and `MemberLaunchOverride` (so a team launch can override the profile per-member).

### Resolution order (at spawn time)

For a given member, the effective `LaunchConfig` is resolved as:

1. **Per-run / per-member explicit override** — `override.launchConfig` (from
   `memberOverrides`) or the spawn request's `launchConfig`. Highest priority.
2. **Profile** — if `member.modelProfileId` is set, load the profile and use its
   `launchConfig` as the base.
3. **Legacy raw model** — `launchConfigFromLegacy(member.agentTool, member.model, ...)`.
   Lowest priority, backward-compatible.

Individual fields merge: a member can adopt the "Heavy" profile but still override
`reasoningEffort` for itself. Implement as a shallow field-level merge
(`override ?? profile ?? legacy`) per `LaunchConfig` field.

---

## Implementation Plan

### Phase 1 — Server: data model & repository

**`maestro-server/src/types.ts`**
- Add `ModelProfile`, `CreateModelProfilePayload`, `UpdateModelProfilePayload`.
- Add `modelProfileId?: string` to `TeamMember`, `CreateTeamMemberPayload`,
  `UpdateTeamMemberPayload`, and `MemberLaunchOverride`.

**`maestro-server/src/domain/repositories/IModelProfileRepository.ts`** (new)
- Mirror `ITeamMemberRepository`: `findById`, `findByProjectId`, `create`, `update`, `delete`.

**`maestro-server/src/infrastructure/repositories/FileSystemModelProfileRepository.ts`** (new)
- Mirror `FileSystemTeamMemberRepository` (atomic writes, one subdir per entity type:
  `{dataDir}/model-profiles/{projectId}/{id}.json`).

### Phase 2 — Server: service & API

**`maestro-server/src/application/services/ModelProfileService.ts`** (new)
- CRUD wrappers + validation (non-empty name; valid `launchConfig` via existing
  `sanitizeLaunchConfig`). Emit WS events on create/update/delete via `IEventBus`.
- Guard on delete: if any team member references the profile, either (a) block with a
  clear error listing members, or (b) null out `modelProfileId` on those members.
  **Recommend (a)** — block and surface which members use it.

**`maestro-server/src/api/modelProfileRoutes.ts`** (new) + register in `api/index.ts`/router
- `GET /api/model-profiles?projectId=X` — list
- `POST /api/model-profiles` — create
- `PATCH /api/model-profiles/:id` — update
- `DELETE /api/model-profiles/:id` — delete

**`maestro-server/src/api/validation.ts`**
- Add Zod schemas: `createModelProfileSchema`, `updateModelProfileSchema`
  (reuse the existing `launchConfigSchema`).

**`maestro-server/src/container.ts`**
- Wire `modelProfileRepo` + `modelProfileService` (follow the `teamMember*` wiring at
  lines ~14/26/111/126/163), expose on the container interface, init in `initialize()`.

### Phase 3 — Server: spawn-time resolution

**`maestro-server/src/api/sessionRoutes.ts`** (around lines 1370–1450)
- This is where `teamMemberDefaults.model` / `resolvedLaunchConfig` are computed from
  the team member + override. Inject profile resolution:
  - If no explicit `override.launchConfig` and `teamMember.modelProfileId` is set,
    load the profile (via `modelProfileService`) and use `profile.launchConfig` as the
    base before falling back to `launchConfigFromLegacy(...)`.
  - Keep the existing per-member override precedence on top.
- Because the server resolves the profile into `resolvedLaunchConfig` (stored in
  `session.metadata.launchConfig` and the manifest), **the CLI needs no functional
  change** — it already reads `launchConfig.model` (`claude-spawner.ts:180`).
- Update the spawn handler signature path so `modelProfileService` is reachable here
  (it's already inside the routes factory that receives the container).

### Phase 4 — UI: store & types

**`maestro-ui/src/app/types/maestro.ts`**
- Add `ModelProfile` type; add `modelProfileId?: string` to the UI `TeamMember` type.

**`maestro-ui/src/stores/useModelProfileStore.ts`** (new)
- Zustand store mirroring `useTeamMemberStore`/`useSpellStore`: `profiles`, `load`,
  `create`, `update`, `remove`, plus WS subscription handling for
  `modelProfile:created|updated|deleted` (wire into the existing WS bridge client
  filter by `projectId`).

### Phase 5 — UI: management surface (team/settings area)

- Add a **"Model Profiles"** section in the team/settings area (beside team member
  management). List profiles with name, resolved model label
  (reuse `MODEL_LABEL_OVERRIDES` / `agentTools.ts`), reasoning effort, access mode.
- Create/Edit form reusing the existing launch-config controls
  (`LaunchConfigDropdown` / the model+reasoning+access pickers in `TeamMemberModal`).
- Delete with confirmation; surface the "in use by N members" guard error.

### Phase 6 — UI: team member picker

**`maestro-ui/src/components/maestro/TeamMemberModal.tsx`**
- Add a **profile selector** ("Use model profile") that sets `modelProfileId`.
- When a profile is selected, show the resolved launch config (read-only preview) and
  let the user optionally override individual fields (which then populate the member's
  explicit `launchConfig`/`model`, taking precedence per the resolution order).
- "None / custom" keeps today's behavior (raw model).
- Show profile name in `TeamMemberList.tsx` where the model badge renders.

### Phase 7 — CLI (display only)

**`maestro-cli/src/types/manifest.ts`** + `manifest-generator.ts`
- Optional: include the resolved profile **name** in the manifest for display in the
  agent prompt ("Model profile: Heavy → Opus 4.8 1M"). No launch behavior change —
  resolution already happened server-side in Phase 3.

### Phase 8 — Tests

- Server unit: `ModelProfileService` CRUD + delete-guard; resolution precedence
  (override > profile > legacy) in the spawn path.
- Server repo: `FileSystemModelProfileRepository` round-trip.
- UI: `useModelProfileStore` reducer/WS handling; resolution preview in the modal.

---

## Files Touched (summary)

**Server (new):** `domain/repositories/IModelProfileRepository.ts`,
`infrastructure/repositories/FileSystemModelProfileRepository.ts`,
`application/services/ModelProfileService.ts`, `api/modelProfileRoutes.ts`.
**Server (edit):** `types.ts`, `api/validation.ts`, `container.ts`,
`api/sessionRoutes.ts` (resolution), router registration.
**UI (new):** `stores/useModelProfileStore.ts`, a ModelProfiles section/component +
form in the team/settings area.
**UI (edit):** `app/types/maestro.ts`, `components/maestro/TeamMemberModal.tsx`,
`components/maestro/TeamMemberList.tsx`, WS event wiring.
**CLI (edit, optional):** `types/manifest.ts`, `commands/manifest-generator.ts`.

## Open Questions / Risks

1. **Global team members.** Profiles are per-project, but team members can be `global`
   (`scope: 'global'`, sentinel `__global__` project). A global member referencing a
   per-project profile is ill-defined. Options: (a) also allow `global` profiles under
   `__global__` (small extra repo change, recommended), or (b) disallow profiles on
   global members. Decide before Phase 6.
2. **Delete guard policy** — block vs. null-out (recommended: block, list members).
3. **`MODEL_POWER` duplication** — adding profiles doesn't fix that models are ranked
   in 3 places (`agentTools.ts`, `sessionRoutes.ts`, `manifest-generator.ts`).
   Out of scope here, but worth a follow-up to centralize.
4. **Migration** — none required; `modelProfileId` is additive and optional, raw
   `model` remains the fallback.
