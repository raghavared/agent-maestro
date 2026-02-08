# Subtask Persistence Implementation

## Overview

Currently, subtasks are stored client-side only and disappear on page refresh. This implementation adds full backend persistence with proper database schema and API endpoints.

**Goal:** Make subtasks persist to the database with full CRUD operations.

**Estimated Effort:** 4-6 hours

---

## Current State

**Problem:**
- Subtasks stored in memory on the frontend (`MaestroContext`)
- No database storage
- Lost on refresh
- No cross-client sync

**Impact:**
- Unreliable task decomposition
- Workers lose context
- No audit trail

---

## Architecture

### Database Schema

```typescript
// maestro-server/src/types.ts

export interface Subtask {
  id: string;
  taskId: string;           // Parent task ID
  title: string;
  description?: string;
  completed: boolean;
  order: number;            // For maintaining order
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[];
  subtasks?: Subtask[];    // Embedded or referenced
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}
```

**Option A: Embedded Subtasks** (simpler, used currently)
- Subtasks stored as array in Task object
- Easier to query and return
- Limited by document size (not a problem for <100 subtasks)

**Option B: Separate Subtasks Collection** (more scalable)
- Subtasks in separate collection/table
- Foreign key relationship
- Better for large numbers of subtasks

**Recommendation:** Use **Option A** (embedded) for Phase 1, refactor to Option B later if needed.

---

## Implementation

### Step 1: Update Database Model

**File:** `maestro-server/src/db.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';

class Database {
  tasks: Map<string, Task>;
  sessions: Map<string, Session>;

  constructor() {
    this.tasks = new Map();
    this.sessions = new Map();
  }

  // ... existing methods ...

  // Subtask operations
  addSubtask(taskId: string, subtaskData: Partial<Subtask>): Subtask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    const subtask: Subtask = {
      id: uuidv4(),
      taskId,
      title: subtaskData.title || '',
      description: subtaskData.description,
      completed: false,
      order: (task.subtasks?.length || 0),
      createdAt: new Date().toISOString()
    };

    if (!task.subtasks) {
      task.subtasks = [];
    }
    task.subtasks.push(subtask);
    task.updatedAt = new Date().toISOString();

    this.tasks.set(taskId, task);
    return subtask;
  }

  updateSubtask(taskId: string, subtaskId: string, updates: Partial<Subtask>): Subtask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    const subtaskIndex = task.subtasks?.findIndex(st => st.id === subtaskId);
    if (subtaskIndex === undefined || subtaskIndex === -1) {
      throw new Error('Subtask not found');
    }

    const subtask = task.subtasks![subtaskIndex];
    Object.assign(subtask, updates, {
      updatedAt: new Date().toISOString()
    });

    if (updates.completed && !subtask.completedAt) {
      subtask.completedAt = new Date().toISOString();
    }

    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);

    return subtask;
  }

  deleteSubtask(taskId: string, subtaskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    if (!task.subtasks) return;

    task.subtasks = task.subtasks.filter(st => st.id !== subtaskId);
    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);
  }
}

export const db = new Database();
```

---

### Step 2: Subtask API Endpoints

**File:** `maestro-server/src/api/subtasks.ts` (create new file)

```typescript
import express from 'express';
import { db } from '../db';
import { wss } from '../websocket';

const router = express.Router({ mergeParams: true }); // For nested routes

// POST /api/tasks/:taskId/subtasks
router.post('/', (req, res) => {
  const { taskId } = req.params;
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const subtask = db.addSubtask(taskId, { title, description });
    const task = db.tasks.get(taskId)!;

    // Broadcast update
    wss.broadcast({
      type: 'subtask:created',
      data: { taskId, subtask }
    });

    // Also broadcast task update (includes all subtasks)
    wss.broadcast({
      type: 'task:updated',
      data: task
    });

    res.status(201).json(subtask);
  } catch (err: any) {
    if (err.message === 'Task not found') {
      res.status(404).json({ error: 'Task not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// GET /api/tasks/:taskId/subtasks
router.get('/', (req, res) => {
  const { taskId } = req.params;

  const task = db.tasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task.subtasks || []);
});

// PATCH /api/tasks/:taskId/subtasks/:subtaskId
router.patch('/:subtaskId', (req, res) => {
  const { taskId, subtaskId } = req.params;
  const updates = req.body;

  try {
    const subtask = db.updateSubtask(taskId, subtaskId, updates);
    const task = db.tasks.get(taskId)!;

    // Broadcast update
    wss.broadcast({
      type: 'subtask:updated',
      data: { taskId, subtask }
    });

    wss.broadcast({
      type: 'task:updated',
      data: task
    });

    res.json(subtask);
  } catch (err: any) {
    if (err.message === 'Task not found' || err.message === 'Subtask not found') {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /api/tasks/:taskId/subtasks/:subtaskId
router.delete('/:subtaskId', (req, res) => {
  const { taskId, subtaskId } = req.params;

  try {
    db.deleteSubtask(taskId, subtaskId);
    const task = db.tasks.get(taskId)!;

    // Broadcast update
    wss.broadcast({
      type: 'subtask:deleted',
      data: { taskId, subtaskId }
    });

    wss.broadcast({
      type: 'task:updated',
      data: task
    });

    res.status(204).send();
  } catch (err: any) {
    if (err.message === 'Task not found') {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
```

