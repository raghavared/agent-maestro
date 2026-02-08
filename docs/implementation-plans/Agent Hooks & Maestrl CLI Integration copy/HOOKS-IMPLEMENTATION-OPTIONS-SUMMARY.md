# Hooks Implementation Options - Quick Decision Guide

**For:** Maestro Orchestration System
**Date:** 2026-02-01

---

## Quick Comparison Matrix

| Feature | Option 1: Webhook | Option 2: File-Based | Option 3: Hybrid | Option 4: Session-Specific | Option 5: Skill-Embedded |
|---------|------------------|---------------------|-----------------|---------------------------|-------------------------|
| **Complexity** | Low | Medium | High | High | Low |
| **Real-time Updates** | ✅ Excellent | ⚠️ Delayed | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **Offline Support** | ❌ Requires server | ✅ Yes | ✅ Yes | ❌ Requires server | ❌ Requires server |
| **Persistence** | ⚠️ Optional | ✅ Built-in | ✅ Built-in | ⚠️ Optional | ⚠️ Optional |
| **Setup Time** | 4-6 hours | 6-8 hours | 10-14 hours | 8-12 hours | 2-4 hours |
| **Scalability** | ✅ Excellent | ⚠️ File I/O limits | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **Debugging** | ✅ Easy | ⚠️ Medium | ❌ Complex | ⚠️ Medium | ✅ Easy |
| **Multi-session** | ✅ Perfect | ✅ Good | ✅ Perfect | ✅ Perfect | ⚠️ Limited |
| **Best For** | Production | Development | High-reliability | Advanced use cases | Portable skills |

---

## Decision Tree

```
START: What's your primary goal?

├─ "I want real-time UI updates"
│  └─ Option 1: Centralized Webhook ⭐ RECOMMENDED
│
├─ "I need offline/air-gapped support"
│  └─ Option 2: File-Based
│
├─ "I need both real-time AND guaranteed persistence"
│  └─ Option 3: Hybrid (Webhook + File)
│
├─ "I have diverse task types needing different hooks"
│  └─ Option 4: Session-Specific Scripts
│
└─ "I want portable, reusable skills"
   └─ Option 5: Skill-Embedded Hooks
```

---

## Recommendation Summary

### For Most Users: Option 1 (Centralized Webhook) ⭐

**Why:**
- Simplest to implement and debug
- Perfect for real-time UI updates
- Works seamlessly with multiple sessions
- Easy to extend with new hooks
- Centralized logging and monitoring

**Trade-offs:**
- Requires Maestro server to be running
- Network dependency (minimal overhead)

**When to choose:**
- You want to ship fast
- Real-time UI is priority
- You're building a production system
- You want comprehensive analytics

---

## Implementation Effort Comparison

### Option 1: Centralized Webhook (4-6 hours)

**Tasks:**
- [ ] Add webhook endpoint (1 hour)
- [ ] Write 4 core hook scripts (1.5 hours)
- [ ] Configure .claude/settings.json (0.5 hours)
- [ ] Update WebSocket handlers (1 hour)
- [ ] Create UI components (1 hour)

**Total:** ~5 hours

---

### Option 2: File-Based (6-8 hours)

**Tasks:**
- [ ] Add webhook endpoint (1 hour)
- [ ] Write hook scripts with file output (2 hours)
- [ ] Implement file watcher (2 hours)
- [ ] Handle file cleanup (1 hour)
- [ ] Update UI components (1 hour)

**Total:** ~7 hours

---

### Option 3: Hybrid (10-14 hours)

**Tasks:**
- [ ] Implement Option 1 (5 hours)
- [ ] Implement Option 2 (7 hours)
- [ ] Integration logic (2 hours)

**Total:** ~12 hours

---

### Option 4: Session-Specific (8-12 hours)

**Tasks:**
- [ ] Add webhook endpoint (1 hour)
- [ ] Implement dynamic script generation (3 hours)
- [ ] Update session spawning logic (2 hours)
- [ ] Script cleanup/management (1 hour)
- [ ] Testing multiple session types (2 hours)

**Total:** ~10 hours

---

### Option 5: Skill-Embedded (2-4 hours)

**Tasks:**
- [ ] Add webhook endpoint (1 hour)
- [ ] Update skill definitions (1 hour)
- [ ] Update skill loader (1 hour)

**Total:** ~3 hours

**Note:** Limited to skill-specific hooks only

---

## Detailed Option Analysis

### Option 1: Centralized Webhook ⭐ RECOMMENDED

