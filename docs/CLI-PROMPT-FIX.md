# CLI Prompt Passing - Fixed

## Changes Made

### 1. Pass Prompt Directly Instead of File
**Before:**
- CLI wrote prompt to temp file
- Passed file path to Claude Code
- Claude Code read the file

**After:**
- CLI passes prompt directly as command argument
- No temp file created
- Faster and cleaner

**File:** `maestro-cli/src/services/claude-spawner.ts:199-248`

```typescript
// OLD CODE (lines 205-218)
const prompt = this.preparePrompt(manifest);
const promptFile = await this.writePromptToFile(prompt);  // ❌ Write to file
// ...
args.push(promptFile);  // ❌ Pass file path

// NEW CODE
const prompt = this.preparePrompt(manifest);
// No file write!
// ...
args.push(prompt);  // ✅ Pass prompt directly
```

### 2. Print Exact Claude Code Command
Added command display before spawning:

```
╭─────────────────────────────────────────────────────────────────╮
│ Claude Code Command                                             │
╰─────────────────────────────────────────────────────────────────╯
Working Directory: /path/to/project
Command: claude --plugin-dir /path/to/plugins --model sonnet "Your prompt here..."
```

**File:** `maestro-cli/src/services/claude-spawner.ts:231-238`

### 3. Removed Temp File Cleanup
Since we no longer create temp files, removed cleanup code:

**Files:**
- `maestro-cli/src/commands/worker-init.ts:177-181`
- `maestro-cli/src/commands/orchestrator-init.ts:177-181`

```typescript
// REMOVED
await this.spawner.cleanup(spawnResult.promptFile);
```

## Benefits

1. **Direct Communication**: Prompt goes straight to Claude Code
2. **No File I/O**: Faster spawning, no disk writes
3. **Transparency**: Users can see exact command being run
4. **Cleaner**: No temp files to manage
5. **Debugging**: Easy to copy/paste command for testing

## Testing

Spawn a session and verify:
1. Command is printed before Claude starts
2. Prompt is passed directly (no temp file path in command)
3. Claude receives the full prompt content

```bash
# Test worker spawn
cd maestro-cli
npm run build
maestro worker init  # (with MAESTRO_MANIFEST_PATH set)

# You should see:
# ╭─────────────────────────────────────────────────────────────────╮
# │ Claude Code Command                                             │
# ╰─────────────────────────────────────────────────────────────────╯
# Working Directory: /your/project/path
# Command: claude --plugin-dir ... --model sonnet "You are a worker..."
```

## Status
✅ Prompt passed directly (no file)
✅ Command printed before spawn
✅ Temp file cleanup removed
✅ CLI rebuilt