---

### Step 3: Register Subtask Routes

**File:** `maestro-server/src/index.ts`

```typescript
import subtasksRouter from './api/subtasks';

// ... existing routes ...

// Nested subtask routes
app.use('/api/tasks/:taskId/subtasks', subtasksRouter);
```

---

### Step 4: Update CLI Commands

**File:** `maestro-cli/src/commands/subtask.ts`

Update to use the new API endpoints:

```typescript
export function registerSubtaskCommands(program: Command): void {
  const subtaskCommand = program.command('subtask').description('Manage task subtasks');

  // maestro subtask create <taskId> "<title>"
  subtaskCommand
    .command('create <taskId> <title>')
    .option('--desc <description>', 'Subtask description')
    .action(async (taskId, title, options) => {
      const globalOpts = program.opts();

      try {
        const subtask = await api.post(`/api/tasks/${taskId}/subtasks`, {
          title,
          description: options.desc
        });

        if (globalOpts.json) {
          outputJSON(subtask);
        } else {
          console.log(`✅ Subtask created: ${subtask.id}`);
          console.log(`   ${title}`);
        }
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  // maestro subtask list <taskId>
  subtaskCommand
    .command('list <taskId>')
    .action(async (taskId) => {
      const globalOpts = program.opts();

      try {
        const subtasks = await api.get(`/api/tasks/${taskId}/subtasks`);

        if (globalOpts.json) {
          outputJSON(subtasks);
        } else {
          if (subtasks.length === 0) {
            console.log('No subtasks found');
          } else {
            subtasks.forEach((st: any) => {
              const status = st.completed ? '✅' : '⬜';
              console.log(`${status} [${st.id}] ${st.title}`);
            });
          }
        }
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  // maestro subtask complete <taskId> <subtaskId>
  subtaskCommand
    .command('complete <taskId> <subtaskId>')
    .action(async (taskId, subtaskId) => {
      const globalOpts = program.opts();

      try {
        await api.patch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
          completed: true
        });

        if (globalOpts.json) {
          outputJSON({ success: true, subtaskId, completed: true });
        } else {
          console.log(`✅ Subtask ${subtaskId} marked as completed`);
        }
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  // maestro subtask delete <taskId> <subtaskId>
  subtaskCommand
    .command('delete <taskId> <subtaskId>')
    .action(async (taskId, subtaskId) => {
      const globalOpts = program.opts();

      try {
        await api.delete(`/api/tasks/${taskId}/subtasks/${subtaskId}`);

        if (globalOpts.json) {
          outputJSON({ success: true, subtaskId, deleted: true });
        } else {
          console.log(`🗑️  Subtask ${subtaskId} deleted`);
        }
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
```

---

### Step 5: Update Frontend (MaestroContext)

**File:** `src/contexts/MaestroContext.tsx`

Remove client-side subtask operations, use API calls instead:

```typescript
// Remove these methods (they're now server-side only):
// - createSubtask
// - completeSubtask

// Instead, update tasks when receiving WebSocket events
useEffect(() => {
  if (!wsClient) return;

  const handleMessage = (event: MessageEvent) => {
    const message = JSON.parse(event.data);

    switch (message.type) {
      case 'subtask:created':
      case 'subtask:updated':
      case 'subtask:deleted':
        // Refresh the parent task
        const { taskId } = message.data;
        fetchTask(taskId);
        break;

      // ... other cases ...
    }
  };

  wsClient.addEventListener('message', handleMessage);
  return () => wsClient.removeEventListener('message', handleMessage);
}, [wsClient]);
```

**Update MaestroClient:**

**File:** `src/utils/MaestroClient.ts`

```typescript
class MaestroClient {
  // ... existing methods ...

  async createSubtask(taskId: string, title: string, description?: string) {
    const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    if (!response.ok) throw new Error('Failed to create subtask');
    return response.json();
  }

  async updateSubtask(taskId: string, subtaskId: string, updates: any) {
    const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update subtask');
    return response.json();
  }

  async deleteSubtask(taskId: string, subtaskId: string) {
    const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete subtask');
  }
}
```