#### Architecture
```
Claude Session → Hook Script → curl POST → Maestro Server → WebSocket → UI
```

#### Pros
✅ **Simple**: One endpoint handles all hooks
✅ **Real-time**: Instant UI updates via WebSocket
✅ **Scalable**: Handles many concurrent sessions
✅ **Observable**: Easy to debug with server logs
✅ **Extensible**: Add new hooks without changing architecture

#### Cons
❌ **Network dependency**: Requires server running
❌ **Latency**: Small network overhead (~5-10ms)
❌ **Persistence**: Logs not persisted by default (needs addition)

#### Best For
- Production deployments
- Real-time dashboards
- Multi-session orchestration
- Analytics and monitoring

#### Code Example
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "curl -X POST http://localhost:3000/api/webhooks/hook-event -H 'Content-Type: application/json' -d @- 2>/dev/null",
            "async": true
          }
        ]
      }
    ]
  }
}
```

---

### Option 2: File-Based Communication

#### Architecture
```
Claude Session → Hook Script → Write to JSONL file → File Watcher → Maestro Server → WebSocket → UI
```

#### Pros
✅ **Offline**: No network required
✅ **Persistent**: Events stored in files
✅ **Replayable**: Can replay events from logs
✅ **Debuggable**: Inspect files directly

#### Cons
❌ **Delayed**: File watching introduces lag (~100-500ms)
❌ **File I/O**: Overhead on high-frequency hooks
❌ **Cleanup**: Must manage log files
❌ **Race conditions**: Concurrent writes need handling

#### Best For
- Offline/air-gapped systems
- Development and debugging
- Audit requirements
- Systems with strict network policies

#### Code Example
```bash
# Hook script
jq -c '. + {"timestamp": now}' >> /tmp/maestro-hooks-${MAESTRO_SESSION_ID}.jsonl
```

```typescript
// File watcher
import chokidar from 'chokidar';
const watcher = chokidar.watch('/tmp/maestro-hooks-*.jsonl');
watcher.on('change', handleFileChange);
```

---

### Option 3: Hybrid (Webhook + File)

#### Architecture
```
Claude Session → Hook Script → {
  Critical events → curl POST → Server (immediate)
  All events → Write to file → Persistence
}
```

#### Pros
✅ **Best of both worlds**: Real-time + persistence
✅ **Resilient**: Server downtime doesn't lose events
✅ **Reliable**: Critical events always delivered

#### Cons
❌ **Complex**: Two systems to maintain
❌ **Higher cost**: More implementation time
❌ **Coordination**: Must keep systems in sync

#### Best For
- High-reliability production systems
- Systems with strict audit requirements
- Mission-critical orchestration

#### Decision Logic
```bash
# In hook script
CRITICAL_HOOKS="PreToolUse|PostToolUseFailure|SessionEnd"

if echo "$HOOK_NAME" | grep -qE "$CRITICAL_HOOKS"; then
  # Critical: Send immediately via webhook
  curl -X POST http://localhost:3000/api/webhooks/hook-event -d "$INPUT"
fi

# Always log to file
echo "$INPUT" >> /tmp/maestro-hooks.jsonl
```

---

### Option 4: Session-Specific Hook Scripts

#### Architecture
```
Session Spawn → Generate custom hook scripts → Inject into .claude/hooks/ → Use in session
```

#### Pros
✅ **Flexible**: Different hooks per task type
✅ **Context-aware**: Scripts know session details
✅ **Customizable**: Easy to add task-specific logic
✅ **Isolated**: Session failures don't affect others

#### Cons
❌ **Complex spawn**: More logic at session creation
❌ **Script management**: Must track and cleanup scripts
❌ **Consistency**: Harder to maintain uniform behavior

#### Best For
- Advanced orchestration with diverse task types
- Custom workflows per task category
- Experimentation and iteration

#### Example
```typescript
// At session spawn time
function generateHookScripts(sessionId: string, taskIds: string[]) {
  const hookScript = `#!/bin/bash
SESSION_ID="${sessionId}"
TASK_IDS="${taskIds.join(',')}"
curl -X POST http://localhost:3000/api/hooks \
  -d "$(cat | jq '. + {session: $sid, tasks: $tid}' \
      --arg sid "$SESSION_ID" --arg tid "$TASK_IDS")"
`;

  fs.writeFileSync(
    `${projectDir}/.claude/hooks/session-${sessionId}.sh`,
    hookScript,
    { mode: 0o755 }
  );
}
```

---

### Option 5: Skill-Embedded Hooks

#### Architecture
```
Skill Definition (frontmatter) → Claude loads skill → Hooks active while skill loaded
```

#### Pros
✅ **Self-contained**: Skills include their own hooks
✅ **Portable**: Distribute skills with monitoring built-in
✅ **Scoped**: Hooks only active when needed
✅ **Simple**: No global configuration

#### Cons
❌ **Limited scope**: Can't use for session-wide hooks
❌ **Skill-specific**: Different skills may have different hooks
❌ **Harder to override**: Global hooks can't easily override skill hooks

#### Best For
- Reusable, shareable skills
- Skills with specific monitoring needs
- Portable tool distributions

#### Example
```markdown
---
description: Maestro Worker Skill
hooks:
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "curl -X POST http://localhost:3000/api/skills/bash-complete -d @-"
          async: true
