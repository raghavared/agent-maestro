# SkillsPanel-CONTRACT.md

Re-skin of `maestro-ui/src/components/maestro/SkillsPanel.tsx` → `panel-redesign/views.jsx` **SkillsView + SkillCard**.
Rule: **appearance only**, zero functionality changes. Tokens/primitives consumed from `redesign/redesign-views.css` + `redesign/redesign-tokens.css` + `redesign/kit.tsx` (`Icon`, `PN_ICONS`). SWAP-OUTRIGHT (pn-* unconditional, no theme gating).

## A. Functional surface — PRESERVED VERBATIM

### State / hooks (all kept)
- `skills`, `loading`, `error`, `searchQuery`, `expandedSkillId`, `view ('installed'|'marketplace')`, `collapsedSections (Set)`, `marketplaceQuery`, `marketplaceSkills`, `marketplaceLoading`
- `projectPath = project?.basePath || project?.workingDir`
- `loadSkills` useCallback([projectPath]); `useEffect([loadSkills])`
- `useMemo {projectSkills, globalSkills}` filtered by searchQuery ([skills, searchQuery])
- `toggleSection`, `renderSkillCard`, `renderSection`

### Handlers / a11y (all kept)
- card `onClick` → toggle `expandedSkillId`; `data-expanded` attr kept on outer card div
- view toggle buttons `onClick` → `setView`; `type="button"`
- search `input onChange` → set searchQuery / marketplaceQuery; `type="text"`
- search clear button `onClick` → clear; `type="button"`
- refresh button `onClick` → `loadSkills`; `title="Refresh skills"`; `type="button"`
- section header `onClick` → `toggleSection`; collapse via `collapsedSections`
- marketplace install `input onKeyDown` (Enter → window.open `skills.sh/{repo}`) — kept verbatim
- marketplace popular cards: `<a href target rel>` links — kept verbatim
- marketplace footer browse `<a>` — kept verbatim
- error retry button `onClick` → `loadSkills`
- all `key` props kept

## B. Visual surface — REPLACED (old class → new pn-* element)

