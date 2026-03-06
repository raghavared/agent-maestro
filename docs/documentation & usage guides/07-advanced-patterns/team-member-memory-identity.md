# Team Member Memory & Identity

**Memory gives agents persistent knowledge that survives across sessions. Identity gives them a custom persona and instructions. Together, they let you create specialized agents that remember project context and behave consistently.**

---

## Memory System

Memory is an array of plain-text entries stored on each team member. When a session spawns with that team member, all memory entries are injected into the agent's system prompt.

### Commands

```bash
# Add a memory entry
maestro team-member memory append <team-member-id> --entry "This project uses PostgreSQL 15"

# List all memory entries
maestro team-member memory list <team-member-id>

# Clear all memory
maestro team-member memory clear <team-member-id>
```

### How Memory Persists

Memory is stored on the `TeamMember` record in Maestro's data store:

```typescript
interface TeamMember {
  memory?: string[];    // Array of persistent entries
  // ...other fields
}
```

When you append an entry:
1. Maestro fetches the current memory array
2. Appends the new entry
3. Saves the updated team member

When a session spawns:
1. Manifest generation reads the team member's current memory
2. Entries are included in `teamMemberMemory` in the manifest
3. The prompt builder injects them as XML in the system prompt:

```xml
<memory>
  <entry>This project uses PostgreSQL 15</entry>
  <entry>Run tests with: bun test</entry>
  <entry>The API follows REST conventions with /api/v1/ prefix</entry>
</memory>
```

The agent sees these entries at the start of every session, giving it persistent context without re-explanation.

### Memory Use Cases

**Project conventions:**
```bash
maestro team-member memory append <id> --entry "Always use bun instead of npm"
maestro team-member memory append <id> --entry "Database migrations are in src/db/migrations/"
maestro team-member memory append <id> --entry "This project uses Tailwind CSS, not styled-components"
```

**Learned context:**
```bash
maestro team-member memory append <id> --entry "The auth module was refactored on Jan 10 — tokens are now stored in Redis, not cookies"
maestro team-member memory append <id> --entry "The /api/users endpoint is rate-limited to 100 req/min"
```

**Debugging notes:**
```bash
maestro team-member memory append <id> --entry "Known issue: tests fail on macOS if Docker isn't running"
maestro team-member memory append <id> --entry "The CI pipeline runs in Node 20, not Node 18"
```

### Multi-Identity Memory

When a session has multiple team member profiles (multi-identity), memory from all profiles is merged with source attribution:

```xml
<memory>
  <entry source="Backend Dev">This project uses Express 5</entry>
  <entry source="Frontend Dev">Components follow atomic design pattern</entry>
</memory>
```

This lets the agent know which identity contributed each piece of context.

### Memory Visibility

| Who | Can See |
|-----|---------|
| The agent itself | All its own memory entries |
| Coordinators | Memory of all team members (via team context) |
| Other workers | Cannot see each other's memory |

Coordinators see team member memory in the `full_expertise` lens, which helps them make informed delegation decisions.

---

## Identity System

Identity is a free-text field on a team member that acts as a custom system prompt. It defines who the agent is, how it should behave, and what it specializes in.

### Default Identity

When you create a team member without specifying identity:

```bash
maestro team-member create "Alice" --role "Backend Engineer"
```

Maestro generates a default: `"You are Alice. Backend Engineer."`

### Custom Identity

Set identity at creation:

```bash
maestro team-member create "Security Auditor" \
  --role "Security Engineer" \
  --identity "You are a security engineer specializing in web application security. Review code for OWASP Top 10 vulnerabilities. When you find issues, explain the risk, show the vulnerable code, and provide a fix. Never approve code with SQL injection, XSS, or authentication bypasses."
```

Or update it later:

```bash
maestro team-member update-identity <team-member-id> \
  --identity "You are a senior backend architect. Focus on system design, API contracts, and performance. Always consider scalability implications."
```

Or via edit:

```bash
maestro team-member edit <team-member-id> --identity "New identity text..."
```

### How Identity Is Injected

Identity appears in the `<identity_kernel>` section of the system prompt:

