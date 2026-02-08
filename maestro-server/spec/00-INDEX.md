# Maestro Server Specification - Index

**Version:** 1.0.0
**Last Updated:** 2026-02-04
**Purpose:** Navigation hub and entry point for all Maestro Server specifications

---

## What Are These Specifications?

This `spec/` directory contains **formal technical specifications** that define WHAT the Maestro Server does, not HOW it's implemented. These specs enable:

1. **Recreation** - An LLM or human can rebuild the server from these specs alone
2. **Validation** - Implementations can be tested against these specifications
3. **Documentation** - Clear contracts for API consumers and integrators
4. **Evolution** - Changes can be proposed as spec updates before implementation

## How to Use These Specifications

### For LLM Context
1. Start with `01-SYSTEM-OVERVIEW.md` to understand architecture boundaries
2. Read `02-CORE-CONCEPTS.md` to learn domain entities
3. Jump to specific component specs (API, WebSocket, Storage, etc.)
4. Reference JSON schemas in `schemas/` for validation

### For Human Understanding
1. Follow the numbered progression (01 → 02 → 03...)
2. Use diagrams (Mermaid) for visual understanding
3. Try examples with curl/wscat against a running server
4. Cross-reference with `spec-review/` for architectural context

### For Implementation
1. Treat these as **requirements** - every spec must be satisfied
2. Use JSON schemas for validation in tests
3. Verify examples work against your implementation
4. Check error codes match exactly

---

## Specification Files (Core System)

### 01. System Overview
**File:** `01-SYSTEM-OVERVIEW.md`
**What it covers:** Architecture boundaries, CLI-first philosophy, non-functional requirements
**Read this if:** You're new to Maestro or need to understand what the server does vs. doesn't do

### 02. Core Concepts
**File:** `02-CORE-CONCEPTS.md`
**What it covers:** Domain entities (Project, Task, Session), relationships, lifecycle
**Read this if:** You need to understand the data model or entity interactions

---

## Specification Files (Interfaces)

### 03. API Specification
**File:** `03-API-SPECIFICATION.md`
**What it covers:** Every REST endpoint, request/response schemas, error codes
**Read this if:** You're consuming the API or implementing HTTP handlers

### 04. WebSocket Specification
**File:** `04-WEBSOCKET-SPECIFICATION.md`
**What it covers:** WebSocket protocol, event catalog (15+ events), connection management
**Read this if:** You're building a UI or consuming real-time events

---

## Specification Files (Data & Storage)

### 05. Storage Specification
**File:** `05-STORAGE-SPECIFICATION.md`
**What it covers:** Persistence requirements, file structure, data integrity
**Read this if:** You're implementing storage or understanding data persistence

---

## Specification Files (Features)

### 06. CLI Integration Specification
**File:** `06-CLI-INTEGRATION-SPECIFICATION.md`
**What it covers:** CLI contract, manifest generation, environment variables
**Read this if:** You're working with Maestro CLI or manifest generation

### 07. Skills Specification
**File:** `07-SKILLS-SPECIFICATION.md`
**What it covers:** Skills system, loading from filesystem, manifest format
**Read this if:** You're working with skills or extending the skills system

### 08. Session Spawning Specification
**File:** `08-SESSION-SPAWNING-SPECIFICATION.md`
**What it covers:** Complete spawn flow, server-generated manifests, event sequence
**Read this if:** You're implementing spawn or understanding session creation

---

## Specification Files (Cross-Cutting)

### 09. Error Handling Specification
**File:** `09-ERROR-HANDLING-SPECIFICATION.md`
**What it covers:** Error codes, HTTP status mapping, error response format
**Read this if:** You're implementing error handling or debugging errors

### 10. Configuration Specification
**File:** `10-CONFIGURATION-SPECIFICATION.md`
**What it covers:** Environment variables, defaults, configuration precedence
**Read this if:** You're deploying the server or managing configuration

### 11. Deployment Specification
**File:** `11-DEPLOYMENT-SPECIFICATION.md`
**What it covers:** Runtime requirements, dependencies, production setup
**Read this if:** You're deploying Maestro Server to production

### 12. Queue Specification
**File:** `12-QUEUE-SPECIFICATION.md`
**What it covers:** Session task queue system, FIFO processing, queue operations
**Read this if:** You're working with queue-based task processing or the queue worker strategy

### 13. Template Specification
**File:** `13-TEMPLATE-SPECIFICATION.md`
**What it covers:** Worker and orchestrator prompt templates, customization, defaults
**Read this if:** You're customizing agent prompts or managing templates

---

## JSON Schemas

**Directory:** `schemas/`
**Purpose:** Machine-readable validation schemas (JSON Schema draft 2020-12)

### Entity Schemas
- `project.json` - Project entity schema
- `task.json` - Task entity schema
- `session.json` - Session entity schema
- `session-timeline-event.json` - Session timeline event schema
- `session-event.json` - Session event schema
- `queue-state.json` - Queue state schema
- `queue-item.json` - Queue item schema
- `template.json` - Template entity schema

