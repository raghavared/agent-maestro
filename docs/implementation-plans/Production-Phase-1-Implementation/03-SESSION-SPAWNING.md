# Session Spawning Implementation

## Overview

Session spawning enables the Orchestrator to automatically create new terminal windows for Worker agents via the CLI. This is the core automation that makes multi-agent workflows possible.

**Goal:** Implement `maestro session spawn` command with WebSocket-based terminal automation in Tauri.

**Estimated Effort:** 8-10 hours

---

## Architecture

### Flow Diagram

```
┌──────────────────┐
│   Orchestrator   │
│   (Terminal 1)   │
└────────┬─────────┘
         │
         │ $ maestro session spawn --task t1
         │
         ▼
┌─────────────────────────────┐
│     Maestro CLI             │
│  POST /api/sessions/spawn   │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│    Maestro Server           │
│  1. Create session record   │
│  2. Broadcast WebSocket     │
│     event: session:spawn    │
└────────┬────────────────────┘
         │
         │ WebSocket
         │
         ▼
┌─────────────────────────────┐
│      Agents UI (Tauri)      │
│  1. Listen for spawn event  │
│  2. Extract task ID & skill │
│  3. Prepare env vars        │
│  4. Call spawn_session()    │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│    New Terminal Window      │
│  with environment:          │
│  - MAESTRO_TASK_IDS=t1      │
│  - MAESTRO_SESSION_ID=s2    │
│  - Skill: maestro-worker    │
└─────────────────────────────┘
```

---

## Implementation

### Step 1: CLI Command (`maestro session spawn`)

**File:** `maestro-cli/src/commands/session.ts`

Add the spawn command:

```typescript
import { validateRequired } from '../utils/validation.js';
import { handleError } from '../utils/errors.js';
import { api } from '../api.js';
import { config } from '../config.js';

export function registerSessionCommands(program: Command): void {
  const sessionCommand = program.command('session').description('Manage sessions');

  // ... existing commands (info, list) ...

  sessionCommand
    .command('spawn')
    .description('Spawn a new worker session for a task')
    .requiredOption('--task <id>', 'Task ID to assign to the new session')
    .option('--name <name>', 'Session name (defaults to "Worker for <taskId>")')
    .option('--skill <skill>', 'Skill to load (defaults to "maestro-worker")')
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const taskId = validateRequired(options.task, 'task');
        const sessionName = options.name || `Worker for ${taskId}`;
        const skill = options.skill || 'maestro-worker';

        // Validate that the task exists
        await api.get(`/api/tasks/${taskId}`);

        // Send spawn request to server
        const spawnRequest = {
          projectId: globalOpts.project || config.projectId,
          taskIds: [taskId],
          name: sessionName,
          skill: skill,
          spawnedBy: config.sessionId
        };

        const result = await api.post('/api/sessions/spawn', spawnRequest);

        if (globalOpts.json) {
          outputJSON(result);
        } else {
          console.log(`🚀 Spawning new session: ${sessionName}`);
          console.log(`   Task: ${taskId}`);
          console.log(`   Skill: ${skill}`);
          console.log(`   Session ID: ${result.sessionId}`);
          console.log('');
          console.log('   Waiting for Agents UI to open terminal window...');
        }
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
```

---

### Step 2: Server Endpoint (`POST /api/sessions/spawn`)

**File:** `maestro-server/src/api/sessions.ts`

Add the spawn endpoint:

```typescript
import { v4 as uuidv4 } from 'uuid';
import { Session } from '../types';
import { db } from '../db';
import { wss } from '../websocket';

// ... existing session endpoints ...

// POST /api/sessions/spawn
router.post('/spawn', (req, res) => {
  const { projectId, taskIds, name, skill, spawnedBy } = req.body;

  // Validation
  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ error: 'taskIds must be a non-empty array' });
  }
  if (!skill) {
    return res.status(400).json({ error: 'skill is required' });
  }

  // Create session record
  const sessionId = uuidv4();
  const session: Session = {
    id: sessionId,
    projectId,
    taskIds,
    name: name || `Session ${sessionId.slice(0, 8)}`,
    status: 'spawning', // New status to indicate pending spawn
    createdAt: new Date().toISOString(),
    metadata: {
      skill,
      spawnedBy: spawnedBy || null
    }
  };

  // Save to database
  db.sessions.set(sessionId, session);

  // Broadcast spawn request via WebSocket
  wss.broadcast({
    type: 'session:spawn_request',
    data: {
      sessionId,
      projectId,
      taskIds,
      name: session.name,
      skill
    }
  });

  console.log(`📤 Broadcast spawn request for session ${sessionId} (task: ${taskIds[0]}, skill: ${skill})`);

  res.status(201).json({
    success: true,
    sessionId,
    message: 'Spawn request sent to Agents UI'
  });
});

export default router;
```

