# Maestro CLI Prompt Generation

This document explains how Maestro CLI builds system prompts and initial (task) prompts, and how each agent tool receives them.

## Overview Flow (Manifest -> Prompt Text)

```mermaid
flowchart TD
  manifest[MaestroManifest]
  pb[PromptBuilder]
  whoami[WhoamiRenderer]
  perms[CommandPermissions]
  cmdBrief[generateCompactCommandBrief]
  systemXml[buildSystemXml]
  taskXml[buildTaskXml]
  sysPrompt[System Prompt XML]
  taskPrompt[Task Prompt XML]
  claude[ClaudeSpawner]
  codex[CodexSpawner]
  gemini[GeminiSpawner]

  manifest --> pb
  manifest --> perms
  perms --> cmdBrief

  pb --> systemXml
  pb --> taskXml

  systemXml --> whoami
  cmdBrief --> whoami
  whoami --> sysPrompt

  taskXml --> whoami
  whoami --> taskPrompt

  sysPrompt --> claude
  taskPrompt --> claude

  sysPrompt --> codex
  taskPrompt --> codex

  sysPrompt --> gemini
  taskPrompt --> gemini
```

## System Prompt Assembly (Static)

```mermaid
flowchart TD
  subgraph BuildSystemXml[PromptBuilder.buildSystemXml]
    id[identity]
    teamId[team_member_identity (optional)]
    roster[available_team_members (optional)]
    workflow[workflow phases]
  end

  systemXml[maestro_system_prompt XML]
  cmdBrief[generateCompactCommandBrief]
  cmdBlock[commands_reference block]
  finalSystem[System Prompt XML]

  BuildSystemXml --> systemXml
  cmdBrief --> cmdBlock
  systemXml -->|inject commands_reference| finalSystem
  cmdBlock --> finalSystem
```

### System Prompt Contents

- Identity: role profile + instruction (worker/coordinator) + optional project id
- Team member identity: single or multi-identity, with optional memory + expertise
- Team roster: available members (filtered to exclude self)
- Workflow phases: default or team member template/custom workflow
- Commands reference: compact command listing generated from permissions

## Task (Initial) Prompt Assembly (Dynamic)

```mermaid
flowchart TD
  subgraph BuildTaskXml[PromptBuilder.buildTaskXml]
    tasks[tasks + task entries]
    tree[task_tree (optional)]
    ctx[context codebase/related/standards (optional)]
    coordDir[coordinator_directive (optional)]
    skills[skills (Claude only)]
  end

  taskXml[maestro_task_prompt XML]
  sessionCtx[session_context (session id, project id, mode)]
  refTasks[reference_tasks (optional)]
  finalTask[Task Prompt XML]

  BuildTaskXml --> taskXml
  sessionCtx -->|appended by WhoamiRenderer.renderTaskContext| finalTask
  refTasks -->|appended by WhoamiRenderer.renderTaskContext| finalTask
  taskXml -->|inject session_context + reference_tasks| finalTask
```

### Task Prompt Contents

- Tasks list + optional task tree
- Session context: session id, project id, mode (always injected by WhoamiRenderer)
- Coordinator directive (if present)
- Context: codebase, related tasks, project standards (if present)
- Skills: only included when agent tool is `claude-code`
- Reference task IDs: appended by WhoamiRenderer if manifest has `referenceTaskIds`

## Agent Tool Injection (System + Initial Prompt)

```mermaid
flowchart TD
  sys[System Prompt XML]
  task[Task Prompt XML]

  subgraph Claude[ClaudeSpawner]
    claudeFlag[--append-system-prompt system]
    claudeUser[task as user prompt]
  end

  subgraph Codex[CodexSpawner]
    codexCfg[-c developer_instructions=system]
    codexUser[task as prompt arg]
  end

  subgraph Gemini[GeminiSpawner]
    geminiWrap[buildGeminiStructuredPrompt]
    geminiPrompt[--prompt "[SYSTEM]\\nsystem\\n\\n[TASK]\\ntask"]
  end

  sys --> claudeFlag
  task --> claudeUser

  sys --> codexCfg
  task --> codexUser

  sys --> geminiWrap
  task --> geminiWrap
  geminiWrap --> geminiPrompt
```

## Key Files

- Prompt assembly: `maestro-cli/src/services/prompt-builder.ts`
- System/task rendering: `maestro-cli/src/services/whoami-renderer.ts`
- Command brief injection: `maestro-cli/src/services/command-permissions.ts`
- Agent tool wiring: `maestro-cli/src/services/claude-spawner.ts`, `maestro-cli/src/services/codex-spawner.ts`, `maestro-cli/src/services/gemini-spawner.ts`
- Gemini wrapping: `maestro-cli/src/prompts/spawner.ts`

## Notes

- The system prompt intentionally excludes task-specific data.
- The task prompt intentionally excludes identity/workflow.
- Only Claude loads skills in the prompt XML (other tools do not include skill tags).
- `whoami` output uses `PromptBuilder.build` (combined XML) but is separate from the spawn flows.
