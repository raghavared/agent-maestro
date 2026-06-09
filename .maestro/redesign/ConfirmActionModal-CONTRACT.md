# ConfirmActionModal — Re-skin Contract

**Scope:** `maestro-ui/src/components/modals/ConfirmActionModal.tsx` (62 lines) — ONE FILE.
Shared confirm dialog powering ~8 consumers (App, SessionsSection, FileExplorerPanel,
CodeEditorPanel, TaskListItem, TeamListItem, TaskListsPanel, AppModals). Appearance only.

## (a) Functional surface — PRESERVED VERBATIM

| Prop / behavior | Preserved |
|---|---|
| `isOpen` → `if (!isOpen) return null` | yes |
| `title` (string) | yes — rendered in `pn-dlg__title` |
| `message` (ReactNode) | yes — rendered in `pn-dlg__msg` |
| `confirmLabel` (default "Confirm") | yes — confirm button label |
| `cancelLabel` (default "Cancel") | yes — cancel button label |
| `confirmDanger` (bool) | yes — drives icon variant + confirm button style |
| `busy` (bool) | yes — disables all buttons; confirm shows "Working…"; backdrop click guarded |
| `onClose` | yes — backdrop click (busy-guarded) + Cancel button |
| `onConfirm` | yes — confirm button |
| backdrop click closes (unless busy) | yes |
| inner click `stopPropagation` | yes |

No props removed, no handlers changed, no busy logic changed. ZERO functionality change.

## (b) Visual surface — REPLACED

| Old (themed*) | New (pn-* redesign) |
|---|---|
| `themedModalBackdrop` (outer) | **KEPT** — see Open Question below |
| `themedModal` | `pn-dlg` |
| `themedModalHeader` | `pn-dlg__hd` |
| `themedModalTitle` | `pn-dlg__icon pn-dlg__icon--{danger\|warn}` (+ `<Icon name="alert"/>`) + `pn-dlg__title` |
| `themedModalClose` (×) | **DROPPED** glyph — onClose still reachable via backdrop + Cancel (coordinator-sanctioned, safe) |
| `themedModalContent` > `themedFormHint` | `pn-dlg__body` > `pn-dlg__msg` |
| `themedFormActions` | `pn-dlg__foot` + `pn-head-spacer` + Cancel + confirm |
| `themedBtn` (Cancel) | `pn-btn pn-btn--ghost` |
| `themedBtn themedBtnPrimary/Danger` (confirm) | danger: `pn-btn` + inline `{background:var(--pn-block),color:#fff,borderColor:var(--pn-block)}`; else: `pn-btn pn-btn--primary` |

## (c) Exact tokens + kit per element

- Icon: `Icon` from `../maestro/redesign/kit`, glyph `alert` (size 18 for both variants — generic
  NEVER-INVENT-safe warning glyph; design's per-dialog x/trash are mockup-only).
- `pn-dlg__icon--danger` → color `--pn-block` / bg `--pn-block-soft` (when `confirmDanger`).
- `pn-dlg__icon--warn` → color `--pn-wait` / bg `--pn-wait-soft` (when not danger).
- Confirm danger style copies views.jsx CloseSessionDialog/DeleteTaskDialog verbatim.
- All bg/line/text colors come from `--pn-*` tokens via the pn-dlg/pn-btn CSS (redesign-views.css
  + redesign-tokens.css). No hardcoded hex except `#fff` confirm-text per design.
- Footer spacer is `pn-head-spacer` (flex:1, redesign-tokens.css:253) — NOT `pn-sp` (the `.pn-sp`
  views flex-spacer rules were dropped by Foundation; `.pn-sp` is now the 340px Spaces container).

### confirmDanger → variant decision (coordinator ruling)
The modal is generic title/message-driven; it does NOT know close-vs-delete semantics.
- `confirmDanger === true`  → icon `--danger`, confirm button danger-styled (inline `--pn-block`).
- `confirmDanger` falsy     → icon `--warn`, confirm button `pn-btn--primary`.
No `pn-dlg__warn` row is rendered — that row is content specific to the standalone mockups
(liveCount/working). The generic `message` ReactNode is rendered as-is inside `pn-dlg__msg`.

## OPEN QUESTION (escalated to coordinator) — backdrop / scrim

Directive says `themedModalBackdrop -> pn-scrim`. But foundation `.pn-scrim`
(redesign-views.css:122) is a **440px relative stage block** (`position:relative; width:392px
content; padding:34px; background:rgba(40,34,24,0.14)`) — a showcase container, NOT a fixed
fullscreen dimming overlay. There is no fullscreen modal-scrim defined anywhere in the
foundation. `themedModalBackdrop` (styles-themed-components.css:5) is the real overlay
(`position:fixed; inset:0; background:rgba(0,0,0,.8); flex-center; z-index:1000`).

Making `pn-scrim` a live overlay would require inventing fullscreen positioning + a dim color
(violates NEVER-INVENT; foundation pn-scrim bg is a 14% warm tint, not a modal dim).

**Sibling precedent:** `task-modal/ConfirmDiscardDialog.tsx` (already re-skinned & accepted by
Misc) KEEPS `themedModalBackdrop` as the overlay and reskins only the inner card to `pn-mdl`.

**Implemented per that precedent** (keep `themedModalBackdrop` overlay, inner → `pn-dlg`).
Awaiting coordinator confirmation that this is acceptable vs. adding a foundation fullscreen
`pn-scrim--overlay` variant.
