# FileExplorerPanel-CONTRACT.md

Worker: Files View Worker (sess_1780985092991_x2ewy9lsc)
Scope file: `maestro-ui/src/components/FileExplorerPanel.tsx` (1271 lines)
Design source: `panel-redesign/views.jsx` → `FilesView` + `FRow`
Foundation consumed: `redesign/redesign-views.css` (pn-fvrow* / pn-vframe / pn-vhd / pn-files*), `redesign/redesign-tokens.css` (pn-ib / pn-head-spacer), `redesign/kit.tsx` (`Icon` + `PN_ICONS` incl. folderOpen + fileCode — both LIVE).

Rule: APPEARANCE ONLY. Zero functionality changes. Every prop/hook/handler/ref/effect/a11y attr preserved verbatim. SWAP-OUTRIGHT (pn-* unconditional, no dual className, no theme gating).

---

## A. Functional surface — PRESERVED VERBATIM (touch nothing)

Props (14): isOpen, provider, sshTarget, rootDir, persistedState, activeFilePath, onSelectFile, onOpenTerminalAtPath, onPersistState, onClose, onPathRenamed, onPathDeleted.

State/refs/effects (all preserved): expandedDirs, dirStateByPath, panelRef, listRef, scrollTop, listHeight, contextMenu(+ref), rename* (target/value/busy/error/inputRef), delete* (target/busy/error), download* (busy/error), dragDropActive, dropTarget, dragPreparing, mouseDownRef, dragAttemptSeqRef, dropRafRef, lastDropPosRef, all *Ref mirrors, persistTimerRef. All useEffect/useLayoutEffect/useCallback/useMemo kept.

Handlers preserved: loadDirectory, toggleDir, refreshRoot, submitRename, confirmDelete, handleDownload, getDragIcon, resolveDropDestination, transferDroppedPaths, initiateNativeDrag, handleMouseDown/Move/Up, persistStateNow, schedulePersist, remap/removeDirectoryPrefix, copyToClipboard.

Virtualization preserved verbatim: rowHeight=28, overscan=12, startIndex/endIndex/topSpace/bottomSpace windowing, paddingTop/paddingBottom spacer div.

Per-row data attrs + a11y PRESERVED: `data-fs-entry-path`, `data-fs-entry-is-dir`, `role="treeitem"`, `aria-expanded`, `title`, `onMouseDown/Move/Up`, `onClick`, `onContextMenu`, `key`. Container `role="tree"`, `ref={listRef}`. Root `ref={panelRef}`, `aria-label="Files"`.

Context menu, rename modal, ConfirmActionModal (delete), download-error modal: OUT OF SCOPE for this view re-skin (they are modal surfaces; Modal Sweep owns modal chrome). Left UNCHANGED.

---

## B. Visual surface — REPLACED (old class → pn-* design class)

