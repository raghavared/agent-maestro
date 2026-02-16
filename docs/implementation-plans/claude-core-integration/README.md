# Claude Core Integration Plan For Maestro

## Goal
Integrate the core session-intelligence logic from `matt1398/claude-devtools` into Maestro as first-class product functionality, with tight coupling to Maestro's existing session/task model and UI.

This plan is intentionally implementation-ready for a follow-up coding pass by another LLM.

## What This Packet Contains
1. `01-source-system-analysis.md`
Source-system decomposition: what claude-devtools does, what is reusable, what is not.

2. `02-maestro-fit-analysis.md`
Current Maestro architecture analysis and exact insertion points.

3. `03-target-architecture.md`
Proposed architecture in Maestro (server + UI + optional Tauri bridge).

4. `04-module-port-and-rewrite-plan.md`
Detailed module-copy/rewrite strategy, including path mapping and adaptation rules.

5. `05-ui-ux-integration-plan.md`
Concrete UI integration options and recommended user flows.

6. `06-api-and-data-contracts.md`
Proposed API contracts and internal DTOs for parsed session intelligence.

7. `07-delivery-phases-and-testing.md`
Phased delivery plan, acceptance criteria, risks, and test strategy.

8. `08-open-ux-questions.md`
UX/product decisions required before implementation.

9. `09-implementation-backlog.md`
File-by-file migration backlog and execution sequence for the coding pass.

## Scope Boundary
- We are not consuming claude-devtools as a dependency.
- We are porting selected logic patterns and rewriting to Maestro domain types and architecture.
- Primary target runtime is `maestro-server` + `maestro-ui`.

## Existing Maestro References Used
- `maestro-ui/src/App.tsx`
- `maestro-ui/src/components/app/AppWorkspace.tsx`
- `maestro-ui/src/components/AppRightPanel.tsx`
- `maestro-ui/src/components/maestro/MaestroPanel.tsx`
- `maestro-ui/src/components/maestro/MaestroSessionContent.tsx`
- `maestro-ui/src/stores/useSessionStore.ts`
- `maestro-ui/src/hooks/useMaestroWebSocket.ts`
- `maestro-ui/src/utils/MaestroClient.ts`
- `maestro-server/src/server.ts`
- `maestro-server/src/api/sessionRoutes.ts`
- `maestro-server/src/application/services/SessionService.ts`
- `maestro-server/src/types.ts`

## Source Repo Snapshot Used
- Repo: `https://github.com/matt1398/claude-devtools`
- Commit analyzed: `c9ed63af5555b1cd45ea6c34ca8de37bb1062df4`
- Analyzed date: February 15, 2026
