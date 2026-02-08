# Maestro UI Specification

This directory contains the complete technical documentation for the Maestro UI codebase.

## Documents

### [TECHNICAL-SPECIFICATION.md](./TECHNICAL-SPECIFICATION.md)
**The Source of Truth** - Comprehensive technical specification covering:
- Architecture overview
- Technology stack
- Directory structure
- Data models and type system
- State management (Zustand stores)
- Component architecture
- Services & API integration
- Real-time communication (WebSocket)
- Terminal integration (xterm.js + PTY)
- File system & code editor (Monaco)
- Maestro integration (CLI-first architecture)
- Build & development
- Key features
- Data flow patterns
- Performance considerations

## Quick Start

If you're new to the codebase, start here:

1. **Read the Executive Summary** in the Technical Specification
2. **Review the Architecture Overview** to understand the high-level design
3. **Study the Data Models** to understand the core domain types
4. **Explore the Store Architecture** to understand state management
5. **Look at the Component Hierarchy** to understand the UI structure

## Key Concepts

### CLI-First Architecture

The most important architectural concept in Maestro UI is the **CLI-First Architecture**:

- **UI Responsibility**: Spawn terminals with environment variables
- **CLI Responsibility**: Configure agents, load skills, execute tasks
- **Benefit**: Portable, testable, and maintainable separation of concerns

### State Management

The application uses **Zustand** with multiple specialized stores:

- `useSessionStore` - Terminal session management
- `useMaestroStore` - Tasks and Maestro sessions
- `useProjectStore` - Project management
- `useWorkspaceStore` - Workspace layouts
- `useUIStore` - Global UI state
- And 10+ more specialized stores

### Real-time Synchronization

A single **global WebSocket connection** keeps the UI in sync with the server:

- Automatic reconnection with exponential backoff
- Optimistic updates
- Event-based state updates
- Multi-client synchronization

## Directory Map

```
maestro-ui/
├── src/
│   ├── App.tsx                    # Main application
│   ├── app/                       # Core types & utilities
│   ├── components/                # React components
│   │   ├── maestro/               # Task management UI
│   │   ├── app/                   # App-level components
│   │   └── modals/                # Modal dialogs
│   ├── stores/                    # Zustand stores
│   ├── hooks/                     # Custom React hooks
│   ├── services/                  # Service layer
│   └── utils/                     # Utilities
└── spec/                          # This directory
    └── TECHNICAL-SPECIFICATION.md # Complete documentation
```

## API Reference

**REST API**: `http://localhost:3000/api`
**WebSocket**: `ws://localhost:3000`

See the [Services & API Integration](./TECHNICAL-SPECIFICATION.md#services--api-integration) section for complete API documentation.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

See the [Build & Development](./TECHNICAL-SPECIFICATION.md#build--development) section for detailed setup instructions.

## Contributing

When making changes to the codebase:

1. **Update this specification** to reflect architectural changes
2. **Document new components** in the Component Architecture section
3. **Add new types** to the Data Models section
4. **Update data flows** if the information flow changes

## Questions?

If something is unclear or missing from this specification:

1. Check the inline code comments
2. Review the [MAESTRO-UI-SPEC.md](../MAESTRO-UI-SPEC.md) for UI-specific details
3. Consult the team or open an issue

---

**Last Updated**: February 7, 2026
**Maintainer**: Maestro Development Team