---

### Step 3: WebSocket Broadcast Helper

**File:** `maestro-server/src/websocket.ts`

Ensure the WebSocket server can broadcast to all clients:

```typescript
import WebSocket, { WebSocketServer } from 'ws';

export const wss = new WebSocketServer({ noServer: true });

// Store connected clients
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('✅ WebSocket client connected. Total clients:', clients.size);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('❌ WebSocket client disconnected. Total clients:', clients.size);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    clients.delete(ws);
  });
});

// Broadcast helper
export function broadcast(message: any): void {
  const payload = JSON.stringify(message);
  let sent = 0;

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  });

  if (process.env.DEBUG) {
    console.log(`📡 Broadcast to ${sent} clients:`, message.type);
  }
}

// Export broadcast as part of wss for convenience
wss.broadcast = broadcast;

export default wss;
```

Update the type definition:

```typescript
// In maestro-server/src/types.ts
declare module 'ws' {
  interface WebSocketServer {
    broadcast(message: any): void;
  }
}
```

---

### Step 4: Tauri WebSocket Listener

**File:** `src-tauri/src/websocket.rs` (create or update)

Add a handler for the `session:spawn_request` event:

```rust
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpawnRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "taskIds")]
    pub task_ids: Vec<String>,
    pub name: String,
    pub skill: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    #[serde(rename = "session:spawn_request")]
    SessionSpawnRequest { data: SpawnRequest },

    #[serde(rename = "task:created")]
    TaskCreated { data: serde_json::Value },

    #[serde(rename = "task:updated")]
    TaskUpdated { data: serde_json::Value },

    // ... other event types ...
}

pub async fn handle_websocket_message(app: AppHandle, message: String) {
    match serde_json::from_str::<WebSocketMessage>(&message) {
        Ok(WebSocketMessage::SessionSpawnRequest { data }) => {
            println!("🚀 Received spawn request: {:?}", data);
            handle_spawn_request(app, data).await;
        }
        Ok(_other) => {
            // Handle other message types or forward to frontend
            app.emit_all("websocket-message", message).ok();
        }
        Err(e) => {
            eprintln!("Failed to parse WebSocket message: {}", e);
        }
    }
}

async fn handle_spawn_request(app: AppHandle, spawn: SpawnRequest) {
    use crate::pty::spawn_session;

    // Build environment variables
    let mut env_vars = std::collections::HashMap::new();
    env_vars.insert("MAESTRO_API_URL".to_string(), "http://localhost:3000".to_string());
    env_vars.insert("MAESTRO_PROJECT_ID".to_string(), spawn.project_id.clone());
    env_vars.insert("MAESTRO_SESSION_ID".to_string(), spawn.session_id.clone());
    env_vars.insert("MAESTRO_TASK_IDS".to_string(), spawn.task_ids.join(","));
    env_vars.insert("MAESTRO_SKILL".to_string(), spawn.skill.clone());

    // Spawn the session using existing PTY logic
    match spawn_session(&app, spawn.name.clone(), env_vars).await {
        Ok(_) => {
            println!("✅ Successfully spawned session: {}", spawn.name);

            // Notify server that spawn succeeded
            // (optional: could add a callback endpoint)
        }
        Err(e) => {
            eprintln!("❌ Failed to spawn session: {}", e);

            // Notify server that spawn failed
            // (optional: could update session status to 'failed')
        }
    }
}
```

---

### Step 5: Update PTY Module

**File:** `src-tauri/src/pty.rs`

Ensure `spawn_session` accepts environment variables:

