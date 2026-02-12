# Project Tab Blinking Icon Analysis

## Overview
The blinking blue light on project tabs indicates that one or more sessions in that project have active working agents.

## Visual Appearance
- **Color**: Cyan/turquoise (#00ffff)
- **Shape**: 5px circular dot with glow effect
- **Animation**: Pulsing effect (opacity oscillates between 1 and 0.5)
- **Duration**: 1 second per pulse cycle
- **Location**: Inside the project tab, next to the project name

## Where It Appears

### Component Files
1. **maestro-ui/src/components/ProjectTabBar.tsx** (lines 413-418)
   - Displays the working indicator: `<span className="projectTabWorking">`
   - Shows the cyan dot: `<span className="projectTabWorkingDot" />`
   - Shows the count of working agents: `{workingCount}`

2. **maestro-ui/src/App.tsx** (lines 171-178)
   - Calculates `workingAgentCountByProject` map
   - This map is passed down to ProjectTabBar component

## When It Displays

The blinking icon appears when:
```typescript
// From App.tsx, lines 171-178
const workingAgentCountByProject = useMemo(() => {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    // Count a session as "working" if ALL of these are true:
    if (!s.effectId || s.exited || s.closing || !s.agentWorking) continue;
    counts.set(s.projectId, (counts.get(s.projectId) ?? 0) + 1);
  }
  return counts;
}, [sessions]);
```

### Conditions for Display
A session is counted as a "working" session (triggering the blinking icon) when:

1. **`s.effectId` exists**: The session must have an effect ID set
2. **`!s.exited`**: The session must NOT have exited
3. **`!s.closing`**: The session must NOT be in the closing state
4. **`s.agentWorking`**: The agent/worker must be actively working

### Summary
The blinking icon shows the **count of actively working sessions** in a project. Each session that meets ALL the above criteria increments the counter for that project.

## Visual Implementation

### CSS Classes
```css
.projectTabWorking {
  /* Container styling */
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #00ffff;
  background: rgba(0, 255, 255, 0.1);
  border: 1px solid rgba(0, 255, 255, 0.3);
  padding: 2px 6px;
}

.projectTabWorkingDot {
  /* The blinking dot */
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
    box-shadow: 0 0 6px #00ffff;
  }
  50% {
    opacity: 0.5;
    box-shadow: 0 0 2px #00ffff;
  }
}
```

### Animation Details
- **Name**: `terminalPulse`
- **Duration**: 1 second
- **Easing**: ease-in-out
- **Repetition**: infinite
- **Effect**: Dot fades to 50% opacity at midpoint, then fades back to full opacity
- **Glow Effect**: Box-shadow also reduces from 6px to 2px at the midpoint for enhanced visual effect

## Example Display
When a project has working sessions:
```
[ProjectName] ⬤ 3    ⌚
```
Where:
- `ProjectName` = project display name
- `⬤ 3` = the blinking indicator with working agent count
- `⌚` = total session count for the project

## Data Flow
1. **useSessionStore** maintains session state with `agentWorking` flag
2. **App.tsx** calculates `workingAgentCountByProject` based on active sessions
3. **ProjectTabBar.tsx** receives the map via `workingAgentCountByProject` prop
4. **Conditional rendering** displays the indicator only when `workingCount > 0`
5. **CSS animation** applies the blinking effect via `terminalPulse` keyframes
