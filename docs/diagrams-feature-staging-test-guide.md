# Diagrams-as-Docs — Staging Test Guide

Everything shipped across 4 phases. Server/UI/CLI test suites are green. This guide gives you
(A) a paste-in prompt that makes an agent create a diagram and attach it to a task, and
(B) a manual staging walkthrough of every flow.

---

## A. Agent prompt — create a diagram & attach to a task

Paste this into a **running maestro session** (the agent has `MAESTRO_SESSION_ID` set, which
`task docs add` requires). Replace `<TASK_ID>` with a real task id (run `maestro task list`).

> Create an Excalidraw diagram and attach it to task `<TASK_ID>` as a diagram doc.
>
> 1. Write the following scene to `./diagram-test.excalidraw`:
>
> ```json
> {
>   "type": "excalidraw",
>   "version": 2,
>   "source": "maestro",
>   "elements": [
>     {"id":"rect-1","type":"rectangle","x":100,"y":100,"width":220,"height":120,"angle":0,
>      "strokeColor":"#1e1e1e","backgroundColor":"#a5d8ff","fillStyle":"solid","strokeWidth":2,
>      "strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"frameId":null,
>      "roundness":{"type":3},"seed":1,"version":1,"versionNonce":1,"isDeleted":false,
>      "boundElements":null,"updated":1,"link":null,"locked":false},
>     {"id":"text-1","type":"text","x":130,"y":145,"width":160,"height":25,"angle":0,
>      "strokeColor":"#1e1e1e","backgroundColor":"transparent","fillStyle":"solid","strokeWidth":2,
>      "strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"frameId":null,
>      "roundness":null,"seed":2,"version":1,"versionNonce":2,"isDeleted":false,"boundElements":null,
>      "updated":1,"link":null,"locked":false,"text":"Hello Maestro","fontSize":20,"fontFamily":1,
>      "textAlign":"left","verticalAlign":"top","containerId":null,"originalText":"Hello Maestro",
>      "lineHeight":1.25,"baseline":18}
>   ],
>   "appState": {"viewBackgroundColor":"#ffffff","gridSize":null},
>   "files": {}
> }
> ```
>
> 2. Run: `maestro task docs add <TASK_ID> "Hello Diagram" --file ./diagram-test.excalidraw --kind diagram`
> 3. Verify with: `maestro task docs list <TASK_ID>` (the new entry should show kind=diagram).

**CLI prerequisite (important):** the `--kind` flag is new. The installed CLI (`~/.maestro/cli/bundle.cjs`)
is shared by prod + staging and is stale. Refresh it before testing the agent path:

```bash
cd maestro-cli && bun run bundle && cp dist/bundle.cjs ~/.maestro/cli/bundle.cjs
```

(Or use `scripts/deploy-maestro.sh`.) If you'd rather not touch the shared binary, the agent can
hit the staging API directly instead of the CLI:

```bash
curl -X POST http://localhost:4569/api/tasks/<TASK_ID>/docs \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello Diagram","filePath":"diagram-test.excalidraw","kind":"diagram","sessionId":"<SESSION_ID>","content":"<scene-json-string>"}'
```

---

## B. Manual staging walkthrough

### 0. Start staging
```bash
bun run dev:all
```
Server :4569, UI (Vite) :4568, data in `~/.maestro-staging/data/`. Open the staging UI window.

### 1. Create a diagram (UI)
- Spaces panel → **New** dropdown → **Whiteboard** (now persists as a diagram doc, not localStorage).
- Or on a task: the **+ Diagram** action → creates a blank diagram doc and opens it.
- Draw something. **Verify:** changes auto-save — server writes `data/session-docs/<sessionId>/<docId>.excalidraw`
  (debounced PUT `/api/sessions/:id/docs/:docId/content`). Reload the app; the drawing persists.

### 2. View ⇄ Edit in DocViewer
- Open the diagram from a docs list. It mounts read-only (view mode).
- Hit the **Edit** toggle → canvas becomes editable; make a change; it saves back. Toggle to view → re-renders.

### 3. Attach to task + related-diagrams row
- Confirm the diagram appears under the task (diagram docs are split from markdown docs).
  Run `maestro task docs list <TASK_ID>` — diagram shows `kind=diagram`.

### 4. Inline embed inside a markdown document
- Create/open a markdown doc and add a fenced block:
  ```
  ```excalidraw
  <docId-of-the-diagram>
  ```
  ```
- **Verify:** the referenced diagram renders inline (read-only) with an Open/Edit affordance.

### 5. Project Resources view
- Spaces panel → **Resources**. **Verify:** lists all project artifacts (docs + diagrams + task images).
  Filter chips **All / Docs / Diagrams / Images** narrow the list; search filters by title; clicking a
  row opens it as a space.

### 6. Export to live session (inject)
- Open a diagram in a session-origin board → **Export to Session** → pick a running session.
- **Verify:** `POST /api/sessions/:id/inject-diagram` writes `diagram_<ts>.png` + `diagram_<ts>.excalidraw`
  to `<project.workingDir>/.maestro/diagrams/`, and the target session's terminal receives a prompt
  with both paths (`PNG (view): …`, `Excalidraw (edit): …`). The agent can then open the PNG.

### 7. Import
- In the board, **Import** button → choose a `.excalidraw` file → scene loads onto the canvas.
- Import an **image** (PNG/JPG) → it's placed on the canvas as an image element to annotate.

### Where data lands (staging)
- Diagram/doc content: `~/.maestro-staging/data/session-docs/<sessionId>/<docId>.excalidraw`
- Injected diagrams: `<project working dir>/.maestro/diagrams/`
- Task images: `~/.maestro-staging/data/images/<projectId>/<taskId>/`

### Quick green-path checklist
- [ ] New diagram persists across reload (server-backed, not just localStorage)
- [ ] Edit toggle saves changes back
- [ ] Diagram attached to task shows kind=diagram (`task docs list`)
- [ ] Inline ```excalidraw <docId>``` embed renders in a markdown doc
- [ ] Resources view filters + search + open-as-space work
- [ ] Export-to-session writes png+excalidraw and injects the prompt
- [ ] Import of .excalidraw and image both work
- [ ] Agent CLI `task docs add --kind diagram` works (after bundle refresh)
