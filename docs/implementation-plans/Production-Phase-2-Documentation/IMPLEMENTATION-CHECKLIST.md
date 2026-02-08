# Production Phase 2 - Implementation Checklist

**Version:** 1.0
**Date:** 2026-02-01
**Status:** Not Started

---

## Progress Tracker

| Phase | Tasks Complete | Status |
|-------|---------------|--------|
| Server Infrastructure | 0/7 | ⬜ Not Started |
| Hook Scripts | 0/5 | ⬜ Not Started |
| UI Integration | 0/6 | ⬜ Not Started |
| Testing | 0/6 | ⬜ Not Started |
| Documentation | 0/3 | ⬜ Not Started |
| **Total** | **0/27** | **0%** |

---

## Day 1: Server Infrastructure (3-4 hours)

### Webhook Endpoint
- [ ] Create `maestro-server/src/api/webhooks.ts`
- [ ] Implement `POST /api/webhooks/hook-event` endpoint
- [ ] Add input validation (session_id, hook_event_name)
- [ ] Implement all handler functions:
  - [ ] `handleSessionStart`
  - [ ] `handlePostToolUse`
  - [ ] `handleNotification`
  - [ ] `handleSessionEnd`
  - [ ] `handlePostToolUseFailure`
- [ ] Add helper functions (`formatToolActivity`, `formatDuration`, `getFileName`)
- [ ] Test endpoint with curl
- [ ] Verify no TypeScript errors

### Storage Updates
- [ ] Add `claudeSessionMap` to Storage class
- [ ] Add `toolMetrics` to Storage class
- [ ] Add `hookEvents` array (optional persistence)
- [ ] Implement `mapClaudeSession(claudeSessionId, maestroSessionId)`
- [ ] Implement `findSessionByClaudeId(claudeSessionId)`
- [ ] Implement `incrementToolUsage(sessionId, tool)`
- [ ] Implement `getToolMetrics(sessionId)`
- [ ] Implement `addTaskTimelineEvent(taskId, event)`
- [ ] Implement `saveHookEvent(event)` (optional)
- [ ] Add TypeScript interfaces (HookEvent, TimelineEvent)
- [ ] Test storage methods

### Server Configuration
- [ ] Import `webhooksRouter` in `maestro-server/src/index.ts`
- [ ] Mount router: `app.use('/api', webhooksRouter(storage))`
- [ ] Update session spawn with environment variables:
  - [ ] `MAESTRO_SESSION_ID`
  - [ ] `MAESTRO_TASK_IDS`
  - [ ] `MAESTRO_API_URL`
  - [ ] `MAESTRO_PROJECT_ID`
- [ ] Add `POST /api/sessions/:id/register-claude-session` endpoint
- [ ] Test session spawn sets env vars correctly
- [ ] Server restarts without errors

**Day 1 Complete:** [ ] (7/7 tasks)

---

## Day 2: Hook Scripts (2-3 hours)

### Directory Setup
- [ ] Create `.claude/` directory in project root
- [ ] Create `.claude/hooks/` subdirectory
- [ ] Verify directory permissions

### Script Creation
- [ ] Create `session-start.sh`
  - [ ] Add shebang and secure defaults
  - [ ] Read input from stdin
  - [ ] Extract session info with jq
  - [ ] Register Claude session with Maestro
  - [ ] Send webhook event
  - [ ] Inject context for Claude
  - [ ] Make executable (chmod +x)
  - [ ] Test manually
- [ ] Create `log-tool-use.sh`
  - [ ] Add shebang and secure defaults
  - [ ] Read input from stdin
  - [ ] Send async webhook POST
  - [ ] Make executable
  - [ ] Test manually
- [ ] Create `notify-permission.sh`
  - [ ] Add shebang and secure defaults
  - [ ] Read input from stdin
  - [ ] Send async webhook POST
  - [ ] Make executable
  - [ ] Test manually
- [ ] Create `session-end.sh`
  - [ ] Add shebang and secure defaults
  - [ ] Read input from stdin
  - [ ] Send synchronous webhook POST
  - [ ] Make executable
  - [ ] Test manually

