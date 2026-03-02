# CLI Code Quality Report

**Date:** 2026-02-27
**Reviewer:** Maestro CLI Tester Agent
**Scope:** `maestro-cli/src/` — Production-grade open-source readiness
**Overall Score: 6.5 / 10**

---

## Executive Summary

The maestro-cli codebase has a solid foundation: well-structured command modules, consistent use of Commander.js patterns, a clean API client with retry logic, good TypeScript type coverage in domain types, and a well-organized directory layout. However, several issues would make the project look incomplete or unprofessional to open-source contributors — most notably **silent failures** (empty else-branches that produce no output), **placeholder URLs in package.json**, and pervasive `any` types in utility functions.

---

## Overall Score: 6.5 / 10

| Category | Score | Notes |
|---|---|---|
| Code Organization | 8/10 | Clean module structure, good separation of concerns |
| TypeScript Quality | 5/10 | Domain types are good, utilities/commands use `any` extensively |
| Error Handling | 6/10 | Good HTTP error handling, but silent failures in human mode |
| Command Consistency | 7/10 | Mostly consistent Commander.js patterns, some indentation issues |
| User-Facing Output | 5/10 | Critical: `status` and `commands --check` produce no human output |
| Dead Code | 6/10 | `LocalStorage`, unused validators, empty catch blocks |
| Open-Source Readiness | 5/10 | Placeholder URLs, version 0.1.0, no CHANGELOG |

---

## Critical Issues (Must Fix)

### 1. `status` command produces NO human-readable output
**File:** `src/index.ts:393–403`

```typescript
if (isJson) {
  outputJSON(summary);  // ✅ JSON works
} else {
  // ← EMPTY! No output whatsoever
}
```

When a user runs `maestro status` without `--json`, they get absolutely nothing back — no task counts, no session info, no error. The data is computed correctly but never displayed. This is a critical UX bug.

**Also affected:**
- `index.ts:357–358` — `status` with no project ID: non-JSON mode prints nothing before `process.exit(1)`
- `index.ts:400–401` — `status` error in non-JSON mode: silent failure

---

### 2. `commands --check` produces no output in non-JSON mode
**File:** `src/index.ts:307–310`

```typescript
if (isJson) {
  outputJSON({ command: commandName, allowed, mode: permissions.mode });
} else {
  // ← EMPTY! User gets no feedback
}
```

Running `maestro commands --check task:list` in a terminal shows nothing. The user cannot tell if the command is allowed or denied.

**Also affected:**
- `index.ts:328–329` — `commands` error handler in non-JSON mode: empty catch block produces no output

---

### 3. `project list` shows nothing for empty result in non-JSON mode
**File:** `src/commands/project.ts:29–31`

```typescript
if (projects.length === 0) {
  // ← EMPTY! No "No projects found." message
} else {
  outputTable(...);
}
```

Every other command in the codebase outputs `'No X found.'` in this case (task list, session list, team list, etc.), making this an inconsistency that looks like an unfinished feature.

---

### 4. Placeholder `your-org` URLs in `package.json`
**File:** `package.json:42–48`

```json
"url": "https://github.com/your-org/agent-maestro.git",
"url": "https://github.com/your-org/agent-maestro/issues",
"homepage": "https://github.com/your-org/agent-maestro/tree/main/maestro-cli#readme"
```

These placeholder values must be replaced with the real repository URL before any open-source release. This is immediately visible to contributors via `npm info` and in the GitHub repository viewer.

---

### 5. Hook commands log verbose debug output unconditionally
**Files:** `src/commands/session.ts:701–716, 743–770, 780–820, 831–860`

Commands like `session register`, `session complete`, `session needs-input`, and `session resume-working` print internal debug-style logs to stdout unconditionally in non-JSON mode:

```
[session:register]    PATCH /api/sessions/sess_xxx -> status: 'working'
[session:register]    Session status updated to 'working'
[session:register] Done: session sess_xxx registered
```

These are called by system hooks, but the verbose logging is exposed in the CLI output. For an open-source project, this looks like debug code that wasn't cleaned up.

