# Integration Review Rubric — Maestro Redesign

**Reviewer:** 🎛️ Middle Panel Coordinator, acting as Independent Integration Reviewer (READ-ONLY).
**Authority:** review only — never edit branch files. Findings route to the lead coordinator (`sess_1780949006649_b85y7wovc`), who relays to the owning panel coordinator.
**Sources of truth:** `.maestro/redesign/PLAN.md` (Worker Protocol), `.maestro/redesign/FOUNDATION-DONE.md` (v2.1 token/class/primitive catalog), `panel-redesign/*` (design), each branch's `<scope>-CONTRACT.md`.

**Completion gate (lead policy):** a branch completes on its **STATIC/code-level verdict** — Axis 1 (functional, from the diff) + code-level Axis 2 (container-leak / dual-theme / font, from the diff/CSS). **Empirical/visual/screenshot items are DECOUPLED** from completion (live capture is bottlenecked on the Accessibility grant): collect them into `FINAL-VISUAL-PASS-CHECKLIST.md` and run them in ONE operator pass before cutover. Give the static verdict now; queue the visual items.

**Mandate:** report *real issues only* — preserved-surface violations, hardcoded design values, or visual mismatches — each as `file:line`. No nits, no restyling opinions, no praise padding. If a branch is clean, say so in one line.

---

## How to run a branch review (per branch, as it completes)

Inputs the lead hands me: the branch's git diff (or list of changed files) + its CONTRACT(s).

1. **Read the contract(s) first** — note every *sanctioned exception* the contract declared (categorical hues, fixed literals with no token, motion values, preserved structural dims). These are pre-approved and must NOT be reported as violations.
2. **Diff every changed file** — `git diff -- <files>`; read added lines in full.
3. **Axis 1 — Functional surface preserved** (see checklist).
4. **Axis 2 — Visual fidelity** (see checklist + automated scans).
5. **Request light + dark screenshots** from the Screenshots Worker (`sess_1780953175711_pzzhco61r`) and eyeball against `panel-redesign/` for the branch's scope.
6. **Branch-end typecheck** (read-only): `cd maestro-ui && bunx tsc -b` → must be EXIT 0. Do NOT run `bun run build:ui` (production bundle contention — lead owns the single final build).
7. **Report findings** to the lead, per file:line, tagged by axis + severity.

---

## Axis 0 — CSS PARSES CLEAN (HARD gate, Phase-2 addition)

`tsc -b` does **NOT** parse `.css` — a CSS syntax/comment break sails past typecheck and takes the staging GUI down at runtime (one unclosed comment `-*/` already did this). For **every changed `.css` file** in a cleanup surface:
- [ ] File parses with no error. Coordinator's workers run `cd maestro-ui && node -e "require('postcss').parse(require('fs').readFileSync('<file>','utf8'))"` per changed file.
- [ ] Common breakers to eyeball in the diff: unterminated comment (`/* …` with no `*/`, or a stray `-*/`), unbalanced `{`/`}`, a `var(` with no closing `)`, a rule body with a missing `;` before `}` on multi-decl lines.

🚩 **Report as blocker:** any changed `.css` file that was **not** parse-validated, or that fails `postcss.parse`. This gates the surface regardless of Axis 1/2 cleanliness — a parse break is a live GUI outage.

---

## Axis 1 — FUNCTIONAL SURFACE PRESERVED (zero functionality changes)

The redesign is appearance-only. For each re-skinned component, every item below must survive **byte-for-byte in behavior** vs the pre-redesign version. Compare the diff: a redesign edit should touch only `className` strings, inline-`style` token values, and JSX wrapper markup — never logic.

