# Maestro UI - Data Flow Diagrams

Visual representations of key data flows in the Maestro UI application.

---

## 1. Application Initialization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ App Component Mount                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ useEffect(() => {                                                │
│   initTheme()                                                    │
│   initZoom()                                                     │
│   initSessionStoreRefs(registry, pendingData)                   │
│   const cleanup1 = initApp(registry, pendingData)              │
│   const cleanup2 = initCentralPersistence()                    │
│   const cleanup3 = initWorkspaceViewPersistence()              │
│   return () => { cleanup1(); cleanup2(); cleanup3(); }          │
│ }, [])                                                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│initTheme │  │initZoom  │  │initApp       │
│          │  │          │  │              │
│Load      │  │Load      │  │• Load stores │
│theme     │  │zoom      │  │• Init WS     │
│from      │  │from      │  │• Setup PTY   │
│storage   │  │storage   │  │• Restore     │
│          │  │          │  │  sessions    │
└──────────┘  └──────────┘  └──────┬───────┘
                                   │
                                   ▼
                     ┌──────────────────────────┐
                     │ useMaestroStore.         │
                     │   initWebSocket()        │
                     └──────────┬───────────────┘
                                │
                                ▼
                     ┌──────────────────────────┐
                     │ WebSocket connects to    │
                     │ ws://localhost:3000      │
                     │                          │
                     │ • Automatic reconnection │
                     │ • Event handlers active  │
                     │ • State sync enabled     │
                     └──────────────────────────┘
```

---

## 2. Task Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User: Click "Create Task" button                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI: Open CreateTaskModal                                         │
│  • Form fields: title, description, initialPrompt, priority     │
│  • Optional: parentId (for subtasks)                            │
│  • Optional: model selection (sonnet, opus, haiku)              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ User: Fill form and click "Create"                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI: Call maestroClient.createTask(payload)                      │
│  payload = {                                                     │
│    projectId: string,                                            │
│    title: string,                                                │
│    description: string,                                          │
│    initialPrompt: string,                                        │
│    priority: 'low' | 'medium' | 'high',                         │
│    parentId?: string,                                            │
│    model?: 'sonnet' | 'opus' | 'haiku'                          │
│  }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Client: POST /api/tasks                                      │
│  • Serializes payload to JSON                                   │
│  • Sets Content-Type: application/json                          │
│  • Sends HTTP request                                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server: Receives request                                         │
│  • Validates payload                                            │
│  • Generates task ID (task_xxx)                                 │
│  • Adds timestamps (createdAt, updatedAt)                       │
│  • Sets default status: 'todo'                                  │
│  • Saves to file system (JSON)                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐  ┌──────────────────────┐
│ HTTP Response    │  │ WebSocket Broadcast  │
│                  │  │                      │
│ 200 OK           │  │ Event: task:created  │
│ Body: {          │  │ Payload: {           │
│   id: string,    │  │   id: string,        │
│   projectId,     │  │   projectId,         │
│   title,         │  │   title,             │
│   description,   │  │   description,       │
│   status: 'todo',│  │   status: 'todo',    │
│   priority,      │  │   priority,          │
│   ...            │  │   ...                │
│ }                │  │ }                    │
└────────┬─────────┘  └──────────┬───────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐  ┌──────────────────────┐
│ UI: API Promise  │  │ UI: WebSocket Event  │
│     resolves     │  │     Handler          │
│                  │  │                      │
│ • Modal closes   │  │ useMaestroStore:     │
│ • Success toast  │  │   handleMessage()    │
│                  │  │                      │
│                  │  │ set(prev => ({       │
│                  │  │   tasks: new Map(    │
│                  │  │     prev.tasks       │
│                  │  │   ).set(             │
│                  │  │     task.id, task    │
│                  │  │   )                  │
│                  │  │ }))                  │
└──────────────────┘  └──────────┬───────────┘
                                 │
                                 ▼
                     ┌──────────────────────┐
                     │ React Re-render      │
                     │                      │
                     │ • MaestroPanel       │
                     │ • TaskListItem       │
                     │ • Shows new task     │
                     └──────────────────────┘
```

---