---

## Important Issues (Should Fix)

### 6. Pervasive `any` types in utility functions and commands
**Files:** `src/utils/formatter.ts`, `src/utils/errors.ts`, `src/commands/master.ts`, `src/commands/project.ts`, `src/commands/modal.ts`

| Location | Usage |
|---|---|
| `formatter.ts:4` | `outputJSON(data: any)` |
| `formatter.ts:8` | `outputErrorJSON(error: any)` |
| `formatter.ts:17` | `outputTable(headers, rows: any[][])` |
| `formatter.ts:30` | `outputTaskTree(tasks: any[])` |
| `errors.ts:46` | `handleError(err: any, json: boolean)` |
| `errors.ts:186` | `const error: any = createError(...)` |
| `master.ts:21,54,87,118` | All API responses typed as `any[]` or `any` |
| `project.ts:22,55,86,136,162` | API responses typed as `any` |
| `modal.ts:108,191` | `cmdOpts: any` parameter |
| `index.ts:113` | `const result: any = { mode: ... }` |

The domain types in `src/types/api-responses.ts` are well-defined (e.g., `TaskResponse`, `SessionResponse`, `TeamResponse`). The project types should be added there and used consistently. Formatter utilities should use `unknown` or proper generics instead of `any`.

---

### 7. Inconsistent indentation style
Multiple files mix 2-space and 4-space indentation. Within `src/index.ts`, some action callbacks use 6-space indentation (nesting 4+2 or 4+4):

```typescript
// index.ts - 'whoami' action (6-space inner indent)
program.command('whoami')
  .action(async () => {
      const opts = program.opts();  // 6 spaces (2 outer + 4 inner)
```

vs.

```typescript
// report.ts - consistent 2-space
export function registerReportCommands(program: Command) {
  const report = program.command('report');  // 2 spaces
```

Commands in `task.ts`, `session.ts`, `team.ts`, `project.ts` use 4-space indentation. Core files like `index.ts`, `api.ts`, `report.ts` use 2-space. This inconsistency suggests different authors/editors without a shared config enforced. A `.editorconfig` or enforced Prettier config would resolve this.

---

### 8. Duplicate command groups: `maestro report` vs `maestro session report`
**Files:** `src/commands/report.ts`, `src/commands/session.ts:356–385`

The CLI exposes two parallel command trees for the same functionality:
- `maestro report progress/complete/blocked/error`
- `maestro session report progress/complete/blocked/error`

Both call the same `executeReport()` function. This duplication is confusing for new users reading the help output, and the docs reference (`maestro session report`) makes it unclear which to use.

**Recommendation:** Deprecate or remove `maestro report` as a standalone group, or clearly document the distinction.

---

### 9. `validateRequired` is imported but never used for validation
**File:** `src/commands/session.ts:5`

```typescript
import { validateRequired, validateTaskId } from '../utils/validation.js';
```

`validateRequired` is imported in `session.ts` but never called. Commands instead do inline validation with `{ message: '...' }` objects. The validation utilities in `src/utils/validation.ts` are well-designed but underutilized — commands re-implement the same pattern manually.

---

### 10. `isOffline` getter is incorrect
**File:** `src/config.ts:41–43`

```typescript
get isOffline() {
  return !process.env.MAESTRO_SERVER_URL && !process.env.MAESTRO_API_URL;
},
```

This doesn't account for `discoverServerUrl()` which reads from `DATA_DIR/server-url`. A server URL discovered via this mechanism would mean the client is NOT offline, but `isOffline` would still return `true`. The getter appears unused in the codebase, but if it ever is used, it will produce incorrect results.

---

### 11. `session notify` has no error handling
**File:** `src/commands/session.ts:979–987`

```typescript
for (const targetId of ids) {
  await api.post(`/api/sessions/${targetId}/mail`, { ... });
  // ← No try/catch — any failure aborts silently or crashes
}
console.log(`Notified ${ids.length} session(s).`);
```

