# Web App Architecture: Maestro Mobile & Browser Access

## 1. Overview

This document defines the complete architecture for compiling the existing `maestro-ui` (React 18 + Vite + Zustand) as a standalone web application accessible from phone browsers. The web app is served by the Express-based `maestro-server` as static files and communicates via REST + Socket.IO.

### Design Principles

1. **One Codebase, Two Targets** — Same React components compile for Tauri desktop and web browser via build-time flags (`__IS_WEB__`, `__IS_TAURI__`).
2. **Platform Abstraction Layer** — A `PlatformService` interface abstracts Tauri invoke() calls so components never import `@tauri-apps/api` directly.
3. **Progressive Enhancement** — Web app provides full task/session/team management. Terminal access is available via Socket.IO terminal proxy (not native PTY).
4. **Mobile-First Layout** — Responsive design with bottom tab navigation, collapsible sections, and touch-friendly interactions.

### What Works Without Changes (~70-80%)

| Layer | Components | Tauri-Free? |
|---|---|---|
| Task Management | KanbanColumn, TaskCard, CreateTaskModal, TaskFilters, SortableTaskList | Yes |
| Session Management | SessionTimeline, SessionDetailModal, SessionDetailsSection | Yes |
| Team Members | TeamMemberList, CreateTeamMemberModal, EditTeamMemberModal | Yes |
| Multi-Project | MultiProjectBoard, ProjectKanbanRow, ProjectSelectorSidebar | Yes |
| State (Zustand) | useMaestroStore, useProjectStore, useUIStore | Yes |
| REST Client | MaestroClient.ts (pure `fetch()`) | Yes |
| WebSocket | useMaestroWebSocket (native `WebSocket` API) | Yes |
| Rendering | react-markdown, mermaid, MermaidDiagram | Yes |
| Sound | soundManager.ts (Web Audio API) | Yes |

---

## 2. Build System

### 2.1 Vite Web Configuration

```typescript
// maestro-ui/vite.config.web.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    __IS_WEB__: 'true',
    __IS_TAURI__: 'false',
  },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    target: 'es2021',
    rollupOptions: {
      input: path.resolve(__dirname, 'index.web.html'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    host: '0.0.0.0', // Accessible from phone on same network
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  envPrefix: 'VITE_',
});
```

### 2.2 Web Entry HTML

```html
<!-- maestro-ui/index.web.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#0a0e16" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="manifest" href="/manifest.json" />
  <title>Maestro</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/web-main.tsx"></script>
</body>
</html>
```

No Tauri script tags. Includes PWA meta tags for phone home screen install.

### 2.3 Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite --port 1420 --strictPort",
    "dev:web": "BUILD_TARGET=web vite --config vite.config.web.ts",
    "build": "tsc -b && vite build",
    "build:web": "BUILD_TARGET=web vite build --config vite.config.web.ts",
    "preview:web": "vite preview --config vite.config.web.ts"
  }
}
```

### 2.4 TypeScript Declarations

```typescript
// Add to maestro-ui/src/vite-env.d.ts (or tsconfig global types)
declare const __IS_WEB__: boolean;
declare const __IS_TAURI__: boolean;
```

---

## 3. Platform Abstraction Layer (Tauri Stub Design)

The key architectural decision: instead of scattering `if (__IS_WEB__)` checks throughout the codebase, we introduce a **PlatformService** interface. Each platform (Tauri, Web) provides its own implementation, selected at build time.

### 3.1 Platform Service Interface

```typescript
// src/platform/types.ts
export interface PlatformService {
  // Identity
  readonly platformName: 'tauri' | 'web';

  // Lifecycle
  init(): Promise<void>;
  onBeforeClose(handler: () => Promise<void>): void;

  // State Persistence
  loadPersistedState(): Promise<PersistedAppState | null>;
  savePersistedState(state: PersistedAppState): Promise<void>;

  // Terminal/PTY
  createTerminalSession(opts: CreateSessionOpts): Promise<TerminalSessionInfo>;
  closeTerminalSession(id: string): Promise<void>;
  writeToSession(id: string, data: string): Promise<void>;
  resizeSession(id: string, cols: number, rows: number): Promise<void>;
  onTerminalOutput(handler: (sessionId: string, data: Uint8Array) => void): () => void;
  onTerminalExit(handler: (sessionId: string, code: number) => void): () => void;

  // File System
  listDirectory(path: string): Promise<FsEntry[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;

  // System
  getHomeDir(): Promise<string>;
  openInFileManager(path: string): Promise<void>;
  openInVSCode(path: string): Promise<void>;

  // Window
  setTrayStatus(status: string): void;
  setTrayAgentCount(count: number): void;

  // Security
  getSecureValue(key: string): Promise<string | null>;
  setSecureValue(key: string, value: string): Promise<void>;
}
```

### 3.2 Tauri Implementation (Existing Behavior)

```typescript
// src/platform/tauri.ts
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { homeDir } from '@tauri-apps/api/path';

export class TauriPlatformService implements PlatformService {
  readonly platformName = 'tauri' as const;

  async init() {
    // Existing initApp.ts logic: load persisted state, startup flags, etc.
  }