| Element | OLD | NEW (design) |
|---|---|---|
| root container | `terminalContent skillsPanel` | `pn-vframe pn-vframe--tall` + inline `{width:100%,height:100%}` fill override (see §C-1) |
| toolbar/header | `skillsPanelToolbar` | `pn-vhd`: `<Icon name="sparkles" size={16} style={{color:var(--pn-ink-3)}}/>` + `pn-vhd__title` "Skills" + `pn-vhd__sp` + `pn-vtoggle` + refresh `pn-ib` |
| view toggle | `skillsPanelViewToggle`/`...ViewBtn`/`...ViewCount` | `pn-vtoggle` > `button.on?` Installed `<span class="n">{skills.length}</span>` / Marketplace |
| refresh btn | `themedBtn skillsPanelRefreshBtn` | `pn-ib` + `<Icon name="refresh"/>` (primitive from FilesView header) |
| search | `skillsPanelSearchWrapper`/Input/Clear | `pn-vsearch`: `<Icon name="search"/>` + input + clear `<button class="pn-vsearch__clear">×</button>` |
| installed scroll | `skillsPanelContent` | `pn-vscroll` style `{paddingTop:6}` |
| section header | `skillsPanelSectionHeader` + toggle glyph/icon/title/count | `pn-vsec` (onClick kept) > `pn-eyebrow` (`<Icon folder|globe size={11}/>` + label + `· {count}`) + `<span class="pn-line"/>` |
| section content | `skillsPanelSectionContent` | bare cards (fragment), conditional on `!isCollapsed` |
| skill card | `skillsPanelCard` | `pn-skill` (outer keeps onClick + data-expanded) > `pn-skill__hd` |
| card icon | — (none) | `pn-skill__ic` > `<Icon name="sparkles"/>` |
| card name | `skillsPanelCardName` | `pn-skill__body > pn-skill__namerow > pn-skill__name` |
| badges | `skillsPanelCardBadges`/`Badge[data-type]` | `pn-skill__badges` > `pn-sbadge pn-sbadge--src` (.claude/.agents) / `pn-sbadge pn-sbadge--ver` (v{version}) |
| desc | `skillsPanelCardDesc` | `pn-skill__desc` |
| expand | `skillsPanelCardDetails` | `pn-skill__exp` |
| detail row | `skillsPanelDetailRow`/`...Label` | `pn-skill__row` > `pn-skill__rowlabel` + `pn-skill__rowval` |
| tags | `skillsPanelTags`/`...Tag` | `pn-skill__tags` > `pn-skill__tag` |
| path | `skillsPanelPath` | `pn-skill__path` (inside rowval) |
| content pre | `skillsPanelContentPreview`/`...Pre` | `pn-skill__row` > rowlabel "content" + `<pre>` styled mono via inline pn tokens |
| empty (installed) | `skillsPanelEmptyState`/`Ascii` | kept `<pre>` ascii, color repointed to `var(--pn-ink-3)` mono |
| loading | `skillsPanelLoading`/`Spinner` | repointed to pn tokens (mono, `var(--pn-ink-3)`) — design-silent (§C-2) |
| error | `skillsPanelError` | repointed pn tokens + Retry `pn-btn` — design-silent (§C-2) |
| marketplace scroll | `skillsPanelContent` | `pn-vscroll` style `{padding:'14px 12px'}` |
| mkt header | `skillsPanelMarketplaceHeader`/Subtitle | serif title `{fontFamily:var(--pn-serif),17px,var(--pn-ink)}` + subtitle `{12px,var(--pn-ink-3)}` (design lines 190-191) |
| mkt info | `skillsPanelMarketplaceInfo`/Link | pn-token repoint; link → pn-styled `<a>` |
| install box | `skillsPanelInstallBox`/Label/Row/Cmd/Input/Hint | design-silent (§C-3): card repointed to `var(--pn-card)`/`var(--pn-line)`; code+input mono pn tokens |
| popular section | `skillsPanelPopularSection`/Header | collapse header → `pn-vsec` + `pn-eyebrow` (onClick toggleSection('popular') kept) |
| popular cards | `skillsPanelPopularCard`/Name/Desc/Repo | `pn-skill` cards (kept as `<a href target rel>`): `pn-skill__ic` sparkles + name + desc + `pn-skill__path` repo (§C-4) |
| mkt footer | `themedBtn skillsPanelBrowseBtn` | `pn-btn` (kept as `<a>`) |

## C. Judgment calls / escalations

1. **Container dims (escalated):** design `pn-vframe` is fixed 380×660 (standalone demo card); the LIVE panel mounts inside MaestroPanel `terminalContent` (flex:1 fill). Applying fixed dims would blow out the embedded layout. Resolution: keep `pn-vframe pn-vframe--tall` classes (background/border/radius/shadow/flex-column treatment) with inline `{width:'100%',height:'100%'}` override so it fills its parent and `pn-vscroll` owns internal scroll. Flagged to coordinator.
2. **Loading / error states:** design-silent. Re-skinned by token-repoint only (no new structure) — mono font, `var(--pn-ink-3)`, Retry as `pn-btn`.
3. **Install box:** design-silent (design marketplace has no install box). Functionality (npx skillsadd + owner/repo input + Enter→window.open) preserved verbatim; only colors repointed to pn-* tokens.
4. **Popular cards as links:** live data are `<a>` links to skills.sh with no install-count / no Add handler. Rendered with the `pn-skill` primitive (sparkles ic + name + desc + repo path) but NOT inventing the design's mock download-count `pn-sbadge` or `Add pn-btn` (no backing data/handler). Faithful to data; uses established primitive.

## D. Verify
- `cd maestro-ui && bunx tsc -b` clean (NOT vite/build:ui per ruling 4).
- Screenshots via Screenshots Worker (light→paper + dark→graphite).
