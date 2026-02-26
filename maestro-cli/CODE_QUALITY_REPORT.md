# Code Quality Report: maestro-cli

**Date:** 2026-02-25
**Reviewer:** Automated Code Quality Audit
**Component:** `maestro-cli` — CLI for Maestro multi-agent orchestration system
**Version:** 0.1.0

---

## Executive Summary

| Dimension | Grade |
|-----------|-------|
| **Overall** | **B** |
| CLI Architecture & Command Structure | A- |
| TypeScript Quality | B |
| Error Handling & Exit Codes | B+ |
| Input Validation & Security | B- |
| Plugin Architecture | B+ |
| Testing Coverage | B+ |
| Performance | B |
| Documentation | C+ |
| npm Package Readiness | C |
| Open Source Readiness | C- |

### Key Strengths
1. **Well-designed command architecture** — modular `register*Commands()` pattern with Commander.js, clean separation of 15+ command groups
2. **Comprehensive manifest validation** — JSON Schema (AJV) + normalization pipeline with legacy field migration
3. **Sophisticated prompting system** — 4-mode agent model (worker/coordinator/coordinated-*) with layered capability resolution
4. **Good test foundation** — 196 tests across 16 test files covering services, commands, schemas, and prompting
5. **Multi-agent spawner support** — Clean abstraction across Claude Code, Codex, and Gemini CLIs

### Critical Issues
1. **170 `any` type occurrences** across 23 source files — significantly undermines TypeScript's value
2. **No authentication/authorization** on API client — all server requests are unauthenticated
3. **Potential command injection** in hook-executor — shell commands executed without sanitization
4. **Stale snapshots** — 12 failing tests (all snapshot mismatches) indicate code changed without updating tests
5. **Missing open-source essentials** — no CONTRIBUTING.md, no CHANGELOG.md, no CI/CD, no linting config

---

## Detailed Findings

### 1. CLI Architecture & Command Structure — Grade: A-

**Strengths:**
- Clean modular registration pattern: each domain (task, session, team, etc.) registers via `registerXCommands(program)` in `src/index.ts`
- Commander.js used effectively with global options (`--json`, `--server`, `--project`) and pre-action hooks
- Dual output modes (JSON for scripting, formatted for humans) consistently implemented across commands
- Permission-gated commands via `guardCommand()` — commands respect manifest-derived permissions
- 127 commands organized into 14 logical groups in `command-catalog.ts`

**Issues:**

| Severity | Finding |
|----------|---------|
| Medium | Empty `else` blocks in several commands (`commands`, `status`) — silent failures in non-JSON mode with no user feedback (e.g., `src/index.ts:310`, `src/index.ts:329`) |
| Medium | `debug-prompt` command uses `console.log` directly instead of the formatter utilities, breaking output consistency |
| Low | `track-file` command silently exits on errors — acceptable for hooks but should log in debug mode |
| Low | Command help text in README doesn't match actual CLI commands (README shows `maestro tasks list` but actual command is `maestro task list`) |

---

### 2. TypeScript Quality — Grade: B

**Strengths:**
- `strict: true` in tsconfig.json — strict null checks, no implicit any at compiler level
- Well-defined type hierarchy in `types/manifest.ts` (408 lines) with proper interfaces for `MaestroManifest`, `TaskData`, `SessionConfig`, `TeamMemberData`
- Type guard functions (`isWorkerMode()`, `isCoordinatorMode()`, etc.) used correctly
- Zero `any` usage in critical modules: `agent-spawner.ts`, `command-permissions.ts`, `claude-spawner.ts`, `codex-spawner.ts`, `gemini-spawner.ts`, `manifest.ts` types

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **170 `any` type occurrences across 23 files** — worst offenders: `session.ts` (28), `team.ts` (22), `team-member.ts` (22), `task.ts` (20), `manifest-generator.ts` (11), `index.ts` (10) |
| High | API responses universally typed as `any` — e.g., `const tasks: any[] = await api.get(...)` throughout command files. All server responses lose type safety at the boundary |
| Medium | `api.ts` request method uses `options?: any` parameter instead of proper `RequestInit` type |
| Medium | `buildWhoamiJson()` returns `object` and internally uses `result: any` — defeats the purpose of TypeScript |
| Low | `validation.ts:49` uses `return priority as any` to bypass type checking |

