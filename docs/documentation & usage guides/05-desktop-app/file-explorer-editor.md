# File Explorer & Code Editor

**Browse files on local and remote machines. Edit code with syntax highlighting.**

---

## File Explorer Panel

Open the file explorer by clicking the **Files** icon in the icon rail. The panel shows a tree view of the current project's working directory.

[screenshot placeholder: File explorer panel showing expanded directory tree with file icons and highlighted active file]

### Browsing Files

- **Click a folder** to expand/collapse it
- **Click a file** to open it in the code editor
- Directories load lazily — entries are fetched when you first expand a folder
- File type icons appear next to each entry based on extension

The tree maintains its state: expanded directories and scroll position persist across panel toggles and session switches.

### File Information

Each entry in the tree shows:
- **File/folder icon** — Color-coded by type (JS, TS, Python, etc.)
- **Name** — The file or directory name
- **Size** — File size (for files)

### Root Directory

The file explorer roots at:
- **Local sessions** — The project's `basePath` (working directory)
- **SSH sessions** — The remote machine's home directory or project path

A breadcrumb at the top shows the current root path. Use the parent directory button to navigate up.

---

## Remote File Browsing (SSH)

When you're connected to a remote machine via SSH, the file explorer automatically switches to browsing the remote filesystem.

[screenshot placeholder: File explorer showing remote files over SSH with SSH indicator]

Everything works the same as local browsing — expand directories, click files to open them — but the files are loaded over your SSH connection.

### File Transfer

Files opened from a remote machine are downloaded to a local cache for editing. The file explorer supports:
- Downloading remote files for viewing and editing
- Drag-and-drop files from your local machine to the remote explorer
- Exporting remote files to your local filesystem via the save dialog

---

## Code Editor

Click any file in the explorer to open it in the built-in Monaco editor (the same editor engine that powers VS Code).

[screenshot placeholder: Monaco code editor showing a TypeScript file with syntax highlighting]

### Features

| Feature | Description |
|---------|-------------|
| **Syntax highlighting** | Supports 50+ languages — TypeScript, Python, Rust, Go, etc. |
| **Multi-file** | Open multiple files and switch between them |
| **Find and replace** | Standard `Cmd+F` / `Cmd+H` search |
| **Minimap** | Code minimap for quick navigation |
| **Line numbers** | Click to select entire lines |
| **Bracket matching** | Automatic bracket pair highlighting |
| **Code folding** | Collapse code blocks by clicking the fold markers |

### Editor Layout

The code editor opens in the main content area, replacing or sharing space with the terminal:

```
┌────────────────────────────────────────────┐
│  filename.ts                          [×]  │
├────────────────────────────────────────────┤
│  1 │ import React from 'react';            │
│  2 │                                       │
│  3 │ export function App() {               │
│  4 │   return <div>Hello</div>;            │
│  5 │ }                                     │
│    │                                       │
└────────────────────────────────────────────┘
```

The active file path is highlighted in the file explorer, so you always know which file you're editing.

### SSH File Editing

When editing a remote file:
1. The file is downloaded to a local temp cache
2. You edit it in the Monaco editor
3. Changes can be saved back to the remote machine

The SSH file cache persists for the duration of your session to avoid redundant downloads.

---

## File Operations

The file explorer supports standard file operations via context actions:

| Operation | Description |
|-----------|-------------|
| **Open** | Click a file to open in the editor |
| **Navigate** | Click folders to expand/collapse the tree |
| **Drag & drop** | Drag files from the explorer into other applications |
| **Save as** | Export files using the system save dialog |

---

## Tips

- **Quick file access** — Use the command palette (`Cmd+K`) to search for and open files by name
- **Active file tracking** — The file explorer highlights the currently edited file
- **Persistent state** — The explorer remembers which directories you had expanded

> **Next:** [Teams & Agent View](./teams-agent-view.md) — Create teams and watch them work together.
