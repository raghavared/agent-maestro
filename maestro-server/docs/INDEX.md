# Maestro Server Documentation - Complete Index

**Last Updated:** February 2, 2026

Comprehensive documentation for the Maestro Server backend system. Total: 9 documents, ~149KB of documentation.

---

## 📖 Reading Guide

### For New Users

**Start here:**
1. [README.md](./README.md) - Quick overview and getting started
2. [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md) - One-page visual reference
3. [01-OVERVIEW.md](./01-OVERVIEW.md) - Detailed system overview

### For Developers

**API Integration:**
1. [02-API-REFERENCE.md](./02-API-REFERENCE.md) - Complete API documentation
2. [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md) - Real-time event system
3. [05-DATA-MODELS.md](./05-DATA-MODELS.md) - Entity schemas

**Understanding Internals:**
1. [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) - Storage implementation
2. [06-FLOWS.md](./06-FLOWS.md) - Workflow diagrams
3. [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) - Visual architecture

---

## 📄 Document Summaries

### [README.md](./README.md) (15.3 KB)

**Main entry point** for all documentation. Quick start guide, feature overview, and links to detailed docs.

**Contents:**
- Quick start (installation, dev, production)
- System overview
- Core entities (Project, Task, Session, Subtask)
- API overview
- WebSocket events
- Data storage
- Key workflows
- Architecture summary
- Development guide
- Security notes
- Docker deployment
- Performance characteristics
- Known limitations

**Best for:** First-time users, quick reference

---

### [01-OVERVIEW.md](./01-OVERVIEW.md) (9.9 KB)

**System architecture and philosophy.** Deep dive into what Maestro Server is, what it does, and how it fits into the ecosystem.

**Contents:**
- What is Maestro Server
- Core purpose
- CLI-first architecture philosophy
- Key responsibilities
- Core entities (overview)
- Technology stack
- File structure
- Data storage layout
- Port configuration
- Deployment
- Integration points (CLI, UI, Skills)
- Key design decisions

**Best for:** Understanding architectural principles, design philosophy

---

### [02-API-REFERENCE.md](./02-API-REFERENCE.md) (10.4 KB)

**Complete REST API documentation.** Every endpoint, parameter, response format, and error code.

**Contents:**
- Base URL and response formats
- Error codes
- Health check endpoint
- Projects API (CRUD)
- Tasks API (CRUD + timeline)
- Sessions API (CRUD + spawn)
- Subtasks API (CRUD)
- WebSocket connection info
- Rate limiting (none)
- Authentication (none)
- CORS policy
- Response codes

**Best for:** API integration, endpoint reference

---

### [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) (15.3 KB)

**Deep dive into data persistence.** How storage works, file structure, in-memory caching, and data migration.

**Contents:**
- Architecture overview (diagrams)
- Storage class structure
- Data directory structure
- ID generation
- Initialization flow
- Load process (from disk)
- Save process (to disk)
- In-memory data structures (Maps)
- Event emission
- Bidirectional relationships (Task ↔ Session)
- Data migration (Phase IV-A)
- Deletion cascades
- Performance characteristics
- Error handling
- Backup and recovery
- Future improvements

**Best for:** Understanding storage implementation, contributing to storage layer

---

### [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md) (17.3 KB)

**Real-time event system documentation.** All WebSocket events, message formats, and client implementation examples.

**Contents:**
- Overview and connection setup
- Message format
- Complete event catalog:
  - Project events (created, updated, deleted)
  - Task events (created, updated, deleted, session_added, session_removed)
  - Session events (created, updated, deleted, spawn_request, task_added, task_removed)
  - Subtask events (created, updated, deleted)
- Event flow diagrams
- Broadcast implementation
- Client implementation examples (React/TypeScript)
- Event filtering
- Connection management (reconnection, heartbeat)
- Debugging
- Performance considerations
- Security
- Testing

**Best for:** WebSocket integration, real-time UI updates

---

### [05-DATA-MODELS.md](./05-DATA-MODELS.md) (20.1 KB)

**Entity schemas and relationships.** Complete field-by-field documentation for all data models.

**Contents:**
- Entity relationship diagram
- Project schema (fields, validation, examples)
- Task schema (fields, status enum, priority enum, examples)
- Session schema (fields, status enum, metadata, examples)
- Subtask schema (fields, examples)
- TimelineEvent schema
- SessionEvent schema
- API request/response types
- Data relationships (Task ↔ Session many-to-many)
- Indexes and queries
- JSON storage format
- Migration notes (Phase IV-A)

**Best for:** Understanding data structure, database schema reference

---

### [06-FLOWS.md](./06-FLOWS.md) (20.9 KB)

**End-to-end workflows.** Sequence diagrams and flow charts for all major operations.

**Contents:**
- Project setup flow
- Task creation flow
- Session spawn flow ⭐ (most critical)
- Task execution flow
- Subtask management flow
- Session completion flow
- Task status lifecycle (state machine)
- Bidirectional relationship management
- Error handling flows
- Real-time update flow
- Orchestrator workflow
- Summary table of all flows

