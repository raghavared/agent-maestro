# Sync Engine

## The Promise

Write anywhere. Read everywhere. Never lose data. Never wait.

## How Firestore Offline Works

Firestore has built-in offline persistence. When you enable it:

1. Every write goes to **local IndexedDB first**
2. The UI updates **immediately** from local cache
3. Firebase SDK syncs to server **in the background**
4. If offline, writes queue up and flush when connectivity returns
5. Other devices receive updates via their active listeners

```typescript
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()  // works across tabs
  })
});
```

That's it. Offline support is a configuration option, not an architecture.

## Sync Patterns

### Pattern 1: Optimistic Writes (Tasks, Sessions, Projects)

```typescript
// User creates a task on the phone while on a plane
const taskRef = doc(collection(db, `projects/${projectId}/tasks`));
await setDoc(taskRef, {
  title: "Fix auth bug",
  status: "todo",
  createdAt: serverTimestamp(),  // resolves when online
  updatedAt: serverTimestamp()
});

// The task appears instantly in the phone UI (from local cache)
// When the plane lands, Firebase syncs to server
// Desktop sees the new task via its Firestore listener
```

No special code. No conflict resolution. No retry logic. Firestore handles it.

### Pattern 2: Real-time Listeners (Live Updates)

```typescript
// Phone subscribes to project tasks
const q = query(
  collection(db, `projects/${projectId}/tasks`),
  orderBy('updatedAt', 'desc')
);

const unsubscribe = onSnapshot(q, (snapshot) => {
  // First call: data from local cache (instant)
  // Subsequent calls: live updates from server
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') handleNewTask(change.doc);
    if (change.type === 'modified') handleUpdatedTask(change.doc);
    if (change.type === 'removed') handleRemovedTask(change.doc);
  });
});
```

### Pattern 3: RTDB for Live Session Monitoring

```typescript
// Phone watches a running session's output
const outputRef = ref(rtdb, `sessions/${sessionId}/liveOutput`);

onValue(outputRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    updateTerminalDisplay(data.lines);
  }
});
```

RTDB doesn't have offline persistence like Firestore. That's fine -- live terminal output is ephemeral. If you're offline, there's nothing live to see.

### Pattern 4: Presence with RTDB

```typescript
// Desktop marks user as online
const myPresenceRef = ref(rtdb, `presence/${userId}`);
const connectedRef = ref(rtdb, '.info/connected');

onValue(connectedRef, (snapshot) => {
  if (snapshot.val() === true) {
    // Connected: mark online
    set(myPresenceRef, {
      online: true,
      lastSeen: serverTimestamp(),
      activeDevice: 'desktop'
    });

    // When disconnected: automatically mark offline
    onDisconnect(myPresenceRef).set({
      online: false,
      lastSeen: serverTimestamp()
    });
  }
});
```

## Conflict Resolution

### What could conflict?

Two devices editing the same task at the same time. Rare, but possible.

### Firestore's approach: last write wins

For most fields, this is correct. If you change a task's status on your phone and your desktop changes the title, both writes succeed -- they're different fields.

For same-field conflicts, last write wins. This is acceptable because:
- Maestro is single-user (or small team) -- conflicts are rare
- Most writes are additive (create task, update status, add timeline event)
- Destructive operations (delete) require confirmation

### Where we need care

**Session status updates from CLI:**

The CLI updates session status frequently. The phone should only *read* session status, never write it. This eliminates conflicts.

```
CLI (desktop)  →  writes session status  →  Firebase
Phone          ←  reads session status   ←  Firebase
```

**Task status updates:**

Both phone and desktop can update task status. We use `updateDoc` with specific field paths, not full document overwrites:

```typescript
// Good: only updates the specific field
await updateDoc(taskRef, {
  status: 'completed',
  completedAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

// Bad: overwrites entire document
await setDoc(taskRef, entireTaskObject);
```

### Timeline events: append-only

Timeline events are subcollection documents. Each event is a separate document. No conflicts possible -- you can only add, never modify.

```typescript
// Adding a timeline event -- always safe, never conflicts
await addDoc(collection(db, `sessions/${sessionId}/timeline`), {
  type: 'progress',
  message: 'Tests passing',
  createdAt: serverTimestamp()
});
```

## Connectivity States

The app needs to communicate connectivity to the user:

```typescript
// Firestore connectivity
import { enableNetwork, disableNetwork } from 'firebase/firestore';

// RTDB connectivity (automatic)
const connectedRef = ref(rtdb, '.info/connected');
onValue(connectedRef, (snap) => {
  const isOnline = snap.val() === true;
  useAuthStore.setState({ isOnline });
});
```

### UI States

| State | Indicator | Behavior |
|-------|-----------|----------|
| Online | Green dot | Real-time sync active |
| Offline | Yellow dot | Local writes queued |
| Syncing | Spinning | Pending writes being flushed |
| Error | Red dot | Auth expired or quota exceeded |

## Bandwidth Optimization

### Desktop (always on, high bandwidth)
- Full Firestore listeners on active project
- RTDB listeners on all active sessions
- No restrictions

### Phone (intermittent, limited bandwidth)
- Firestore listeners only on viewed screen
- RTDB listeners only on actively monitored session
- Unsubscribe when screen is backgrounded
- Limit timeline queries to last 50 events

```typescript
// Phone: efficient query
const recentTimeline = query(
  collection(db, `sessions/${sessionId}/timeline`),
  orderBy('createdAt', 'desc'),
  limit(50)
);
```

### CLI (background process)
- Writes only, minimal reads
- No Firestore listeners (unnecessary overhead)
- RTDB writes for heartbeat and live output
- Read task data once at session start, cache locally

## Testing Offline Behavior

```typescript
// Simulate offline in development
import { disableNetwork, enableNetwork } from 'firebase/firestore';

// Go offline
await disableNetwork(db);
// ... make writes (queued locally)
// ... verify UI updates from cache

// Come back online
await enableNetwork(db);
// ... verify writes sync to server
// ... verify listeners fire with server data
```
