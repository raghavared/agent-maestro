# 🖥️ Maestro Panel - Terminal Theme Redesign

## Design Vision: Cyberpunk Retro Hacker Terminal

Transformed the Maestro Panel from generic React cards into a **bold cyberpunk CLI interface** with authentic terminal aesthetics.

---

## 🎨 Aesthetic Direction

**Theme**: Retro Hacker Terminal meets Cyberpunk - Matrix-inspired DOS nostalgia

**Key Design Elements**:
- **Typography**: JetBrains Mono (monospace) with glowing phosphor effects
- **Colors**:
  - Terminal Green (#00ff41) - primary
  - Amber (#ffb000) - prompts and labels
  - Cyan (#00d9ff) - active tasks
  - Red (#ff3b3b) - errors/blocked
  - Pure Black (#000000) - background
- **Visual Effects**:
  - CRT scanlines
  - Phosphor glow
  - ASCII borders
  - Blinking cursors
  - Command prompt symbols

---

## 📦 Components Updated

### 1. **MaestroPanel.tsx**
Completely redesigned the main panel interface:

#### Terminal Window Chrome
- macOS-style colored window buttons (●●●)
- Dynamic title: `maestro-agent ~/{projectName}`
- Connection status indicator with blinking animation
- ASCII art borders (╔══════╗)

#### Command Bar
Replaced boring buttons with CLI commands:
- `$ new task` - Create new task
- `$ refresh` - Reload tasks
- Real-time stats: `◉ 2  ○ 5  ✓ 12`

#### Empty States
ASCII art boxes instead of bland messages:
```
╔═══════════════════════════════════════╗
║                                       ║
║        NO TASKS IN QUEUE              ║
║                                       ║
║        $ maestro new task             ║
║                                       ║
╚═══════════════════════════════════════╝
```

### 2. **TaskListItem.tsx**
Transformed from cards to terminal-style list output:

#### Terminal Status Symbols
- `○` Pending (IDLE)
- `◉` In Progress (RUN) - pulsing cyan
- `✓` Completed (OK) - glowing green
- `✗` Blocked (ERR) - blinking red

#### Priority Indicators
- `─` Low priority
- `═` Medium priority
- `▓` High priority

#### Command-style Actions
- Agent selector dropdown
- `$ exec` button to execute task
- Menu with commands: `> view`, `> rm -rf`

#### Tree-style Subtasks
```
├─[ ] Implement authentication
├─[✓] Setup database
└─[ ] Write tests
```

### 3. **AgentSelector.tsx**
Added **"which"** agent option:
- Claude
- Jimmy
- Codex
- **which** (spawns terminal without initial command)

Terminal-themed dropdown styling with monospace font.

### 4. **TaskFilters.tsx**
CLI flag-style filters:

```
--filter-status= [all] [idle] [run] [ok] [err]
--priority= [all] [high] [med] [low]
--sort= [updated] [created] [priority]
```

### 5. **CreateTaskModal.tsx**
Cyberpunk modal with:
- Green neon border glow
- CRT scanline overlay
- `$ ` prefix on title
- `--` prefix on all labels
- Terminal-style buttons
- Keyboard hints in monospace

---

## 🎭 Visual Effects Applied

### CRT/Monitor Effects
```css
- Scanline animation (moving lines)
- Phosphor glow (radial gradient)
- Screen flicker (subtle opacity animation)
- Terminal green color bleeding
```

### Interactive States
- **Hover**: Glow intensifies, slight translate
- **Active**: Stronger box-shadow, color shift
- **Disabled**: Dimmed, no glow
- **Focus**: Intense green glow ring

### Animations
- `pulseGlow` - Breathing effect on prompts
- `blinkAlert` - Error indicators
- `cursorBlink` - Typing cursor
- `statusPulse` - Active task indicator
- `scanlineMove` - CRT scanlines
- `terminalDotPulse` - Loading animation

---

## 🚀 New Features

### 1. "which" Agent Option
Spawns a new terminal without running any initial command - perfect for manual execution.

### 2. Enhanced Visual Hierarchy
- Task status immediately visible via symbols and colors
- Priority encoded in visual weight
- Time information at a glance
- Session count badges

### 3. Command-Line UX
- Everything feels like terminal commands
- Lowercase text for authentic CLI feel
- Keyboard shortcuts emphasized
- Monospace font throughout

---

## 🎯 Design Principles

### 1. **Authenticity**
True to retro terminal aesthetics - no modern UI compromises

### 2. **Readability**
Despite bold styling, information hierarchy is crystal clear

### 3. **Functionality**
All original features preserved and enhanced

### 4. **Immersion**
You're not "managing tasks" - you're "executing commands on the mainframe"

---

## 📊 Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Terminal Green | `#00ff41` | Primary, success, completed |
| Terminal Green Dim | `#00cc33` | Secondary text |
| Terminal Amber | `#ffb000` | Prompts, labels, warnings |
| Terminal Cyan | `#00d9ff` | Active/running states |
| Terminal Red | `#ff3b3b` | Errors, blocked, delete |
| Terminal Black | `#000000` | Background |
| Terminal Border | `#003300` | Borders, separators |

---

## 🎨 Typography

**Primary Font**: JetBrains Mono (monospace)
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Letter spacing**: 0.02em - 0.1em for various elements
- **Text shadow**: Glow effects on interactive elements

---

## ✨ Special Effects Breakdown

### Scanlines
```css
repeating-linear-gradient(
  0deg,
  rgba(0, 0, 0, 0.15) 0px,
  rgba(0, 0, 0, 0.15) 1px,
  transparent 1px,
  transparent 2px
)
```
Moves from top to bottom creating CRT monitor effect.

### Phosphor Glow
```css
text-shadow: 0 0 8px var(--terminal-green);
box-shadow: 0 0 12px rgba(0, 255, 65, 0.3);
```
Simulates glowing phosphor on CRT screens.

### Terminal Cursor
Blinking block cursor `█` with animation:
```css
@keyframes cursorBlink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

---

## 🔧 Technical Implementation

### CSS Architecture
- Scoped terminal theme with `.terminalTheme` class
- CSS custom properties for easy customization
- Modular component styling
- Hover/focus state management
- Animation performance optimized

### Component Structure
- Maintained React component hierarchy
- Enhanced with semantic terminal classes
- Backward compatible with existing props
- Progressive enhancement approach

---

## 🎪 User Experience

### Before (React Cards)
- Generic white/blue card interface
- Standard buttons and badges
- Minimal visual hierarchy
- Feels like any other web app

### After (Terminal CLI)
- Authentic hacker terminal aesthetic
- Command-line inspired interactions
- Strong visual hierarchy via symbols/colors
- Feels like you're in The Matrix

---

## 🚀 Next Steps (Optional Enhancements)

1. **Sound Effects**: Terminal beep on actions
2. **Boot Sequence**: Animated startup when opening panel
3. **Command History**: Show previous commands
4. **Auto-complete**: Terminal-style command suggestions
5. **ASCII Art**: More elaborate decorative elements
6. **Matrix Rain**: Background effect on empty states

---

## 📝 Files Modified

1. `/src/components/maestro/MaestroPanel.tsx`
2. `/src/components/maestro/TaskListItem.tsx`
3. `/src/components/maestro/AgentSelector.tsx`
4. `/src/components/maestro/TaskFilters.tsx`
5. `/src/components/maestro/CreateTaskModal.tsx`
6. `/src/styles.css` (added ~700 lines of terminal CSS)

---

## 🎨 Design Inspiration

- **Matrix (1999)**: Green phosphor CRT aesthetic
- **DOS/Unix terminals**: Monospace, command prompts
- **Cyberpunk genre**: Neon glows, dark backgrounds
- **Hacker culture**: Terminal-first interfaces
- **Retro computing**: CRT effects, scanlines

---

**Result**: A distinctive, memorable UI that stands out from generic React apps while maintaining full functionality and usability.

Built with ⚡ by Claude Code Frontend Design Skill
