# Maestro Execution Plan

**Date:** February 7, 2026
**Status:** Draft
**Priority:** High

---

## Executive Summary

This document outlines the execution plan for the Maestro Multi-Agent Task Orchestration System development. The plan focuses on three critical feature implementations and establishes a roadmap for future enhancements.

---

## Current State Analysis

### Architecture Overview

Maestro consists of three interconnected components:

1. **Maestro UI** (Tauri + React + Zustand)
   - Desktop application for task management
   - Terminal session management with xterm.js
   - Real-time WebSocket connection to server

2. **Maestro Server** (Express + WebSocket)
   - REST API for CRUD operations
   - Real-time event broadcasting
   - File-based storage in `~/.maestro/data`

3. **Maestro CLI** (Node.js + Commander.js)
   - Terminal-based task management
   - Session orchestration
   - Manifest generation

### Current Task Status

```
Total Tasks: 17
├─ Completed: 6
├─ In Progress: 3
├─ Todo: 7
└─ Blocked: 0
```

---

## Priority 1: Immediate Feature Implementations

### Task 1: Skills Integration (task_1770373465676_hwnhxy90q)

**Objective:** Display available Claude Code skills in the UI task details section

**Current State:**
- Data model already supports `skillIds: string[]` on tasks
- `AgentSkill` interface exists in types
- No UI component to display or select skills

**Implementation Plan:**

#### Phase 1.1: Skills API Integration (2-3 hours)
- [ ] Create API endpoint in maestro-server: `GET /api/skills`
- [ ] Implement skills service to fetch available Claude Code skills
- [ ] Add skills to server types and validation

#### Phase 1.2: Skills Store & Hooks (1-2 hours)
- [ ] Add skills state to `useMaestroStore`
- [ ] Create `useSkills()` hook for fetching skills
- [ ] Implement WebSocket events for skill updates

#### Phase 1.3: Skills UI Components (3-4 hours)
- [ ] Create `SkillSelector` component
  - Searchable dropdown
  - Skill metadata display (name, description, version)
  - Multi-select support
- [ ] Create `SkillBadge` component for displaying selected skills
- [ ] Add skills section to TaskDetailModal
- [ ] Add skills section to TaskListItem details tab

#### Phase 1.4: Integration (2 hours)
- [ ] Update `CreateTaskModal` to support skill selection
- [ ] Update `WorkOnModal` to show task skills
- [ ] Update `SpawnSessionPayload` to include skills from task
- [ ] Test skills flow end-to-end

**Estimated Effort:** 8-11 hours
**Dependencies:** None
**Risk Level:** Low

---

### Task 2: Model Type Selection (task_1770373686347_ph2pjx6tb)

**Objective:** Allow users to select model type (sonnet/opus/haiku) when running a task

**Current State:**
- `ModelType = 'sonnet' | 'opus' | 'haiku'` already defined in types
- Tasks and Sessions have `model?: ModelType` field
- `SpawnSessionPayload` supports model parameter
- No UI component for model selection

**Implementation Plan:**

#### Phase 2.1: Model Selector Component (2-3 hours)
- [ ] Create `ModelSelector` component
  - Radio button or dropdown interface
  - Model descriptions and capabilities
  - Cost/speed indicators
  - Default to 'sonnet' if not specified
- [ ] Add terminal-style theming to match WorkOnModal

#### Phase 2.2: Integration in WorkOnModal (2 hours)
- [ ] Add `ModelSelector` to `WorkOnModal`
- [ ] Update state management to track selected model
- [ ] Modify `handleWorkOnConfirm` to pass model to session spawn
- [ ] Update `onCreateMaestroSession` signature to accept model

#### Phase 2.3: Task Creation & Editing (2 hours)
- [ ] Add model selection to `CreateTaskModal`
- [ ] Add model field to task update flow
- [ ] Display current model in task details
- [ ] Show model badge in task list item (optional)

#### Phase 2.4: Server-Side Integration (1-2 hours)
- [ ] Ensure maestro-server passes model to CLI
- [ ] Update manifest generation to include model
- [ ] Verify model is set in session environment variables

#### Phase 2.5: Testing (1 hour)
- [ ] Test model selection flows
- [ ] Verify different models spawn correctly
- [ ] Test persistence across sessions

**Estimated Effort:** 8-10 hours
**Dependencies:** None
**Risk Level:** Low

---

### Task 3: Inline Subtask Creation (task_1770376149623_p5p1uh92i)

**Objective:** Enable inline subtask creation in TaskListItem

