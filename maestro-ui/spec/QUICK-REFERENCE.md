# Maestro UI - Quick Reference Guide

Quick reference for developers working with the Maestro UI codebase.

---

## Architecture at a Glance

```
┌─────────────┐
│  React UI   │ ← TypeScript, Zustand
└──────┬──────┘
       │
┌──────▼──────┐
│   Tauri     │ ← Rust, PTY
└──────┬──────┘
       │
┌──────▼──────┐
│ Maestro API │ ← REST + WebSocket
└──────┬──────┘
       │
┌──────▼──────┐
│ Maestro CLI │ ← Task execution
└─────────────┘
```

---

## Core Stores (Zustand)

| Store | Location | Purpose |
|-------|----------|---------|
| `useSessionStore` | `stores/useSessionStore.ts` | Terminal sessions |
| `useMaestroStore` | `stores/useMaestroStore.ts` | Tasks & Maestro sessions |
| `useProjectStore` | `stores/useProjectStore.ts` | Projects |
| `useWorkspaceStore` | `stores/useWorkspaceStore.ts` | Workspace layouts |
| `useUIStore` | `stores/useUIStore.ts` | UI state |

### Common Store Patterns

```typescript
// Read state
const sessions = useSessionStore(s => s.sessions);

// Call action
const createSession = useSessionStore(s => s.createSession);
await createSession({ name, command, cwd });

// Direct store access
useSessionStore.getState().setActiveId(id);
```

---

## Core Types

### Task Types

```typescript
type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';
type TaskPriority = 'low' | 'medium' | 'high';
type TaskSessionStatus = 'queued' | 'working' | 'needs_input' | 'blocked' | 'completed' | 'failed' | 'skipped';

interface MaestroTask {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  initialPrompt: string;
  status: TaskStatus;
  priority: TaskPriority;
  sessionStatus?: TaskSessionStatus;
  createdAt: number;
  updatedAt: number;
  sessionIds: string[];
  skillIds: string[];
  subtasks?: MaestroTask[];
}
```

### Session Types

```typescript
type MaestroSessionStatus = 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped';
type WorkerStrategy = 'simple' | 'queue';

interface MaestroSession {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  agentId?: string;
  status: MaestroSessionStatus;
  strategy?: WorkerStrategy;
  timeline: SessionTimelineEvent[];
  model?: ModelType;
}
```

---

## API Client Usage

```typescript
import { maestroClient } from '../utils/MaestroClient';

// Tasks
const tasks = await maestroClient.getTasks(projectId);
const task = await maestroClient.getTask(taskId);
const newTask = await maestroClient.createTask({ projectId, title, description, priority, initialPrompt });
await maestroClient.updateTask(taskId, { status: 'completed' });

// Sessions
const sessions = await maestroClient.getSessions();
const session = await maestroClient.getSession(sessionId);

// Spawn session (triggers WebSocket flow)
const response = await maestroClient.spawnSession({
  projectId,
  taskIds: [taskId],
  role: 'worker',
  strategy: 'simple',
  spawnSource: 'ui',
  skills: ['maestro-worker'],
  model: 'sonnet',
});

// Projects
const projects = await maestroClient.getProjects();
const project = await maestroClient.getProject(projectId);
```

---

## WebSocket Events

### Listening to Events

Events are handled automatically by `useMaestroStore`. The store updates its state when events arrive.

```typescript
// In useMaestroStore.ts
switch (message.event) {
  case 'task:created':
  case 'task:updated':
    // Store updates automatically
    set(prev => ({ tasks: new Map(prev.tasks).set(message.data.id, message.data) }));
    break;

  case 'session:spawn':
    // Spawns terminal automatically
    void useSessionStore.getState().handleSpawnTerminalSession({...});
    break;
}
```