If any one session fails (session not found, server error), the command throws without notifying about successful sends or providing useful error output. For multi-target notifications, partial failures should be reported.

---

### 12. `buildWhoamiJson` has `any` internal type but good output shape
**File:** `src/index.ts:107–137`

```typescript
function buildWhoamiJson(...): object {
  const result: any = { ... }
```

The return type is `object` (too broad) and the internal variable is `any`. Given that `whoami` is the most-used diagnostic command, this should have a well-typed return interface.

---

## Minor Issues (Nice to Fix)

### 13. `LocalStorage` class and `storage` singleton appear unused
**File:** `src/storage.ts`

The `LocalStorage` class and `export const storage = new LocalStorage()` exist but are never imported or used in any command file. All data access goes through `api.get()`. If this is intentional (server-only architecture), the file should either be removed or clearly documented as a read-through cache for offline/testing use.

---

### 14. `validateTaskId`, `validateStatus`, `validatePriority` are defined but underused
**File:** `src/utils/validation.ts`

These validators exist but commands (e.g., `task update`, `task create`) do not call them for CLI option validation. For example, `task update --status invalid-status` will pass through to the API which may return a cryptic 400 error instead of a clear validation message with valid options listed.

---

### 15. Staging detection by port number is fragile
**File:** `src/config.ts:10–12`

```typescript
const isStaging = process.env.SESSION_DIR?.includes('maestro-staging') ||
                  process.env.DATA_DIR?.includes('maestro-staging') ||
                  process.env.MAESTRO_SERVER_URL?.includes('3002');
```

Detecting staging by checking if the URL contains `3002` is brittle. If the production server runs on a non-standard port, or staging moves to a different port, this silently loads the wrong config. A dedicated `MAESTRO_STAGING=true` env var would be more explicit.

---

### 16. `task.ts` silently swallows children fetch errors
**File:** `src/commands/task.ts:33–38`

```typescript
try {
  const children = await api.get<TaskResponse[]>(`/api/tasks/${taskId}/children`);
  (t as TaskResponse & { children: TaskResponse[] }).children = children;
} catch {
  (t as TaskResponse & { children: TaskResponse[] }).children = [];
}
```

The empty catch silently treats API errors as "no children." If the children endpoint is unavailable or errors, the user sees the parent task with no children — indistinguishable from a task that genuinely has no children.

---

### 17. `tree` command makes N+1 API requests
**File:** `src/commands/task.ts:728–741`

The `task tree` command fetches all root tasks, then for each task fetches it again AND fetches its children, then recursively repeats. For a project with many tasks, this can result in dozens of API requests. A single server endpoint for tree data would be significantly more efficient.

---

### 18. `session spawn` output mentions "Waiting for Agent Maestro to open terminal window"
**File:** `src/commands/session.ts:663`

```typescript
console.log('   Waiting for Agent Maestro to open terminal window...');
```

This message is UI-specific and assumes Agent Maestro desktop app is in use. For users running the CLI standalone or on remote servers, this message is confusing. Consider making this message conditional or more generic.

---

### 19. `package.json` version `0.1.0` may signal immaturity
While technically valid, starting open-source at `0.1.0` without a CHANGELOG or release notes may confuse early adopters about stability expectations. Recommend adding a `CHANGELOG.md` before the first release.

---

### 20. `task report blocked` vs `task block` have overlapping semantics
**Files:** `src/commands/task.ts:349–390` and `src/commands/task.ts:529–565`

- `task block <id> --reason <reason>`: Sets task status to `blocked`
- `task report blocked <taskId> <reason>`: Sets session status to `blocked`

The distinction (task-level vs session-level) is not clear from the command names. This is confusing for new users.

---

## Command Coverage Assessment

