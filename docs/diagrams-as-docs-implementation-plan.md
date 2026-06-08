# Diagrams-as-Docs: Implementation Plan

## Goal

Make Excalidraw diagrams first-class, server-persisted artifacts that are connected to
tasks, sessions, and projects — exactly like documents are today. Deliver the UI/UX to
create, import, edit, view, inject, and browse diagrams and documents together.

## Design decisions (approved)

1. **Diagrams reuse the docs pipeline.** A diagram is a `DocEntry` with `kind: "diagram"`.
   Its content file is the Excalidraw scene JSON (`.excalidraw`) stored where doc content
   already lives. Task/session aggregation, CLI, and linking work unchanged.
2. **Editable everywhere.** `DocViewer` renders a diagram doc with a *full editable*
   Excalidraw canvas (view ⇄ edit toggle), saving scene changes back to the server.
3. **Inline-in-document.** A markdown doc can embed a diagram reference that renders the
   diagram inline (read-only thumbnail/canvas) with a click to open & edit — same spirit as
   the existing inline Mermaid rendering.
4. **Inject to live session = PNG + `.excalidraw`, both referenced.** Export writes both
   files to disk and injects a prompt pointing at both paths via the existing
   `session:prompt_send` → `write_to_session` plumbing.
5. **Project Resources view** built on the existing Spaces panel, backed by a new
   `GET /projects/:id/docs` aggregation, with type filters (Docs / Diagrams / Images).
6. **Import** `.excalidraw` files and images (image placed on canvas to annotate).

---

## Data model

`DocEntry` (maestro-ui/src/app/types/maestro.ts:274, maestro-server/src/types.ts:437):

```ts
kind?: "markdown" | "diagram";   // default "markdown" (back-compat)
```

- For `kind: "diagram"`, `contentFilePath` points to a `{docId}.excalidraw` file whose
  content is `JSON.stringify({ elements, appState, files })`.
- `filePath` keeps a human-facing name ending in `.excalidraw`.
- No other schema changes; back-compat preserved (absent `kind` ⇒ markdown).

## Storage

- Reuse the existing doc content directory (`data/session-docs/{sessionId}/`). Diagram
  content file is `{docId}.excalidraw` instead of `{docId}.md`. `addDoc` and
  `getDocContent` already write/read `contentFilePath` verbatim — only the extension differs.

---

## Phase 1 — Backend foundation

**Implement**
- Add `kind` to `DocEntry` (server `types.ts` + ui `maestro.ts`).
- `FileSystemSessionRepository.addDoc`: accept `kind`, choose `.excalidraw` vs `.md`
  extension for the content file; persist `kind` in session JSON.
- `SessionService.addDoc` + `getSessionDocsWithContent`: thread `kind` through.
- New endpoint to **update** a diagram doc's scene content:
  `PUT /api/sessions/:id/docs/:docId/content` (body: `{ content }`) → rewrites the content
  file. (Docs are currently write-once + read; diagrams need re-save.)
- `GET /api/projects/:id/docs`: aggregate all docs (markdown + diagram) across every task &
  session in the project, content lazily hydrated, deduped by docId.
- Zod schemas for new/extended routes in `validation.ts` (allow `.excalidraw`, `kind`,
  larger content cap for scene JSON).
- CLI: `maestro task docs add ... --kind diagram` and `maestro session docs add ... --kind diagram`.

**Test**
- Repo unit tests: add diagram doc → `.excalidraw` file written, `kind` persisted, content
  round-trips; update content endpoint rewrites file.
- Route tests: `GET /projects/:id/docs` aggregates and dedupes; PUT content validation.
- CLI test: `--kind diagram` produces a diagram doc.

## Phase 2 — Diagram persistence + editable viewer + inline-in-doc

**Implement**
- `ExcalidrawBoard`: add a `mode` (`edit` | `view`) and an optional `docId`/save callback.
  When backed by a doc, debounced changes PUT scene JSON to the content endpoint (localStorage
  remains the cache for unsaved scratch boards). `view` mode renders `viewModeEnabled`.
- `DocViewer`: if `doc.kind === "diagram"`, mount `ExcalidrawBoard` (view by default, with an
  Edit toggle that switches to editable + wires save-back). Markdown path unchanged.
- **Inline-in-document**: in `DocViewer`'s markdown renderer, detect an embed directive
  (e.g. a fenced ```` ```excalidraw\n<docId>\n``` ```` block or `![[diagram:<docId>]]`),
  fetch that diagram doc, and render it inline read-only with an "Open / Edit" affordance.
- Diagram creation entry points: "+ Diagram" on a task (writes a diagram doc), in the
  session detail view, and the existing Spaces "New Whiteboard" now persists as a doc.
- Task detail: add a **related diagrams** row next to the existing docs row
  (TaskListItem.tsx:758) opening the diagram in a space.
- `useSpacesStore`: whiteboards become doc-backed (persist via server) rather than
  localStorage-only; keep a localStorage fast-path cache.

**Test**
- UI/Vitest: DocViewer renders a diagram doc in view mode; Edit toggle enables editing;
  save callback fires (mock client) on change.
- Inline embed: a markdown doc containing the embed directive renders the referenced diagram.
- Board save debounce calls the content endpoint once per settle.

## Phase 3 — Project Resources view

**Implement**
- Spaces panel/rail gains a "Resources" mode listing all project artifacts from
  `GET /projects/:id/docs` + `task.images[]`, with type filters (Docs / Diagrams / Images)
  and text search; each row links back to its task/session and opens as a space.
- `MaestroClient.getProjectDocs(projectId)`.

**Test**
- UI test: filters narrow by type; search filters by title; clicking opens the right space.
- Client test: getProjectDocs hits the endpoint.

## Phase 4 — Export/inject to session + import

**Implement**
- "Export to Session" picker (sibling of `ExportToTaskPicker`): choose a running session →
  server writes `diagram.png` + `diagram.excalidraw` to a working path → `POST
  /api/sessions/:id/prompt` injects a message referencing both file paths.
- Import: pick/drop a `.excalidraw` file → creates a diagram doc; drop an image → opens a
  board with the image placed on canvas to annotate (Excalidraw `addFiles` + image element).

**Test**
- Export-to-session writes both files and posts the prompt (mock).
- Import: `.excalidraw` file becomes a diagram doc; image import yields a board with the
  image element present.

---

## File touch map (primary)

- Server: `types.ts`, `FileSystemSessionRepository.ts`, `SessionService.ts`,
  `sessionRoutes.ts`, `taskRoutes.ts`, `projectRoutes.ts` (new project docs route),
  `validation.ts`.
- CLI: `commands/task.ts`, `commands/session.ts`, `prompting/capability-policy.ts`.
- UI: `app/types/maestro.ts`, `app/types/space.ts`, `stores/useSpacesStore.ts`,
  `components/ExcalidrawBoard.tsx`, `components/maestro/DocViewer.tsx`,
  `components/maestro/DocsList.tsx`, `components/maestro/TaskListItem.tsx`,
  `components/SpacesPanel.tsx`, `components/SpacesRail.tsx`,
  new `ExportToSessionPicker.tsx`, `utils/MaestroClient.ts`.

## Sequencing & risk

- Phases are **dependent**: P2/P3/P4 build on P1's schema + endpoints, and they touch
  overlapping files (`DocEntry`, `DocViewer`, `ExcalidrawBoard`). Run **sequentially** to
  avoid merge conflicts; P3 and P4 can overlap once P2 lands.
- Back-compat: absent `kind` ⇒ markdown; existing docs and the localStorage whiteboards keep
  working during migration.
