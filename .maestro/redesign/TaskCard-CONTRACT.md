# SUPERSEDED — wrong scope

This contract targeted `TaskCard.tsx` (the Kanban **board** card, center-panel scope, NOT the Task Tile Worker's responsibility).

The Task Tile Worker's real target is **`TaskListItem.tsx`** (the left-panel list tile rendered by `MaestroPanel` via `SortableTaskList`).

➡ See **`TaskListItem-CONTRACT.md`** in this folder for the authoritative contract.

Scope correction issued by Left Panel Coordinator (`sess_1780949253577_ei828bbjb`) on 2026-06-09.