**`any` Usage by Module:**

| Module | Count | Worst Files |
|--------|-------|-------------|
| Commands | ~104 | session.ts (28), team.ts (22), team-member.ts (22), task.ts (20) |
| Services | ~14 | manifest-reader.ts (9) |
| Core | ~18 | index.ts (10), api.ts (8) |
| Utils | ~7 | formatter.ts (4), errors.ts (2), validation.ts (1) |
| Schemas | ~4 | manifest-schema.ts (4) |
| Prompting | ~3 | capability-policy.ts (2), manifest-normalizer.ts (1) |

---

### 3. Error Handling & Exit Codes — Grade: B+

**Strengths:**
- Centralized error handler in `utils/errors.ts` with HTTP status code mapping, network error detection, and structured exit codes (0-5)
- Consistent `handleError(err, isJson)` pattern used across command files
- API client implements exponential backoff retry (configurable retries/delay) with smart 4xx vs 5xx handling
- Informative error messages in `prompts/errors.ts` with user-friendly hints and suggestions

**Issues:**

| Severity | Finding |
|----------|---------|
| High | Multiple **silent `catch {}` blocks** in `worker-init.ts:122-124,128-134` and `orchestrator-init.ts:112-130` — API failures during session status updates are completely swallowed with no logging even in debug mode |
| Medium | `commands` action (index.ts:296-298) calls `process.exit(1)` with no error message when manifest read fails in non-JSON mode |
| Medium | `status` action (index.ts:397-403) catches errors but prints nothing in non-JSON mode |
| Medium | Exit codes not documented — users can't programmatically distinguish error types without `--json` |
| Low | API client retry logic uses `any` for error typing — could miss categorizing certain error types |

---

### 4. Input Validation & Security — Grade: B-

**Strengths:**
- Dedicated `utils/validation.ts` with validators for task IDs (regex), statuses (enum), priorities (enum), and required fields
- AJV schema validation for manifests with `additionalProperties: false` — rejects unknown fields
- Manifest normalizer handles legacy fields gracefully with deprecation warnings
- `encodeURIComponent()` used for URL parameters in some places (e.g., `team.ts:411`)

**Issues:**

| Severity | Finding |
|----------|---------|
| Critical | **No authentication** — `api.ts` sends no auth tokens/API keys. All server requests are unauthenticated. README mentions `MAESTRO_API_KEY` but it's never used in code |
| High | **Command injection risk in `hook-executor.ts`** — uses `exec()` (shell execution) with no input sanitization. Hook commands come from manifest/config files, but a malicious manifest could inject arbitrary shell commands |
| High | **No URL validation** — `api.setBaseUrl(url)` accepts arbitrary URLs from `--server` flag without validation. Could be used for SSRF if the server proxies requests |
| Medium | API responses not validated — server could return malformed data that causes runtime errors downstream |
| Medium | `spawner-env.ts:47` removes `CLAUDE_CODE_NESTED_*` detection variables — could allow nested invocation attacks |
| Low | Task ID regex validation (`[a-zA-Z0-9_-]+`) is permissive — allows very long IDs with no length limit |

---

### 5. Plugin Architecture — Grade: B+

**Strengths:**
- Clean skill loading system in `services/skill-loader.ts` — discovers skills from multiple directories (project, user, system)
- SKILL.md convention for self-describing plugins with metadata extraction
- Deduplication of skills across directories (project overrides user overrides system)
- Agent spawners (Claude/Codex/Gemini) use strategy pattern with common interface
- Plugin directories resolved relative to CLI installation for portability

