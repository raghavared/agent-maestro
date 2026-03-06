# Settings & Customization

**Make Maestro look and sound the way you want.**

---

Open the settings dialog by clicking the **⚙ gear icon** in the project tab bar. The dialog has four tabs: Theme, Display, Sounds, and Shortcuts.

[screenshot placeholder: Settings dialog showing the Theme tab with style and color pickers]

---

## Theme

Maestro supports multiple visual styles and color themes. The theme system has two layers:

### App Style

Choose the overall visual personality of the interface:

| Style | Description | Icon |
|-------|-------------|------|
| **Terminal** | Neon hacker aesthetic — the default Maestro look | `>_` |
| **Material** | Clean Material Design with solid surfaces | `◐` |
| **Glass** | Frosted glassmorphism with translucent panels | `◇` |
| **Minimal** | Ultra-clean and focused, reduced visual noise | `—` |

[screenshot placeholder: Style picker showing all four styles side by side]

### Color Theme

Each style has its own set of color variants. For the Terminal style, these include:

- **Matrix Green** — Classic green-on-black terminal look
- Additional color variants depending on the selected style

Click a color swatch to apply it instantly. The preview updates in real time.

---

## Display

Control the UI scale. This scales the entire interface — text, panels, buttons, and spacing.

[screenshot placeholder: Display settings showing zoom level options with preview text]

| Level | Scale | Best For |
|-------|-------|----------|
| **Small** | 87.5% | High-density displays, more screen real estate |
| **Normal** | 100% | Default — balanced readability and space |
| **Large** | 112.5% | Larger text and UI elements |
| **Extra Large** | 125% | Maximum readability, presentation mode |

A live preview shows sample text at the selected scale so you can compare before committing.

Click **Reset to Default** to return to 100% if you've changed it.

The zoom level persists across app restarts.

---

## Sounds

Maestro plays notification sounds when agents report events. The sounds settings let you control this.

[screenshot placeholder: Sound settings showing global enable/disable, volume slider, and instrument selection]

### Global Sound Toggle

The **speaker icon** in the project tab bar is a quick mute/unmute toggle. Click it to silence all sounds instantly.

### Sound Settings

In the settings dialog's Sounds tab:
- **Enable/disable** sounds globally
- **Volume slider** — Adjust the master volume
- **Sound preview** — Test what notifications sound like

### Per-Project Sound Settings

Each project can have its own sound configuration. Open project settings (click the gear on the active project tab) and go to the **Sounds** tab.

This lets you:
- Override the global sound settings for a specific project
- Choose a different instrument for each project
- Mute specific projects while keeping others audible

### Team Member Instruments

Each team member can be assigned a unique sound instrument. When that agent sends a progress report, completion, or error, the notification uses their instrument. This makes multi-agent sessions easier to follow by ear — you can tell which agent just finished without looking at the screen.

---

## Shortcuts

The Shortcuts tab in settings shows a reference table of all keyboard shortcuts.

[screenshot placeholder: Shortcuts settings tab showing the full keyboard shortcuts reference table]

This is a read-only reference — see [Command Palette & Keyboard Shortcuts](./command-palette.md) for the full list.

The table shows shortcuts for both macOS and Windows/Linux, organized by action.

---

## Startup Settings

On first launch, Maestro shows a welcome wizard that walks you through initial setup:

[screenshot placeholder: Startup settings overlay showing step 1 (theme selection) and step 2 (sound configuration)]

### Step 1: Theme
- Choose your app style (Terminal, Material, Glass, Minimal)
- Pick a color theme
- Set the UI zoom level

### Step 2: Sound
- Enable or disable notification sounds
- Adjust the volume level

Click **Finish** to save your preferences and start using the app. These can all be changed later in the settings dialog.

---

## Project Settings

Right-click the gear icon on the active project tab, or click it directly, to open project-specific settings.

[screenshot placeholder: Project Settings dialog showing project info and actions]

### Info Tab

| Field | Description |
|-------|-------------|
| **Name** | Project display name |
| **Path** | Filesystem path to the project root |
| **Sessions** | Number of terminal sessions in this project |
| **Created** | When the project was created |
| **Master Project** | Toggle to make this a master project (sessions can access all other projects) |

### Actions

- **Close Project** — Remove the project tab (data is preserved, can be reopened later)
- **Delete Project** — Permanently delete the project and all its data

### Sounds Tab

Configure per-project sound overrides as described above.

---

## Data Persistence

All settings are persisted to `localStorage` and survive app restarts:
- Theme style and color
- Zoom level
- Sound preferences
- Expanded directories in the file explorer
- Panel sizes and positions
- Session ordering

> **Back to:** [App Overview](./app-overview.md) — Full workspace tour.
