# Skills System Research & Architecture Plan

## Executive Summary

The AI coding ecosystem has converged on the **Agent Skills open standard** (published by Anthropic, adopted by OpenAI, Microsoft, Cursor, GitHub, etc.). Skills are directories containing a `SKILL.md` file with YAML frontmatter and Markdown instructions. The current Maestro implementation already has a solid foundation with `ClaudeCodeSkillLoader` and the `ClaudeCodeSkillsSelector` UI component, but needs expansion to support:

1. **Multi-scope skills** (global + project-level)
2. **Multi-agent conventions** (`.claude/skills/` for Claude Code, `.agents/skills/` for Codex/universal)
3. **skills.sh marketplace** integration for browsing/installing community skills

---

## 1. Industry Standards & Conventions

### 1.1 The Agent Skills Open Standard (agentskills.io)

Anthropic published the Agent Skills specification as an open standard (Dec 2025). Adopted by Microsoft, OpenAI, Atlassian, Figma, Cursor, GitHub.

**Skill structure:**
```
skill-name/
├── SKILL.md           # Required - YAML frontmatter + Markdown instructions
├── scripts/           # Optional: executable code
├── references/        # Optional: additional docs
└── assets/            # Optional: templates, images, data
```

**Required frontmatter fields:**
| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | Max 64 chars; lowercase letters, numbers, hyphens; must match dir name |
| `description` | Yes | Max 1024 chars |
| `license` | No | License name or reference |
| `allowed-tools` | No | Space-delimited list of pre-approved tools |

**Progressive disclosure model:**
1. **Metadata** (~100 tokens): `name` + `description` loaded at startup
2. **Instructions** (<5000 tokens): Full body loaded on activation
3. **Resources**: Files in `scripts/`, `references/`, `assets/` loaded on demand

### 1.2 Claude Code Skills

| Scope | Path | Description |
|-------|------|-------------|
| Personal (global) | `~/.claude/skills/<skill-name>/SKILL.md` | All projects |
| Project | `.claude/skills/<skill-name>/SKILL.md` | Current project only |
| Legacy commands | `~/.claude/commands/<name>.md` | Legacy slash commands |

**Extra frontmatter fields Claude Code supports:**
- `disable-model-invocation`, `user-invocable`, `allowed-tools`, `context`, `agent`, `argument-hint`, `model`
- Dynamic features: `$ARGUMENTS`, shell injection via `` !`command` ``

### 1.3 OpenAI Codex Skills

| Scope | Path | Description |
|-------|------|-------------|
| Repo folder-level | `.agents/skills/` in CWD | Module-specific skills |
| Repo root | `$REPO_ROOT/.agents/skills/` | Repo-wide skills |
| User | `$HOME/.agents/skills/` | Personal cross-project |
| Admin | `/etc/codex/skills/` | System-wide defaults |