**Issues:**

| Severity | Finding |
|----------|---------|
| Medium | **Silent skill loading failures** — `skill-loader.ts` returns empty arrays on errors instead of reporting issues. A misconfigured plugin directory is indistinguishable from no plugins |
| Medium | No skill content validation — SKILL.md files are read but their structure isn't validated beyond basic title/description extraction |
| Low | Plugin system is read-only discovery — no install/uninstall/update lifecycle management |
| Low | No versioning for skills — can't detect compatibility issues between skill versions and CLI version |

---

### 6. Testing Coverage — Grade: B+

**Quantitative Metrics:**
- **196 total tests** across **16 test files**
- **184 passing, 12 failing** (all snapshot mismatches — stale snapshots)
- **~9,750 lines** of test code vs **~35,317 lines** of source (28% test-to-source ratio)
- Test framework: Vitest with snapshot testing

**Coverage by Area:**

| Area | Test Files | Tests | Coverage Quality |
|------|-----------|-------|-----------------|
| Schema Validation | 1 | 30+ | Excellent — positive and negative cases |
| Prompting System | 3 | 35+ | Excellent — matrix testing across 4 modes |
| Services | 4 | 60+ | Good — hook-executor, manifest-reader, skill-loader, claude-spawner |
| Commands | 5 | 45+ | Moderate — init commands, skill, spawn-mode, manifest-generator |
| Integration | 1 | 2 | Minimal — basic HTTP mock only |
| Types | 1 | 9+ | Good — structural type validation |
| Utils | 1 | 2 | Minimal — only formatter |

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **12 failing snapshot tests** in `prompt-composer.test.ts` — code changed but snapshots not updated. Indicates CI is not enforcing test passes |
| High | **No tests for major command files**: `task.ts`, `session.ts`, `team.ts`, `team-member.ts`, `master.ts`, `project.ts`, `report.ts`, `modal.ts` — these contain the bulk of user-facing functionality |
| Medium | **No test for `api.ts`** — the API client with retry logic, error handling, and HTTP methods is untested |
| Medium | **No test for `storage.ts`** — local storage layer is untested |
| Medium | Integration test (`cli.test.ts`) only covers 2 scenarios (list tasks, create task) — doesn't exercise most CLI commands |
| Low | No E2E tests that exercise the full CLI binary via subprocess |

---

### 7. Performance — Grade: B

**Strengths:**
- ESM modules with tree-shakeable imports
- Binary builds supported via `@yao-pkg/pkg` for fast startup (no Node.js boot)
- esbuild bundler for fast compilation
- Local storage caches server data for offline reads
- Cached permissions via `getCachedPermissions()` avoid repeated manifest parsing

**Issues:**

| Severity | Finding |
|----------|---------|
| Medium | **No lazy loading** — all 15+ command modules are imported eagerly at startup. For a CLI that typically runs one command, this adds unnecessary startup time |
| Medium | `storage.ts` loads ALL projects, tasks, and sessions from disk on initialization — no pagination or filtering |
| Low | AJV schema compilation happens at module load time — adds to startup cost for commands that don't need validation |
| Low | `skill-loader.ts` scans multiple directories synchronously — could benefit from async scanning |

---

### 8. Documentation — Grade: C+