  onBeforeClose(handler: () => Promise<void>) {
    getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      await handler();
      await invoke('allow_window_close');
    });
  }

  async createTerminalSession(opts: CreateSessionOpts) {
    return invoke<TerminalSessionInfo>('create_session', {
      name: opts.name,
      command: opts.command,
      cwd: opts.cwd,
      envVars: opts.envVars,
      persistent: opts.persistent,
      persistId: opts.persistId,
    });
  }

  async writeToSession(id: string, data: string) {
    await invoke('write_to_session', { id, data });
  }

  onTerminalOutput(handler: (sessionId: string, data: Uint8Array) => void) {
    const unlisten = listen<{ session_id: string; bytes: number[] }>('pty-output', (event) => {
      handler(event.payload.session_id, new Uint8Array(event.payload.bytes));
    });
    return () => { unlisten.then(fn => fn()); };
  }

  async getHomeDir() {
    return homeDir();
  }

  // ... remaining methods wrap existing invoke() calls
}
```

### 3.3 Web Implementation (Stubs + Socket.IO)

```typescript
// src/platform/web.ts
import { io, Socket } from 'socket.io-client';
import { getServerUrl } from '../utils/serverConfig';

export class WebPlatformService implements PlatformService {
  readonly platformName = 'web' as const;
  private socket: Socket | null = null;
  private terminalSockets: Map<string, Socket> = new Map();

  async init() {
    // Connect to Socket.IO /mobile namespace
    this.socket = io(`${getServerUrl()}/mobile`, {
      auth: { token: this.getAuthToken() },
      transports: ['websocket', 'polling'],
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  onBeforeClose(handler: () => Promise<void>) {
    window.addEventListener('beforeunload', (e) => {
      handler(); // Best-effort, can't await in beforeunload
    });
  }

  // -- State Persistence: localStorage --

  async loadPersistedState(): Promise<PersistedAppState | null> {
    const raw = localStorage.getItem('maestro-app-state');
    return raw ? JSON.parse(raw) : null;
  }

  async savePersistedState(state: PersistedAppState) {
    localStorage.setItem('maestro-app-state', JSON.stringify(state));
  }

  // -- Terminal: Socket.IO Proxy --

  async createTerminalSession(opts: CreateSessionOpts) {
    // Web creates terminals via REST API → server spawns PTY
    const res = await fetch(`${getServerUrl()}/api/terminal/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify(opts),
    });
    const session = await res.json();

    // Connect Socket.IO for terminal I/O streaming
    const termSocket = io(`${getServerUrl()}/terminal`, {
      auth: { token: this.getAuthToken(), sessionId: session.id },
    });
    this.terminalSockets.set(session.id, termSocket);

    return session;
  }

  async writeToSession(id: string, data: string) {
    const sock = this.terminalSockets.get(id);
    if (sock) sock.emit('terminal:input', { sessionId: id, data });
  }

  async resizeSession(id: string, cols: number, rows: number) {
    const sock = this.terminalSockets.get(id);
    if (sock) sock.emit('terminal:resize', { sessionId: id, cols, rows });
  }

  onTerminalOutput(handler: (sessionId: string, data: Uint8Array) => void) {
    // Listen across all terminal sockets
    const listeners: Array<() => void> = [];
    // This is set up per-session when createTerminalSession is called
    this._terminalOutputHandler = handler;
    return () => { this._terminalOutputHandler = null; };
  }

  onTerminalExit(handler: (sessionId: string, code: number) => void) {
    this._terminalExitHandler = handler;
    return () => { this._terminalExitHandler = null; };
  }

  // -- File System: REST API --

  async listDirectory(path: string) {
    const res = await fetch(`${getServerUrl()}/api/fs/list?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `Bearer ${this.getAuthToken()}` },
    });
    return res.json();
  }

  async readFile(path: string) {
    const res = await fetch(`${getServerUrl()}/api/fs/read?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `Bearer ${this.getAuthToken()}` },
    });
    return res.text();
  }

  async writeFile(path: string, content: string) {
    await fetch(`${getServerUrl()}/api/fs/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify({ path, content }),
    });
  }

  // -- System: Fetch from server --

  async getHomeDir() {
    const res = await fetch(`${getServerUrl()}/api/system/home-dir`, {
      headers: { 'Authorization': `Bearer ${this.getAuthToken()}` },
    });
    const data = await res.json();
    return data.homeDir;
  }

  async openInFileManager(_path: string) { /* noop on web */ }
  async openInVSCode(_path: string) { /* noop on web */ }

  // -- Window: Noop --
  setTrayStatus(_status: string) { /* noop */ }
  setTrayAgentCount(_count: number) { /* noop */ }

  // -- Security: localStorage (no keychain) --
  async getSecureValue(key: string) {
    return localStorage.getItem(`secure:${key}`);
  }

  async setSecureValue(key: string, value: string) {
    localStorage.setItem(`secure:${key}`, value);
  }

  // -- Auth helpers --
  private getAuthToken(): string {
    return localStorage.getItem('maestro-auth-token') || '';
  }
}
```

### 3.4 Platform Provider (Build-Time Selection)

```typescript
// src/platform/index.ts
import type { PlatformService } from './types';

let _platform: PlatformService | null = null;

export function getPlatform(): PlatformService {
  if (!_platform) {
    throw new Error('Platform not initialized. Call initPlatform() first.');
  }
  return _platform;
}

