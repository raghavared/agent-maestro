# Maestro Online & Collaboration — Architecture Plan

> **Status:** Finalized  
> **Date:** 2026-04-09  
> **Scope:** End-to-end collaboration system across maestro-server, maestro-cli, and maestro-ui  
> **Firebase Project:** `maestro-5f3fc` (Admin SDK creds at repo root, gitignored)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Decisions](#2-design-decisions)
3. [Data Model](#3-data-model)
4. [Auth System](#4-auth-system)
5. [Server Changes](#5-server-changes)
6. [CLI Commands](#6-cli-commands)
7. [UI Changes](#7-ui-changes)
8. [Sync Architecture](#8-sync-architecture)
9. [Security & Permissions](#9-security--permissions)
10. [Implementation Phases](#10-implementation-phases)
11. [File Impact Map](#11-file-impact-map)

---

## 1. Overview

### Goal
Enable multiple Maestro users to collaborate on shared tasks, team members, and docs within a linked online project. Each user keeps their local Maestro server for sessions/execution, while shared data lives in Firebase Firestore with real-time sync.

### Core Principle
**Firestore for shared data, local for private.** The local server (`~/.maestro/data/`) remains the execution engine. Firestore is a separate collaboration layer. Entities can be "published" to Firestore or kept local-only. This avoids rewriting the server persistence layer.

### Architecture Summary

```
User A (macOS)                          User B (macOS)
┌──────────────┐                        ┌──────────────┐
│ maestro-ui   │                        │ maestro-ui   │
│ (Tauri app)  │                        │ (Tauri app)  │
│              │                        │              │
│ ┌──────────┐ │                        │ ┌──────────┐ │
│ │ Collab   │◄├───── Firestore ───────►│ │ Collab   │ │
│ │ Store    │ │     (real-time)        │ │ Store    │ │
│ └──────────┘ │                        │ └──────────┘ │
│ ┌──────────┐ │                        │ ┌──────────┐ │
│ │ Local    │ │                        │ │ Local    │ │
│ │ Stores   │ │                        │ │ Stores   │ │
│ └────┬─────┘ │                        │ └────┬─────┘ │
└──────┼───────┘                        └──────┼───────┘
       │                                       │
┌──────▼───────┐                        ┌──────▼───────┐
│ maestro-     │                        │ maestro-     │
│ server       │                        │ server       │
│ (local:3002) │                        │ (local:3002) │
└──────────────┘                        └──────────────┘

               ┌─────────────────┐
               │  Firebase Auth  │
               │  + Firestore    │
               │  (cloud)        │
               └─────────────────┘
```

---

## 2. Design Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Sync architecture | Firestore for shared, local for private | Incremental adoption; existing workflows untouched; no server refactor |
| D2 | Shared entities | Tasks, Team Members, Docs, Task Lists | Sessions stay local (they're terminal runs); Teams optionally shared later |
| D3 | Collaboration model | **Real-time** for task status/assignments; **async** for heavy content (descriptions, docs) | Pragmatic balance — status is high-frequency, prose is low-frequency |
| D4 | Auth flow | Both CLI and UI paths | CLI agents need auth tokens; humans use UI. Shared token in secure storage |
| D5 | Project linking | Many:1 — multiple local projects link to one online project | Multiple devs each have local repos pointing to same online project |
| D6 | Firestore schema | Subcollections under online project | Clean security rules, efficient queries, natural project scoping |
| D7 | Permissions | Owner / Editor / Viewer roles | Start simple with 3 roles. Owner manages collaborators |
| D8 | Server role | Server stays local; Firestore sync in UI + CLI | Server is unaware of collaboration. Collab is a UI + CLI concern via Firebase SDK |
| D9 | Conflict resolution | Last-write-wins with field-level merging + optional server timestamps | Simple, Firestore-native. UI shows "edited by X" attribution |

---

## 3. Data Model

### 3.1 New Entity: User (Firebase Auth)

```typescript
// Stored in Firestore /users/{uid}
interface MaestroUser {
  uid: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
}
```

### 3.2 New Entity: OnlineProject

```typescript
// Stored in Firestore /onlineProjects/{onlineProjectId}
interface OnlineProject {
  id: string;
  name: string;
  description?: string;
  ownerId: string;                // Firebase UID of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.3 Collaborator

```typescript
// Stored in Firestore /onlineProjects/{id}/collaborators/{uid}
interface Collaborator {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Timestamp;
  invitedBy: string;              // UID of inviter
}
```

### 3.4 Shared Task

```typescript
// Stored in Firestore /onlineProjects/{id}/tasks/{taskId}
interface SharedTask {
  id: string;                     // Same ID as local task if published
  localTaskId?: string;           // Original local task ID (for linking)
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  parentId?: string;              // Shared task parent (for tree structure)
  teamMemberIds: string[];        // Shared team member IDs assigned
  assigneeUid?: string;           // Firebase UID of human assignee
  createdBy: string;              // Firebase UID
  updatedBy: string;              // Firebase UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Subset of local Task fields relevant for collaboration
  dueDate?: string;
  referenceTaskIds?: string[];
  tags?: string[];
}
```

### 3.5 Shared Team Member

```typescript
// Stored in Firestore /onlineProjects/{id}/teamMembers/{memberId}
interface SharedTeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  mode: AgentMode;
  model?: string;
  agentTool?: AgentTool;
  identity?: string;
  capabilities?: Record<string, boolean>;
  publishedBy: string;            // Firebase UID
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.6 Shared Doc

```typescript
// Stored in Firestore /onlineProjects/{id}/docs/{docId}
interface SharedDoc {
  id: string;
  title: string;
  content: string;                // Markdown content (< 1MB Firestore limit)
  entityType: 'task' | 'session' | 'general';
  entityId?: string;              // Task/session it belongs to
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.7 Project Link (Local)

```typescript
// Stored locally in ~/.maestro/data/project-links/{projectId}.json
interface ProjectLink {
  localProjectId: string;
  onlineProjectId: string;
  onlineProjectName: string;
  linkedAt: string;               // ISO 8601
  linkedBy: string;               // Firebase UID
  syncEnabled: boolean;
  lastSyncAt?: string;
}
```

### 3.8 Firestore Collection Structure

```
/users/{uid}                              — User profile
/onlineProjects/{projectId}               — Online project metadata
/onlineProjects/{projectId}/collaborators/{uid} — Access control
/onlineProjects/{projectId}/tasks/{taskId}      — Shared tasks
/onlineProjects/{projectId}/teamMembers/{memberId} — Shared team members
/onlineProjects/{projectId}/docs/{docId}        — Shared documents
/onlineProjects/{projectId}/activity/{eventId}  — Activity feed
```

---

## 4. Auth System

### 4.1 Firebase Auth Integration

**Supported providers:** Google OAuth, GitHub OAuth (extendable)

**Token storage:**
- UI: Tauri secure storage (keychain) via `useSecureStorageStore`
- CLI: `~/.maestro/auth.json` (encrypted or with file permissions 0600)

### 4.2 Auth Token Format (Local Cache)

```typescript
// ~/.maestro/auth.json
interface AuthCache {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;           // Firebase ID token (JWT, refreshable)
  refreshToken: string;      // Firebase refresh token
  expiresAt: number;         // Unix timestamp
  provider: 'google' | 'github';
}
```

### 4.3 CLI Auth Flow

```
1. User runs: maestro auth login
2. CLI starts local HTTP server on random port (e.g., localhost:9876)
3. CLI opens browser to Firebase Auth sign-in page with redirect to localhost:9876/callback
4. User authenticates with Google/GitHub in browser
5. Firebase redirects to localhost:9876/callback with auth code
6. CLI exchanges code for tokens, writes to ~/.maestro/auth.json
7. CLI registers/updates user profile in Firestore /users/{uid}
8. CLI prints: "Logged in as user@example.com"
```

### 4.4 UI Auth Flow

```
1. User clicks "Sign In" in collab panel or settings
2. Tauri opens OAuth popup (Firebase Auth signInWithPopup)
3. On success, token cached in Tauri secure storage
4. UI registers/updates user profile in Firestore
5. Collab features unlock in sidebar
```

### 4.5 Token Refresh

Both UI and CLI use Firebase SDK's automatic token refresh. The ID token (1-hour expiry) is refreshed transparently using the refresh token. CLI commands check token validity before Firestore calls and refresh if needed.

---

## 5. Server Changes

### 5.1 Principle: Server Stays Local

The maestro-server does **not** talk to Firebase directly. It remains the local execution engine. However, it needs a few additions:

### 5.2 New: ProjectLink Repository

```typescript
// maestro-server/src/domain/repositories/IProjectLinkRepository.ts
interface IProjectLinkRepository {
  findByProjectId(localProjectId: string): Promise<ProjectLink | null>;
  findByOnlineProjectId(onlineProjectId: string): Promise<ProjectLink[]>;
  save(link: ProjectLink): Promise<void>;
  delete(localProjectId: string): Promise<void>;
  findAll(): Promise<ProjectLink[]>;
}
```

Implementation: `FileSystemProjectLinkRepository` storing JSON in `~/.maestro/data/project-links/`.

### 5.3 New: Project Link API Routes

```
GET    /api/projects/:id/link          — Get link status for a project
POST   /api/projects/:id/link          — Link project to online project
DELETE /api/projects/:id/link          — Unlink project from online project
GET    /api/project-links              — List all project links
```

### 5.4 New: Auth Status Endpoint

```
GET    /api/auth/status                — Check if user is authenticated
POST   /api/auth/token                 — Store/refresh auth token (from CLI)
```

The server stores the auth token passed from CLI so the UI can read it (or vice versa). This bridges the CLI and UI auth states.

### 5.5 New Domain Events

```typescript
// Add to DomainEvents.ts
'project:linked': { projectId: string; onlineProjectId: string }
'project:unlinked': { projectId: string; onlineProjectId: string }
'collab:task_published': { taskId: string; onlineProjectId: string }
'collab:team_member_published': { teamMemberId: string; onlineProjectId: string }
```

### 5.6 Container Changes

Wire `IProjectLinkRepository` into container. Add `ProjectLinkService` to `application/services/`.

---

## 6. CLI Commands

### 6.1 New Command Group: `auth`

| Command ID | Syntax | Description | Modes |
|------------|--------|-------------|-------|
| `auth:login` | `maestro auth login [--provider <google\|github>]` | Authenticate with Firebase (opens browser) | ALL_MODES |
| `auth:logout` | `maestro auth logout` | Clear auth tokens | ALL_MODES |
| `auth:status` | `maestro auth status` | Show current auth state (logged in user, token expiry) | ALL_MODES |
| `auth:token` | `maestro auth token` | Print current ID token (for debugging/scripting) | ALL_MODES |

### 6.2 New Command Group: `collab`

| Command ID | Syntax | Description | Modes |
|------------|--------|-------------|-------|
| `collab:status` | `maestro collab status` | Show collaboration status for current project (linked?, online project, collaborators) | ALL_MODES |
| `collab:link` | `maestro collab link <onlineProjectId>` | Link current local project to an online project | COORDINATOR_MODES |
| `collab:unlink` | `maestro collab unlink` | Unlink current project from online project | COORDINATOR_MODES |
| `collab:create-project` | `maestro collab create-project "<name>" [--desc "<description>"]` | Create a new online project in Firestore | COORDINATOR_MODES |
| `collab:list-projects` | `maestro collab list-projects` | List online projects the user has access to | ALL_MODES |
| `collab:invite` | `maestro collab invite <email> [--role <owner\|editor\|viewer>]` | Invite a collaborator to the linked online project | COORDINATOR_MODES |
| `collab:remove` | `maestro collab remove <email>` | Remove a collaborator from the online project | COORDINATOR_MODES |
| `collab:collaborators` | `maestro collab collaborators` | List collaborators on the linked online project | ALL_MODES |
| `collab:publish-task` | `maestro collab publish-task <taskId> [--include-children]` | Publish a local task to the online project | ALL_MODES |
| `collab:unpublish-task` | `maestro collab unpublish-task <taskId>` | Remove a task from the online project | ALL_MODES |
| `collab:pull-tasks` | `maestro collab pull-tasks [--status <status>]` | Pull shared tasks from online project into local | ALL_MODES |
| `collab:publish-team-member` | `maestro collab publish-team-member <teamMemberId>` | Publish a local team member to the online project | ALL_MODES |
| `collab:unpublish-team-member` | `maestro collab unpublish-team-member <teamMemberId>` | Remove a team member from the online project | ALL_MODES |
| `collab:pull-team-members` | `maestro collab pull-team-members` | Pull shared team members from online project | ALL_MODES |
| `collab:publish-doc` | `maestro collab publish-doc "<title>" --file <filePath>` | Publish a document to the online project | ALL_MODES |
| `collab:activity` | `maestro collab activity [--limit <n>]` | Show recent activity feed from the online project | ALL_MODES |

### 6.3 Command Catalog Additions

```typescript
// Add to command-catalog.ts COMMAND_DEFINITIONS

// Auth commands
{ id: 'auth:login', description: 'Login to Maestro Online', group: 'auth', allowedModes: ALL_MODES },
{ id: 'auth:logout', description: 'Logout from Maestro Online', group: 'auth', allowedModes: ALL_MODES },
{ id: 'auth:status', description: 'Show auth status', group: 'auth', allowedModes: ALL_MODES },
{ id: 'auth:token', description: 'Print current auth token', group: 'auth', allowedModes: ALL_MODES, hiddenFromPrompt: true },

// Collab commands
{ id: 'collab:status', description: 'Show collaboration status', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:link', description: 'Link project to online project', group: 'collab', allowedModes: COORDINATOR_MODES },
{ id: 'collab:unlink', description: 'Unlink from online project', group: 'collab', allowedModes: COORDINATOR_MODES },
{ id: 'collab:create-project', description: 'Create online project', group: 'collab', allowedModes: COORDINATOR_MODES },
{ id: 'collab:list-projects', description: 'List online projects', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:invite', description: 'Invite collaborator', group: 'collab', allowedModes: COORDINATOR_MODES },
{ id: 'collab:remove', description: 'Remove collaborator', group: 'collab', allowedModes: COORDINATOR_MODES },
{ id: 'collab:collaborators', description: 'List collaborators', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:publish-task', description: 'Publish task to online project', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:unpublish-task', description: 'Unpublish task from online project', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:pull-tasks', description: 'Pull shared tasks from online project', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:publish-team-member', description: 'Publish team member to online project', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:unpublish-team-member', description: 'Unpublish team member', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:pull-team-members', description: 'Pull shared team members', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:publish-doc', description: 'Publish document to online project', group: 'collab', allowedModes: ALL_MODES },
{ id: 'collab:activity', description: 'Show online project activity feed', group: 'collab', allowedModes: ALL_MODES },
```

### 6.4 Command Syntax Map Additions

```typescript
// Add to COMMAND_SYNTAX_MAP
'auth:login': 'maestro auth login [--provider <google|github>]',
'auth:logout': 'maestro auth logout',
'auth:status': 'maestro auth status',
'auth:token': 'maestro auth token',

'collab:status': 'maestro collab status',
'collab:link': 'maestro collab link <onlineProjectId>',
'collab:unlink': 'maestro collab unlink',
'collab:create-project': 'maestro collab create-project "<name>" [--desc "<description>"]',
'collab:list-projects': 'maestro collab list-projects',
'collab:invite': 'maestro collab invite <email> [--role <owner|editor|viewer>]',
'collab:remove': 'maestro collab remove <email>',
'collab:collaborators': 'maestro collab collaborators',
'collab:publish-task': 'maestro collab publish-task <taskId> [--include-children]',
'collab:unpublish-task': 'maestro collab unpublish-task <taskId>',
'collab:pull-tasks': 'maestro collab pull-tasks [--status <status>]',
'collab:publish-team-member': 'maestro collab publish-team-member <teamMemberId>',
'collab:unpublish-team-member': 'maestro collab unpublish-team-member <teamMemberId>',
'collab:pull-team-members': 'maestro collab pull-team-members',
'collab:publish-doc': 'maestro collab publish-doc "<title>" --file <filePath>',
'collab:activity': 'maestro collab activity [--limit <n>]',
```

### 6.5 Command Group Meta

```typescript
// Add to COMMAND_GROUP_META
auth: { prefix: 'maestro auth', description: 'Authentication for Maestro Online' },
collab: { prefix: 'maestro collab', description: 'Collaboration & online project sync' },
```

### 6.6 CLI Implementation Files

```
maestro-cli/src/commands/auth.ts              — registerAuthCommands(program)
maestro-cli/src/commands/collab.ts            — registerCollabCommands(program)
maestro-cli/src/services/firebase-client.ts   — Firebase SDK wrapper (Auth + Firestore)
maestro-cli/src/services/auth-manager.ts      — Token storage, refresh, status
maestro-cli/src/services/collab-sync.ts       — Publish/pull/sync logic
```

### 6.7 Auth Manager Service

```typescript
// maestro-cli/src/services/auth-manager.ts
class AuthManager {
  async login(provider?: 'google' | 'github'): Promise<AuthResult>
  async logout(): Promise<void>
  async getStatus(): Promise<AuthStatus>
  async getIdToken(): Promise<string | null>        // Auto-refreshes if expired
  async isAuthenticated(): Promise<boolean>
  async requireAuth(): Promise<AuthCache>            // Throws if not authenticated
}
```

### 6.8 Firebase Client Service

```typescript
// maestro-cli/src/services/firebase-client.ts
class FirebaseClient {
  // Auth
  async signInWithBrowser(provider: string): Promise<UserCredential>
  
  // Online Projects
  async createOnlineProject(name: string, desc?: string): Promise<OnlineProject>
  async listOnlineProjects(): Promise<OnlineProject[]>
  async getOnlineProject(id: string): Promise<OnlineProject>
  
  // Collaborators
  async inviteCollaborator(projectId: string, email: string, role: string): Promise<void>
  async removeCollaborator(projectId: string, uid: string): Promise<void>
  async listCollaborators(projectId: string): Promise<Collaborator[]>
  
  // Tasks
  async publishTask(projectId: string, task: SharedTask): Promise<void>
  async unpublishTask(projectId: string, taskId: string): Promise<void>
  async getSharedTasks(projectId: string, filter?: TaskFilter): Promise<SharedTask[]>
  
  // Team Members
  async publishTeamMember(projectId: string, member: SharedTeamMember): Promise<void>
  async unpublishTeamMember(projectId: string, memberId: string): Promise<void>
  async getSharedTeamMembers(projectId: string): Promise<SharedTeamMember[]>
  
  // Docs
  async publishDoc(projectId: string, doc: SharedDoc): Promise<void>
  async getSharedDocs(projectId: string): Promise<SharedDoc[]>
  
  // Activity
  async getActivity(projectId: string, limit?: number): Promise<ActivityEvent[]>
  async logActivity(projectId: string, event: ActivityEvent): Promise<void>
}
```

---

## 7. UI Changes

### 7.1 New Primary Tab: "Online"

Add a 5th primary tab to `PanelIconBar.tsx`:

```typescript
type PrimaryTab = 'tasks' | 'team' | 'skills' | 'lists' | 'online';
```

The "Online" tab has sub-tabs:
- **Tasks** — Shared tasks from the online project
- **Team** — Shared team members
- **Docs** — Shared documents
- **Activity** — Real-time activity feed
- **Settings** — Link/unlink, manage collaborators, permissions

### 7.2 New Zustand Store: `useCollabStore`

```typescript
// maestro-ui/src/stores/useCollabStore.ts
interface CollabState {
  // Auth
  user: MaestroUser | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  
  // Online project
  onlineProject: OnlineProject | null;
  collaborators: Collaborator[];
  projectLink: ProjectLink | null;
  
  // Shared data
  sharedTasks: Record<string, SharedTask>;
  sharedTeamMembers: Record<string, SharedTeamMember>;
  sharedDocs: Record<string, SharedDoc>;
  activityFeed: ActivityEvent[];
  
  // Sync state
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncAt: string | null;
  
  // Firestore listeners (for cleanup)
  _unsubscribers: (() => void)[];
  
  // Actions — Auth
  signIn(provider: 'google' | 'github'): Promise<void>;
  signOut(): Promise<void>;
  checkAuthStatus(): Promise<void>;
  
  // Actions — Project
  createOnlineProject(name: string, desc?: string): Promise<OnlineProject>;
  linkProject(localProjectId: string, onlineProjectId: string): Promise<void>;
  unlinkProject(localProjectId: string): Promise<void>;
  loadProjectLink(localProjectId: string): Promise<void>;
  listOnlineProjects(): Promise<OnlineProject[]>;
  
  // Actions — Collaborators
  inviteCollaborator(email: string, role: CollabRole): Promise<void>;
  removeCollaborator(uid: string): Promise<void>;
  
  // Actions — Sync
  subscribeToOnlineProject(onlineProjectId: string): void;  // Start Firestore listeners
  unsubscribeAll(): void;                                    // Cleanup listeners
  
  // Actions — Publish
  publishTask(localTaskId: string, includeChildren?: boolean): Promise<void>;
  unpublishTask(taskId: string): Promise<void>;
  publishTeamMember(localMemberId: string): Promise<void>;
  unpublishTeamMember(memberId: string): Promise<void>;
  publishDoc(title: string, content: string, entityType?: string, entityId?: string): Promise<void>;
}
```

### 7.3 New UI Components

```
maestro-ui/src/components/maestro/collab/
  ├── CollabPanel.tsx               — Main container for Online tab
  ├── CollabAuthGate.tsx            — Login prompt if not authenticated
  ├── CollabProjectLinker.tsx       — Link/unlink project UI
  ├── CollabTaskList.tsx            — Shared task list (read/write)
  ├── CollabTaskItem.tsx            — Individual shared task
  ├── CollabTeamMemberList.tsx      — Shared team members
  ├── CollabDocList.tsx             — Shared documents
  ├── CollabActivityFeed.tsx        — Real-time activity stream
  ├── CollabSettings.tsx            — Collaborator management, roles
  ├── CollabInviteModal.tsx         — Invite collaborator dialog
  ├── PublishTaskModal.tsx          — Select & publish local tasks
  └── PublishTeamMemberModal.tsx    — Select & publish local team members
```

### 7.4 New Hooks

```
maestro-ui/src/hooks/
  ├── useCollabAuth.ts              — Auth state + sign in/out
  ├── useCollabProject.ts           — Online project + link state
  ├── useCollabTasks.ts             — Shared tasks with filtering
  ├── useCollabTeamMembers.ts       — Shared team members
  ├── useCollabActivity.ts          — Activity feed subscription
  └── useFirestore.ts               — Low-level Firestore helpers
```

### 7.5 Firebase SDK Integration (UI)

```typescript
// maestro-ui/src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';

// Firebase project: maestro-5f3fc
// These are public client-side config values (not secrets)
// Retrieve from Firebase Console → Project Settings → General → Your apps → Web app
const firebaseConfig = {
  apiKey: "<from-firebase-console>",
  authDomain: "maestro-5f3fc.firebaseapp.com",
  projectId: "maestro-5f3fc",
  storageBucket: "maestro-5f3fc.firebasestorage.app",
  messagingSenderId: "204094353519",
  appId: "<from-firebase-console>"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### 7.6 UI Collab Panel Flow

```
User opens "Online" tab
  │
  ├── Not authenticated? → Show CollabAuthGate (Sign In button)
  │
  ├── Authenticated but no project link? → Show CollabProjectLinker
  │     ├── "Create Online Project" button
  │     └── "Link to Existing" with project selector
  │
  └── Authenticated + linked? → Show CollabPanel with sub-tabs
        ├── Tasks sub-tab: shared tasks (create, edit, status)
        ├── Team sub-tab: shared team members
        ├── Docs sub-tab: shared documents
        ├── Activity sub-tab: real-time feed
        └── Settings sub-tab: collaborators, roles, unlink
```

### 7.7 Presence Indicators

When viewing shared tasks, show small avatars of collaborators currently viewing the same project. Uses Firestore presence via a `/onlineProjects/{id}/presence/{uid}` document with a heartbeat timestamp (updated every 30s, stale after 60s).

---

## 8. Sync Architecture

### 8.1 Real-time Listeners (UI)

When a project is linked and the user opens the Online tab, the `useCollabStore` sets up Firestore `onSnapshot` listeners:

```typescript
// Subscribe to shared tasks
const tasksUnsub = onSnapshot(
  query(collection(db, 'onlineProjects', projectId, 'tasks'), orderBy('updatedAt', 'desc')),
  (snapshot) => {
    const tasks = {};
    snapshot.forEach(doc => { tasks[doc.id] = doc.data(); });
    set({ sharedTasks: tasks });
  }
);

// Subscribe to shared team members
const membersUnsub = onSnapshot(
  collection(db, 'onlineProjects', projectId, 'teamMembers'),
  (snapshot) => { /* update store */ }
);

// Subscribe to activity feed (last 50 events)
const activityUnsub = onSnapshot(
  query(collection(db, 'onlineProjects', projectId, 'activity'), orderBy('timestamp', 'desc'), limit(50)),
  (snapshot) => { /* update store */ }
);
```

### 8.2 Publish Flow

```
User clicks "Publish Task" on a local task
  │
  ├── UI reads task from useMaestroStore
  ├── Maps local Task → SharedTask (strips local-only fields)
  ├── Writes to Firestore /onlineProjects/{id}/tasks/{taskId}
  ├── Logs activity: "User X published task 'Build auth system'"
  └── Optional: marks local task with `onlineTaskId` field for linking
```

### 8.3 Pull Flow (CLI)

```
Agent runs: maestro collab pull-tasks
  │
  ├── CLI reads auth token from ~/.maestro/auth.json
  ├── CLI reads project link from server GET /api/projects/:id/link
  ├── CLI queries Firestore for shared tasks
  ├── CLI creates/updates local tasks via server POST/PATCH /api/tasks
  └── CLI prints summary: "Pulled 5 tasks (3 new, 2 updated)"
```

### 8.4 Conflict Resolution

**Strategy: Last-write-wins with field-level merging**

- Each shared entity has `updatedAt` (Firestore server timestamp) and `updatedBy` (UID)
- When two users edit different fields of the same task, both writes succeed (Firestore merge)
- When two users edit the same field, last write wins
- UI shows "Last edited by X, 2 minutes ago" attribution
- No operational transform needed — task descriptions are not collaboratively edited in real-time

### 8.5 Activity Feed

Every mutation logs an `ActivityEvent`:

```typescript
interface ActivityEvent {
  id: string;
  type: 'task_created' | 'task_updated' | 'task_completed' | 'task_deleted' |
        'member_published' | 'member_updated' |
        'doc_published' | 'collaborator_joined' | 'collaborator_removed';
  actorUid: string;
  actorName: string;
  entityId?: string;
  entityType?: string;
  message: string;            // Human-readable: "Alice completed 'Build auth system'"
  timestamp: Timestamp;
}
```

---

## 9. Security & Permissions

### 9.1 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read/write their own profile
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    
    // Online project: only collaborators can access
    match /onlineProjects/{projectId} {
      allow read: if isCollaborator(projectId);
      allow create: if request.auth != null;
      allow update, delete: if isOwner(projectId);
      
      // Collaborators subcollection
      match /collaborators/{uid} {
        allow read: if isCollaborator(projectId);
        allow write: if isOwner(projectId);
      }
      
      // Shared tasks
      match /tasks/{taskId} {
        allow read: if isCollaborator(projectId);
        allow create, update: if isEditor(projectId);
        allow delete: if isEditor(projectId);
      }
      
      // Shared team members
      match /teamMembers/{memberId} {
        allow read: if isCollaborator(projectId);
        allow create, update: if isEditor(projectId);
        allow delete: if isEditor(projectId);
      }
      
      // Shared docs
      match /docs/{docId} {
        allow read: if isCollaborator(projectId);
        allow create, update: if isEditor(projectId);
        allow delete: if isEditor(projectId);
      }
      
      // Activity feed
      match /activity/{eventId} {
        allow read: if isCollaborator(projectId);
        allow create: if isEditor(projectId);
      }
      
      // Presence
      match /presence/{uid} {
        allow read: if isCollaborator(projectId);
        allow write: if request.auth.uid == uid && isCollaborator(projectId);
      }
    }
    
    // Helper functions
    function isCollaborator(projectId) {
      return request.auth != null &&
        exists(/databases/$(database)/documents/onlineProjects/$(projectId)/collaborators/$(request.auth.uid));
    }
    
    function isOwner(projectId) {
      return isCollaborator(projectId) &&
        get(/databases/$(database)/documents/onlineProjects/$(projectId)/collaborators/$(request.auth.uid)).data.role == 'owner';
    }
    
    function isEditor(projectId) {
      return isCollaborator(projectId) &&
        get(/databases/$(database)/documents/onlineProjects/$(projectId)/collaborators/$(request.auth.uid)).data.role in ['owner', 'editor'];
    }
  }
}
```

### 9.2 CLI Auth Guard

All `collab:*` commands require authentication. Implemented as a middleware:

```typescript
async function requireCollabAuth(): Promise<AuthCache> {
  const auth = await authManager.getStatus();
  if (!auth.isAuthenticated) {
    throw new Error('Not authenticated. Run `maestro auth login` first.');
  }
  return auth;
}
```

---

## 10. Implementation Phases

### Phase 1: Auth Foundation (1-2 weeks)

**Goal:** Users can log in via CLI and UI, auth state shared between them.

| Package | Work |
|---------|------|
| **maestro-cli** | `auth.ts` commands (login/logout/status/token), `auth-manager.ts`, `firebase-client.ts` |
| **maestro-server** | `ProjectLinkRepository`, auth token bridge endpoint (`/api/auth/*`) |
| **maestro-ui** | `firebase.ts` service init, `useCollabStore` (auth slice), `CollabAuthGate.tsx` |
| **shared** | Firebase config, `auth.json` schema, `MaestroUser` type |

**Dependencies to add:**
- `maestro-cli/package.json`: `firebase` (client SDK)
- `maestro-ui/package.json`: `firebase` (client SDK)

**Deliverables:**
- `maestro auth login` opens browser, completes OAuth, writes token
- UI sign-in button works via popup
- Both paths write to Firestore `/users/{uid}`

### Phase 2: Online Projects & Linking (1 week)

**Goal:** Users can create online projects, link local projects, and invite collaborators.

| Package | Work |
|---------|------|
| **maestro-cli** | `collab.ts` commands: create-project, link, unlink, invite, remove, collaborators, list-projects, status |
| **maestro-server** | `FileSystemProjectLinkRepository`, project link API routes, domain events |
| **maestro-ui** | `CollabProjectLinker.tsx`, `CollabSettings.tsx`, `CollabInviteModal.tsx`, link/unlink flows |
| **Firestore** | Deploy security rules, create indexes |

**Deliverables:**
- `maestro collab create-project "My Project"` creates Firestore project
- `maestro collab link <id>` links local project
- `maestro collab invite user@example.com --role editor` adds collaborator
- UI shows project link status and collaborator list

### Phase 3: Shared Tasks (1-2 weeks)

**Goal:** Tasks can be published to the online project and viewed by collaborators in real-time.

| Package | Work |
|---------|------|
| **maestro-cli** | `collab publish-task`, `collab unpublish-task`, `collab pull-tasks` |
| **maestro-ui** | `CollabTaskList.tsx`, `CollabTaskItem.tsx`, `PublishTaskModal.tsx`, Firestore listeners for tasks |
| **maestro-ui** | "Online" tab in PanelIconBar with Tasks sub-tab |

**Deliverables:**
- Publish local tasks to Firestore
- Real-time shared task list in UI Online tab
- Create/edit shared tasks directly from Online tab
- Pull shared tasks into local project via CLI
- Activity feed for task mutations

### Phase 4: Shared Team Members & Docs (1 week)

**Goal:** Team members and docs can be shared across collaborators.

| Package | Work |
|---------|------|
| **maestro-cli** | `collab publish-team-member`, `collab pull-team-members`, `collab publish-doc` |
| **maestro-ui** | `CollabTeamMemberList.tsx`, `CollabDocList.tsx`, `PublishTeamMemberModal.tsx` |
| **maestro-ui** | Team and Docs sub-tabs in Online panel |

**Deliverables:**
- Publish/pull team members
- Publish/view shared docs
- Complete Online panel with all sub-tabs

### Phase 5: Activity Feed & Presence (1 week)

**Goal:** Real-time activity feed and collaborator presence indicators.

| Package | Work |
|---------|------|
| **maestro-cli** | `collab activity` command |
| **maestro-ui** | `CollabActivityFeed.tsx`, presence heartbeat, collaborator avatars on shared tasks |
| **Firestore** | Activity collection, presence documents |

**Deliverables:**
- Activity sub-tab with real-time feed
- Presence indicators (who's online)
- `maestro collab activity` prints recent events

### Phase 6: Polish & Integration (1 week)

**Goal:** Smooth the edges, handle edge cases, optimize.

- Offline handling (graceful degradation when no internet)
- Badge on Online tab showing unread activity count
- Notification sounds for collaborator actions
- Auto-publish option (publish tasks on creation if enabled)
- Task link indicators (show which local tasks are published)
- CLI collab status in `maestro status` output

---

## 11. File Impact Map

### New Files

```
# CLI
maestro-cli/src/commands/auth.ts
maestro-cli/src/commands/collab.ts
maestro-cli/src/services/auth-manager.ts
maestro-cli/src/services/firebase-client.ts
maestro-cli/src/services/collab-sync.ts
maestro-cli/src/types/collab.ts

# Server
maestro-server/src/domain/repositories/IProjectLinkRepository.ts
maestro-server/src/infrastructure/repositories/FileSystemProjectLinkRepository.ts
maestro-server/src/application/services/ProjectLinkService.ts
maestro-server/src/api/projectLinkRoutes.ts
maestro-server/src/api/authRoutes.ts

# UI
maestro-ui/src/services/firebase.ts
maestro-ui/src/stores/useCollabStore.ts
maestro-ui/src/hooks/useCollabAuth.ts
maestro-ui/src/hooks/useCollabProject.ts
maestro-ui/src/hooks/useCollabTasks.ts
maestro-ui/src/hooks/useCollabTeamMembers.ts
maestro-ui/src/hooks/useCollabActivity.ts
maestro-ui/src/hooks/useFirestore.ts
maestro-ui/src/components/maestro/collab/CollabPanel.tsx
maestro-ui/src/components/maestro/collab/CollabAuthGate.tsx
maestro-ui/src/components/maestro/collab/CollabProjectLinker.tsx
maestro-ui/src/components/maestro/collab/CollabTaskList.tsx
maestro-ui/src/components/maestro/collab/CollabTaskItem.tsx
maestro-ui/src/components/maestro/collab/CollabTeamMemberList.tsx
maestro-ui/src/components/maestro/collab/CollabDocList.tsx
maestro-ui/src/components/maestro/collab/CollabActivityFeed.tsx
maestro-ui/src/components/maestro/collab/CollabSettings.tsx
maestro-ui/src/components/maestro/collab/CollabInviteModal.tsx
maestro-ui/src/components/maestro/collab/PublishTaskModal.tsx
maestro-ui/src/components/maestro/collab/PublishTeamMemberModal.tsx

# Shared / Config
firestore.rules
firestore.indexes.json
```

### Modified Files

```
# CLI
maestro-cli/src/index.ts                          — Register auth + collab commands
maestro-cli/src/prompting/command-catalog.ts       — Add auth + collab command definitions
maestro-cli/package.json                           — Add firebase dependency

# Server
maestro-server/src/container.ts                    — Wire ProjectLinkRepository + service
maestro-server/src/server.ts                       — Mount auth + project-link routes
maestro-server/src/domain/events/DomainEvents.ts   — Add collab domain events
maestro-server/src/api/validation.ts               — Add project link validation schemas

# UI
maestro-ui/src/components/maestro/PanelIconBar.tsx — Add "Online" primary tab
maestro-ui/src/components/maestro/MaestroPanel.tsx — Render CollabPanel for Online tab
maestro-ui/src/stores/initApp.ts                   — Initialize Firebase + collab store
maestro-ui/src/app/types/maestro.ts                — Add collab types
maestro-ui/package.json                            — Add firebase dependency
```

---

## 12. Firebase Setup Steps

### 12.1 Initialize Firebase in Project

```bash
# In repo root
cd /Users/subhang/Desktop/Projects/maestro/agent-maestro
firebase use maestro-5f3fc
firebase init firestore   # Creates firestore.rules + firestore.indexes.json
firebase init auth        # Optional: if we want to export auth config
```

### 12.2 Enable Auth Providers in Console

1. Go to Firebase Console → maestro-5f3fc → Authentication → Sign-in method
2. Enable **Google** provider
3. Enable **GitHub** provider (requires GitHub OAuth app — client ID + secret)

### 12.3 Create Firestore Database

```bash
firebase firestore:databases:create --location=us-central1
```

Or via console: Firebase Console → Firestore → Create Database → Start in production mode

### 12.4 Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

### 12.5 Register Web App in Console

1. Firebase Console → Project Settings → General → Your apps → Add app → Web
2. Name: "Maestro UI"
3. Copy the config object → use in `maestro-ui/src/services/firebase.ts`
4. Same config reused in `maestro-cli/src/services/firebase-client.ts`

### 12.6 Admin SDK (Server-side, Future)

The admin SDK credentials file (`maestro-5f3fc-firebase-adminsdk-fbsvc-3cec57b6fe.json`) is already in the repo root (gitignored). If we ever need server-side Firebase Admin (e.g., for token verification or server-to-Firestore sync):

```typescript
import admin from 'firebase-admin';
import serviceAccount from '../../maestro-5f3fc-firebase-adminsdk-fbsvc-3cec57b6fe.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```

For now, the plan uses **client SDK only** (in UI and CLI). Admin SDK is reserved for Phase 6+ if we add server-side Firestore sync.

---

## 13. Detailed CLI Command Implementations

### 13.1 `maestro auth login`

```typescript
// maestro-cli/src/commands/auth.ts

import { Command } from 'commander';
import { AuthManager } from '../services/auth-manager.js';
import { outputJSON, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import ora from 'ora';

export function registerAuthCommands(program: Command) {
  const auth = program.command('auth').description('Maestro Online authentication');

  auth.command('login')
    .description('Login to Maestro Online (opens browser for OAuth)')
    .option('--provider <provider>', 'Auth provider: google or github', 'google')
    .action(async (cmdOpts) => {
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Opening browser for authentication...').start() : null;

      try {
        const authManager = new AuthManager();
        const result = await authManager.login(cmdOpts.provider);
        
        spinner?.succeed(`Logged in as ${result.email}`);

        if (isJson) {
          outputJSON({ uid: result.uid, email: result.email, displayName: result.displayName });
        } else {
          outputKeyValue('User', result.displayName);
          outputKeyValue('Email', result.email);
          outputKeyValue('UID', result.uid);
          outputKeyValue('Provider', cmdOpts.provider);
        }
      } catch (err) {
        spinner?.fail('Login failed');
        handleError(err, isJson);
      }
    });

  auth.command('logout')
    .description('Logout from Maestro Online')
    .action(async () => {
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      try {
        const authManager = new AuthManager();
        await authManager.logout();
        if (isJson) outputJSON({ success: true });
        else console.log('Logged out successfully.');
      } catch (err) {
        handleError(err, isJson);
      }
    });

  auth.command('status')
    .description('Show current authentication status')
    .action(async () => {
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      try {
        const authManager = new AuthManager();
        const status = await authManager.getStatus();
        
        if (isJson) {
          outputJSON(status);
        } else {
          if (status.isAuthenticated) {
            outputKeyValue('Status', 'Authenticated');
            outputKeyValue('User', status.displayName);
            outputKeyValue('Email', status.email);
            outputKeyValue('UID', status.uid);
            outputKeyValue('Expires', new Date(status.expiresAt).toLocaleString());
          } else {
            console.log('Not authenticated. Run `maestro auth login` to sign in.');
          }
        }
      } catch (err) {
        handleError(err, isJson);
      }
    });

  auth.command('token')
    .description('Print current Firebase ID token (for debugging)')
    .action(async () => {
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      try {
        const authManager = new AuthManager();
        const token = await authManager.getIdToken();
        if (!token) throw new Error('Not authenticated');
        if (isJson) outputJSON({ token });
        else console.log(token);
      } catch (err) {
        handleError(err, isJson);
      }
    });
}
```

### 13.2 `maestro collab` Commands

```typescript
// maestro-cli/src/commands/collab.ts

import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { AuthManager } from '../services/auth-manager.js';
import { FirebaseClient } from '../services/firebase-client.js';
import { CollabSync } from '../services/collab-sync.js';
import { outputJSON, outputTable, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

export function registerCollabCommands(program: Command) {
  const collab = program.command('collab').description('Maestro Online collaboration');

  // --- Status ---
  collab.command('status')
    .description('Show collaboration status for current project')
    .action(async () => {
      await guardCommand('collab:status');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      try {
        const authManager = new AuthManager();
        const authStatus = await authManager.getStatus();
        
        // Get project link from local server
        let link = null;
        if (projectId) {
          try {
            link = await api.get(`/api/projects/${projectId}/link`);
          } catch { /* not linked */ }
        }
        
        if (isJson) {
          outputJSON({ auth: authStatus, projectLink: link });
        } else {
          outputKeyValue('Auth', authStatus.isAuthenticated ? `${authStatus.email}` : 'Not logged in');
          if (link) {
            outputKeyValue('Online Project', link.onlineProjectName);
            outputKeyValue('Online Project ID', link.onlineProjectId);
            outputKeyValue('Linked Since', link.linkedAt);
            outputKeyValue('Sync', link.syncEnabled ? 'Enabled' : 'Disabled');
          } else {
            outputKeyValue('Online Project', 'Not linked');
          }
        }
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // --- Create Online Project ---
  collab.command('create-project <name>')
    .description('Create a new online project in Maestro Online')
    .option('--desc <description>', 'Project description')
    .action(async (name, cmdOpts) => {
      await guardCommand('collab:create-project');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Creating online project...').start() : null;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        const project = await firebase.createOnlineProject(name, cmdOpts.desc);
        
        spinner?.succeed('Online project created');
        if (isJson) {
          outputJSON(project);
        } else {
          outputKeyValue('ID', project.id);
          outputKeyValue('Name', project.name);
          console.log(`\nLink with: maestro collab link ${project.id}`);
        }
      } catch (err) {
        spinner?.fail('Failed to create online project');
        handleError(err, isJson);
      }
    });

  // --- List Online Projects ---
  collab.command('list-projects')
    .description('List online projects you have access to')
    .action(async () => {
      await guardCommand('collab:list-projects');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Fetching online projects...').start() : null;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        const projects = await firebase.listOnlineProjects();
        spinner?.stop();
        
        if (isJson) {
          outputJSON(projects);
        } else {
          if (projects.length === 0) {
            console.log('No online projects found. Create one with: maestro collab create-project "<name>"');
          } else {
            outputTable(
              ['ID', 'Name', 'Role', 'Created'],
              projects.map(p => [p.id, p.name, p.role || 'owner', p.createdAt])
            );
          }
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // --- Link ---
  collab.command('link <onlineProjectId>')
    .description('Link current local project to an online project')
    .action(async (onlineProjectId) => {
      await guardCommand('collab:link');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      if (!projectId) {
        console.error('No project context. Use --project <id> or set MAESTRO_PROJECT_ID.');
        process.exit(1);
      }
      
      const spinner = !isJson ? ora('Linking project...').start() : null;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        // Verify online project exists and user has access
        const onlineProject = await firebase.getOnlineProject(onlineProjectId);
        
        // Create link via local server
        await api.post(`/api/projects/${projectId}/link`, {
          onlineProjectId,
          onlineProjectName: onlineProject.name,
          linkedBy: auth.uid,
        });
        
        spinner?.succeed(`Linked to "${onlineProject.name}"`);
        if (isJson) outputJSON({ success: true, onlineProjectId, onlineProjectName: onlineProject.name });
      } catch (err) {
        spinner?.fail('Failed to link project');
        handleError(err, isJson);
      }
    });

  // --- Unlink ---
  collab.command('unlink')
    .description('Unlink current project from online project')
    .action(async () => {
      await guardCommand('collab:unlink');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      if (!projectId) {
        console.error('No project context.');
        process.exit(1);
      }
      
      try {
        await api.delete(`/api/projects/${projectId}/link`);
        if (isJson) outputJSON({ success: true });
        else console.log('Project unlinked from online project.');
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // --- Invite Collaborator ---
  collab.command('invite <email>')
    .description('Invite a collaborator to the linked online project')
    .option('--role <role>', 'Role: owner, editor, or viewer', 'editor')
    .action(async (email, cmdOpts) => {
      await guardCommand('collab:invite');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        // Get linked online project
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked. Run `maestro collab link` first.');
        
        await firebase.inviteCollaborator(link.onlineProjectId, email, cmdOpts.role);
        
        if (isJson) outputJSON({ success: true, email, role: cmdOpts.role });
        else console.log(`Invited ${email} as ${cmdOpts.role}.`);
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // --- Remove Collaborator ---
  collab.command('remove <email>')
    .description('Remove a collaborator from the online project')
    .action(async (email) => {
      await guardCommand('collab:remove');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        await firebase.removeCollaborator(link.onlineProjectId, email);
        
        if (isJson) outputJSON({ success: true, email });
        else console.log(`Removed ${email} from project.`);
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // --- List Collaborators ---
  collab.command('collaborators')
    .description('List collaborators on the linked online project')
    .action(async () => {
      await guardCommand('collab:collaborators');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        const collaborators = await firebase.listCollaborators(link.onlineProjectId);
        
        if (isJson) {
          outputJSON(collaborators);
        } else {
          outputTable(
            ['Email', 'Name', 'Role', 'Joined'],
            collaborators.map(c => [c.email, c.displayName, c.role, c.joinedAt])
          );
        }
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // --- Publish Task ---
  collab.command('publish-task <taskId>')
    .description('Publish a local task to the online project')
    .option('--include-children', 'Also publish child tasks')
    .action(async (taskId, cmdOpts) => {
      await guardCommand('collab:publish-task');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      const spinner = !isJson ? ora('Publishing task...').start() : null;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        const sync = new CollabSync(firebase, auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        // Fetch local task
        const task = await api.get(`/api/tasks/${taskId}`);
        
        // Publish to Firestore
        await sync.publishTask(link.onlineProjectId, task);
        
        // Optionally publish children
        if (cmdOpts.includeChildren) {
          const children = await api.get(`/api/tasks?parentId=${taskId}&projectId=${projectId}`);
          for (const child of children) {
            await sync.publishTask(link.onlineProjectId, child);
          }
          spinner?.succeed(`Published task + ${children.length} children`);
        } else {
          spinner?.succeed('Task published');
        }
        
        if (isJson) outputJSON({ success: true, taskId });
      } catch (err) {
        spinner?.fail('Failed to publish task');
        handleError(err, isJson);
      }
    });

  // --- Unpublish Task ---
  collab.command('unpublish-task <taskId>')
    .description('Remove a task from the online project')
    .action(async (taskId) => {
      await guardCommand('collab:unpublish-task');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        await firebase.unpublishTask(link.onlineProjectId, taskId);
        
        if (isJson) outputJSON({ success: true, taskId });
        else console.log('Task unpublished from online project.');
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // --- Pull Tasks ---
  collab.command('pull-tasks')
    .description('Pull shared tasks from online project into local')
    .option('--status <status>', 'Filter by status')
    .action(async (cmdOpts) => {
      await guardCommand('collab:pull-tasks');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      const spinner = !isJson ? ora('Pulling shared tasks...').start() : null;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        const sync = new CollabSync(firebase, auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        const result = await sync.pullTasks(link.onlineProjectId, projectId, cmdOpts.status);
        
        spinner?.succeed(`Pulled ${result.total} tasks (${result.created} new, ${result.updated} updated)`);
        if (isJson) outputJSON(result);
      } catch (err) {
        spinner?.fail('Failed to pull tasks');
        handleError(err, isJson);
      }
    });

  // --- Publish Team Member ---
  collab.command('publish-team-member <teamMemberId>')
    .description('Publish a local team member to the online project')
    .action(async (teamMemberId) => {
      await guardCommand('collab:publish-team-member');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        const sync = new CollabSync(firebase, auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        const member = await api.get(`/api/team-members/${teamMemberId}?projectId=${projectId}`);
        await sync.publishTeamMember(link.onlineProjectId, member);
        
        if (isJson) outputJSON({ success: true, teamMemberId });
        else console.log(`Team member "${member.name}" published.`);
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // --- Unpublish Team Member ---
  collab.command('unpublish-team-member <teamMemberId>')
    .description('Remove a team member from the online project')
    .action(async (teamMemberId) => {
      await guardCommand('collab:unpublish-team-member');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        await firebase.unpublishTeamMember(link.onlineProjectId, teamMemberId);
        
        if (isJson) outputJSON({ success: true, teamMemberId });
        else console.log('Team member unpublished.');
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // --- Pull Team Members ---
  collab.command('pull-team-members')
    .description('Pull shared team members from online project')
    .action(async () => {
      await guardCommand('collab:pull-team-members');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      const spinner = !isJson ? ora('Pulling shared team members...').start() : null;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        const sync = new CollabSync(firebase, auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        const result = await sync.pullTeamMembers(link.onlineProjectId, projectId);
        
        spinner?.succeed(`Pulled ${result.total} team members (${result.created} new, ${result.updated} updated)`);
        if (isJson) outputJSON(result);
      } catch (err) {
        spinner?.fail('Failed to pull team members');
        handleError(err, isJson);
      }
    });

  // --- Publish Doc ---
  collab.command('publish-doc <title>')
    .description('Publish a document to the online project')
    .requiredOption('--file <filePath>', 'Path to document file')
    .option('--entity-type <type>', 'Entity type: task, session, or general', 'general')
    .option('--entity-id <id>', 'Entity ID this doc belongs to')
    .action(async (title, cmdOpts) => {
      await guardCommand('collab:publish-doc');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        const fs = await import('fs');
        const content = fs.readFileSync(cmdOpts.file, 'utf-8');
        
        await firebase.publishDoc(link.onlineProjectId, {
          title,
          content,
          entityType: cmdOpts.entityType,
          entityId: cmdOpts.entityId,
          createdBy: auth.uid,
          updatedBy: auth.uid,
        });
        
        if (isJson) outputJSON({ success: true, title });
        else console.log(`Document "${title}" published.`);
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // --- Activity Feed ---
  collab.command('activity')
    .description('Show recent activity from the online project')
    .option('--limit <n>', 'Number of events to show', '20')
    .action(async (cmdOpts) => {
      await guardCommand('collab:activity');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      
      try {
        const authManager = new AuthManager();
        const auth = await authManager.requireAuth();
        const firebase = new FirebaseClient(auth);
        
        const link = await api.get(`/api/projects/${projectId}/link`);
        if (!link) throw new Error('Project not linked.');
        
        const events = await firebase.getActivity(link.onlineProjectId, parseInt(cmdOpts.limit));
        
        if (isJson) {
          outputJSON(events);
        } else {
          if (events.length === 0) {
            console.log('No activity yet.');
          } else {
            for (const event of events) {
              const time = new Date(event.timestamp).toLocaleString();
              console.log(`  [${time}] ${event.actorName}: ${event.message}`);
            }
          }
        }
      } catch (err) {
        handleError(err, isJson);
      }
    });
}
```

### 13.3 Auth Manager Service

```typescript
// maestro-cli/src/services/auth-manager.ts

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import http from 'http';
import open from 'open';

interface AuthCache {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  provider: string;
}

interface AuthStatus {
  isAuthenticated: boolean;
  uid?: string;
  email?: string;
  displayName?: string;
  expiresAt?: number;
}

const AUTH_FILE = join(homedir(), '.maestro', 'auth.json');

export class AuthManager {
  
  async login(provider: string = 'google'): Promise<AuthCache> {
    // 1. Start local callback server
    // 2. Open browser to Firebase Auth URL with redirect to localhost
    // 3. Receive OAuth callback with tokens
    // 4. Exchange for Firebase credentials
    // 5. Write to AUTH_FILE
    // 6. Register user in Firestore /users/{uid}
    // Implementation uses Firebase client SDK signInWithCustomToken
    // or a lightweight OAuth flow with local HTTP server
    throw new Error('TODO: implement OAuth browser flow');
  }
  
  async logout(): Promise<void> {
    if (existsSync(AUTH_FILE)) {
      unlinkSync(AUTH_FILE);
    }
  }
  
  async getStatus(): Promise<AuthStatus> {
    const cache = this.readCache();
    if (!cache) return { isAuthenticated: false };
    
    // Check if token is expired
    if (Date.now() > cache.expiresAt) {
      // Try to refresh
      try {
        const refreshed = await this.refreshToken(cache.refreshToken);
        return { isAuthenticated: true, ...refreshed };
      } catch {
        return { isAuthenticated: false };
      }
    }
    
    return {
      isAuthenticated: true,
      uid: cache.uid,
      email: cache.email,
      displayName: cache.displayName,
      expiresAt: cache.expiresAt,
    };
  }
  
  async getIdToken(): Promise<string | null> {
    const cache = this.readCache();
    if (!cache) return null;
    
    if (Date.now() > cache.expiresAt) {
      const refreshed = await this.refreshToken(cache.refreshToken);
      return refreshed.idToken;
    }
    
    return cache.idToken;
  }
  
  async requireAuth(): Promise<AuthCache> {
    const cache = this.readCache();
    if (!cache) throw new Error('Not authenticated. Run `maestro auth login` first.');
    
    if (Date.now() > cache.expiresAt) {
      return await this.refreshToken(cache.refreshToken);
    }
    
    return cache;
  }
  
  private readCache(): AuthCache | null {
    try {
      if (!existsSync(AUTH_FILE)) return null;
      return JSON.parse(readFileSync(AUTH_FILE, 'utf-8'));
    } catch {
      return null;
    }
  }
  
  private writeCache(cache: AuthCache): void {
    const dir = join(homedir(), '.maestro');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(AUTH_FILE, JSON.stringify(cache, null, 2), { mode: 0o600 });
  }
  
  private async refreshToken(refreshToken: string): Promise<AuthCache> {
    // Call Firebase token refresh endpoint:
    // POST https://securetoken.googleapis.com/v1/token?key=<API_KEY>
    // Body: grant_type=refresh_token&refresh_token=<refreshToken>
    throw new Error('TODO: implement token refresh');
  }
}
```

### 13.4 CollabSync Service

```typescript
// maestro-cli/src/services/collab-sync.ts

import { FirebaseClient } from './firebase-client.js';
import { api } from '../api.js';

interface SyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
}

export class CollabSync {
  constructor(
    private firebase: FirebaseClient,
    private auth: { uid: string; displayName: string }
  ) {}
  
  async publishTask(onlineProjectId: string, localTask: any): Promise<void> {
    const sharedTask = this.mapLocalTaskToShared(localTask);
    await this.firebase.publishTask(onlineProjectId, sharedTask);
    await this.firebase.logActivity(onlineProjectId, {
      type: 'task_created',
      actorUid: this.auth.uid,
      actorName: this.auth.displayName,
      entityId: localTask.id,
      entityType: 'task',
      message: `published task "${localTask.title}"`,
    });
  }
  
  async pullTasks(onlineProjectId: string, localProjectId: string, statusFilter?: string): Promise<SyncResult> {
    const sharedTasks = await this.firebase.getSharedTasks(onlineProjectId, statusFilter ? { status: statusFilter } : undefined);
    
    let created = 0, updated = 0, skipped = 0;
    
    for (const sharedTask of sharedTasks) {
      try {
        // Check if task already exists locally
        const existing = await api.get(`/api/tasks/${sharedTask.id}`).catch(() => null);
        
        if (existing) {
          // Update if remote is newer
          if (sharedTask.updatedAt > existing.updatedAt) {
            await api.patch(`/api/tasks/${sharedTask.id}`, this.mapSharedTaskToLocal(sharedTask, localProjectId));
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create locally
          await api.post('/api/tasks', this.mapSharedTaskToLocal(sharedTask, localProjectId));
          created++;
        }
      } catch {
        skipped++;
      }
    }
    
    return { total: sharedTasks.length, created, updated, skipped };
  }
  
  async publishTeamMember(onlineProjectId: string, localMember: any): Promise<void> {
    const shared = this.mapLocalMemberToShared(localMember);
    await this.firebase.publishTeamMember(onlineProjectId, shared);
    await this.firebase.logActivity(onlineProjectId, {
      type: 'member_published',
      actorUid: this.auth.uid,
      actorName: this.auth.displayName,
      entityId: localMember.id,
      entityType: 'team-member',
      message: `published team member "${localMember.name}"`,
    });
  }
  
  async pullTeamMembers(onlineProjectId: string, localProjectId: string): Promise<SyncResult> {
    const sharedMembers = await this.firebase.getSharedTeamMembers(onlineProjectId);
    
    let created = 0, updated = 0, skipped = 0;
    
    for (const member of sharedMembers) {
      try {
        const existing = await api.get(`/api/team-members/${member.id}?projectId=${localProjectId}`).catch(() => null);
        
        if (existing) {
          await api.patch(`/api/team-members/${member.id}`, this.mapSharedMemberToLocal(member, localProjectId));
          updated++;
        } else {
          await api.post('/api/team-members', this.mapSharedMemberToLocal(member, localProjectId));
          created++;
        }
      } catch {
        skipped++;
      }
    }
    
    return { total: sharedMembers.length, created, updated, skipped };
  }
  
  private mapLocalTaskToShared(task: any): any {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      parentId: task.parentId,
      teamMemberIds: task.teamMemberIds || [],
      dueDate: task.dueDate,
      referenceTaskIds: task.referenceTaskIds,
      createdBy: this.auth.uid,
      updatedBy: this.auth.uid,
    };
  }
  
  private mapSharedTaskToLocal(shared: any, projectId: string): any {
    return {
      id: shared.id,
      projectId,
      title: shared.title,
      description: shared.description,
      status: shared.status,
      priority: shared.priority,
      parentId: shared.parentId,
      teamMemberIds: shared.teamMemberIds,
      dueDate: shared.dueDate,
      referenceTaskIds: shared.referenceTaskIds,
    };
  }
  
  private mapLocalMemberToShared(member: any): any {
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      avatar: member.avatar,
      mode: member.mode,
      model: member.model,
      agentTool: member.agentTool,
      identity: member.identity,
      capabilities: member.capabilities,
      publishedBy: this.auth.uid,
      updatedBy: this.auth.uid,
    };
  }
  
  private mapSharedMemberToLocal(member: any, projectId: string): any {
    return {
      projectId,
      name: member.name,
      role: member.role,
      avatar: member.avatar,
      mode: member.mode,
      model: member.model,
      agentTool: member.agentTool,
      identity: member.identity,
      capabilities: member.capabilities,
    };
  }
}
```

### 13.5 Registration in index.ts

```typescript
// Add to maestro-cli/src/index.ts
import { registerAuthCommands } from './commands/auth.js';
import { registerCollabCommands } from './commands/collab.js';

// In the command registration block:
registerAuthCommands(program);
registerCollabCommands(program);
```

---

## 14. Default Excluded Commands by Mode (Collab)

```typescript
// Update DEFAULT_EXCLUDED_COMMANDS_BY_MODE in command-catalog.ts
const DEFAULT_EXCLUDED_COMMANDS_BY_MODE: Partial<Record<AgentMode, string[]>> = {
  'coordinated-coordinator': ['session:spawn'],
  // Auth commands available to all modes (agents may need to check auth status)
  // Collab write commands restricted from workers by default:
  'worker': ['collab:create-project', 'collab:link', 'collab:unlink', 'collab:invite', 'collab:remove'],
  'coordinated-worker': ['collab:create-project', 'collab:link', 'collab:unlink', 'collab:invite', 'collab:remove'],
};
```

---

## 15. Open Questions & Future Considerations

### Near-term
- **Invite by email vs. link:** Should we support invite links (e.g., `maestro collab join <invite-code>`) in addition to email invites?
- **Auto-sync toggle:** Should there be a `maestro collab auto-sync enable/disable` to automatically publish/pull on local task changes?
- **Conflict UI:** When pulling tasks that conflict with local changes, should we show a diff/merge UI?

### Future (Post-MVP)
- **Shared sessions visibility:** Read-only session status/logs visible to collaborators
- **Comments on tasks:** Firestore subcollection for threaded comments
- **File attachments:** Firebase Storage for images/files attached to tasks
- **Webhooks/notifications:** Firebase Cloud Functions to send Slack/email notifications
- **Server-side sync:** Upgrade server to sync with Firestore directly (eliminates need for CLI pull/push)
- **Offline queue:** Queue mutations when offline, replay on reconnect
