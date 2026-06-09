# IconRail → pn-rail — Re-skin Contract

**Worker:** 🎚️ Icon Rail Worker (`tm_1780948938792_yyg2rl326`)
**File:** `maestro-ui/src/components/IconRail.tsx` (145 lines)  ← REDIRECT target (the real far-left rail)
**Mounted:** `maestro-ui/src/components/AppLeftPanel.tsx:149`
**Old CSS:** `maestro-ui/src/styles-icon-rail.css` (`.iconRail*`)
**Design source:** `panel-redesign/shell.jsx` `IconRail()` (lines 90–115) + `panel-redesign/theme.css` `.pn-rail*` (543–568)
**Kit:** `redesign/kit.tsx` → `Icon`, `Mark`
**Status:** ✅ IMPLEMENTED in place + `tsc -b` EXIT 0. (PanelIconBar.tsx pn-rail edits discarded — restored to pre-session working-tree state and handed to Shell.) Screenshots pending Screenshots Worker.
**Rule:** Zero functionality changes. Every prop/handler/state-source/a11y attr preserved verbatim.

This is a **near 1:1 map** — `railItems` already equals the design RAIL exactly, including `files`.

---

## A. Functional surface — PRESERVE VERBATIM

### A.1 Props (`IconRailProps` — unchanged)
`activeSection: IconRailSection`, `onSectionChange: (section: Exclude<IconRailSection, null>) => void`, `taskCount?: number`, `memberCount?: number`, `teamCount?: number`, `onOpenWhiteboard?: () => void`.

### A.2 `railItems` (order + sections preserved exactly — matches design RAIL)
`tasks, members, teams, skills, lists, graphs, files` (IconRail.tsx:13-21). `IconRailSection` type and `onSectionChange` signature untouched.

### A.3 Handlers / interaction (preserve)
| Element | Handler | Notes |
|---|---|---|
| Each rail button | `onClick={() => onSectionChange(section)}` | `type="button"`, `title={label}` |
| Active state | `activeSection === section` → `iconRailButton--active` | |
| Whiteboard button | `onClick={onOpenWhiteboard}` | **Only rendered when `onOpenWhiteboard` is truthy** — and it is NOT passed at AppLeftPanel.tsx:149, so it currently never renders. PRESERVE the `{onOpenWhiteboard && …}` guard verbatim. |

### A.4 Badge sources (`getBadge`, IconRail.tsx:88-99) — preserve, including 99+ cap
- `tasks` → `props.taskCount ?? null`
- `members` → `props.memberCount ?? null`
- `teams` → `props.teamCount ?? null`
- others → `null`
- Render condition: `badge != null && badge > 0`; display `badge > 99 ? "99+" : badge`. **Keep the 99+ cap** (design shows raw numbers, but this is existing functional behavior → preserve).
- Count derivations live in `AppLeftPanel.tsx:104-114` (`useMemo`) and pass down — untouched.

### A.5 a11y
- Every `<button type="button">` keeps `type="button"` and `title`.
- Decorative SVGs → `<Icon>` emits `aria-hidden="true"` (parity).

---

## B. Visual surface — REPLACE

| Old class (`styles-icon-rail.css`) | New class | Source |
|---|---|---|
| `iconRail` | `pn-rail` | theme.css:544 |
| `iconRailButton` | `pn-rail-btn` | theme.css:550 |
| `iconRailButton--active` | `pn-rail-btn--active` | theme.css:556 |
| `iconRailActiveIndicator` (explicit `<span>`) | **REMOVED** — accent bar drawn by `.pn-rail-btn--active::before` | theme.css:557-560 |
| inline `<svg>` (per `getSvgForSection`) | `<Icon name=… sw={1.55} />` | shell.jsx:106 |
| `iconRailBadge` | `pn-rail-badge` | theme.css:562 |
| `iconRailSpacer` | `pn-rail-spacer` | theme.css:567 |
| whiteboard inline `<svg>` | `<Icon name="pen" sw={1.55} />` | shell.jsx:111 |
| (no mark today) | **ADD** `<span className="pn-rail-mark"><Mark size={24} /></span>` at top | shell.jsx:103 |