| Element | OLD class | NEW (design) | Source |
|---|---|---|---|
| Root container | `aside.fileExplorerPanel` (CLASS KEPT for resizable/flex docked layout across 3 mounts) | bg/border REPOINTED in styles-file-explorer.css → `var(--pn-surface)` + `var(--pn-line-2)` (ruling 1: pn-vframe SURFACE without fixed 380×660/shadow/radius that would break docking) | views.css :8 |
| Header bar | `div.fileExplorerHeader` | `div.pn-vhd` | :12 |
| (header lead icon) | *(none)* | `<Icon name="folder" size={16} style={{color:var(--pn-ink-3)}}/>` | views.jsx :112 |
| Title block | `div.fileExplorerTitle` | `div` (minWidth:0 wrapper) | :113 |
| Title text "Files" | `span` | `div.pn-vhd__title` | :114 |
| Path subtext | `span.fileExplorerPath` | `div.pn-files__path` | :115 |
| Spacer | *(flex)* | `span.pn-head-spacer` *(coordinator override of pn-vhd__sp)* | tokens :253 |
| Actions wrap | `div.fileExplorerActions` | *(removed — buttons are direct pn-vhd children)* | — |
| Refresh btn | `button.btnSmall.btnIcon` + `Icon name=refresh` (./Icon) | `button.pn-ib` + `<Icon name="refresh"/>` (kit) | :118 |
| Close btn | `button.btnSmall.btnIcon` + `Icon name=close` (./Icon) | `button.pn-ib` + `<Icon name="x"/>` (kit) | :119 |
| Scroll list | `div.fileExplorerList(+DropTarget)` | `div.pn-vscroll` style paddingTop:6 (+ drop-target conditional class kept for DnD feedback) | :19 |
| Row | `button.fileExplorerRow(+Active/Context/Drop/Preparing)` | `button.pn-fvrow(+--active)` | :64 |
| Disclosure/twisty | `span.fileExplorerDisclosure` ▾/▸ | folder: `span.pn-fvrow__tw(+--open)` w/ `<Icon name="chevronR"/>`; file: empty `span.pn-fvrow__tw` | :68 |
| Icon | `span.fileExplorerIcon` + `<FileIcon/>` | `span.pn-fvrow__ic--folder/file` wrapping **`<FileIcon/>` KEPT** (ruling 3 — preserve per-ext fidelity) | :71 |
| Name | `span.fileExplorerName` | `span.pn-fvrow__name` | :74 |
| Git badge | *(none)* | **OMITTED** (ruling 2 — no git data; threading = new feature) | — |
| Footer | *(none)* | **OMITTED** (ruling 2 — no M/A/D/branch data) | — |
| loading row | `div.fileExplorerRow.fileExplorerMeta` | `div.pn-fvrow` (empty tw, name=loading…, muted) | design-silent |
| error row | `div.fileExplorerRow.fileExplorerMeta.fileExplorerError` | `div.pn-fvrow` (name=failed to load, --block tint) | design-silent |
| empty state | `div.empty` | kept (design-silent) | — |

Depth indent: OLD `12 + depth*14` → NEW `10 + depth*15` (FRow `pad = 10 + f.depth*15`, views.jsx :74). Applied to entry rows + loading/error rows.

Icon mapping: dir → `folderOpen` if expanded else `folder`; file → always `doc` (see ESCALATION 3 — no `code` flag to choose `fileCode`).

---

## ESCALATIONS → RESOLVED by coordinator (sess_1780984680638_nmq7c12mj)

1. **Container dims** — RESOLVED. Apply pn-vframe SURFACE (flipping bg + design border), DROP fixed 380×660/`--tall`/shadow/radius (docked, not floating card). Realized by KEEPING `fileExplorerPanel` class (preserves resizable+flex layout across AppLeftPanel/AppRightPanel/AppWorkspace) and repointing its bg→`var(--pn-surface)`, border→`var(--pn-line-2)` in styles-file-explorer.css. Adding the class itself would force a fixed 380px width and break the resizable docked column.
2. **Git data absent** — RESOLVED: OMIT per-row git badges, deleted line-through, AND `pn-files__foot` footer (no data; git feed deferred to a future feature task). No dead markup left.
3. **fileCode vs doc** — RESOLVED: OVERRIDE doc-default. KEEP `<FileIcon>` (rich per-extension IntelliJ-style glyph w/ open/closed folders) for BOTH files and folders, inside the `pn-fvrow__ic--file/--folder` box. Kit `chevronR` twisty + depth indent + pn-fvrow chrome adopted from design; FileIcon's own colors stand. Noted defensible deviation (preserve fidelity > match mock lacking extension data).

## Retained functional-feedback (design-silent, transient — flagged)

`fileExplorerListDropTarget` (DnD over root), `fileExplorerRowContext` (context-menu-open row), `fileExplorerRowDropTarget` (DnD over row), `fileExplorerRowPreparing` (SSH drag-download in flight) — kept appended to pn-fvrow/pn-vscroll to preserve interaction feedback AND keep `isContextTarget/isDropTarget/isPreparing` vars referenced. These reuse legacy hardcoded cyan/white accents (styles-file-explorer.css :99-103,:135,:227-229), shown only transiently mid-interaction — not theme-flipping surfaces. Coordinator may later tokenize; left as-is per appearance-only + preserve-behavior.
