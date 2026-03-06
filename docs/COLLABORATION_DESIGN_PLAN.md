# Maestro Collaboration Feature — Design Plan

## Overview

Add collaboration capabilities to Maestro, allowing users to optionally sign in via Firebase, share tasks across projects, and work together through a lightweight task-sharing model. The local-first architecture remains unchanged — collaboration is an additive layer backed by Firebase Auth + Firestore.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Maestro UI (Tauri)                     │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Local     │  │ Collaboration│  │ Firebase Auth      │ │
│  │ Features  │  │ Dashboard    │  │ (optional login)   │ │
│  │ (as-is)   │  │ (new)        │  │                    │ │
│  └─────┬─────┘  └──────┬───────┘  └────────┬───────────┘ │
│        │               │                    │             │
│        ▼               ▼                    ▼             │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Maestro  │  │ Firestore    │  │ Firebase Auth      │ │
│  │ Server   │  │ SDK          │  │ SDK                │ │
│  │ (local)  │  │ (client-side)│  │ (client-side)      │ │
│  └──────────┘  └──────────────┘  └────────────────────┘ │
│        │               │                    │             │
└────────┼───────────────┼────────────────────┼─────────────┘
         │               │                    │
         ▼               ▼                    ▼
   Local Filesystem    Firestore           Firebase Auth
   (~/.maestro/data)   (cloud)             (cloud)
```

**Key principle**: Firebase SDK lives in the **UI layer only** (client-side). The maestro-server remains a local-only server with no Firebase dependency. All Firestore reads/writes happen directly from the Tauri/React app.

---

## 2. Firebase Auth Integration

### 2.1 Auth Providers
- Google Sign-In (primary)
- GitHub Sign-In
- Email/Password (fallback)

### 2.2 Auth Flow
1. User clicks "Sign In" in the collaboration panel
2. Firebase Auth popup opens (Google/GitHub/Email)
3. On success, Firebase returns user profile + JWT
4. App stores auth state in a new Zustand store (`useAuthStore`)
5. Auth state persists across sessions via Firebase's `onAuthStateChanged`

### 2.3 Auth is Optional
- All existing local features work without login
- Collaboration panel shows "Sign in to collaborate" when not authenticated
- No auth required for local task management, sessions, teams, etc.

### 2.4 User Profile (Firestore: `users` collection)
```typescript
interface MaestroUser {
  uid: string;                  // Firebase UID
  email: string;
  displayName: string;
  photoURL: string | null;
  collaboratorCode: string;     // Unique 8-char alphanumeric code (e.g., "M-X7K9P2Q")
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

The `collaboratorCode` is generated on first sign-in, prefixed with `M-` for easy identification. Users can find/add collaborators by **email** or **collaborator code**.

---

## 3. Firestore Data Model

### 3.1 Collections

```
firestore/
├── users/                          # User profiles
│   └── {uid}                       # MaestroUser document
├── projects/                       # Collaborative projects
│   └── {projectId}/                # CollabProject document
│       ├── tasks/                  # Published tasks (subcollection)
│       │   └── {taskId}            # CollabTask document
│       │       └── comments/       # Task-level chat (subcollection)
│       │           └── {commentId} # Comment document
│       ├── members/                # Project collaborators (subcollection)
│       │   └── {uid}              # CollabMember document
│       └── chat/                   # Project-level chat (subcollection)
│           └── {messageId}         # ChatMessage document
```

### 3.2 Document Schemas

#### CollabProject
```typescript
interface CollabProject {
  id: string;                       // Same as local project ID
  name: string;
  description: string;
  ownerUid: string;                 // Firebase UID of project owner
  ownerName: string;
  ownerPhotoURL: string | null;
  memberCount: number;              // Denormalized count
  taskCount: number;                // Denormalized count
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### CollabMember (subcollection of project)
```typescript
interface CollabMember {
  uid: string;                      // Firebase UID
  email: string;
  displayName: string;
  photoURL: string | null;
  collaboratorCode: string;
  role: 'owner' | 'collaborator';   // Simple for now
  joinedAt: Timestamp;
}
```

#### CollabTask (subcollection of project)
```typescript
interface CollabTask {
  id: string;                       // Generated ID
  localTaskId: string;              // Original local task ID (for publisher's reference)
  projectId: string;                // Parent project ID
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  publisherUid: string;             // Who published this
  publisherName: string;
  publisherPhotoURL: string | null;

