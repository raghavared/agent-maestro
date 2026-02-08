# Maestro Skilled Agents

## Concept
A **Skilled Agent** is more than just a "generic coder". It is a specialized configuration of an agent designed to execute a specific *type* of workflow with high reliability.

In Maestro, a Skilled Agent = **Base Model** + **System Prompt** + **Specific Toolset (Skills)** + **Workflow Heuristics**.

## Why Skilled Agents?
Generic agents often get lost in complex tasks. Skilled agents are "narrow AI" experts.
- A **Bug Finder** doesn't need to know how to design UI; it needs to know how to read logs, run tests, and grep code.
- A **Code Reviewer** needs to know how to read diffs and adhere to style guides.

## Examples of Skilled Agents

### 1. The Bug Hunter
- **Goal**: Find the root cause of a provided error trace.
- **Skills**:
    - `grep_search`: To find error strings.
    - `run_test`: To reproduce the bug.
    - `read_logs`: To parse output.
- **System Prompt**: "You are a debugging expert. Do not attempt to fix code until you have reproduced the issue. Focus on reading logs and tracing execution flow..."

### 2. The Code Reviewer
- **Goal**: Review a set of changes against best practices.
- **Skills**:
    - `git_diff`: To see changes.
    - `lint_check`: To run linters.
- **System Prompt**: "You are a senior engineer. Look for security vulnerabilities, performance issues, and style violations. Be constructive."

### 3. The QA Engineer
- **Goal**: Write tests for existing code.
- **Skills**:
    - `read_file`: To understand implementation.
    - `write_file`: To create test files.
    - `run_test_suite`: To verify tests pass.

## Agent Skills Hooks

Maestro uses a system of **Hooks** to determine *which* skills and *which* prompts are loaded for a given task.
Conceptually, a Hook is a "Configuration Injector" that intercepts the session start process.

### Types of Hooks
1.  **`on_task_type`**: Analyzes the task description/tags to select an agent.
2.  **`on_file_pattern`**: If the task involves `.sql` files, inject `database-skill`.
3.  **`on_failure`**: If a task fails X times, swap the agent for a "Debugger Agent".

### Configuration Example (`maestro.config.json`)

The user (or the system) defines these hooks in a configuration file:

```json
{
  "hooks": [
    {
      "name": "Frontend Expert Hook",
      "condition": {
        "file_patterns": ["**/*.tsx", "**/*.css"],
        "task_keywords": ["ui", "css", "component"]
      },
      "inject": {
        "agent_profile": "frontend-dev",
        "skills": ["browser-preview-skill", "css-linter-skill"],
        "env": { "HEADLESS": "false" }
      }
    },
    {
      "name": "Database Migration Hook",
      "condition": {
        "file_patterns": ["**/prisma/schema.prisma", "**/*.sql"]
      },
      "inject": {
        "agent_profile": "db-architect",
        "skills": ["database-client-skill"],
        "system_prompt_append": "Be extremely careful with DROP TABLE commands."
      }
    }
  ],
  "agents": {
    "frontend-dev": {
      "model": "claude-3-5-sonnet",
      "temperature": 0.5,
      "system_prompt_path": "./agents/frontend_prompt.md"
    },
    "db-architect": {
      "model": "claude-3-opus",
      "temperature": 0.1,
      "system_prompt_path": "./agents/db_prompt.md"
    }
  }
}
```

## Example: Code Reviewer Agent Flow
1.  **User Trigger**: "Review PR #123"
2.  **Hook Logic**: Matches `Review` keyword.
3.  **Injection**:
    - Loads `code-reviewer` profile.
    - Loads `github-skill`.
4.  **Execution**:
    - Agent starts.
    - Uses `github_get_pr` tool.
    - Reads diffs.
    - Uses `github_comment` tool to post feedback.

## The Future: Multi-Agent Swarms
Maestro Orchestrator can compose these skilled agents.
*Plan*: "1. `Feature Implementer` writes code. 2. `QA Engineer` writes tests. 3. `Code Reviewer` checks it."
This pipeline of Skilled Agents creates a robust software factory.
