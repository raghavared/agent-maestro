# Open Source Contribution Workflow

> **Level:** Advanced (Meta) | **Time:** 30 minutes | **Sessions:** 1 coordinator + workers

Use custom skills, hooks, and queue mode to build an automated open-source contribution workflow.

---

## What you build

An end-to-end workflow for contributing to an open-source project:

1. Find good first issues on GitHub
2. Set up the development environment
3. Write the fix
4. Run tests and linting
5. Create a pull request

This example shows how to extend Maestro with custom skills and hooks.

## Prerequisites

- Maestro installed (`maestro status` returns a response)
- Completed the [Blog API example](./blog-api.md) (recommended)
- A GitHub account with a personal access token
- A forked open-source repository (e.g., `~/projects/my-fork`)

---

## Step 1: Create custom skills

Skills are markdown instruction files that give agents specialized knowledge. Create two custom skills for this workflow.

### Skill: GitHub issue finder

```bash
mkdir -p ~/projects/my-fork/.claude/skills/github-issues
```

Create the skill file:

```bash
cat > ~/projects/my-fork/.claude/skills/github-issues/SKILL.md << 'SKILL'
# GitHub Issue Finder

You have expertise in finding and evaluating GitHub issues for contribution.

## Instructions

When asked to find issues:

1. Use `gh issue list` to find open issues with the "good first issue" label
2. Filter by issues that have no assignee
3. For each candidate issue, check:
   - Is the issue clearly described?
   - Does it have reproduction steps?
   - Is it scoped enough for a single PR?
4. Return the top 3 candidates with:
   - Issue number and title
   - Why it's a good choice
   - Estimated complexity (low/medium/high)

## Commands to use

```bash
# List good first issues
gh issue list --label "good first issue" --state open --assignee ""

# Get issue details
gh issue view <number>

# Check if issue has linked PRs
gh issue view <number> --json comments,title,body
```
SKILL
```

### Skill: PR creator

```bash
mkdir -p ~/projects/my-fork/.claude/skills/pr-creator
```

```bash
cat > ~/projects/my-fork/.claude/skills/pr-creator/SKILL.md << 'SKILL'
# Pull Request Creator

You have expertise in creating high-quality pull requests for open-source projects.

## Instructions

When creating a PR:

1. Read the repository's CONTRIBUTING.md for guidelines
2. Check existing PR templates in .github/
3. Create a descriptive branch name: `fix/<issue-number>-<short-description>`
4. Write a PR description that includes:
   - "Fixes #<issue-number>" to auto-link the issue
   - Summary of changes
   - How to test the changes
   - Screenshots if UI-related
5. Run the project's linter and tests before creating the PR
6. Use `gh pr create` to create the PR

## PR template

```markdown
## Summary

Fixes #<issue-number>

<1-2 sentence description of what changed and why>

## Changes

- <bullet list of specific changes>

## Testing

- [ ] Existing tests pass
- [ ] Added new tests for the fix
- [ ] Manually tested the scenario from the issue

## Notes

<Any additional context for reviewers>
```
SKILL
```

### Verify your skills

```bash
maestro skill list --project-path ~/projects/my-fork
```

```
Skills for ~/projects/my-fork:

  Name            Scope     Path
  github-issues   project   .claude/skills/github-issues/SKILL.md
  pr-creator      project   .claude/skills/pr-creator/SKILL.md
```

---

## Step 2: Create the project and tasks

```bash
maestro project create "OSS Contribution" --working-dir ~/projects/my-fork
export MAESTRO_PROJECT_ID=<project-id>
```

### Create the task structure

```bash
# Parent task
maestro task create "Contribute to open-source project" \
  --desc "Find a good first issue, implement a fix, and submit a pull request to the upstream repository. Follow the project's contribution guidelines." \
  --priority high

# Step 1: Find issues
maestro task create "Find a good first issue" \
  --desc "Search the repository for open issues labeled 'good first issue' with no assignee. Evaluate the top candidates and select one that is clearly described, well-scoped, and achievable in a single PR. Comment on the issue to claim it." \
  --priority high \
  --parent <parent-task-id>

# Step 2: Set up dev environment
maestro task create "Set up development environment" \
  --desc "Read the project's README and CONTRIBUTING.md. Install all dependencies. Run the existing test suite to confirm everything passes on the base branch. Create a new branch named fix/<issue-number>-<short-description>." \
  --priority high \
  --parent <parent-task-id>

# Step 3: Implement the fix
maestro task create "Implement the fix" \
  --desc "Implement the fix for the selected issue. Follow the project's coding style and conventions. Write clean, minimal changes — only modify what is necessary to fix the issue. Add inline comments only where the logic is non-obvious." \
  --priority high \
  --parent <parent-task-id>

# Step 4: Test and lint
maestro task create "Run tests and linting" \
  --desc "Run the project's full test suite and ensure all tests pass. Add new tests that cover the fix (both the happy path and relevant edge cases). Run the project's linter and fix any violations. Verify test coverage has not decreased." \
  --priority high \
  --parent <parent-task-id>

# Step 5: Create PR
maestro task create "Create pull request" \
  --desc "Commit the changes with a clear commit message referencing the issue number. Push the branch to the fork. Create a pull request against the upstream repository's main branch. Include a description that explains the fix, links the issue, and describes how to test." \
  --priority high \
  --parent <parent-task-id>
```

