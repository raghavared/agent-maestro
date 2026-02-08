# Production Phase 2: Claude Code Hooks Integration

**Version:** 1.0
**Date:** 2026-02-01
**Status:** 📋 Ready to Implement
**Approved:** ✅ Option 1 (Centralized Webhook)

---

## Overview

Production Phase 2 adds **real-time observability and control** to spawned Claude Code sessions through hooks integration. This phase transforms the Maestro orchestration system from basic session management to a comprehensive, production-grade monitoring and control platform.

### What This Phase Delivers

- ✅ **Real-time UI updates** showing agent activity as it happens
- ✅ **Live activity feeds** on task cards
- ✅ **Pending action badges** when agents need permission
- ✅ **Automatic timeline generation** from agent actions
- ✅ **Tool usage analytics** and session metrics
- ✅ **Error detection and notifications**
- ✅ **Permission management** (auto-approve safe, block dangerous)
- ✅ **Session health monitoring**

### Implementation Approach

**Approved: Option 1 - Centralized Webhook Endpoint**

```
Claude Code Sessions → Hook Scripts → Webhook (HTTP POST) → Maestro Server → WebSocket → UI
```

**Why Centralized Webhook:**
- Simplest architecture (single endpoint)
- Fast implementation (8-12 hours)
- Real-time updates (<100ms latency)
- Easy to debug and monitor
- Scales to many concurrent sessions

---

## Documentation Index

| Document | Purpose | Time to Read |
|----------|---------|--------------|
| **[README.md](./README.md)** | This file - Overview and navigation | 5 min |
| **[01-HOOKS-OVERVIEW.md](./01-HOOKS-OVERVIEW.md)** | Complete Claude Code hooks reference | 15 min |
| **[02-WEBHOOK-ARCHITECTURE.md](./02-WEBHOOK-ARCHITECTURE.md)** | Webhook endpoint design and implementation | 20 min |
| **[03-UI-INTEGRATION.md](./03-UI-INTEGRATION.md)** | How hooks update the UI (with examples) | 25 min |
| **[04-IMPLEMENTATION-GUIDE.md](./04-IMPLEMENTATION-GUIDE.md)** | Step-by-step implementation instructions | 30 min |
| **[05-HOOK-SCRIPTS-REFERENCE.md](./05-HOOK-SCRIPTS-REFERENCE.md)** | All hook scripts with explanations | 20 min |
| **[06-TESTING-GUIDE.md](./06-TESTING-GUIDE.md)** | Testing strategy and test cases | 15 min |
| **[07-SECURITY-GUIDE.md](./07-SECURITY-GUIDE.md)** | Security considerations and best practices | 15 min |
| **[IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md)** | Detailed implementation checklist | Ongoing |

---

## Quick Start

### For Product/Technical Leads

1. Read this README (5 min)
2. Review [01-HOOKS-OVERVIEW.md](./01-HOOKS-OVERVIEW.md) to understand hooks (15 min)
3. Review [03-UI-INTEGRATION.md](./03-UI-INTEGRATION.md) to see UI enhancements (25 min)
4. Approve implementation and timeline

### For Developers

1. Read [01-HOOKS-OVERVIEW.md](./01-HOOKS-OVERVIEW.md) - Understand hooks system
2. Read [02-WEBHOOK-ARCHITECTURE.md](./02-WEBHOOK-ARCHITECTURE.md) - Server implementation
3. Read [04-IMPLEMENTATION-GUIDE.md](./04-IMPLEMENTATION-GUIDE.md) - Step-by-step guide
4. Use [IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md) to track progress

### For QA/Testing

1. Read [06-TESTING-GUIDE.md](./06-TESTING-GUIDE.md)
2. Follow test plans and scenarios
3. Report issues in checklist

---

## Architecture Overview

### Current State (Phase 1)

