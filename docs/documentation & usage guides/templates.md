# Page Templates

> Use these templates for every new documentation page. Copy the relevant template and fill in the sections.

---

## Concept Page Template

Use this template to explain a Maestro concept (sessions, tasks, projects, team members, etc.).

````markdown
---
title: [Concept Name]
category: concepts
---

<!-- Breadcrumbs -->
[Docs](/) > [Concepts](/docs/concepts) > [Concept Name]

# [Concept Name]

<!-- One-sentence definition -->
A [concept] is [clear, concise definition in one sentence].

## Why It Matters

<!-- 2-3 sentences explaining when and why the reader needs this concept -->
[Explain the problem this concept solves.]
[Explain how it fits into the Maestro workflow.]
[Optional: contrast with alternative approaches.]

## Quick Example

<!-- Minimal, runnable example that demonstrates the concept -->
```bash
maestro [command] [minimal-args]
```

```
[Expected output]
```

## How It Works

<!-- Detailed explanation, broken into subsections as needed -->

### [Subtopic A]

[Explanation. Keep sentences under 20 words.]

```bash
[Example command]
```

```
[Output]
```

### [Subtopic B]

[Explanation with code example.]

## Data Model

<!-- Show the relevant TypeScript interface if applicable -->
```typescript
interface ConceptName {
  id: string;
  // key fields only — link to full reference for complete model
}
```

> **Note:** See the [full data model reference](/docs/reference/data-models) for all fields.

## Advanced Usage

<!-- Optional: power-user features, edge cases, advanced flags -->

<details>
<summary>Advanced: [topic]</summary>

[Advanced content with code examples.]

</details>

## Related Concepts

- [Related Concept A](/docs/concepts/related-a) — [one-line description]
- [Related Concept B](/docs/concepts/related-b) — [one-line description]

## Next Steps

- [Do X with this concept](/docs/guides/workflow-using-concept) — Step-by-step workflow guide
- [Learn about Y](/docs/concepts/next-concept) — The next concept in the learning path
- [Command reference](/docs/reference/commands/relevant-command) — Full CLI reference
````

---

## Workflow Guide Template

Use this template for step-by-step guides that walk the reader through a complete workflow.

````markdown
---
title: [Action Title — e.g., "Set Up a Multi-Agent Team"]
category: guides
---

<!-- Breadcrumbs -->
[Docs](/) > [Guides](/docs/guides) > [Guide Title]

# [Action Title]

<!-- Scenario: what the reader wants to accomplish -->
You want to [describe the goal in one sentence].

## Prerequisites

Before you start, make sure you have:

- [Prerequisite 1 — e.g., Maestro installed and running]
- [Prerequisite 2 — e.g., a project created]
- [Prerequisite 3 — link to setup guide if needed]

## Steps

### Step 1: [Action verb + what]

[1-2 sentences explaining what this step does and why.]

```bash
maestro [command]
```

```
[Expected output]
```

### Step 2: [Action verb + what]

[1-2 sentences explaining what this step does.]

```bash
maestro [command]
```

```
[Expected output]
```

### Step 3: [Action verb + what]

[1-2 sentences explaining what this step does.]

```bash
maestro [command]
```

```
[Expected output]
```

> **Tip:** [Optional helpful tip relevant to this step.]

## What Happens Behind the Scenes

<!-- Explain the internal flow so the reader builds a mental model -->

1. [First thing Maestro does internally]
2. [Second thing]
3. [Third thing]

> **Note:** You don't need to manage this manually. Maestro handles it for you.

## Verify It Worked

<!-- Give the reader a way to confirm success -->

Run this command to confirm:

```bash
maestro [verification-command]
```

You see:

```
[Expected verification output]
```

## Troubleshooting

<!-- Common issues specific to this workflow -->

| Problem | Cause | Solution |
|---------|-------|----------|
| [Error message or symptom] | [Root cause] | [Fix with command] |
| [Error message or symptom] | [Root cause] | [Fix with command] |

## Concepts Used

- [Concept A](/docs/concepts/concept-a) — [one-line description of its role in this workflow]
- [Concept B](/docs/concepts/concept-b) — [one-line description]

