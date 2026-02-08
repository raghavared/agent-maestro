# Hard Refresh Feature

## What It Does

The **refresh button** in the Maestro Panel performs a "hard refresh":

1. **Clears ALL cache** - Removes all tasks and sessions from memory
2. **Refetches from scratch** - Gets fresh data from the Maestro server
3. **Ensures consistency** - Guarantees UI matches server state

## When to Use It

### ✅ Use the refresh button when:
- You see stale data (closed sessions still showing)
- Tasks aren't updating correctly
- You suspect cache is out of sync
- You want to test idempotency (data fetches correctly every time)
- After debugging/fixing server-side issues

### ⚠️ You shouldn't need it normally because:
- WebSocket updates should keep everything in sync
- Real-time updates handle most changes automatically

## How to Use It

1. Open Maestro Panel (right panel)
2. Look for the button bar near the top:
   ```
   [$ new task] [+ multi-task] [$ refresh]
   ```
3. Click **$ refresh**
4. Watch the console logs:
   ```
   [MaestroContext] 🗑️  Clearing all cache
   [MaestroContext] 🔄 Hard refresh - clearing cache and refetching
   [MaestroContext] Fetching tasks for project: proj_123
   [MaestroContext] ✓ Fetched 5 tasks
   [MaestroContext] ✓ Hard refresh complete
   ```

## What Happens Internally

```typescript
// When you click refresh:

1. hardRefresh(projectId) is called
      │
      ▼
2. clearCache() - Wipes all state
      │
      ▼
3. setState({
     tasks: new Map(),      // ← Empty
     sessions: new Map(),   // ← Empty
     loading: new Set(),
     errors: new Map()
   })
      │
      ▼
4. fetchTasks(projectId) - Fresh fetch from server
      │
      ▼
5. Server returns latest data
      │
      ▼
6. Cache rebuilt with fresh data
```

## Expected Behavior

### Before Refresh
```
Tasks in cache: 10
Sessions in cache: 3
Some may be stale ❌
```

### During Refresh
```
Loading state shown
Tasks list is empty briefly
Button is disabled
```

### After Refresh
```
Tasks in cache: 8 (fresh from server)
Sessions in cache: 0 (will be lazy loaded)
Everything is fresh ✅
```

## Testing Idempotency

The refresh button is perfect for testing if the system is **idempotent** (same result every time):

### Test Steps:
1. Note the current task list
2. Click refresh
3. Verify the same tasks appear
4. Click refresh again
5. Verify consistency

**Expected:**
- ✅ Same tasks appear each time
- ✅ No duplicates
- ✅ Correct counts
- ✅ All metadata matches server

**If you see issues:**
- ❌ Different tasks appear = Server state changing unexpectedly
- ❌ Duplicates = Cache logic bug
- ❌ Missing tasks = Fetch logic incomplete

## Debugging with Console Logs

When you click refresh, watch for these logs:

**Good (Expected):**
```
[MaestroContext] 🗑️  Clearing all cache
[MaestroContext] 🔄 Hard refresh - clearing cache and refetching
[MaestroContext] Fetching tasks for project: proj_abc
[MaestroContext] ✓ Fetched 5 tasks
[MaestroContext] ✓ Hard refresh complete
```

**Bad (Investigate):**
```
[MaestroContext] ✗ Failed to fetch tasks: Error...
[MaestroPanel] Hard refresh failed: TypeError...
```

## Keyboard Shortcut (Future)

Future enhancement: Add a keyboard shortcut like `Cmd+R` or `Ctrl+R` for quick refresh.

## Implementation Details

### Code Location
- **Context:** `src/contexts/MaestroContext.tsx`
  - `clearCache()` - Clears all state
  - `hardRefresh(projectId)` - Clears + refetches

- **UI:** `src/components/maestro/MaestroPanel.tsx`
  - Refresh button wired to `hardRefresh()`

### State Management
```typescript
// Before
state = {
  tasks: Map(10),        // ← Has stale data
  sessions: Map(3),      // ← Has stale data
  loading: Set(0),
  errors: Map(0)
}

// After clearCache()
state = {
  tasks: Map(0),         // ← Empty
  sessions: Map(0),      // ← Empty
  loading: Set(0),
  errors: Map(0)
}

// After hardRefresh() completes
state = {
  tasks: Map(8),         // ← Fresh from server
  sessions: Map(0),      // ← Will be lazy loaded
  loading: Set(0),
  errors: Map(0)
}
```

## Edge Cases

### 1. Refresh While Loading
**Behavior:** Button is disabled
**Why:** Prevents race conditions

### 2. Refresh with No Project
**Behavior:** Button is disabled
**Why:** Need a project ID to fetch tasks

### 3. Refresh During WebSocket Disconnect
**Behavior:** May fail with error
**Handling:** Error shown, can retry when reconnected

### 4. Refresh with Expanded Sessions
**Behavior:** Sessions collapse, need to re-expand
**Why:** Cache is cleared, expansion state is UI-only

## Future Improvements

1. **Preserve UI State**
   - Keep expanded sessions expanded
   - Remember scroll position
   - Maintain filter selections

2. **Partial Refresh**
   - Refresh only sessions
   - Refresh only tasks
   - Refresh specific items

3. **Auto-Refresh**
   - Refresh on reconnect
   - Refresh on window focus
   - Periodic refresh (optional)

4. **Visual Feedback**
   - Progress indicator
   - "Refreshing..." text
   - Smooth transition

---

## Summary

✅ **What:** Hard refresh clears cache and refetches all data
✅ **When:** Use when you see stale data or want to test consistency
✅ **How:** Click "$ refresh" button in Maestro Panel
✅ **Result:** Fresh data from server, guaranteed consistency

**This is a great debugging tool and ensures the system is idempotent!** 🎉