```
┌─────────────────────────────────────────────────────────────┐
│                      Maestro UI                             │
│  - Task cards showing status                                │
│  - Sessions list                                            │
│  - No real-time agent visibility                           │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket (basic events)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Maestro Server                             │
│  - Task/Session CRUD                                        │
│  - Session spawning                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│          Claude Code Sessions (black box)                   │
│  - No visibility into what agents are doing                 │
│  - No error notifications                                   │
│  - No progress tracking                                     │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2 Enhanced State

```
┌─────────────────────────────────────────────────────────────┐
│                      Maestro UI                             │
│  ✨ Live activity feeds                                     │
│  ✨ Real-time progress indicators                           │
│  ✨ Pending action badges                                   │
│  ✨ Tool usage analytics                                    │
│  ✨ Error notifications                                     │
│  ✨ Session health indicators                               │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket (enhanced events)
                     │ + hook:tool_use
                     │ + hook:notification
                     │ + hook:session_start/end
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Maestro Server                             │
│  ✨ POST /api/webhooks/hook-event (NEW)                     │
│  ✨ Claude session ID mapping (NEW)                         │
│  ✨ Tool metrics tracking (NEW)                             │
│  ✨ Timeline generation (NEW)                               │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP POST (hooks calling webhook)
                     │