| Command | Implemented | Notes |
|---|---|---|
| `maestro whoami` | ✅ | Works in both JSON and human mode |
| `maestro status` | ⚠️ | JSON works; human mode is silent |
| `maestro commands` | ⚠️ | `--check` in human mode is silent |
| `maestro debug-prompt` | ✅ | Good, both modes work |
| `maestro task list/get/create/edit/delete` | ✅ | Well implemented |
| `maestro task children/tree` | ✅ | Works, N+1 performance concern |
| `maestro task report progress/complete/blocked/error` | ✅ | Works |
| `maestro task docs add/list` | ✅ | Works |
| `maestro task update/complete/block` | ✅ | Works |
| `maestro session list/info/siblings` | ✅ | Works |
| `maestro session spawn` | ✅ | Works |
| `maestro session watch` | ✅ | Works |
| `maestro session logs` | ✅ | Works |
| `maestro session prompt/notify` | ⚠️ | `notify` missing error handling |
| `maestro session mail read` | ✅ | Works |
| `maestro session report progress/complete/blocked/error` | ✅ | Works |
| `maestro session docs add/list` | ✅ | Works |
| `maestro session register/complete/needs-input/resume-working` | ⚠️ | Works but too verbose |
| `maestro report progress/complete/blocked/error` | ✅ | Works (duplicate of session report) |
| `maestro project list/get/create/delete` | ⚠️ | `project list` empty result = no output |
| `maestro project set-master/unset-master` | ✅ | Works |
| `maestro master projects/tasks/sessions/context` | ✅ | Works |
| `maestro team list/get/create/edit/delete` | ✅ | Works |
| `maestro team archive/unarchive` | ✅ | Works |
| `maestro team add-member/remove-member` | ✅ | Works |
| `maestro team add-sub-team/remove-sub-team` | ✅ | Works |
| `maestro team tree` | ✅ | Works |
| `maestro show modal` | ✅ | Works |
| `maestro modal events` | ✅ | Works |
| `maestro worker init` | ✅ | Works |
| `maestro track-file` | ✅ | Works (hook command) |

**Summary:** 3 commands have critical silent-failure bugs. 1 command has missing error handling. The overall coverage is comprehensive.

---

## Recommendations by Priority

### Priority 1 — Before any public release
1. Fix empty `else {}` blocks in `status` command (add human-readable output)
2. Fix empty `else {}` blocks in `commands --check` (add human-readable output)
3. Fix `project list` empty result (add `'No projects found.'`)
4. Replace `your-org` placeholder URLs in `package.json`

### Priority 2 — Important for open-source credibility
5. Replace `any` in `formatter.ts` with proper generics/`unknown`
6. Replace `any` in `errors.ts` with typed error interface
7. Add proper types to `project.ts` and `master.ts` API responses (use/extend `src/types/api-responses.ts`)
8. Standardize indentation to 2-space across all files (enforce with Prettier config)
9. Add error handling to `session notify` loop
10. Reduce/remove hook command debug verbosity or gate behind `MAESTRO_DEBUG`

### Priority 3 — Nice to have
11. Remove or document the unused `LocalStorage` / `storage` singleton
12. Call `validateStatus`, `validatePriority` validators in command option parsing
13. Remove `isOffline` getter or fix its logic
14. Deprecate `maestro report` standalone group in favor of `maestro session report`
15. Add `CHANGELOG.md`
16. Fix staging detection in `config.ts` (use explicit `MAESTRO_STAGING=true`)

---

## Code Organization Highlights (What's Good)

- **Clean module structure**: Commands are cleanly separated into `src/commands/`, services into `src/services/`, types into `src/types/`
- **API client**: `src/api.ts` has proper retry logic with exponential backoff, correct 4xx vs 5xx handling, and TypeScript generics
- **Error handling infrastructure**: `src/utils/errors.ts` has well-designed exit codes, error categorization, and user-friendly suggestions
- **Type definitions**: `src/types/manifest.ts` and `src/types/api-responses.ts` are thorough and well-documented
- **Command permissions system**: `src/services/command-permissions.ts` with `guardCommand()` is a clean pattern
- **Prompt architecture**: The `src/prompting/` module is well-separated and testable
- **Spinner usage**: Consistent use of `ora` spinners for async operations improves UX

---

*Generated by Maestro CLI Tester Agent — `sess_1772182867809_5o0n7c5ss`*