### Hook Configuration
- [ ] Create `.claude/settings.json`
- [ ] Add SessionStart hook configuration
- [ ] Add PostToolUse hook configuration (async)
- [ ] Add Notification hook configuration (matcher: permission_prompt)
- [ ] Add SessionEnd hook configuration
- [ ] Validate JSON (`jq empty < .claude/settings.json`)
- [ ] Verify paths are correct

**Day 2 Complete:** [ ] (5/5 tasks)

---

## Day 3: UI Integration (2-3 hours)

### WebSocket Updates
- [ ] Add hook event types to `src/hooks/useMaestroWebSocket.ts`:
  - [ ] `hook:tool_use`
  - [ ] `hook:notification`
  - [ ] `hook:session_start`
  - [ ] `hook:session_end`
  - [ ] `hook:tool_failure`
- [ ] Add callback types to `MaestroWebSocketCallbacks`:
  - [ ] `onHookToolUse`
  - [ ] `onHookNotification`
  - [ ] `onHookSessionStart`
  - [ ] `onHookSessionEnd`
  - [ ] `onHookToolFailure`
- [ ] Add switch cases in `ws.onmessage` handler
- [ ] Test WebSocket connection
- [ ] Verify no TypeScript errors

### Components
- [ ] Create `src/components/maestro/LiveActivityFeed.tsx`
  - [ ] Implement activity state management
  - [ ] Add `useMaestroWebSocket` hook handlers
  - [ ] Implement `formatTimeAgo` helper
  - [ ] Implement `getToolIcon` helper
  - [ ] Create component JSX
- [ ] Create `src/components/maestro/LiveActivityFeed.css`
  - [ ] Style activity feed container
  - [ ] Style activity items
  - [ ] Style error states
  - [ ] Test responsive design
- [ ] Update `src/components/maestro/TaskCard.tsx`
  - [ ] Import LiveActivityFeed
  - [ ] Add blocked state management
  - [ ] Add hook handlers for notifications
  - [ ] Add pending action badge
  - [ ] Render LiveActivityFeed
  - [ ] Style blocked message
- [ ] Create `src/components/maestro/ErrorToast.tsx`
  - [ ] Implement toast state management
  - [ ] Add hook handler for tool failures
  - [ ] Implement auto-dismiss (5s timeout)
  - [ ] Create toast JSX
  - [ ] Style toast notifications
  - [ ] Test multiple toasts
- [ ] Update `src/App.tsx`
  - [ ] Import ErrorToastContainer
  - [ ] Render ErrorToastContainer
- [ ] Create `src/components/maestro/ToolUsageChart.tsx` (optional)
  - [ ] Implement metrics state
  - [ ] Add hook handler for tool usage
  - [ ] Create chart visualization
  - [ ] Style chart

**Day 3 Complete:** [ ] (6/6 tasks)

---

## Day 4: Testing & Polish (2-3 hours)

### Unit Tests
- [ ] Create `maestro-server/tests/webhooks.test.ts`
- [ ] Test: Valid SessionStart event accepted
- [ ] Test: Valid PostToolUse event accepted
- [ ] Test: Tool metrics updated correctly
- [ ] Test: Missing required fields rejected
- [ ] Test: Unknown sessions handled gracefully
- [ ] Test: Timeline events added correctly
- [ ] Run tests: `npm test`
- [ ] All tests passing

### Integration Tests
- [ ] Test webhook → WebSocket flow
- [ ] Test session mapping works
- [ ] Test real-time broadcasting
- [ ] Test error handling

### End-to-End Manual Tests
- [ ] Test 1: Session lifecycle (start → end)
  - [ ] Session status updates correctly
  - [ ] Timeline shows start/end events
  - [ ] Duration calculated
- [ ] Test 2: Real-time activity feed
  - [ ] Tool usage appears instantly (<100ms)
  - [ ] Activity feed updates for all tools
  - [ ] No missed events
- [ ] Test 3: Pending action badge
  - [ ] Badge appears when blocked
  - [ ] Badge clears when resumed
  - [ ] Message displays correctly