- [ ] **Props** — every prop in the component signature unchanged (name, type, default). No prop added/removed/renamed.
- [ ] **Store hooks** — every `useSessionStore`/`useTaskStore`/`useProjectStore`/`useMaestroStore`/etc. selector unchanged (same slices, same order).
- [ ] **Handlers** — every `onClick`/`onChange`/`onSubmit`/`onDrag*`/`onContextMenu`/keyboard handler preserved and bound to the same element role.
- [ ] **Refs** — every `useRef`/`forwardRef`/callback-ref intact; DOM nodes the ref targets still exist with the same identity.
- [ ] **Effects/memos** — every `useEffect`/`useMemo`/`useCallback` unchanged (deps array identical, body unchanged).
- [ ] **Conditional render & state** — render conditions, `useState` shape, and which branch shows when are unchanged. No tabs/IA added or removed (PLAN: "never add tabs/IA").
- [ ] **a11y** — `aria-*`, `role`, `title`, `alt`, `tabIndex`, `focusable` all preserved.
- [ ] **Identity/data attributes** — `data-*` hooks that other code queries are intact. **Known critical:** `data-terminal-id` (reparenting query), `terminalHidden` class (keeps off-screen PTYs mounted), `registry`/`pendingData` props, `data-session-id`. Renaming/removing any = live regression.
- [ ] **Portals** — `createPortal` targets unchanged.
- [ ] **No dropped element** — a functional surface with no home in the simplified design is KEPT in its current logical section, restyled with tokens — never deleted (PLAN ruling #2).

🚩 **Report as violation:** any logic line changed, any selector/handler/ref/effect altered, any element silently removed, any `data-*`/class hook renamed that something queries.

---

## Axis 2 — VISUAL FIDELITY

> **✅ FONT-FIDELITY UNBLOCKED (Foundation v2.2).** Hanken Grotesk (`--pn-ui`) + Newsreader (`--pn-serif`) are now bundled via `@fontsource` (imported in `main.tsx`), JetBrains Mono (`--pn-mono`) self-hosted in `styles.css`, and the dead Google-Fonts `@import` is removed. All three resolve under CSP `'self'`, so the real Tauri app and harness/browser captures render identical type. **Axis 2b font-family + 2c type rendering are now in scope** — verify `--pn-ui`/`--pn-serif`/`--pn-mono` are actually applied (not a system fallback) on each branch's light+dark captures.

### 2a. No hardcoded design values
Everything visual comes from `--pn-*` tokens (FOUNDATION-DONE §4) or kit primitives (§2). **Always `var(--pn-x)`, never raw hex/rgb.**

Automated scan (added lines only):
```sh
# raw hex in added lines
git diff -- <files> | grep -nE '^\+' | grep -iE '#[0-9a-fA-F]{3,8}\b'
# hardcoded px in added lines
git diff -- <files> | grep -nE '^\+' | grep -oE '[0-9]+px' | sort | uniq -c
# raw rgb()/rgba() in added lines
git diff -- <files> | grep -nE '^\+' | grep -iE 'rgba?\('
```

**SANCTIONED — do NOT report (verify each against the contract):**
- **Terminal `pn-term*` dark hex** consumed via `--pn-term-bg/-ink/-acc/-dim` vars (FOUNDATION §4 terminal table). The remaining un-tokenized terminal literals (`#2c2922`/`#221E15` borders, `#a9a294`/`#e6e0d3` bar text, `#5aa777` tdot, `#7bb98e` l-ok, `#cbb98a` l-file, `#7d7768`/`#6a6457` input) live in the **foundation** file, not worker files — flag only if a *worker* re-introduced one.
- **`#20160a` on-brass text** — foundation exposes no `--pn-on-accent` token; this is the foundation's own `pn-btn--primary` on-brass literal. Acceptable only if single-sourced (one var def, referenced elsewhere).
- **Categorical / data-viz hues** that encode identity not chrome (e.g. `AGENT_HUES`, token-bar `violet`/`teal`) — kept verbatim by contract; re-skinning them would destroy the data signal.
- **Hex inside comments** (documentation), **mask alphas** (`#000`/`#fff` in a `linear-gradient` mask, not a visible color), **motion** (`120ms`/cubic-bezier — foundation doesn't tokenize motion), and **preserved structural dimensions** (a `2px` border-width / existing layout px that pre-existed and was only color-swapped). Radii/spacing that the design tokenizes (`--pn-r-*`) MUST use the token; arbitrary one-off geometry the design itself hard-codes is copied verbatim.

🚩 **Report as violation:** a *new* raw hex/rgba for a themeable color where a `--pn-*` token exists; a hardcoded radius where `--pn-r-*` applies; a literal that breaks in one theme (e.g. theme-flipping `--pn-ink` used as text-on-bright-fixed-avatar, which fails dark — should be a fixed on-accent literal).

### 2b. Class semantics match the design
- [ ] Classes used exist in the FOUNDATION catalog (§5/§6/§8). A class **not** listed = invented → 🚩 (should have been escalated, not fabricated).
- [ ] DOM structure/hierarchy matches `panel-redesign/` for that scope (same nesting, same child class roles).
- [ ] Kit primitives used where the design uses them (`Icon`/`Mark`/`AgentTile`/`Glyph`/`Avatar`) rather than re-implemented inline SVG/markup.
- [ ] Net-new classes limited to the 4 coordinator-authorized primitives (`pn-btn--danger`, `pn-range`, `pn-mtabs--vert`, `pn-switch--danger`). Anything else net-new = 🚩.
- [ ] No `--pn-brand-3` / lighter-brass requests — hover collapses to `--pn-brand` (deliberately not added).

### 2d. Container-background leak (HARD branch-end gate)
Old theme vars/hex are **unscoped** (defined in `styles-variables.css`, e.g. `--theme-primary-rgb: 0,255,65` neon green, `--panel`, `--bg-elevated`), so a leftover reference is NOT overridden by `data-redesign` and bleeds through. A leftover **container/wrapper background** on an old dark value makes the LIGHT theme render a dark box behind the paper `pn-*` cards. (Right caught this in `styles-spaces-panel.css`: `#080a0f`, `var(--bg-elevated,#1a1b26)`.)

Scan the branch's `styles-*.css` (whole file, not just the diff — a leak often hides in an *unchanged* rule):
```sh
grep -nE 'background' -- <branch styles-*.css> | grep -niE \
 'theme-primary|[^-]panel|panel-2|bg-elevated|bg-app|var\(--bg-|var\(--panel|#080a0f|#0a0c10|#1a1b26'
```
- [ ] Every **container/wrapper** background repointed to `--pn-*` (`--pn-paper`/`--pn-surface`/`--pn-card`). 🚩 if a panel/wrapper bg still references an old theme var or dark hex.
- [ ] Old-theme **accent** vars too: `rgba(var(--theme-primary-rgb), …)` tints render as neon green under the warm aesthetic — flag if on a **rendered** element in the branch's scope (check the class is actually used in a `.tsx`; dead CSS = note-only).
- [ ] Confirm via the **LIGHT-theme screenshot**: panel containers are paper, not dark; accents are brass, not neon.

**Not a leak (sanctioned):** terminal surfaces (`--pn-term-bg`) are intentionally dark in light theme; `background: none`/transparent; a tokenized `var(--pn-*)` or `var(--ssv-*)`-indirected bg.

**SCOPING (lead ruling):** apply the 2d gate ONLY to files/components a branch **actually re-skinned in its owned scope** (the 4 panels + the in-scope modals). A legacy leak in a shared or un-owned component that **nobody re-skinned this pass** (e.g. `.terminalMetaBadge--*` in TeamListItem/TeamMemberList/ModelProfilesPanel, board/ResourcesView/ZoomSetting, dead CSS) is **optional-follow-up, NOT a blocker** — log it for later, do not fail the branch. Verdict is judged against what the branch touched, not pre-existing legacy in files it left alone.

### 2c. Dual-theme correctness
- [ ] **Swap outright** (ruling #1): components adopt `pn-*`/token values UNCONDITIONALLY. No `useRedesignTheme` gating of markup, no conditional dual classNames. The only runtime visual toggle is light/dark via `data-theme`.
- [ ] **Trust the theme STATE, not the filename** — a capture is only valid for dual-theme judgment if its `data-theme` was deterministically forced + asserted (Screenshots Worker now does this). A mislabeled light-shot-as-dark once produced a false "paper-in-dark" alarm; confirm the asserted state before flagging.
- [ ] **BIDIRECTIONAL container check (lead ruling) — review BOTH screenshots of the light+dark pair:**
   - LIGHT screenshot → panel containers/surfaces are **paper** (`--pn-paper`/`--pn-surface` light), not a stuck dark box (the 2d forward leak).
   - DARK screenshot → the **same** containers go **graphite** (`--pn-paper`=#15130E / `--pn-surface`=#1B1810 dark), not stuck paper/white. A container that stays paper in dark is the **same leak class, reverse direction** — a missing `html[data-redesign][data-theme='dark']` flip or a hardcoded light bg. Dark tokens exist, so there is no excuse for a paper panel in dark.
- [ ] Renders correctly in **light** AND **dark** (screenshot check). Watch for: white inset sheens on warm paper, theme-flipping ink used on fixed-bright backgrounds, neon glows surviving into the warm-paper aesthetic, and (reverse) light/white panels surviving into dark mode.
- [ ] Terminal-class surfaces stay **dark in both themes** (only `--pn-term-bg` flips between two dark values).
- [ ] No reliance on global `:root` (foundation never touches it; tokens only resolve under `html[data-redesign]`).

---

## Finding report format (to the lead)

```
BRANCH: <P1x — name>   VERDICT: CLEAN | ISSUES (n)
[A1|A2] <severity: blocker|issue|note>  <file>:<line>
   what: <one line>
   why:  <preserved-surface violation | hardcoded value w/ available token | visual mismatch vs panel-redesign>
   fix:  <the token/primitive/structure it should use>  (suggestion only — owning coordinator decides)
```
Only `blocker`/`issue` get reported. Group by file. If CLEAN, one line + the tsc -b result.

---

## Rubric validation — Middle branch self-scan (passed)

Ran 2a scans on the 5 Middle files (`SessionStatsView.tsx`, `styles-session-stats.css`, `styles-terminal-empty.css`, `styles-terminal-theme.css`, `styles-update-banner.css`):
- hex hits: `#20160a` (sanctioned on-accent, single-sourced) + `#1c1a16/#100E0A` (inside a comment) → **0 violations**.
- px hits: `2px` (preserved keyframe border-width, color-only swap) → **0 violations**.
- A1: SessionStatsView.tsx diff = pure `var()`-name swaps; all props/hooks/handlers/refs/effects/`AGENT_HUES` intact. Terminal CSS-only, all reparent invariants preserved.
- `bunx tsc -b` EXIT 0.

Confirms the rubric's triage rules correctly separate sanctioned exceptions from real violations.