**Current State:**
- Subtask data model fully implemented (`parentId` field)
- `AddSubtaskInput` component exists
- TaskListItem has subtask toggle functionality
- Subtask button exists but no inline creation flow

**Implementation Plan:**

#### Phase 3.1: UI Flow Design (1 hour)
- [ ] Design interaction: Click subtask button → Show AddSubtaskInput
- [ ] Handle two states:
  - No subtasks: Show inline creation immediately
  - Has subtasks: Expand list + show "Add new" input at bottom

#### Phase 3.2: Component Updates (3-4 hours)
- [ ] Update `TaskListItem` component:
  - Add state for inline subtask creation mode
  - Integrate `AddSubtaskInput` in expanded section
  - Handle creation callback
  - Handle cancel callback
- [ ] Update `MaestroPanel`:
  - Connect inline subtask creation to task creation flow
  - Handle parent-child relationship setup
  - Update task tree after creation

#### Phase 3.3: AddSubtaskInput Enhancements (2 hours)
- [ ] Ensure component works in inline context
- [ ] Add autofocus on mount
- [ ] Add keyboard shortcuts (Enter to save, Esc to cancel)
- [ ] Add validation and error handling

#### Phase 3.4: Styling & UX Polish (2 hours)
- [ ] Style inline input to match terminal theme
- [ ] Add smooth animations for show/hide
- [ ] Ensure proper indentation for nested subtasks
- [ ] Add loading states during creation

#### Phase 3.5: Testing (1 hour)
- [ ] Test creating subtasks at different nesting levels
- [ ] Test cancellation flow
- [ ] Test keyboard shortcuts
- [ ] Verify task tree updates correctly

**Estimated Effort:** 9-11 hours
**Dependencies:** None
**Risk Level:** Low

---

## Priority 2: Architecture Improvements

### A. Enhanced Error Handling (Recommended)

**Issues:**
- Generic error messages in UI
- Inconsistent error propagation from server
- Limited offline support in UI

**Improvements:**
- [ ] Implement structured error types
- [ ] Add retry logic for failed operations
- [ ] Improve offline state handling
- [ ] Add error boundary components

**Estimated Effort:** 6-8 hours

---

### B. Performance Optimizations (Recommended)

**Opportunities:**
- [ ] Optimize task list rendering (virtualization for 100+ tasks)
- [ ] Implement debounced WebSocket updates
- [ ] Add request caching layer
- [ ] Optimize task tree calculations with memoization

**Estimated Effort:** 8-10 hours

---

### C. Session Management Improvements (Future)

**Features:**
- [ ] Session pause/resume functionality
- [ ] Session cloning (reuse configuration)
- [ ] Session templates
- [ ] Better session lifecycle visualization

**Estimated Effort:** 12-15 hours

---

## Priority 3: Documentation & Testing

### A. Documentation Updates

- [ ] Update README with new features
- [ ] Create user guide for skills integration
- [ ] Document model selection capabilities
- [ ] Add subtask workflow examples

**Estimated Effort:** 4-6 hours

---

### B. Testing Strategy

**Unit Tests:**
- [ ] Component tests for new UI components
- [ ] Hook tests for skills and model selection
- [ ] Server API tests for skills endpoint

**Integration Tests:**
- [ ] End-to-end skill selection flow
- [ ] End-to-end model selection flow
- [ ] End-to-end subtask creation flow

**Estimated Effort:** 10-12 hours

---

## Implementation Timeline

### Week 1: Core Features

**Days 1-2:**
- Complete Task 2: Model Type Selection
- High user value, low complexity

**Days 3-4:**
- Complete Task 3: Inline Subtask Creation
- Improves UX significantly

**Day 5:**
- Complete Task 1 (Phase 1.1-1.2): Skills API & State

### Week 2: Skills & Polish

**Days 1-2:**
- Complete Task 1 (Phase 1.3-1.4): Skills UI & Integration

**Days 3-4:**
- Testing and bug fixes
- Documentation updates

**Day 5:**
- Code review and refinement
- Performance optimization pass

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Skills API integration complexity | Medium | Low | Use existing skill discovery mechanisms from Claude Code |
| Model selection doesn't propagate correctly | High | Low | Thorough testing of spawn flow |
| Inline subtask creation conflicts with existing UI | Medium | Medium | Careful state management, use existing AddSubtaskInput |
| WebSocket connection issues | High | Low | Already have stable WebSocket implementation |