- [ ] Test 4: Tool usage analytics
  - [ ] Counters increment correctly
  - [ ] Multiple tool types tracked
  - [ ] Metrics accurate
- [ ] Test 5: Error handling
  - [ ] Error toasts appear
  - [ ] Timeline shows errors
  - [ ] Error details available
- [ ] Test 6: Timeline accuracy
  - [ ] All events logged
  - [ ] Chronological order
  - [ ] Timestamps accurate

### Bug Fixes
- [ ] Fix any issues found in testing
- [ ] Verify fixes don't break other features
- [ ] Re-test after fixes

### Performance
- [ ] Latency < 100ms (hook → UI)
- [ ] No UI lag with rapid events
- [ ] WebSocket connection stable
- [ ] No memory leaks

**Day 4 Complete:** [ ] (6/6 tasks)

---

## Documentation

- [ ] Update README.md with hooks integration info
- [ ] Add architecture diagram to docs
- [ ] Document environment variables
- [ ] Create troubleshooting guide (add to existing docs)
- [ ] Update API documentation with webhook endpoint

**Documentation Complete:** [ ] (3/3 tasks)

---

## Deployment Preparation

### Code Review
- [ ] All code follows style guide
- [ ] No hardcoded values (use env vars)
- [ ] No console.logs in production code
- [ ] Error handling comprehensive
- [ ] Security measures in place

### Git
- [ ] All changes committed
- [ ] Commit messages descriptive
- [ ] Branch up to date with main
- [ ] `.claude/` directory in git
- [ ] No sensitive data in commits

### Production Checklist
- [ ] Environment variables documented
- [ ] Secrets management configured
- [ ] Rate limiting enabled
- [ ] Authentication (API key) implemented
- [ ] HTTPS/WSS configured
- [ ] Monitoring alerts set up
- [ ] Backup strategy defined
- [ ] Rollback plan documented

---

## Success Criteria

Phase 2 is complete when ALL of these are true:

### Functional
- [ ] Every tool use appears in UI within 100ms
- [ ] Permission prompts show "Blocked" badge immediately
- [ ] Timeline shows all agent actions chronologically
- [ ] Session start/end tracked accurately
- [ ] Tool usage metrics display correctly
- [ ] Error notifications appear for failures

### Quality
- [ ] Zero data loss (all hook events captured)
- [ ] <100ms end-to-end latency (hook → UI)
- [ ] Handles 100+ hooks/second without degradation
- [ ] Proper error handling (no crashes)
- [ ] 80%+ test coverage
- [ ] No console errors in production

### Operational
- [ ] Hooks configured in `.claude/settings.json`
- [ ] Scripts executable and tested
- [ ] Webhook endpoint deployed
- [ ] WebSocket events documented
- [ ] Security measures active
- [ ] Monitoring in place

### Documentation
- [ ] All documentation updated
- [ ] README has setup instructions
- [ ] Troubleshooting guide complete
- [ ] API documentation updated

---

## Sign-Off

### Technical Lead
- [ ] Code reviewed and approved
- [ ] Architecture approved
- [ ] Security review passed
- [ ] Performance acceptable

### QA
- [ ] All tests passing
- [ ] Manual testing complete
- [ ] No critical bugs
- [ ] Acceptance criteria met

### Product
- [ ] Features match requirements
- [ ] UI/UX acceptable
- [ ] Demo successful
- [ ] Ready for production

---

## Post-Deployment

### Week 1 Monitoring
- [ ] Monitor error rates
- [ ] Check latency metrics
- [ ] Review logs for issues
- [ ] Collect user feedback

### Week 2 Optimization
- [ ] Address any performance issues
- [ ] Fix any bugs found
- [ ] Optimize based on usage patterns
- [ ] Update documentation as needed

---

## Notes

Use this space to track blockers, questions, or important decisions:

**Blockers:**
- 

**Questions:**
-

**Decisions:**
-

**Issues:**
-

---

**Last Updated:** 2026-02-01
**Updated By:** 
**Next Review:** After Day 1 completion

