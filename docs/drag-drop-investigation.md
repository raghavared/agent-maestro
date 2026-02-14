# Drag and Drop Issue Investigation

## Symptom
When dragging task cards on the board (TaskBoardOverlay, MultiProjectBoard, ProjectKanbanRow), the cursor changes to an **arrow with a plus mark** (macOS copy cursor) instead of maintaining the expected `grab`/`grabbing` cursor. This happens across all drag-and-drop features in the app.

## Root Cause: Tauri's Native Drag-Drop Handler

The app uses `@crabnebula/tauri-plugin-drag` (v2.1.0) which is initialized **globally** at the Rust level:

```rust
// src-tauri/src/main.rs:77
.plugin(tauri_plugin_drag::init())
```

This plugin registers native OS-level drag-drop handlers on the webview. When HTML5 drag events fire (from `<div draggable>` elements), Tauri's native handler intercepts the drag operation at the OS level **before** the CSS cursor styles can take effect. The OS interprets it as a file/data transfer operation and displays its default copy cursor (arrow + plus).

### Why This Happens

1. **Tauri plugin intercepts at native level**: `tauri_plugin_drag::init()` hooks into the webview's native drag-drop events. It doesn't distinguish between the app's in-page HTML5 drag-and-drop and actual file drag operations.

2. **FileExplorerPanel registers global listeners**: In `FileExplorerPanel.tsx:926-932`, `onDragDropEvent` is registered on both the webview AND window, creating additional native-level drag-drop handling that's always active.

3. **No global `dragover` prevention**: The `e.preventDefault()` calls in `handleDragOver` only apply to specific drop-zone elements. When the drag cursor passes over any area without an `onDragOver` handler (gaps between columns, non-drop-zone UI), the browser/Tauri default takes over.

4. **No custom drag image**: None of the drag handlers call `e.dataTransfer.setDragImage()`. Without this, the browser/OS generates a default ghost image with the system copy cursor.

## Affected Files

| File | Component | Lines |
|------|-----------|-------|
| `maestro-ui/src/components/maestro/TaskBoardOverlay.tsx` | TaskBoardOverlay | 152-193 |
| `maestro-ui/src/components/maestro/MultiProjectBoard.tsx` | UnifiedKanbanView | 399-440 |
| `maestro-ui/src/components/maestro/ProjectKanbanRow.tsx` | ProjectKanbanRow | 89-130 |
| `maestro-ui/src/components/FileExplorerPanel.tsx` | FileExplorerPanel | 803-807, 926-932 |
| `maestro-ui/src-tauri/src/main.rs` | Tauri app builder | 77 |

## Recommended Fix

### Option A: Global drag event prevention (Recommended)

Add a global `dragover` and `drop` prevention in `App.tsx` to stop the browser/Tauri from showing its default drag behavior during in-app drag operations:

```tsx
// In App.tsx, add a useEffect:
useEffect(() => {
  const preventDefaultDrag = (e: DragEvent) => {
    // Only prevent default for in-app drags (not OS file drops)
    if (e.dataTransfer?.types.includes('text/plain')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };
  const preventDefaultDrop = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes('text/plain')) {
      e.preventDefault();
    }
  };
  document.addEventListener('dragover', preventDefaultDrag);
  document.addEventListener('drop', preventDefaultDrop);
  return () => {
    document.removeEventListener('dragover', preventDefaultDrag);
    document.removeEventListener('drop', preventDefaultDrop);
  };
}, []);
```

This ensures the entire document is a valid drop target during in-app drags, preventing Tauri/browser from overriding the cursor. The `text/plain` type check ensures OS file drops (which use `Files` type) are not affected.

### Option B: Custom drag image overlay

Add `setDragImage()` in each `handleDragStart` to use a transparent 1px image, then render a custom React-based drag preview that follows the cursor:

```tsx
const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
  setDraggedTaskId(taskId);
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", taskId);

  // Use transparent drag image to suppress OS cursor
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  e.dataTransfer.setDragImage(img, 0, 0);

  if (e.currentTarget instanceof HTMLElement) {
    e.currentTarget.style.opacity = "0.5";
  }
}, []);
```

### Option C: Scope the Tauri drag plugin

If the Tauri drag plugin is only needed for `FileExplorerPanel`'s native file drag feature, consider removing the global `tauri_plugin_drag::init()` and using a more targeted approach. However, this requires Rust-side changes and the plugin may not support scoped initialization.

### Recommended approach: Combine A + B

1. Add global `dragover`/`drop` prevention in App.tsx (Option A)
2. Add `setDragImage()` with transparent image in all `handleDragStart` handlers (Option B)
3. Add CSS `cursor: grabbing !important` on `body` during drag operations via a class toggle

This combination ensures:
- The Tauri native handler doesn't override the cursor
- No OS ghost image appears
- The CSS cursor styles take effect properly
