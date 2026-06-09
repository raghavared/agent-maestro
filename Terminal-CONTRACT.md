# Terminal-CONTRACT.md — Terminal Chrome Re-skin (`pn-term-*`)

**Worker:** 💻 Terminal Theme Worker (`tm_1780948939436_q7ap3u0fe`)
**Coordinator:** 🎛️ Middle Panel Coordinator (`sess_1780949254944_6jpoi5ju2`)
**Status:** STUDY + CONTRACT ONLY. No edits made. Gate: waiting for `FOUNDATION-DONE.md`. GAP decisions from coordinator are now FINAL (see §5).
**Scope:** appearance-only re-skin of the terminal *chrome* (the wrapper around the live xterm). ZERO functionality changes.

---

## 0. Files

| Role | Path |
|---|---|
| In scope (edit later) | `maestro-ui/src/components/app/AppWorkspace.tsx` — `terminalPane` block, lines ~306-421 |
| In scope (edit later) | `maestro-ui/src/styles-terminal-theme.css` (chrome CSS, scrollbars) |
| In scope (edit later) | `maestro-ui/src/styles-sessions.css` (referenced by directive; **no terminal-chrome rules actually live here** — see §5) |
| Chrome CSS actually lives in | `maestro-ui/src/styles-update-banner.css` (`.terminalPane`, `.terminalContainer`, `.terminalHidden` @ lines 98-136), `maestro-ui/src/styles-terminal-empty.css` (empty hero), `maestro-ui/src/styles-coordinator-glow.css` (`.coordinator-glow`, `.modeChip`) |
| Design source | `panel-redesign/shell.jsx` `Terminal()` (lines 160-188); tokens `panel-redesign/theme.css` lines 593-613 |
| Foundation (consume) | `maestro-ui/src/components/maestro/redesign/redesign-tokens.css` (pn-term @ 608-627), `kit.tsx` |
| OFF-LIMITS (read-only) | `maestro-ui/src/SessionTerminal.tsx`, reparenting in `MultiProjectSessionsView.tsx` + `TeamView.tsx`, `SessionActionBar.tsx` |

---

## 1. Functional surface — PRESERVE VERBATIM

Every item below must survive the re-skin byte-for-byte in behavior. None may be removed, reordered, or have its props/identifiers changed.

### 1a. `terminalPane` wrapper (lines 306-314)
- `className` template: `terminalPane`, conditional `terminalPane--dragOver` (from `terminalDragOver` state), conditional `terminalPane--teamView` (from `teamViewOpen`). **Keep all three class hooks** — `--teamView` disables CSS containment so `position:fixed` TeamView children escape (styles-update-banner.css:116-122). `--dragOver` is the drop highlight.
- `aria-label="Terminal"` — preserve.
- `style={!isActiveSession ? { display: "none" } : undefined}` — preserve exactly; this is the center-pane visibility seam.
- Drag handlers: `onDragOver={handleTerminalDragOver}`, `onDragEnter={handleTerminalDragEnter}`, `onDragLeave={handleTerminalDragLeave}`, `onDrop={handleTerminalDrop}` — preserve all four (task→terminal drop flow, `dragCounterRef`).

### 1b. Overlays rendered inside `terminalPane` (lines 315-335) — NOT my files, leave untouched
- `<SessionLogStrip>` — live activity strip overlay (own coordinator/owner). Props `key/cwd/maestroSessionId/agentTool`. Do not touch.
- `<SessionActionBar>` — **explicitly OFF-LIMITS** (other coordinator). Props `maestroSessionId/onAttach/onDraw`. Do not touch.
- `<ModeChip>` — role chip overlay (`styles-coordinator-glow.css`). Props `mode`. Not in my chrome scope; leave as-is unless coordinator reassigns.

