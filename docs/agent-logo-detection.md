# Agent Logo Detection System

## Overview

The Maestro UI automatically displays agent logos (Claude, Gemini, Codex) in the Sessions section when users run these commands in the terminal. This document explains how this automatic detection and display mechanism works.

## Architecture

The system consists of three main components:

### 1. Process Effects Configuration (`processEffects.ts`)

This module defines the mapping between command names and their visual representations.

**Key Elements:**

- **Icon Paths**: Static paths to agent logos stored in `/agent-icons/`
  - Claude: `claude-code-icon.png`
  - Codex: `openai-codex-icon.png`
  - Gemini: `gemini-logo.png`

- **ProcessEffect Type**: Each agent configuration includes:
  ```typescript
  {
    id: string;           // Unique identifier (e.g., "claude")
    label: string;        // Display label (e.g., "claude")
    matchCommands: string[]; // Commands to match (e.g., ["claude"])
    idleAfterMs?: number; // Idle timeout (2000ms)
    iconSrc?: string;     // Path to icon image
  }
  ```

- **PROCESS_EFFECTS Array**: Defines all supported agents:
  ```typescript
  [
    { id: "codex", label: "codex", matchCommands: ["codex"], ... },
    { id: "claude", label: "claude", matchCommands: ["claude"], ... },
    { id: "gemini", label: "gemini", matchCommands: ["gemini"], ... }
  ]
  ```

**Key Functions:**

1. **`normalizeCommandToken(token: string)`**
   - Extracts the base command name from a path
   - Removes file extensions (.exe)
   - Converts to lowercase
   - Example: `"C:\Path\Claude.exe"` → `"claude"`

2. **`firstToken(commandLine: string)`**
   - Extracts the first word from a command line
   - Applies normalization
   - Example: `"claude --help"` → `"claude"`

3. **`detectProcessEffect(input)`**
   - Main detection function
   - Takes command line or process name
   - Returns matching ProcessEffect or null
   - Matches against the `matchCommands` array

4. **`getProcessEffectById(id: string)`**
   - Retrieves a ProcessEffect by its ID
   - Used by SessionsSection to get icon information

### 2. Session State Management (`useSessionStore.ts`)

When a user types a command in the terminal:

1. The command line is captured
2. `detectProcessEffect({ command: trimmed, name: null })` is called
3. If a match is found, the effect ID is extracted: `effect?.id ?? null`
4. The session's `effectId` property is updated
5. An idle timer is cleared (for agent activity tracking)

**Example Flow:**
```
User types: "claude"
  ↓
detectProcessEffect({ command: "claude", name: null })
  ↓
Returns: { id: "claude", label: "claude", iconSrc: "/agent-icons/claude-code-icon.png", ... }
  ↓
Session updated with: effectId = "claude"
```

### 3. Visual Display (`SessionsSection.tsx`)

The SessionsSection component renders the agent logos using the stored `effectId`.

**Rendering Logic:**

```typescript
// Line 301: Get the effect configuration
const effect = getProcessEffectById(s.effectId);

// Line 302: Get the label
const chipLabel = effect?.label ?? s.processTag ?? null;

// Line 303: Check if icon exists
const hasAgentIcon = Boolean(effect?.iconSrc);

// Lines 356-363: Render the agent badge with icon
{hasAgentIcon && chipLabel && effect?.iconSrc && (
  <span className={`agentBadge chip-${effect.id}`} title={chipLabel}>
    <img className="agentIcon" src={effect.iconSrc} alt={chipLabel} />
    {isWorking && (
      <span className="chipActivity agentBadgeDot" aria-label="Working" />
    )}
  </span>
)}
```

**Visual Elements:**

- **Agent Badge**: A styled span with dynamic class `chip-{effect.id}`
- **Agent Icon**: An img element displaying the agent logo
- **Activity Indicator**: A pulsing dot shown when the agent is working
- **Tooltip**: Shows the agent label on hover

## Complete Flow Diagram

```
┌─────────────────────────────┐
│ User runs command in        │
│ terminal: "claude"          │
└───────────┬─────────────────┘
            │
            ▼
┌─────────────────────────────┐
│ useSessionStore captures    │
│ command via PTY events      │
└───────────┬─────────────────┘
            │
            ▼
┌─────────────────────────────┐
│ detectProcessEffect()       │
│ • Normalizes command        │
│ • Extracts first token      │
│ • Matches against           │
│   PROCESS_EFFECTS array     │
└───────────┬─────────────────┘
            │
            ▼
┌─────────────────────────────┐
│ Effect found?               │
├─────────────┬───────────────┤
│ Yes         │ No            │
│             │               │
│ ┌───────────▼─────────────┐ │
│ │ Session.effectId =      │ │
│ │ effect.id ("claude")    │ │
│ └───────────┬─────────────┘ │
│             │               │
│             ▼               │
│ ┌─────────────────────────┐ │
│ │ SessionsSection renders │ │
│ │ with agent logo:        │ │
│ │ • getProcessEffectById()│ │
│ │ • Displays icon image   │ │
│ │ • Shows activity dot    │ │
│ └─────────────────────────┘ │
│                             │
│ Session.effectId = null     │
│ (No logo displayed)         │
└─────────────────────────────┘
```

## Adding New Agents

To add support for a new agent:

1. **Add icon to `/public/agent-icons/`**
2. **Update `processEffects.ts`**:
   ```typescript
   const newAgentIcon = "/agent-icons/new-agent-icon.png";

   // Add to PROCESS_EFFECTS array
   {
     id: "newagent",
     label: "New Agent",
     matchCommands: ["newagent", "new-agent"],
     idleAfterMs: 2000,
     iconSrc: newAgentIcon
   }
   ```
3. **No changes needed in SessionsSection.tsx** - it automatically picks up the new configuration!

## Key Features

- **Automatic Detection**: No manual configuration needed per session
- **Path Agnostic**: Works with full paths, relative paths, and bare commands
- **Case Insensitive**: Handles commands in any case
- **Activity Tracking**: Shows when agent is actively working
- **Idle Timeout**: Clears working state after 2 seconds of inactivity
- **Extensible**: Easy to add new agents by updating PROCESS_EFFECTS array

## File References

- **Core Logic**: `maestro-ui/src/processEffects.ts` (58 lines)
- **Display Component**: `maestro-ui/src/components/SessionsSection.tsx` (lines 301-363)
- **State Management**: `maestro-ui/src/stores/useSessionStore.ts` (lines 492-495, 521-524)
- **Icons Directory**: `maestro-ui/public/agent-icons/`
