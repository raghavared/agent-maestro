# Web App Plan: Maestro UI as a Phone-Accessible Web App

## Overview

The existing `maestro-ui` codebase (React 18 + Vite + Zustand) is a Tauri desktop app. The plan is to compile the **same codebase** as a standalone web app that runs in any browser — including a phone browser. The web app supports everything **except the terminal** (which requires native PTY access via Tauri's Rust backend).

## What Works Today Without Changes

The entire Maestro panel (right side of the desktop app) is **pure web code** with zero Tauri dependencies:

| Component | File(s) | Status |
|---|---|---|
| Task management (CRUD, drag-drop, Kanban) | `src/components/maestro/*` | Pure web |
| Multi-project Kanban board | `MultiProjectBoard.tsx` | Pure web |
| Task timeline & progress | `TaskTimeline.tsx`, `TaskCard.tsx` | Pure web |
| Team member management | `TeamMemberPanel.tsx` | Pure web |
| Session list & status | `SessionsSection.tsx` | Pure web |
| Session spawn (via REST) | `maestroService.ts` → `MaestroClient.ts` | Pure web |
| Project management | `ProjectTabBar.tsx` | Pure web |
| REST API client | `MaestroClient.ts` | Pure `fetch()` |
| WebSocket real-time updates | `useMaestroWebSocket.ts` | Native `WebSocket` API |
| State management | `useMaestroStore.ts` + Zustand stores | Pure web |
| Server config | `serverConfig.ts` | `VITE_API_URL` env var |
| Sound notifications | `soundManager.ts` | Web Audio API |
| Markdown/Mermaid rendering | `react-markdown`, `mermaid` | Pure web |

**Estimated coverage: ~70-80% of the UI works as-is in a browser.**

## What Requires Changes (Tauri-Specific Code)

### Category 1: Terminal (Exclude from web app)

These files depend on Tauri's PTY backend (`invoke("write_to_session")`, `invoke("resize_session")`, `listen("pty-output")`). In the web app, the terminal area is **hidden or replaced with a status view**.

| File | Tauri Dependency | Web App Replacement |
|---|---|---|
| `SessionTerminal.tsx` | `invoke("write_to_session")`, `invoke("resize_session")` | **Exclude** — show session status card instead |
| `sessionService.ts` | `invoke("create_session")`, `invoke("close_session")` | **Stub** — call REST spawn only, no local PTY |
| `useTerminalSession.ts` | `invoke("create_session")` for Maestro spawns | **Stub** — delegate to server-side spawn |
| `AppWorkspace.tsx` | Hosts `SessionTerminal` | **Replace** — show session status grid |
| `FileExplorerPanel.tsx` | `invoke("list_fs_entries")`, `invoke("read_text_file")` | **Exclude** or stub |
| `CodeEditorPanel.tsx` | `invoke("read_text_file")`, `invoke("write_text_file")` | **Exclude** or stub |

### Category 2: App Lifecycle (Stub or Replace)

| File | Tauri Dependency | Web App Replacement |
|---|---|---|
| `initApp.ts` | `listen("pty-output")`, `listen("pty-exit")`, `invoke("load_persisted_state")`, `invoke("get_startup_flags")`, `homeDir()` | **Conditional init** — skip PTY listeners, use `localStorage` for state |
| `persistence.ts` | `invoke("save_persisted_state")` | **Replace** — use `localStorage` or skip |
| `App.tsx` | `getCurrentWindow().onCloseRequested()` | **Replace** — `window.addEventListener('beforeunload')` |
| `MaestroContext.tsx` | `homeDir()` from `@tauri-apps/api/path` | **Replace** — hardcode or fetch from server |

### Category 3: Desktop-Only Features (Remove)

| File | Feature | Web App Action |
|---|---|---|
| `useTrayManager.ts` | System tray status | **Remove** — not applicable |
| `useAppUpdate.ts` | Auto-update checking | **Remove** |
| `useSecureStorageManager.ts` | macOS Keychain | **Remove** — use browser storage |
| `usePathPicker.ts` | Native folder picker | **Replace** — `<input>` or text field |

## Implementation Strategy

### Approach: Conditional Build with `IS_WEB` Flag

Use a build-time flag to conditionally include/exclude Tauri code. This keeps **one codebase** for both desktop and web.

```typescript
// vite.config.ts — add define
export default defineConfig({
  define: {
    __IS_WEB__: JSON.stringify(process.env.BUILD_TARGET === 'web'),
    __IS_TAURI__: JSON.stringify(process.env.BUILD_TARGET !== 'web'),
  },
  // ...
});
```

```typescript
// Usage in components:
if (__IS_TAURI__) {
  // import and use Tauri APIs
} else {
  // Web fallback
}
```

### Step 1: Create Web Entry Point

```typescript
// src/web-main.tsx (new file, parallel to main.tsx)
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WebApp } from './WebApp';  // Web-specific app shell

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebApp />
  </React.StrictMode>
);
```

### Step 2: Create WebApp Shell

```typescript
// src/WebApp.tsx — simplified version of App.tsx without terminal
// - Remove getCurrentWindow() import
// - Remove terminal workspace
// - Show: Sidebar (projects, sessions list) + Maestro Panel (tasks, Kanban)
// - Add mobile-responsive layout (CSS media queries or responsive grid)
```

### Step 3: Stub Tauri Services

```typescript
// src/services/sessionService.web.ts
// Stubs that replace Tauri invoke() calls:
export async function createSession() {
  // No-op — web app can't create local terminals
  // Instead, show message: "Terminal sessions run on the host machine"
  throw new Error('Terminal not available in web mode');
}

export async function closeSession() { /* no-op */ }
```

### Step 4: Web-Specific Init

```typescript
// src/stores/initApp.web.ts
// Skip: PTY listeners, persisted state from disk, startup flags
// Keep: MaestroClient connection, WebSocket connection
// Add: localStorage-based state persistence
```

### Step 5: Vite Build Config for Web

```typescript
// vite.config.web.ts (or modify existing with mode flag)
export default defineConfig({
  build: {
    outDir: 'dist-web',
    // No Tauri-specific env vars
  },
  define: {
    __IS_WEB__: 'true',
    __IS_TAURI__: 'false',
  },
  server: {
    port: 5174,  // Different from Tauri dev port (1420)
  },
});
```

### Step 6: Build Script

```json
// package.json scripts (maestro-ui)
{
  "scripts": {
    "dev": "vite",                          // Tauri dev (existing)
    "dev:web": "BUILD_TARGET=web vite --config vite.config.web.ts",  // Web dev
    "build:web": "BUILD_TARGET=web vite build --config vite.config.web.ts",  // Web production
    "preview:web": "vite preview --config vite.config.web.ts"
  }
}
```

## Web App Layout for Phone

The desktop app has a 3-panel layout (sidebar | terminal | maestro panel). The web app uses a responsive layout optimized for phone screens:

```
Desktop (> 768px):                     Phone (< 768px):
┌────────┬──────────────────┐          ┌──────────────────┐
│ Side-  │                  │          │  [Projects ▼]    │
│ bar    │  Session Status  │          │                  │
│        │  Grid            │          │  ┌────────────┐  │
│ Proj-  │                  │          │  │ Task Board │  │
│ ects   │  ┌─────┬─────┐  │          │  │            │  │
│        │  │sess │sess │  │          │  │ ┌────────┐ │  │
│ Sess-  │  │ 1   │ 2   │  │          │  │ │Task 1 │ │  │
│ ions   │  │🟢   │⏸️    │  │          │  │ │🟢 work│ │  │
│        │  └─────┴─────┘  │          │  │ └────────┘ │  │
│ Tasks  │                  │          │  │ ┌────────┐ │  │
│        │  ┌─────┬─────┐  │          │  │ │Task 2 │ │  │
│        │  │sess │sess │  │          │  │ │⏸️ input│ │  │
│        │  │ 3   │ 4   │  │          │  │ └────────┘ │  │
│        │  │🟢   │✅    │  │          │  └────────────┘  │
│        │  └─────┴─────┘  │          │                  │
│        │                  │          │  [Sessions ▼]    │
│        │  ┌────────────┐ │          │  🟢 sess_1 working│
│        │  │ Maestro    │ │          │  ⏸️ sess_2 input  │
│        │  │ Panel      │ │          │  🟢 sess_3 working│
│        │  │ (Tasks,    │ │          │  ✅ sess_4 done   │
│        │  │  Kanban)   │ │          │                  │
│        │  └────────────┘ │          │  [+ Spawn Agent] │
└────────┴──────────────────┘          └──────────────────┘
```

**Phone-specific features:**
- Collapsible sections (Projects, Sessions, Tasks)
- Bottom navigation tabs: Dashboard | Tasks | Sessions | Settings
- Push notifications for `notify:needs_input` events (via browser Notification API)
- Pull-to-refresh for state sync
- Tap session → see timeline, docs, status (no terminal)
- Tap "needs input" → reply form

## How It Connects via Cloudflare Tunnel

```
Phone Browser                Cloudflare Tunnel              Your Machine
┌──────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│ Safari /     │     │  maestro.your        │     │  maestro-server  │
│ Chrome       │────▶│  domain.com          │────▶│  :3000           │
│              │     │                      │     │                  │
│ Loads web    │     │  Routes:             │     │  Serves:         │
│ app from     │     │  / → static files    │     │  /  → dist-web/  │
│ server       │     │  /api → REST         │     │  /api → Express  │
│              │     │  /socket.io → WS     │     │  /socket.io → IO │
└──────────────┘     └──────────────────────┘     └──────────────────┘
```

### Serving the Web App from maestro-server

Add static file serving to `maestro-server/src/server.ts`:

```typescript
import express from 'express';
import path from 'path';

// Serve web app static files
const webAppDir = path.resolve(__dirname, '../../maestro-ui/dist-web');
app.use(express.static(webAppDir));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(webAppDir, 'index.html'));
});
```

This means:
- `https://maestro.yourdomain.com/` → serves the React web app
- `https://maestro.yourdomain.com/api/*` → REST API (existing)
- `https://maestro.yourdomain.com/socket.io/*` → Socket.IO (Phase 2)

**No separate web server needed.** The web app is served by the same maestro-server that handles API requests.

## Files to Create/Modify

### New Files (in maestro-ui)

| File | Description |
|---|---|
| `src/WebApp.tsx` | Web-specific app shell (no terminal, responsive layout) |
| `src/web-main.tsx` | Web entry point |
| `src/components/web/SessionStatusGrid.tsx` | Session cards showing status (replaces terminal) |
| `src/components/web/MobileLayout.tsx` | Responsive layout wrapper |
| `src/components/web/SessionStatusCard.tsx` | Individual session status view |
| `src/services/sessionService.web.ts` | Stubbed session service (no PTY) |
| `src/stores/initApp.web.ts` | Web-specific initialization |
| `vite.config.web.ts` | Web build config |
| `index.web.html` | Web entry HTML (no Tauri script tags) |

### Modified Files

| File | Change |
|---|---|
| `maestro-server/src/server.ts` | Add `express.static()` for web app + SPA fallback |
| `maestro-ui/package.json` | Add `dev:web` and `build:web` scripts |
| `maestro-ui/tsconfig.json` | Add `__IS_WEB__` / `__IS_TAURI__` type declarations |

### Unchanged Files (reused as-is)

All Maestro components, stores, hooks, utilities, and the REST/WebSocket client layer — reused without modification.

## Build & Deploy Flow

```bash
# Development (phone on same network)
cd maestro-ui
npm run dev:web                    # Starts Vite at localhost:5174
# Phone connects to http://<your-ip>:5174

# Production (via Cloudflare)
cd maestro-ui
npm run build:web                  # Outputs to dist-web/
# maestro-server serves dist-web/ at /

# Start everything
cd maestro-server
bun run src/server.ts              # Serves API + web app on :3000
cloudflared tunnel run maestro     # Exposes to internet
# Phone opens https://maestro.yourdomain.com
```

## Phase Timeline

| Step | Effort | Dependencies |
|---|---|---|
| Create `vite.config.web.ts` + build scripts | 30 min | None |
| Create `WebApp.tsx` + `web-main.tsx` | 1-2 hours | None |
| Stub Tauri services for web | 1 hour | None |
| Create `SessionStatusGrid` (replaces terminal) | 2-3 hours | None |
| Add responsive CSS for phone | 2-3 hours | WebApp.tsx |
| Serve static files from maestro-server | 30 min | build:web output |
| Cloudflare Tunnel setup | 30 min | Server running |
| **Total** | **~1 day** | |

## Future: Adding Terminal to Web App

If you ever want terminal support in the web app (Phase 2, not initial launch), add a server-side PTY backend:

1. Add `node-pty` to maestro-server
2. Create WebSocket channel per terminal session
3. Agent spawn creates PTY on server, streams output to browser via WebSocket
4. `SessionTerminal.tsx` connects to server WS instead of Tauri `invoke()`

This is essentially building a lightweight [ttyd](https://github.com/nicehashttps://github.com/nicehash/ttyd)/[code-server](https://github.com/coder/code-server) inside maestro-server. Estimated effort: 2-3 days.
