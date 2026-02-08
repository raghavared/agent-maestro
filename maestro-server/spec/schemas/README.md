# Maestro Server JSON Schemas

This directory contains comprehensive JSON Schema (draft 2020-12) definitions for all data types, API requests, and responses used in the Maestro Server.

## Schema Files

### Entity Schemas

Core data entities that represent the domain model:

1. **project.json** - Project entity
   - Properties: id, name, workingDir, description, createdAt, updatedAt
   - ID Pattern: `^proj_[a-zA-Z0-9]+$`

2. **task.json** - Task entity
   - Properties: id, projectId, parentId, title, description, status, priority, timestamps, sessionIds, skillIds, agentIds, dependencies, timeline
   - ID Pattern: `^task_[a-zA-Z0-9]+$`
   - Status: pending | in_progress | completed | blocked
   - Priority: low | medium | high

3. **session.json** - Session entity
   - Properties: id, projectId, taskIds, name, agentId, env, status, timestamps, hostname, platform, events, metadata
   - ID Pattern: `^sess_[a-zA-Z0-9]+$`
   - Status: spawning | running | completed | failed

4. **timeline-event.json** - TimelineEvent
   - Properties: id, type, timestamp, message, sessionId
   - Type: created | session_started | session_ended | update | milestone | blocker

5. **session-event.json** - SessionEvent
   - Properties: id, timestamp, type, data
   - Generic event structure for session lifecycle events

### API Request Schemas

Request payloads for API endpoints:

6. **create-project-request.json**
   - Required: name
   - Optional: workingDir, description

7. **update-project-request.json**
   - All fields optional: name, workingDir, description
   - Minimum 1 property required

8. **create-task-request.json**
   - Required: projectId, title
   - Optional: parentId, description, priority, initialPrompt, skillIds

9. **update-task-request.json**
   - All fields optional: title, description, status, priority, sessionIds, skillIds, agentIds, timeline
   - Minimum 1 property required

10. **create-session-request.json**
    - Required: projectId, taskIds
    - Optional: id, name, agentId, status, env, metadata, _suppressCreatedEvent

11. **spawn-session-request.json**
    - Required: projectId, taskIds
    - Optional: role, spawnSource, sessionName, skills, spawnedBy, context
    - Higher-level API with server-generated manifests

### API Response Schemas

Standard response formats:

12. **error-response.json**
    - Properties: error (true), code, message, details
    - Standard error format for all API errors

13. **delete-response.json**
    - Properties: success (true), id
    - Standard format for successful delete operations

### WebSocket Schemas

Real-time communication message formats:

14. **websocket-message.json**
    - Properties: type, event, data
    - Envelope format for all WebSocket messages

15. **spawn-event.json** - SpawnRequestEvent
    - Properties: session, projectId, taskIds, command, cwd, envVars, manifest
    - Emitted when server requests UI to spawn a session

### Skills Schemas

Skill system definitions:

16. **skill-manifest.json** - SkillManifest
    - Required: name, version, description, type, assignTo, capabilities, dependencies
    - Optional: config
    - Type: system | role
    - AssignTo: all | worker | orchestrator

## Schema Features

All schemas include:

- **$schema**: JSON Schema draft 2020-12
- **$id**: Unique schema identifier URL
- **Detailed descriptions**: For every property
- **Validation rules**: pattern, minLength, maxLength, enum, minimum, etc.
- **Required vs optional fields**: Clearly marked
- **Examples**: Inline examples in descriptions
- **Type safety**: Strict type definitions with additionalProperties: false

## Schema References

Schemas use `$ref` to reference other schemas:

- `task.json` references `timeline-event.json` for timeline array
- `session.json` references `session-event.json` for events array
- `update-task-request.json` references `timeline-event.json`
- `spawn-event.json` references `session.json`

## ID Patterns

All entity IDs follow consistent patterns:

- Projects: `^proj_[a-zA-Z0-9]+$`
- Tasks: `^task_[a-zA-Z0-9]+$`
- Sessions: `^sess_[a-zA-Z0-9]+$`

## Usage

These schemas can be used for:

1. **API Validation**: Validate request/response payloads
2. **Documentation**: Generate API documentation
3. **TypeScript Generation**: Generate TypeScript types
4. **Client Libraries**: Generate client SDK code
5. **Testing**: Validate test fixtures and mock data
6. **IDE Support**: Enable autocomplete and validation in editors

## Base TypeScript Sources

These schemas are derived from:

- `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/types.ts`
- `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/skills.ts`

## Validation Tools

To validate JSON against these schemas, you can use:

- **AJV**: Fast JSON Schema validator
- **json-schema**: Node.js JSON Schema implementation
- **Online validators**: jsonschemavalidator.net

Example with AJV:

```javascript
const Ajv = require('ajv');
const ajv = new Ajv();

const projectSchema = require('./schemas/project.json');
const validate = ajv.compile(projectSchema);

const valid = validate(myProjectData);
if (!valid) {
  console.error(validate.errors);
}
```

## Schema Versioning

Schema IDs include the domain but not version numbers. When making breaking changes:

1. Create a new schema file with version suffix (e.g., `project-v2.json`)
2. Update the `$id` to include version
3. Update references in dependent schemas
4. Document migration path in CHANGELOG

## Contributing

When updating schemas:

1. Keep in sync with TypeScript types in `src/types.ts` and `src/skills.ts`
2. Add detailed descriptions and examples
3. Use strict validation where appropriate
4. Test with actual API data
5. Update this README if adding new schemas
