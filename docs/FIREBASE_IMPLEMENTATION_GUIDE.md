# Firebase Implementation Guide - Step by Step

This guide walks through implementing the Firebase cloud architecture for Maestro.

## Prerequisites

- Firebase account (free tier to start)
- Node.js 18+
- Access to Google Cloud Console

---

## Step 1: Firebase Project Setup (30 minutes)

### 1.1 Create Firebase Project

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Create new project (or use console)
firebase projects:create maestro-app
```

**Or via Console:**
1. Go to https://console.firebase.google.com
2. Click "Add Project"
3. Name: "Maestro"
4. Enable Google Analytics (recommended)
5. Click "Create Project"

### 1.2 Enable Services

**In Firebase Console:**

1. **Firestore Database**
   - Go to Firestore Database
   - Click "Create Database"
   - Choose "Production mode"
   - Select region (choose closest to users)
   - Click "Enable"

2. **Realtime Database**
   - Go to Realtime Database
   - Click "Create Database"
   - Choose location
   - Start in "Locked mode"
   - Click "Enable"

3. **Authentication**
   - Go to Authentication
   - Click "Get Started"
   - Enable providers:
     - Email/Password ✓
     - Google ✓
     - GitHub ✓

4. **Storage**
   - Go to Storage
   - Click "Get Started"
   - Start in "Production mode"
   - Choose location
   - Click "Done"

5. **Hosting** (for marketing site)
   - Go to Hosting
   - Click "Get Started"
   - Follow setup wizard

### 1.3 Get Config

1. Go to Project Settings (gear icon)
2. Scroll to "Your apps"
3. Click web icon (</>)
4. Register app: "Maestro Web"
5. Copy config object:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "maestro-app.firebaseapp.com",
  projectId: "maestro-app",
  storageBucket: "maestro-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  databaseURL: "https://maestro-app-default-rtdb.firebaseio.com"
};
```

---

## Step 2: Install Dependencies

### 2.1 Desktop App (maestro-ui)

```bash
cd maestro-ui
npm install firebase
npm install --save-dev @types/firebase
```

### 2.2 Create Shared Package (for code reuse)

```bash
# In root directory
mkdir packages
cd packages
mkdir maestro-firebase
cd maestro-firebase

npm init -y
npm install firebase zod
npm install --save-dev typescript @types/node

# Add to workspace root package.json
# "workspaces": ["maestro-ui", "maestro-server", "maestro-cli", "packages/maestro-firebase"]
```

---

## Step 3: Firebase Service Layer

### 3.1 Create Firebase Config

```typescript
// packages/maestro-firebase/src/config.ts
export const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL
};
```

### 3.2 Create Types

```typescript
// packages/maestro-firebase/src/types.ts
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  projectId: string;
  assignedTo?: string;
  createdBy: string;
  parentId?: string;
  childrenIds: string[];
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  members: string[];
  createdAt: Date;
  updatedAt: Date;
  settings?: {
    defaultStrategy?: 'simple' | 'queue';
    notifications?: boolean;
  };
}

export interface Session {
  id: string;
  projectId: string;
  taskIds: string[];
  userId: string;
  role: 'worker' | 'orchestrator';
  strategy: 'simple' | 'queue';
  status: 'idle' | 'working' | 'completed' | 'error';
  startedAt: Date;
  completedAt?: Date;
  timeline: TimelineEvent[];
  environment?: Record<string, any>;
}

export interface TimelineEvent {
  timestamp: Date;
  type: 'started' | 'progress' | 'completed' | 'blocked' | 'error';
  message: string;
  data?: any;
}
```

### 3.3 Create Firebase Service

