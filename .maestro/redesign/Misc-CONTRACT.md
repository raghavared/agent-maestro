# Misc / Modals Branch — Consolidated Contract

Coordinator: 🧰 Misc Coordinator. Parent task: `task_1780949213607_9blacbu97`. Branch: `maestro-redesign`.
Status: all 5 worker contracts COMPLETE; workers HOLDING for `FOUNDATION-DONE.md` gate.

## Workers, scope, sessions, contracts

| Worker | Session | Task | In-scope files | Contract |
|---|---|---|---|---|
| 🪧 TopBar / Project Bar | sess_1780949462370_hds7pyadg | task_1780949391336_i4weyggn2 | `components/ProjectTabBar.tsx` (bar chrome + buttons) + `App.tsx` top region | `.maestro/redesign/contracts/TopBar-CONTRACT.md` |
| ➕ Task Create Modal | sess_1780949483130_56vyenz1x | task_1780949402358_nv130bjnj | `CreateTaskModal.tsx` + entire `task-modal/` subtree (15 children) | `.maestro/redesign/CreateTaskModal-CONTRACT.md` |
| 👤 Team Member Modal | sess_1780949498346_5zs1882o5 | task_1780949402510_0r6lroxey | `TeamMemberModal.tsx` (1228L) | `.maestro/redesign/TeamMemberModal-CONTRACT.md` |
| ⚙️ Settings Panel | sess_1780949516040_4nulvtpgf | task_1780949415255_il8fxfd11 | AppSettingsDialog + ProjectSettingsDialog bodies (in `ProjectTabBar.tsx`) + DisplaySettings/GitSettings/SoundSettingsContent/ProjectSoundSettings/ThemeSwitcher | `.maestro/redesign/Settings-CONTRACT.md` |
| 🧹 Modal Sweep | sess_1780949537955_geywofuu2 | task_1780949415409_zomhf7uxi | TeamModal, ModelProfileModal, TaskListModal, SessionDetailModal, TeamLaunchConfigModal | `ModalSweep-CONTRACT.md` (repo root) |

## Foundation kit dependencies

Provided (verified present in `redesign-modals.css`): pn-mdl*, pn-fld/flabel/fhint/frow, pn-input, pn-textarea(--mono), pn-select, pn-prio-pill(s)/pn-pdot, pn-mchip, pn-desc, pn-avatar-edit, pn-toolsel/pn-tool(--active)/__name, pn-caps/pn-cap/pn-switch, pn-mtabs/pn-mtab, pn-instr, pn-savehint, pn-assignadd. Top chrome (pn-top/pn-lights/pn-ptab/pn-ib/pn-kbd/pn-dot) in `redesign-tokens.css`.

### Outstanding kit gaps
**Verbatim ports requested from Foundation (pre-publish):**
- `pn-toggle` (--on-wt, --on-danger) + `pn-badge` (--model) — live in `tiles.css`, not modals.css. Used by CreateTaskModal footer, TeamMember, ModalSweep.
- `volume` / `volumeOff` icon in `kit.tsx` PN_ICONS — TopBar Sound toggle (only blocked piece).

**Design-silent additions escalated to master coordinator:**
- `pn-btn--danger` (destructive actions: Settings, ModalSweep, TeamMember delete).
- Vertical `pn-mtabs` variant (Settings sidebar tab rail).
- `pn-range` slider primitive (Sound volume sliders ×2). Fallback: native restyled.

## Coordinator-level open items
1. **TEAM-WIDE dual-theme ruling** (also hit by Left's MaestroPanel): swap-outright vs conditional dual-render. Recommended + provisionally applied: **SWAP OUTRIGHT** (data-redesign default-on this branch; flag is a global kill-switch). Awaiting authoritative confirmation.
2. TeamMember launch-config (keep full LaunchConfigDropdown, don't reduce to 2 selects) + Workflow/CommandPermissions/Memory homes — provisional: keep + restyle in place. Awaiting design confirm.

## Cross-worker coordination
- **`ProjectTabBar.tsx` is shared** by TopBar (bar + trigger buttons) and Settings (inline dialog bodies). Resolution: region boundary set; **serialize at gate-open — TopBar lands structural bar changes first, then Settings restyles the dialog bodies.**
- ThemeSwitcher (Settings scope): restyle visuals only; escalate if theme-logic couples to Foundation wiring.

## Rulings issued (binding)
- TopBar: Option A (omit pn-lights, native decorations); pn-top-r order [Board][Whiteboard][Sound][Settings] | [Theme][Search][⌘K]; dot mapping needsInput→wait / working>0→run+live / else idle; FLIP + handleTabPointerDown preserved.
- All modal workers: consume foundation classes (no hand-port); reuse pn-pill for ✓/✕ badges; pn-fhint+danger for error banners (no pn-banner); pn-mdl__hd static title where no editable title; OMIT mockup elements with no backing state (e.g. Safe/YOLO toggle).
- Settings: defer StartupSettingsOverlay wizard this pass; skip dead SoundSettingsModal wrapper; modal header treatment for dialog headers.

Verification rule (all): ZERO functionality changes; light + dark screenshots; `bun run build:ui` pass.