Uses same `SKILL.md` format. Project instructions in `AGENTS.md` (vs Claude's `CLAUDE.md`).

### 1.4 Other Tools

| Tool | Skills Support | Config Dir |
|------|---------------|------------|
| **Cursor** | Full Agent Skills standard | `.cursor/rules/` + `.agents/skills/` |
| **Windsurf** | Partial (via AGENTS.md) | `.windsurf/rules/` |
| **GitHub Copilot** | Full standard | `.github/instructions/` + `.agents/skills/` |
| **Aider** | Via AGENTS.md reading | `.aider.conf.yml` |

### 1.5 Convergence

The ecosystem is converging on two paths:
- **Claude Code native**: `.claude/skills/`
- **Universal/Open standard**: `.agents/skills/` (used by Codex, Cursor, Copilot, etc.)

**Both use identical `SKILL.md` format.** Only the directory path differs.

---

## 2. skills.sh Marketplace

**skills.sh** ("The Open Agent Skills Ecosystem") is a web directory for discovering and installing skills.

- **URL**: https://skills.sh
- **Install method**: `npx skillsadd <owner/repo>`
- **Supports**: 18+ AI agents including Claude Code, Cursor, Copilot, Codex, Gemini
- **Distribution**: Skills are GitHub repositories in `owner/repo` format
- **Features**: Leaderboard, trending views (All Time, 24h, Hot), categories
- **VS Code extension**: Available on VS Marketplace

**Note**: "mpa-skills.sh" does not exist as a public platform. The user likely meant **skills.sh**.

---

## 3. Current Maestro Implementation Analysis

### 3.1 What Exists

**Server-side:**
- `ClaudeCodeSkillLoader` - Reads from a single `skillsDir` (default: `~/.claude/skills/`)
- `skillRoutes.ts` - REST API: `GET /api/skills`, `GET /api/skills/:id`, `GET /api/skills/mode/:mode`, `POST /api/skills/:id/reload`
- Skills are parsed from `SKILL.md` with YAML frontmatter
- Caching layer implemented

**UI-side:**
- `ClaudeCodeSkillsSelector` component - Expandable grid, search, checkbox selection
- Used in both `CreateTaskModal` and `CreateTeamMemberModal`
- Skills stored as `skillIds` on tasks and team members
- `maestroClient.getSkills()` calls `GET /api/skills`

**CLI-side:**
- `maestro skill list`, `maestro skill info <name>`, `maestro skill validate`
- CLI skill loader discovers from `~/.claude/skills/`

### 3.2 Gaps Identified

| Gap | Description |
|-----|-------------|
| **Single directory only** | Server reads only from `~/.claude/skills/` — no project-level or `.agents/skills/` support |
| **No scope differentiation** | UI doesn't show whether a skill is global vs project-level |
| **No marketplace integration** | No way to browse/install skills from skills.sh |
| **No multi-agent support** | Only reads Claude Code format; doesn't discover `.agents/skills/` for Codex compatibility |
| **Missing project context** | Skill loader isn't project-aware — can't scan project's `.claude/skills/` or `.agents/skills/` |
| **No install capability** | No `npx skillsadd` equivalent or API for adding skills |

---

## 4. Proposed Skills System Architecture

### 4.1 Multi-Scope Skill Discovery

The skill loader should discover skills from multiple locations, with clear scope labeling:

```
Priority (highest wins):
1. Project-level Claude:  <project>/.claude/skills/
2. Project-level Agents:  <project>/.agents/skills/
3. Global Claude:         ~/.claude/skills/
4. Global Agents:         ~/.agents/skills/
```

Each skill in the API response should include a `scope` field:
```typescript
interface SkillWithScope {
  // ... existing fields
  scope: 'project' | 'global';
  source: 'claude' | 'agents';  // which directory convention
  path: string;                  // full filesystem path
}
```

### 4.2 Server API Changes

**Existing endpoint enhancement:**
```
GET /api/skills?projectPath=/path/to/project
```
- Accept optional `projectPath` query param
- Return skills from all scopes with scope/source metadata
- Deduplicate by name (project overrides global)

**New endpoints for marketplace:**
```
GET  /api/skills/marketplace/search?q=react&category=frontend
GET  /api/skills/marketplace/trending
POST /api/skills/marketplace/install   { "repo": "owner/repo", "scope": "project"|"global" }
```

### 4.3 UI Skills Tab Design

The Skills tab (in both CreateTaskModal and the store panel) should show three sections:

```
┌─────────────────────────────────────────┐
│ SKILLS                                  │
├─────────────────────────────────────────┤
│ [Search skills...]                      │
│                                         │
│ ▼ Project Skills (3)                    │
│   [✓] code-review     "Reviews PRs..." │
│   [ ] test-generator  "Generates..."   │
│   [ ] deploy-helper   "Assists..."     │
│                                         │
│ ▼ Global Skills (5)                     │
│   [✓] commit          "Smart commits"  │
│   [ ] refactor        "Code refact..." │
│   [ ] ...                               │
│                                         │
│ ▶ Browse Community Skills (skills.sh)   │
│   [Search marketplace...]               │
│   Trending: find-skills, cursor-rules.. │
│   [Install] owner/repo                  │
└─────────────────────────────────────────┘
```

### 4.4 Skill Loader Refactoring

```typescript
// New multi-scope skill loader
class MultiScopeSkillLoader implements ISkillLoader {
  private loaders: {
    scope: 'project' | 'global';
    source: 'claude' | 'agents';
    loader: ClaudeCodeSkillLoader;
  }[];

  constructor(projectPath: string | null, logger: ILogger) {
    this.loaders = [];

    // Add project-level loaders if projectPath provided
    if (projectPath) {
      this.loaders.push({
        scope: 'project', source: 'claude',
        loader: new ClaudeCodeSkillLoader(path.join(projectPath, '.claude/skills'), logger)
      });
      this.loaders.push({
        scope: 'project', source: 'agents',
        loader: new ClaudeCodeSkillLoader(path.join(projectPath, '.agents/skills'), logger)
      });
    }

    // Add global loaders
    this.loaders.push({
      scope: 'global', source: 'claude',
      loader: new ClaudeCodeSkillLoader(path.join(os.homedir(), '.claude/skills'), logger)
    });
    this.loaders.push({
      scope: 'global', source: 'agents',
      loader: new ClaudeCodeSkillLoader(path.join(os.homedir(), '.agents/skills'), logger)
    });
  }
}
```

### 4.5 skills.sh Integration

The marketplace integration should:
1. **Fetch skills.sh catalog** via their API or web scraping
2. **Show browsable list** in the UI with install buttons
3. **Install via `npx skillsadd`** or direct git clone to the appropriate directory
4. **Track installed** vs available status

---

## 5. Implementation Phases

### Phase 1: Multi-Scope Discovery (Server + UI)
- Refactor `ClaudeCodeSkillLoader` to support multiple directories
- Add `scope` and `source` fields to API responses
- Update `GET /api/skills` to accept `projectPath` param
- Update `ClaudeCodeSkillsSelector` to show grouped sections (Project / Global)

### Phase 2: `.agents/skills/` Compatibility
- Scan both `.claude/skills/` and `.agents/skills/` directories
- Both use identical `SKILL.md` format — no parser changes needed
- Add source indicator in UI

### Phase 3: skills.sh Marketplace Integration
- Add marketplace API endpoints (proxy to skills.sh)
- Add "Browse Community Skills" section in UI
- Implement install flow (downloads skill to chosen scope directory)
- Show installed status for marketplace skills

### Phase 4: Enhanced UX
- Skill preview/detail modal
- Inline skill content viewer
- Skill management (enable/disable, delete)
- Skill creation wizard

---

## 6. Key Findings Summary

1. **The industry has standardized** on the `SKILL.md` format with YAML frontmatter — both Claude Code and Codex use it
2. **Directory paths differ by tool** but the format is identical: `.claude/skills/` vs `.agents/skills/`
3. **skills.sh** is the leading marketplace for community skills, supporting 18+ tools
4. **Current Maestro implementation** has a solid foundation but only reads from one directory (global `~/.claude/skills/`)
5. **The fix is straightforward**: scan multiple directories, label by scope, and add marketplace browsing
6. **No format translation needed** — the same `SKILL.md` parser works for all agent conventions