  // Subtasks (flattened, not a subcollection)
  subtasks: CollabSubtask[];

  // Docs (references)
  docs: CollabDoc[];

  // Metadata
  takenByCount: number;             // How many people have forked this
  commentCount: number;             // Denormalized
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CollabSubtask {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

interface CollabDoc {
  title: string;
  content: string;                  // Markdown content
}
```

#### Comment (subcollection of task)
```typescript
interface Comment {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;                  // Markdown text
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### ChatMessage (subcollection of project)
```typescript
interface ChatMessage {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  createdAt: Timestamp;
}
```

### 3.3 Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    // Projects: members can read, owner can write project doc
    match /projects/{projectId} {
      allow read: if request.auth != null &&
        exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid));
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
        resource.data.ownerUid == request.auth.uid;

      // Members: owner can manage, members can read
      match /members/{uid} {
        allow read: if request.auth != null &&
          exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid));
        allow write: if request.auth != null &&
          get(/databases/$(database)/documents/projects/$(projectId)).data.ownerUid == request.auth.uid;
      }

      // Tasks: members can read, publisher can write their own tasks
      match /tasks/{taskId} {
        allow read: if request.auth != null &&
          exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid));
        allow create: if request.auth != null &&
          exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid));
        allow update, delete: if request.auth != null &&
          resource.data.publisherUid == request.auth.uid;

        // Comments: any member can read/create, author can edit/delete
        match /comments/{commentId} {
          allow read: if request.auth != null &&
            exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid));
          allow create: if request.auth != null &&
            exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid));
          allow update, delete: if request.auth != null &&
            resource.data.authorUid == request.auth.uid;
        }
      }

      // Chat: any member can read/create
      match /chat/{messageId} {
        allow read, create: if request.auth != null &&
          exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid));
      }
    }
  }
}
```

---

## 4. Firestore Indexes

```
// Composite indexes needed:
// 1. projects/tasks - ordered by createdAt desc (default query)
// 2. projects/chat - ordered by createdAt asc (chronological)
// 3. projects/tasks/comments - ordered by createdAt asc
// 4. users - query by collaboratorCode
// 5. users - query by email
```

---

## 5. Frontend Architecture Changes

### 5.1 New Dependencies
```json
{
  "firebase": "^11.x",          // Firebase JS SDK (modular)
}
```

### 5.2 New Files Structure
```
maestro-ui/src/
├── firebase/
│   ├── config.ts               # Firebase app initialization
│   ├── auth.ts                 # Auth helpers (signIn, signOut, onAuthStateChanged)
│   └── firestore.ts            # Firestore helpers (CRUD for collab entities)
├── stores/
│   ├── useAuthStore.ts         # Auth state (user, loading, error)
│   └── useCollabStore.ts       # Collaboration state (projects, tasks, chat)
├── components/
│   └── collaboration/
│       ├── CollabPanel.tsx              # Main collaboration panel (replaces MaestroPanel when collab section active)
│       ├── CollabSignIn.tsx             # Sign-in prompt / auth UI
│       ├── CollabProjectList.tsx        # List of collaborative projects
│       ├── CollabProjectDetail.tsx      # Single project view with tasks + chat
│       ├── CollabTaskCard.tsx           # Task card in the dashboard
│       ├── CollabTaskDetail.tsx         # Task detail with comments
│       ├── CollabChat.tsx               # Chat component (used for project + task chat)
│       ├── CollabMemberList.tsx         # Members list for a project
│       ├── AddCollaboratorModal.tsx     # Modal to add collaborator by email/code
│       ├── PublishTaskModal.tsx         # Modal to publish a local task to collaboration
│       └── ForkTaskModal.tsx            # Modal to fork a collab task to local project
```

### 5.3 State Stores

#### useAuthStore
```typescript
interface AuthState {
  user: MaestroUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;

  // Actions
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => void;       // Sets up onAuthStateChanged listener
}
```

#### useCollabStore
```typescript
interface CollabState {
  // Data
  projects: CollabProject[];
  currentProjectId: string | null;
  tasks: Map<string, CollabTask[]>;     // projectId -> tasks
  members: Map<string, CollabMember[]>; // projectId -> members

  // Loading states
  loadingProjects: boolean;
  loadingTasks: boolean;

  // Actions
  fetchProjects: () => Promise<void>;
  fetchTasks: (projectId: string) => Promise<void>;
  fetchMembers: (projectId: string) => Promise<void>;

