# Maestro UI Event Sound Mapping Analysis

## Executive Summary

This document analyzes all events received by the maestro-ui and proposes a sound playback system for different event types. The UI currently has 89 piano MP3 files available in `/music/piano-mp3/` that can be utilized for event notifications.

## Event Categories

### 1. WebSocket Events (Real-time Server Events)

These events are received via WebSocket from the maestro-server and handled in `src/hooks/useMaestroWebSocket.ts`:

| Event Type | Description | Suggested Sound Category |
|------------|-------------|-------------------------|
| `task:created` | New task created | **Creation** - Gentle ascending tone |
| `task:updated` | Task modified | **Update** - Soft notification |
| `task:deleted` | Task removed | **Deletion** - Descending tone |
| `session:created` | New session spawned | **Creation** - Gentle ascending tone |
| `session:updated` | Session state changed | **Update** - Soft notification |
| `session:deleted` | Session terminated | **Deletion** - Descending tone |
| `session:task_added` | Task linked to session | **Link** - Quick chord |
| `session:task_removed` | Task unlinked from session | **Unlink** - Quick reverse chord |
| `task:session_added` | Session linked to task | **Link** - Quick chord |
| `task:session_removed` | Session unlinked from task | **Unlink** - Quick reverse chord |
| `subtask:created` | Subtask created | **Creation** - Gentle ascending tone (lighter) |
| `subtask:updated` | Subtask modified | **Update** - Soft notification (lighter) |
| `subtask:deleted` | Subtask removed | **Deletion** - Descending tone (lighter) |

### 2. Timeline Events (Session Activity Events)

These events are displayed in the session timeline and defined in `src/app/types/maestro.ts` and visualized in `src/components/maestro/TimelineEvent.tsx`:

| Event Type | Symbol | Description | Suggested Sound Category |
|------------|--------|-------------|-------------------------|
| `session_started` | ● | Session spawned | **Success** - Bright, uplifting tone |
| `session_stopped` | ⊘ | Session stopped | **Neutral** - Calm closing tone |
| `task_started` | ▶ | Started working on a task | **Action** - Short, energetic note |
| `task_completed` | ✓ | Task finished successfully | **Success** - Bright, uplifting tone |
| `task_failed` | ✗ | Task failed | **Error** - Low, warning tone |
| `task_skipped` | ⊘ | Task skipped | **Neutral** - Quick dismissal |
| `task_blocked` | ⚠ | Task blocked | **Warning** - Alert tone |
| `needs_input` | ⚠ | Waiting for user input | **Attention** - Repetitive gentle ping |
| `progress` | ⚡ | Progress update | **Progress** - Ascending quick notes |
| `error` | ⨯ | Error occurred | **Error** - Low, warning tone |
| `milestone` | ★ | Milestone reached | **Achievement** - Triumphant chord |
| `doc_added` | 📄 | Document added | **Creation** - Gentle ascending tone |

### 3. UI Notification Events

These events are handled by `src/hooks/useNotifications.ts`:

| Event Type | Description | Suggested Sound Category |
|------------|-------------|-------------------------|
| Error notification | User-facing error message | **Error** - Low, warning tone |
| Notice notification | User-facing notice/success message | **Success** - Gentle positive tone |
| Unexpected error | Uncaught errors | **Critical Error** - Urgent alert |
| Unhandled promise rejection | Promise errors | **Critical Error** - Urgent alert |

### 4. Session Status Changes

Session status changes from `src/app/types/maestro.ts`:

| Status | Description | Suggested Sound Category |
|--------|-------------|-------------------------|
| `spawning` | Session is being created | **Loading** - Quick rising note |
| `idle` | Session is idle | **Neutral** - Soft, calm note |
| `working` | Session is actively working | **Action** - Energetic note |
| `completed` | Session completed successfully | **Success** - Bright, uplifting tone |
| `failed` | Session failed | **Error** - Low, warning tone |
| `stopped` | Session was stopped | **Neutral** - Calm closing tone |

### 5. Task Status Changes

Task status changes from `src/app/types/maestro.ts`:

| Status | Description | Suggested Sound Category |
|--------|-------------|-------------------------|
| `todo` | Task is pending | **Neutral** - Soft note |
| `in_progress` | Task is being worked on | **Action** - Energetic note |
| `completed` | Task completed successfully | **Success** - Bright, uplifting tone |
| `cancelled` | Task was cancelled | **Neutral** - Dismissal tone |
| `blocked` | Task is blocked | **Warning** - Alert tone |

## Proposed Sound Categories & Piano Note Mappings

Using the available piano MP3 files in `/music/piano-mp3/`, here's the proposed mapping:

### 1. **Success** (Bright, uplifting)
- Notes: `C5` → `E5` → `G5` (Major chord)
- Events: `task_completed`, `session_started`, `completed` status, notice notifications