**Strengths:**
- README covers installation, quick start, and basic command structure
- JSDoc comments on key functions in type files and validation utilities
- `SKILLS-IMPLEMENTATION.md` documents the skills system architecture
- Help text present on all commander commands via `.description()`
- `prompts/errors.ts` provides helpful error messages with actionable hints

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **README command examples are inaccurate** — shows `maestro tasks list` (plural) but actual command is `maestro task list` (singular). Shows `maestro agent start` but no `agent` command exists |
| High | **README config example is fictional** — shows `~/.maestro/config.json` with `apiKey` but actual config is a flat file at `~/.maestro/config` with env var format |
| Medium | **No man pages** — CLI has no generated man page documentation |
| Medium | No API documentation for the programmatic API (`api.ts`, `storage.ts`) |
| Medium | Environment variables partially documented — README lists 3 but code uses 15+ (`MAESTRO_SESSION_ID`, `MAESTRO_TASK_IDS`, `MAESTRO_COORDINATOR_SESSION_ID`, `MAESTRO_RETRIES`, `MAESTRO_RETRY_DELAY`, `MAESTRO_DEBUG`, `MAESTRO_MANIFEST_PATH`, `DATA_DIR`, `SESSION_DIR`, etc.) |
| Low | `docs/` directory exists but was not examined for content |

---

### 9. npm Package Readiness — Grade: C

**Strengths:**
- `bin` entry correctly defined: `"maestro": "./bin/maestro.js"`
- `"type": "module"` for ESM support
- `prepublishOnly` script runs build before publish
- Multi-platform binary builds defined (darwin-arm64, darwin-x64, linux-x64, win-x64)
- Package scoped under `@maestro/cli`

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **No `files` field in package.json** — will publish entire directory including `tests/`, `src/`, `examples/`, `scripts/`, `docs/`, `plugins/`, and potentially sensitive files |
| High | **No `.npmignore`** — without `files` or `.npmignore`, npm defaults to including everything not in `.gitignore` |
| High | **No `engines` field** — doesn't specify Node.js version requirement (uses ES2020 target and ESM which requires Node 14+) |
| Medium | **`author` field empty** — required for public npm packages |
| Medium | **License mismatch** — `package.json` says `ISC` but root `LICENSE` file is `AGPL-3.0` |
| Medium | No `repository`, `bugs`, or `homepage` fields in package.json |
| Low | Version is `0.1.0` — appropriate for pre-release but should be documented |

---

### 10. Open Source Readiness — Grade: C-

**Present:**
- LICENSE file exists (AGPL-3.0 at repo root)
- README.md with basic usage
- ISC license in package.json (though mismatched)

**Missing:**

| Severity | Finding |
|----------|---------|
| High | **No CONTRIBUTING.md** — no contribution guidelines for external contributors |
| High | **No CHANGELOG.md** — no version history or migration notes |
| High | **No CI/CD configuration** — no GitHub Actions, no automated testing on push/PR |
| High | **No linting configuration** — no ESLint, no Prettier, no code formatting enforcement |
| Medium | **No Code of Conduct** — expected for open-source projects |
| Medium | **No issue templates** — no bug report or feature request templates |
| Medium | **No `.editorconfig`** — inconsistent formatting may occur across contributors |
| Low | No security policy (SECURITY.md) |
| Low | No GitHub Actions for automated npm publishing |

---

## Top 10 Actionable Recommendations

Prioritized by impact on production-readiness and open-source quality:

### 1. Eliminate `any` Types — Impact: Very High
**170 occurrences across 23 files.** Create typed interfaces for all API responses (server returns typed JSON). Start with the worst offenders: `session.ts` (28), `team.ts` (22), `team-member.ts` (22), `task.ts` (20). Define response types like `TaskResponse`, `SessionResponse`, etc. and use them in API calls.

### 2. Add Authentication to API Client — Impact: Very High
The `api.ts` client sends zero authentication headers. Implement token-based auth using the `MAESTRO_API_KEY` environment variable already documented in the README. Add an `Authorization: Bearer <key>` header to all requests.

### 3. Fix Stale Tests & Add Missing Command Tests — Impact: High
12 snapshot tests are failing. Update snapshots and add CI to prevent regressions. Add tests for `task.ts`, `session.ts`, `team.ts`, `team-member.ts`, and `api.ts` — these contain the majority of user-facing functionality and are currently untested.

### 4. Add CI/CD Pipeline — Impact: High
Set up GitHub Actions with: (a) `vitest run` on every PR, (b) TypeScript compilation check, (c) lint check. This catches the current 12 failing tests immediately and prevents future regressions.