```typescript
// packages/maestro-firebase/src/FirebaseService.ts
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  enableIndexedDbPersistence,
  Timestamp
} from 'firebase/firestore';
import {
  getDatabase,
  Database,
  ref,
  set,
  get,
  onValue,
  off,
  update as rtdbUpdate
} from 'firebase/database';
import {
  getStorage,
  FirebaseStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { firebaseConfig } from './config';
import { Task, Project, Session } from './types';

export class FirebaseService {
  private app: FirebaseApp;
  private firestore: Firestore;
  private rtdb: Database;
  private storage: FirebaseStorage;
  private auth: Auth;
  private unsubscribers: Map<string, () => void> = new Map();

  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.firestore = getFirestore(this.app);
    this.rtdb = getDatabase(this.app);
    this.storage = getStorage(this.app);
    this.auth = getAuth(this.app);

    // Enable offline persistence
    this.enableOfflineSupport();
  }

  private async enableOfflineSupport() {
    try {
      await enableIndexedDbPersistence(this.firestore);
      console.log('✓ Offline persistence enabled');
    } catch (err: any) {
      if (err.code === 'failed-precondition') {
        console.warn('Offline persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Offline persistence not supported in this browser');
      }
    }
  }

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  async signIn(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    return result.user;
  }

  async signUp(email: string, password: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    // Create user profile in Firestore
    await setDoc(doc(this.firestore, 'users', result.user.uid), {
      email: result.user.email,
      createdAt: Timestamp.now(),
      plan: 'free'
    });
    return result.user;
  }

  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);

    // Check if user profile exists, create if not
    const userDoc = await getDoc(doc(this.firestore, 'users', result.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(this.firestore, 'users', result.user.uid), {
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        createdAt: Timestamp.now(),
        plan: 'free'
      });
    }

    return result.user;
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return this.auth.onAuthStateChanged(callback);
  }

  // ============================================================
  // PROJECTS
  // ============================================================

  async createProject(project: Omit<Project, 'id'>): Promise<string> {
    const projectRef = doc(collection(this.firestore, 'projects'));
    await setDoc(projectRef, {
      ...project,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return projectRef.id;
  }

  async getProject(projectId: string): Promise<Project | null> {
    const projectDoc = await getDoc(doc(this.firestore, 'projects', projectId));
    if (!projectDoc.exists()) return null;
    return { id: projectDoc.id, ...projectDoc.data() } as Project;
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    const q = query(
      collection(this.firestore, 'projects'),
      where('members', 'array-contains', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Project[];
  }

  subscribeToProjects(userId: string, callback: (projects: Project[]) => void): () => void {
    const q = query(
      collection(this.firestore, 'projects'),
      where('members', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      callback(projects);
    });

    return unsubscribe;
  }

  // ============================================================
  // TASKS
  // ============================================================

  async createTask(projectId: string, task: Omit<Task, 'id'>): Promise<string> {
    const taskRef = doc(collection(this.firestore, `projects/${projectId}/tasks`));
    await setDoc(taskRef, {
      ...task,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return taskRef.id;
  }

  async getTask(projectId: string, taskId: string): Promise<Task | null> {
    const taskDoc = await getDoc(
      doc(this.firestore, `projects/${projectId}/tasks`, taskId)
    );
    if (!taskDoc.exists()) return null;
    return { id: taskDoc.id, ...taskDoc.data() } as Task;
  }

  async updateTask(projectId: string, taskId: string, updates: Partial<Task>): Promise<void> {
    await updateDoc(
      doc(this.firestore, `projects/${projectId}/tasks`, taskId),
      {
        ...updates,
        updatedAt: Timestamp.now()
      }
    );
  }

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `projects/${projectId}/tasks`, taskId));
  }

  subscribeToTasks(
    projectId: string,
    callback: (tasks: Task[]) => void,
    filters?: { status?: string; assignedTo?: string }
  ): () => void {
    let q = query(
      collection(this.firestore, `projects/${projectId}/tasks`),
      orderBy('createdAt', 'desc')
    );

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters?.assignedTo) {
      q = query(q, where('assignedTo', '==', filters.assignedTo));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      callback(tasks);
    });

    return unsubscribe;
  }

  // ============================================================
  // SESSIONS
  // ============================================================

  async createSession(session: Omit<Session, 'id'>): Promise<string> {
    const sessionRef = doc(collection(this.firestore, 'sessions'));
    await setDoc(sessionRef, {
      ...session,
      startedAt: Timestamp.now()
    });

    // Also set up real-time status in RTDB
    await set(ref(this.rtdb, `sessions/${sessionRef.id}`), {
      status: session.status,
      lastHeartbeat: Date.now()
    });

    return sessionRef.id;
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    await updateDoc(doc(this.firestore, 'sessions', sessionId), {
      ...updates,
      updatedAt: Timestamp.now()
    });

    // Update RTDB if status changed
    if (updates.status) {
      await rtdbUpdate(ref(this.rtdb, `sessions/${sessionId}`), {
        status: updates.status,
        lastHeartbeat: Date.now()
      });
    }
  }

  async addTimelineEvent(sessionId: string, event: TimelineEvent): Promise<void> {
    const sessionRef = doc(this.firestore, 'sessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const currentTimeline = sessionDoc.data().timeline || [];
      await updateDoc(sessionRef, {
        timeline: [...currentTimeline, {
          ...event,
          timestamp: Timestamp.now()
        }]
      });
    }
  }

  subscribeToSession(sessionId: string, callback: (session: Session) => void): () => void {
    const unsubscribe = onSnapshot(
      doc(this.firestore, 'sessions', sessionId),
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as Session);
        }
      }
    );
    return unsubscribe;
  }

  // Real-time session status (uses RTDB for low latency)
  subscribeToSessionStatus(
    sessionId: string,
    callback: (status: { status: string; lastHeartbeat: number }) => void
  ): () => void {
    const sessionRef = ref(this.rtdb, `sessions/${sessionId}`);

    onValue(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    });

    // Return cleanup function
    return () => off(sessionRef);
  }

  // ============================================================
  // STORAGE
  // ============================================================

  async uploadFile(path: string, file: Blob): Promise<string> {
    const fileRef = storageRef(this.storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  }

  async deleteFile(path: string): Promise<void> {
    const fileRef = storageRef(this.storage, path);
    await deleteObject(fileRef);
  }

  // ============================================================
  // PRESENCE (Real-time user status)
  // ============================================================

  async setUserPresence(userId: string, online: boolean): Promise<void> {
    await set(ref(this.rtdb, `presence/${userId}`), {
      online,
      lastSeen: Date.now()
    });
  }

  subscribeToPresence(
    userId: string,
    callback: (presence: { online: boolean; lastSeen: number }) => void
  ): () => void {
    const presenceRef = ref(this.rtdb, `presence/${userId}`);

    onValue(presenceRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    });

    return () => off(presenceRef);
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers.clear();
  }
}

// Export singleton instance
export const firebase = new FirebaseService();
```

