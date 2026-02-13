# Cloud Functions

## Philosophy

Cloud Functions are the exception, not the rule. Most operations happen client-side through Firebase SDK. Functions exist only where client-side execution is insufficient.

## When to Use Cloud Functions

| Use Case | Why Not Client-Side |
|----------|-------------------|
| Cleanup stale sessions | No client is guaranteed to be online |
| Push notifications | Requires server-side FCM access |
| Usage metering (billing) | Must be tamper-proof |
| Data aggregation | Cross-document operations need atomicity |
| Webhook receivers | External services call our endpoint |

## Functions

### 1. Session Cleanup

Sessions that crash leave stale RTDB entries. A scheduled function cleans them up.

```typescript
// functions/src/cleanup.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Run every 15 minutes
export const cleanupStaleSessions = functions.scheduler
  .every(15, 'minutes')
  .onRun(async () => {
    const rtdb = admin.database();
    const firestore = admin.firestore();
    const staleThreshold = Date.now() - 5 * 60 * 1000; // 5 min no heartbeat

    const sessionsSnap = await rtdb.ref('sessions').once('value');
    const sessions = sessionsSnap.val() || {};

    for (const [sessionId, data] of Object.entries(sessions)) {
      const session = data as any;
      if (session.status === 'working' && session.lastHeartbeat < staleThreshold) {
        // Mark as failed in Firestore
        await firestore.doc(`sessions/${sessionId}`).update({
          status: 'failed',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Clean up RTDB
        await rtdb.ref(`sessions/${sessionId}`).update({
          status: 'failed',
          lastHeartbeat: Date.now()
        });

        console.log(`Cleaned up stale session: ${sessionId}`);
      }
    }
  });
```

### 2. Push Notifications

Notify phone when important events happen on desktop.

```typescript
// functions/src/notifications.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Session needs input -- alert the user's phone
export const onSessionNeedsInput = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before.needsInput?.active && after.needsInput?.active) {
      await sendPush(after.userId, {
        title: 'Agent Needs Input',
        body: after.needsInput.message || 'A session is waiting for your response.',
        data: { sessionId: context.params.sessionId, type: 'needs_input' }
      });
    }
  });

// Task completed
export const onTaskCompleted = functions.firestore
  .document('projects/{projectId}/tasks/{taskId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== 'completed' && after.status === 'completed') {
      const project = await admin.firestore().doc(`projects/${context.params.projectId}`).get();
      const ownerId = project.data()?.ownerId;

      if (ownerId) {
        await sendPush(ownerId, {
          title: 'Task Complete',
          body: `"${after.title}" is done.`,
          data: { taskId: context.params.taskId, type: 'task_completed' }
        });
      }
    }
  });

async function sendPush(userId: string, notification: { title: string; body: string; data: Record<string, string> }) {
  const userDoc = await admin.firestore().doc(`users/${userId}`).get();
  const tokens = userDoc.data()?.fcmTokens || [];

  if (tokens.length === 0) return;

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: notification.title, body: notification.body },
    data: notification.data
  });
}
```

### 3. User Cleanup on Account Delete

```typescript
// functions/src/userLifecycle.ts
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const firestore = admin.firestore();
  const rtdb = admin.database();
  const storage = admin.storage();

  // Delete user document
  await firestore.doc(`users/${user.uid}`).delete();

  // Delete user's projects and their tasks
  const projects = await firestore.collection('projects')
    .where('ownerId', '==', user.uid).get();

  for (const project of projects.docs) {
    // Delete all tasks in project
    const tasks = await project.ref.collection('tasks').get();
    const batch = firestore.batch();
    tasks.docs.forEach(task => batch.delete(task.ref));
    await batch.commit();

    // Delete project
    await project.ref.delete();
  }

  // Delete user's sessions
  const sessions = await firestore.collection('sessions')
    .where('userId', '==', user.uid).get();
  const batch = firestore.batch();
  sessions.docs.forEach(s => batch.delete(s.ref));
  await batch.commit();

  // Clean up RTDB
  await rtdb.ref(`presence/${user.uid}`).remove();

  // Clean up Storage
  await storage.bucket().deleteFiles({ prefix: `users/${user.uid}/` });
});
```

### 4. Usage Metering (for billing, future)

```typescript
// functions/src/metering.ts
export const trackSessionUsage = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // Session just completed -- record duration
    if (before.status === 'working' && after.status === 'completed') {
      const duration = after.completedAt.toMillis() - after.startedAt.toMillis();
      const hours = duration / (1000 * 60 * 60);

      await admin.firestore()
        .collection(`users/${after.userId}/usage`)
        .add({
          sessionId: change.after.id,
          type: 'session',
          hours,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
  });
```

## Deployment

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## Cost

Cloud Functions pricing (pay per invocation):
- First 2M invocations/month: free
- After: $0.40 per million invocations
- Compute time: $0.0000025 per GB-second

For Maestro's usage patterns, Cloud Functions will cost ~$0-5/month for thousands of users. The scheduled cleanup function runs 96 times/day. Notification triggers fire per-event. Both are well within free tier.