  publishTask: (projectId: string, localTask: Task, subtasks: Task[], docs: DocEntry[]) => Promise<void>;
  unpublishTask: (projectId: string, taskId: string) => Promise<void>;
  updateCollabTask: (projectId: string, taskId: string, updates: Partial<CollabTask>) => Promise<void>;

  forkTask: (projectId: string, collabTask: CollabTask, targetLocalProjectId: string) => Promise<void>;

  addCollaborator: (projectId: string, emailOrCode: string) => Promise<void>;
  removeCollaborator: (projectId: string, uid: string) => Promise<void>;

  registerProject: (localProject: Project) => Promise<void>;

  // Real-time subscriptions
  subscribeToProject: (projectId: string) => () => void;   // Returns unsubscribe fn
  subscribeToTasks: (projectId: string) => () => void;
  subscribeToChat: (projectId: string) => () => void;

  // Chat
  sendProjectMessage: (projectId: string, content: string) => Promise<void>;
  sendTaskComment: (projectId: string, taskId: string, content: string) => Promise<void>;
}
```

### 5.4 Icon Rail Addition

Add `"collab"` to `IconRailSection` type and the rail items array:

```typescript
// useUIStore.ts
export type IconRailSection = 'tasks' | 'members' | 'teams' | 'skills' | 'lists' | 'files' | 'collab' | null;

// IconRail.tsx - add to railItems
{ section: "collab", label: "Collab" }

// Icon: People/handshake SVG icon
```

### 5.5 Firebase Configuration

```typescript
// firebase/config.ts
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
```

Config values stored in `.env` file (not committed).

---

## 6. UI/UX Design

### 6.1 Collaboration Panel (Left Sidebar)

When the "Collab" icon is clicked in the icon rail:

```
┌──────────────────────────────────┐
│  🤝 Collaboration                │
├──────────────────────────────────┤
│                                  │
│  [Not signed in]                 │
│                                  │
│  Sign in to collaborate with     │
│  other Maestro users.            │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 🔵 Sign in with Google     │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 🐙 Sign in with GitHub     │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 📧 Sign in with Email      │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

After sign-in:

```
┌──────────────────────────────────┐
│  🤝 Collaboration                │
│  Signed in as subhang            │
│  Code: M-X7K9P2Q    [Copy]      │
├──────────────────────────────────┤
│  [Projects] [Activity]           │
├──────────────────────────────────┤
│                                  │
│  My Collaborative Projects       │
│  ┌────────────────────────────┐  │
│  │ agent-maestro          3👥  │  │
│  │ 5 tasks · 2 open           │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ side-project           1👥  │  │
│  │ 2 tasks · 1 open           │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ + Register Current Project │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

### 6.2 Project Detail View (Opens in main panel area or expands sidebar)

```
┌──────────────────────────────────────────┐
│  ← agent-maestro                    ⚙️   │
│  3 collaborators                         │
├──────────────────────────────────────────┤
│  [Tasks] [Chat] [Members]               │
├──────────────────────────────────────────┤
│                                          │
│  Published Tasks                         │
│  ┌──────────────────────────────────┐    │
│  │ 🟢 Implement auth flow     HIGH  │    │
│  │ by subhang · 3 comments          │    │
│  │ [Fork to My Tasks]               │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │ 🟡 Fix sidebar layout      MED   │    │
│  │ by alex · 1 comment              │    │
│  │ [Fork to My Tasks]               │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [+ Publish a Task]                      │
│                                          │
└──────────────────────────────────────────┘
```

### 6.3 Task Detail View

```
┌──────────────────────────────────────────┐
│  ← Implement auth flow              🟢   │
│  Published by subhang · HIGH priority    │
├──────────────────────────────────────────┤
│  Description:                            │
│  Add Firebase authentication to the      │
│  maestro-ui app with Google and GitHub   │
│  sign-in providers.                      │
│                                          │
│  Subtasks:                               │
│  ☐ Set up Firebase config                │
│  ☐ Create auth store                     │
│  ☑ Design login UI                       │
│                                          │
│  Docs:                                   │
│  📄 Auth Architecture Notes              │
├──────────────────────────────────────────┤
│  Comments (3)                            │
│  ┌──────────────────────────────────┐    │
│  │ alex: I can take the Firebase     │    │
│  │ config part. Starting today.      │    │
│  │ 2 hours ago                       │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │ subhang: Great! I've added some   │    │
│  │ notes in the doc.                 │    │
│  │ 1 hour ago                        │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ Type a comment...          [Send] │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [Fork to My Tasks]  [Share Link]        │
└──────────────────────────────────────────┘
```

### 6.4 Project Chat View

```
┌──────────────────────────────────────────┐
│  ← agent-maestro > Chat                 │
├──────────────────────────────────────────┤
│                                          │
│  subhang: Hey, I published the auth      │
│  tasks. Can someone pick up the          │
│  Firebase config?                        │
│  10:30 AM                                │
│                                          │
│  alex: On it! Forked to my project.      │
│  10:45 AM                                │
│                                          │
│  subhang: Awesome, check the docs I      │
│  attached to the task.                   │
│  10:47 AM                                │
│                                          │
├──────────────────────────────────────────┤
│  ┌──────────────────────────────────┐    │
│  │ Type a message...          [Send] │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### 6.5 Publish Task Modal