### Schedule Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Underestimated complexity | Medium | Built in 20% buffer in estimates |
| Dependencies on external systems | Low | Most features are self-contained |
| Testing discovers major issues | Medium | Incremental testing throughout |

---

## Success Metrics

### Functional Criteria
- ✅ Users can view and select available Claude Code skills
- ✅ Users can select model type before spawning sessions
- ✅ Users can create subtasks inline without modal
- ✅ All features work with existing WebSocket sync
- ✅ No regressions in existing functionality

### Quality Criteria
- ✅ All new features have unit tests (>80% coverage)
- ✅ Integration tests pass for critical flows
- ✅ Performance impact <5% for task list rendering
- ✅ Documentation updated and reviewed
- ✅ Code reviewed and approved

### User Experience Criteria
- ✅ Skills selection is intuitive and discoverable
- ✅ Model selection provides clear guidance
- ✅ Subtask creation feels seamless and fast
- ✅ Terminal theme consistency maintained
- ✅ Keyboard shortcuts work as expected

---

## Post-Implementation

### Phase 1: Monitoring (Week 3)
- Monitor for bugs and user feedback
- Performance monitoring
- Usage analytics

### Phase 2: Iteration (Week 4)
- Address feedback
- Minor improvements and polish
- Prepare for next feature set

---

## Open Questions

1. **Skills Discovery:** Should we fetch skills from a static list or dynamically discover them?
   - **Recommendation:** Start with static list from Claude Code documentation, add dynamic discovery later

2. **Model Selection Persistence:** Should model selection be remembered per-task or per-user?
   - **Recommendation:** Per-task for flexibility, with user-level default in settings

3. **Subtask Creation Depth:** Should we limit subtask nesting depth?
   - **Recommendation:** No hard limit initially, but warn at depth > 3

4. **Skills in Session:** Should skills be selectable at session spawn time or only at task creation?
   - **Recommendation:** Both - task default + override at spawn time

---

## Appendix: Technical Details

### A. File Modifications Required

**Skills Integration:**
- `maestro-server/src/routes/skills.ts` (new)
- `maestro-server/src/services/skillsService.ts` (new)
- `maestro-ui/src/stores/useMaestroStore.ts`
- `maestro-ui/src/components/maestro/SkillSelector.tsx` (new)
- `maestro-ui/src/components/maestro/TaskListItem.tsx`
- `maestro-ui/src/components/maestro/CreateTaskModal.tsx`

**Model Selection:**
- `maestro-ui/src/components/maestro/ModelSelector.tsx` (new)
- `maestro-ui/src/components/maestro/WorkOnModal.tsx`
- `maestro-ui/src/components/maestro/CreateTaskModal.tsx`
- `maestro-ui/src/components/maestro/TaskListItem.tsx`
- `maestro-server/src/routes/sessions.ts`

**Inline Subtask Creation:**
- `maestro-ui/src/components/maestro/TaskListItem.tsx`
- `maestro-ui/src/components/maestro/MaestroPanel.tsx`
- `maestro-ui/src/components/maestro/AddSubtaskInput.tsx`

### B. API Endpoints

**New Endpoints:**
```
GET  /api/skills              - List available skills
GET  /api/skills/:id          - Get skill details
POST /api/tasks/:id/skills    - Add skill to task
```

**Modified Endpoints:**
```
POST /api/sessions/spawn      - Add model parameter
POST /api/tasks               - Add model and skills parameters
PUT  /api/tasks/:id           - Add model update support
```

### C. WebSocket Events

**New Events:**
```
skills:loaded     - Skills catalog loaded
skill:added       - Skill added to task
skill:removed     - Skill removed from task
```

**Modified Events:**
```
session:spawn     - Include model and skills in payload
task:created      - Include model and skills in payload
task:updated      - Include model and skills in payload
```

---

## Conclusion

This execution plan provides a structured approach to implementing the three priority features for Maestro. The plan emphasizes:

1. **Incremental delivery** - Each task can be completed independently
2. **Risk mitigation** - Built-in testing and validation at each phase
3. **User value** - Focus on features that directly improve UX
4. **Maintainability** - Consistent patterns and thorough documentation

**Estimated Total Effort:** 25-32 hours (3-4 weeks with 1 developer)

**Next Steps:**
1. Review and approve this plan
2. Create detailed implementation tickets for each phase
3. Begin with Task 2 (Model Selection) as it has highest user value
4. Set up project tracking and milestones

---

**Document Version:** 1.0
**Last Updated:** 2026-02-07
**Author:** Maestro Execution Planning Agent
