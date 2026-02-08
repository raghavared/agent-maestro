# CLI Exit Issue - Fixed

## Problem

The maestro CLI was exiting immediately and showing help text instead of properly initializing worker/orchestrator sessions. The issue was that `maestro worker init` and `maestro orchestrator init` commands were failing silently.

## Root Cause

The worker-init and orchestrator-init commands were accessing the manifest incorrectly:

**Incorrect Code:**
```typescript
console.log(`   Tasks: ${manifest.tasks.length}`);  // ❌ tasks is undefined
manifest.tasks.forEach((task, i) => { ... });
```

**Correct Code:**
```typescript
console.log(`   Task: ${manifest.task.title} (${manifest.task.id})`);  // ✅ task exists
```

The manifest structure has a single `task` field (singular), not a `tasks` array. This caused the commands to crash with an error like "Cannot read property 'length' of undefined", which triggered the error handler and exited.

## Fix Applied

### File 1: maestro-cli/src/commands/worker-init.ts
- Line 120-127: Fixed manifest.tasks references to manifest.task
- Changed from iterating over tasks array to accessing the single task object
- Updated display to show: Task title, ID, Project ID, and Skills

**Before:**
```typescript
console.log(`   Tasks: ${manifest.tasks.length}`);
manifest.tasks.forEach((task, i) => {
  console.log(`     ${i + 1}. ${task.title} (${task.id})`);
});
console.log(`   Project: ${manifest.tasks[0].projectId}`);
```

**After:**
```typescript
console.log(`   Task: ${manifest.task.title} (${manifest.task.id})`);
console.log(`   Project: ${manifest.task.projectId}`);
```

### File 2: maestro-cli/src/commands/orchestrator-init.ts
- Applied identical fix to orchestrator-init command
- Same manifest.tasks → manifest.task correction

## Verification

✅ Tests passing:
- worker-init tests: 9/9 passing
- orchestrator-init tests: 9/9 passing
- skill-loader tests: 20/20 passing
- All new logging tests passing

## What Now Works

After the fix:
1. `maestro worker init` correctly reads manifest
2. `maestro orchestrator init` correctly reads manifest
3. Displays task information properly
4. Spawns Claude with the correct session
5. CLI no longer exits prematurely

## Testing the Fix

Now when you make a spawn request:

```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test",
    "taskIds": ["test"],
    "role": "worker"
  }'
```

The UI will receive the spawn event and:
1. Spawn a terminal with maestro worker init
2. Worker init command will execute successfully
3. Display: "🔧 Initializing Maestro Worker Session"
4. Show task information
5. Spawn Claude Code session
6. Claude will begin working on the task

## Summary

**Issue**: Manifest field was singular (task) but code expected plural (tasks)
**Fix**: Updated both worker-init and orchestrator-init to use correct field names
**Result**: CLI commands now work correctly and spawn sessions as expected