### View the task tree

```bash
maestro task tree
```

```
Contribute to open-source project (task_...parent) [todo] high
├── Find a good first issue (task_...find) [todo] high
├── Set up development environment (task_...setup) [todo] high
├── Implement the fix (task_...fix) [todo] high
├── Run tests and linting (task_...test) [todo] high
└── Create pull request (task_...pr) [todo] high
```

---

## Step 3: Spawn with skills

Spawn sessions with specific skills attached. Skills inject domain knowledge into the agent's prompt.

```bash
# Spawn a coordinator that uses both skills
maestro session spawn \
  --task <parent-task-id> \
  --mode coordinator \
  --skill github-issues \
  --skill pr-creator \
  --name "oss-coordinator"
```

```
Session spawned:
  ID:     sess_1772060100000_coord
  Name:   oss-coordinator
  Mode:   coordinator
  Skills: github-issues, pr-creator
  Status: spawning
```

The coordinator receives both skills in its system prompt. It uses the GitHub issue finder skill to evaluate issues and the PR creator skill when creating the pull request.

### How skills flow to workers

When the coordinator spawns workers for specific tasks, it can pass relevant skills:

```
Coordinator (github-issues + pr-creator)
├── Issue finder worker (github-issues skill)
├── Fix implementation worker (no special skills)
├── Test runner worker (no special skills)
└── PR creator worker (pr-creator skill)
```

---

## Step 4: Monitor the workflow

### Watch issue selection

```bash
maestro task get <find-task-id>
```

```
Task: Find a good first issue
  ID:       task_...find
  Status:   in_progress

  Timeline:
    [3 min ago]  Progress: Found 12 open "good first issue" issues
    [2 min ago]  Progress: Evaluating top candidates...
    [1 min ago]  Progress: Selected issue #247 "Fix timezone handling in date parser"
                 - Clearly described with reproduction steps
                 - Scoped to a single function in src/utils/date.ts
                 - Estimated complexity: low
    [30s ago]    Completed: Claimed issue #247 with a comment
```

### Watch the fix implementation

```bash
maestro session logs <fix-worker-session-id> --follow
```

### Track overall progress

```bash
maestro task children <parent-task-id>
```

```
Subtasks of "Contribute to open-source project":

  Task                              Status        Priority
  Find a good first issue           completed     high
  Set up development environment    completed     high
  Implement the fix                 in_progress   high
  Run tests and linting             todo          high
  Create pull request               todo          high
```

---

## Step 5: Queue mode for batch contributions

Queue mode lets you process multiple contributions sequentially without manual intervention. Create a task list to queue up contribution targets.

### Create a task list

```bash
maestro task-list create --name "Contribution Queue" \
  --desc "Queue of repositories to contribute to"
```

```
Task list created:
  ID:   tl_1772060200000_queue
  Name: Contribution Queue
```

### Add contribution tasks to the queue

```bash
# Contribution 1
maestro task create "Contribute to fastify/fastify" \
  --desc "Find and fix a good first issue in the Fastify web framework repository."

# Contribution 2
maestro task create "Contribute to sindresorhus/got" \
  --desc "Find and fix a good first issue in the Got HTTP client library."

# Contribution 3
maestro task create "Contribute to chalk/chalk" \
  --desc "Find and fix a good first issue in the Chalk terminal styling library."
```

### Add tasks to the queue

```bash
maestro task-list reorder tl_1772060200000_queue \
  --tasks <fastify-task-id>,<got-task-id>,<chalk-task-id>
```

### Process the queue

Spawn a coordinator that processes tasks from the list sequentially.

```bash
maestro session spawn \
  --tasks <fastify-task-id>,<got-task-id>,<chalk-task-id> \
  --mode coordinator \
  --skill github-issues \
  --skill pr-creator \
  --name "oss-queue-processor"
```

