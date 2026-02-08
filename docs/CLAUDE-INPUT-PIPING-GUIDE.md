# Piping Input to Claude Code - Complete Guide

## Overview

There are multiple ways to send input to Claude Code while it's running in Maestro sessions.

## Current Setup

The CLI spawns Claude with different stdio modes:
```typescript
stdio: options.interactive ? 'inherit' : 'pipe'
```

- **'inherit'** - Used by default (worker init, orchestrator init)
  - stdin/stdout/stderr connected to terminal
  - You can type directly to Claude
  - Cannot programmatically send input

- **'pipe'** - Used for non-interactive sessions
  - stdin/stdout/stderr are pipes
  - Can programmatically send input
  - Cannot type directly in terminal

---

## Option 1: Direct Terminal Input ✅ (Works Now!)

**When:** Running `maestro worker init` or `maestro orchestrator init`

**How:** Just type in the terminal while Claude is running

```bash
maestro worker init
# Claude starts and shows prompt...
# Type your response directly in the terminal
> Yes, proceed with the changes
```

**Pros:**
- Already works out of the box
- Simple and intuitive
- See Claude's responses in real-time

**Cons:**
- Manual typing only
- No programmatic control

---

## Option 2: Unix Pipe at Launch

**When:** Want to send initial input when starting

**How:** Pipe data to maestro command

```bash
# Pipe a single message
echo "Update the README with installation instructions" | maestro worker init

# Pipe from a file
cat instructions.txt | maestro worker init

# Pipe from another command
generate-prompt | maestro worker init
```

**Pros:**
- Simple Unix pipes
- Works with any command-line tool

**Cons:**
- Only sends initial input
- Cannot send additional input after Claude starts

---

## Option 3: Programmatic Input (NEW! ✨)

**When:** Want to send input programmatically after Claude starts

**Setup:** Use non-interactive mode or expose stdin

### A. Using Non-Interactive Mode

Modify the command to use pipe mode:

```typescript
// In worker-init.ts or orchestrator-init.ts
const spawnResult = await this.spawner.spawn(manifest, sessionId, {
  interactive: false,  // ✅ Changed from true
});

// Now you can send input programmatically
spawnResult.sendInput?.('Update the README file');
spawnResult.sendInput?.('Add installation instructions');

// Listen to output
spawnResult.process.stdout?.on('data', (data) => {
  console.log('Claude says:', data.toString());
});
```

### B. Create a Custom Spawn Mode

Add a new option for hybrid mode:

```typescript
// In claude-spawner.ts - Add new option
export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  interactive?: boolean;
  allowProgrammaticInput?: boolean;  // NEW!
}

// Update spawn method
async spawn(manifest, sessionId, options = {}) {
  // ...

  // Allow programmatic input while keeping stdout/stderr visible
  const stdio = options.allowProgrammaticInput
    ? ['pipe', 'inherit', 'inherit']  // stdin: pipe, stdout/stderr: inherit
    : options.interactive
    ? 'inherit'
    : 'pipe';

  const claudeProcess = spawn('claude', args, {
    cwd,
    env,
    stdio,
  });

  // ...
}
```

Usage:
```typescript
const spawnResult = await this.spawner.spawn(manifest, sessionId, {
  interactive: true,
  allowProgrammaticInput: true,  // Hybrid mode!
});

// You can see Claude's output in terminal AND send input programmatically
spawnResult.sendInput?.('Here is some data...');
```

---

## Option 4: Named Pipes (FIFO)

**When:** Want to send input from another terminal/process

**How:** Use Unix named pipes

```bash
# Terminal 1: Create named pipe and start Claude
mkfifo /tmp/claude-input
maestro worker init < /tmp/claude-input &

# Terminal 2: Send input
echo "Update the README" > /tmp/claude-input
echo "Add tests" > /tmp/claude-input

# Cleanup
rm /tmp/claude-input
```

**Pros:**
- Send input from multiple processes
- Flexible timing

**Cons:**
- Unix-only
- Requires manual pipe management

---

## Option 5: WebSocket/HTTP Bridge

**When:** Want to control Claude from another application

**How:** Create a bridge service

```typescript
// Create a bridge service
import express from 'express';
import { ClaudeSpawner } from './services/claude-spawner';

const app = express();
app.use(express.json());

let currentSession: SpawnResult | null = null;

// Start Claude session
app.post('/start', async (req, res) => {
  const spawner = new ClaudeSpawner();
  currentSession = await spawner.spawn(manifest, sessionId, {
    interactive: false,
  });

  // Stream output
  currentSession.process.stdout?.on('data', (data) => {
    // Send to WebSocket clients
    wss.broadcast(data.toString());
  });

  res.json({ sessionId: currentSession.sessionId });
});

// Send input to Claude
app.post('/input', (req, res) => {
  if (currentSession?.sendInput) {
    currentSession.sendInput(req.body.message);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'No active session' });
  }
});

app.listen(3001);
```

---

## Comparison Table

| Method | Difficulty | Real-time Output | Multiple Inputs | Programmatic | Use Case |
|--------|-----------|------------------|-----------------|--------------|----------|
| Terminal Input | Easy | ✅ | ✅ | ❌ | Manual sessions |
| Unix Pipe | Easy | ✅ | ❌ | ✅ | Initial prompt |
| Programmatic | Medium | ⚠️ | ✅ | ✅ | Automation |
| Named Pipe | Medium | ✅ | ✅ | ✅ | Multi-process |
| HTTP Bridge | Hard | ✅ | ✅ | ✅ | Remote control |

---

## Recommended Approach

### For Manual Use
Use **Option 1** (Terminal Input) - already works!

### For Automation
Use **Option 3** (Programmatic Input) with hybrid mode:
```typescript
const spawnResult = await spawner.spawn(manifest, sessionId, {
  interactive: true,
  allowProgrammaticInput: true,
});

// See output in terminal AND send input programmatically
spawnResult.sendInput?.('Do task X');
```

### For Multi-Process Control
Use **Option 4** (Named Pipes) for simple cases or **Option 5** (HTTP Bridge) for complex orchestration.

---

## Example: Automated Session with Checkpoints

```typescript
// worker-init.ts
const spawnResult = await this.spawner.spawn(manifest, sessionId, {
  interactive: false,
});

// Send initial instruction
spawnResult.sendInput?.('Start working on the task');

// Listen for output and send follow-ups
let output = '';
spawnResult.process.stdout?.on('data', (data) => {
  output += data.toString();
  console.log(data.toString());

  // Auto-respond to certain prompts
  if (output.includes('Should I proceed?')) {
    spawnResult.sendInput?.('Yes, proceed');
    output = '';
  }

  if (output.includes('Tests passed')) {
    spawnResult.sendInput?.('Great! Now update the docs');
    output = '';
  }
});
```

---

## Status

✅ Terminal input works (Option 1)
✅ Unix pipe works (Option 2)
✅ `sendInput()` helper added (Option 3)
⏳ Hybrid mode (Option 3B) - needs implementation
⏳ HTTP bridge (Option 5) - needs implementation

---

## Next Steps

1. Test current terminal input
2. Try Unix pipes for simple automation
3. Implement hybrid mode if you need programmatic control + visible output
4. Build HTTP bridge for complex orchestration scenarios