## Next Steps

- [Follow-up workflow](/docs/guides/next-guide) — What to do after completing this guide
- [Advanced version](/docs/guides/advanced-guide) — Extend this workflow with more options
- [Related workflow](/docs/guides/related-guide) — A similar workflow for a different use case
````

---

## CLI Command Reference Template

Use this template for individual CLI command documentation.

````markdown
---
title: maestro [command] [subcommand]
category: reference
---

<!-- Breadcrumbs -->
[Docs](/) > [Reference](/docs/reference) > [Commands](/docs/reference/commands) > `maestro [command] [subcommand]`

# `maestro [command] [subcommand]`

<!-- One-line description -->
[What this command does in one sentence.]

## Syntax

```bash
maestro [command] [subcommand] [arguments] [flags]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<arg1>` | Yes | [What this argument represents] |
| `[arg2]` | No | [What this optional argument represents. Default: `value`.] |

## Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--flag-name` | `-f` | [What this flag does] | `default` |
| `--json` | | Output as JSON | `false` |

## Examples

### Basic usage

```bash
maestro [command] [subcommand] [example-args]
```

```
[Expected output]
```

### With flags

```bash
maestro [command] [subcommand] [example-args] --flag value
```

```
[Expected output]
```

### JSON output

```bash
maestro [command] [subcommand] [example-args] --json
```

```json
{
  "key": "value"
}
```

## Behavior

<!-- Explain any non-obvious behavior, edge cases, or side effects -->

- [Behavior note 1]
- [Behavior note 2]

> **Warning:** [Any destructive or irreversible behavior the reader should know about.]

## Related Commands

| Command | Description |
|---------|-------------|
| [`maestro related-cmd`](/docs/reference/commands/related-cmd) | [What it does] |
| [`maestro other-cmd`](/docs/reference/commands/other-cmd) | [What it does] |

## Used In

- [Workflow guide A](/docs/guides/guide-a) — [Context for how this command is used]
- [Workflow guide B](/docs/guides/guide-b) — [Context]
````

---

## Troubleshooting Page Template

Use this template for troubleshooting entries. Group related issues on a single page.

````markdown
---
title: Troubleshooting [Topic]
category: troubleshooting
---

<!-- Breadcrumbs -->
[Docs](/) > [Troubleshooting](/docs/troubleshooting) > [Topic]

# Troubleshooting [Topic]

---

## [Problem statement as the reader would describe it]

**Symptom:** [What the reader sees — error message, unexpected behavior, or missing output.]

```
[Exact error message or terminal output if applicable]
```

**Cause:** [Why this happens in 1-2 sentences.]

**Solution:**

[Step-by-step fix.]

```bash
[Fix command]
```

```
[Expected output after fix]
```

**Prevention:** [How to avoid this in the future, in 1 sentence.]

---

## [Next problem statement]

**Symptom:** [What the reader sees.]

```
[Error output]
```

**Cause:** [Why this happens.]

**Solution:**

```bash
[Fix command]
```

**Prevention:** [How to avoid this.]

---

## Still Stuck?

If none of these solutions work:

1. Run `maestro debug-prompt --raw` and check the output for errors
2. Check server logs: `maestro session logs <session-id> --tail 50`
3. [File an issue](https://github.com/subhangR/agent-maestro/issues) with the output from step 1

## Related Pages

- [Concept page](/docs/concepts/relevant-concept) — Understand how [topic] works
- [Workflow guide](/docs/guides/relevant-guide) — Step-by-step guide for [topic]
- [Command reference](/docs/reference/commands/relevant-cmd) — Full command documentation
````

---

## Template Usage Rules

1. **Never skip sections.** If a section doesn't apply, remove it entirely. Do not leave empty sections.
2. **Keep the section order.** Readers expect consistent page structure. Do not rearrange sections.
3. **Fill every code block.** Every code block shows a real, runnable command and its output.
4. **Link bidirectionally.** Every concept page links to workflow guides. Every workflow guide links back to concept pages.
5. **One topic per page.** If a page covers two distinct concepts, split it into two pages.
