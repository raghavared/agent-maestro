# TeamMembersPanel / TeamMemberList — Re-skin Contract

Worker: 🗃️ Team Members View Worker · Task `task_1780984903016_thuu3epsj`
Design source: `panel-redesign/views.jsx` → `TeamMembersView` + `MemberRow` (+ `views.css`).
Ported CSS consumed (not edited): `redesign/redesign-views.css`, `redesign/redesign-tokens.css`, `redesign/kit.tsx`.
Rule: **appearance only — zero functionality changes.**

## Scope boundary (IMPORTANT — resolved against live architecture)

`MaestroPanel.tsx` (Shell worker, NOT my scope) **already renders the redesigned header chrome** for the members subtab:
- `pn-subbar` with `pn-btn--primary` "New member" (MaestroPanel.tsx:653) + "Standup" + `pn-head-spacer` + `pn-meta` "Members · N".
- Search (`pn-search`) is rendered **only** for the tasks tab — intentionally **absent** for team.

⇒ The design's `pn-vframe` / `pn-vhd` (users icon + "Team" + count chip + New-member) / `pn-vsearch` map to MaestroPanel's existing `pn-mp`/`pn-head`/`pn-subbar`. **I do NOT replicate them** (would produce a duplicate header + second "New member" button). My two files own everything **below** the subbar: the scroll region, loading state, the member rows, group dividers, the archived collapsible, and the empty state.

## A. Functional surface preserved verbatim

### TeamMembersPanel.tsx
| Item | Preserved |
|---|---|
| Props | `projectId, teamMembers, teamMembersLoading, onEdit, onArchive, onUnarchive, onDelete, onRun, createSignal` |
| State | `showModal`, `editingMember` |
| Effect | `useEffect([createSignal])` → open modal in create mode |
| Handlers | `handleEdit` (sets editing + opens + calls `onEdit`), `handleNewMember` |
| Loading gate | `teamMembersLoading && teamMembers.length === 0` |
| Children | `<TeamMemberList .../>` (all props), `<TeamMemberModal .../>` (untouched, owned by Misc) |

### TeamMemberList.tsx
| Item | Preserved |
|---|---|
| Props | `teamMembers, onEdit, onArchive, onUnarchive, onDelete, onNewMember, onRun` |
| State | `showArchived`, `loadingAction` |
| Memo | grouping into `defaultMembers / customMembers / globalMembers / archivedMembers`; `activeMembers` |
| Row state | `isExpanded` per row |
| Handlers | `handleArchive/handleDelete/handleUnarchive/handleRun` (each `e.stopPropagation()` + `setLoadingAction` + finally clear); Edit inline `stopPropagation()+onEdit`; `isLoading(action)` |
| Derived | `getModelDisplayLabel`, `modelLabel`, `profileName` (`useMaestroStore`) |
| Conditions | badge 3-branch (profile / agentTool / modelLabel); `member.scope==='global'`; `member.isDefault`; action visibility (`!isArchived`/`isArchived`); `disabled={!!loadingAction}`; loading button text |
| Copy | empty-state strings "NO TEAM MEMBERS" / "$ create your first team member" kept verbatim |

## B. Visual surface replaced (live class → design class)

### Container (TeamMembersPanel)
| Element | Old | New |
|---|---|---|
| Scroll region | `.terminalContent` | `.pn-vscroll` (flex:1 / overflow-y:auto / token scrollbar) |
| Loading state | `.terminalLoadingState`/spinner/cursor | token-based centered "Loading team members…" (`--pn-ink-3`) |