---

## Step 4: Security Rules

### 4.1 Firestore Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isMember(membersList) {
      return isSignedIn() && request.auth.uid in membersList;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false; // Don't allow deletion via client
    }

    // Projects collection
    match /projects/{projectId} {
      allow read: if isSignedIn() && (
        request.auth.uid == resource.data.owner ||
        request.auth.uid in resource.data.members
      );
      allow create: if isSignedIn() && request.auth.uid == request.resource.data.owner;
      allow update: if isSignedIn() && request.auth.uid == resource.data.owner;
      allow delete: if isSignedIn() && request.auth.uid == resource.data.owner;

      // Tasks subcollection
      match /tasks/{taskId} {
        function isProjectMember() {
          return isSignedIn() && (
            request.auth.uid == get(/databases/$(database)/documents/projects/$(projectId)).data.owner ||
            request.auth.uid in get(/databases/$(database)/documents/projects/$(projectId)).data.members
          );
        }

        allow read: if isProjectMember();
        allow create: if isProjectMember();
        allow update: if isProjectMember();
        allow delete: if isProjectMember();
      }
    }

    // Sessions collection
    match /sessions/{sessionId} {
      allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow create: if isSignedIn() && request.auth.uid == request.resource.data.userId;
      allow update: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow delete: if isSignedIn() && request.auth.uid == resource.data.userId;
    }
  }
}
```

**Deploy rules:**
```bash
firebase deploy --only firestore:rules
```

### 4.2 Realtime Database Rules

```json
{
  "rules": {
    "sessions": {
      "$sessionId": {
        ".read": "auth != null && root.child('sessions').child($sessionId).child('userId').val() === auth.uid",
        ".write": "auth != null && root.child('sessions').child($sessionId).child('userId').val() === auth.uid",
        "userId": {
          ".validate": "newData.val() === auth.uid"
        }
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

**Deploy rules:**
```bash
firebase deploy --only database
```

### 4.3 Storage Rules

```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isValidFileSize(maxSizeMB) {
      return request.resource.size < maxSizeMB * 1024 * 1024;
    }

    // User files
    match /users/{userId}/{allPaths=**} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) && isValidFileSize(100);
    }

    // Project files
    match /projects/{projectId}/{allPaths=**} {
      // TODO: Check if user is project member via Firestore
      allow read: if isSignedIn();
      allow write: if isSignedIn() && isValidFileSize(500);
    }

    // Shared/public files
    match /shared/{allPaths=**} {
      allow read: if isSignedIn();
      allow write: if false; // Only admins via backend
    }
  }
}
```

**Deploy rules:**
```bash
firebase deploy --only storage
```

---

## Step 5: Integrate into Desktop App

### 5.1 Update Environment Variables

```bash
# maestro-ui/.env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=maestro-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=maestro-app
VITE_FIREBASE_STORAGE_BUCKET=maestro-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_DATABASE_URL=https://maestro-app-default-rtdb.firebaseio.com
```

### 5.2 Create Auth Context

```typescript
// maestro-ui/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { firebase } from 'maestro-firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firebase.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const user = await firebase.signIn(email, password);
    setUser(user);
  };

  const signUp = async (email: string, password: string) => {
    const user = await firebase.signUp(email, password);
    setUser(user);
  };

  const signInWithGoogle = async () => {
    const user = await firebase.signInWithGoogle();
    setUser(user);
  };

  const signOut = async () => {
    await firebase.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 5.3 Create Custom Hooks

```typescript
// maestro-ui/src/hooks/useTasks.ts
import { useEffect, useState } from 'react';
import { firebase } from 'maestro-firebase';
import { Task } from 'maestro-firebase/types';

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = firebase.subscribeToTasks(projectId, (tasks) => {
      setTasks(tasks);
      setLoading(false);
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    return unsubscribe;
  }, [projectId]);

  const createTask = async (task: Omit<Task, 'id'>) => {
    return firebase.createTask(projectId, task);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    return firebase.updateTask(projectId, taskId, updates);
  };

  const deleteTask = async (taskId: string) => {
    return firebase.deleteTask(projectId, taskId);
  };

  return { tasks, loading, error, createTask, updateTask, deleteTask };
}
```

### 5.4 Update Zustand Store

```typescript
// maestro-ui/src/store/projectStore.ts
import { create } from 'zustand';
import { firebase } from 'maestro-firebase';
import { Project } from 'maestro-firebase/types';

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;

  loadProjects: (userId: string) => void;
  setCurrentProject: (projectId: string) => void;
  createProject: (project: Omit<Project, 'id'>) => Promise<string>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: true,

  loadProjects: (userId: string) => {
    firebase.subscribeToProjects(userId, (projects) => {
      set({ projects, loading: false });

      // Set current project if not set
      if (!get().currentProject && projects.length > 0) {
        set({ currentProject: projects[0] });
      }
    });
  },

  setCurrentProject: (projectId: string) => {
    const project = get().projects.find(p => p.id === projectId);
    if (project) {
      set({ currentProject: project });
    }
  },

  createProject: async (project: Omit<Project, 'id'>) => {
    const projectId = await firebase.createProject(project);
    return projectId;
  }
}));
```

---

## Step 6: Build Mobile App (React Native)

```bash
# Create React Native app
npx react-native@latest init MaestroMobile --template react-native-template-typescript

