# App.tsx Refactoring Guide

## Phase 1: Modular Structure ✅ COMPLETE

### Created Files

#### Types (`src/app/types/`)
- `project.ts` - Project and PersistedSession types
- `session.ts` - Session, PtyOutput, buffer types
- `workspace.ts` - WorkspaceView and storage types
- `recording.ts` - Recording-related types
- `storage.ts` - Persistence and storage types
- `app.ts` - App-level types (Prompts, Env, Assets)
- `index.ts` - Barrel exports

#### Constants (`src/app/constants/`)
- `storage.ts` - LocalStorage keys
- `defaults.ts` - Default values and limits
- `index.ts` - Barrel exports

#### Utils (`src/app/utils/`)
- `id.ts` - ID generation
- `string.ts` - String manipulation utilities
- `github.ts` - GitHub repo parsing
- `semver.ts` - Semantic version comparison
- `network.ts` - Port parsing
- `path.ts` - Path operations
- `env.ts` - Environment variable parsing
- `async.ts` - Async utilities
- `ssh.ts` - SSH command builders
- `project.ts` - Project utilities
- `storage.ts` - Legacy storage loaders
- `workspace.ts` - Workspace view utilities
- `index.ts` - Barrel exports

**Result:** App.tsx reduced from 7,333 → 6,696 lines (637 lines saved)

---

## Phase 2: Component Extraction ✅ COMPLETE

### Created Components (`src/components/app/`)

#### 1. **Sidebar Component** (`Sidebar.tsx`)
Encapsulates the entire left sidebar with:
- Projects section
- Quick prompts section
- Resize handle
- Sessions section

**Props:**
```typescript
{
  sidebarWidth: number;
  projectsListMaxHeight: number;
  projects: Project[];
  activeProjectId: string;
  // ... + 30 more props for callbacks and data
}
```

**Usage Example:**
```tsx
<Sidebar
  sidebarWidth={sidebarWidth}
  projectsListMaxHeight={projectsListMaxHeight}
  projects={projects}
  activeProjectId={activeProjectId}
  activeProject={activeProject}
  environments={environments}
  sessionCountByProject={sessionCountByProject}
  workingAgentCountByProject={workingAgentCountByProject}
  prompts={prompts}
  activeSessionId={activeId}
  agentShortcuts={agentShortcuts}
  projectSessions={projectSessions}
  projectName={activeProject?.title ?? null}
  projectBasePath={activeProject?.basePath ?? null}
  sidebarRef={sidebarRef}
  onNewProject={openNewProject}
  onProjectSettings={openRenameProject}
  onDeleteProject={() => setConfirmDeleteProjectOpen(true)}
  onSelectProject={selectProject}
  onOpenProjectSettings={openProjectSettings}
  onMoveProject={moveProject}
  onSendPrompt={(prompt) => void sendPromptToActive(prompt, "send")}
  onEditPrompt={openPromptEditor}
  onOpenPromptsPanel={() => {
    setSlidePanelTab("prompts");
    setSlidePanelOpen(true);
  }}
  onSelectSession={setActiveId}
  onCloseSession={(id) => void onClose(id)}
  onReorderSessions={onReorderSessions}
  onQuickStart={(effect) => void quickStart(effect)}
  onOpenNewSession={() => {
    setProjectOpen(false);
    setNewOpen(true);
  }}
  onOpenPersistentSessions={() => {
    setPersistentSessionsOpen(true);
    void refreshPersistentSessions();
  }}
  onOpenSshManager={() => {
    setProjectOpen(false);
    setNewOpen(false);
    setSshManagerOpen(true);
  }}
  onOpenAgentShortcuts={() => setAgentShortcutsOpen(true)}
  onOpenManageTerminals={() => setManageTerminalsOpen(true)}
  onResetProjectsListMaxHeight={resetProjectsListMaxHeight}
  onProjectsDividerKeyDown={handleProjectsDividerKeyDown}
  onProjectsDividerPointerDown={handleProjectsDividerPointerDown}
/>
```

#### 2. **Topbar Component** (`Topbar.tsx`)
The top navigation bar with:
- Active project/session display
- Error and notice banners
- Action buttons (Open in Finder, VS Code, File Explorer, Maestro)

**Props:**
```typescript
{
  activeProject: Project | null;
  active: Session | null;
  activeIsSsh: boolean;
  persistenceDisabledReason: string | null;
  secureStorageMode: "keychain" | "plaintext" | null;
  secureStorageRetrying: boolean;
  error: string | null;
  notice: string | null;
  activeWorkspaceView: WorkspaceView | null;
  activeSshTarget: string | null;
  activeRightPanel: "none" | "maestro" | "files";
  // ... + callbacks
}
```

#### 3. **RightPanel Component** (`RightPanel.tsx`)
Right-side panel that shows either:
- Maestro task management
- File explorer

**Props:**
```typescript
{
  activeRightPanel: "none" | "maestro" | "files";
  rightPanelWidth: number;
  activeProject: Project | null;
  activeProjectId: string;
  // ... + panel-specific props and callbacks
}
```