**Best for:** Understanding system behavior, debugging workflows

---

### [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) (16.0 KB)

**Visual architecture reference.** Comprehensive diagrams of system architecture, components, and data flows.

**Contents:**
- System architecture overview
- Component diagram
- Data flow architecture
- Storage architecture
- WebSocket event flow
- Session spawn architecture ⭐
- Task-Session relationship architecture
- Skill loading architecture
- API layer architecture
- Deployment architecture (single-machine, Docker)
- Error handling architecture
- Graceful shutdown flow
- Skills system architecture
- Performance characteristics diagrams
- Security considerations diagram

**Best for:** Visual learners, architecture review, presentations

---

### [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md) (20.8 KB)

**One-page visual cheat sheet.** Quick reference with all key information condensed into visual format.

**Contents:**
- System overview diagram
- Core entities ERD
- API endpoints (quick list)
- WebSocket events (quick list)
- Data storage structure
- Session spawn flow (condensed)
- Task status lifecycle
- Component responsibilities
- Key design principles
- Technology stack
- File structure
- Performance table
- Common commands
- Error codes table
- Environment variables
- Quick reference: Session spawn
- Security checklist
- TL;DR summary

**Best for:** Quick reference, onboarding, cheat sheet

---

## 🗺️ Documentation Map

```
maestro-server/docs/
│
├── INDEX.md ────────────────────────── (This file)
├── README.md ───────────────────────── Start here
│
├── Core Documentation
│   ├── 01-OVERVIEW.md ──────────────── System overview
│   ├── 02-API-REFERENCE.md ─────────── REST API docs
│   ├── 03-STORAGE-LAYER.md ─────────── Storage implementation
│   ├── 04-WEBSOCKET-EVENTS.md ──────── Real-time events
│   ├── 05-DATA-MODELS.md ───────────── Entity schemas
│   ├── 06-FLOWS.md ─────────────────── Workflow diagrams
│   └── 07-ARCHITECTURE-DIAGRAMS.md ─── Visual architecture
│
└── Quick Reference
    └── 08-VISUAL-SUMMARY.md ────────── One-page cheat sheet
```

---

## 🎯 Quick Navigation

### I want to...

**Understand the system**
→ [README.md](./README.md) → [01-OVERVIEW.md](./01-OVERVIEW.md) → [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)

**Integrate with the API**
→ [02-API-REFERENCE.md](./02-API-REFERENCE.md) → [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md)

**Understand data structures**
→ [05-DATA-MODELS.md](./05-DATA-MODELS.md) → [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md)

**Debug a workflow**
→ [06-FLOWS.md](./06-FLOWS.md) → [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md)

**Get started quickly**
→ [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md) → [README.md](./README.md)

**Contribute to the codebase**
→ [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) → [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md)

---

## 📊 Documentation Statistics

| Document | Size | Lines | Focus Area |
|----------|------|-------|------------|
| README.md | 15.3 KB | ~480 | Overview & Quick Start |
| 01-OVERVIEW.md | 9.9 KB | ~300 | Architecture Philosophy |
| 02-API-REFERENCE.md | 10.4 KB | ~380 | REST API Endpoints |
| 03-STORAGE-LAYER.md | 15.3 KB | ~550 | Data Persistence |
| 04-WEBSOCKET-EVENTS.md | 17.3 KB | ~630 | Real-time Events |
| 05-DATA-MODELS.md | 20.1 KB | ~730 | Entity Schemas |
| 06-FLOWS.md | 20.9 KB | ~760 | Workflows & Diagrams |
| 07-ARCHITECTURE-DIAGRAMS.md | 16.0 KB | ~570 | Visual Architecture |
| 08-VISUAL-SUMMARY.md | 20.8 KB | ~760 | Quick Reference |
| **TOTAL** | **~146 KB** | **~5,160 lines** | **Complete Coverage** |

---

## 🔍 Search by Topic

### Architecture & Design
- CLI-first architecture: [01-OVERVIEW.md](./01-OVERVIEW.md), [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)
- Component responsibilities: [01-OVERVIEW.md](./01-OVERVIEW.md), [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md)
- Design decisions: [01-OVERVIEW.md](./01-OVERVIEW.md)
- System architecture: [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md)

### API
- Endpoints: [02-API-REFERENCE.md](./02-API-REFERENCE.md), [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)
- Error codes: [02-API-REFERENCE.md](./02-API-REFERENCE.md), [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)
- Request/response formats: [02-API-REFERENCE.md](./02-API-REFERENCE.md), [05-DATA-MODELS.md](./05-DATA-MODELS.md)

### Data & Storage
- Data models: [05-DATA-MODELS.md](./05-DATA-MODELS.md)
- File structure: [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md), [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)
- In-memory caching: [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md)
- Persistence: [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md)
- Relationships: [05-DATA-MODELS.md](./05-DATA-MODELS.md), [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md)

### Real-time Events
- Event catalog: [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md), [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)
- WebSocket setup: [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md)
- Client examples: [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md)

