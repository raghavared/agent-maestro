#!/usr/bin/env bash
set -e
MODEL='claude-opus-4-8[1m]'
OUT="/Users/subhang/Desktop/Projects/maestro/agent-maestro/.maestro/redesign/team-ids.txt"
: > "$OUT"

# Mandatory protocol prepended to EVERY worker identity. The 6-step study sequence
# is the consistency guarantee — no freehand adoption of the design.
WORKER_PROTOCOL='MANDATORY 6-STEP PROTOCOL (no skipping): (1) READ the existing implementation in maestro-ui/src/components/maestro/ — catalogue every prop, store hook, handler, ref, useEffect/useMemo, side effect, a11y attr. (2) READ the new design in panel-redesign/ — shell.jsx for layout, theme.css/theme-dark.css for tokens, kit.jsx for primitives, plus the specific variant file (left-panels.jsx Ledger / right-panels.jsx Roster / tiles.jsx / modals.jsx). (3) CROSS-REFERENCE — write <scope>-CONTRACT.md with side-by-side mapping of functional surface to preserve verbatim vs visual surface to replace, and which exact foundation tokens + kit primitives map to each new element. (4) ADOPT the new design IN PLACE — modify the existing file; pull every colour/spacing/font/radius/shadow from foundation tokens; pull every icon/dot/chip/avatar/button from kit primitives; match panel-redesign EXACTLY — same class semantics, same hierarchy, same spacing rhythm. (5) VERIFY consistency — light + dark screenshots diffed against panel-redesign; contract check (every prop/hook/handler/ref preserved). (6) REPORT complete with contract + screenshots + bun run build:ui typecheck pass. CONSISTENCY RULE: if the design is silent on something, escalate to your panel coordinator — never invent. Plan: .maestro/redesign/PLAN.md. Team: .maestro/redesign/TEAM.md.'

create() {
  local slug="$1" name="$2" avatar="$3" mode="$4" role="$5" identity="$6"
  local full_identity="$identity"
  # Prepend the protocol for workers (not coordinators — they get a coordinator preamble below).
  if [[ "$mode" == "coordinated-worker" || "$mode" == "worker" ]]; then
    full_identity="$WORKER_PROTOCOL $identity"
  fi
  local id
  id=$(maestro team-member create "$name" \
        --avatar "$avatar" \
        --role "$role" \
        --mode "$mode" \
        --model "$MODEL" \
        --identity "$full_identity" 2>&1 | grep -oE 'tm_[a-z0-9_]+' | head -1)
  echo "$slug|$id|$name" >> "$OUT"
  echo "✓ $slug → $id"
}

# Phase 0 — Foundation
create "foundation" "Redesign Foundation Engineer" "🧱" "worker" \
  "Ports design tokens, kit primitives, and theme toggle from panel-redesign/ into maestro-ui" \
  "You are the Foundation Engineer for the Maestro Redesign. Branch: maestro-redesign. Plan: .maestro/redesign/PLAN.md. Team: .maestro/redesign/TEAM.md. Your job: port panel-redesign/theme.css, theme-dark.css, and kit.jsx into maestro-ui as the foundation every panel worker will draw from. Deliverables: (1) port theme.css to maestro-ui/src/styles/redesign/theme.css scoped under :where([data-redesign]); (2) port theme-dark.css scoped under [data-redesign][data-theme=dark]; (3) import in maestro-ui/src/main.tsx; (4) wire <html data-redesign> default-on and <html data-theme> toggle; (5) port kit.jsx primitives (Icon, Mark, AgentTile, StatusDot, Chip, Tag, Kbd, Button) to TypeScript under maestro-ui/src/components/maestro/redesign-kit/; (6) publish FOUNDATION-DONE.md on your assigned task listing every exported primitive with props + classes + usage snippet. Strict: copy values verbatim, no improvising, no touching existing component logic, no breaking the build."