### Available Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `task:created` | `MaestroTask` | New task |
| `task:updated` | `MaestroTask` | Task update |
| `task:deleted` | `{ id }` | Task deletion |
| `session:created` | `{ session, ... }` | New session |
| `session:updated` | `MaestroSession` | Session update |
| `session:spawn` | `{ session, command, cwd, envVars }` | Spawn request |

---

## Component Patterns

### Using Stores in Components

```typescript
function MyComponent() {
  // Read from store
  const tasks = useMaestroStore(s => Array.from(s.tasks.values()));
  const activeId = useSessionStore(s => s.activeId);

  // Get actions
  const createTask = useMaestroStore(s => s.createTask);
  const setActiveId = useSessionStore(s => s.setActiveId);

  // Use actions
  const handleCreate = async () => {
    await createTask({ projectId, title, description, priority });
  };

  return <div>...</div>;
}
```

### Using Context

```typescript
import { useMaestroContext } from '../contexts/MaestroContext';

function MyComponent() {
  const { state, fetchTasks, createTask } = useMaestroContext();

  useEffect(() => {
    void fetchTasks(projectId);
  }, [projectId]);

  const tasks = Array.from(state.tasks.values());

  return <div>...</div>;
}
```

---

## Terminal Operations

### Creating a Session

```typescript
import { useSessionStore } from '../stores/useSessionStore';

const createSession = useSessionStore(s => s.createSession);

await createSession({
  name: 'My Session',
  command: 'bash',
  cwd: '/project/path',
  persistent: true,
});
```

### Spawning Maestro Session

```typescript
import { maestroClient } from '../utils/MaestroClient';

// Call spawn endpoint
const response = await maestroClient.spawnSession({
  projectId: 'proj_123',
  taskIds: ['task_456'],
  role: 'worker',
  strategy: 'simple',
  spawnSource: 'ui',
  skills: ['maestro-worker'],
  model: 'sonnet',
});

// Terminal is spawned automatically via WebSocket
// No need to manually create terminal session
```

---

## Common Tasks

### Add a New Store

```typescript
// 1. Create store file: src/stores/useMyStore.ts
import { create } from 'zustand';

interface MyState {
  data: any[];
  fetchData: () => Promise<void>;
}

export const useMyStore = create<MyState>((set) => ({
  data: [],
  fetchData: async () => {
    const result = await fetch('/api/data').then(r => r.json());
    set({ data: result });
  },
}));

// 2. Add persistence in src/stores/persistence.ts
const unsubMy = useMyStore.subscribe(state => {
  localStorage.setItem('myData', JSON.stringify(state.data));
});

// 3. Initialize in src/stores/initApp.ts
const savedData = localStorage.getItem('myData');
if (savedData) {
  useMyStore.setState({ data: JSON.parse(savedData) });
}
```

### Add a New Component

```typescript
// 1. Create component: src/components/MyComponent.tsx
import React from 'react';

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div className="myComponent">
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
}

// 2. Add styles: src/styles.css
.myComponent {
  padding: 1rem;
  background: var(--bg-secondary);
}

// 3. Use component
import { MyComponent } from './components/MyComponent';

<MyComponent title="Hello" onAction={() => console.log('clicked')} />
```

### Add a New API Endpoint

