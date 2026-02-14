# Migration Plan

## Overview

Three phases. Each phase is independently deployable. No big bang.

```
Phase 1: Add Firebase alongside existing server (dual-write)
Phase 2: Firebase becomes primary, server becomes fallback
Phase 3: Server removed (or kept for self-hosted mode)
```

---

## Phase 1: Foundation (Week 1-2)

### Step 1: Firebase Project Setup

```bash
npm install -g firebase-tools
firebase login
firebase init
# Select: Firestore, Realtime Database, Storage, Auth, Hosting
# Choose region closest to primary users
```

Create `.env` files:
```bash
# maestro-ui/.env.local
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_URL=...
```

### Step 2: Create Shared Firebase Package

```
packages/
  maestro-firebase/
    src/
      config.ts           # Firebase initialization
      types.ts            # Shared types (reuse from server)
      firestore.ts        # Firestore operations
      realtime.ts         # RTDB operations
      auth.ts             # Auth operations
      storage.ts          # Storage operations
      hooks/
        useTasks.ts       # React hook for tasks
        useSessions.ts    # React hook for sessions
        usePresence.ts    # React hook for presence
        useAuth.ts        # React hook for auth
    package.json
    tsconfig.json
```

### Step 3: Implement Firebase Service Layer

```typescript
// packages/maestro-firebase/src/config.ts
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

### Step 4: Implement Repository Interfaces for Firebase

Create Firebase implementations of existing repository interfaces:

```typescript
// packages/maestro-firebase/src/repositories/FirestoreTaskRepository.ts
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
         query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../config';

export class FirestoreTaskRepository {
  private collectionPath(projectId: string) {
    return `projects/${projectId}/tasks`;
  }

  async create(projectId: string, task: Omit<Task, 'id'>): Promise<Task> {
    const ref = doc(collection(db, this.collectionPath(projectId)));
    const data = {
      ...task,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, data);
    return { id: ref.id, ...task };
  }

  async findById(projectId: string, taskId: string): Promise<Task | null> {
    const snap = await getDoc(doc(db, this.collectionPath(projectId), taskId));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Task : null;
  }

  async findByProjectId(projectId: string): Promise<Task[]> {
    const snap = await getDocs(collection(db, this.collectionPath(projectId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Task);
  }

  async update(projectId: string, taskId: string, updates: Partial<Task>): Promise<void> {
    await updateDoc(doc(db, this.collectionPath(projectId), taskId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  async delete(projectId: string, taskId: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionPath(projectId), taskId));
  }

  subscribe(projectId: string, callback: (tasks: Task[]) => void): () => void {
    const q = query(
      collection(db, this.collectionPath(projectId)),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Task));
    });
  }
}
```

Similar implementations for `FirestoreSessionRepository`, `FirestoreProjectRepository`, `FirestoreQueueRepository`.

### Step 5: Deploy Security Rules

```bash
firebase deploy --only firestore:rules
firebase deploy --only database
firebase deploy --only storage
```

---

## Phase 2: Integration (Week 3-4)

### Step 6: Add Auth to Desktop App

```typescript
// maestro-ui/src/stores/useAuthStore.ts
import { create } from 'zustand';
import { auth } from 'maestro-firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface AuthStore {
  user: User | null;
  loading: boolean;
  isOnline: boolean;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  isOnline: true,

  initialize: () => {
    return onAuthStateChanged(auth, (user) => {
      set({ user, loading: false });
    });
  }
}));
```

### Step 7: Replace WebSocket with Firestore Listeners

Current:
```typescript
// Old: WebSocket receives task updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'task:updated') {
    updateTaskInStore(data.payload);
  }
};
```

New:
```typescript
// New: Firestore listener receives task updates
const unsubscribe = onSnapshot(
  collection(db, `projects/${projectId}/tasks`),
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'modified') {
        updateTaskInStore({ id: change.doc.id, ...change.doc.data() });
      }
    });
  }
);
```

### Step 8: Replace REST Client with Firebase SDK

Current:
```typescript
// Old: REST call
const task = await maestroClient.createTask(projectId, taskData);
```

New:
```typescript
// New: Direct Firestore write
const task = await firestoreTaskRepo.create(projectId, taskData);
```

### Step 9: Update Zustand Stores

Replace the data-fetching logic in stores. Keep the same store interface so components don't change.

```typescript
// maestro-ui/src/stores/useMaestroStore.ts
export const useMaestroStore = create<MaestroStore>((set, get) => ({
  tasks: new Map(),
  sessions: new Map(),

  // Replace REST + WebSocket init with Firestore subscriptions
  subscribeToProject: (projectId: string) => {
    const unsubTasks = firestoreTaskRepo.subscribe(projectId, (tasks) => {
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      set({ tasks: taskMap });
    });

    const unsubSessions = firestoreSessionRepo.subscribe(projectId, (sessions) => {
      const sessionMap = new Map(sessions.map(s => [s.id, s]));
      set({ sessions: sessionMap });
    });

    return () => { unsubTasks(); unsubSessions(); };
  }
}));
```

### Step 10: Update CLI to Use Firebase

```typescript
// maestro-cli/src/firebase-client.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDatabase, ref, set } from 'firebase/database';