---

## Testing

### Manual Test Flow

```bash
# 1. Create a task
maestro task create "Implement dark mode" --json
# Returns: {"id": "t1", ...}

# 2. Add subtasks
maestro subtask create t1 "Create toggle component"
maestro subtask create t1 "Implement theme context"
maestro subtask create t1 "Add CSS variables"

# 3. List subtasks
maestro subtask list t1
# Output:
# ⬜ [st1] Create toggle component
# ⬜ [st2] Implement theme context
# ⬜ [st3] Add CSS variables

# 4. Complete a subtask
maestro subtask complete t1 st1

# 5. Verify persistence
# Refresh the UI - subtasks should still be there

# 6. Delete a subtask
maestro subtask delete t1 st3
```

### Automated Tests

**File:** `maestro-server/tests/subtasks.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/db';

describe('Subtasks API', () => {
  let taskId: string;

  beforeEach(async () => {
    // Create a test task
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test Task', projectId: 'p1' });
    taskId = response.body.id;
  });

  it('should create a subtask', async () => {
    const response = await request(app)
      .post(`/api/tasks/${taskId}/subtasks`)
      .send({ title: 'Test Subtask' });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Test Subtask');
    expect(response.body.completed).toBe(false);
  });

  it('should list subtasks', async () => {
    await request(app)
      .post(`/api/tasks/${taskId}/subtasks`)
      .send({ title: 'Subtask 1' });
    await request(app)
      .post(`/api/tasks/${taskId}/subtasks`)
      .send({ title: 'Subtask 2' });

    const response = await request(app).get(`/api/tasks/${taskId}/subtasks`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it('should complete a subtask', async () => {
    const createRes = await request(app)
      .post(`/api/tasks/${taskId}/subtasks`)
      .send({ title: 'Test Subtask' });
    const subtaskId = createRes.body.id;

    const response = await request(app)
      .patch(`/api/tasks/${taskId}/subtasks/${subtaskId}`)
      .send({ completed: true });

    expect(response.status).toBe(200);
    expect(response.body.completed).toBe(true);
    expect(response.body.completedAt).toBeDefined();
  });

  it('should delete a subtask', async () => {
    const createRes = await request(app)
      .post(`/api/tasks/${taskId}/subtasks`)
      .send({ title: 'Test Subtask' });
    const subtaskId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/tasks/${taskId}/subtasks/${subtaskId}`);

    expect(deleteRes.status).toBe(204);

    const listRes = await request(app).get(`/api/tasks/${taskId}/subtasks`);
    expect(listRes.body).toHaveLength(0);
  });
});
```

---

## Migration

If you have existing tasks with client-side subtasks, they'll be lost unless migrated.

**Migration Script:** `maestro-server/scripts/migrate-subtasks.ts`

```typescript
// This would read from old format and save to new format
// Not necessary if starting fresh

import { db } from '../src/db';

// Example: If subtasks were stored differently before
for (const [id, task] of db.tasks.entries()) {
  if (!task.subtasks) {
    task.subtasks = [];
  }
  // Ensure all subtasks have required fields
  task.subtasks = task.subtasks.map((st, index) => ({
    id: st.id || `st-${index}`,
    taskId: id,
    title: st.title,
    completed: st.completed || false,
    order: index,
    createdAt: st.createdAt || task.createdAt
  }));
  db.tasks.set(id, task);
}

console.log('✅ Migration complete');
```

---

## Checklist

- [ ] Update database model to include `Subtask` type
- [ ] Implement `addSubtask`, `updateSubtask`, `deleteSubtask` in db.ts
- [ ] Create subtask API endpoints (`POST`, `GET`, `PATCH`, `DELETE`)
- [ ] Register subtask routes in server
- [ ] Update CLI subtask commands to use new API
- [ ] Update frontend MaestroContext to use API instead of local state
- [ ] Add WebSocket events for subtask updates
- [ ] Write tests for subtask CRUD operations
- [ ] Test cross-client sync (create subtask in CLI, see in UI)
- [ ] Verify persistence (refresh browser, subtasks remain)

---

## Next Steps

After implementing subtask persistence:

1. ✅ Subtasks persist across sessions and clients
2. ➡️ Improve WebSocket reliability (see [05-WEBSOCKET-RELIABILITY.md](./05-WEBSOCKET-RELIABILITY.md))
3. ➡️ Add comprehensive testing (see [06-TESTING-STRATEGY.md](./06-TESTING-STRATEGY.md))

---

**Implementation Status:** 📋 Ready to Implement
**Dependencies:** None (can be done in parallel)
**Enables:** Reliable task decomposition, Cross-client subtask sync