```typescript
// 1. Add to MaestroClient.ts
async getMyData(id: string): Promise<MyData> {
  return this.fetch<MyData>(`/my-data/${id}`);
}

// 2. Add type to maestro.ts
export interface MyData {
  id: string;
  name: string;
  value: number;
}

// 3. Use in component
const data = await maestroClient.getMyData('123');
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Open command palette |
| `Cmd+T` / `Ctrl+Shift+T` | New terminal session |
| `Cmd+W` / `Ctrl+Shift+W` | Close session |
| `Cmd+1-5` / `Ctrl+1-5` | Send quick prompt |
| `Cmd+Shift+P` / `Ctrl+Shift+P` | Open prompts panel |
| `Cmd+Shift+R` / `Ctrl+Shift+R` | Open recordings panel |
| `Cmd+Shift+A` / `Ctrl+Shift+A` | Open assets panel |
| `Cmd+S` / `Ctrl+S` | Save file (in editor) |

---

## File Locations

### Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main application component |
| `src/stores/useSessionStore.ts` | Terminal session management |
| `src/stores/useMaestroStore.ts` | Task & session management |
| `src/components/maestro/MaestroPanel.tsx` | Task management UI |
| `src/components/app/AppWorkspace.tsx` | Main workspace |
| `src/SessionTerminal.tsx` | Terminal component |
| `src/utils/MaestroClient.ts` | API client |
| `src/services/maestroService.ts` | Maestro operations |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | NPM dependencies |
| `tsconfig.json` | TypeScript config |
| `vite.config.ts` | Vite config |
| `src-tauri/tauri.conf.json` | Tauri config |

---

## Environment Variables

### Set by UI (for Maestro sessions)

```bash
MAESTRO_SESSION_ID=ses_123
MAESTRO_PROJECT_ID=proj_456
MAESTRO_TASK_DATA='{"id":"...","title":"...","initialPrompt":"..."}'
MAESTRO_TASK_IDS=task1,task2
MAESTRO_SKILLS=maestro-worker,debugging
MAESTRO_API_URL=http://localhost:3000
MAESTRO_AGENT_ID=claude
MAESTRO_AGENT_MODEL=sonnet
```

### Used by Vite

```bash
VITE_API_URL=http://localhost:3000  # Override API URL
TAURI_DEBUG=1                        # Enable debug mode
```

---

## Debugging

### Enable Verbose Logging

```typescript
// In useMaestroStore.ts
const HIGH_FREQUENCY_EVENTS = new Set([
  'heartbeat',
  'ping',
  'pong',
]);

// All other events will be logged with full details
```

### Check WebSocket Status

```typescript
const wsConnected = useMaestroStore(s => s.wsConnected);
console.log('WebSocket connected:', wsConnected);
```

### Inspect Store State

```typescript
// In browser console
console.log('Sessions:', useSessionStore.getState().sessions);
console.log('Tasks:', Array.from(useMaestroStore.getState().tasks.values()));
console.log('Projects:', useProjectStore.getState().projects);
```

### Clear Persisted State

```bash
# macOS
rm -rf ~/Library/Application\ Support/com.maestro.ui

# Or use the CLI flag
npm run tauri:dev:clear
```

---

## Build & Deploy

### Development

```bash
npm run tauri dev              # Full dev mode
npm run tauri:dev:clear        # Dev mode with cleared data
npm run dev                    # Vite only (web testing)
```

### Production

```bash
npm run build                  # Build frontend
npm run tauri build            # Build full app
```

### Output

```
src-tauri/target/release/bundle/
├── macos/Maestro UI.app
└── dmg/Maestro UI_0.3.0_aarch64.dmg
```

---

## Common Issues

### WebSocket won't connect

1. Check if maestro-server is running on port 3000
2. Check browser console for connection errors
3. Verify `WS_URL` in `useMaestroStore.ts`

### Terminal not spawning

1. Check Tauri backend is running
2. Verify PTY commands are available
3. Check console for Tauri invoke errors

### Store state not persisting

1. Check localStorage is available
2. Verify persistence subscriptions in `persistence.ts`
3. Check browser storage inspector

### Build failures

1. Clear `node_modules` and reinstall
2. Clear Tauri cache: `cargo clean` in `src-tauri/`
3. Check Rust toolchain is up to date

---

## Resources

- **Full Specification**: [TECHNICAL-SPECIFICATION.md](./TECHNICAL-SPECIFICATION.md)
- **UI Spec**: [../MAESTRO-UI-SPEC.md](../MAESTRO-UI-SPEC.md)
- **Tauri Docs**: https://tauri.app
- **React Docs**: https://react.dev
- **Zustand Docs**: https://zustand-demo.pmnd.rs

---

**Last Updated**: February 7, 2026
