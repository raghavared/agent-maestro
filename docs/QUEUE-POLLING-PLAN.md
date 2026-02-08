# Queue Polling Strategy — Keep Claude Alive While Waiting for Tasks

## Problem Statement

When a queue strategy worker session processes all tasks in its queue, Claude Code stops. The current flow is:

```
queue top → queue start → [work] → queue complete → queue top → "Queue is empty" → STOP
```

The `maestro queue start` command (`maestro-cli/src/commands/queue.ts:77-91`) prints "Queue is empty — no more tasks to process" and returns immediately. Claude sees this, interprets the work as done, and exits. **There is no mechanism to keep the session alive and polling for new tasks that may be added later.**

This is a problem because the orchestrator or a user may push new tasks into the queue after the initial batch is processed. The worker session should stay alive and automatically pick up new work.

---

## Proposed Solution: Make `queue start` Block When Queue is Empty

Instead of creating a new command, **modify `maestro queue start` to block and poll** when no items are available. This is the simplest approach because:

1. Claude already calls `queue start` in its normal loop — **zero prompt changes needed**
2. No new commands, no new permissions, no new workflow to teach Claude
3. The existing `queue top → queue start → work → complete → repeat` cycle just works

### How It Works

```
Current behavior:
  queue start → queue empty → print message → EXIT → Claude stops

New behavior:
  queue start → queue empty → poll every 10s → task arrives → claim it → EXIT with task info → Claude works
```

When `queue start` finds no queued items:
1. Instead of returning immediately, it enters a **blocking poll loop**
2. Every N seconds (default 10), it calls `GET /api/sessions/:id/queue/top`
3. When a task appears → it automatically claims it (same as normal `start`) and exits with the task info
4. Claude receives the output and proceeds to work on the task
5. If a timeout is reached → exits with a "timed out" message → Claude finishes the session

Claude Code executes bash commands and reads their stdout. A blocking command will cause Claude to **wait** for the command to finish. When it finally prints output and exits, Claude receives that output and continues.

---

## Implementation Plan

### 1. Modify `maestro queue start` to Block and Poll

**File:** `maestro-cli/src/commands/queue.ts`

Change the `queue start` action handler. Currently when the queue is empty it returns immediately (lines 77-91). Instead, enter a polling loop.

**Updated behavior:**

```typescript
queue.command('start')
  .description('Start processing the next task in the queue (waits if empty)')
  .option('--poll-interval <seconds>', 'Seconds between polls when queue is empty', '10')
  .option('--poll-timeout <minutes>', 'Max minutes to wait for new tasks (0=forever)', '30')
  .action(async (cmdOpts) => {
    await guardCommand('queue:start');
    const globalOpts = program.opts();
    const isJson = globalOpts.json;
    const sessionId = getSessionId();
    const pollInterval = parseInt(cmdOpts.pollInterval) * 1000;  // default 10s
    const pollTimeout = parseInt(cmdOpts.pollTimeout) * 60 * 1000; // default 30min
    const startTime = Date.now();

    const spinner = !isJson ? ora('Starting next task...').start() : null;

    try {
      // First attempt — try to start immediately (existing behavior)
      const result: any = await api.post(`/api/sessions/${sessionId}/queue/start`, {});

      if (result.item) {
        // Task claimed successfully — normal path, no change from current behavior
        spinner?.succeed('Task started');
        if (isJson) {
          outputJSON(result);
        } else {
          console.log('');
          console.log(`  Now Processing: ${result.item.taskId}`);
          console.log(`  Started At:     ${new Date(result.item.startedAt).toLocaleString()}`);
          console.log('');
          console.log('  When done, run:');
          console.log('    maestro queue complete  - Mark as completed');
          console.log('    maestro queue fail      - Mark as failed');
          console.log('    maestro queue skip      - Skip this task');
          console.log('');
        }
        return;
      }

      // Queue is empty — enter polling mode
      spinner?.text = 'Queue empty. Waiting for new tasks...';

      if (!isJson) {
        console.log('');
        console.log(`  Queue is empty. Polling every ${cmdOpts.pollInterval}s for new tasks...`);
      }

      while (true) {
        // Check timeout
        if (pollTimeout > 0 && (Date.now() - startTime) > pollTimeout) {
          spinner?.fail('Timed out waiting for new tasks');
          if (isJson) {
            outputJSON({ success: false, timedOut: true, message: 'No new tasks after timeout' });
          } else {
            console.log('');
            console.log(`  No new tasks after ${cmdOpts.pollTimeout} minutes.`);
            console.log('  Run "maestro report complete" to finish this session.');
            console.log('');
          }
          process.exit(1);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        // Poll for new items
        try {
          const topResult: any = await api.get(`/api/sessions/${sessionId}/queue/top`);

          if (topResult.hasMore) {
            // New task available — claim it
            const startResult: any = await api.post(`/api/sessions/${sessionId}/queue/start`, {});

            if (startResult.item) {
              spinner?.succeed('New task started');
              if (isJson) {
                outputJSON(startResult);
              } else {
                console.log('');
                console.log(`  Now Processing: ${startResult.item.taskId}`);
                console.log(`  Started At:     ${new Date(startResult.item.startedAt).toLocaleString()}`);
                console.log('');
                console.log('  When done, run:');
                console.log('    maestro queue complete  - Mark as completed');
                console.log('    maestro queue fail      - Mark as failed');
                console.log('    maestro queue skip      - Skip this task');
                console.log('');
              }
              return;
            }
          }
        } catch (pollErr: any) {
          // Network error during poll — log and continue, don't crash
          if (!isJson) {
            spinner?.text = `Poll failed (${pollErr.message}). Retrying...`;
          }
        }
      }
    } catch (err) {
      spinner?.stop();
      handleError(err, isJson);
    }
  });
```

