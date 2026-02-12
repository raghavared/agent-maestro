# Project Tab Blinking Icon - Complete Logic Analysis

## Overview
The blinking icon system is a sophisticated multi-component system that tracks active agent work across terminal sessions and displays visual indicators in the project tabs.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Tauri Backend (Rust)                       │
│  Manages terminal sessions (PTY), process lifecycle, I/O        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
          (pty-data event)      (pty-exit event)
                    │                     │
                    ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Frontend React + Zustand Stores                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ useSessionStore (Zustand Store)                            │ │
│  │ - Maintains session state (sessions[])                     │ │
│  │ - Tracks: agentWorking, effectId, exited, closing         │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ Key Functions:                                             │ │
│  │ - onCommandChange() - Detects process effect (claude/codex)│ │
│  │ - markAgentWorkingFromOutput() - Marks agent as working   │ │
│  │ - onCwdChange() - Resets effect when cwd changes          │ │
│  │ - onClose() - Sets closing = true                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ App.tsx - Aggregation & Computation                         │ │
│  │ Calculates: workingAgentCountByProject (Map)               │ │
│  │ Passes to: ProjectTabBar component                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ProjectTabBar.tsx - UI Rendering                            │ │
│  │ Displays: blinking indicator if workingCount > 0            │ │
│  │ CSS Animation: terminalPulse (opacity: 1 → 0.5 → 1)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Component 1: Session State Properties

### TerminalSession Type (maestro-ui/src/app/types/session.ts)

Each session has these relevant properties:

| Property | Type | Set By | Purpose |
|----------|------|--------|---------|
| `id` | string | Backend | Unique session identifier |
| `projectId` | string | Backend | Which project owns this session |
| `effectId` | string \| null | onCommandChange() | Which agent/tool is running (claude/codex/gemini/null) |
| `agentWorking` | boolean | markAgentWorkingFromOutput() | Whether agent is actively producing output |
| `exited` | boolean | Backend (pty-exit event) | Whether the session process has exited |
| `closing` | boolean | onClose() | Whether user clicked close (intermediate state) |
| `exitCode` | number \| null | Backend or applyPendingExit() | Process exit code (0 = success) |
| `cwd` | string \| null | Backend | Current working directory |
| `launchCommand` | string \| null | User | Command to run on session creation |
| `persistent` | boolean | User | Whether session survives app restart |
| `maestroSessionId` | string \| null | Maestro System | Links to Maestro task system |

## Component 2: Process Effects System

### processEffects.ts

```typescript
export type ProcessEffect = {
  id: string;        // "claude", "codex", "gemini"
  label: string;     // "Claude Code", "Codex", "Gemini"
  matchCommands: string[];  // ["claude"], ["codex"], ["gemini"]
  idleAfterMs?: number;     // How long before marking not-working (default 2000ms)
  iconSrc?: string;  // Icon to display
};

const PROCESS_EFFECTS = [
  { id: "claude", label: "claude", matchCommands: ["claude"], idleAfterMs: 2000, ... },
  { id: "codex", label: "codex", matchCommands: ["codex"], idleAfterMs: 2000, ... },
  { id: "gemini", label: "gemini", matchCommands: ["gemini"], idleAfterMs: 2000, ... },
];
```

**How it works:**
- When a command is typed in a session (e.g., `claude`), `detectProcessEffect()` extracts the first word
- Compares against `matchCommands` in PROCESS_EFFECTS
- Returns matching effect or null
- Effect ID is stored in session.effectId

## Component 3: Setting effectId - onCommandChange()

### Location: maestro-ui/src/stores/useSessionStore.ts:476

```typescript
onCommandChange: (id, commandLine, source = 'input') => {
  const trimmed = commandLine.trim();

  // Handle OSC (Open Session Command) changes
  if (source === 'osc') {
    const effect = detectProcessEffect({ command: trimmed, name: null });
    const nextEffectId = effect?.id ?? null;
    // Update session with new effectId
    set((s) => ({
      sessions: s.sessions.map((s2) =>
        s2.id === id ? {
          ...s2,
          effectId: nextEffectId,      // ✓ Set effectId
          agentWorking: false,          // Reset to false when command changes
          restoreCommand: nextRestoreCommand,
          processTag: null,
        } : s2,
      ),
    }));
  }
}
```