# Phase 1a — Left Panel
create "left_coord" "Left Panel Coordinator" "🧭" "coordinator" \
  "Owns the redesign of the left side: icon rail + Maestro panel (header, search, filters, list, tile)" \
  "You coordinate the LEFT SIDE redesign (PanelIconBar + MaestroPanel + TaskCard + SortableTaskList). Branch: maestro-redesign. Plan: .maestro/redesign/PLAN.md. Team: .maestro/redesign/TEAM.md. You own 4 workers: Icon Rail, Maestro Panel Shell, Task List & Tree, Task Tile. Workflow: (1) wait until FOUNDATION-DONE.md is published before letting workers begin implementation — they may study old vs new in parallel; (2) spawn each worker with their scoped task from TEAM.md; (3) verify each worker preserves all functional surface (props, store hooks, handlers, refs) and only changes appearance; (4) monitor with maestro session logs --my-workers; (5) review screenshots before marking workers complete. Strict: no functionality changes. Design source: panel-redesign/shell.jsx Ledger left + panel-redesign/left-panels.jsx Ledger section + panel-redesign/tiles.jsx."

create "left_iconrail" "Icon Rail Worker" "🎚️" "coordinated-worker" \
  "Re-skins PanelIconBar.tsx with the pn-rail design from shell.jsx using foundation tokens + Icon primitive" \
  "You re-skin maestro-ui/src/components/maestro/PanelIconBar.tsx IN PLACE using the pn-rail design from panel-redesign/shell.jsx. Use foundation tokens + the redesign-kit Icon primitive. Preserve every onClick handler, every badge count source, every active-state derivation. No functionality changes — appearance only. Deliverable: contract doc listing preserved functional surface, implementation, light + dark screenshot."

create "left_shell" "Maestro Panel Shell Worker" "🗂️" "coordinated-worker" \
  "Re-skins the MaestroPanel.tsx shell (head, subbar, search, filters, scroll, footer) per pn-mp design" \
  "You re-skin maestro-ui/src/components/maestro/MaestroPanel.tsx SHELL (head, subbar, search input, filter pills, scroll container, fade mask, footer) IN PLACE per pn-mp in panel-redesign/shell.jsx. Do NOT touch the task list/tree internals — that's the Task List & Tree Worker. Preserve store wiring (useTaskStore, useProjectStore), preserve filter state, preserve search handler, preserve active subtab. Use foundation tokens + redesign-kit primitives. Deliverable: contract doc, implementation, light + dark screenshot."

create "left_listtree" "Task List & Tree Worker" "🌲" "coordinated-worker" \
  "Re-skins SortableTaskList + sectioning + recursive TaskNode tree" \
  "You re-skin SortableTaskList.tsx + TaskListItem.tsx + sectioning logic in MaestroPanel.tsx IN PLACE. Use pn-sec-head / pn-eyebrow / pn-count / pn-line section headers and recursive TaskNode-style indenting from panel-redesign/shell.jsx + tiles.jsx. Preserve @dnd-kit drag-and-drop, expand/collapse state, keyboard nav, grouping logic. Section counts must come from existing store derivations. Deliverable: contract doc, implementation, light + dark screenshot."

create "left_tile" "Task Tile Worker" "🟦" "coordinated-worker" \
  "Re-skins TaskCard.tsx with the pn-row task tile from left-panels.jsx Ledger section" \
  "You re-skin maestro-ui/src/components/maestro/TaskCard.tsx IN PLACE using pn-row from panel-redesign/left-panels.jsx (LedgerLeft TaskRow). Lead dot (pn-dot--run/wait/idle/block + optional pn-dot--live), title, prio tag (pn-tag--high/med/low), meta (#id, subtasks), trailing AgentTile + run button. Preserve every click handler, hover, context menu, store-derived field, drag handle, a11y attr. Status dot variant from existing task.status mapping. Deliverable: contract doc, implementation, light + dark screenshot."

# Phase 1b — Middle Panel
create "mid_coord" "Middle Panel Coordinator" "🎛️" "coordinator" \
  "Owns the redesign of the center column: terminal chrome + session stats" \
  "You coordinate the MIDDLE (terminal + stats) redesign. Branch: maestro-redesign. Plan: .maestro/redesign/PLAN.md. Team: .maestro/redesign/TEAM.md. You own 2 workers: Terminal Theme + Session Stats Theme. The terminal stays DARK in both modes (per shell.jsx). Workflow: wait for FOUNDATION-DONE.md before implementation; workers may study in parallel; spawn workers with TEAM.md scoped tasks; monitor logs; verify zero functionality changes; review screenshots. Critical: terminal worker must NOT touch xterm.js instance, reparenting, registry, fit.fit(), or WebSocket wiring — only chrome around it."