**Key design decisions:**
- `--poll-interval` defaults to `10` seconds — frequent enough to be responsive, light enough to not overload the server
- `--poll-timeout` defaults to `30` minutes — reasonable ceiling; `0` means wait forever
- On network failure during polling, log and retry (don't crash)
- The spinner keeps updating so Claude sees the command is still running
- `process.exit(1)` on timeout tells Claude something went wrong → triggers session completion

---

### 2. Server-Side: Handle Empty Queue Gracefully in `startItem`

**File:** `maestro-server/src/application/services/QueueService.ts`

Currently `startItem()` throws a `ValidationError` when no items are queued (line 102). The CLI catches this error and shows the "queue is empty" message.

We need the server to return a structured "empty" response instead of an error, so the CLI can distinguish "empty queue" from actual errors:

**Option A (Minimal — CLI-side only):** Keep the server throwing the error. The CLI's first `api.post('/queue/start')` call catches the error and enters poll mode. Subsequent polls use `GET /queue/top` (which already returns `{ hasMore: false }` cleanly).

**Option B (Cleaner — server change):** Modify the `POST /queue/start` route to return a success response with `{ item: null, empty: true }` instead of a 400 error when the queue has no items.

**Recommended: Option B** — Change the route handler in `queueRoutes.ts`:

```typescript
// Start processing next item
router.post('/sessions/:id/queue/start', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    await verifyQueueStrategy(sessionId);

    // Check if there's a next item before attempting start
    const topItem = await queueService.getTopItem(sessionId);
    if (!topItem) {
      return res.json({
        success: true,
        item: null,
        empty: true,
        message: 'Queue is empty — no items to process'
      });
    }

    const item = await queueService.startItem(sessionId);
    res.json({
      success: true,
      item,
      message: `Started processing task ${item.taskId}`
    });
  } catch (err: any) {
    handleError(err, res);
  }
});
```

This ensures the CLI gets a clean `{ item: null }` response rather than an error, making the poll-loop logic simpler.

---

### 3. Server-Side: Add Queue Push Endpoint

**File:** `maestro-server/src/application/services/QueueService.ts`
**File:** `maestro-server/src/api/queueRoutes.ts`

Currently the queue is initialized once via `initializeQueue()` and there is **no way to add items to an existing queue**. For the polling to be useful, the orchestrator needs a way to push new tasks into a running worker's queue.

**Add `pushItem()` to QueueService:**

```typescript
async pushItem(sessionId: string, taskId: string): Promise<QueueItem> {
  const queue = await this.getQueue(sessionId);

  // Verify task exists
  const task = await this.taskRepo.findById(taskId);
  if (!task) throw new NotFoundError('Task', taskId);

  // Check for duplicates
  if (queue.items.some(i => i.taskId === taskId)) {
    throw new ValidationError(`Task ${taskId} already in queue`);
  }

  const newItem: QueueItem = {
    taskId,
    status: 'queued',
    addedAt: Date.now(),
  };

  await this.queueRepo.pushItem(sessionId, newItem);
  await this.eventBus.emit('queue:item_pushed', { sessionId, taskId });

  return newItem;
}
```

**Add route:**

```typescript
router.post('/sessions/:id/queue/push', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const { taskId } = req.body;
    await verifyQueueStrategy(sessionId);
    const item = await queueService.pushItem(sessionId, taskId);
    res.json({ success: true, item });
  } catch (err: any) {
    handleError(err, res);
  }
});
```

**Add CLI command** `maestro queue push <taskId>` for orchestrator use:

```typescript
queue.command('push')
  .description('Add a task to the queue (orchestrator use)')
  .argument('<taskId>', 'Task ID to add to the queue')
  .action(async (taskId) => {
    await guardCommand('queue:push');
    const sessionId = getSessionId();
    const result = await api.post(`/api/sessions/${sessionId}/queue/push`, { taskId });
    console.log(`  Added task ${taskId} to queue.`);
  });
```

---

### 4. Add `queue:push` to Command Permissions

**File:** `maestro-cli/src/services/command-permissions.ts`

Add `'queue:push'` to the list of allowed commands for the `queue` strategy.

(No need to add a `queue:watch` permission since we're modifying the existing `queue start` command.)

---

### 5. Prompt Template — No Changes Needed

**File:** `maestro-cli/templates/worker-queue-prompt.md`

The existing prompt already tells Claude to:

```markdown
1. Get next task: `maestro queue top`
2. Start the task: `maestro queue start`
3. Implement the task
4. Complete or fail: `maestro queue complete` / `maestro queue fail`
5. Repeat from step 1 until the queue is empty
```

Since `queue start` now blocks when empty instead of returning, **this workflow continues to work with zero changes**. Claude calls `queue start`, it blocks, and when a task appears Claude gets the output and proceeds.

The only minor update worth considering: changing step 6 from "until the queue is empty" to "continuously" — but this is optional since the blocking behavior makes it moot.

---

## Architecture Diagram

```
┌───────────────────────────────────────────────────────────────┐
│  Claude Code Worker Session                                   │
│                                                               │
│  Normal Flow (queue has items):                               │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌───────────────┐  │
│  │queue top  │─▶│queue     │─▶│ Work   │─▶│queue complete  │  │
│  │          │  │start     │  │        │  │or fail         │  │
│  └──────────┘  └──────────┘  └────────┘  └───────┬───────┘  │
│       ▲                                          │           │
│       └──────────────────────────────────────────┘           │
│                                                               │
│  When queue is empty (NEW — queue start blocks):              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ maestro queue start                                   │    │
│  │                                                       │    │
│  │  "Queue empty. Polling every 10s..."                  │    │
│  │                                                       │    │
│  │  ┌─────┐  ┌───────┐  ┌─────┐  ┌───────┐             │    │
│  │  │poll │─▶│empty? │─▶│sleep│─▶│poll   │─▶ ...       │    │
│  │  └─────┘  └───┬───┘  └─────┘  └───────┘             │    │
│  │               │ task found!                           │    │
│  │               ▼                                       │    │
│  │  ┌──────────────────────┐                             │    │
│  │  │ Auto-claim task      │                             │    │
│  │  │ Print task info      │                             │    │
│  │  │ EXIT(0)              │                             │    │
│  │  └──────────────────────┘                             │    │
│  │               OR                                      │    │
│  │  ┌──────────────────────┐                             │    │
│  │  │ Timeout reached      │                             │    │
│  │  │ EXIT(1)              │──▶ Claude: report complete  │    │
│  │  └──────────────────────┘                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  Claude sees task info → continues to work → queue complete   │
│  → calls queue start again → cycle continues                  │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  Orchestrator / External (can push tasks at any time)         │
│                                                               │
│  maestro queue push <taskId>                                  │
│  POST /api/sessions/:id/queue/push  { taskId: "xyz" }        │
│  → Adds new task to worker's queue                            │
│  → Worker's blocking `queue start` detects it on next poll    │
└───────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

| # | File | Change | Priority |
|---|------|--------|----------|
| 1 | `maestro-cli/src/commands/queue.ts` | Modify `queue start` to block & poll when empty | **P0** |
| 2 | `maestro-server/src/api/queueRoutes.ts` | Return `{ item: null }` instead of error when queue empty | **P0** |
| 3 | `maestro-server/src/application/services/QueueService.ts` | Add `pushItem()` method | **P1** |
| 4 | `maestro-server/src/api/queueRoutes.ts` | Add `POST .../queue/push` route | **P1** |
| 5 | `maestro-cli/src/commands/queue.ts` | Add `queue push` CLI command | **P1** |
| 6 | `maestro-cli/src/services/command-permissions.ts` | Add `queue:push` permission | **P1** |

**P0** = Core: makes `queue start` block and poll (Claude stays alive)
**P1** = Dynamic task injection (orchestrator can push tasks into running queue)

**No changes needed:**
- `worker-queue-prompt.md` — existing workflow works as-is
- `command-permissions.ts` for `queue:start` — already permitted

---

## Edge Cases & Considerations

1. **Graceful shutdown:** The polling loop must handle `SIGINT`/`SIGTERM` cleanly so Claude Code can kill the process if the user cancels the session.

2. **Network failures during polling:** If a poll request fails, log the error and continue polling (don't crash). Consider exponential backoff on repeated failures to avoid hammering a down server.

3. **Session already completed server-side:** If the session status is `completed` on the server, the poll should detect this and exit rather than polling forever. Add an optional check: `GET /api/sessions/:id` → if status is `completed`, exit.

4. **Race condition on claim:** Between `GET /queue/top` returning a task and `POST /queue/start` claiming it, another worker could claim it (in multi-worker scenarios). The `startItem()` service handles this with proper state checks, so the CLI should retry on failure.

5. **Claude context window:** The blocking command uses minimal context — Claude is just waiting for stdout. No wasted tokens while polling.

6. **Default timeout (30 min):** Reasonable for most workflows. The orchestrator typically pushes new tasks within minutes. `--poll-timeout 0` allows indefinite waiting for long-running orchestration.

7. **Backwards compatibility:** Adding `--poll-interval` and `--poll-timeout` as optional flags with sensible defaults means existing `maestro queue start` calls (with no flags) automatically get the new blocking behavior. If this is undesirable, we could add a `--wait` flag that must be explicitly passed — but the blocking-by-default approach is better for the Claude worker use case since it's always what we want.