### 1c. Center-pane decision tree (lines 348-420) — PRESERVE STRUCTURE
- `inspectedMaestroSession` branch → `terminalContainer` with `data-terminal-id={`maestro:${id}`}` hosting `<SessionStatsView>`. Keep `coordinator-glow` conditional + `data-terminal-id`.
- else branch:
  - `terminalEmptyState` hero (lines 362-383) shown when `!sessions.some(s => s.id === activeId)`. ASCII + caret + hint. Visual-only element → re-skinnable (see §2/§4), but the **render condition must not change**.
  - `sessions.map(...)` (lines 385-418): for each session a `terminalContainer` with:
    - **`data-terminal-id={s.id}`** — ⚠️ CRITICAL: the reparenting logic in `MultiProjectSessionsView.tsx`/`TeamView.tsx` queries `[data-terminal-id]` to move terminal nodes. Must NOT be renamed, removed, or wrapped such that the query breaks.
    - `className` template: `terminalContainer`, conditional `terminalHidden` (when `s.id !== activeId`), conditional `coordinator-glow`. **Keep all three** — `terminalHidden` (visibility:hidden + pointer-events:none) keeps off-screen PTYs mounted without unmounting. Renaming = live-terminal regression.
    - `key={s.id}` — preserve.
    - `inactiveMaestroSession` swap → `<SessionStatsView>`; else `<SessionTerminal>` with props `id/active/readOnly/persistent/onCwdChange/onCommandChange/onResize/registry/pendingData`. **Preserve every prop verbatim.** `registry`/`pendingData` are the xterm registry refs the reparent logic depends on.
- The `isInactive` / `inactiveMaestroSession` predicate (lines 390-394) — preserve verbatim.

### 1d. CSS structural invariants — must remain true after restyle
- `.terminalPane` keeps `contain: strict` + `transform: translateZ(0)` in the non-teamView case (xterm compositing perf). If I change background/border, I must NOT drop containment/transform.
- `.terminalContainer` keeps `position:absolute; inset:0` + `zoom: calc(1 / var(--app-zoom-scale))` (line 130) — the zoom neutralization keeps xterm mouse coords aligned. **Do not remove.**
- `.terminalHidden` keeps `visibility:hidden; pointer-events:none`.
- xterm viewport scrollbar rules (styles-terminal-theme.css:401-441, incl. `overflow-y: overlay !important`) — keep behavior; may retoken colors only.

---

## 2. Visual surface — what the re-skin MAY change (FINAL, per coordinator)

The design `pn-term` is a self-contained flex column: **bar (40px) · body (flex) · input row**. Our app is structurally different (see §3). Coordinator confirmed **SKIP the bar and input rows** (§5). The **net edit surface** is exactly three things:

| Visual element | Current | Becomes | File |
|---|---|---|---|
| Terminal pane background (the dark surround behind xterm) | `.terminalPane` / `.terminalContainer` — currently transparent/inherited | `pn-term` dark surface (≈`#1c1a16` light / `#100E0A` dark) — **terminal stays dark in BOTH themes** ✔. Sourced from foundation token, NOT raw hex / NOT `--pn-paper` (see §3a flag). | `styles-update-banner.css` |
| Empty-state hero (`terminalEmptyState`) | cyberpunk green ASCII + caret | restyle to `pn-term-body` warm idiom: body ink ≈`#cfc9bb`, prompt/caret accent ≈`#d99a4e`, hint dim ≈`#8a8474`, `--pn-mono`. Visual-only element; render condition unchanged. | `styles-terminal-empty.css` |
| xterm viewport scrollbar tint | `rgba(var(--theme-primary-rgb),…)` | retoken to muted warm grey to match `pn-term` (optional, low priority). | `styles-terminal-theme.css` |

**LEAVE AS-IS this pass (coordinator):** `coordinator-glow` (role indicator, not retokenizing now); all overlays — `SessionLogStrip`, `ModeChip`, `SessionActionBar` (off-limits). Do not restyle any overlay.

**The terminal body itself (`pn-term-body` log lines: `l-prompt ›`, `l-ok`, `l-dim`, `l-file`, `l-acc ●`, `pn-tcursor`) is the LIVE xterm output.** Its colors are owned by the xterm `theme` object inside `SessionTerminal.tsx` (OFF-LIMITS). I will NOT fake a body, and I cannot restyle real PTY output from the chrome layer. The design's body styling is used ONLY as the visual idiom for the empty-state hero.

---

## 3. Token + kit-primitive mapping (per design element)

Foundation classes are published under `html[data-redesign]` in `redesign-tokens.css` (verbatim from `panel-redesign/theme.css`). Mapping of each `pn-term` design element:

