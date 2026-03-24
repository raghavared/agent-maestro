# CLI Agent Errors & Issues

Documented issues where agents make mistakes calling maestro CLI commands.
These inform improvements to command syntax prompting, error messages, and CLI design.

---

## Issue #1: `team-member create` — Agent uses `--name` flag instead of positional argument

**Date:** 2026-03-15
**Source:** Agent session working on project tasks
**Command:** `maestro team-member create`

### What happened

1. Agent first called `maestro team-member create --name "Style Researcher" --role "..." --mode worker` — missing required `--avatar`, got error: `required option '--avatar <emoji>' not specified`
2. Agent added `--avatar` and retried: `maestro team-member create --name "Style Researcher" --role "..." --avatar "..." --mode worker` — got error: `unknown option '--name'`

### Root cause

The `name` parameter is a **positional argument** (`create <name>`), not a named flag. The correct syntax is:
```
maestro team-member create "Style Researcher" --role "..." --avatar "🔍" --mode worker
```

The agent converted the positional arg to a `--name` flag, a common LLM pattern.

### Current prompt syntax (correct)

The command catalog already shows the correct syntax:
```
maestro team-member create "<name>" --role "<role>" --avatar "<emoji>" --mode <mode>
```

### Suggested fixes

- **Option A (prompt improvement):** Add an explicit note in the prompt like "Note: `<name>` is a positional argument, NOT a --name flag"
- **Option B (CLI change):** Accept `--name` as an alias for the positional argument so both forms work
- **Option C (both):** Accept `--name` as fallback AND clarify in prompt

### Also noted

Agent forgot required `--avatar` flag on first attempt, suggesting required options should be more prominently highlighted in the prompt syntax.

---