**Flow:**
1. User types command: `claude --help`
2. onCommandChange() is triggered with `commandLine = "claude --help"`
3. `detectProcessEffect()` extracts "claude" and finds matching effect
4. `effectId` is set to "claude"
5. `agentWorking` is reset to `false`

**Important:** effectId is cleared when:
- User changes the command
- User changes the working directory (cwd)
- Session exits

## Component 4: Setting agentWorking - markAgentWorkingFromOutput()

### Location: maestro-ui/src/stores/useSessionStore.ts:408

```typescript
markAgentWorkingFromOutput: (id, data) => {
  const { sessions, activeId } = get();
  const session = sessions.find((s) => s.id === id);

  // Guard clauses - only mark working if:
  if (!session) return;
  if (!session.effectId) return;           // ✓ Must have effectId set
  if (session.exited) return;              // ✓ Must NOT be exited
  if (session.closing) return;             // ✓ Must NOT be closing
  if (!data) return;                       // No output data

  // Don't mark as working if just a resize
  const lastResize = lastResizeAtRef.get(id);
  if (Date.now() - lastResize < RESIZE_OUTPUT_SUPPRESS_MS) return;

  // Check if output is meaningful (not just whitespace/ANSI codes)
  if (!hasMeaningfulOutput(data)) return;

  // Don't wake non-active persistent sessions
  if (session.persistent && !session.agentWorking && activeId !== id) return;

  // ✓ MARK AS WORKING
  if (!session.agentWorking) {
    set((s) => ({
      sessions: s.sessions.map((s2) =>
        s2.id === id ? { ...s2, agentWorking: true } : s2,  // ✓ Set to true
      ),
    }));
  }

  // Schedule auto-idle timer
  const effect = getProcessEffectById(session.effectId);
  const idleAfterMs = effect?.idleAfterMs ?? 2000;  // Default 2 seconds
  const timeout = window.setTimeout(() => {
    set((s) => ({
      sessions: s.sessions.map((s2) =>
        s2.id === id ? { ...s2, agentWorking: false } : s2,  // Reset after idle time
      ),
    }));
  }, idleAfterMs);
  agentIdleTimersRef.set(id, timeout);
}
```

**Flow:**
1. Backend sends `pty-data` event with terminal output
2. Frontend's data handler calls `markAgentWorkingFromOutput(sessionId, outputData)`
3. Guard clauses verify:
   - Session has effectId (agent type detected)
   - Session hasn't exited
   - Session isn't closing
   - Output has meaningful content (checked via `hasMeaningfulOutput()`)
4. If all checks pass: Set `agentWorking = true`
5. Start idle timer that will set `agentWorking = false` after 2 seconds of silence

**Key Point:** The idle timer resets every time new output arrives, so as long as the agent is producing output, it stays "working".

## Component 5: Meaningful Output Detection

### Location: maestro-ui/src/services/terminalService.ts:62

```typescript
hasMeaningfulOutput = (data: string): boolean => {
  let visibleNonWhitespace = 0;
  let hasAlphaNum = false;

  for (const ch of data) {
    if (ch === "\u001b") {  // ANSI escape sequence
      // Skip escape sequences (colors, cursor moves, etc.)
      continue;
    }
    if (ch < " " || ch === "\u007f") {  // Control characters
      continue;
    }
    if (ch.trim() === "") {  // Whitespace
      continue;
    }

    // Count visible characters
    visibleNonWhitespace += 1;
    if (visibleNonWhitespace >= 2) return true;  // Found enough non-whitespace
    if (/[0-9A-Za-z]/.test(ch)) hasAlphaNum = true;  // Check for alphanumeric
  }
  return hasAlphaNum;  // Return true if found at least one alphanumeric char
};
```

**Purpose:** Filters out:
- ANSI color codes and control sequences
- Whitespace-only output
- Terminal control signals
- Only returns true for actual visible text output

## Component 6: Setting exited - Backend Exit Event

### Location 1: maestro-ui/src/stores/initApp.ts:150

When Tauri backend's PTY exits, it sends `pty-exit` event:

```typescript
const unlistenExit = await listen<{ id: string; exit_code: number | null }>('pty-exit', ({ payload: { id, exit_code } }) => {
  const { sessions } = sessionStore;
  const exitingSession = sessions.find((sess) => sess.id === id);

  sessionStore.setSessions((prev) => {
    let found = false;
    const next = prev.map((sess) => {
      if (sess.id !== id) return sess;
      found = true;
      return {
        ...sess,
        exited: true,              // ✓ Set exited = true
        exitCode: exit_code ?? null, // Store exit code
        agentWorking: false,        // Force stop working
        recordingActive: false,     // Stop recording
      };
    });
    if (!found) {
      // If session not in store yet, save exit code for later
      pendingExitCodes.set(id, exit_code ?? null);
    }
    return next;
  });

  // Notify Maestro server if this is a Maestro session
  if (exitingSession?.maestroSessionId) {
    maestroClient.updateSession(exitingSession.maestroSessionId, {
      status: 'stopped',
      completedAt: Date.now(),
    });
  }
});
```

**What triggers pty-exit:**
- User closes terminal session
- Process exits naturally
- Error/crash occurs

### Location 2: maestro-ui/src/stores/useSessionStore.ts:373

`applyPendingExit()` function for sessions created before exit event arrives:

```typescript
applyPendingExit: (session) => {
  const pending = pendingExitCodes.get(session.id);
  if (pending === undefined) return session;
  pendingExitCodes.delete(session.id);
  return {
    ...session,
    exited: true,         // ✓ Set exited = true
    exitCode: pending,    // Apply stored exit code
    agentWorking: false,  // Reset agentWorking
    recordingActive: false,
  };
}
```

**Why two paths:** Sessions can be created before or after exit events, so this handles both cases.

## Component 7: Setting closing - User Close Action

### Location: maestro-ui/src/stores/useSessionStore.ts:549

```typescript
onClose: async (id) => {
  // ... update maestro server ...

  setSessions((prev) =>
    prev.map((s) => (s.id === id ? { ...s, closing: true } : s)),  // ✓ Set closing = true
  );

  // Set 30-second timeout for cleanup
  if (!closingSessions.has(id)) {
    const timeout = window.setTimeout(() => {
      closingSessions.delete(id);
      pendingDataRef?.current.delete(id);
    }, 30_000);
    closingSessions.set(id, timeout);
  }

  // Actually close the session via backend
  try {
    await closeSession(id);  // Backend call to kill PTY
  } catch (err) {
    // If close fails, revert closing flag
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, closing: false } : s)),
    );
  }

  // Remove from sessions array when close completes
  setSessions((prev) => prev.filter((s) => s.id !== id));
}
```

**States during closing:**
1. User clicks close → `closing: true`, `agentWorking: false` (via guard clause in markAgentWorkingFromOutput)
2. Backend PTY closes → `exited: true` (via pty-exit event)
3. Session removed from array after 30-second timeout

## Component 8: Aggregation - App.tsx

### Location: maestro-ui/src/App.tsx:171

```typescript
const workingAgentCountByProject = useMemo(() => {
  const counts = new Map<string, number>();

  for (const s of sessions) {
    // Only count sessions that are ACTUALLY WORKING
    // All four conditions must be true:
    if (!s.effectId) continue;           // ✓ Agent type must be detected
    if (s.exited) continue;              // ✓ Must NOT have exited
    if (s.closing) continue;             // ✓ Must NOT be closing
    if (!s.agentWorking) continue;       // ✓ Must be actively working

    // Count this session in its project
    counts.set(s.projectId, (counts.get(s.projectId) ?? 0) + 1);
  }
  return counts;
}, [sessions]);
```

**This is the critical filter that determines visibility of the blinking icon.**

### All Four Conditions Must Be True:

| Property | Must Be | Why |
|----------|---------|-----|
| `effectId` | NOT null | Agent/tool must be identified (claude/codex/gemini) |
| `exited` | false | Session must still be running |
| `closing` | false | User must not have closed it |
| `agentWorking` | true | Agent must be actively producing output |

## Component 9: UI Rendering - ProjectTabBar.tsx

### Location: maestro-ui/src/components/ProjectTabBar.tsx:413

```tsx
const workingCount = workingAgentCountByProject.get(p.id) ?? 0;

{workingCount > 0 && (
  <span className="projectTabWorking">
    <span className="projectTabWorkingDot" />
    {workingCount}
  </span>
)}
```

**Conditional rendering:**
- Only displays if `workingCount > 0`
- Shows blinking cyan dot
- Shows number of working agents in project

## Component 10: CSS Animation

### Location: maestro-ui/src/styles.css

```css
.projectTabWorkingDot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #00ffff;
  box-shadow: 0 0 6px #00ffff;
  animation: terminalPulse 1s ease-in-out infinite;
}

@keyframes terminalPulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 6px #00ffff;  /* Bright glow */
  }
  50% {
    opacity: 0.5;
    box-shadow: 0 0 2px #00ffff;  /* Dim glow */
  }
}
```