The coordinator picks up the first task, completes it, then moves to the next. Each contribution follows the same workflow: find issue, set up, fix, test, PR.

```bash
maestro task-list get tl_1772060200000_queue
```

```
Task List: Contribution Queue

  #  Task                                Status
  1  Contribute to fastify/fastify       completed
  2  Contribute to sindresorhus/got      in_progress
  3  Contribute to chalk/chalk           todo
```

---

## Step 6: Review results

### View all completed contributions

```bash
maestro task list --status completed
```

```
Completed tasks:

  Task                                          Completed
  Contribute to open-source project             5 min ago
  ├── Find a good first issue                   25 min ago
  ├── Set up development environment            20 min ago
  ├── Implement the fix                         12 min ago
  ├── Run tests and linting                     8 min ago
  └── Create pull request                       5 min ago
```

### Check the PR

```bash
gh pr list --author @me
```

```
Showing 1 of 1 pull request

#312  Fix timezone handling in date parser  fix/247-timezone-date-parser  OPEN
```

```bash
gh pr view 312
```

```
Fix timezone handling in date parser #312
Open • you wants to merge 1 commit into main from fix/247-timezone-date-parser

  Fixes #247

  Summary:
  Fixed timezone offset calculation in `parseDate()` that caused
  incorrect dates when the system timezone differs from UTC.

  Changes:
  - Updated `src/utils/date.ts` to use UTC methods consistently
  - Added timezone-aware test cases to `tests/utils/date.test.ts`

  Testing:
  - [x] Existing tests pass (247/247)
  - [x] Added 4 new test cases for timezone edge cases
  - [x] Linter passes with no warnings
```

---

## Skills reference

| Skill | Purpose | Used by |
|-------|---------|---------|
| `github-issues` | Find and evaluate "good first issue" labels | Issue finder worker |
| `pr-creator` | Create well-formatted PRs following project guidelines | PR creator worker |

### How skills work

```
.claude/skills/
├── github-issues/
│   └── SKILL.md        ← Injected into agent's system prompt
└── pr-creator/
    └── SKILL.md        ← Injected into agent's system prompt
```

Skills are markdown files that Maestro injects into the agent's system prompt. They provide domain-specific instructions without modifying the agent tool itself.

Skills can be:
- **Project-scoped:** `<project>/.claude/skills/<name>/SKILL.md`
- **Global:** `~/.claude/skills/<name>/SKILL.md`

Project-scoped skills override global skills with the same name.

---

## Full command summary

```bash
# 1. Create custom skills
mkdir -p .claude/skills/github-issues
# Write SKILL.md (see Step 1)
mkdir -p .claude/skills/pr-creator
# Write SKILL.md (see Step 1)

# 2. Verify skills
maestro skill list --project-path .

# 3. Create project and tasks
maestro project create "OSS Contribution" --working-dir ~/projects/my-fork
export MAESTRO_PROJECT_ID=<project-id>
maestro task create "Contribute to open-source project" --priority high
maestro task create "Find a good first issue" --parent <parent-id> --priority high
maestro task create "Set up development environment" --parent <parent-id> --priority high
maestro task create "Implement the fix" --parent <parent-id> --priority high
maestro task create "Run tests and linting" --parent <parent-id> --priority high
maestro task create "Create pull request" --parent <parent-id> --priority high

# 4. Spawn with skills
maestro session spawn \
  --task <parent-id> \
  --mode coordinator \
  --skill github-issues \
  --skill pr-creator \
  --name "oss-coordinator"

# 5. Monitor
maestro task tree
maestro session logs <session-id> --follow

# 6. Queue mode (batch contributions)
maestro task-list create --name "Contribution Queue"
maestro task create "Contribute to <repo>" --desc "..."
maestro session spawn --tasks <task-ids> --mode coordinator \
  --skill github-issues --skill pr-creator --name "oss-queue-processor"
```

---

## What you learned

- **Custom skills** extend agents with domain-specific knowledge via markdown files
- **Skill scoping** lets you define project-level or global skills
- **Skill injection** passes skills to sessions at spawn time with `--skill`
- **Task lists** organize tasks into ordered queues for sequential processing
- **Queue mode** processes multiple similar tasks one after another
- **End-to-end automation** chains multiple steps (find, setup, fix, test, PR) into a single workflow

## Next steps

- [Skills Guide](/docs/guides/skills) — Deep dive into creating and managing skills
- [CLI Reference](/docs/reference/cli) — Full command reference for all Maestro commands
- [Blog API Example](./blog-api.md) — Start with the basics if you haven't already
