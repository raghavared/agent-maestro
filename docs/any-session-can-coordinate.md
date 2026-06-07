# Any Session Can Be Coordinator

## Summary

Previously, only sessions running in coordinator modes could spawn other sessions or message peer sessions. Worker sessions were blocked at two layers: the CLI catalog refused to register the commands, and the server returned `403` if a worker tried to call them.

This change drops both guard rails. **Any session — including a plain worker — can now spawn another session and prompt any other session.** The coordination commands remain hidden from worker prompts and help output, so the default agent experience is unchanged; the capability is opt-in by knowing the command.

## Why

The four-mode model (worker / coordinator / coordinated-worker / coordinated-coordinator) was originally designed so workers stayed focused on their assigned task and coordinators handled fan-out. In practice, workers periodically need to spawn a quick helper session or ping a peer — and refusing those operations forced awkward routing through a parent coordinator. The new design keeps the *prompt surface* focused (workers still see only their own commands) while removing the *execution* barrier.

## Mental model

Two concepts that were previously fused:

| | What it controls | Where it lives |
|---|---|---|
| `allowedModes` | Whether the command is **executable** in this mode | Catalog entry |
| `promptModes` (new) | Whether the command is **advertised** in the mode's prompt + help | Catalog entry |

`promptModes` defaults to `allowedModes`, so existing entries are unchanged. Coordination commands set both: `allowedModes: ALL_MODES`, `promptModes: COORDINATOR_MODES`.

## What changed

### `maestro-cli/src/prompting/command-catalog.ts`

- Added an optional `promptModes?: AgentMode[]` field to `CommandCatalogEntry`.
- Retagged the five coordination commands so they are runnable everywhere but only surfaced to coordinators:
  - `session:spawn`
  - `session:list`
  - `session:info`
  - `session:watch`
  - `session:logs`
- Emptied `DEFAULT_EXCLUDED_COMMANDS_BY_MODE` (previously excluded `session:spawn` from `coordinated-coordinator`).
- New helpers:
  - `getPromptModes(entry)` — returns `entry.promptModes ?? entry.allowedModes`.
  - `isCommandVisibleInPrompt(commandId, mode)` — single source of truth for "should this show up in the prompt for this mode?"
- `groupCommandsByParent` (used by both the prompt renderer and `maestro commands`) now filters on `promptModes` instead of `allowedModes`.

### `maestro-cli/src/prompting/capability-policy.ts`

- Emptied `HARD_BLOCKED_COMMANDS_BY_MODE` — no mode is hard-blocked from any command anymore.
- `buildCapabilityFlags`:
  - `canSpawnSessions` now requires *both* execution permission **and** prompt visibility, so a worker's `<capability_summary>` does not advertise spawning even though it would succeed.
  - `canPromptOtherSessions` is `true` whenever `session:prompt` is in `allowedCommands` (no more mode-derived restriction).

### `maestro-server/src/api/sessionRoutes.ts`

- **Removed** the `coordinated-coordinator` spawn 403 block. Any mode may call `POST /api/sessions/spawn`.
- **Relaxed** `canCommunicateWithinTeamBoundary` to a simple "sender and target exist, and are different sessions." No mode or team check.
- Deleted the now-unused `resolveSessionMode` helper.

## Behavior

| Operation | Worker (before) | Worker (after) | Coordinator |
|---|---|---|---|
| `maestro session spawn …` | Hidden, refused by `guardCommand` | **Runs.** Not in prompt/help. | Runs. In prompt/help. |
| `maestro session prompt …` | Server returned 403 for cross-team | **Runs against any session.** | Runs against any session. |
| `maestro session list/info/watch/logs` | Hidden, refused | **Runs.** Not in prompt/help. | Runs. In prompt/help. |
| `<capability_summary>` shows `canSpawnSessions` | No | **No (intentional — keeps prompt focused)** | Yes |
| `<capability_summary>` shows `canPromptOtherSessions` | No | **Yes** | Yes |

The asymmetry between `canSpawnSessions` (still hidden from workers) and `canPromptOtherSessions` (now advertised everywhere) is deliberate: free prompt was explicitly requested as a default capability, while spawning stays a discovery-only power for workers.

## Why the `guardCommand` path needed no change

Runtime enforcement keys off `allowedCommands`, which is built from `allowedModes` (not `promptModes`). Because the coordination commands now list every mode in `allowedModes`, they end up in `allowedCommands` for every session, and `guardCommand` simply lets them through.

## Outstanding follow-ups

Not blocking this change, but worth noting:

- The coordinated-coordinator system prompt in `maestro-cli/src/prompts/spawner.ts` still contains a *"Do not spawn new sessions."* directive. This is now prompt-level discouragement contradicting the new execution capability. Either remove the line or rephrase to "spawning is rare in this mode," depending on intent.
- A handful of prompt-composer snapshots had pre-existing drift on `main` (unrelated to this work). They were regenerated together with the snapshots this change actually touched.

## Verification

- `maestro-cli`: 320/320 tests pass, `tsc` clean.
- `maestro-server`: 39/39 tests pass, `tsc` clean.
- New tests added in `maestro-cli/tests/prompting/capability-policy.test.ts`:
  - Worker `allowedCommands` includes `session:spawn`, `session:list`, `session:logs`.
  - `coordinated-coordinator` `allowedCommands` includes `session:spawn` (no hard block).
  - `canPromptOtherSessions === true` for all four modes.
  - Worker has `session:spawn` executable but `canSpawnSessions === false`; coordinator has both.

## Files changed

```
maestro-cli/src/prompting/capability-policy.ts
maestro-cli/src/prompting/command-catalog.ts
maestro-cli/tests/prompting/capability-policy.test.ts
maestro-cli/tests/prompting/__snapshots__/prompt-composer.test.ts.snap
maestro-server/src/api/sessionRoutes.ts
```
