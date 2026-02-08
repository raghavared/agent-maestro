# 03 - UI App Resources Testing

**Goal:** Verify the frontend application loads correctly, manages resources, handles window controls, and performs well.

## Prerequisites
- Maestro Server running.
- UI App running (`npm run tauri dev` or `npm run dev`).

## Test Flows

### 1. Application Startup
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | Launch the Application | Window opens. Splash screen (if any) dismisses. Main dashboard loads. | |
| 1.2 | Check Console for Errors | No "Failed to load resource" or React errors in DevTools. | |
| 1.3 | Verify Connection Status | Header indicator shows "Connected" (Green). | |

### 2. Resource Loading & Layout
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 2.1 | Resize Window | Layout adjusts responsively (Sidebars, Terminal, Main Panel). | |
| 2.2 | Check Icons (Tasks, Sessions) | Icons load correctly (no broken image links). | |
| 2.3 | Check Fonts | Typography is consistent with design system. | |

### 3. Window Controls & Closing
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 3.1 | Minimize Window | Window minimizes to dock/taskbar. | |
| 3.2 | Maximize/Restore Window | Window toggles between full screen and windowed mode. | |
| 3.3 | Close Window (`X` button) | Application closes. Processes terminate (check Activity Monitor/Task Manager). | |
| 3.4 | Reload (`Cmd+R` / `Ctrl+R`) | App refreshes state. Reconnects to WebSocket automatically. | |

### 4. Performance
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 4.1 | Create 10+ Tasks quickly | UI updates immediately without lag. | |
| 4.2 | Switch between Tabs (Tasks/Sessions) | Transitions are smooth. | |
| 4.3 | Open multiple Terminal tabs | No significant memory spike or UI freeze. | |

## Success Criteria
- [ ] App launches and connects to server.
- [ ] UI is responsive and assets load.
- [ ] Window controls function as native apps.
- [ ] App closes cleanly.