### 5. Add Linting & Formatting — Impact: High
Add ESLint with `@typescript-eslint/no-explicit-any` rule (initially as warning, then error). Add Prettier for consistent formatting. Both prevent the `any` drift from recurring.

### 6. Secure Hook Execution — Impact: High
`hook-executor.ts` uses `exec()` which runs commands through the shell. Switch to `execFile()` or `spawn()` with explicit argument arrays to prevent shell injection. Alternatively, validate/sanitize hook commands before execution.

### 7. Fix Package.json for npm Publishing — Impact: Medium
- Add `"files": ["dist/", "bin/", "plugins/"]` to prevent publishing test/source files
- Add `"engines": { "node": ">=18" }`
- Fix license to `AGPL-3.0-only` (matching the actual LICENSE file)
- Add `author`, `repository`, `bugs`, `homepage` fields

### 8. Fix README Accuracy — Impact: Medium
Update all command examples to match actual CLI interface. Remove fictional config file example. Document all environment variables. Add a proper "Configuration" section showing env var format.

### 9. Add Open Source Essentials — Impact: Medium
Create: CONTRIBUTING.md (contribution workflow), CHANGELOG.md (version history), CODE_OF_CONDUCT.md, .editorconfig. Add GitHub issue templates for bug reports and feature requests.

### 10. Implement Lazy Command Loading — Impact: Low-Medium
Currently all 15+ command modules are imported eagerly. Use Commander.js lazy action loading or dynamic imports to only load the invoked command's module, improving CLI startup time.

---

## Positive Highlights

1. **Excellent prompt engineering system** — The 4-mode agent model with layered capability resolution, XML-based prompt composition, and manifest normalization is sophisticated and well-tested. The `prompting/` module has near-zero `any` usage and comprehensive snapshot tests.

2. **Clean spawner abstraction** — The strategy pattern across Claude/Codex/Gemini spawners with shared environment preparation is well-designed and easily extensible to new agent tools.

3. **Robust manifest validation pipeline** — The read → parse → validate (AJV) → normalize → permission-resolve chain provides defense-in-depth against malformed manifests with helpful error messages at each stage.

4. **Thoughtful terminal UI** — `ui/init-display.ts` handles emoji width calculation, ANSI color stripping, and Unicode box-drawing with careful attention to terminal alignment — a sign of polish.

5. **Binary distribution support** — Multi-platform binary builds via `@yao-pkg/pkg` lower the barrier to adoption for users without Node.js.

6. **Permission system** — The 3-tier command permission resolution (manifest → fallback → safe-degraded) with hard-blocks for mode-incompatible commands shows security-conscious design.

---

## Appendix: File Inventory

### Source Files (35,317 total lines)

| Directory | Files | Purpose |
|-----------|-------|---------|
| `src/commands/` | 15 files | Command implementations |
| `src/services/` | 9 files | Business logic services |
| `src/prompting/` | 6 files | Agent prompt composition |
| `src/prompts/` | 7 files | Prompt string constants |
| `src/types/` | 2 files | TypeScript type definitions |
| `src/schemas/` | 1 file | JSON Schema validation |
| `src/utils/` | 3 files | Error handling, formatting, validation |
| `src/ui/` | 1 file | Terminal display |
| `src/` | 3 files | Entry point, config, API client, storage |

### Test Files (9,750 total lines)

| Directory | Files | Tests |
|-----------|-------|-------|
| `tests/unit/` | 1 | 2 |
| `tests/integration/` | 1 | 2 |
| `tests/services/` | 4 | ~60 |
| `tests/commands/` | 5 | ~45 |
| `tests/schemas/` | 1 | ~30 |
| `tests/types/` | 1 | ~9 |
| `tests/prompting/` | 3 | ~48 |
| **Total** | **16** | **196** |

---

*Report generated by automated code quality audit.*
