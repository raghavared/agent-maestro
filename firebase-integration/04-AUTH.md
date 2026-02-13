# Authentication & Security

## Auth Strategy

Firebase Auth handles identity. Simple email/password to start. Google and GitHub OAuth when ready.

### Sign-in Flow

```
App opens
  → Check Firebase Auth state
    → Signed in?  → Load projects, show dashboard
    → Not signed in?  → Show login screen
```

```typescript
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    initializeApp(user.uid);
  } else {
    // Show auth screen
    showLoginScreen();
  }
});
```

### Auth Providers (phased)

**Phase 1:** Email/password only. Simple. Works.
**Phase 2:** Add Google sign-in. One-tap on mobile.
**Phase 3:** Add GitHub sign-in. Developers love it.

### CLI Authentication

The CLI runs in a terminal. No browser popup. Two options:

**Option A: Token file (simple)**
```
1. User signs in via desktop app
2. App writes auth token to ~/.maestro/auth-token
3. CLI reads token, uses it for Firebase calls
4. Token auto-refreshes via Firebase SDK
```

**Option B: Device code flow (secure)**
```
1. CLI prints: "Visit https://maestro.app/auth and enter code: ABCD-1234"
2. User visits URL, signs in, enters code
3. CLI receives token via Firebase
4. Token stored securely in keychain
```

Option A for MVP. Option B for production.

---

## Security Rules

### Firestore Rules

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ──
    function authed() {
      return request.auth != null;
    }

    function isUser(uid) {
      return authed() && request.auth.uid == uid;
    }

    function isProjectMember(projectId) {
      let project = get(/databases/$(database)/documents/projects/$(projectId));
      return authed() && (
        request.auth.uid == project.data.ownerId ||
        request.auth.uid in project.data.members
      );
    }

    function isProjectOwner(projectId) {
      let project = get(/databases/$(database)/documents/projects/$(projectId));
      return authed() && request.auth.uid == project.data.ownerId;
    }

    // ── Users ──
    match /users/{userId} {
      allow read: if isUser(userId);
      allow create: if isUser(userId);
      allow update: if isUser(userId);
      allow delete: if false;
    }

    // ── Projects ──
    match /projects/{projectId} {
      allow read: if isProjectMember(projectId);
      allow create: if authed() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isProjectOwner(projectId);
      allow delete: if isProjectOwner(projectId);

      // ── Tasks (scoped to project) ──
      match /tasks/{taskId} {
        allow read: if isProjectMember(projectId);
        allow create: if isProjectMember(projectId);
        allow update: if isProjectMember(projectId);
        allow delete: if isProjectMember(projectId);
      }
    }

    // ── Sessions ──
    match /sessions/{sessionId} {
      allow read: if authed() && resource.data.userId == request.auth.uid;
      allow create: if authed() && request.resource.data.userId == request.auth.uid;
      allow update: if authed() && resource.data.userId == request.auth.uid;
      allow delete: if authed() && resource.data.userId == request.auth.uid;

      // ── Timeline (append-only) ──
      match /timeline/{eventId} {
        allow read: if authed() &&
          get(/databases/$(database)/documents/sessions/$(sessionId)).data.userId == request.auth.uid;
        allow create: if authed() &&
          get(/databases/$(database)/documents/sessions/$(sessionId)).data.userId == request.auth.uid;
        allow update, delete: if false;  // immutable
      }

      // ── Docs ──
      match /docs/{docId} {
        allow read: if authed() &&
          get(/databases/$(database)/documents/sessions/$(sessionId)).data.userId == request.auth.uid;
        allow create: if authed() &&
          get(/databases/$(database)/documents/sessions/$(sessionId)).data.userId == request.auth.uid;
        allow delete: if authed() &&
          get(/databases/$(database)/documents/sessions/$(sessionId)).data.userId == request.auth.uid;
        allow update: if false;  // immutable
      }

      // ── Queue ──
      match /queue/{queueId} {
        allow read, write: if authed() &&
          get(/databases/$(database)/documents/sessions/$(sessionId)).data.userId == request.auth.uid;
      }
    }
  }
}
```

### RTDB Rules

```json
{
  "rules": {
    "sessions": {
      "$sessionId": {
        ".read": "auth != null && data.child('userId').val() === auth.uid",
        ".write": "auth != null && data.child('userId').val() === auth.uid"
      }
    },
    "presence": {
      "$userId": {
        ".read": true,
        ".write": "$userId === auth.uid"
      }
    }
  }
}
```

### Storage Rules

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    function authed() {
      return request.auth != null;
    }

    function maxSize(mb) {
      return request.resource.size < mb * 1024 * 1024;
    }

    // User files
    match /users/{userId}/{allPaths=**} {
      allow read: if authed() && request.auth.uid == userId;
      allow write: if authed() && request.auth.uid == userId && maxSize(50);
    }

    // Project files -- any member can read/write
    match /projects/{projectId}/{allPaths=**} {
      allow read: if authed();
      allow write: if authed() && maxSize(100);
    }
  }
}
```

---

## Security Considerations

### Data Isolation

Every query is scoped by `userId` or project membership. One user cannot see another's data. This is enforced at the Firebase level, not the app level.

### Token Management

- Firebase Auth tokens expire after 1 hour
- SDK auto-refreshes tokens silently
- On sign-out, local cache is cleared
- Offline tokens remain valid for up to 14 days

### Sensitive Data

Environment variables (`session.env`) may contain secrets. Options:
1. **Don't sync env vars to Firebase** -- keep them local
2. **Encrypt env vars** before writing to Firestore
3. **Use Firebase App Check** to prevent unauthorized API access

Recommendation: Don't sync env vars. They're machine-specific anyway.

### Rate Limiting

Firebase has built-in rate limiting. For additional protection:
- Cloud Functions can enforce per-user write limits
- Security rules can validate field values and document sizes
- App Check prevents abuse from non-app clients