### Row (MemberRow → pn-mem)
| Element | Old | New |
|---|---|---|
| Row | `terminalTaskRow (--completed)` | `pn-mem` (+`pn-mem--archived`) |
| Clickable header | `terminalTaskMain` | `pn-mem__main` (onClick toggles `isExpanded`) |
| Avatar | inline `<span>` | `pn-mem__av` (+`pn-mem__av--ring` when `isDefault`) |
| Name/Role | `terminalTaskTitle` | `pn-mem__body` → `pn-mem__name` + `pn-mem__role` (role now shown in header too — same `member.role` data) |
| Badges wrap | inline row | `pn-mem__badges` |
| Profile badge | `terminalMetaBadge--model` ◈ | `pn-mbadge pn-mbadge--profile` `◈ {profileName}` (title preserved) |
| Agent/model badge | `<AgentChip>` | `pn-mbadge pn-mbadge--model` → `<AgentLogo agentTool size=12/>` + `{modelLabel}` |
| Plain model badge | `terminalMetaBadge--model` | `pn-mbadge pn-mbadge--model` |
| Global badge | `terminalMetaBadge--status` 🌐 | `pn-mbadge pn-mbadge--global` `<Icon name="globe" size=11/> GLOBAL` |
| Default badge | `terminalMetaBadge--status-in_progress` | `pn-mbadge pn-mbadge--default` `DEFAULT` |
| Chevron | (none) | `pn-mem__chev` (+`--open`) `<Icon name="chevronD" size=14/>` |
| Expand | `terminalTaskExpanded`>`…TabContent`>`TabPane` | `pn-mem__exp` (flattened) |
| Detail block | `terminalDetailBlock`/`…Label`/`…Content` | `pn-mem__block` > `pn-mem__blocklabel` + `pn-mem__blocktext` (Instructions adds `--mono`) |
| Skills | comma-joined text | `pn-mem__skills` → `skillIds.map` `pn-skill__tag` |
| Actions bar | `terminalTaskActionsBar--right` | `pn-mem__actions` |
| Run | `terminalCmdPrimary` "▶ Run" | `pn-btn pn-btn--primary` h28 `<Icon play 12/> Run` |
| spacer | (flex) | `pn-head-spacer` (design's bare `pn-sp` → **pn-head-spacer** per ruling) |
| Edit/Configure | `terminalViewDetailsBtn` | `pn-btn` h28 |
| Archive | `terminalArchiveBtn` | `pn-btn pn-btn--ghost` h28 `<Icon archiveBox 12/> Archive` |
| Restore | `terminalViewDetailsBtn` | `pn-btn` h28 `<Icon refresh 12/> Restore` |
| Delete | `terminalDeleteBtn` | `pn-btn pn-btn--ghost` h28 (color `--pn-block`) `<Icon trash 12/> Delete` |

### List chrome (TeamMemberList)
| Element | Old | New |
|---|---|---|
| Section wrappers | `terminalTaskList` | plain `<div>` (rows carry their own `pn-mem` border) |
| Global divider | inline 🌐 label | `pn-vsec` > `pn-eyebrow` (`<Icon globe 11/> Global Members`) + `pn-line` |
| Archived toggle | inline `terminalViewDetailsBtn` collapsible | token button: `pn-eyebrow` (`<Icon archive 11/> Archived · N`) + chevron; **keeps collapsible behavior** |
| Empty state | `terminalEmptyState` | token-styled centered block (copy verbatim) |

## C. Icons / kit primitives used
`Icon` (`redesign/kit.tsx`): `chevronD, play, globe, archiveBox, refresh, trash, archive`. `AgentLogo` (`AgentChip.tsx`) for the model badge glyph. All `pn-*` classes from `redesign-views.css` + `redesign-tokens.css` (verified present).

## D. Judgment calls (flagged to coordinator — implemented but vetoable)
1. **No header/search added** — owned by MaestroPanel (boundary above). Confident: avoids duplicate "New member".
2. **Model badge** — design uses agent `.png`; codebase has no such assets, only `AgentLogo` SVG. Used `AgentLogo` (currentColor) inside `pn-mbadge--model` + `{modelLabel}`. No invented assets; agent identity via icon, model via text.
3. **Archived `pn-vtoggle`** — design's segmented Active/Archived tab would change behavior (swap vs the live always-active + bottom collapsible). MaestroPanel's team subbar has no such toggle. Kept the collapsible (re-skinned with tokens) to honor ZERO-functionality-change. Escalate if a true tab-swap is wanted.
4. **Loading + empty state** — design-silent; re-skinned with tokens, copy preserved verbatim.
