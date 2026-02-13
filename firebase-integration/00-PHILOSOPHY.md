# Philosophy

## Why Firebase

Maestro today: a local server, JSON files on disk, one machine.

Maestro tomorrow: your agents follow you. Desktop to phone. Office to train. Online to airplane mode. One truth, always.

Firebase gives us this without building a backend. No servers to maintain. No databases to scale. No WebSocket infrastructure to debug at 3am.

## Design Principles

**1. Firebase is the backend.**
The Express server disappears. Firebase replaces it entirely. Firestore is the database. RTDB is the real-time bus. Auth is the identity layer. Cloud Functions handle what needs server logic. The desktop app talks directly to Firebase. So does the phone.

**2. Offline-first, always.**
Every write goes to the local cache first. Firestore's offline persistence handles the rest. The user never waits for a network round-trip. When connectivity returns, Firebase reconciles. The app feels instant because it is.

**3. One codebase, two surfaces.**
React code is shared between desktop and mobile. Tauri wraps it for desktop. Capacitor (or React Native) wraps it for phone. The Firebase service layer is identical. Hooks are identical. State management is identical. Only the shell changes.

**4. Minimal surface area.**
We use four Firebase services. Not seven. Not twelve. Four:
- **Firestore** -- documents, tasks, sessions, projects
- **Realtime Database** -- live session status, terminal output, presence
- **Auth** -- identity
- **Storage** -- files, recordings, context docs

Cloud Functions only where truly needed (cleanup, notifications, billing triggers).

**5. The server becomes optional.**
For users who want to self-host, the Express server still works. For cloud users, Firebase is the only dependency. The repository interface stays the same. The implementation swaps.

**6. Data belongs to the user.**
Firebase project per user (or per team). Data never touches our servers. We provide the app, they provide the Firebase project. For managed service: we host the Firebase project, they trust us with their data.

## What Changes

| Before | After |
|--------|-------|
| Express server required | Firebase SDK direct |
| JSON files on disk | Firestore documents |
| WebSocket for real-time | Firestore listeners + RTDB |
| Single machine only | Any device, anywhere |
| No auth | Firebase Auth |
| No offline writes | Full offline support |
| No phone | Phone app shares code |

## What Stays

- Zustand stores (they just subscribe to Firebase instead of WebSocket)
- React components (they just render data from new hooks)
- CLI tool (it uses Firebase SDK instead of REST calls)
- Repository interface pattern (new Firebase implementations)
- Domain events concept (Firestore triggers replace in-memory events)
- Task/Session/Project models (minor adaptations)
