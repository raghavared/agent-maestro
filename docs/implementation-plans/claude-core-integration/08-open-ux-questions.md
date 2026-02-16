# 08. Open UX Questions (Needs Decisions)

These decisions should be finalized before implementation starts.

## A. Primary Entry Point
1. Where should users first access this feature?
- Option A: new tabs inside `MaestroSessionContent` (recommended for v1)
- Option B: new global right-panel mode
- Option C: both from day one

2. Should this feature appear only for sessions with detectable intelligence data, or always with empty-state guidance?

## B. Information Density
3. In `Trace`, what should the default expansion level be?
- collapsed groups
- expanded latest group only
- fully expanded

4. Should tool payloads show full raw JSON by default or summarized text by default with expand-to-raw?

5. Should subagent trees be inline in trace rows or in a dedicated `Subagents` sub-tab?

## C. Context UX
6. Should token/context display be:
- per-turn absolute counts
- percentages only
- both (recommended)

7. Do we need compaction visualization in v1, or can it wait for v2?

8. Should context categories use source labels (`CLAUDE.md`, `mentions`, etc.) or Maestro-specific labels (`workspace docs`, `attached files`, etc.)?

## D. Alerting and Badges
9. Which alerts should be shown in session list by default?
- tool errors
- high token usage
- subagent spawn bursts
- sensitive file access patterns

10. Should alerts be informational only or actionable (click to jump to exact trace event)?

## E. Cross-Agent Behavior
11. For non-Claude tools (Codex/Gemini), should we:
- hide unsupported sections
- show partial timeline based on Maestro events
- show synthetic normalized trace (if possible)

12. Should UI explicitly label “data fidelity” per session (e.g., full Claude log vs partial event-derived)?

## F. Performance & Fetch Strategy
13. Fetch model on session open:
- eager summary + lazy detail (recommended)
- all in one request

14. Should the UI auto-refresh intelligence for active running sessions?
- every N seconds
- WebSocket-driven only
- manual refresh only

## G. Privacy/Security UX
15. Should sensitive paths/contents be redacted in UI by default?

16. Do we need a per-project toggle to disable session intelligence parsing entirely?

## H. Team Workflow
17. Should intelligence views be shareable/exportable (JSON/Markdown) in v1?

18. Should task cards show rolled-up intelligence KPIs (tokens, tool errors, subagents) from linked sessions?