┌────────────────────▼────────────────────────────────────────┐
│          Claude Code Sessions (observable)                  │
│  ✨ Hooks configured (.claude/settings.json)                │
│  ✨ Hook scripts (.claude/hooks/*.sh)                       │
│  ✨ Real-time event streaming to Maestro                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Hooks to UI Mapping

This table shows **which hooks update which UI elements**:

| Hook Event | UI Element | What Gets Updated | Priority |
|------------|------------|-------------------|----------|
| **SessionStart** | Session status badge | "Active" indicator appears | HIGH |
| **SessionStart** | Task timeline | "Session started" event added | HIGH |
| **PostToolUse** (Read) | Live activity feed | "Reading file.ts" appears | HIGH |
| **PostToolUse** (Write/Edit) | Live activity feed | "Modified file.ts" appears | HIGH |
| **PostToolUse** (Write/Edit) | Task timeline | File modification logged | MEDIUM |
| **PostToolUse** (Bash) | Live activity feed | "Executed: npm test" appears | HIGH |
| **PostToolUse** (Bash) | Task timeline | Command execution logged | MEDIUM |
| **PostToolUse** (All) | Tool usage chart | Tool counter incremented | MEDIUM |
| **PostToolUse** (All) | Session metrics | Total tool usage updated | LOW |
| **Notification** (permission_prompt) | Task status badge | "⚠️ Blocked" badge appears | HIGH |
| **Notification** (permission_prompt) | Permission modal | Shows blocked command | HIGH |
| **Notification** (permission_prompt) | Task status | Status → "blocked" | HIGH |
| **PostToolUseFailure** | Error notification | Error toast appears | HIGH |
| **PostToolUseFailure** | Task timeline | Error event logged | MEDIUM |
| **PostToolUseFailure** | Error log panel | Error details added | MEDIUM |
| **SessionEnd** | Session status badge | "Completed" indicator | HIGH |
| **SessionEnd** | Task timeline | "Session ended" event | HIGH |
| **SessionEnd** | Session duration | Total time calculated | LOW |

---

## Core Hooks Implementation (Phase 2A)

### Week 1: Foundation

Implement **4 core hooks** that provide immediate value:

#### 1. SessionStart Hook
**Triggers:** When Claude Code session begins
**Purpose:** Initialize session tracking, register with Maestro
**UI Updates:**
- Session status → "Active"
- Timeline event: "Session started"
- Session start timestamp recorded

#### 2. PostToolUse Hook
**Triggers:** After every tool call (Read, Write, Edit, Bash, etc.)
**Purpose:** Track all agent activity in real-time
**UI Updates:**
- Live activity feed: "Reading auth.ts" (real-time)
- Timeline event: Detailed tool usage logged
- Tool usage counter: Increment count for this tool
- Session metrics: Total tools used updated

#### 3. Notification Hook
**Triggers:** When Claude sends notifications (especially permission prompts)
**Purpose:** Detect when agents are blocked waiting for approval
**UI Updates:**
- Task status badge: "⚠️ Blocked" appears
- Permission modal: Shows what permission is needed
- Task status: Changes to "blocked"
- Timeline event: "Waiting for permission" logged

#### 4. SessionEnd Hook
**Triggers:** When Claude Code session terminates
**Purpose:** Finalize session, calculate metrics
**UI Updates:**
- Session status → "Completed"
- Timeline event: "Session ended"
- Session duration calculated
- Final metrics saved

---

## Implementation Timeline

### Week 1: Core Infrastructure (8-12 hours)

**Day 1: Server Setup** (3-4 hours)
- [ ] Create webhook endpoint (`/api/webhooks/hook-event`)
- [ ] Add Claude session ID mapping to Storage
- [ ] Add tool metrics tracking
- [ ] Add WebSocket event broadcasting

**Day 2: Hook Scripts** (2-3 hours)
- [ ] Write `session-start.sh`
- [ ] Write `log-tool-use.sh`
- [ ] Write `notify-permission.sh`
- [ ] Write `session-end.sh`
- [ ] Configure `.claude/settings.json`

**Day 3: UI Integration** (2-3 hours)
- [ ] Add WebSocket hook event handlers
- [ ] Create `LiveActivityFeed` component
- [ ] Add pending action badges to TaskCard
- [ ] Update session status indicators

**Day 4: Testing & Polish** (2-3 hours)
- [ ] End-to-end testing
- [ ] Fix bugs
- [ ] Documentation updates
- [ ] Demo preparation

---

## Success Criteria

Phase 2 is complete when:

### Functional Requirements
- ✅ Every tool use in Claude appears in UI within 100ms
- ✅ Permission prompts show "Blocked" badge immediately
- ✅ Timeline shows all agent actions chronologically
- ✅ Session start/end tracked accurately
- ✅ Tool usage metrics display correctly

### Quality Requirements
- ✅ Zero data loss (all hook events captured)
- ✅ <100ms end-to-end latency (hook → UI)
- ✅ Handles 100+ hooks/second without degradation
- ✅ Resilient to temporary server downtime
- ✅ Proper error handling (malformed events, network failures)

### Operational Requirements
- ✅ Hooks configured in `.claude/settings.json`
- ✅ Scripts executable and tested
- ✅ Webhook endpoint deployed and monitored
- ✅ WebSocket events documented
- ✅ Security measures in place

---

## Key Features Delivered

### 1. Live Activity Feed
Shows real-time agent activity on each task card:
- "Reading src/auth/login.ts"
- "Modified src/auth/middleware.ts"
- "Executed: npm test"
- "Searching for authentication patterns"

### 2. Pending Action Badges
Visual indicators when agents are blocked:
- "⚠️ Blocked" badge appears
- Shows what permission is needed
- Option to view/approve in session

### 3. Automatic Timeline
Every task has a detailed timeline:
- Session started (10:00 AM)
- Read 5 configuration files (10:01 AM)
- Modified database schema (10:03 AM)
- Ran migrations (10:05 AM)
- Tests passed (10:06 AM)
- Session completed (10:07 AM)

### 4. Tool Usage Analytics
Per-session statistics:
- Read: 45 uses (100% success)
- Write: 28 uses (96% success)
- Edit: 22 uses (91% success)
- Bash: 15 uses (87% success)

### 5. Error Notifications
Immediate alerts when tools fail:
- Toast notification appears
- Error logged to timeline
- Error details available for debugging

### 6. Session Health Monitoring
Track session health:
- Active indicator (green)
- Idle warning (yellow, 5+ min no activity)
- Stale alert (red, 15+ min no activity)
- Completion status

---

## Dependencies

### Phase 1 Requirements (Must be complete)
- ✅ Maestro server running
- ✅ WebSocket connection established
- ✅ Session spawning functional
- ✅ Tasks/Sessions CRUD working

### External Dependencies
- Claude Code CLI (latest version with hooks support)
- curl (for webhook POST requests)
- jq (for JSON parsing in bash scripts)

### New Dependencies (Phase 2)
- None (uses existing stack)

---

## Out of Scope (Future Phases)

### Phase 3 Candidates
- **Advanced Analytics:** Aggregated metrics across all tasks
- **Smart Auto-Approval:** ML-based permission decisions
- **Predictive Monitoring:** Detect stuck sessions before timeout
- **Performance Optimization:** Batching, compression, caching

### Not Planned
- Historical playback (replaying sessions)
- Video recording of sessions
- Real-time collaboration (multiple users watching same session)

---

## Migration from Phase 1

No breaking changes. Phase 2 is **purely additive**:

- ✅ All Phase 1 features continue working
- ✅ No database migrations required
- ✅ No API changes (only new endpoints added)
- ✅ Existing UI components unchanged (only enhanced)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hook events overwhelming server | Medium | Medium | Async processing, rate limiting |
| WebSocket connection drops | Medium | High | Auto-reconnect with backoff |
| Malformed hook data | Low | Medium | Input validation, error handling |
| Security vulnerabilities | Low | High | Input sanitization, protected files |
| Performance degradation | Low | Medium | Load testing, optimization |

---

## Monitoring & Observability

### Metrics to Track
- Hook events per second
- Webhook endpoint latency (p50, p95, p99)
- WebSocket broadcast latency
- Tool usage distribution
- Error rate (failed hook events)
- Session health (active/idle/stale counts)

### Alerts
- Error rate > 5% (critical)
- Webhook latency > 500ms (warning)
- WebSocket disconnections (info)
- Malformed events > 10/min (warning)

### Logging
```typescript
// Hook event received
[Hook] PostToolUse from session claude-abc → maestro-s123 (tool: Read)

// Webhook latency
[Hook] Event processed in 45ms

// Error
[Hook] Error: Invalid JSON in hook event from session claude-xyz
```

---

## Cost & Resource Requirements

### Development Time
- **Week 1:** 8-12 hours (core implementation)
- **Week 2:** 4-6 hours (polish, testing, docs)
- **Total:** 12-18 hours

### Infrastructure
- **Server:** No additional resources needed
- **Network:** ~10KB per hook event (negligible)
- **Storage:** ~1MB per 1000 hook events (optional persistence)

### Ongoing Maintenance
- **~1 hour/month** for monitoring, updates
- **Low complexity** (simple webhook architecture)

---

## Next Steps

1. ✅ **Read this README** - Understanding overview
2. → **Read [01-HOOKS-OVERVIEW.md](./01-HOOKS-OVERVIEW.md)** - Learn about hooks
3. → **Read [04-IMPLEMENTATION-GUIDE.md](./04-IMPLEMENTATION-GUIDE.md)** - Implementation steps
4. → **Start implementation** following the guide
5. → **Track progress** in [IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md)

---

## Support & Questions

### Documentation Issues
- If documentation is unclear, file an issue with specific questions
- Update docs after implementation based on learnings

### Implementation Issues
- Check [06-TESTING-GUIDE.md](./06-TESTING-GUIDE.md) for troubleshooting
- Review [07-SECURITY-GUIDE.md](./07-SECURITY-GUIDE.md) for security concerns
- Consult hook script examples in [05-HOOK-SCRIPTS-REFERENCE.md](./05-HOOK-SCRIPTS-REFERENCE.md)

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-01 | Initial Phase 2 documentation | Maestro Team |

---

**Status:** 📋 Ready to Implement
**Approved:** ✅ Yes (Option 1: Centralized Webhook)
**Timeline:** Week 1-2 (12-18 hours total)
**Priority:** HIGH

Let's build real-time observability into Maestro! 🚀