export async function initPlatform(): Promise<PlatformService> {
  if (__IS_TAURI__) {
    const { TauriPlatformService } = await import('./tauri');
    _platform = new TauriPlatformService();
  } else {
    const { WebPlatformService } = await import('./web');
    _platform = new WebPlatformService();
  }
  await _platform.init();
  return _platform;
}
```

Dynamic `import()` ensures Vite tree-shakes the unused platform — web builds never bundle `@tauri-apps/api`.

### 3.5 Migration Path for Existing Code

Existing code uses `invoke()` directly. The migration is incremental:

```
Phase 1: Add PlatformService, wire into initApp and sessionService
Phase 2: Migrate remaining invoke() calls file-by-file
Phase 3: Remove direct @tauri-apps/api imports from components
```

Components that currently use Tauri directly and need migration:

| Component/File | Tauri Usage | Platform Method |
|---|---|---|
| `sessionService.ts` | `invoke("create_session")` | `platform.createTerminalSession()` |
| `initApp.ts` | `listen("pty-output")`, `invoke("load_persisted_state")` | `platform.onTerminalOutput()`, `platform.loadPersistedState()` |
| `App.tsx` | `getCurrentWindow().onCloseRequested()` | `platform.onBeforeClose()` |
| `MaestroContext.tsx` | `homeDir()` | `platform.getHomeDir()` |
| `SessionTerminal.tsx` | `invoke("write_to_session")`, `invoke("resize_session")` | `platform.writeToSession()`, `platform.resizeSession()` |
| `usePathPicker.ts` | Native file dialog | Text input fallback |
| `useTrayManager.ts` | `invoke("set_tray_*")` | `platform.setTrayStatus()` (noop) |
| `useSecureStorageManager.ts` | `invoke("prepare_secure_storage")` | `platform.getSecureValue()` |
| `useAppUpdate.ts` | Tauri updater | Removed on web |

---

## 4. Component Hierarchy

### 4.1 Web Entry Point

```typescript
// src/web-main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WebApp } from './WebApp';
import './styles.css';
import 'xterm/css/xterm.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebApp />
  </React.StrictMode>
);
```

### 4.2 WebApp Shell

```typescript
// src/WebApp.tsx
import React, { useEffect, useState } from 'react';
import { initPlatform } from './platform';
import { useUIStore } from './stores/useUIStore';
import { useMaestroStore } from './stores/useMaestroStore';
import { useProjectStore } from './stores/useProjectStore';
import { MobileLayout } from './components/web/MobileLayout';
import { AuthGate } from './components/web/AuthGate';
import { WebInitLoader } from './components/web/WebInitLoader';

export function WebApp() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function boot() {
      await initPlatform();
      // Check for existing auth token
      const token = localStorage.getItem('maestro-auth-token');
      if (token) {
        setAuthenticated(true);
      }
      setReady(true);
    }
    boot();
  }, []);

  if (!ready) return <WebInitLoader />;
  if (!authenticated) return <AuthGate onAuth={() => setAuthenticated(true)} />;

  return <MobileLayout />;
}
```

### 4.3 Complete Component Tree

```
WebApp
├── WebInitLoader              (loading spinner during platform init)
├── AuthGate                   (login/signup screens)
│   ├── LoginForm
│   └── SignupForm
└── MobileLayout               (authenticated app shell)
    ├── TopBar                 (project selector, connection status, user menu)
    │   ├── ProjectDropdown
    │   ├── ConnectionIndicator
    │   └── UserMenu
    ├── ContentArea             (tab-switched main content)
    │   ├── DashboardTab
    │   │   ├── ActiveSessionsCard
    │   │   ├── TaskSummaryCard
    │   │   └── RecentActivityFeed
    │   ├── TasksTab
    │   │   ├── TaskFilters      (existing component, reused)
    │   │   ├── KanbanColumn[]   (existing, reused)
    │   │   │   └── TaskCard[]   (existing, reused)
    │   │   ├── CreateTaskModal  (existing, reused)
    │   │   └── TaskDetailSheet  (bottom sheet on mobile)
    │   ├── SessionsTab
    │   │   ├── SessionStatusGrid
    │   │   │   └── SessionStatusCard[]
    │   │   ├── SessionDetailSheet
    │   │   │   ├── SessionTimeline  (existing, reused)
    │   │   │   ├── SessionTerminalView  (xterm via Socket.IO)
    │   │   │   └── NeedsInputForm
    │   │   └── SpawnSessionButton
    │   ├── TeamTab
    │   │   ├── TeamMemberList     (existing, reused)
    │   │   ├── CreateTeamMemberModal  (existing, reused)
    │   │   └── EditTeamMemberModal    (existing, reused)
    │   └── MailTab
    │       ├── MailInbox
    │       └── MailComposer
    └── BottomNav               (tab bar: Dashboard | Tasks | Sessions | Team | Mail)
```

---

## 5. Responsive Layout

### 5.1 MobileLayout Component

```typescript
// src/components/web/MobileLayout.tsx
import React, { useState } from 'react';
import { BottomNav, TabId } from './BottomNav';
import { TopBar } from './TopBar';
import { DashboardTab } from './tabs/DashboardTab';
import { TasksTab } from './tabs/TasksTab';
import { SessionsTab } from './tabs/SessionsTab';
import { TeamTab } from './tabs/TeamTab';
import { MailTab } from './tabs/MailTab';