**Visual Effect:**
- Dot pulsates continuously
- 1-second cycle (fade in/out)
- Glow effect also pulses

## Complete Data Flow Diagram

```
User types "claude" in terminal
         ↓
onCommandChange() triggered
         ↓
detectProcessEffect() → finds "claude" effect
         ↓
session.effectId = "claude"
session.agentWorking = false
         ↓
Claude agent starts executing command
         ↓
Backend sends pty-data event (output from agent)
         ↓
markAgentWorkingFromOutput() called with output data
         ↓
hasMeaningfulOutput() validates: is real text, not just ANSI codes?
         ↓
All guards pass:
  - effectId ✓ (is "claude")
  - exited ✓ (is false)
  - closing ✓ (is false)
         ↓
session.agentWorking = true
Idle timer started (2 second countdown)
         ↓
App.memoized computation:
  - Filters sessions: all 4 conditions met?
  - Increments workingAgentCountByProject["projectId"]
         ↓
ProjectTabBar receives new workingAgentCountByProject map
         ↓
workingCount > 0 → render blinking indicator
         ↓
CSS terminalPulse animation makes dot pulse
         ↓
[User sees blinking cyan dot on project tab] ✨

---

Agent produces more output
         ↓
Idle timer resets (back to 2-second countdown)
         ↓
[Blinking continues] ✨ ✨ ✨

---

2 seconds of no output
         ↓
Idle timer fires
         ↓
session.agentWorking = false
         ↓
workingAgentCountByProject recalculates
         ↓
workingCount = 0 → hide indicator
         ↓
[Blinking stops] ⭕
```

## Summary Table: All Required Properties

| Property | Initial | Set By | When Changed | Critical For Blinking |
|----------|---------|--------|--------------|----------------------|
| `effectId` | null | onCommandChange() | User types agent command | ✅ YES |
| `agentWorking` | false | markAgentWorkingFromOutput() | Output detected or idle timeout | ✅ YES |
| `exited` | false | pty-exit event | Session process terminates | ✅ YES |
| `closing` | false | onClose() | User clicks close | ✅ YES |
| `exitCode` | null | pty-exit event | Session process terminates | ❌ No |
| `cwd` | (initial) | onCwdChange() | User changes directory | ❌ No (but triggers effectId reset) |
| `launchCommand` | (user input) | Session creation | Created once | ❌ No |
| `persistent` | (user choice) | Session creation | Created once | ❌ No |
| `maestroSessionId` | null | Maestro system | Task assignment | ❌ No |

## Edge Cases & Behavior

### 1. Persistent Session Not Active
```typescript
if (session.persistent && !session.agentWorking && activeId !== id) return;
```
Won't mark persistent sessions as working unless they're the active session or already working.

### 2. Rapid Output Suppression
- If terminal resizes within 900ms, output is ignored
- Prevents false positives from resize events

### 3. ANSI Code Filtering
- Escape sequences (colors, cursor moves) are stripped
- Only real visible text counts as "meaningful"
- Prevents blinking from simple formatting output

### 4. Idle Timeout Configuration
```typescript
const idleAfterMs = effect?.idleAfterMs ?? 2000;  // Per effect, default 2 seconds
```
- Can be customized per process effect
- Currently all effects use 2000ms
- Resets with every output event

### 5. Maestro Integration
When agent is working:
- Session's maestroSessionId is synced with Maestro task system
- On close: updates Maestro session status to 'stopped'
- On exit: marks as 'completed' (via SessionEnd hook)

## Files Involved in Complete System

1. **maestro-ui/src/stores/useSessionStore.ts** - Session state management
2. **maestro-ui/src/stores/initApp.ts** - Backend event listeners (pty-exit)
3. **maestro-ui/src/App.tsx** - Aggregation computation
4. **maestro-ui/src/components/ProjectTabBar.tsx** - UI rendering
5. **maestro-ui/src/processEffects.ts** - Agent effect detection
6. **maestro-ui/src/services/terminalService.ts** - Output validation
7. **maestro-ui/src/app/types/session.ts** - Type definitions
8. **maestro-ui/src/styles.css** - CSS animations
9. **maestro-ui/src-tauri/src/pty.rs** - Backend PTY management (Rust)
10. **maestro-ui/src-tauri/src/main.rs** - Tauri event emission