### 2. **Error** (Low, warning)
- Notes: `C2` → `Eb2` → `Gb2` (Diminished chord)
- Events: `task_failed`, `error`, `failed` status, error notifications

### 3. **Critical Error** (Urgent alert)
- Notes: `C2` → `C2` → `C2` (Repeated low C)
- Events: Unexpected errors, unhandled rejections

### 4. **Warning** (Alert tone)
- Notes: `F3` → `F3` (Repeated mid-tone)
- Events: `task_blocked`, `blocked` status

### 5. **Attention** (Gentle ping)
- Notes: `A4` (Single clear note, can repeat)
- Events: `needs_input`

### 6. **Action** (Energetic, short)
- Notes: `G4` (Quick single note)
- Events: `task_started`, `working` status

### 7. **Creation** (Ascending)
- Notes: `C4` → `E4` (Quick ascending dyad)
- Events: `task:created`, `session:created`, `doc_added`, `subtask:created`

### 8. **Deletion** (Descending)
- Notes: `E4` → `C4` (Quick descending dyad)
- Events: `task:deleted`, `session:deleted`, `subtask:deleted`

### 9. **Update** (Soft notification)
- Notes: `D4` (Single soft note)
- Events: `task:updated`, `session:updated`, `subtask:updated`

### 10. **Progress** (Quick ascending sequence)
- Notes: `C4` → `D4` → `E4` (Quick ascending run)
- Events: `progress`

### 11. **Achievement** (Triumphant)
- Notes: `C5` → `E5` → `G5` → `C6` (Major chord + octave)
- Events: `milestone`

### 12. **Neutral** (Calm)
- Notes: `A3` (Single neutral tone)
- Events: `session_stopped`, `stopped` status, `task_skipped`, `cancelled` status

### 13. **Link** (Quick chord)
- Notes: `C4` + `G4` (Simultaneous perfect fifth)
- Events: `session:task_added`, `task:session_added`

### 14. **Unlink** (Quick reverse chord)
- Notes: `G4` → `C4` (Descending perfect fifth)
- Events: `session:task_removed`, `task:session_removed`

### 15. **Loading** (Rising)
- Notes: `C4` → `G4` (Quick ascending fifth)
- Events: `spawning` status, `idle` status, `todo` status

## Implementation Recommendations

### 1. Sound Manager Service

Create a centralized sound manager at `maestro-ui/src/services/soundManager.ts`:

```typescript
class SoundManager {
  private sounds: Map<string, HTMLAudioElement[]>;
  private enabled: boolean;
  private volume: number;

  playEventSound(eventType: string): void;
  playNotes(notes: string[], delay?: number): void;
  setEnabled(enabled: boolean): void;
  setVolume(volume: number): void;
}
```

### 2. Hook Integration

Create a `useSoundEffects` hook to integrate with existing event hooks:
- `useMaestroWebSocket` - for WebSocket events
- `useNotifications` - for notification events
- Timeline event rendering - for timeline events

### 3. User Preferences

Add UI settings for:
- Enable/disable sound effects
- Volume control
- Per-category sound preferences (e.g., mute only errors)
- Quiet mode (reduce all sounds)

### 4. Performance Considerations

- Preload frequently used sounds
- Implement sound pooling for rapid events
- Debounce similar events to avoid sound spam
- Maximum concurrent sounds limit

### 5. Accessibility

- Provide option to disable all sounds
- Visual alternatives for all sound cues
- Screen reader compatibility

## Event Frequency Analysis

Based on typical usage patterns:

**High Frequency** (need short, non-intrusive sounds):
- `progress` - Very frequent during active work
- `task:updated` - Frequent during task management
- `session:updated` - Frequent during session activity

**Medium Frequency** (can be more noticeable):
- `task_started` - Multiple times per session
- `task_completed` - Multiple times per session
- `task:created` - Several times during planning

**Low Frequency** (can be more prominent):
- `milestone` - Rare, deserves attention
- `session_started` - Once per session spawn
- `error` - Hopefully rare, needs attention

**Critical** (must be noticeable):
- `needs_input` - User action required
- `task_failed` - Important failure signal
- Critical errors - System issues

## Next Steps

1. **Phase 1**: Implement basic sound manager service
2. **Phase 2**: Add sound playback to high-priority events (errors, completion, needs_input)
3. **Phase 3**: Integrate with all timeline events
4. **Phase 4**: Add user preferences UI
5. **Phase 5**: Polish and accessibility improvements

## Available Piano Notes

The `/music/piano-mp3/` directory contains 89 piano notes covering multiple octaves:
- Notes: A, Ab, B, Bb, C, D, Db, E, Eb, F, G, Gb
- Octaves: 0-7
- Format: MP3
- Example files: `A0.mp3`, `C4.mp3`, `G7.mp3`

This provides full flexibility for creating rich sound feedback across all event types.
