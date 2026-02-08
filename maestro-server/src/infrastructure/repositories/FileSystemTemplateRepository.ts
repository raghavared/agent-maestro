import * as fs from 'fs/promises';
import * as path from 'path';
import { Template, CreateTemplatePayload, UpdateTemplatePayload, TemplateRole } from '../../types';
import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';

/**
 * Default worker template content
 */
const DEFAULT_WORKER_TEMPLATE = `# Maestro Worker Session

## Your Assignment

You have been assigned to task **\${TASK_ID}**:

**Title:** \${TASK_TITLE}

**Description:**
\${TASK_DESCRIPTION}

**Priority:** \${TASK_PRIORITY}

## Acceptance Criteria

\${ACCEPTANCE_CRITERIA}

\${ALL_TASKS}

## Project Context

\${CODEBASE_CONTEXT}

\${RELATED_TASKS}

\${PROJECT_STANDARDS}

## Your Workflow

### Step 1: Understand the Requirements
- Review the task description and acceptance criteria above
- Check the codebase context for relevant files and recent changes
- Review related tasks to understand dependencies and relationships

### Step 2: Implement the Requirements

**Note**: Your task is already marked as **in-progress** when this session started. No need to manually mark it as started.
- Work through the acceptance criteria systematically
- Follow the project standards and guidelines
- Write clean, maintainable code
- Add tests as you go

### Step 3: Report Progress Frequently
Every 5-10 minutes or at major milestones:
\`\`\`bash
maestro update "Current progress: <what you just did>"
\`\`\`

This helps the orchestrator track your work.

### Step 4: Verify Your Work
Before marking complete, ensure:
- ✅ All acceptance criteria are met
- ✅ Tests pass
- ✅ Code follows project standards
- ✅ Documentation is updated if needed

### Step 5: Report Completion
Only after everything is verified:
\`\`\`bash
maestro update:complete "Task completed. Summary: <brief summary of what was done>"
\`\`\`

This reports completion to the system and marks the task as ready for human review.

## Available Commands

- \`maestro whoami\` - Show your current context
- \`maestro status\` - Show project status
- \`maestro update:progress <message>\` - Report work progress
- \`maestro update:blocked <message>\` - Report blocker (auto-updates task status)
- \`maestro update:needs-input <question>\` - Request user input
- \`maestro update:complete <summary>\` - Report completion (ready for review)
- \`maestro update:error <description>\` - Report error encountered

## If You Get Blocked

If you encounter an issue that prevents progress:
\`\`\`bash
maestro update:blocked "Clear explanation of the blocker and what you tried"
\`\`\`

This will automatically update the task status to "blocked" and notify the team.

## Important Guidelines

- **DO** implement the requirements completely
- **DO** test your work thoroughly
- **DO** report progress frequently using \`maestro update:progress\`
- **DO** report blockers immediately using \`maestro update:blocked\`
- **DO** follow project standards and guidelines
- **DO NOT** report completion unless everything is verified
- **DO NOT** skip acceptance criteria without good reason

## Get Started

Begin by reviewing the task description and acceptance criteria above. Your task is already marked as in-progress - start implementing!
`;

/**
 * Default orchestrator template content
 */
const DEFAULT_ORCHESTRATOR_TEMPLATE = `# Maestro Orchestrator Session

## Your Role

You are the **Maestro Orchestrator**, responsible for managing this project's workflow by:
- Analyzing requirements and breaking them down into actionable tasks
- Creating subtasks with clear deliverables
- Coordinating work across the project
- Monitoring progress and ensuring quality

## Current Task Context

**Task ID:** \${TASK_ID}
**Title:** \${TASK_TITLE}

**Description:**
\${TASK_DESCRIPTION}

**Priority:** \${TASK_PRIORITY}

## Acceptance Criteria

\${ACCEPTANCE_CRITERIA}

## Project Context

\${CODEBASE_CONTEXT}

\${RELATED_TASKS}

\${PROJECT_STANDARDS}

## Your Workflow

### Step 1: Analyze the Current State

First, understand your context and the project state:

\`\`\`bash
maestro whoami          # Understand your context
maestro status          # Get project summary
\`\`\`

### Step 2: Review the Task

- Review the task description and acceptance criteria above
- Check related tasks to understand dependencies
- Understand the codebase context and recent changes

### Step 3: Plan the Implementation

For this orchestrator task:
1. Break down the task into logical subtasks if needed
2. Ensure each subtask is:
   - Atomic and testable
   - Clearly defined with acceptance criteria
   - Independent where possible
3. Identify dependencies between subtasks

### Step 4: Track Progress

- Monitor the project status regularly
- Review task completion and quality
- Ensure acceptance criteria are being met
- Update progress as you coordinate work

\`\`\`bash
maestro update "Progress update: <what has been accomplished>"
\`\`\`

### Step 5: Report Completion

Once all acceptance criteria are met and the work is verified:

\`\`\`bash
maestro update:complete "Task completed. Summary: <overview of what was accomplished>"
\`\`\`

This reports completion and marks the task as ready for human review.

## Available Commands

- \`maestro whoami\` - Show your current context
- \`maestro status\` - Show project status
- \`maestro update:progress <message>\` - Report progress update
- \`maestro update:complete <summary>\` - Report completion (ready for review)

## Important Guidelines

- **DO** analyze requirements thoroughly before planning
- **DO** coordinate work across the project
- **DO** ensure quality and completeness
- **DO** monitor progress using \`maestro update:progress\`
- **DO NOT** report completion unless fully verified
- **DO NOT** skip acceptance criteria

## Quality Standards

Ensure that:
- All acceptance criteria are met
- Code follows project standards
- Tests are passing
- Documentation is complete
- Integration works correctly

## Get Started

Begin by running \`maestro status\` to understand the current project state, then review the task requirements and plan your approach.
`;