```rust
use std::collections::HashMap;
use tauri::{AppHandle, Manager};

pub async fn spawn_session(
    app: &AppHandle,
    name: String,
    env_vars: HashMap<String, String>,
) -> Result<(), String> {
    // Get the main window
    let window = app.get_window("main").ok_or("Main window not found")?;

    // Emit event to frontend to create a new terminal tab
    window.emit("spawn-terminal", SpawnTerminalPayload {
        name,
        env_vars,
    }).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Clone, serde::Serialize)]
struct SpawnTerminalPayload {
    name: String,
    env_vars: HashMap<String, String>,
}
```

---

### Step 6: Frontend Terminal Spawning

**File:** `src/App.tsx`

Listen for the `spawn-terminal` event and create a new terminal:

```typescript
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

function App() {
  useEffect(() => {
    // Listen for spawn events from Tauri
    const unlisten = listen<{ name: string; env_vars: Record<string, string> }>(
      'spawn-terminal',
      (event) => {
        const { name, env_vars } = event.payload;
        console.log('🚀 Spawning terminal:', name, env_vars);

        // Create a new terminal session
        handleSpawnTerminal(name, env_vars);
      }
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleSpawnTerminal = (name: string, envVars: Record<string, string>) => {
    // Implementation depends on your terminal component
    // Example: Add to terminal tabs state

    // Option A: Using a terminal library (xterm.js)
    // addTerminalTab({ name, envVars });

    // Option B: Using Tauri shell commands
    // invoke('create_terminal_window', { name, envVars });
  };

  return (
    <div>
      {/* Your app UI */}
    </div>
  );
}
```

**Detailed Terminal Tab Implementation:**

If you're managing terminal tabs in the UI:

```typescript
// src/components/TerminalManager.tsx
import { useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { invoke } from '@tauri-apps/api/tauri';

interface TerminalTab {
  id: string;
  name: string;
  envVars: Record<string, string>;
  terminal: Terminal;
}

export function TerminalManager() {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const spawnTerminal = (name: string, envVars: Record<string, string>) => {
    const id = crypto.randomUUID();
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14
    });

    // Initialize PTY session with env vars
    invoke('create_pty_session', {
      sessionId: id,
      envVars
    }).then((ptyId) => {
      // Connect terminal to PTY
      terminal.onData((data) => {
        invoke('write_to_pty', { ptyId, data });
      });

      // Listen for PTY output
      listen(`pty-output-${ptyId}`, (event) => {
        terminal.write(event.payload as string);
      });
    });

    setTabs((prev) => [...prev, { id, name, envVars, terminal }]);
    setActiveTabId(id);
  };

  // Expose globally for spawn events
  useEffect(() => {
    (window as any).spawnTerminal = spawnTerminal;
  }, []);

  return (
    <div className="terminal-manager">
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={activeTabId === tab.id ? 'active' : ''}
          >
            {tab.name}
          </button>
        ))}
      </div>
      <div className="terminal-container">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
            ref={(el) => {
              if (el && activeTabId === tab.id) {
                terminal.open(el);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

### Step 7: Session Status Updates

When a terminal actually opens, update the session status from `spawning` to `active`:

**Frontend:**

```typescript
// After terminal successfully opens
await fetch(`http://localhost:3000/api/sessions/${sessionId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'active' })
});
```

**Backend:** (already exists in sessions.ts)

```typescript
// PATCH /api/sessions/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const session = db.sessions.get(id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  Object.assign(session, updates, { updatedAt: new Date().toISOString() });
  db.sessions.set(id, session);

  wss.broadcast({ type: 'session:updated', data: session });

  res.json(session);
});
```

---

### Step 8: Skill Loading in Spawned Session

When a terminal opens, it should automatically load the specified skill.

**Option A: Using Claude Code**

If terminals run Claude Code, add the skill to the session config:

```bash
# In the spawned terminal
$ claude --skill maestro-worker
```

**Option B: Inject Skill as System Prompt**

If not using Claude Code, read the skill file and inject it:

```typescript
// When creating PTY session
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const skillPath = join(homedir(), '.agents-ui', 'maestro-skills', envVars.MAESTRO_SKILL, 'skill.md');
const skillInstructions = readFileSync(skillPath, 'utf-8');

// Prepend skill to terminal session or pass to LLM
const systemPrompt = `
${skillInstructions}

---

You are now in a terminal session with the following context:
- Project ID: ${envVars.MAESTRO_PROJECT_ID}
- Session ID: ${envVars.MAESTRO_SESSION_ID}
- Task IDs: ${envVars.MAESTRO_TASK_IDS}

Begin by running: maestro whoami
`;
```

---

## Testing

### Manual Test Flow

1. **Start the stack:**
   ```bash
   # Terminal 1: Maestro Server
   cd maestro-server
   npm run dev

   # Terminal 2: Agents UI
   cd ..
   npm run dev
   ```

2. **Create a task:**
   ```bash
   maestro task create "Test spawning" --priority high
   # Returns: {"id": "t1", ...}
   ```

3. **Spawn a worker:**
   ```bash
   maestro session spawn --task t1 --skill maestro-worker
   ```

4. **Verify:**
   - New terminal window should open
   - Run `maestro whoami` in the new terminal
   - Should show: `Task IDs: t1`
   - Should have skill instructions available

### Automated Test

**File:** `maestro-server/tests/session-spawning.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { wss } from '../src/websocket';

describe('Session Spawning', () => {
  let broadcastSpy: any;

  beforeAll(() => {
    broadcastSpy = vi.spyOn(wss, 'broadcast');
  });

  afterAll(() => {
    broadcastSpy.mockRestore();
  });

  it('should create spawn request and broadcast event', async () => {
    const response = await request(app)
      .post('/api/sessions/spawn')
      .send({
        projectId: 'p1',
        taskIds: ['t1'],
        name: 'Test Worker',
        skill: 'maestro-worker'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.sessionId).toBeDefined();

    // Verify WebSocket broadcast was called
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'session:spawn_request',
        data: expect.objectContaining({
          taskIds: ['t1'],
          skill: 'maestro-worker'
        })
      })
    );
  });

  it('should reject spawn request without taskIds', async () => {
    const response = await request(app)
      .post('/api/sessions/spawn')
      .send({
        projectId: 'p1',
        skill: 'maestro-worker'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('taskIds must be a non-empty array');
  });
});
```

---

## Troubleshooting

### Issue: Terminal doesn't open

**Check:**
1. Is the Agents UI running?
2. Is the WebSocket connection established? (Check browser DevTools > Network > WS)
3. Are there any errors in the Tauri console?

**Debug:**
```bash
# Enable debug logging
MAESTRO_DEBUG=true maestro session spawn --task t1
```

### Issue: Environment variables not set

**Check:**
```bash
# In the spawned terminal
echo $MAESTRO_TASK_IDS
echo $MAESTRO_SESSION_ID
```

**Fix:**
Ensure `spawn_session()` in Tauri properly passes `env_vars` to the PTY.

### Issue: Skill not loaded

**Check:**
```bash
ls ~/.agents-ui/maestro-skills/maestro-worker/
```

**Fix:**
Run `npm run generate-skills` to create skill files.

---

## Checklist

- [ ] Implement `maestro session spawn` CLI command
- [ ] Add `POST /api/sessions/spawn` endpoint in server
- [ ] Add WebSocket broadcast for `session:spawn_request`
- [ ] Implement WebSocket listener in Tauri (Rust)
- [ ] Update `spawn_session()` to accept env vars
- [ ] Implement frontend terminal spawning logic
- [ ] Add session status updates (`spawning` -> `active`)
- [ ] Test end-to-end spawning flow
- [ ] Add error handling for spawn failures
- [ ] Document troubleshooting steps

---

## Next Steps

After implementing session spawning:

1. ✅ Orchestrators can delegate work to Workers
2. ➡️ Implement subtask persistence (see [04-SUBTASK-PERSISTENCE.md](./04-SUBTASK-PERSISTENCE.md))
3. ➡️ Improve WebSocket reliability (see [05-WEBSOCKET-RELIABILITY.md](./05-WEBSOCKET-RELIABILITY.md))

---

**Implementation Status:** 📋 Ready to Implement
**Dependencies:** Skill System (01), CLI Enhancements (02)
**Enables:** Multi-agent orchestration workflows