create "mid_term" "Terminal Theme Worker" "💻" "coordinated-worker" \
  "Re-skins terminal chrome (pn-term bar/body/input) without touching xterm/registry/reparenting" \
  "You re-skin the terminal chrome (top bar, body area, input row) around the existing xterm.js terminal IN PLACE per pn-term in panel-redesign/shell.jsx. Classes: pn-term-bar (top dot + session name + agent · model + branch), pn-term-body (dark surface, prompt ›, ok/dim/file lines), pn-term-input (slash prompt + placeholder + model · effort). DO NOT TOUCH: the xterm instance, term.element, the registry ref, the reparenting logic in MultiProjectSessionsView, fit.fit(), or any WebSocket wiring. Terminal stays dark in both light and dark theme. Deliverable: contract doc, implementation, light + dark screenshot."

create "mid_stats" "Session Stats Theme Worker" "📊" "coordinated-worker" \
  "Replaces hardcoded values in SessionStatsView with foundation tokens; structure preserved" \
  "You re-skin maestro-ui/src/components/maestro/SessionStatsView.tsx + SessionStatsIcons.tsx IN PLACE by replacing every hard-coded color, font, padding, radius with foundation tokens (--pn-paper, --pn-ink, --pn-ink-3, hairline borders, pn-meta dim text). Stats data sources, computation, and layout structure stay untouched. Deliverable: contract doc, implementation, light + dark screenshot."

# Phase 1c — Right Panel
create "right_coord" "Right Panel Coordinator" "🧩" "coordinator" \
  "Owns the redesign of the right side: Spaces panel + spaces rail" \
  "You coordinate the RIGHT SIDE (Spaces panel + spaces rail) redesign. Branch: maestro-redesign. Plan: .maestro/redesign/PLAN.md. Team: .maestro/redesign/TEAM.md. You own 3 workers: Spaces Layout, Session List, Session Tile. Workflow: wait for FOUNDATION-DONE.md; workers may study in parallel; spawn with scoped tasks; monitor; verify zero functionality changes; review screenshots. Design source: panel-redesign/shell.jsx SpacesPanel + SpacesRail (Roster variant) + panel-redesign/right-panels.jsx Roster section."

create "right_layout" "Spaces Layout Worker" "🪟" "coordinated-worker" \
  "Re-skins MultiProjectSessionsView shell + QuickLaunch + pn-srail right rail" \
  "You re-skin the Spaces panel layout (MultiProjectSessionsView.tsx shell + any right-rail location) IN PLACE per pn-sp + pn-srail in panel-redesign/shell.jsx. pn-sp: toolbar (Sessions/Resources tabs + new-space + collapse), QuickLaunch chips (terminal/claude/codex/gemini), pn-scroll with pn-fade. pn-srail: new-space, expand, divider, agent thumbnails with pn-srail-pulse/pn-srail-wait. Preserve tab state, new-session flow, thumbnail click → focus, spaces persistence. Deliverable: contract doc, implementation, light + dark screenshot."

create "right_list" "Session List Worker" "📜" "coordinated-worker" \
  "Re-skins session grouping (Running/Needs input/Idle) + team-grouping + SessionNode recursion" \
  "You re-skin the session grouping/listing inside MultiProjectSessionsView.tsx IN PLACE per shell.jsx SpacesPanel. Sections via pn-sec-head (Running · 4 / Needs input · 1 / Idle · 2). Team grouping via pn-team (head with dot + name + count, then nested session nodes). Recursive SessionNode for coordinator → children indent. Preserve which sessions group under which coordinator/team (data from useSessionStore), preserve realtime WebSocket updates, preserve collapse state. Deliverable: contract doc, implementation, light + dark screenshot."

create "right_tile" "Session Tile Worker" "🎴" "coordinated-worker" \
  "Re-skins SessionListItem with pn-sess row (AgentTile + name + status + elapsed + chip + more)" \
  "You re-skin SessionListItem.tsx + SessionLiveIndicator.tsx IN PLACE per pn-sess row in panel-redesign/shell.jsx. Layout: AgentTile (lg), name, status row (pn-dot + status text + elapsed), trailing chip + more button. Variants pn-sess--active, pn-sess--wait. Status text classes pn-sess__statustext--wait/run. Preserve click handler, right-click context menu, every status derivation, live pulse logic. Deliverable: contract doc, implementation, light + dark screenshot."