#### 4. **ResizeHandle Component** (`ResizeHandle.tsx`)
Reusable resize handle with accessibility support.

---

## How to Integrate into App.tsx

### Step 1: Add Component Imports

At the top of `App.tsx`, add:

```tsx
import { Sidebar, Topbar, RightPanel, ResizeHandle } from "./components/app";
import type { AgentShortcut, QuickStartPreset } from "./components/app";
```

### Step 2: Replace Sidebar JSX

Find the sidebar section (around line 4767):
```tsx
<aside className="sidebar" ...>
  <ProjectsSection ... />
  <QuickPromptsSection ... />
  <div className="sidebarResizeHandle" ... />
  <SessionsSection ... />
</aside>
```

Replace with:
```tsx
<Sidebar
  sidebarWidth={sidebarWidth}
  projectsListMaxHeight={projectsListMaxHeight}
  projects={projects}
  activeProjectId={activeProjectId}
  {/* ... all other props */}
/>
```

### Step 3: Replace Topbar JSX

Find the topbar section (around line 4866):
```tsx
<div className="topbar">
  <div className="activeTitle">...</div>
  <div className="topbarRight">...</div>
</div>
```

Replace with:
```tsx
<Topbar
  activeProject={activeProject}
  active={active}
  activeIsSsh={activeIsSsh}
  {/* ... all other props */}
/>
```

### Step 4: Replace RightPanel JSX

Find the right panel section (around line 6665):
```tsx
<aside className="rightPanel">
  {activeRightPanel === "maestro" && <MaestroPanel ... />}
  {activeRightPanel === "files" && <FileExplorerPanel ... />}
</aside>
```

Replace with:
```tsx
<RightPanel
  activeRightPanel={activeRightPanel}
  rightPanelWidth={rightPanelWidth}
  {/* ... all other props */}
/>
```

### Step 5: Replace Resize Handles

Find resize handles and replace with:
```tsx
<ResizeHandle
  orientation="vertical"
  label="Resize Sidebar"
  min={MIN_SIDEBAR_WIDTH}
  max={MAX_SIDEBAR_WIDTH}
  current={sidebarWidth}
  onPointerDown={handleSidebarResizePointerDown}
/>
```

---

## Benefits of This Refactoring

### 1. **Improved Maintainability**
- Each component has a single, clear responsibility
- Easier to locate and fix bugs
- Changes to one component don't affect others

### 2. **Better Testability**
- Components can be tested in isolation
- Props clearly define component dependencies
- Easier to mock and test edge cases

### 3. **Code Reusability**
- Components can be reused in other parts of the app
- Utilities and types are available throughout the codebase
- Consistent patterns across components

### 4. **Reduced Cognitive Load**
- Smaller, focused files are easier to understand
- Clear separation of concerns
- Better IDE support and autocomplete

### 5. **Easier Onboarding**
- New developers can understand components independently
- Clear file structure shows app organization
- Type definitions serve as documentation

---

## Next Steps (Future Improvements)

### Phase 3: Custom Hooks (Recommended)
Extract state management into focused hooks:

1. **`useProjects.ts`** - Project CRUD operations
2. **`useSessions.ts`** - Session lifecycle management
3. **`useModals.ts`** - Modal state management
4. **`useWorkspace.ts`** - Workspace view state
5. **`useRecordings.ts`** - Recording management
6. **`useStorage.ts`** - Persistence logic

### Phase 4: Further Component Breakdown
Split larger components:

1. **`TerminalArea.tsx`** - Main terminal display area
2. **`WorkspacePanel.tsx`** - Code editor and file tree
3. **`ModalManager.tsx`** - Centralized modal management
4. **`ErrorBoundary.tsx`** - Error handling component

### Phase 5: Service Layer
Extract Tauri API calls:

1. **`sessionService.ts`** - Session API calls
2. **`projectService.ts`** - Project API calls
3. **`recordingService.ts`** - Recording API calls
4. **`storageService.ts`** - Storage API calls

---

## File Structure After Full Refactoring

```
maestro-ui/src/
├── app/
│   ├── types/           # ✅ Type definitions
│   ├── constants/       # ✅ Configuration
│   ├── utils/          # ✅ Utility functions
│   ├── hooks/          # 🔲 Custom React hooks
│   └── services/       # 🔲 API service layer
├── components/
│   ├── app/            # ✅ App-specific components
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   ├── RightPanel.tsx
│   │   └── ResizeHandle.tsx
│   ├── modals/         # ✅ Modal components (existing)
│   ├── maestro/        # ✅ Maestro components (existing)
│   └── ... (other shared components)
└── App.tsx             # ✅ Simplified main component
```

---

## Estimated Line Count After Full Refactoring

- **Current:** 6,696 lines
- **After component integration:** ~5,500 lines
- **After custom hooks:** ~3,500 lines
- **After service layer:** ~2,500 lines

**Target:** Reduce main App.tsx to <2,000 lines while improving code quality and maintainability.