cd MaestroMobile

# Install Firebase
npm install @react-native-firebase/app
npm install @react-native-firebase/auth
npm install @react-native-firebase/firestore
npm install @react-native-firebase/database
npm install @react-native-firebase/storage

# Install navigation
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context

# Install UI components
npm install react-native-paper react-native-vector-icons
```

**Configure Firebase for iOS/Android** (follow official docs)

---

## Step 7: Testing

### 7.1 Test Auth Flow

```typescript
// Test sign up
await firebase.signUp('test@example.com', 'password123');

// Test sign in
await firebase.signIn('test@example.com', 'password123');

// Test Google sign in
await firebase.signInWithGoogle();
```

### 7.2 Test Data Operations

```typescript
// Create project
const projectId = await firebase.createProject({
  name: 'Test Project',
  description: 'Testing Firebase',
  owner: userId,
  members: [userId],
  createdAt: new Date(),
  updatedAt: new Date()
});

// Create task
const taskId = await firebase.createTask(projectId, {
  title: 'Test Task',
  description: 'Testing Firebase',
  status: 'pending',
  priority: 'medium',
  projectId,
  createdBy: userId,
  childrenIds: [],
  createdAt: new Date(),
  updatedAt: new Date()
});

// Subscribe to tasks
const unsubscribe = firebase.subscribeToTasks(projectId, (tasks) => {
  console.log('Tasks updated:', tasks);
});

// Update task
await firebase.updateTask(projectId, taskId, { status: 'in_progress' });

// Cleanup
unsubscribe();
```

---

## Step 8: Deploy

```bash
# Deploy all rules
firebase deploy

# Or individually
firebase deploy --only firestore:rules
firebase deploy --only database
firebase deploy --only storage

# Deploy hosting (for marketing site)
firebase deploy --only hosting
```

---

## Cost Estimation

### Free Tier (Spark Plan)
- **Firestore:** 50k reads, 20k writes, 1GB storage per day
- **RTDB:** 1GB storage, 10GB download per month
- **Storage:** 5GB, 1GB download per month
- **Auth:** Unlimited

**Good for:** ~100-500 active users

### Paid (Blaze Plan - Pay as you go)

**100 users (light usage):**
- Firestore: $5-10/month
- RTDB: $5/month
- Storage: $2/month
- **Total:** ~$12-17/month

**1,000 users (moderate usage):**
- Firestore: $50-100/month
- RTDB: $30-50/month
- Storage: $20/month
- **Total:** ~$100-170/month

**10,000 users (heavy usage):**
- Firestore: $500-800/month
- RTDB: $200-400/month
- Storage: $100-200/month
- **Total:** ~$800-1,400/month

---

## Next Steps

1. **Set up Firebase project** ✅
2. **Install dependencies** ✅
3. **Create Firebase service layer** ✅
4. **Set up security rules** ✅
5. **Integrate into desktop app** (next)
6. **Build mobile app** (next)
7. **Test thoroughly** (next)
8. **Deploy** (next)

**Timeline:** 2-3 weeks for full implementation

**Difficulty:** Medium (Firebase is well-documented)

Good luck! 🚀