---

# Maestro Worker Skill

You are a worker agent executing tasks...
```

---

## Hook Selection Guide

### Core Hooks (Must-Have) - Start Here

| Hook | Priority | Use Case | Complexity |
|------|----------|----------|------------|
| `SessionStart` | HIGH | Initialize session context | Low |
| `PostToolUse` | HIGH | Track all agent actions | Low |
| `Notification` | MEDIUM | Detect permission prompts | Low |
| `SessionEnd` | HIGH | Finalize session | Low |

**Effort:** 4-6 hours
**Benefit:** Real-time visibility, basic timeline

---

### Enhanced Hooks (Nice-to-Have) - Add Later

| Hook | Priority | Use Case | Complexity |
|------|----------|----------|------------|
| `PreToolUse` | MEDIUM | Validate/block operations | Medium |
| `PostToolUseFailure` | MEDIUM | Error detection | Low |
| `SubagentStart/Stop` | LOW | Track nested agents | Low |
| `Stop` | LOW | Verify task completion | Medium |

**Effort:** +6-8 hours
**Benefit:** Safety, error handling, completion verification

---

### Advanced Hooks (Power Features) - Future Phase

| Hook | Priority | Use Case | Complexity |
|------|----------|----------|------------|
| `UserPromptSubmit` | LOW | Validate user prompts | Medium |
| `PermissionRequest` | MEDIUM | Auto-approval logic | High |
| `PreCompact` | LOW | State preservation | Medium |

**Effort:** +8-12 hours
**Benefit:** Automation, intelligent decision-making

---

## Recommended Phased Approach

### Phase 1: Core Integration (Week 1) ⭐ START HERE

**Goal:** Get basic hook integration working

**Hooks to implement:**
- `SessionStart`
- `PostToolUse`
- `Notification`
- `SessionEnd`

**Option:** Option 1 (Centralized Webhook)

**UI Features:**
- Live activity feed
- Pending action badges
- Basic timeline

**Success Metrics:**
- Can see agent activity in real-time
- Notifications when agents need permission
- Session start/end tracked

**Effort:** 8-12 hours

---

### Phase 2: Safety & Monitoring (Week 2)

**Goal:** Add safety features and comprehensive monitoring

**New Hooks:**
- `PreToolUse` (validation)
- `PostToolUseFailure` (error handling)
- `SubagentStart/Stop` (hierarchy tracking)

**UI Features:**
- Error notifications
- Tool usage analytics
- Agent hierarchy visualization

**Success Metrics:**
- Dangerous operations blocked automatically
- Errors surfaced immediately
- Comprehensive analytics

**Effort:** 12-16 hours

---

### Phase 3: Intelligence (Week 3+)

**Goal:** Autonomous decision-making

**New Hooks:**
- `PermissionRequest` (auto-approval)
- `Stop` (completion verification)
- `UserPromptSubmit` (prompt validation)

**UI Features:**
- Smart auto-approval indicators
- Completion confidence scores
- Prompt suggestions

**Success Metrics:**
- 80%+ operations auto-approved
- Zero incomplete tasks marked complete
- Reduced manual intervention

**Effort:** 16-20 hours

---

## Cost-Benefit Analysis

### Option 1: Centralized Webhook

**Cost:**
- Implementation: 5 hours
- Maintenance: Low (1-2 hours/month)
- Network: Negligible (<1ms per hook)

**Benefit:**
- Real-time UI updates: +++++ (Critical)
- Analytics: ++++ (High value)
- Debugging: ++++ (Easy)
- Scalability: +++++ (Excellent)

**ROI:** ⭐⭐⭐⭐⭐ (Excellent)

---

### Option 2: File-Based

**Cost:**
- Implementation: 7 hours
- Maintenance: Medium (2-4 hours/month)
- Disk I/O: ~100KB per session

**Benefit:**
- Persistence: +++++ (Critical for compliance)
- Offline: +++++ (Essential for air-gapped)
- Real-time: +++ (Delayed but acceptable)

**ROI:** ⭐⭐⭐⭐ (Good for specific needs)

---

### Option 3: Hybrid

**Cost:**
- Implementation: 12 hours
- Maintenance: High (4-6 hours/month)
- Complexity: High

**Benefit:**
- Reliability: +++++ (Best-in-class)
- All features: +++++ (Complete solution)

**ROI:** ⭐⭐⭐ (Only for critical systems)

---

## Final Recommendation

### For 90% of Users: Start with Option 1 ⭐

**Rationale:**
1. **Fastest to value**: 5 hours to working system
2. **Meets core needs**: Real-time updates, basic analytics
3. **Easy to extend**: Add persistence later if needed
4. **Industry standard**: Webhook-based integrations are proven

**Phase 1 Implementation (Week 1):**
```
Day 1: Server endpoint + hook scripts
Day 2: Configuration + testing
Day 3: UI integration
Day 4: Polish + documentation
```

**Then evaluate:**
- Is persistence needed? → Add file logging to Option 1
- Need offline support? → Migrate to Option 2
- Critical reliability? → Upgrade to Option 3

---

## Quick Start Checklist

### Option 1: Centralized Webhook (Recommended)

- [ ] **Day 1 Morning:** Add `/api/webhooks/hook-event` endpoint to maestro-server
- [ ] **Day 1 Afternoon:** Write `session-start.sh`, `log-tool-use.sh`, `session-end.sh`
- [ ] **Day 2 Morning:** Configure `.claude/settings.json` with 4 core hooks
- [ ] **Day 2 Afternoon:** Test hooks with sample Claude session
- [ ] **Day 3 Morning:** Add WebSocket event handlers (`hook:event`)
- [ ] **Day 3 Afternoon:** Create `LiveActivityFeed` component
- [ ] **Day 4 Morning:** Integrate component into `TaskCard`
- [ ] **Day 4 Afternoon:** End-to-end testing + documentation

**Deliverables:**
- ✅ Real-time activity feed on task cards
- ✅ Pending action badges
- ✅ Session timeline
- ✅ Basic analytics (tool usage counts)

---

## Decision Support Questions

### Answer these to choose your option:

1. **Do you need offline support?**
   - Yes → Option 2 or 3
   - No → Option 1

2. **Is this for production or development?**
   - Production → Option 1 or 3
   - Development → Option 2 or 5

3. **How important is real-time UI?**
   - Critical → Option 1 or 3
   - Nice-to-have → Option 2
   - Not important → Option 5

4. **What's your timeline?**
   - Ship this week → Option 1
   - Ship in 2 weeks → Option 1 or 2
   - Ship in a month → Option 3

5. **Do you have diverse task types?**
   - Yes, very different → Option 4
   - Yes, but similar → Option 1
   - No → Option 1 or 5

---

## Next Steps

1. ✅ Read full documentation: `MAESTRO-HOOKS-INTEGRATION.md`
2. ✅ Choose option (recommend: Option 1)
3. ✅ Review implementation plan
4. ✅ Decide on initial hook set (recommend: 4 core hooks)
5. ✅ Schedule implementation (recommend: 1 week)
6. → **BEGIN IMPLEMENTATION**

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
**Maintainer:** Maestro Team
**For Review By:** Technical Lead

---

## Appendix: Comparison at a Glance

| Metric | Option 1 | Option 2 | Option 3 | Option 4 | Option 5 |
|--------|----------|----------|----------|----------|----------|
| Setup Time | 5h | 7h | 12h | 10h | 3h |
| Real-time | Excellent | Good | Excellent | Excellent | Excellent |
| Persistence | Optional | Built-in | Built-in | Optional | Optional |
| Complexity | Low | Medium | High | High | Low |
| Scalability | Excellent | Good | Excellent | Excellent | Excellent |
| Debugging | Easy | Medium | Hard | Medium | Easy |
| Offline | No | Yes | Yes | No | No |
| **Recommended** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

**Legend:**
- ⭐⭐⭐⭐⭐ Highly recommended for most users
- ⭐⭐⭐⭐ Good choice for specific use cases
- ⭐⭐⭐ Consider only if requirements match
- ⭐⭐ Advanced/niche use cases only