| Design (`shell.jsx` Terminal) | Class | Foundation token / source | Maps to existing DOM? |
|---|---|---|---|
| `pn-term` container | `.pn-term` (tokens:608) | bg `#1c1a16` light / `#100E0A` dark; flex column | **`.terminalPane` (+ `.terminalContainer` bg)** — partial; ours is absolute-stacked, not a 3-row flex |
| `pn-term-bar` (dot+name+`·`+agent·model+branch) | `.pn-term-bar`, `.pn-tdot`, `.pn-tslash`, `b` (tokens:609-615) | h40, border-bottom `#2c2922`, `--pn-mono` 12px, `#a9a294`; dot `#5aa777`; name `#e6e0d3` | **❌ NO COUNTERPART — see GAPS** |
| `pn-term-body` | `.pn-term-body` + `.l-prompt/.l-dim/.l-ok/.l-file/.l-acc` (tokens:616-621) | `--pn-mono` 12.5px, `#cfc9bb`; accents `#d99a4e`/`#7bb98e`/`#8a8474`/`#cbb98a` | **= LIVE xterm (off-limits)** — used only as the idiom for the empty-state hero restyle |
| `pn-tcursor` | `.pn-tcursor` (tokens:622) | `#d99a4e`, `pn-caret` keyframe | empty-state caret (`terminalEmptyCaret`) restyle only |
| `pn-term-input` (`/` + placeholder + model·effort) | `.pn-term-input`, `.pn-tslash` (tokens:623-627) | border-top `#2c2922`, `--pn-mono` 12px, `#7d7768` | **❌ NO COUNTERPART — see GAPS** |
| Kit primitives | `Icon`, `AgentTile`, `Mark` (`kit.tsx`) | — | not needed for chrome unless a bar is added (then `AgentTile kind={agent}`) |

`--pn-mono` = `'JetBrains Mono', ui-monospace, 'SF Mono', monospace` (redesign-tokens.css:50).

### 3a. ⚠️ TOKEN-SOURCING FLAG → foundation (blocks the no-raw-hex rule)

Coordinator's rule: source pane surface + hero from **foundation pn-term tokens, NOT raw hex, NOT `--pn-paper`**. Verified state of `redesign-tokens.css` (lines 608-627): the `pn-term` block exposes **only `.pn-term*` CSS classes with literal hex** — there are **no standalone `--pn-term-*` CSS variables** (`grep` for `--pn-term*` returns nothing).

Consequence:
- The **pane background** can be sourced by applying the `.pn-term` class itself (it carries `background:#1c1a16`) — but `.terminalPane`/`.terminalContainer` are perf-fenced wrappers; adding `.pn-term` wholesale also pulls `display:flex; flex-direction:column` which conflicts with our `position:absolute; inset:0` stack. So I need a **variable**, not the class.
- The **empty-state hero** is NOT a `.pn-term-body` element; it cannot inherit class styling and needs the raw color values.

**RESOLVED (coordinator escalated to parent → Foundation).** Foundation will add these theme-invariant vars (verbatim from the design) and repoint the existing `.pn-term*` literals at them:
```
--pn-term-bg:    #1c1a16;   /* dark surface — ONLY this flips: dark-theme override #100E0A */
--pn-term-ink:   #cfc9bb;   /* body text — CONSTANT both themes */
--pn-term-acc:   #d99a4e;   /* prompt / caret accent (l-prompt/l-acc) — CONSTANT */
--pn-term-dim:   #8a8474;   /* dim / hint (l-dim) — CONSTANT */
```
Only `--pn-term-bg` has a dark override; `ink`/`acc`/`dim` are constant — **do not add a dark override for them** (none exists today).

**Implementation rule — SINGLE PATH (waiver RESCINDED by coordinator):**
- The lead granted the **real vars via Foundation Addendum v2** (adds `--pn-term-bg/-ink/-acc/-dim`, with dark override `--pn-term-bg:#100E0A`, and repoints the existing `.pn-term*` literals at them).
- **Consume the foundation `--pn-term-*` vars directly.** Do NOT define local vars. Never inline raw hex at use sites.
- **GATE:** these vars land in Addendum v2 which is **NOT yet published**. My 3 edits all depend on them, so I HOLD until the coordinator broadcasts v2 live — even though the team gate is otherwise open.