Triggered from the existing local task context menu (right-click or "..." menu):

```
┌──────────────────────────────────────────┐
│  Publish Task to Collaboration           │
├──────────────────────────────────────────┤
│                                          │
│  Task: "Implement auth flow"             │
│                                          │
│  Target Project:                         │
│  [agent-maestro            ▼]            │
│                                          │
│  Include:                                │
│  ☑ Subtasks (3 subtasks)                 │
│  ☑ Task Docs (1 doc)                     │
│                                          │
│  ┌────────────┐  ┌──────────────────┐    │
│  │   Cancel    │  │    Publish       │    │
│  └────────────┘  └──────────────────┘    │
└──────────────────────────────────────────┘
```

### 6.6 Add Collaborator Modal

```
┌──────────────────────────────────────────┐
│  Add Collaborator                        │
├──────────────────────────────────────────┤
│                                          │
│  Enter email or collaborator code:       │
│  ┌──────────────────────────────────┐    │
│  │ alex@example.com                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌────────────┐  ┌──────────────────┐    │
│  │   Cancel    │  │  Add Member      │    │
│  └────────────┘  └──────────────────┘    │
└──────────────────────────────────────────┘
```

---

## 7. User Flows

### 7.1 First-Time Sign In
1. User clicks Collab icon in rail → sees sign-in prompt
2. Clicks "Sign in with Google" → Firebase Auth popup
3. On success → app creates user doc in Firestore `users/{uid}` with generated collaborator code
4. Collab panel shows empty project list

### 7.2 Register a Project for Collaboration
1. User clicks "Register Current Project" in collab panel
2. Creates a `CollabProject` doc in Firestore with project metadata
3. Adds user as owner in `projects/{id}/members/{uid}`
4. Project appears in the collab project list

### 7.3 Add a Collaborator
1. User opens a collaborative project → Members tab
2. Clicks "Add Collaborator"
3. Enters email or collaborator code
4. System looks up user in `users` collection by email or code
5. Adds them to `projects/{id}/members/{uid}`
6. Collaborator sees the project in their collab panel next time they open it

### 7.4 Publish a Task
1. User right-clicks a local task → "Publish to Collaboration"
2. Selects target collaborative project (if they have multiple)
3. Optionally includes subtasks and docs
4. Task data is written to `projects/{id}/tasks/{taskId}` in Firestore
5. Task appears in the collaboration dashboard for all project members

### 7.5 Fork a Task
1. Collaborator browses published tasks in a project
2. Clicks "Fork to My Tasks" on a task
3. Selects which local project to add it to
4. System creates a new local task (via maestro-server API) with the collab task's data
5. Increments `takenByCount` on the collab task

### 7.6 Chat on a Task
1. User opens a collab task detail
2. Types a comment in the comment box
3. Comment written to `projects/{id}/tasks/{taskId}/comments/{commentId}`
4. Real-time listener updates all viewers instantly

### 7.7 Update / Complete a Published Task
1. Publisher opens their published task in collab dashboard
2. Can update title, description, status, subtasks
3. Can mark as completed or cancel
4. Changes sync to Firestore in real-time