## 3. Session Spawning Flow (CLI-First Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│ User: Click "Work On Task" button                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI: Open WorkOnModal                                            │
│  • Select strategy: 'simple' | 'queue'                          │
│  • Select model: 'sonnet' | 'opus' | 'haiku'                   │
│  • Select skills: ['maestro-worker', ...]                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ User: Click "Start"                                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI: Call maestroClient.spawnSession(payload)                    │
│  payload = {                                                     │
│    projectId: string,                                            │
│    taskIds: string[],                                            │
│    role: 'worker' | 'orchestrator',                             │
│    strategy: 'simple' | 'queue',                                │
│    spawnSource: 'ui' | 'session',                               │
│    sessionName?: string,                                         │
│    skills: string[],                                             │
│    model: 'sonnet' | 'opus' | 'haiku'                           │
│  }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Client: POST /api/sessions/spawn                            │
│  • Sends spawn request to server                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server: Receives spawn request                                  │
│  • Creates session record (JSON file)                           │
│  • Fetches project for working directory                        │
│  • Fetches all tasks for this session                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server: Call Maestro CLI                                        │
│  $ maestro worker init \                                         │
│      --session-id ses_123 \                                     │
│      --task-ids task1,task2 \                                   │
│      --skills maestro-worker                                     │
│                                                                  │
│  CLI generates session manifest:                                │
│    /path/to/.maestro/manifests/ses_123.json                    │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server: Build spawn event data                                  │
│  {                                                               │
│    session: { id, name, status, ... },                          │
│    command: 'maestro',                                           │
│    args: ['worker', 'init'],                                    │
│    cwd: '/project/working/dir',                                 │
│    envVars: {                                                    │
│      MAESTRO_SESSION_ID: 'ses_123',                             │
│      MAESTRO_PROJECT_ID: 'proj_456',                            │
│      MAESTRO_TASK_DATA: '{...task JSON...}',                    │
│      MAESTRO_TASK_IDS: 'task1,task2',                           │
│      MAESTRO_SKILLS: 'maestro-worker',                          │
│      MAESTRO_API_URL: 'http://localhost:3000',                  │
│      MAESTRO_AGENT_ID: 'claude',                                │
│      MAESTRO_AGENT_MODEL: 'sonnet'                              │
│    },                                                            │
│    projectId: 'proj_456',                                       │
│    spawnSource: 'ui'                                            │
│  }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐  ┌──────────────────────┐
│ HTTP Response    │  │ WebSocket Broadcast  │
│                  │  │                      │
│ 200 OK           │  │ Event:               │
│ Body: {          │  │   session:spawn      │
│   success: true, │  │                      │
│   sessionId,     │  │ Payload:             │
│   manifestPath,  │  │   {session, command, │
│   session: {...} │  │    args, cwd,        │
│ }                │  │    envVars, ...}     │
└────────┬─────────┘  └──────────┬───────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐  ┌──────────────────────────────────────────┐
│ UI: API Promise  │  │ UI: WebSocket Event Handler              │
│     resolves     │  │                                          │
│                  │  │ useMaestroStore: handleMessage()         │
│ • Modal closes   │  │   case 'session:spawn':                  │
│ • Success toast  │  │                                          │
│                  │  │   // Store session                       │
│                  │  │   set(prev => ({                         │
│                  │  │     sessions: new Map(prev.sessions)     │
│                  │  │       .set(session.id, session)          │
│                  │  │   }))                                    │
│                  │  │                                          │
│                  │  │   // Spawn terminal                      │
│                  │  │   useSessionStore.getState()             │
│                  │  │     .handleSpawnTerminalSession({        │
│                  │  │       maestroSessionId: session.id,      │
│                  │  │       name: session.name,                │
│                  │  │       command: message.data.command,     │
│                  │  │       args: message.data.args,           │
│                  │  │       cwd: message.data.cwd,             │
│                  │  │       envVars: message.data.envVars,     │
│                  │  │       projectId: message.data.projectId  │
│                  │  │     })                                   │
└──────────────────┘  └──────────────────┬───────────────────────┘
                                         │
                                         ▼
                         ┌────────────────────────────────────────┐
                         │ useSessionStore:                       │
                         │   handleSpawnTerminalSession()         │
                         │                                        │
                         │ 1. Generate UI session ID              │
                         │ 2. Create PTY via Tauri:               │
                         │    invoke('create_pty_session', {      │
                         │      name,                             │
                         │      command: 'maestro',               │
                         │      args: ['worker', 'init'],         │
                         │      cwd,                              │
                         │      envVars                           │
                         │    })                                  │
                         │ 3. Create UI session object            │
                         │ 4. Add to sessions array               │
                         │ 5. Set as active session               │
                         └────────────────┬───────────────────────┘
                                         │
                                         ▼
                         ┌────────────────────────────────────────┐
                         │ Tauri Backend (Rust)                   │
                         │                                        │
                         │ • Creates PTY with portable_pty        │
                         │ • Spawns process: maestro worker init  │
                         │ • Sets environment variables           │
                         │ • Starts background reader thread      │
                         │ • Emits 'pty-output' events to UI      │
                         └────────────────┬───────────────────────┘
                                         │
                                         ▼
                         ┌────────────────────────────────────────┐
                         │ Terminal Displays                      │
                         │                                        │
                         │ • xterm.js terminal created            │
                         │ • Attached to PTY output               │
                         │ • Receives data via 'pty-output'       │
                         │ • User sees terminal running           │
                         └────────────────┬───────────────────────┘
                                         │
                                         ▼
                         ┌────────────────────────────────────────┐
                         │ Maestro CLI Execution                  │
                         │                                        │
                         │ 1. Reads MAESTRO_* env vars            │
                         │ 2. Fetches session from server         │
                         │ 3. Loads skills                        │
                         │ 4. Executes pre-spawn hooks            │
                         │ 5. Spawns Claude:                      │
                         │    $ claude code \                     │
                         │        --model sonnet \                │
                         │        --prompt "..." \                │
                         │        --skills maestro-worker         │
                         │ 6. Reports status to server            │
                         │ 7. Streams output to terminal          │
                         └────────────────────────────────────────┘