// CLI initializes Firebase with stored auth token
const app = initializeApp(config);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Session status update (was: REST PATCH)
export async function updateSessionStatus(sessionId: string, status: string) {
  // Firestore: durable state
  await updateDoc(doc(db, 'sessions', sessionId), {
    status,
    lastActivity: serverTimestamp()
  });

  // RTDB: real-time state
  await set(ref(rtdb, `sessions/${sessionId}`), {
    status,
    lastHeartbeat: Date.now()
  });
}
```

---

## Phase 3: Cleanup (Week 5-6)

### Step 11: Remove Express Server Dependency

- Remove WebSocket connection from UI
- Remove REST client (`MaestroClient.ts`)
- Remove `maestro-server` from required startup
- Keep `maestro-server` as optional self-hosted mode

### Step 12: Data Migration Tool

For existing users with local data:

```typescript
// scripts/migrate-to-firebase.ts
import { readFileSync, readdirSync } from 'fs';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../packages/maestro-firebase/src/config';

async function migrate(dataDir: string, userId: string) {
  // Migrate projects
  const projectFiles = readdirSync(`${dataDir}/projects`);
  for (const file of projectFiles) {
    const project = JSON.parse(readFileSync(`${dataDir}/projects/${file}`, 'utf-8'));
    await setDoc(doc(db, 'projects', project.id), {
      ...project,
      ownerId: userId,
      members: [userId],
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt)
    });

    // Migrate tasks for this project
    const taskDir = `${dataDir}/tasks/${project.id}`;
    const taskFiles = readdirSync(taskDir);
    for (const taskFile of taskFiles) {
      const task = JSON.parse(readFileSync(`${taskDir}/${taskFile}`, 'utf-8'));
      await setDoc(
        doc(db, `projects/${project.id}/tasks`, task.id),
        {
          ...task,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt)
        }
      );
    }
  }

  // Migrate sessions
  const sessionFiles = readdirSync(`${dataDir}/sessions`);
  for (const file of sessionFiles) {
    const session = JSON.parse(readFileSync(`${dataDir}/sessions/${file}`, 'utf-8'));
    await setDoc(doc(db, 'sessions', session.id), {
      ...session,
      userId,
      startedAt: new Date(session.startedAt),
      lastActivity: new Date(session.lastActivity)
    });
  }

  console.log('Migration complete.');
}
```

### Step 13: Verify & Test

- All existing UI functionality works without Express server
- Tasks CRUD from desktop and (future) phone
- Session monitoring via RTDB
- Offline create/edit tasks, sync on reconnect
- Auth flow on desktop
- CLI writes propagate to UI in real-time

---

## Migration Checklist

### Phase 1: Foundation
- [ ] Firebase project created
- [ ] Services enabled (Firestore, RTDB, Auth, Storage)
- [ ] `maestro-firebase` package created
- [ ] Firebase config with env vars
- [ ] Firestore repositories implemented
- [ ] RTDB service implemented
- [ ] Security rules deployed
- [ ] Offline persistence enabled

### Phase 2: Integration
- [ ] Auth store and login UI
- [ ] Firestore listeners replace WebSocket
- [ ] Firebase SDK replaces REST client
- [ ] Zustand stores updated
- [ ] CLI uses Firebase SDK
- [ ] Auth token sharing (desktop → CLI)

### Phase 3: Cleanup
- [ ] Express server made optional
- [ ] Migration script for existing data
- [ ] E2E tests passing without server
- [ ] Documentation updated

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Firebase outage | Offline persistence keeps app functional |
| Migration breaks existing users | Dual-write phase ensures no data loss |
| CLI auth complexity | Start with simple token file approach |
| Firestore query limitations | Design data model around query patterns |
| Cost surprises | Set Firebase budget alerts, monitor usage |