### Workflows
- Session spawn: [06-FLOWS.md](./06-FLOWS.md), [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md), [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)
- Task execution: [06-FLOWS.md](./06-FLOWS.md)
- Project setup: [06-FLOWS.md](./06-FLOWS.md)
- Error handling: [06-FLOWS.md](./06-FLOWS.md)

### Development
- Getting started: [README.md](./README.md)
- File structure: [01-OVERVIEW.md](./01-OVERVIEW.md), [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)
- Performance: [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md), [README.md](./README.md)
- Security: [README.md](./README.md), [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md)

---

## 🔖 Key Concepts Explained

| Concept | Primary Document | Also See |
|---------|------------------|----------|
| CLI-First Architecture | [01-OVERVIEW.md](./01-OVERVIEW.md) | [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md) |
| Session Spawning | [06-FLOWS.md](./06-FLOWS.md) | [02-API-REFERENCE.md](./02-API-REFERENCE.md), [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) |
| Task-Session Many-to-Many | [05-DATA-MODELS.md](./05-DATA-MODELS.md) | [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) |
| File-Based Storage | [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) | [01-OVERVIEW.md](./01-OVERVIEW.md) |
| Event Broadcasting | [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md) | [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) |
| Task Status Lifecycle | [06-FLOWS.md](./06-FLOWS.md) | [05-DATA-MODELS.md](./05-DATA-MODELS.md) |
| Bidirectional Relationships | [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) | [05-DATA-MODELS.md](./05-DATA-MODELS.md) |
| Skills System | [01-OVERVIEW.md](./01-OVERVIEW.md) | [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) |

---

## 📝 Documentation Coverage

### ✅ Fully Documented

- System architecture and philosophy
- All REST API endpoints
- All WebSocket events
- All entity schemas and relationships
- Storage implementation
- Session spawning workflow
- Task lifecycle
- Bidirectional relationships
- Error handling
- File structure
- Performance characteristics

### 📋 Partially Documented

- Skills system (basic overview, not fully implemented in Phase IV-A)
- Agent management (Phase IV-C, future)
- Testing strategies (manual only)

### 🚧 Not Yet Documented

- Skills Phase IV-B implementation (not yet built)
- Agent Phase IV-C implementation (not yet built)
- Performance benchmarks (no formal benchmarks run)
- Production deployment guide (local development focus)

---

## 🎓 Learning Paths

### For Frontend Developers

1. [README.md](./README.md) - Quick overview
2. [02-API-REFERENCE.md](./02-API-REFERENCE.md) - API endpoints
3. [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md) - Real-time events (with React examples)
4. [05-DATA-MODELS.md](./05-DATA-MODELS.md) - Data structures
5. [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md) - Quick reference

### For Backend Developers

1. [01-OVERVIEW.md](./01-OVERVIEW.md) - Architecture philosophy
2. [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) - Storage implementation
3. [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) - Visual architecture
4. [06-FLOWS.md](./06-FLOWS.md) - Workflows
5. [05-DATA-MODELS.md](./05-DATA-MODELS.md) - Data models

### For Architects

1. [01-OVERVIEW.md](./01-OVERVIEW.md) - System overview
2. [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) - Architecture diagrams
3. [06-FLOWS.md](./06-FLOWS.md) - Workflows
4. [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) - Storage layer
5. [README.md](./README.md) - Summary

### For New Contributors

1. [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md) - Quick overview
2. [README.md](./README.md) - Getting started
3. [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) - Codebase structure
4. [02-API-REFERENCE.md](./02-API-REFERENCE.md) - API reference
5. [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) - Architecture

---

## 🔄 Document Updates

All documents are version-controlled and should be updated when:

- New API endpoints added → Update [02-API-REFERENCE.md](./02-API-REFERENCE.md)
- New events added → Update [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md)
- Schema changes → Update [05-DATA-MODELS.md](./05-DATA-MODELS.md)
- New workflows → Update [06-FLOWS.md](./06-FLOWS.md)
- Architecture changes → Update [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md)
- Major features → Update [README.md](./README.md) and [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)

---

## 🚀 Getting Started Checklist

- [ ] Read [README.md](./README.md)
- [ ] Review [08-VISUAL-SUMMARY.md](./08-VISUAL-SUMMARY.md)
- [ ] Install dependencies (`npm install`)
- [ ] Start server (`npm run dev`)
- [ ] Test health endpoint (`curl http://localhost:3000/health`)
- [ ] Test WebSocket (`wscat -c ws://localhost:3000`)
- [ ] Read [02-API-REFERENCE.md](./02-API-REFERENCE.md)
- [ ] Understand [06-FLOWS.md](./06-FLOWS.md) session spawn flow
- [ ] Review [05-DATA-MODELS.md](./05-DATA-MODELS.md) for data structure

---

## 📞 Support Resources

- **Code:** `maestro-server/src/`
- **Logs:** `maestro-server/server.log`
- **Data:** `~/.maestro/data/`
- **Debug Mode:** `DEBUG=1 npm run dev`

---

**Last Updated:** February 2, 2026
**Total Documentation:** ~146 KB across 9 documents
**Coverage:** Complete system documentation
