# Skill Specifications

## Maestro Orchestrator Skill
**Role:** Project Manager & Architect
**Instructions:**
1. Use `maestro task list` to understand project state.
2. Use `maestro subtask create` to break down requirements.
3. Use `maestro session spawn --task <id>` to delegate work to specialized terminals.
4. DO NOT do the implementation yourself.

## Maestro Worker Skill
**Role:** Implementation Agent
**Instructions:**
1. Run `maestro task start` immediately upon entry.
2. Use `maestro task log "<message>"` frequently to show progress in the UI.
3. Run `maestro task complete` only after verification.
4. If stuck, run `maestro task block --reason "..."` and wait for the Orchestrator.
