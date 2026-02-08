import { throwValidationError } from './errors.js';

export function validateTaskId(id: string | undefined, context: string[] = []): string {
  if (!id) {
    // Try to use context
    if (context.length === 0) {
      throwValidationError(
        'missing_task_id',
        'No task ID provided and no task context available',
        'Provide a task ID or ensure MAESTRO_TASK_IDS is set'
      );
    }
    return context[0];
  }

  // Validate format (simple check)
  if (!id.match(/^[a-zA-Z0-9_-]+$/)) {
    throwValidationError(
      'invalid_task_id',
      `Invalid task ID format: ${id}`,
      'Task IDs should contain only letters, numbers, hyphens, and underscores'
    );
  }

  return id;
}

export function validateStatus(status: string): string {
  const validStatuses = ['todo', 'in_progress', 'completed', 'cancelled', 'blocked'];
  if (!validStatuses.includes(status)) {
    throwValidationError(
      'invalid_status',
      `Invalid status: ${status}`,
      `Use one of: ${validStatuses.join(', ')}`
    );
  }
  return status;
}

export function validatePriority(priority: string): 'high' | 'medium' | 'low' {
  const validPriorities = ['high', 'medium', 'low'];
  if (!validPriorities.includes(priority)) {
    throwValidationError(
      'invalid_priority',
      `Invalid priority: ${priority}`,
      `Use one of: ${validPriorities.join(', ')}`
    );
  }
  return priority as any;
}

export function validateRequired(value: string | undefined, fieldName: string): string {
  if (!value || value.trim() === '') {
    throwValidationError(
      'missing_required_field',
      `Missing required field: ${fieldName}`,
      undefined
    );
  }
  return value;
}

export function validateProjectId(projectId: string | undefined): string {
  if (!projectId) {
    throwValidationError(
      'missing_project_id',
      'No project ID provided',
      'Use --project <id> or set MAESTRO_PROJECT_ID'
    );
  }
  return projectId;
}
