# Terminal Theme - Quick Reference

## Color Variables

```css
--terminal-green: #00ff41      /* Primary color - glowing green */
--terminal-green-dim: #00cc33   /* Dimmed green for secondary text */
--terminal-amber: #ffb000       /* Command prompts and labels */
--terminal-cyan: #00d9ff        /* Active/running indicators */
--terminal-red: #ff3b3b         /* Errors and warnings */
--terminal-bg: #000000          /* Pure black background */
--terminal-bg-alt: #0a0a0a      /* Slightly lighter black */
--terminal-border: #003300      /* Dark green borders */
--terminal-text: #00ff41        /* Main text color */
--terminal-text-dim: #00aa2b    /* Dimmed text */
```

## Typography

```css
font-family: 'JetBrains Mono', 'Courier New', monospace;
```

## Status Indicators

### Symbols
```
○  Pending task (IDLE)
◉  In progress task (RUN) - pulsing
✓  Completed task (OK)
✗  Blocked task (ERR)
```

### Priority Symbols
```
─  Low priority
═  Medium priority
▓  High priority
```

## Command Patterns

### Buttons
```
$ new task          (create)
$ refresh           (reload)
$ exec              (execute)
> view              (details)
> rm -rf            (delete)
```

### Labels
```
--filter-status=
--priority=
--sort=
```

## ASCII Art Elements

### Borders
```
╔══════════════════╗
║                  ║
╚══════════════════╝
```

### Tree Structure
```
├─[ ] Item 1
├─[✓] Item 2
└─[ ] Item 3
```

## Window Chrome

```
● ● ●  maestro-agent ~/project-name
```

## Agent Options

1. **claude** - Claude AI agent
2. **gemini** - Gemini agent
3. **codex** - Codex agent
4. **which** - Spawn terminal without command (NEW!)

## Key Animations

- **Scanlines**: Moving horizontal lines (CRT effect)
- **Pulse Glow**: Breathing effect on active elements
- **Cursor Blink**: Terminal cursor █
- **Status Pulse**: Active task indicator
- **Flicker**: Subtle screen flicker

## Interactive States

### Hover
```css
border-color: var(--terminal-green);
box-shadow: 0 0 12px rgba(0, 255, 65, 0.3);
transform: translateY(-1px);
```

### Active/Selected
```css
background: rgba(0, 255, 65, 0.12);
box-shadow: 0 0 16px rgba(0, 255, 65, 0.5);
font-weight: 700;
```

### Disabled
```css
opacity: 0.3;
border-color: var(--terminal-border);
```

## Text Effects

### Glowing Text
```css
text-shadow: 0 0 8px var(--terminal-green);
```

### Prompt Symbol
```css
content: '$ ';
color: var(--terminal-amber);
```

### Label Prefix
```css
content: '--';
color: var(--terminal-text-dim);
```

## Usage Examples

### Button with Glow
```tsx
<button className="terminalCmd terminalCmdPrimary">
  <span className="terminalPrompt">$</span> new task
</button>
```

### Status Badge
```tsx
<span className="terminalStatus terminalStatus--in_progress">
  ◉
</span>
<span className="terminalStatusLabel terminalStatusLabel--in_progress">
  [RUN]
</span>
```

### Filter Controls
```tsx
<span className="terminalFilterLabel">--filter-status=</span>
<button className="terminalFilterBtn terminalFilterBtnActive">
  all
</button>
```

## Scrollbar Styling

```css
/* Track */
background: rgba(0, 255, 65, 0.05);

/* Thumb */
background: var(--terminal-border);

/* Thumb hover */
background: var(--terminal-green-dim);
box-shadow: 0 0 8px var(--terminal-green);
```

## Modal Windows

- Border: 2px solid green with glow
- Scanline overlay
- Dark background (#000000)
- Title with `$ ` prefix
- All labels with `--` prefix

## Tips for Consistency

1. Always use lowercase for terminal commands
2. Add phosphor glow on hover states
3. Use monospace font throughout
4. Keep letter-spacing consistent (0.02em - 0.05em)
5. Use symbols instead of words when possible
6. Animate active/running elements
7. Add `$ ` prefix to action buttons
8. Use `--` prefix for option labels
