# Task Lists API (Backend v1)

Scope: Flat task lists only (no nested lists). Each list contains an ordered array of task IDs, validated to belong to the same project as the list.

## Data Model

TaskList
- id: string
- projectId: string
- name: string
- description?: string
- orderedTaskIds: string[]
- createdAt: number
- updatedAt: number

## Endpoints

GET /api/task-lists
Query
- projectId?: string

Response 200
- TaskList[]

POST /api/task-lists
Body
- projectId: string (required)
- name: string (required)
- description?: string
- orderedTaskIds?: string[] (defaults to [])

Response 201
- TaskList

GET /api/task-lists/:id
Response 200
- TaskList

PATCH /api/task-lists/:id
Body (any subset)
- name?: string
- description?: string
- orderedTaskIds?: string[]

Response 200
- TaskList

PUT /api/task-lists/:id/ordering
Body
- orderedTaskIds: string[]

Response 200
- TaskList

DELETE /api/task-lists/:id
Response 200
- { success: true, id: string }

## Validation Rules
- Task list name cannot be empty.
- Each task ID in orderedTaskIds must exist and belong to the same project as the list.
- Duplicate task IDs in orderedTaskIds are rejected.

## Example Payloads

Create
{
  "projectId": "proj_123",
  "name": "My Tasks",
  "description": "Top priorities",
  "orderedTaskIds": ["task_a", "task_b"]
}

Reorder
{
  "orderedTaskIds": ["task_b", "task_a"]
}
