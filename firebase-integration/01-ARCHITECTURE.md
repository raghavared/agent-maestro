# Architecture

## System Overview

```
┌────────────────────┐     ┌────────────────────┐
│   Desktop (Tauri)  │     │   Phone (Capacitor) │
│                    │     │                     │
│  ┌──────────────┐  │     │  ┌──────────────┐   │
│  │  React App   │  │     │  │  React App   │   │
│  │  (shared)    │  │     │  │  (shared)    │   │
│  └──────┬───────┘  │     │  └──────┬───────┘   │
│         │          │     │         │            │
│  ┌──────┴───────┐  │     │  ┌──────┴───────┐   │
│  │ Firebase SDK │  │     │  │ Firebase SDK │   │
│  └──────┬───────┘  │     │  └──────┬───────┘   │
└─────────┼──────────┘     └─────────┼────────────┘
          │                          │
          └──────────┬───────────────┘
                     │
        ┌────────────▼────────────────┐
        │        Firebase             │
        │                             │
        │  ┌─────────┐ ┌──────────┐  │
        │  │Firestore│ │   RTDB   │  │
        │  │         │ │          │  │
        │  │ tasks   │ │ presence │  │
        │  │sessions │ │ live out │  │
        │  │projects │ │ status   │  │
        │  └─────────┘ └──────────┘  │
        │                             │
        │  ┌─────────┐ ┌──────────┐  │
        │  │  Auth   │ │ Storage  │  │
        │  └─────────┘ └──────────┘  │
        │                             │
        │  ┌─────────────────────┐   │
        │  │  Cloud Functions    │   │
        │  │  (when needed)      │   │
        │  └─────────────────────┘   │
        └─────────────────────────────┘
```

## Data Flow

### Writes

```
User action
  → Zustand store dispatch
    → Firebase SDK write (local cache first)
      → Firestore/RTDB persists
        → Other devices receive via listener
```

Every write hits local cache immediately. The UI updates before the network round-trip completes. Firebase handles sync, retry, and conflict resolution.

### Reads

```
Component mounts
  → useFirestore hook subscribes
    → Firestore listener fires with cached data (instant)
    → Firestore listener fires again with server data (if different)
      → Zustand store updates
        → Component re-renders
```

First paint always uses cached data. Server data arrives asynchronously.

### Real-time Updates

Two channels, two purposes:

**Firestore listeners** -- for document changes (tasks, sessions, projects). Latency: 100-500ms. Perfect for CRUD operations.

**RTDB listeners** -- for high-frequency data (session status, terminal output, presence). Latency: 10-50ms. Perfect for live monitoring.

```
Session working on desktop
  → CLI writes status to RTDB every heartbeat
    → Phone receives status update in ~20ms
      → User sees live session activity on phone
```

## Layer Diagram

```
┌─────────────────────────────────────────────────┐
│  UI Layer (React Components)                     │
│  - TaskList, SessionView, ProjectBrowser         │
│  - Same components on desktop and phone          │
├─────────────────────────────────────────────────┤
│  Hook Layer (React Hooks)                        │
│  - useTasks(projectId)                           │
│  - useSessions(projectId)                        │
│  - useSessionStatus(sessionId)  // RTDB          │
│  - usePresence(userId)          // RTDB          │
├─────────────────────────────────────────────────┤
│  Store Layer (Zustand)                           │
│  - useProjectStore                               │
│  - useMaestroStore (tasks + sessions cache)      │
│  - useAuthStore                                  │
├─────────────────────────────────────────────────┤
│  Service Layer (Firebase SDK)                    │
│  - FirestoreService (documents)                  │
│  - RealtimeService (live data)                   │
│  - AuthService (identity)                        │
│  - StorageService (files)                        │
├─────────────────────────────────────────────────┤
│  Firebase SDK + Offline Cache                    │
│  - IndexedDB persistence (Firestore)             │
│  - Local cache (RTDB)                            │
└─────────────────────────────────────────────────┘
```

## CLI Architecture

The CLI still runs locally on the desktop machine (it spawns Claude sessions). But it talks to Firebase instead of the local Express server.

```
CLI command
  → Firebase SDK (with service account or user token)
    → Firestore/RTDB read/write
      → Desktop and phone see updates in real-time
```

The CLI uses the Firebase Admin SDK or client SDK with cached auth tokens. Session spawning remains local (child_process.spawn), but all state writes go to Firebase.

```
┌──────────────────────────────────┐
│  Desktop Machine                  │
│                                   │
│  ┌───────────┐  ┌─────────────┐  │
│  │  Tauri UI  │  │  CLI + Agent│  │
│  │  (React)   │  │  (Claude)   │  │
│  └─────┬──────┘  └──────┬──────┘  │
│        │                 │         │
│        │  Firebase SDK   │         │
│        └────────┬────────┘         │
└─────────────────┼──────────────────┘
                  │
                  ▼
             Firebase Cloud
```

## What Disappears

- **Express server** -- Firebase replaces it
- **WebSocket bridge** -- Firestore/RTDB listeners replace it
- **InMemoryEventBus** -- Firestore triggers replace it
- **FileSystem repositories** -- Firestore repositories replace them
- **Local JSON files** -- Firestore documents replace them
- **Manual CORS config** -- Firebase handles it

## What Remains (Optional)

The Express server can remain as a **self-hosted mode** for users who don't want Firebase. The repository interface pattern makes this clean:

```typescript
interface ITaskRepository {
  create(task: Task): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  // ... same interface
}

// Two implementations:
class FirestoreTaskRepository implements ITaskRepository { ... }
class FileSystemTaskRepository implements ITaskRepository { ... }  // legacy
```