`getSvgForSection` is dropped in favor of an icon-name lookup; `getBadge` logic is unchanged.

### Icon name map (existing section → kit `Icon name`) — matches design RAIL
| Section | `Icon name` | Design ref |
|---|---|---|
| tasks | `listChecks` | RAIL[0] |
| members | `users` | RAIL[1] |
| teams | `team` | RAIL[2] |
| skills | `sparkles` | RAIL[3] |
| lists | `inbox` | RAIL[4] |
| graphs | `graph` | RAIL[5] |
| files | `folder` | RAIL[6] |
| whiteboard | `pen` | shell.jsx:111 |

---

## C. Token mapping (rail chrome)
- `.pn-rail`: `width:56px; flex-direction:column; align-items:center; padding:12px 0 10px; gap:4px; background:var(--pn-paper); border-right:1px solid var(--pn-line)`.
- `.pn-rail-mark`: `color:var(--pn-brand); margin-bottom:10px`.
- `.pn-rail-btn`: `40×40; radius:10px; grid place-items center; color:var(--pn-ink-3)`; hover `var(--pn-hover)`; active `var(--pn-active)` + `::before` accent `var(--pn-brand)`; `svg{19×19}` (pass `sw={1.55}`).
- `.pn-rail-badge`: `top:3px;right:3px; bg:var(--pn-ink); color:var(--pn-paper); font:var(--pn-mono) 9px`.
- All from `redesign-tokens.css`. No hardcoded values.

> ⚠️ Width note: `.appLeftPanel` width uses `DEFAULTS.ICON_RAIL_WIDTH` (AppLeftPanel.tsx:144-146). Design `.pn-rail` is `56px`. If `ICON_RAIL_WIDTH !== 56`, the rail and its container disagree. I OWN IconRail.tsx only — if a width constant change is needed it touches AppLeftPanel/DEFAULTS (not mine). Flag to coordinator before edit. (Likely fine — rail is fixed 56px and content pane is separate.)

---

## ⚠️ ESCALATION — "add a settings button" has NO existing handler

Coordinator directive: *"add … a settings button next to whiteboard."* **There is no settings handler anywhere** near IconRail/AppLeftPanel — `grep` for `onOpenSettings|openSettings|showSettings|SettingsModal|onSettings` → zero hits. `IconRailProps` has no settings prop.

A settings button with no `onClick` = **new, non-functional UI** — the exact thing we OMITTED in PanelIconBar (ruling Q4: "do NOT add non-functional buttons; that would be new functionality"). This directly conflicts.

**RESOLUTION (final coordinator ruling): OMIT the settings button** (rec a) — no settings handler exists, so a handler-less button = non-functional new UI (the exact thing omitted in PanelIconBar Q4 / Ruling #2). Not added. If design ever needs settings, it's a TopBar/Misc concern. `Mark` at top IS added (decorative chrome, no handler — pure logo). Whiteboard guard preserved verbatim (stays hidden — `onOpenWhiteboard` not passed at AppLeftPanel:149). **Net bottom of rail: empty after `pn-rail-spacer`** (whiteboard hidden, settings omitted).

**WIDTH (coordinator-authorized one-liner):** `app/constants/defaults.ts` `ICON_RAIL_WIDTH` `48 → 56` to match design `.pn-rail` width. Only that constant changed.

---

## D. Deliverables checklist (post-ruling)
- [ ] Coordinator redirect ruling (proceed on IconRail.tsx) + settings-button decision
- [ ] In-place re-skin of `IconRail.tsx` (pn-rail, Icon, Mark, badges w/ 99+ cap, whiteboard guard preserved)
- [ ] Section A functional surface verified preserved
- [ ] `tsc -b` green (vite build serialized via coordinator's build-gate)
- [ ] Light + dark screenshots vs `panel-redesign` `IconRail`