### API Request Schemas
- `create-project-request.json` - POST /api/projects payload
- `update-project-request.json` - PUT /api/projects/:id payload
- `create-task-request.json` - POST /api/tasks payload
- `update-task-request.json` - PATCH /api/tasks/:id payload
- `create-session-request.json` - POST /api/sessions payload
- `spawn-session-request.json` - POST /api/sessions/spawn payload

### API Response Schemas
- `error-response.json` - Standard error response format
- `delete-response.json` - Standard delete response

### WebSocket Schemas
- `websocket-message.json` - WebSocket message envelope
- `spawn-event.json` - session:created (spawn) event payload

### Skills Schemas
- `skill-manifest.json` - Skill manifest.json format

---

## Architectural Review Documents

**Directory:** `spec-review/`
**Purpose:** Critique current implementation and propose improvements

These documents are separate from specifications because they analyze the current codebase and propose architectural changes. See `spec-review/00-INDEX.md` for details.

### Key Review Documents
- `01-CURRENT-ISSUES.md` - 10 architectural issues identified
- `02-DECOUPLING-PLAN.md` - Interface-based loose coupling strategy
- `03-REFACTORING-ROADMAP.md` - Phase-by-phase migration plan
- `04-PROPOSED-ARCHITECTURE.md` - Target layered architecture
- `05-INTERFACE-DEFINITIONS.md` - Complete TypeScript interfaces
- `06-MIGRATION-STRATEGY.md` - Step-by-step migration guide

---

## Reading Paths

### Path 1: Quick API Consumer
**Goal:** Use the API without understanding internals
**Read:** `03-API-SPECIFICATION.md` + `schemas/`

### Path 2: UI Developer
**Goal:** Build a frontend for Maestro
**Read:** `01-SYSTEM-OVERVIEW.md` → `02-CORE-CONCEPTS.md` → `03-API-SPECIFICATION.md` → `04-WEBSOCKET-SPECIFICATION.md` → `12-QUEUE-SPECIFICATION.md` → `13-TEMPLATE-SPECIFICATION.md`

### Path 3: Server Developer
**Goal:** Implement or modify the server
**Read:** All specs in order (01 → 13) + `spec-review/`

### Path 4: Architect/Refactorer
**Goal:** Improve the architecture
**Read:** `01-SYSTEM-OVERVIEW.md` → `spec-review/01-CURRENT-ISSUES.md` → `spec-review/04-PROPOSED-ARCHITECTURE.md`

### Path 5: DevOps/Deployer
**Goal:** Deploy to production
**Read:** `10-CONFIGURATION-SPECIFICATION.md` → `11-DEPLOYMENT-SPECIFICATION.md`

---

## Validation and Testing

### Specification Completeness
✅ All specifications created and reviewed
✅ All JSON schemas validate against real data
✅ All examples tested against running server
✅ All error codes documented and tested

### Cross-References
- Specs cross-reference each other (e.g., API spec references Storage spec)
- Schemas referenced from specs
- Review documents reference specific code locations

### LLM Readiness
- Self-contained specifications (no external dependencies)
- Structured format (headings, schemas, examples)
- Explicit contracts (no implied behavior)
- Complete error enumeration

---

## Change History

### Version 1.1.0 (2026-02-07)
- Updated TaskStatus enum: 'todo' instead of 'pending', added 'cancelled'
- Updated SessionStatus enum: added 'idle', 'working', 'stopped'; removed 'running'
- Added Session.strategy field (WorkerStrategy)
- Added Session.timeline field (SessionTimelineEvent[])
- Removed Task.timeline (moved to Session)
- Added Task.sessionStatus field (TaskSessionStatus)
- Created 12-QUEUE-SPECIFICATION.md for queue system
- Created 13-TEMPLATE-SPECIFICATION.md for template system
- Updated API spec with Queue and Template endpoints
- Updated all examples to reflect new types

### Version 1.0.0 (2026-02-04)
- Initial specification suite
- All core specifications created (01-11)
- All JSON schemas defined
- Architectural review completed

---

## Contributing

When updating specifications:

1. **Backward Compatibility** - Mark breaking changes clearly
2. **Versioning** - Update version numbers in specs
3. **Examples** - Add/update examples for new features
4. **Schemas** - Update JSON schemas alongside spec changes
5. **Cross-References** - Update related specs when changing interfaces
6. **Testing** - Validate examples against implementation

---

## Related Documents

- **Implementation Documentation:** `maestro-server/docs/` (user-facing documentation)
- **Architectural Review:** `maestro-server/spec-review/` (improvement proposals)
- **Source Code:** `maestro-server/src/` (current implementation)

---

**Next:** Read `01-SYSTEM-OVERVIEW.md` to understand the architecture
