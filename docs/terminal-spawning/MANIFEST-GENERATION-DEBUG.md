# Manifest Generation Debugging Guide

## Error Encountered
```
HTTP 500: {"error":true,"code":"manifest_generation_failed","message":"Failed to generate manifest: Failed to read manifest: Cannot read properties of undefined (reading 'id')"}
```

## Root Cause
This error is NOT caused by the event consolidation changes. It's a separate issue with the manifest generation CLI command.

The error indicates:
1. The `maestro manifest generate` CLI command may not be installed or available
2. The manifest structure may not match what the code expects
3. The manifest file may not be created properly

---

## Debugging Steps

### Step 1: Check if maestro CLI is installed
```bash
# Check if maestro command exists
which maestro
maestro --version

# If not installed, install it
npm install -g maestro
# OR
npm install -g @anthropic-sdk/maestro-cli
```

### Step 2: Restart the server with debug enabled
```bash
# Kill the old server if running
npm run dev --workspace maestro-server
```

### Step 3: Attempt to spawn a session
1. Go to UI and try to spawn a Maestro session
2. Watch server logs for detailed manifest generation output

### Step 4: Check the server logs for:

**New debugging output will show:**
```
📋 GENERATING MANIFEST VIA CLI:
   • Session ID: sess_...
   • Role: worker
   • Project ID: proj_...
   • Task IDs: task_...

🔧 CLI COMMAND:
   maestro manifest generate --role worker --project-id proj_... ...

✅ MANIFEST GENERATED SUCCESSFULLY:
   • Path: /Users/.../manifest.json
   • Size: XXXX bytes
   • Manifest structure: { ... }
```

If you see **Stderr or Stdout output**, that's where the error is.

---

## Common Issues & Solutions

### Issue 1: maestro command not found
**Error in logs:**
```
maestro: command not found
```

**Solution:**
```bash
# Install maestro CLI globally
npm install -g maestro

# OR if using a specific package
npm install -g @anthropic-sdk/maestro

# Verify installation
maestro --version
```

### Issue 2: Manifest structure doesn't match
**Error in logs:**
```
Cannot read properties of undefined (reading 'id')
manifest.task=undefined
```

**Solution:**
The manifest structure might be `manifest.tasks` (plural) instead of `manifest.task` (singular). The improved logging will show this. If so, update sessions.ts line 103-107 to handle the correct structure.

### Issue 3: Manifest file not created
**Error in logs:**
```
ENOENT: no such file or directory, open '/Users/.../manifest.json'
```

**Solution:**
The CLI command might be failing. Check the Stderr output for the actual error from the `maestro manifest generate` command.

### Issue 4: Invalid manifest content
**Error in logs:**
```
Manifest structure shows: {}
```

**Solution:**
The `maestro manifest generate` command is running but producing an empty manifest. This could mean:
- Required parameters are wrong (projectId, taskIds, etc.)
- The manifest generation logic in the CLI is failing
- Check that projectId and taskIds actually exist

---

## Detailed Troubleshooting

### 1. Verify maestro CLI manually
```bash
# Try running the manifest generation command directly
maestro manifest generate \
  --role worker \
  --project-id proj_test \
  --task-ids task_test \
  --skills maestro-worker \
  --api-url http://localhost:3000 \
  --output /tmp/test-manifest.json

# Check if it worked
cat /tmp/test-manifest.json | jq .
```

### 2. Check server logs in detail
Look for these sections:
- `🚀 SESSION SPAWN EVENT RECEIVED` - Request received
- `📋 GENERATING MANIFEST VIA CLI` - Manifest generation starting
- `[STDOUT]` / `[STDERR]` - Output from maestro CLI
- `✅ MANIFEST GENERATED SUCCESSFULLY` or `❌ MANIFEST GENERATION FAILED`

### 3. Look at the manifest file directly
```bash
# After a spawn attempt, check if manifest was created
ls ~/.maestro/sessions/sess_*/manifest.json

# View the manifest content
cat ~/.maestro/sessions/sess_*/manifest.json | jq .
```

---

## What Changed (Consolidation Update)

The consolidation changes did NOT touch manifest generation. However, I did add:

✅ **Better error logging** - Will show stdout/stderr from maestro CLI
✅ **Manifest validation** - Checks for required fields (manifestVersion, role)
✅ **Better error messages** - Will indicate if maestro CLI is not found
✅ **Flexible structure handling** - Can handle both `.task` and `.tasks` formats

These changes help DEBUG the issue, not cause it.

---

## Next Steps

1. **Rebuild the server** (already done)
2. **Restart the server**: `npm run dev --workspace maestro-server`
3. **Try spawning a session**
4. **Check the console output for:**
   - Where the maestro CLI command fails
   - What Stderr/Stdout it produces
   - What the manifest structure looks like

5. **Share the detailed log output** so we can identify the exact issue

---

## Important: This is NOT a Spawn Consolidation Issue

The event consolidation changes work correctly. This is a pre-existing issue (or environment setup issue) with:
- maestro CLI availability
- maestro CLI functionality
- manifest generation

The consolidation changes only affect:
- ✅ Event merging (spawn_request + created → created)
- ✅ Env var persistence
- ✅ UI event handling
- ❌ NOT manifest generation

---

## Quick Checklist

- [ ] maestro CLI installed (`which maestro`)
- [ ] maestro CLI works (`maestro --version`)
- [ ] Server restarted after rebuild
- [ ] Attempted to spawn a session
- [ ] Checked server logs for manifest generation details
- [ ] Verified if manifest file was created
- [ ] Checked manifest content if created

---

Once you complete these steps, please share:
1. The output of `maestro --version`
2. The detailed server logs from the spawn attempt
3. Whether `/tmp/test-manifest.json` was created successfully
4. The content of any manifest files in `~/.maestro/sessions/`

This will help identify the exact cause of the manifest generation failure.
