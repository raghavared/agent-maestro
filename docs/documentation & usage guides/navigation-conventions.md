# Navigation Conventions

> Rules for breadcrumbs, cross-links, and next-steps links across all Maestro documentation.

---

## Breadcrumbs

### Every Page Has Breadcrumbs

Place breadcrumbs at the top of every page, immediately after the frontmatter.

```markdown
[Docs](/) > [Section](/docs/section) > [Page Title]
```

### Breadcrumb Format

- Use `>` as the separator
- Each segment is a link except the current page
- The current page (last segment) is plain text, not a link
- Match the directory structure exactly

### Examples by Section

```markdown
<!-- Concept page -->
[Docs](/) > [Concepts](/docs/concepts) > Sessions

<!-- Workflow guide -->
[Docs](/) > [Guides](/docs/guides) > Set Up a Multi-Agent Team

<!-- CLI command reference -->
[Docs](/) > [Reference](/docs/reference) > [Commands](/docs/reference/commands) > `maestro session spawn`

<!-- Troubleshooting page -->
[Docs](/) > [Troubleshooting](/docs/troubleshooting) > Session Errors

<!-- Nested concept page -->
[Docs](/) > [Concepts](/docs/concepts) > [Agent Modes](/docs/concepts/agent-modes) > Coordinator Mode
```

### Breadcrumb Depth

- Maximum depth: 4 levels
- If a page requires more than 4 levels, restructure the information architecture

---

## Next Steps

### Every Page Ends with Next Steps

Place a "Next Steps" section at the bottom of every page, before any footer.

```markdown
## Next Steps

- [Action phrase](/docs/path) — One-sentence description of what the reader learns or does
- [Action phrase](/docs/path) — One-sentence description
- [Action phrase](/docs/path) — One-sentence description
```

### Next Steps Rules

| Rule | Example |
|------|---------|
| Use 2–4 links per page | Three links is ideal |
| Start each link text with an action verb | "Create a team," "Learn about sessions" |
| Add a description after the em dash | Helps the reader decide which link to follow |
| Order by most likely next action | Put the most common next step first |
| Link to different page types | Mix concepts, guides, and references |

### Next Steps by Page Type

**Concept pages** link to:
1. The workflow guide that uses this concept
2. The next concept in the learning path
3. The CLI command reference for this concept

**Workflow guides** link to:
1. A follow-up or advanced workflow guide
2. A related workflow for a different use case
3. The concept pages for key terms used

**CLI command reference pages** link to:
1. The workflow guide where this command appears
2. Related commands
3. The concept page for the entity this command manages

**Troubleshooting pages** link to:
1. The concept page for the topic
2. The workflow guide for the correct process
3. The CLI command reference for relevant commands

---

## Cross-Linking Rules

### Bidirectional Linking

Every link between two pages goes both ways.

```
Concept: Sessions ←→ Guide: Spawn Your First Session
Concept: Sessions ←→ Reference: maestro session spawn
Guide: Spawn a Session ←→ Reference: maestro session spawn
```

If page A links to page B, page B must link back to page A.

### Mandatory Cross-Links

| From | To | How |
|------|----|-----|
| Concept page | Workflow guide that uses it | "Next Steps" section |
| Concept page | CLI commands for that concept | "Next Steps" or inline links |
| Workflow guide | All concepts it uses | "Concepts Used" section |
| Workflow guide | CLI commands it calls | Inline links in steps |
| CLI reference | Workflow guides that use it | "Used In" section |
| CLI reference | Related CLI commands | "Related Commands" table |
| Troubleshooting | Relevant concept pages | "Related Pages" section |
| Troubleshooting | Relevant workflow guides | "Related Pages" section |

### Inline Linking

Link Maestro terms to their concept pages on first mention within each page.

```markdown
<!-- First mention on this page — link it -->
Create a [session](/docs/concepts/sessions) for each task.

<!-- Subsequent mentions on the same page — no link needed -->
The session starts in `spawning` status.
```

### Link Format

- Use relative paths: `/docs/concepts/sessions`
- Use descriptive link text: `[sessions](/docs/concepts/sessions)` not `[click here](/docs/concepts/sessions)`
- Never use bare URLs in prose

---

## No Orphan Pages

### Every Page Is Reachable

Every documentation page must be linked from at least two other pages:

1. A navigation index page (section landing page or sidebar)
2. At least one content page (via cross-link or next-steps)

### Orphan Page Audit

Check for orphan pages by verifying each file in the docs directory appears as a link target in at least two other files.

```bash
# Find all .md files in docs
find docs/ -name "*.md" | while read file; do
  basename=$(basename "$file" .md)
  count=$(grep -rl "$basename" docs/ | grep -v "$file" | wc -l)
  if [ "$count" -lt 2 ]; then
    echo "WARNING: $file has only $count inbound links"
  fi
done
```

---

## Section Landing Pages

### Each Section Has an Index

Every top-level section has a landing page that lists and describes all pages in that section.

```markdown
# Concepts

Understand the building blocks of Maestro.

| Concept | Description |
|---------|-------------|
| [Projects](/docs/concepts/projects) | Group related tasks and sessions |
| [Tasks](/docs/concepts/tasks) | Units of work assigned to sessions |
| [Sessions](/docs/concepts/sessions) | Running AI agent instances |
| [Agent Modes](/docs/concepts/agent-modes) | Four modes: worker, coordinator, and variants |
| [Team Members](/docs/concepts/team-members) | Agent profiles with roles and permissions |
| [Skills](/docs/concepts/skills) | Reusable instruction sets for agents |
```

### Section Order

Order documentation sections in this sequence:

1. **Getting Started** — Installation, first project, quick start
2. **Concepts** — Core ideas and data models
3. **Guides** — Step-by-step workflows
4. **Reference** — CLI commands, API endpoints, data models
5. **Troubleshooting** — Common problems and solutions

This matches the reader's journey: learn → understand → do → look up → fix.

---

## Link Verification Checklist

Before publishing any documentation page, verify:

- [ ] Breadcrumbs present and all segments link correctly
- [ ] "Next Steps" section has 2–4 links
- [ ] Every Maestro term linked on first use
- [ ] All cross-links are bidirectional
- [ ] No orphan pages introduced
- [ ] All link paths resolve to existing files
- [ ] Link text is descriptive (no "click here")
- [ ] Section landing page updated if a new page was added
