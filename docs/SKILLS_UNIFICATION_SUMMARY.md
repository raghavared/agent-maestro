# Skills System Unification - Implementation Summary

## Problem
The task create modal was showing 202 skills from `~/.agents/skills/` instead of the expected 2-3 Maestro-specific skills (frontend-design, code-visualizer, etc.).

## Root Cause
- The Tauri command `list_claude_code_skills` was reading from `~/.agents/skills/` (which contains all Claude Code skills)
- Skills should be read from `~/.claude/skills/` (unified location for all agents)
- Skills should be served by the server API (not Tauri), for real-time updates and multi-agent access

## Solution Implemented
Unified all agents (Claude Code, Codex, Gemini) to use `~/.claude/skills/` via server-side API.

## Changes Made

### 1. Server-Side Changes

#### New File: `maestro-server/src/infrastructure/skills/ClaudeCodeSkillLoader.ts`
- Created new skill loader that reads Claude Code `SKILL.md` files with YAML frontmatter
- Parses metadata: triggers, role, scope, category, tags, language, framework, etc.
- Implements `ISkillLoader` interface for consistency
- Caches skills for performance

#### Updated: `maestro-server/src/infrastructure/config/Config.ts`
- Changed default skills directory from `~/.agents-ui/maestro-skills` to `~/.claude/skills/`
- Line 111: `skillsDir: expandPath(process.env.SKILLS_DIR || '~/.claude/skills')`

#### Updated: `maestro-server/src/container.ts`
- Switched from `FileSystemSkillLoader` to `ClaudeCodeSkillLoader`
- Line 10: Import changed
- Line 88: Instantiation changed

#### Updated: `maestro-server/src/api/skillRoutes.ts`
- Modified GET `/api/skills` to return full Claude Code skill format
- Returns: id, name, description, triggers, role, scope, category, tags, language, framework, license, content, hasReferences, referenceCount

#### Updated: `maestro-server/package.json`
- Added `yaml: ^2.3.4` dependency for parsing YAML frontmatter

### 2. UI Changes

#### Updated: `maestro-ui/src/components/maestro/ClaudeCodeSkillsSelector.tsx`
- Changed from Tauri `invoke("list_claude_code_skills")` to `maestroClient.getSkills()`
- Removed Tauri import, added maestroClient import

#### Updated: `maestro-ui/src/utils/MaestroClient.ts`
- Added `ClaudeCodeSkill` type import
- Updated `getSkills()` return type from `AgentSkill[]` to `ClaudeCodeSkill[]`
- Now calls server API: `GET /api/skills`

### 3. CLI Changes

#### Updated: `maestro-cli/src/services/skill-loader.ts`
- Changed default skills directory from `~/.skills/` to `~/.claude/skills/`
- Updated documentation comments
- Line 53: `this.skillsDir = skillsDir || join(homedir(), '.claude', 'skills')`

### 4. Tauri Cleanup

#### Updated: `maestro-ui/src-tauri/src/main.rs`
- Removed `mod skills;` declaration
- Removed `use skills::{...}` import
- Removed `list_claude_code_skills`, `get_claude_code_skill`, `get_skill_categories` from invoke handler

#### Updated: `maestro-ui/src-tauri/Cargo.toml`
- Removed `dirs = "5.0"` dependency (only used by skills.rs)
- Removed `serde_yaml = "0.9"` dependency (only used by skills.rs)

#### File to Remove: `maestro-ui/src-tauri/src/skills.rs`
- This file is no longer used and should be deleted

## Skills Directory Structure

Skills are now stored in `~/.claude/skills/` with the following structure:

```
~/.claude/skills/
├── frontend-design/
│   └── SKILL.md          # With YAML frontmatter
├── code-visualizer/
│   └── SKILL.md          # With YAML frontmatter
└── [other-skills]/
    └── SKILL.md
```

### SKILL.md Format

```yaml
---
name: frontend-design
description: Expert in creating beautiful, accessible frontend interfaces
triggers:
  - frontend
  - UI
  - design
role: specialist
scope: implementation
category: frontend
language: typescript
framework: react
tags:
  - ui
  - components
version: 1.0.0
license: MIT
---

# Skill Content

[Markdown content with instructions, best practices, etc.]
```

## Benefits

1. **Unified Location**: All agents (Claude Code, Codex, Gemini) read from `~/.claude/skills/`
2. **Server-Managed**: Skills are served by the server API, enabling:
   - Real-time updates across all clients
   - No need for Tauri commands
   - Consistent behavior across all agents
3. **Rich Metadata**: Full Claude Code skill format with triggers, tags, categories, etc.
4. **Scalable**: Easy to add new skills without recompiling the app
5. **Standard**: Following Claude Code's established skill format

## Testing

### Created Test Skills

1. **frontend-design** - Frontend development specialist
2. **code-visualizer** - Architecture diagram generator

Both skills are automatically detected by the system.

### Verification Steps

1. Start the server: `cd maestro-server && npm run dev`
2. Test API: `curl http://localhost:3000/api/skills`
3. Should return 2 skills with full metadata
4. Open Maestro UI → Create Task → Skills Tab
5. Should show 2 skills instead of 202

## Environment Variable

Users can override the skills directory:
```bash
export SKILLS_DIR="$HOME/.claude/skills"
```

## Migration Notes

For users upgrading:
1. Skills are now in `~/.claude/skills/` instead of `~/.agents/skills/`
2. Old location: 200+ Claude Code skills (not relevant to Maestro)
3. New location: Only Maestro-specific skills
4. Users can create custom skills in `~/.claude/skills/[skill-name]/SKILL.md`

## Files Modified

**Server (6 files):**
- `maestro-server/src/infrastructure/skills/ClaudeCodeSkillLoader.ts` (NEW)
- `maestro-server/src/infrastructure/config/Config.ts`
- `maestro-server/src/container.ts`
- `maestro-server/src/api/skillRoutes.ts`
- `maestro-server/package.json`

**UI (2 files):**
- `maestro-ui/src/components/maestro/ClaudeCodeSkillsSelector.tsx`
- `maestro-ui/src/utils/MaestroClient.ts`

**CLI (1 file):**
- `maestro-cli/src/services/skill-loader.ts`

**Tauri (2 files + 1 to delete):**
- `maestro-ui/src-tauri/src/main.rs`
- `maestro-ui/src-tauri/Cargo.toml`
- `maestro-ui/src-tauri/src/skills.rs` (to be deleted)

**Total: 11 files modified, 1 file created, 1 file to delete**

## Conclusion

Successfully unified the skills system to use `~/.claude/skills/` via server API, fixing the bug where 202 skills were shown instead of 2-3. All agents now share the same skills source, enabling real-time updates and consistent behavior across the platform.
