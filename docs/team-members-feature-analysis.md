# Team Members Feature Analysis

## 1. Team Member Data Model

**Location:** `maestro-cli/src/types/manifest.ts:73-92`

A `TeamMemberData` has these fields:
- `id` — the task ID representing this team member
- `name` — display name
- `role` — role description (e.g., "frontend developer", "tester")
- `identity` — persona/instruction prompt
- `avatar` — emoji or icon
- `mailId` — for the shared mailbox system
- `skillIds?` — assigned skills
- `model?` — preferred model
- `agentTool?` — which CLI tool to use (claude-code, codex, gemini)

Team members are **stored as tasks** with `taskType: 'team-member'` and a `teamMemberMetadata` sub-object containing `role`, `identity`, `avatar`, and `mailId`.

## 2. How the Coordinator Manages Team Members in the Prompt

The `PromptBuilder` (`maestro-cli/src/services/prompt-builder.ts`) includes team member data in three places:

1. **System XML** (`buildSystemXml`, line 52): Included in the static system prompt for coordinate-mode agents.
2. **Task XML** (`buildTaskXml`, line 85): Included in the dynamic task context.
3. **Full XML** (`buildXml`, line 138): Included in the combined XML mode.

The `buildTeamMembers` method (lines 365-384) renders as:
```xml
<team_members count="N">
  <team_member id="..." name="..." role="...">
    <identity>persona prompt</identity>
    <avatar>emoji</avatar>
    <mail_id>shared mailbox id</mail_id>
    <model>preferred model</model>
    <agent_tool>claude-code|codex|gemini</agent_tool>
  </team_member>
</team_members>
```

The coordinator identity (line 157):
> "You are a coordinator agent. You NEVER write code or implement anything directly. Your job is to decompose tasks into subtasks, spawn worker sessions to do the work, monitor their progress, and report results."

## 3. How the Coordinator Prompt is Generated

Two-layer architecture:

### Layer 1: Static System Prompt
`WhoamiRenderer.renderSystemPrompt()` (line 144-156):
- Calls `PromptBuilder.buildSystemXml()` → identity, capabilities, team members, workflow phases, commands
- Injects additional commands XML from `renderCommandsXml()`

### Layer 2: Dynamic Task Context
`WhoamiRenderer.renderTaskContext()` (line 162-189):
- Calls `PromptBuilder.buildTaskXml()` → task details, skills, team members, session context
- Appends reference task context (fetched from API)

### Coordinator Workflow Phases (strategy-specific)
- **default**: analyze → decompose → spawn → monitor → verify → complete
- **intelligent-batching**: analyze → decompose → execute_batch → verify → complete
- **dag**: analyze → build_dag → execute_wave → verify → complete

## 4. How Team Members Flow Into the Manifest

### From UI/API → Server
Session spawn endpoint (`maestro-server/src/api/sessionRoutes.ts`, line 469) accepts `teamMemberIds` in request body.

### Server → CLI Manifest Generator
Server calls: `maestro manifest generate --team-member-ids <ids>`

### CLI Manifest Generator
`ManifestGeneratorCLICommand.execute()` (`maestro-cli/src/commands/manifest-generator.ts`, lines 243-272):
1. Receives `teamMemberIds`
2. Fetches each task from local storage
3. Reads `teamMemberMetadata` (role, identity, avatar, mailId)
4. Reads `metadata.skillIds` and `metadata.agentTool`
5. Constructs `TeamMemberData[]` → `manifest.teamMembers`

## 5. Spawners: Claude, Codex, and Gemini

All share the `AgentSpawner` factory (`maestro-cli/src/services/agent-spawner.ts`).

### AgentSpawner (Factory)
- `getSpawner(manifest)` selects spawner based on `manifest.agentTool` (defaults to `claude-code`)
- All implement `IAgentSpawner` interface

### ClaudeSpawner (`claude-spawner.ts`)
- System prompt via `--append-system-prompt`
- Task context as user message argument
- Loads plugins/skills via `--plugin-dir`
- Command: `claude --model <model> --plugin-dir <dir> --append-system-prompt <system> <taskContext>`

### CodexSpawner (`codex-spawner.ts`)
- Model mapping: opus→gpt-5.3-codex, sonnet→gpt-5.2-codex, haiku→gpt-5.1-codex-mini
- Permission mapping: acceptEdits→on-failure, readOnly→untrusted
- System prompt via `-c developer_instructions=<json>`
- Command: `codex --model <model> --ask-for-approval <policy> --sandbox danger-full-access -c developer_instructions="..." <taskContext>`

### GeminiSpawner (`gemini-spawner.ts`)
- Model mapping: opus→gemini-3-pro-preview, sonnet→gemini-2.5-pro, haiku→gemini-2.5-flash
- Permission mapping: acceptEdits→yolo, readOnly→plan
- No separate system prompt flag — concatenates with `[SYSTEM INSTRUCTIONS]` / `[TASK]` headers
- Command: `gemini --model <model> --approval-mode <mode> --prompt "<combined>"`

### Common Environment Variables (all spawners)
`MAESTRO_SESSION_ID`, `MAESTRO_TASK_IDS`, `MAESTRO_PROJECT_ID`, `MAESTRO_MODE`, `MAESTRO_STRATEGY`, `MAESTRO_SERVER_URL`, `MAESTRO_ORCHESTRATOR_STRATEGY` (coordinate mode only).

## 6. End-to-End Flow

```
UI spawns session with teamMemberIds
  → Server calls CLI: maestro manifest generate --team-member-ids ...
    → CLI reads team-member tasks from storage, extracts teamMemberMetadata
    → Builds MaestroManifest with teamMembers[]
  → Server reads manifest, calls orchestrator-init or worker-init
    → OrchestratorInitCommand uses AgentSpawner
      → AgentSpawner selects ClaudeSpawner/CodexSpawner/GeminiSpawner
        → Spawner uses WhoamiRenderer + PromptBuilder
          → PromptBuilder.buildTeamMembers() renders <team_members> XML
        → System prompt (with team members) injected per-tool
        → Task context (with team members) passed as user message
```

## Key Files

| File | Purpose |
|------|---------|
| `maestro-cli/src/types/manifest.ts` | TeamMemberData type, TaskData with teamMemberMetadata |
| `maestro-cli/src/services/prompt-builder.ts` | Renders `<team_members>` XML into prompts |
| `maestro-cli/src/services/whoami-renderer.ts` | Two-layer prompt architecture (system + task) |
| `maestro-cli/src/commands/manifest-generator.ts` | Loads team members from storage into manifest |
| `maestro-cli/src/services/agent-spawner.ts` | Factory selecting Claude/Codex/Gemini spawner |
| `maestro-cli/src/services/claude-spawner.ts` | Claude Code spawning with --append-system-prompt |
| `maestro-cli/src/services/codex-spawner.ts` | Codex spawning with developer_instructions |
| `maestro-cli/src/services/gemini-spawner.ts` | Gemini spawning with concatenated prompt |
| `maestro-server/src/api/sessionRoutes.ts` | Server endpoint accepting teamMemberIds |
