# Blinking Icon - Quick Reference Guide

## The 4 Required Properties

For the blinking icon to appear, **ALL 4 of these must be true:**

```javascript
session.effectId !== null              // ✅ Agent detected (claude/codex/gemini)
session.agentWorking === true          // ✅ Agent producing output
session.exited === false               // ✅ Session still running
session.closing === false              // ✅ User hasn't closed it
```

## Where Each Property is Set

### 1. effectId - COMMAND DETECTION
**Set in:** `useSessionStore.ts::onCommandChange()` (line 476)

```javascript
// When user types: "claude --help"
const effect = detectProcessEffect({ command: "claude --help" });
// Extracts first word "claude", matches against PROCESS_EFFECTS
// Sets: session.effectId = "claude"
```

**Cleared when:**
- User types a different command
- User changes working directory
- Session exits

**Process Effects Defined:** `processEffects.ts`
- "claude" - Claude agent
- "codex" - OpenAI Codex
- "gemini" - Google Gemini

---

### 2. agentWorking - OUTPUT DETECTION
**Set in:** `useSessionStore.ts::markAgentWorkingFromOutput()` (line 408)

```javascript
// When backend sends output from running process
markAgentWorkingFromOutput(sessionId, outputData);

// Checks:
// ✓ Has effectId
// ✓ Not exited
// ✓ Not closing
// ✓ Output is meaningful (via hasMeaningfulOutput)

// Then: session.agentWorking = true
```

**How it stays true:**
- Idle timer: 2 seconds (configurable per effect)
- Timer resets with every new output
- If 2 seconds of silence: automatically becomes false

**Output Validation:** `terminalService.ts::hasMeaningfulOutput()`
- Filters out ANSI escape codes (colors, cursor moves)
- Filters out control characters
- Requires at least one alphanumeric character
- Prevents false positives from formatting-only output

---

### 3. exited - EXIT EVENT
**Set in:**
- `initApp.ts::pty-exit event listener` (line 150)
- `useSessionStore.ts::applyPendingExit()` (line 373)

```javascript
// When backend PTY process terminates
// (user closes, process crashes, etc.)
// Set: session.exited = true, session.agentWorking = false
```

**Triggered by:**
- User closes terminal
- Process exits naturally
- Process crashes/error

**Guard in markAgentWorkingFromOutput:**
```javascript
if (session.exited || session.closing) return;  // Don't mark working
```

---

### 4. closing - CLOSE INTENT
**Set in:** `useSessionStore.ts::onClose()` (line 549)

```javascript
// When user clicks close button
// 1. Set: session.closing = true
// 2. Call backend to kill PTY
// 3. Set 30-second timeout cleanup
// 4. Remove from sessions array
```

**States during close:**
1. User clicks close → `closing: true`
2. Backend kills PTY → `exited: true`
3. 30 seconds later → removed from array

**Guard in markAgentWorkingFromOutput:**
```javascript
if (session.closing) return;  // Don't mark working
```

---

## The Aggregation (App.tsx:171)

```javascript
const workingAgentCountByProject = useMemo(() => {
  const counts = new Map<string, number>();

  for (const s of sessions) {
    // COUNT ONLY IF ALL 4 ARE TRUE:
    if (!s.effectId || s.exited || s.closing || !s.agentWorking) continue;
    counts.set(s.projectId, (counts.get(s.projectId) ?? 0) + 1);
  }
  return counts;
}, [sessions]);
```

**Result:** `Map<projectId, workingSessionCount>`

---

## The UI (ProjectTabBar.tsx:413)

```jsx
const workingCount = workingAgentCountByProject.get(p.id) ?? 0;

{workingCount > 0 && (
  <span className="projectTabWorking">
    <span className="projectTabWorkingDot" />
    {workingCount}
  </span>
)}
```

**Display:** Shows cyan blinking dot + count if `workingCount > 0`

---

## The Animation (styles.css)

```css
.projectTabWorkingDot {
  animation: terminalPulse 1s ease-in-out infinite;
}

@keyframes terminalPulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px #00ffff; }   /* Bright */
  50% { opacity: 0.5; box-shadow: 0 0 2px #00ffff; }       /* Dim */
}
```

**Effect:** Continuous fade: Bright → Dim → Bright (1 second cycle)

---

## Example Timeline

```
Time 0:00 ✏️  User types: "claude"
             effectId = "claude"
             agentWorking = false

Time 0:01 📤 Claude process outputs: "Analyzing..."
             markAgentWorkingFromOutput() called
             All checks pass ✅
             agentWorking = true
             Idle timer = 2000ms
             🔵 BLINKING STARTS

Time 0:02 📤 Claude outputs: "Found X issues"
             markAgentWorkingFromOutput() called
             Idle timer RESETS to 2000ms
             🔵 STILL BLINKING

Time 0:04 ⏱️  2 seconds of no output
             Idle timer fires
             agentWorking = false
             🔵 BLINKING STOPS

Time 0:05 📤 Claude outputs: "Complete"
             agentWorking = true
             Idle timer = 2000ms
             🔵 BLINKING RESUMES

Time 0:07 🪟 Process exits (exit code 0)
             exited = true
             agentWorking = false
             🔵 BLINKING STOPS
```

---

## Edge Cases

### Persistent Session Not Active
Won't mark working unless it's the active session (prevents background sessions from affecting indicator).

### Resize Output Suppression
Output within 900ms of terminal resize is ignored (avoids false positives from terminal redraw).

### Maestro Integration
- When working: links to maestro task system
- On close: updates maestro status to 'stopped'
- On exit: marked as 'completed' by SessionEnd hook

---

## File Quick Links

| File | Purpose |
|------|---------|
| `useSessionStore.ts` | Session state, property setters |
| `initApp.ts` | Backend event listeners |
| `App.tsx` | Aggregation logic |
| `ProjectTabBar.tsx` | UI rendering |
| `processEffects.ts` | Agent detection rules |
| `terminalService.ts` | Output validation |
| `session.ts` | Type definitions |
| `styles.css` | Animation |
| `pty.rs` (Rust backend) | Terminal process management |