**Swap rule (Ruling #1 — SWAP OUTRIGHT):** adopt the tokens **unconditionally**. No `useRedesignTheme` gating, no conditional dual `className`s. Terminal bg stays dark in BOTH themes — `--pn-term-bg` simply flips between two dark values (`#1c1a16` ↔ `#100E0A`) via `html[data-theme="dark"]`.

---

## 4. Concrete re-skin plan (pending FOUNDATION-DONE + coordinator go)

1. `.terminalPane` / `.terminalContainer`: set background to the `pn-term` dark surface (`#1c1a16` light theme, `#100E0A` dark) so the surround matches the design and stays dark in both themes. Preserve `contain`/`transform`/`zoom`/`position` invariants (§1d).
2. `terminalEmptyState` hero: re-token from cyberpunk-green to `pn-term-body` warm idiom — body `#cfc9bb`, prompt/caret `#d99a4e` (`l-prompt`/`pn-tcursor`), hint `#8a8474` (`l-dim`). Keep render condition + DOM shape; swap colors/fonts to `--pn-mono` + pn-term hexes (these are literal in the design — terminal stays dark, so they are not theme-variable).
3. xterm scrollbar tint: optionally retoken to warm grey. Low priority; behavior unchanged.
4. No new DOM unless coordinator approves the GAPS below.

---

## 5. GAPS — design elements with NO existing counterpart → DECISIONS FINAL

Coordinator (`sess_1780949254944_6jpoi5ju2`) resolved all gaps. Decisions baked in below:

1. **`pn-term-bar` (static header: dot + name + `agent · model` + branch) — ❌ SKIP (do NOT invent).**
   Resolution: no new static bar. Reasons: (a) zero-functionality rule, and (b) **branch name has NO in-scope data source** — a faithful bar would require new git-branch wiring = a functionality change = forbidden. App already surfaces name/agent/model via existing overlays. **Do NOT restyle `SessionLogStrip` or `ModeChip` either — all overlays untouched this pass.** Coordinator is flagging this plan-deviation to the parent coordinator for cross-panel consistency; I proceed assuming SKIP.

2. **`pn-term-input` (static `/` slash row) — ❌ SKIP (confirmed).**
   A static row would be functionally inert (real input lives inside the xterm PTY). No decorative input row.

3. **`pn-term-body` log-line colors (`l-prompt/l-ok/l-dim/l-file/l-acc`) — OFF-LIMITS (confirmed).**
   Owned by the xterm `theme` object in `SessionTerminal.tsx`. Not touched. Used ONLY as the visual reference for the empty-state hero.

4. **CSS file locations — RESOLVED: edit where the rules live.**
   `styles-update-banner.css` (`.terminalPane`/`.terminalContainer`/`.terminalHidden`), `styles-terminal-empty.css` (hero), `styles-terminal-theme.css` (scrollbar tint). **Strictly scope edits to terminal-chrome rules — do NOT touch unrelated rules sharing those files.** `coordinator-glow`: LEAVE AS-IS this pass. (`styles-sessions.css` from the original directive holds no terminal-chrome rules — not edited.)

5. **Token-sourcing — RESOLVED, single path (see §3a).**
   Foundation Addendum v2 adds `--pn-term-bg/ink/acc/dim` (only `bg` flips dark via `data-theme`). Waiver RESCINDED — consume the foundation vars directly, no local vars, no raw hex. Adopt **unconditionally** (Ruling #1 swap-outright: no theme gating, no dual classNames). v2 not yet published → I HOLD until coordinator says v2 is live.

---

## 6. Summary (FINAL — decisions baked)

- **Net edit surface (3 things only):** (1) terminal pane DARK background in `styles-update-banner.css`; (2) empty-state hero → warm `pn-term-body` idiom in `styles-terminal-empty.css`; (3) optional scrollbar tint in `styles-terminal-theme.css`. Strictly terminal-chrome rules only.
- **SKIPPED per coordinator:** `pn-term-bar`, `pn-term-input` (no invention), all overlays, `coordinator-glow` (leave as-is).
- **OFF-LIMITS confirmed:** xterm body colors (`SessionTerminal.tsx` theme), reparenting logic, `SessionActionBar`.
- Every functional surface in §1 preserved verbatim — `data-terminal-id`, `terminalHidden`, `registry`/`pendingData` props, `.terminalContainer` zoom, `.terminalPane` contain/transform.
- **Token-sourcing RESOLVED (§3a):** consume Foundation Addendum v2 vars `--pn-term-bg/ink/acc/dim` directly (waiver rescinded — no local vars, no raw hex). Adopt unconditionally (no theme gating / dual classNames); `--pn-term-bg` flips dark via `data-theme`.
- **No file edited.** Team gate is open but my edits depend on Addendum v2 (`--pn-term-*` vars) — holding specifically until coordinator broadcasts v2 live.
