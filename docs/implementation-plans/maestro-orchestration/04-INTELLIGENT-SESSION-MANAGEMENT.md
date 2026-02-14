# Intelligent Session Management

**Advanced Optimization:** Reusing active sessions to reduce latency and context switching costs.

---

## The Problem: Context Waste

Naive orchestration spawns a new session for every task group.
*   **Cost:** Claude Code must re-index/re-read files.
*   **Latency:** Startup time for new sessions.
*   **Loss:** "Mental model" of the codebase is lost between sessions.

## The Solution: Smart Reuse

We implement a **Session Matching Algorithm** to reuse sessions that already have the relevant context loaded.

### Session Fingerprinting

We track a `SessionContext` for every active terminal:

```typescript
type SessionContext = {
  sessionId: string;
  context: {
    filesAccessed: Set<string>;
    directories: Set<string>;
    technologies: Set<string>; // e.g., "React", "Python"
  };
  lastActivity: number;
  currentLoad: number;
};
```

### Matching Algorithm

When a new Group needs execution, we score existing sessions:

1.  **Directory Overlap (30%)**: Are we working in the same folders?
2.  **File Overlap (25%)**: Do we need the same specific files?
3.  **Tech Stack (20%)**: Is the session already "primed" for this language?
4.  **Freshness (15%)**: Is the session active recently?
5.  **Load (10%)**: Is the session free?

**Threshold:** If Score > 0.6 (60%), **REUSE** the session. Otherwise, **SPAWN** new.

### Performance Impact

| Metric | Naive Approach | Intelligent Reuse |
|--------|----------------|-------------------|
| Startup Time | High (New process) | Instant |
| Context | Cold | Warm |
| Speed | Baseline | **+40-60% Faster** |
| Resource | High RAM/CPU | Optimized |

---

## Context Chaining

Even when sessions cannot be reused (e.g., parallel execution), we must preserve the **learning** from previous steps.

**The Problem:**
Session A discovers that `User.ts` has a specific validation logic. Session B starts fresh and has to "rediscover" this, wasting tokens and time.

**The Solution: Context Chaining**
Pass a **Context Summary** from the output of one session into the input of the next.

### Mechanism

1.  **Extraction:** When a Worker Session finishes, it runs a final `maestro summarize` step (internal prompt) to produce a `ContextArtifact`.
2.  **Propagation:** The Orchestrator grabs this artifact.
3.  **Injection:** The artifact is injected into the **Prompt** of dependent future sessions.

### Context Artifact Schema

```typescript
type ContextArtifact = {
  sourceSessionId: string;
  timestamp: number;
  knowledge: {
    keyDecisions: string[];      // "Decided to use Zod for validation"
    modifiedFiles: string[];     // ["src/models/User.ts"]
    newPatterns: string[];       // "All APIs now require x-api-key header"
    potentialGotchas: string[];  // "Watch out for circular dependency in Auth"
  };
};
```

### Prompt Injection

When spawning Session B (which depends on Session A):

```markdown
# Context from Previous Steps
The following context was learned from the "Database Setup" session:

- **Key Decision:** Used Zod for schema validation.
- **Modified:** src/models/User.ts, src/db/schema.sql
- **Note:** The DB migration requires root access, which has been mocked.

*Use this knowledge to maintain consistency.*
```


1.  **Persistence:** Store `SessionContext` in the Agent Maestro state/local storage.
2.  **Hooks:** Use `on-tool-use` hooks to update `filesAccessed` and `directories` in real-time.
3.  **Cleanup:** Auto-kill sessions idle for >30 minutes to free resources.
