import Ajv, { type JSONSchemaType } from 'ajv';
import type { MaestroManifest } from '../types/manifest.js';

/**
 * Validation result returned by validateManifest
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string;
}

/**
 * JSON Schema for Maestro manifest validation
 * Follows the specification in docs/final-maestro-cli-docs/01-MANIFEST-SCHEMA.md
 */
const manifestSchema: JSONSchemaType<MaestroManifest> = {
  type: 'object',
  properties: {
    manifestVersion: {
      type: 'string',
      description: 'Manifest format version',
    },
    role: {
      type: 'string',
      enum: ['worker', 'orchestrator'],
      description: 'Agent role',
    },
    strategy: {
      type: 'string',
      enum: ['simple', 'queue'],
      nullable: true,
      description: 'Worker strategy: simple (default) or queue (FIFO task processing)',
    },
    orchestratorStrategy: {
      type: 'string',
      enum: ['default', 'intelligent-batching', 'dag'],
      nullable: true,
      description: 'Orchestrator strategy: default, intelligent-batching, or dag',
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          parentId: { type: 'string', nullable: true },
          acceptanceCriteria: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
          dependencies: {
            type: 'array',
            items: { type: 'string' },
            nullable: true,
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            nullable: true,
          },
          projectId: { type: 'string' },
          createdAt: { type: 'string' },
          metadata: {
            type: 'object',
            nullable: true,
            required: [],
            additionalProperties: true,
          },
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'completed', 'cancelled', 'blocked'],
            nullable: true,
          },
          sessionIds: {
            type: 'array',
            items: { type: 'string' },
            nullable: true,
          },
          activeSessionId: {
            type: 'string',
            nullable: true,
          },
        },
        required: ['id', 'title', 'description', 'acceptanceCriteria', 'projectId', 'createdAt'],
        additionalProperties: false,
      },
      minItems: 1,
    },
    session: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
        },
        permissionMode: {
          type: 'string',
          enum: ['acceptEdits', 'interactive', 'readOnly'],
        },
        thinkingMode: {
          type: 'string',
          enum: ['auto', 'interleaved', 'disabled'],
          nullable: true,
        },
        maxTurns: { type: 'number', nullable: true },
        timeout: { type: 'number', nullable: true },
        workingDirectory: { type: 'string', nullable: true },
        allowedCommands: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
          description: 'Explicit list of allowed commands for this session',
        },
      },
      required: ['model', 'permissionMode'],
      additionalProperties: false,
    },
    context: {
      type: 'object',
      properties: {
        codebaseContext: {
          type: 'object',
          properties: {
            recentChanges: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
            },
            relevantFiles: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
            },
            architecture: { type: 'string', nullable: true },
            techStack: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
            },
            dependencies: {
              type: 'object',
              nullable: true,
              required: [],
              additionalProperties: { type: 'string' },
            },
          },
          required: [],
          nullable: true,
          additionalProperties: false,
        },
        relatedTasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              relationship: {
                type: 'string',
                enum: ['blocks', 'blocked_by', 'depends_on', 'related_to'],
              },
              status: { type: 'string' },
              description: { type: 'string', nullable: true },
            },
            required: ['id', 'title', 'relationship', 'status'],
            additionalProperties: false,
          },
          nullable: true,
        },
        projectStandards: {
          type: 'object',
          properties: {
            codingStyle: { type: 'string', nullable: true },
            testingApproach: { type: 'string', nullable: true },
            documentation: { type: 'string', nullable: true },
            branchingStrategy: { type: 'string', nullable: true },
            cicdPipeline: { type: 'string', nullable: true },
            customGuidelines: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
            },
          },
          required: [],
          nullable: true,
          additionalProperties: false,
        },
        custom: {
          type: 'object',
          nullable: true,
          required: [],
          additionalProperties: true,
        },
      },
      required: [],
      nullable: true,
      additionalProperties: false,
    },
    skills: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      description: 'Optional standard skills to load',
    },
    templateId: {
      type: 'string',
      nullable: true,
      description: 'Optional template ID for prompt generation (fetched from server)',
    },
    agentTool: {
      type: 'string',
      enum: ['claude-code', 'codex', 'gemini'],
      nullable: true,
      description: 'Agent tool to use for this session (defaults to claude-code)',
    },
  },
  required: ['manifestVersion', 'role', 'tasks', 'session'],
  additionalProperties: false,
};

// Create Ajv instance
const ajv = new Ajv.default({
  allErrors: true,
  verbose: true,
});

// Compile schema
const validate = ajv.compile(manifestSchema);

/**
 * Validates a manifest object against the JSON schema
 *
 * @param manifest - The manifest object to validate
 * @returns ValidationResult with valid flag and optional error messages
 *
 * @example
 * ```typescript
 * const result = validateManifest(manifestData);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateManifest(manifest: any): ValidationResult {
  const valid = validate(manifest);

  if (valid) {
    return { valid: true };
  }

  // Format errors into human-readable string
  const errors = validate.errors
    ?.map((err: any) => {
      const path = err.instancePath || err.schemaPath;
      const message = err.message || 'validation error';
      const keyword = err.keyword;
      const params = err.params;

      // Create more descriptive error messages
      if (keyword === 'enum' && params && 'allowedValues' in params) {
        const field = path.replace(/^\//, '').replace(/\//g, '.') || 'value';
        return `${field}: must be one of [${params.allowedValues.join(', ')}]`;
      }

      if (keyword === 'required' && params && 'missingProperty' in params) {
        const field = path ? `${path.replace(/^\//, '').replace(/\//g, '.')}.${params.missingProperty}` : params.missingProperty;
        return `${field}: is required`;
      }

      if (keyword === 'type') {
        const field = path.replace(/^\//, '').replace(/\//g, '.') || 'value';
        return `${field}: ${message}`;
      }

      return `${path.replace(/^\//, '').replace(/\//g, '.')}: ${message}`;
    })
    .join('; ');

  return {
    valid: false,
    errors: errors || 'Validation failed',
  };
}

/**
 * Export the compiled validator for direct use
 */
export { validate as compiledValidator };

/**
 * Export the schema for documentation or external use
 */
export { manifestSchema };