```

---

## 4. Real-time Task Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Agent (Claude): Updates task status via CLI                     │
│  $ curl -X PATCH http://localhost:3000/api/tasks/task_123 \    │
│    -H "Content-Type: application/json" \                       │
│    -d '{"status": "in_progress", "sessionStatus": "working"}'  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server: Receives PATCH request                                  │
│  • Validates update payload                                     │
│  • Updates task in file system                                  │
│  • Updates 'updatedAt' timestamp                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐  ┌──────────────────────┐
│ HTTP Response    │  │ WebSocket Broadcast  │
│                  │  │                      │
│ 200 OK           │  │ Event: task:updated  │
│ Body: {          │  │ Payload: {           │
│   id: 'task_123',│  │   id: 'task_123',    │
│   status:        │  │   status:            │
│   'in_progress', │  │   'in_progress',     │
│   sessionStatus: │  │   sessionStatus:     │
│   'working',     │  │   'working',         │
│   ...            │  │   ...                │
│ }                │  │ }                    │
└──────────────────┘  └──────────┬───────────┘
                                 │
                                 ▼
                     ┌──────────────────────┐
                     │ UI: WebSocket Event  │
                     │     Handler          │
                     │                      │
                     │ useMaestroStore:     │
                     │   handleMessage()    │
                     │                      │
                     │ case 'task:updated': │
                     │   set(prev => ({     │
                     │     tasks: new Map(  │
                     │       prev.tasks     │
                     │     ).set(           │
                     │       task.id, task  │
                     │     )                │
                     │   }))                │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │ React Re-render      │
                     │                      │
                     │ • MaestroPanel       │
                     │   observes store     │
                     │ • TaskListItem       │
                     │   shows new status   │
                     │ • Status badge       │
                     │   updates color      │
                     │ • Progress indicator │
                     │   animates           │
                     └──────────────────────┘
```

---