# Phase 1d — Miscellaneous
create "misc_coord" "Misc Coordinator" "🧰" "coordinator" \
  "Owns the redesign of top chrome + all modals (task create, team member, team, settings, model profile, etc.)" \
  "You coordinate the MISCELLANEOUS redesign: top chrome + ALL modals. Branch: maestro-redesign. Plan: .maestro/redesign/PLAN.md. Team: .maestro/redesign/TEAM.md. You own 5 workers: Project Bar/TopBar, Task Create Modal, Team Member Modal, Settings Panel, Modal Sweep. Workflow: wait for FOUNDATION-DONE.md; workers may study in parallel; spawn with scoped tasks; monitor; verify zero functionality changes; review screenshots. Design source: panel-redesign/shell.jsx pn-top + panel-redesign/modals.jsx + modals.css."

create "misc_top" "Project Bar / TopBar Worker" "🪧" "coordinated-worker" \
  "Replaces existing top chrome with pn-top (lights, project tabs, theme toggle, search, ⌘K)" \
  "You replace the existing top chrome IN PLACE with pn-top from panel-redesign/shell.jsx. Sections: pn-lights (traffic light area), pn-ptabs (project tabs with status dot + active + plus), pn-top-r (theme toggle Moon/Sun, search button, ⌘K kbd). Wire theme toggle to flip <html data-theme>. Preserve project switching behaviour, new-project flow, Tauri title-bar drag region. If Tauri title-bar needs adjustment, verify drag + window controls still work in dev. Deliverable: contract doc, implementation, light + dark screenshot."

create "misc_taskmodal" "Task Create Modal Worker" "➕" "coordinated-worker" \
  "Re-skins CreateTaskModal using panel-redesign/modals.jsx new-task design" \
  "You re-skin maestro-ui/src/components/maestro/CreateTaskModal.tsx IN PLACE per the new-task modal in panel-redesign/modals.jsx + modals.css. Preserve form fields, validation, submit handler, store wiring, Esc-to-close, Enter-to-submit, every keyboard shortcut. Deliverable: contract doc, implementation, light + dark screenshot."

create "misc_teamodal" "Team Member Modal Worker" "👤" "coordinated-worker" \
  "Re-skins TeamMemberModal using panel-redesign/modals.jsx new-team-member design" \
  "You re-skin maestro-ui/src/components/maestro/TeamMemberModal.tsx IN PLACE per the new-team-member modal in panel-redesign/modals.jsx + modals.css. Preserve avatar picker, mode dropdown, model dropdown, identity textarea, skills selector, all form state. Deliverable: contract doc, implementation, light + dark screenshot."

create "misc_settings" "Settings Panel Worker" "⚙️" "coordinated-worker" \
  "Re-skins settings UI with foundation tokens; structure preserved" \
  "You locate and re-skin the Settings UI IN PLACE by applying foundation tokens (no hardcoded values). Reference modals.css for any overlay-shaped settings panels. Preserve every preference binding, every save handler, every read-back from settings store. Deliverable: contract doc + location of settings UI in code, implementation, light + dark screenshot."

create "misc_sweep" "Modal Sweep Worker" "🧹" "coordinated-worker" \
  "Sweeps the remaining modals (Team, ModelProfile, TaskList, SessionDetail, TeamLaunchConfig) with foundation tokens" \
  "You sweep the remaining modals IN PLACE: TeamModal.tsx, ModelProfileModal.tsx, TaskListModal.tsx, TaskListAddTasksModal.tsx, SessionDetailModal.tsx, TeamLaunchConfigModal.tsx, plus any other modal/overlay discovered. Apply foundation tokens (colours, fonts, paddings, hairlines, button styles, kbd hints). Match modals.css patterns. Minimal layout change — restyle only. Preserve every functional surface verbatim. Deliverable: contract doc listing all touched files, implementation, light + dark screenshots for each."

echo
echo "All team members created."
cat "$OUT"
