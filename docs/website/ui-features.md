# UI Features

This page summarizes the core user-facing modules in Maestro UI and why they exist.

## App Navigation Flow

1. **Project selection (top tabs):** users switch project context quickly and keep multiple projects open.
2. **Sessions panel (left):** users start, pick, reorder, and manage terminal sessions for the active project.
3. **Terminal workspace (center):** users run commands and interact with active agents in real time.
4. **Maestro panel (right):** users manage tasks, lists, teams, skills, and execution controls.
5. **Board overlay (optional):** users review cross-project tasks/sessions in unified or grouped views.

Primary files:
- `maestro-ui/src/App.tsx`
- `maestro-ui/src/components/ProjectTabBar.tsx`
- `maestro-ui/src/components/SessionsSection.tsx`
- `maestro-ui/src/components/app/AppWorkspace.tsx`
- `maestro-ui/src/components/AppRightPanel.tsx`
- `maestro-ui/src/components/maestro/MultiProjectBoard.tsx`

## Projects View
- **What:** top project tab bar + project create/edit/reopen flows.
- **Purpose:** keep workspace context explicit and fast to switch.
- **User value:** less context loss when juggling multiple repositories or tasks.
- **Key files:** `maestro-ui/src/components/ProjectTabBar.tsx`, `maestro-ui/src/components/modals/ProjectModal.tsx`.

## Tasks View
- **What:** Maestro panel task system (current/pinned/completed/archived), task lists, assignment, execution controls.
- **Purpose:** convert planning into trackable work linked to sessions.
- **User value:** clear prioritization and visibility from backlog to completion.
- **Key files:** `maestro-ui/src/components/maestro/MaestroPanel.tsx`, `maestro-ui/src/components/maestro/PanelIconBar.tsx`, `maestro-ui/src/components/maestro/TaskListItem.tsx`, `maestro-ui/src/components/maestro/TaskListsPanel.tsx`.

## Sessions View
- **What:** sidebar session cards with grouping, quick-launch, ordering, details, and log access.
- **Purpose:** make active execution state visible and controllable.
- **User value:** users can jump between active agents/terminals without losing progress.
- **Key files:** `maestro-ui/src/components/SessionsSection.tsx`, `maestro-ui/src/components/maestro/TeamSessionGroup.tsx`, `maestro-ui/src/components/maestro/SessionDetailModal.tsx`.

## Terminal Sessions
- **What:** central terminal host with per-session xterm instances and optional editor split.
- **Purpose:** keep command execution as the primary workflow surface.
- **User value:** immediate feedback loop for commands, outputs, and agent actions.
- **Key files:** `maestro-ui/src/components/app/AppWorkspace.tsx`, `maestro-ui/src/SessionTerminal.tsx`.

## Modal System
- **What:** centralized modal composition for session, project, SSH, persistent terminal, recording, path picker, confirm dialogs, and agent-driven modals.
- **Purpose:** isolate high-risk or focused actions from the main workspace.
- **User value:** safer operations (confirmations) and cleaner UX for complex forms.
- **Key files:** `maestro-ui/src/components/app/AppModals.tsx`, `maestro-ui/src/components/modals/AgentModalViewer.tsx`.

## Session Log Strip + Log Modal
- **What:** live, collapsible strip inside terminal pane plus full session log modal with chat/context views and live polling.
- **Purpose:** expose execution telemetry without leaving the working terminal.
- **User value:** fast debugging and auditability of agent behavior, token usage, and context growth.
- **Key files:** `maestro-ui/src/components/session-log/SessionLogStrip.tsx`, `maestro-ui/src/components/session-log/SessionLogModal.tsx`, `maestro-ui/src/components/session-log/SessionLogViewer.tsx`.

## Status Indicators
- **What:** task status badges, session state chips, needs-input markers, live dots, strategy badges, board stats.
- **Purpose:** provide glanceable health/progress across tasks and sessions.
- **User value:** users spot blockers, active work, and required intervention immediately.
- **Key files:** `maestro-ui/src/components/maestro/TaskListItem.tsx`, `maestro-ui/src/components/SessionsSection.tsx`, `maestro-ui/src/components/maestro/StrategyBadge.tsx`, `maestro-ui/src/components/maestro/MultiProjectBoard.tsx`.

## Why This Structure Works
- Project tabs define context.
- Session list controls execution units.
- Terminal pane is the action surface.
- Maestro panel handles planning/orchestration.
- Modals and logs support deep or risky operations without cluttering the base layout.

This creates a predictable loop: **pick project -> choose task/session -> execute in terminal -> monitor status/logs -> update task state**.