## 5. Terminal Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User Types in Terminal (xterm.js)                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ xterm.js: terminal.onData(data => {...})                        │
│  • Captures user input                                          │
│  • Forwards to PTY                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: invoke('send_data_to_pty', { sessionId, data })      │
│  • Tauri IPC call                                               │
│  • Sends data to Rust backend                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tauri Backend (Rust): send_data_to_pty()                       │
│  • Looks up PTY session                                         │
│  • Writes data to PTY master                                    │
│  • pty.master.write_all(data.as_bytes())                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ PTY Process (bash/zsh/maestro)                                 │
│  • Receives input                                               │
│  • Executes command                                             │
│  • Writes output to stdout                                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ PTY Reader Thread (Rust)                                        │
│  loop {                                                          │
│    let output = pty.master.read();                             │
│    emit('pty-output', {                                         │
│      sessionId,                                                 │
│      data: output                                               │
│    });                                                           │
│  }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: listen('pty-output', (event) => {...})               │
│  • Receives PTY output event                                    │
│  • Looks up terminal in registry                               │
│  • Writes to xterm.js                                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ xterm.js: terminal.write(data)                                  │
│  • Parses ANSI escape codes                                     │
│  • Renders text to canvas                                       │
│  • Updates cursor position                                      │
│  • Handles scroll                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ User Sees Output in Terminal                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. State Persistence Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ App Initialization                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ initApp() - Load persisted state                                │
│                                                                  │
│ const savedSessions = localStorage.getItem('sessions');         │
│ if (savedSessions) {                                            │
│   useSessionStore.setState({                                    │
│     sessions: JSON.parse(savedSessions)                        │
│   });                                                            │
│ }                                                                │
│                                                                  │
│ const savedProjects = localStorage.getItem('projects');         │
│ if (savedProjects) {                                            │
│   useProjectStore.setState({                                    │
│     projects: JSON.parse(savedProjects)                        │
│   });                                                            │
│ }                                                                │
│                                                                  │
│ // ... more state loading                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ initCentralPersistence() - Subscribe to store changes           │
│                                                                  │
│ const unsubSession = useSessionStore.subscribe((state) => {     │
│   localStorage.setItem(                                         │
│     'sessions',                                                  │
│     JSON.stringify(state.sessions)                             │
│   );                                                             │
│ });                                                              │
│                                                                  │
│ const unsubProject = useProjectStore.subscribe((state) => {     │
│   localStorage.setItem(                                         │
│     'projects',                                                  │
│     JSON.stringify(state.projects)                             │
│   );                                                             │
│ });                                                              │
│                                                                  │
│ // ... more subscriptions                                       │
│                                                                  │
│ return () => {                                                   │
│   unsubSession();                                               │
│   unsubProject();                                               │
│   // ... cleanup                                                 │
│ };                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ User Interacts with App                                          │
│  • Creates session                                              │
│  • Updates project                                              │
│  • Changes settings                                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Store Update                                                     │
│  useSessionStore.setState({ sessions: [...newSessions] })       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Zustand Subscription Fires                                       │
│  • Persistence callback invoked                                 │
│  • State serialized to JSON                                     │
│  • Saved to localStorage                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ localStorage.setItem('sessions', JSON.stringify(sessions))      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Next App Launch                                                  │
│  • State loaded from localStorage                               │
│  • App restored to previous state                               │
│  • Sessions, projects, settings all preserved                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Component Rendering Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Store State Changes                                              │
│  useMaestroStore.setState({ tasks: updatedTasks })             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Zustand Notifies Subscribers                                     │
│  • All components using this store are notified                 │
│  • Only affected components re-render (selector optimization)   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Component: const tasks = useMaestroStore(s => s.tasks)         │
│  • Selector function runs                                       │
│  • Returns new value                                            │
│  • React detects change                                         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ React Re-render                                                  │
│  • Component function re-executes                               │
│  • New virtual DOM created                                      │
│  • Diffed against previous virtual DOM                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ DOM Updates                                                      │
│  • React applies minimal DOM changes                            │
│  • Only changed elements updated                                │
│  • Browser repaints affected areas                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ User Sees Updated UI                                             │
└─────────────────────────────────────────────────────────────────┘


Example Component Tree:

App
└─ useMaestroStore.tasks changes
   │
   ├─ MaestroPanel
   │  └─ const tasks = useMaestroStore(s => s.tasks)
   │     │
   │     └─ Re-renders with new tasks
   │        │
   │        └─ TaskListItem (for each task)
   │           └─ Shows updated task data
   │
   └─ Other components (NOT using s.tasks)
      └─ Do NOT re-render (selector optimization)
```

---

**Last Updated**: February 8, 2026