### 7.8 Revoke a Published Task
1. Publisher can delete a published task from the collab dashboard
2. Removes the task doc from Firestore
3. Already-forked local copies remain unaffected (they're independent copies)

---

## 8. Implementation Phases

### Phase 1: Firebase Setup & Auth
- Add Firebase SDK to maestro-ui
- Create firebase config, auth helpers
- Create `useAuthStore`
- Add sign-in / sign-out UI in CollabPanel
- User profile creation in Firestore on first sign-in
- Collaborator code generation

### Phase 2: Project Registration & Collaborators
- Create `useCollabStore`
- "Register Project" flow — creates CollabProject in Firestore
- Add/remove collaborators by email or code
- CollabProjectList and CollabMemberList components
- Real-time subscription to project members

### Phase 3: Task Publishing & Forking
- "Publish Task" modal and flow (local task → Firestore)
- CollabTaskCard and CollabTaskDetail components
- "Fork to My Tasks" flow (Firestore → local task via server API)
- Update/complete/revoke published tasks
- Real-time subscription to project tasks

### Phase 4: Chat & Comments
- Project-level chat (CollabChat component)
- Task-level comments
- Real-time Firestore listeners for messages
- Markdown rendering in messages

### Phase 5: Icon Rail Integration & Polish
- Add "Collab" section to IconRail
- Wire up AppLeftPanel routing
- Styling consistent with existing Maestro theme
- Loading states, error handling, empty states
- Badge on collab icon (unread messages count)

---

## 9. No Backend (maestro-server) Changes Required

The collaboration feature is entirely client-side (UI ↔ Firestore). The only interaction with maestro-server is the existing task creation API used when forking a collab task to a local project. No new server routes, services, or repositories are needed.

The one server-side touchpoint:
- **Fork flow**: calls existing `POST /api/tasks` to create a local task from collab task data

---

## 10. Firebase Project Setup (One-time)

1. Create Firebase project in Firebase Console
2. Enable Authentication (Google, GitHub, Email/Password providers)
3. Enable Firestore Database
4. Deploy Firestore security rules (Section 3.3)
5. Create composite indexes (Section 4)
6. Add Firebase config values to `.env`

---

## 11. File Changes Summary

### New Files (~15 files)
```
maestro-ui/src/firebase/config.ts
maestro-ui/src/firebase/auth.ts
maestro-ui/src/firebase/firestore.ts
maestro-ui/src/stores/useAuthStore.ts
maestro-ui/src/stores/useCollabStore.ts
maestro-ui/src/components/collaboration/CollabPanel.tsx
maestro-ui/src/components/collaboration/CollabSignIn.tsx
maestro-ui/src/components/collaboration/CollabProjectList.tsx
maestro-ui/src/components/collaboration/CollabProjectDetail.tsx
maestro-ui/src/components/collaboration/CollabTaskCard.tsx
maestro-ui/src/components/collaboration/CollabTaskDetail.tsx
maestro-ui/src/components/collaboration/CollabChat.tsx
maestro-ui/src/components/collaboration/CollabMemberList.tsx
maestro-ui/src/components/collaboration/AddCollaboratorModal.tsx
maestro-ui/src/components/collaboration/PublishTaskModal.tsx
maestro-ui/src/components/collaboration/ForkTaskModal.tsx
maestro-ui/firestore.rules
maestro-ui/.env.example
```

### Modified Files (~5 files)
```
maestro-ui/package.json              # Add firebase dependency
maestro-ui/src/stores/useUIStore.ts  # Add 'collab' to IconRailSection
maestro-ui/src/components/IconRail.tsx           # Add collab icon
maestro-ui/src/components/AppLeftPanel.tsx        # Route collab section
maestro-ui/src/App.tsx                           # Initialize Firebase auth listener
```

---

## 12. Open Questions / Future Considerations

- **Notifications**: Push notifications when someone comments on your task or joins your project (can use Firebase Cloud Messaging later)
- **Task status sync**: If someone forks a task and completes it locally, should that reflect back? (Not for v1)
- **File attachments**: Allow attaching files to collab tasks (would need Firebase Storage)
- **Offline queue**: Queue Firestore writes when offline, sync when back online (Firestore has built-in offline support)
- **Rate limiting**: Firestore has its own rate limits; monitor usage

---

## 13. Final Design Review

### Review Date: 2026-03-04

### Verdict: APPROVED with required refinements below

### Critical Issues to Address During Implementation

#### 1. Tauri + Firebase Auth Popup Limitation
Firebase Auth popup-based sign-in (`signInWithPopup`) may not work reliably inside Tauri's webview. **Mitigation**: Use `signInWithRedirect` as the primary auth method, or use Firebase's REST API with a custom sign-in flow that opens the system browser and captures the redirect via Tauri's deep link handler. This must be validated in Phase 1 before proceeding.

#### 2. Project ID Collision Risk
Using the local project ID as the Firestore document ID will cause collisions — two different users could have local projects with the same generated ID. **Fix**: Use a Firestore auto-generated ID for `CollabProject`, and store the `localProjectId` as a field. Add a mapping in the local project metadata (e.g., a `collabProjectId` field on the local Project entity) to link them.

#### 3. Project Discovery Query
When a user opens the collab panel, we need to fetch "all projects I'm a member of." Firestore doesn't support querying across parent documents by subcollection membership. **Fix**: Use a **Collection Group query** on the `members` subcollection filtered by `uid == currentUser.uid`, then fetch the parent project docs. Alternatively, maintain a `projectIds: string[]` array on the user doc for simpler queries.

**Recommended approach**: Maintain `projectIds[]` on the user document. Update it when a collaborator is added/removed. This avoids collection group queries and keeps the read pattern simple.

#### 4. Collaborator Code Uniqueness
The plan generates an 8-char code on first sign-in but doesn't address uniqueness guarantees. **Fix**: Use a Firestore transaction that:
1. Generates a candidate code
2. Queries `users` collection for existing codes matching
3. If collision, regenerate and retry (up to 5 attempts)
4. Write the user doc atomically

With 8 alphanumeric chars (36^8 = ~2.8 trillion combinations), collisions are extremely unlikely but must be handled.

#### 5. Denormalized Count Maintenance
Fields like `memberCount`, `taskCount`, `commentCount`, `takenByCount` need atomic updates. **Fix**: Use `FieldValue.increment(1)` / `FieldValue.increment(-1)` in Firestore transactions when adding/removing items. Do not rely on client-side count calculations.

#### 6. Pagination Strategy
Missing from the plan. Large projects could accumulate many tasks, comments, and chat messages. **Fix**:
- **Tasks**: Load first 50, paginate with `startAfter` cursor on `createdAt`
- **Chat messages**: Load last 50 messages, infinite scroll upward with `endBefore` cursor
- **Comments**: Load first 30 per task, "Load more" button
- **Projects**: Unlikely to need pagination (users won't have 100+ collaborative projects)

#### 7. Chat Message Editing/Deletion
Current security rules only allow `read` and `create` for chat messages — no editing or deletion. **Fix**: Allow authors to delete their own messages:
```
allow delete: if request.auth != null && resource.data.authorUid == request.auth.uid;
```

#### 8. Firestore Cost from Security Rules
The security rules use `exists()` checks on the `members` subcollection for nearly every operation. Each `exists()` = 1 Firestore read. For a project with frequent access, this adds up. **Mitigation**: This is acceptable for v1 given expected usage volume. For scale, consider moving to Firebase Custom Claims (JWT-based) to encode project membership, eliminating per-request `exists()` calls.

### Architecture Strengths

1. **Zero backend changes** — collaboration is purely additive, doesn't touch the local server
2. **Clean separation** — Firestore handles cloud data, local filesystem handles local data, no mixing
3. **Fork model is simple and robust** — no sync conflicts, no CRDT complexity, just copy-and-work
4. **Real-time for free** — Firestore `onSnapshot` gives live updates without building WebSocket infrastructure for cloud
5. **Incremental opt-in** — users who don't sign in get zero impact on existing experience
6. **Firestore security rules are well-designed** — publisher-only write access on tasks, member-gated reads

### Implementation Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tauri auth popup failure | High | Blocks Phase 1 | Test immediately, fallback to redirect/deep-link |
| Firestore cold start latency | Medium | UX jank on first load | Show loading skeletons, prefetch on auth |
| Firebase SDK bundle size | Medium | Larger app size (~100KB gzipped) | Use modular imports (tree-shakeable) |
| Collaborator code collision | Very Low | User can't sign up | Transaction-based retry loop |
| Firestore cost at scale | Low (for v1) | Cost overrun | Monitor usage, add caching layer later |

### Estimated Scope

- **~15 new files**, **~5 modified files**
- **0 new server endpoints**
- **1 new npm dependency** (`firebase`)
- **5 implementation phases** (can be shipped incrementally)
- Phase 1 (Auth) is the highest-risk phase — validate Tauri compatibility first

### Sign-off

This design plan is ready for implementation. Recommended starting point: **Phase 1 (Firebase Setup & Auth)** with an immediate spike to validate Tauri + Firebase Auth compatibility before writing any UI code.