const TAB_COMPONENTS: Record<TabId, React.FC> = {
  dashboard: DashboardTab,
  tasks: TasksTab,
  sessions: SessionsTab,
  team: TeamTab,
  mail: MailTab,
};

export function MobileLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const ActiveContent = TAB_COMPONENTS[activeTab];

  return (
    <div className="web-layout">
      <TopBar />
      <main className="web-content">
        <ActiveContent />
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
```

### 5.2 Responsive Breakpoints

```css
/* Mobile-first responsive design */
.web-layout {
  display: flex;
  flex-direction: column;
  height: 100dvh; /* Dynamic viewport height for mobile */
  background: var(--bg-primary, #0a0e16);
  color: var(--text-primary, #f0f4f8);
}

.web-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0;
}

/* Bottom Navigation */
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 56px;
  background: var(--bg-surface, #111827);
  border-top: 1px solid var(--border-color, #1f2937);
  padding-bottom: env(safe-area-inset-bottom); /* iPhone notch */
}

/* Tablet/Desktop: side-by-side layout */
@media (min-width: 768px) {
  .web-layout {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .web-topbar {
    width: 100%;
  }
  .web-content {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 0;
  }
  .bottom-nav {
    display: none; /* Use sidebar navigation instead */
  }
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
    border-right: 1px solid var(--border-color);
  }
}

/* Large Desktop: 3-panel like Tauri app */
@media (min-width: 1200px) {
  .web-content {
    grid-template-columns: 280px 1fr 380px;
  }
}
```

### 5.3 Layout Diagrams

```
Phone (< 768px):                    Tablet (768-1199px):
┌──────────────────────┐            ┌──────────────────────────────┐
│  TopBar              │            │  TopBar                      │
│  [Project ▼] [🔌] [👤]│            │  [Project ▼] [🔌 Connected] [👤]│
├──────────────────────┤            ├────────┬─────────────────────┤
│                      │            │ Side-  │                     │
│  Active Tab Content  │            │ bar    │  Active Tab Content │
│                      │            │        │                     │
│  (scrollable)        │            │ Dash   │                     │
│                      │            │ Tasks  │                     │
│                      │            │ Sess   │                     │
│                      │            │ Team   │                     │
│                      │            │ Mail   │                     │
├──────────────────────┤            │        │                     │
│ 📊  📋  🖥️  👥  ✉️    │            │        │                     │
│ Bottom Nav Tabs      │            └────────┴─────────────────────┘
└──────────────────────┘

Desktop (>= 1200px):
┌──────────────────────────────────────────────────────┐
│  TopBar: [Project ▼] [🔌 Connected]            [👤]  │
├────────┬───────────────────────────┬─────────────────┤
│ Side-  │                           │  Detail Panel   │
│ bar    │  Main Content Area        │                 │
│        │                           │  (Session       │
│ Dash   │  Kanban / Session Grid    │   Timeline,     │
│ Tasks  │                           │   Task Detail,  │
│ Sess   │                           │   Terminal)     │
│ Team   │                           │                 │
│ Mail   │                           │                 │
└────────┴───────────────────────────┴─────────────────┘
```

---

## 6. Key Web Components

### 6.1 SessionStatusGrid

Replaces the terminal workspace area. Shows all sessions as status cards.

```typescript
// src/components/web/SessionStatusGrid.tsx
import React from 'react';
import { useMaestroStore } from '../../stores/useMaestroStore';
import { SessionStatusCard } from './SessionStatusCard';

export function SessionStatusGrid() {
  const sessions = useMaestroStore(s => Array.from(s.sessions.values()));
  const activeProjectId = useProjectStore(s => s.activeProjectId);

  const projectSessions = sessions
    .filter(s => s.projectId === activeProjectId)
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

  return (
    <div className="session-grid">
      {projectSessions.map(session => (
        <SessionStatusCard key={session.id} session={session} />
      ))}
      {projectSessions.length === 0 && (
        <div className="empty-state">No sessions yet. Spawn an agent to get started.</div>
      )}
    </div>
  );
}
```

### 6.2 SessionStatusCard

```typescript
// src/components/web/SessionStatusCard.tsx
import React, { useState } from 'react';
import type { MaestroSession } from '../../app/types/maestro';
import { SessionTimeline } from '../maestro/SessionTimeline'; // Reused!

const STATUS_INDICATORS: Record<string, { color: string; label: string }> = {
  working: { color: '#22c55e', label: 'Working' },
  idle: { color: '#eab308', label: 'Idle' },
  spawning: { color: '#3b82f6', label: 'Spawning' },
  completed: { color: '#6b7280', label: 'Completed' },
  failed: { color: '#ef4444', label: 'Failed' },
  stopped: { color: '#6b7280', label: 'Stopped' },
};

interface Props {
  session: MaestroSession;
}

export function SessionStatusCard({ session }: Props) {
  const [expanded, setExpanded] = useState(false);
  const indicator = STATUS_INDICATORS[session.status] || STATUS_INDICATORS.idle;
  const needsInput = session.needsInput?.active;

  return (
    <div
      className={`session-card ${needsInput ? 'needs-input' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="session-card-header">
        <span className="status-dot" style={{ background: indicator.color }} />
        <span className="session-name">{session.name || session.id.slice(0, 12)}</span>
        <span className="session-status">{indicator.label}</span>
      </div>

      {needsInput && (
        <div className="needs-input-banner">
          Needs Input: {session.needsInput?.message}
          <NeedsInputForm sessionId={session.id} />
        </div>
      )}

      {expanded && (
        <div className="session-card-detail">
          <SessionTimeline session={session} />
        </div>
      )}
    </div>
  );
}
```

### 6.3 NeedsInputForm

```typescript
// src/components/web/NeedsInputForm.tsx
import React, { useState } from 'react';
import { useMaestroStore } from '../../stores/useMaestroStore';

export function NeedsInputForm({ sessionId }: { sessionId: string }) {
  const [input, setInput] = useState('');
  const updateSession = useMaestroStore(s => s.updateMaestroSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Send input via mail endpoint (maestro-server routes it to the session)
    await fetch(`${getServerUrl()}/api/sessions/${sessionId}/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('maestro-auth-token')}`,
      },
      body: JSON.stringify({ message: input }),
    });
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="needs-input-form" onClick={e => e.stopPropagation()}>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Type your response..."
        autoFocus
      />
      <button type="submit">Send</button>
    </form>
  );
}
```

### 6.4 Terminal View (Socket.IO)

On web, terminal access is provided via Socket.IO terminal proxy. The same `xterm.js` library renders output, but I/O goes through WebSocket instead of Tauri invoke.

```typescript
// src/components/web/WebTerminal.tsx
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { getPlatform } from '../../platform';

interface Props {
  sessionId: string;
}

export function WebTerminal({ sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const platform = getPlatform();

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      theme: {
        background: '#0a0e16',
        foreground: '#f0f4f8',
      },
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;

    // Input → Socket.IO
    term.onData((data) => {
      platform.writeToSession(sessionId, data);
    });

    // Output ← Socket.IO
    const unsubOutput = platform.onTerminalOutput((sid, data) => {
      if (sid === sessionId) {
        term.write(data);
      }
    });

    // Resize
    const observer = new ResizeObserver(() => {
      fit.fit();
      platform.resizeSession(sessionId, term.cols, term.rows);
    });
    observer.observe(containerRef.current);

    return () => {
      unsubOutput();
      observer.disconnect();
      term.dispose();
    };
  }, [sessionId]);

  return <div ref={containerRef} className="web-terminal" />;
}
```

---

## 7. State Management for Web

### 7.1 Strategy: Zustand + Socket.IO Events

The existing Zustand stores (useMaestroStore, useProjectStore, etc.) work perfectly on web. The only change is how real-time events arrive:

| Concern | Tauri Desktop | Web App |
|---|---|---|
| Initial data load | REST API via MaestroClient | Same REST API (unchanged) |
| Real-time events | Raw WebSocket (global singleton) | Socket.IO /mobile namespace |
| State persistence | Tauri invoke (save to disk) | localStorage |
| Terminal I/O | Tauri events (pty-output, pty-exit) | Socket.IO /terminal namespace |
| Auth tokens | macOS Keychain via Tauri | localStorage + httpOnly cookies |

### 7.2 Socket.IO Event Bridge

Replace the raw WebSocket connection in `useMaestroStore` with a Socket.IO client on web:

```typescript
// src/services/socketBridge.web.ts
import { io, Socket } from 'socket.io-client';
import { useMaestroStore } from '../stores/useMaestroStore';

let socket: Socket | null = null;

export function initSocketBridge(serverUrl: string, authToken: string) {
  socket = io(`${serverUrl}/mobile`, {
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  const store = useMaestroStore.getState();

  // Map Socket.IO events to store actions (same as existing WebSocket handler)
  socket.on('task:created', (task) => store.handleTaskEvent('created', task));
  socket.on('task:updated', (task) => store.handleTaskEvent('updated', task));
  socket.on('task:deleted', (data) => store.handleTaskEvent('deleted', data));
  socket.on('session:created', (session) => store.handleSessionEvent('created', session));
  socket.on('session:updated', (session) => store.handleSessionEvent('updated', session));
  socket.on('session:deleted', (data) => store.handleSessionEvent('deleted', data));

  // Notifications
  socket.on('notify:needs_input', (data) => {
    store.handleNotification('needs_input', data);
    // Browser push notification
    if (Notification.permission === 'granted') {
      new Notification('Maestro: Input Needed', {
        body: data.message || `Session ${data.sessionId} needs your input`,
        icon: '/maestro-icon.png',
        tag: `needs-input-${data.sessionId}`,
      });
    }
  });

  socket.on('notify:task_completed', (data) => {
    store.handleNotification('task_completed', data);
  });

  socket.on('connect', () => {
    useMaestroStore.setState({ wsConnected: true });
  });

  socket.on('disconnect', () => {
    useMaestroStore.setState({ wsConnected: false });
  });

  return socket;
}

export function getSocket() { return socket; }
```

### 7.3 Web Initialization Flow

```typescript
// src/stores/initApp.web.ts
import { initPlatform, getPlatform } from '../platform';
import { useMaestroStore } from './useMaestroStore';
import { useProjectStore } from './useProjectStore';
import { useUIStore } from './useUIStore';
import { initSocketBridge } from '../services/socketBridge.web';

export async function initWebApp() {
  // 1. Init platform service
  await initPlatform();
  const platform = getPlatform();

  // 2. Load theme/zoom from localStorage (existing code)
  useUIStore.getState().initTheme();
  useUIStore.getState().initZoom();

  // 3. Load persisted state from localStorage
  const state = await platform.loadPersistedState();
  if (state) {
    useProjectStore.getState().restoreFromPersisted(state);
  }

  // 4. Fetch initial data from server
  const token = localStorage.getItem('maestro-auth-token');
  if (!token) throw new Error('Not authenticated');

  await Promise.all([
    useMaestroStore.getState().fetchTasks(),
    useMaestroStore.getState().fetchSessions(),
    useMaestroStore.getState().fetchTeamMembers(),
    useProjectStore.getState().fetchSavedProjects(),
  ]);

  // 5. Connect Socket.IO for real-time events
  const serverUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
  initSocketBridge(serverUrl, token);

  // 6. Auto-persist state changes to localStorage
  const PERSIST_DEBOUNCE = 2000;
  let persistTimer: ReturnType<typeof setTimeout>;
  const autoPersist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const currentState = buildPersistedState();
      platform.savePersistedState(currentState);
    }, PERSIST_DEBOUNCE);
  };

  useMaestroStore.subscribe(autoPersist);
  useProjectStore.subscribe(autoPersist);
}
```

---

## 8. Authentication UI

### 8.1 Auth Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Phone   │     │  Cloudflare  │     │  maestro-    │
│  Browser │     │  Tunnel      │     │  server      │
│          │     │              │     │              │
│ 1. Open  │────▶│              │────▶│              │
│    app   │     │              │     │              │
│          │◀────│              │◀────│ 2. Serve     │
│          │     │              │     │    index.html │
│          │     │              │     │              │
│ 3. POST  │────▶│              │────▶│ 4. Validate  │
│   /login │     │              │     │    via        │
│          │     │              │     │    Supabase   │
│          │◀────│              │◀────│ 5. Return    │
│          │     │              │     │    JWT token  │
│          │     │              │     │              │
│ 6. Store │     │              │     │              │
│    token │     │              │     │              │
│          │     │              │     │              │
│ 7. All   │────▶│              │────▶│ 8. Verify   │
│    API   │     │              │     │    JWT on    │
│    calls │     │              │     │    each req  │
│    +Auth │     │              │     │              │
└──────────┘     └──────────────┘     └──────────────┘
```

### 8.2 AuthGate Component

```typescript
// src/components/web/AuthGate.tsx
import React, { useState } from 'react';

interface Props {
  onAuth: () => void;
}

export function AuthGate({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const serverUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const res = await fetch(`${serverUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Authentication failed');
      }

      const { token, user } = await res.json();
      localStorage.setItem('maestro-auth-token', token);
      localStorage.setItem('maestro-user', JSON.stringify(user));
      onAuth();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Maestro</h1>
          <p>Agent Orchestration Platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          className="auth-toggle"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
```

### 8.3 JWT Token Management

```typescript
// src/services/authService.web.ts

export const authService = {
  getToken(): string | null {
    return localStorage.getItem('maestro-auth-token');
  },

  getUser(): { id: string; email: string } | null {
    const raw = localStorage.getItem('maestro-user');
    return raw ? JSON.parse(raw) : null;
  },

  logout() {
    localStorage.removeItem('maestro-auth-token');
    localStorage.removeItem('maestro-user');
    window.location.reload();
  },

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  },

  // Add token to all MaestroClient requests
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },
};
```

### 8.4 MaestroClient Auth Integration

The existing `MaestroClient.ts` uses plain `fetch()`. Add auth headers:

```typescript
// Modify MaestroClient.ts — add interceptor
private async request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('maestro-auth-token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (__IS_WEB__ && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${this.baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Token expired — force re-login
    localStorage.removeItem('maestro-auth-token');
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

---

## 9. Socket.IO Namespace Design

The web app connects to two Socket.IO namespaces:

### 9.1 `/mobile` Namespace — App Events

```
Client connects:
  auth: { token: "jwt-token" }

Server → Client events:
  task:created      { ...MaestroTask }
  task:updated      { ...MaestroTask }
  task:deleted      { id: string }
  session:created   { ...MaestroSession }
  session:updated   { ...MaestroSession }
  session:deleted   { id: string }
  notify:needs_input    { sessionId, message, since }
  notify:task_completed { taskId, title }
  notify:task_failed    { taskId, title, error }
  notify:progress       { sessionId, message }
  session:modal         { sessionId, html, eventName }

Client → Server events:
  session:input     { sessionId, message }   // Reply to needs_input
  session:spawn     { taskIds[], config }     // Spawn new session
  join:project      { projectId }             // Subscribe to project events
  leave:project     { projectId }             // Unsubscribe
```

### 9.2 `/terminal` Namespace — Terminal I/O

```
Client connects:
  auth: { token: "jwt-token", sessionId: "sess_xxx" }

Server → Client events:
  terminal:output   { sessionId, data: Uint8Array }
  terminal:exit     { sessionId, code: number }

Client → Server events:
  terminal:input    { sessionId, data: string }
  terminal:resize   { sessionId, cols, rows }
```

---

## 10. Notification Strategy

### 10.1 Browser Notifications

```typescript
// src/services/notificationService.web.ts

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function sendNotification(title: string, body: string, options?: {
  tag?: string;
  onClick?: () => void;
}) {
  if (Notification.permission !== 'granted') return;

  const notif = new Notification(title, {
    body,
    icon: '/maestro-icon.png',
    badge: '/maestro-badge.png',
    tag: options?.tag,
    vibrate: [200, 100, 200], // Mobile vibration pattern
  });

  if (options?.onClick) {
    notif.onclick = () => {
      window.focus();
      options.onClick!();
    };
  }
}
```

### 10.2 Notification Events

| Server Event | Notification Title | Body |
|---|---|---|
| `notify:needs_input` | "Input Needed" | Session message (truncated) |
| `notify:task_completed` | "Task Complete" | Task title |
| `notify:task_failed` | "Task Failed" | Task title + error |
| `notify:session_completed` | "Session Done" | Session name |

---

## 11. PWA Support (Progressive Web App)

### 11.1 Manifest

```json
// maestro-ui/public/manifest.json
{
  "name": "Maestro",
  "short_name": "Maestro",
  "description": "Agent Orchestration Platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0e16",
  "theme_color": "#0a0e16",
  "icons": [
    { "src": "/maestro-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/maestro-icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

This allows "Add to Home Screen" on iOS/Android, making the web app feel native.

---

## 12. Server-Side Changes

### 12.1 Static File Serving (maestro-server)

```typescript
// maestro-server/src/server.ts — additions
import express from 'express';
import path from 'path';

// Serve web app static files
const webAppDir = path.resolve(__dirname, '../../maestro-ui/dist-web');
app.use(express.static(webAppDir));

// SPA fallback for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(webAppDir, 'index.html'));
});
```

### 12.2 Terminal Proxy API (New)

The server needs a terminal proxy for web clients. This is a new Socket.IO namespace:

```typescript
// maestro-server/src/infrastructure/socket/TerminalProxy.ts
import { Server, Socket } from 'socket.io';
import * as pty from 'node-pty';

const terminals: Map<string, pty.IPty> = new Map();

export function setupTerminalProxy(io: Server) {
  const ns = io.of('/terminal');

  ns.use(authMiddleware); // JWT verification

  ns.on('connection', (socket: Socket) => {
    const sessionId = socket.handshake.auth.sessionId;

    socket.on('terminal:input', ({ data }) => {
      const term = terminals.get(sessionId);
      if (term) term.write(data);
    });

    socket.on('terminal:resize', ({ cols, rows }) => {
      const term = terminals.get(sessionId);
      if (term) term.resize(cols, rows);
    });

    socket.on('disconnect', () => {
      // Keep terminal running — user might reconnect
    });
  });
}
```

### 12.3 File System REST API (New)

```typescript
// maestro-server/src/api/routes/fs.routes.ts
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

router.get('/list', async (req, res) => {
  const dirPath = req.query.path as string;
  // Validate path is within allowed directories
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  res.json(entries.map(e => ({
    name: e.name,
    isDirectory: e.isDirectory(),
    path: path.join(dirPath, e.name),
  })));
});

router.get('/read', async (req, res) => {
  const filePath = req.query.path as string;
  const content = await fs.readFile(filePath, 'utf-8');
  res.type('text/plain').send(content);
});

router.post('/write', async (req, res) => {
  const { path: filePath, content } = req.body;
  await fs.writeFile(filePath, content, 'utf-8');
  res.json({ ok: true });
});

export default router;
```

---

## 13. File Inventory

### New Files

| File | Description | Size Est. |
|---|---|---|
| `maestro-ui/vite.config.web.ts` | Web build config | ~40 lines |
| `maestro-ui/index.web.html` | Web entry HTML with PWA meta | ~20 lines |
| `maestro-ui/src/web-main.tsx` | Web React entry point | ~15 lines |
| `maestro-ui/src/WebApp.tsx` | Web app shell with auth gate | ~50 lines |
| `maestro-ui/src/platform/types.ts` | PlatformService interface | ~60 lines |
| `maestro-ui/src/platform/index.ts` | Platform provider (build-time switch) | ~20 lines |
| `maestro-ui/src/platform/tauri.ts` | Tauri platform implementation | ~150 lines |
| `maestro-ui/src/platform/web.ts` | Web platform implementation | ~180 lines |
| `maestro-ui/src/components/web/MobileLayout.tsx` | Responsive layout shell | ~60 lines |
| `maestro-ui/src/components/web/BottomNav.tsx` | Bottom tab navigation | ~50 lines |
| `maestro-ui/src/components/web/TopBar.tsx` | Top bar with project selector | ~40 lines |
| `maestro-ui/src/components/web/AuthGate.tsx` | Login/signup screens | ~100 lines |
| `maestro-ui/src/components/web/SessionStatusGrid.tsx` | Session card grid | ~40 lines |
| `maestro-ui/src/components/web/SessionStatusCard.tsx` | Individual session card | ~80 lines |
| `maestro-ui/src/components/web/NeedsInputForm.tsx` | Input reply form | ~40 lines |
| `maestro-ui/src/components/web/WebTerminal.tsx` | xterm via Socket.IO | ~80 lines |
| `maestro-ui/src/components/web/WebInitLoader.tsx` | Loading spinner | ~15 lines |
| `maestro-ui/src/components/web/tabs/DashboardTab.tsx` | Dashboard view | ~60 lines |
| `maestro-ui/src/components/web/tabs/TasksTab.tsx` | Tasks Kanban view | ~40 lines |
| `maestro-ui/src/components/web/tabs/SessionsTab.tsx` | Sessions grid view | ~40 lines |
| `maestro-ui/src/components/web/tabs/TeamTab.tsx` | Team management view | ~30 lines |
| `maestro-ui/src/components/web/tabs/MailTab.tsx` | Mail inbox view | ~40 lines |
| `maestro-ui/src/services/socketBridge.web.ts` | Socket.IO event bridge | ~80 lines |
| `maestro-ui/src/services/authService.web.ts` | Auth token management | ~40 lines |
| `maestro-ui/src/services/notificationService.web.ts` | Browser notifications | ~30 lines |
| `maestro-ui/src/stores/initApp.web.ts` | Web app initialization | ~60 lines |
| `maestro-ui/public/manifest.json` | PWA manifest | ~15 lines |
| `maestro-server/src/infrastructure/socket/TerminalProxy.ts` | Terminal Socket.IO proxy | ~80 lines |
| `maestro-server/src/api/routes/fs.routes.ts` | File system REST API | ~50 lines |

### Modified Files

| File | Change |
|---|---|
| `maestro-ui/package.json` | Add `dev:web`, `build:web` scripts; add `socket.io-client` dep |
| `maestro-ui/src/vite-env.d.ts` | Add `__IS_WEB__` / `__IS_TAURI__` declarations |
| `maestro-ui/src/utils/MaestroClient.ts` | Add auth header injection for web builds |
| `maestro-server/src/server.ts` | Add `express.static()` for dist-web + SPA fallback |
| `maestro-server/package.json` | Add `node-pty` dependency (for terminal proxy) |

### Unchanged (Reused As-Is)

All existing Maestro components, Zustand stores, hooks, types, and utilities. The platform abstraction layer wraps Tauri calls without modifying existing component logic.

---

## 14. Deployment Topology

```
                    Internet
                       │
              ┌────────▼────────┐
              │  Cloudflare     │
              │  Tunnel         │
              │  maestro.       │
              │  example.com    │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  maestro-server │
              │  :3000          │
              │                 │
              │  / → dist-web/  │  ← Static web app files
              │  /api → REST    │  ← Task/Session/Team CRUD
              │  /socket.io     │  ← Real-time events
              │    /mobile ns   │  ← Phone/browser clients
              │    /ui ns       │  ← Desktop Tauri client
              │    /terminal ns │  ← Terminal I/O proxy
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  Redis          │
              │  :6379          │
              │  Pub/Sub +      │
              │  Streams        │
              └─────────────────┘
```

---

## 15. Implementation Phases

| Phase | Work | Dependencies | Effort |
|---|---|---|---|
| **P1: Build System** | `vite.config.web.ts`, `index.web.html`, package.json scripts, TS declarations | None | 1 hour |
| **P2: Platform Layer** | `platform/types.ts`, `platform/web.ts`, `platform/tauri.ts`, `platform/index.ts` | None | 3-4 hours |
| **P3: Web Shell** | `web-main.tsx`, `WebApp.tsx`, `MobileLayout.tsx`, `BottomNav.tsx`, `TopBar.tsx` | P1 | 2-3 hours |
| **P4: Auth UI** | `AuthGate.tsx`, `authService.web.ts`, MaestroClient auth headers | Server auth endpoints | 2 hours |
| **P5: Session Views** | `SessionStatusGrid.tsx`, `SessionStatusCard.tsx`, `NeedsInputForm.tsx` | P3 | 2-3 hours |
| **P6: Socket.IO Bridge** | `socketBridge.web.ts`, `initApp.web.ts`, notification service | Server Socket.IO | 2 hours |
| **P7: Terminal Proxy** | `WebTerminal.tsx`, server `TerminalProxy.ts`, `fs.routes.ts` | P2, P6 | 3-4 hours |
| **P8: Tab Views** | Dashboard, Tasks, Sessions, Team, Mail tab components | P3, P5 | 3-4 hours |
| **P9: PWA** | manifest.json, icons, service worker (optional) | P1 | 1 hour |
| **Total** | | | **~20-24 hours** |

---

## 16. Coordination Notes

### From Realtime Engineer (needed)
- Socket.IO `/mobile` namespace event schema (Section 9.1 is proposed — needs confirmation)
- Socket.IO `/terminal` namespace for PTY proxying
- Authentication middleware for Socket.IO connections

### From CLI & Infra Engineer (needed)
- Auth endpoints: `POST /api/auth/login`, `POST /api/auth/signup`
- JWT token format and validation middleware
- Static file serving configuration in `server.ts`

### Shared with All Team Members
- PlatformService interface (Section 3.1) — all future Tauri API usage should go through this
- Component reuse strategy — existing Maestro components are imported directly into web tabs
- Socket.IO event names must match between server bridge and web client bridge