/**
 * File system based implementation of ITemplateRepository.
 * Stores templates as individual JSON files and seeds defaults on init.
 */
export class FileSystemTemplateRepository implements ITemplateRepository {
  private templatesDir: string;
  private templates: Map<string, Template>;
  private initialized: boolean = false;

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.templatesDir = path.join(dataDir, 'templates');
    this.templates = new Map();
  }

  /**
   * Initialize the repository by loading existing data and seeding defaults.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.templatesDir, { recursive: true });

      const files = await fs.readdir(this.templatesDir);
      const templateFiles = files.filter(f => f.endsWith('.json'));

      for (const file of templateFiles) {
        try {
          const data = await fs.readFile(path.join(this.templatesDir, file), 'utf-8');
          const template = JSON.parse(data) as Template;
          this.templates.set(template.id, template);
        } catch (err) {
          this.logger.warn(`Failed to load template file: ${file}`, { error: (err as Error).message });
        }
      }

      // Seed default templates if they don't exist
      await this.seedDefaultTemplates();

      this.logger.info(`Loaded ${this.templates.size} templates`);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize template repository:', err as Error);
      throw err;
    }
  }

  /**
   * Seed default templates if they don't exist
   */
  private async seedDefaultTemplates(): Promise<void> {
    const roles: TemplateRole[] = ['worker', 'orchestrator'];

    for (const role of roles) {
      // Direct lookup to avoid calling findByRole which triggers ensureInitialized
      const existing = Array.from(this.templates.values()).find(t => t.role === role);
      if (!existing) {
        const defaultContent = this.getDefaultContent(role);
        const template: Template = {
          id: this.idGenerator.generate('tmpl'),
          name: `Default ${role.charAt(0).toUpperCase() + role.slice(1)} Template`,
          role,
          content: defaultContent,
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        this.templates.set(template.id, template);
        await this.saveTemplate(template);
        this.logger.info(`Seeded default ${role} template: ${template.id}`);
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveTemplate(template: Template): Promise<void> {
    const filePath = path.join(this.templatesDir, `${template.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(template, null, 2));
  }

  private async deleteTemplateFile(id: string): Promise<void> {
    const filePath = path.join(this.templatesDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  }

  async findById(id: string): Promise<Template | null> {
    await this.ensureInitialized();
    return this.templates.get(id) || null;
  }

  async findByRole(role: TemplateRole): Promise<Template | null> {
    await this.ensureInitialized();
    for (const template of this.templates.values()) {
      if (template.role === role) {
        return template;
      }
    }
    return null;
  }

  async findAll(): Promise<Template[]> {
    await this.ensureInitialized();
    return Array.from(this.templates.values());
  }

  async create(input: CreateTemplatePayload): Promise<Template> {
    await this.ensureInitialized();

    const template: Template = {
      id: this.idGenerator.generate('tmpl'),
      name: input.name,
      role: input.role,
      content: input.content,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.templates.set(template.id, template);
    await this.saveTemplate(template);

    this.logger.debug(`Created template: ${template.id}`);
    return template;
  }

  async update(id: string, updates: UpdateTemplatePayload): Promise<Template> {
    await this.ensureInitialized();

    const template = this.templates.get(id);
    if (!template) {
      throw new NotFoundError('Template', id);
    }

    const updatedTemplate: Template = {
      ...template,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.content !== undefined && { content: updates.content }),
      updatedAt: Date.now()
    };

    this.templates.set(id, updatedTemplate);
    await this.saveTemplate(updatedTemplate);

    this.logger.debug(`Updated template: ${id}`);
    return updatedTemplate;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    const template = this.templates.get(id);
    if (!template) {
      throw new NotFoundError('Template', id);
    }

    // Don't allow deleting default templates - reset them instead
    if (template.isDefault) {
      throw new Error('Cannot delete default template. Use resetToDefault instead.');
    }

    this.templates.delete(id);
    await this.deleteTemplateFile(id);

    this.logger.debug(`Deleted template: ${id}`);
  }

  async resetToDefault(id: string): Promise<Template> {
    await this.ensureInitialized();

    const template = this.templates.get(id);
    if (!template) {
      throw new NotFoundError('Template', id);
    }

    const defaultContent = this.getDefaultContent(template.role);

    const updatedTemplate: Template = {
      ...template,
      content: defaultContent,
      updatedAt: Date.now()
    };

    this.templates.set(id, updatedTemplate);
    await this.saveTemplate(updatedTemplate);

    this.logger.debug(`Reset template to default: ${id}`);
    return updatedTemplate;
  }

  getDefaultContent(role: TemplateRole): string {
    switch (role) {
      case 'worker':
        return DEFAULT_WORKER_TEMPLATE;
      case 'orchestrator':
        return DEFAULT_ORCHESTRATOR_TEMPLATE;
      default:
        throw new Error(`Unknown role: ${role}`);
    }
  }
}