```xml
<identity_kernel>
  <self_identity>
    <id>tm-123</id>
    <name>Security Auditor</name>
    <role>Security Engineer</role>
    <avatar>🔒</avatar>
    <identity>You are a security engineer specializing in web application security...</identity>
    <memory>
      <entry>This project handles PII data — extra scrutiny required</entry>
    </memory>
  </self_identity>
</identity_kernel>
```

The agent reads this as its core instructions, shaping every response.

---

## Creating Specialized Agents

Combine identity + memory + skills to build purpose-built agents.

### Testing Agent

```bash
# Create the agent
maestro team-member create "Test Runner" \
  --role "QA Engineer" \
  --avatar "🧪" \
  --identity "You are a QA engineer. Your primary tool is the test suite. For every task:
1. Read the requirements and acceptance criteria
2. Write tests FIRST (TDD approach)
3. Run tests to verify they fail
4. Implement the minimum code to make tests pass
5. Refactor if needed
6. Run the full test suite before reporting completion
Never mark a task complete if any test is failing."

# Add project-specific knowledge
maestro team-member memory append <id> --entry "Test framework: vitest"
maestro team-member memory append <id> --entry "Run tests: bun run test"
maestro team-member memory append <id> --entry "E2E tests: bun run test:e2e (requires dev server running)"
maestro team-member memory append <id> --entry "Coverage threshold: 80% for all new code"
```

### Documentation Agent

```bash
maestro team-member create "Doc Writer" \
  --role "Documentation Engineer" \
  --avatar "📝" \
  --identity "You are a documentation engineer. Read source code carefully, understand the architecture, and write clear, accurate documentation. Follow these rules:
- Use the existing docs style in the docs/ directory
- Include code examples for every public API
- Explain WHY, not just WHAT
- Keep paragraphs short
- Use tables for structured data
- Never invent features — only document what exists in the code" \
  --skill-ids "code-visualizer"

maestro team-member memory append <id> --entry "Docs live in docs/ directory, markdown format"
maestro team-member memory append <id> --entry "API docs use OpenAPI spec in openapi.yaml"
```

### Code Review Agent

```bash
maestro team-member create "Reviewer" \
  --role "Senior Code Reviewer" \
  --avatar "🔍" \
  --identity "You are a senior code reviewer. Review changes for:
- Correctness: Does the code do what it claims?
- Security: Any injection, auth bypass, or data leak risks?
- Performance: Any O(n²) loops, missing indexes, or unnecessary allocations?
- Maintainability: Is the code readable? Are names clear?
- Tests: Are edge cases covered?
Report issues with exact file paths and line numbers. Suggest fixes, don't just complain." \
  --permission-mode readOnly

maestro team-member memory append <id> --entry "Style guide: https://github.com/org/styleguide"
maestro team-member memory append <id> --entry "Banned patterns: no any types, no console.log in production code"
```

### Database Migration Agent

```bash
maestro team-member create "DB Engineer" \
  --role "Database Engineer" \
  --avatar "🗄️" \
  --identity "You are a database engineer. Specialize in PostgreSQL migrations, query optimization, and schema design. Always:
- Write reversible migrations (up + down)
- Check for index coverage on new queries
- Consider data volume implications
- Test migrations against a copy of production data structure" \
  --model opus

maestro team-member memory append <id> --entry "Database: PostgreSQL 15"
maestro team-member memory append <id> --entry "ORM: Drizzle ORM"
maestro team-member memory append <id> --entry "Migration tool: drizzle-kit"
maestro team-member memory append <id> --entry "Production has ~2M users, ~50M records in events table"
```

## Best Practices

- **Keep memory entries atomic.** One fact per entry. Easy to add, easy to remove.
- **Use identity for behavior, memory for facts.** Identity says *how* to act. Memory says *what to know*.
- **Don't overcrowd identity.** A focused identity (3-5 sentences) is better than a wall of text. Use memory for the details.
- **Clear stale memory.** Run `memory list` periodically and remove outdated entries with `memory clear` followed by re-adding current entries.
- **Combine with skills.** Skills provide reusable methodology; identity provides persona; memory provides project context. All three together create a highly specialized agent.
