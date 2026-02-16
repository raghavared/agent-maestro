import type { MaestroManifest, AdditionalContext, AgentTool, AgentMode } from '../types/manifest.js';
import { validateManifest } from '../schemas/manifest-schema.js';
import { storage } from '../storage.js';

/**
 * Task data input for manifest generation
 */
export interface TaskInput {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  projectId: string;
  createdAt: string;
  parentId?: string | null;
  dependencies?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

/**
 * Session options for manifest generation
 */
export interface SessionOptions {
  model: string;
  permissionMode: 'acceptEdits' | 'interactive' | 'readOnly';
  thinkingMode?: 'auto' | 'interleaved' | 'disabled';
  maxTurns?: number;
  timeout?: number;
  workingDirectory?: string;
  context?: AdditionalContext;
}

/**
 * CLI Command handler for manifest generation
 */
export class ManifestGeneratorCLICommand {
  private generator: ManifestGenerator;

  constructor() {
    this.generator = new ManifestGenerator();
  }

  /**
   * Fetch task data from local storage
   */
  async fetchTask(taskId: string): Promise<TaskInput> {
    await storage.initialize();
    const task = storage.getTask(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found in local storage (~/.maestro/data/tasks/)`);
    }

    // Ensure acceptanceCriteria has at least one item
    let acceptanceCriteria = task.acceptanceCriteria || [];
    if (acceptanceCriteria.length === 0) {
      acceptanceCriteria = ['Task completion as described'];
    }

    // Convert timestamp to ISO string
    const createdAt = typeof task.createdAt === 'number'
      ? new Date(task.createdAt).toISOString()
      : String(task.createdAt);

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      acceptanceCriteria,
      projectId: task.projectId,
      createdAt,
      parentId: task.parentId,
      dependencies: task.dependencies,
      priority: task.priority as any,
      metadata: task.metadata,
    };
  }

  /**
   * Fetch project data from local storage
   */
  async fetchProject(projectId: string): Promise<{ workingDir: string }> {
    await storage.initialize();
    const project = storage.getProject(projectId);

    if (!project) {
      throw new Error(`Project ${projectId} not found in local storage (~/.maestro/data/projects/)`);
    }

    return {
      workingDir: project.workingDir,
    };
  }

  /**
   * Execute the CLI command
   */
  async execute(options: {
    mode: AgentMode;
    projectId: string;
    taskIds: string[];
    skills?: string[];
    output: string;
    strategy?: string;
    model?: string;
    agentTool?: AgentTool;
    referenceTaskIds?: string[];
  }): Promise<void> {
    try {
      console.error('Generating manifest...');
      console.error(`  Mode: ${options.mode}`);
      console.error(`  Strategy: ${options.strategy || 'simple'}`);
      console.error(`  Task IDs: ${options.taskIds.join(', ')}`);
      console.error(`  Project ID: ${options.projectId}`);

      // 1. Fetch ALL tasks
      const tasks: TaskInput[] = [];
      for (const taskId of options.taskIds) {
        const task = await this.fetchTask(taskId);
        tasks.push(task);
        console.error(`  Task: ${task.title} (${taskId})`);
      }

      // 2. Fetch project
      const project = await this.fetchProject(options.projectId);
      console.error(`  Working Directory: ${project.workingDir}`);

      // 3. Build session options
      const sessionOptions: SessionOptions = {
        model: options.model || 'sonnet',
        permissionMode: 'acceptEdits',
        thinkingMode: 'auto',
        workingDirectory: project.workingDir,
        context: {
          custom: {
            taskIds: options.taskIds,
          },
        },
      };

      // 4. Generate manifest with all tasks
      const manifest = this.generator.generateManifest(
        options.mode,
        tasks,
        sessionOptions
      );

      // Add skills to manifest root
      manifest.skills = options.skills || ['maestro-worker'];

      // Add strategy to manifest (if specified)
      if (options.strategy) {
        manifest.strategy = options.strategy as any;
      }

      // Add agent tool to manifest (if specified)
      if (options.agentTool) {
        manifest.agentTool = options.agentTool;
      }

      // Add reference task IDs to manifest (if specified)
      if (options.referenceTaskIds && options.referenceTaskIds.length > 0) {
        manifest.referenceTaskIds = options.referenceTaskIds;
      }

      // 5. Validate manifest
      const validationResult = this.generator.validateGeneratedManifest(manifest);
      if (!validationResult) {
        // Get detailed validation errors
        const { validateManifest } = await import('../schemas/manifest-schema.js');
        const result = validateManifest(manifest);
        throw new Error(`Generated manifest failed validation: ${result.errors || 'Unknown error'}`);
      }

      // 6. Save to file with skills included
      const { writeFile, mkdir } = await import('fs/promises');
      const { dirname } = await import('path');

      // Ensure output directory exists
      const outputDir = dirname(options.output);
      await mkdir(outputDir, { recursive: true });

      const json = this.generator.serializeManifest(manifest);
      await writeFile(options.output, json, 'utf-8');

      console.error(`Manifest generated: ${options.output}`);
      process.exit(0);
    } catch (error: any) {
      console.error(`Failed to generate manifest: ${error.message}`);
      process.exit(1);
    }
  }
}

/**
 * ManifestGenerator - Generate manifest files from task data
 *
 * Creates valid manifest files that can be used to spawn Claude sessions.
 */
export class ManifestGenerator {
  /**
   * Generate a manifest from task data
   *
   * @param mode - Agent mode (execute or coordinate)
   * @param tasksData - Array of task information (supports multi-task sessions)
   * @param options - Session configuration
   * @returns Generated manifest
   */
  generateManifest(
    mode: AgentMode,
    tasksData: TaskInput | TaskInput[],
    options: SessionOptions
  ): MaestroManifest {
    // Ensure tasksData is an array
    const tasks = Array.isArray(tasksData) ? tasksData : [tasksData];

    // Map tasks to TaskData format
    const taskDataArray = tasks.map(taskData => ({
      id: taskData.id,
      title: taskData.title,
      description: taskData.description,
      acceptanceCriteria: taskData.acceptanceCriteria,
      projectId: taskData.projectId,
      createdAt: taskData.createdAt,
      ...(taskData.parentId !== undefined && { parentId: taskData.parentId }),
      ...(taskData.dependencies && { dependencies: taskData.dependencies }),
      ...(taskData.priority && { priority: taskData.priority }),
      ...(taskData.metadata && { metadata: taskData.metadata }),
    }));

    const manifest: MaestroManifest = {
      manifestVersion: '1.0',
      mode,
      tasks: taskDataArray,
      session: {
        model: options.model,
        permissionMode: options.permissionMode,
        ...(options.thinkingMode && { thinkingMode: options.thinkingMode }),
        ...(options.maxTurns && { maxTurns: options.maxTurns }),
        ...(options.timeout && { timeout: options.timeout }),
        ...(options.workingDirectory && { workingDirectory: options.workingDirectory }),
      },
      ...(options.context && { context: options.context }),
    };

    return manifest;
  }

  /**
   * Generate manifest from API task data
   *
   * @param taskId - Task ID to fetch from API
   * @param options - Session configuration
   * @returns Generated manifest
   */
  async generateFromApi(
    taskId: string,
    options: SessionOptions
  ): Promise<MaestroManifest> {
    // This would fetch task data from the API
    // For now, just placeholder
    throw new Error('generateFromApi not yet implemented - use generateManifest instead');
  }

  /**
   * Serialize manifest to JSON
   *
   * @param manifest - The manifest to serialize
   * @returns JSON string
   */
  serializeManifest(manifest: MaestroManifest): string {
    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Validate a generated manifest
   *
   * @param manifest - The manifest to validate
   * @returns true if valid
   */
  validateGeneratedManifest(manifest: MaestroManifest): boolean {
    const result = validateManifest(manifest);
    return result.valid;
  }

  /**
   * Generate and save manifest to file
   *
   * @param mode - Agent mode
   * @param taskData - Task information
   * @param options - Session configuration
   * @param outputPath - File path to save manifest
   */
  async generateAndSave(
    mode: AgentMode,
    taskData: TaskInput,
    options: SessionOptions,
    outputPath: string
  ): Promise<void> {
    const manifest = this.generateManifest(mode, taskData, options);

    // Validate before saving
    if (!this.validateGeneratedManifest(manifest)) {
      throw new Error('Generated manifest is invalid');
    }

    const json = this.serializeManifest(manifest);

    // Save to file
    const { writeFile } = await import('fs/promises');
    await writeFile(outputPath, json, 'utf-8');
  }
}

/**
 * Register manifest commands with Commander
 */
export function registerManifestCommands(program: any): void {
  const manifest = program.command('manifest').description('Manifest generation commands');

  manifest
    .command('generate')
    .description('Generate a manifest file from task and project data')
    .requiredOption('--mode <mode>', 'Agent mode (execute or coordinate)')
    .requiredOption('--project-id <id>', 'Project ID')
    .requiredOption('--task-ids <ids>', 'Comma-separated task IDs')
    .option('--skills <skills>', 'Comma-separated skills', 'maestro-worker')
    .option('--strategy <strategy>', 'Strategy (simple, queue, tree, default, intelligent-batching, dag)', 'simple')
    .option('--model <model>', 'Model to use (e.g. sonnet, gpt-5.3-codex, gemini-3-pro-preview)', 'sonnet')
    .option('--agent-tool <tool>', 'Agent tool to use (claude-code, codex, or gemini)', 'claude-code')
    .option('--reference-task-ids <ids>', 'Comma-separated reference task IDs for context')
    .requiredOption('--output <path>', 'Output file path')
    .action(async (options: any) => {
      // Parse comma-separated values
      const taskIds = options.taskIds.split(',').map((id: string) => id.trim());
      const skills = options.skills.split(',').map((skill: string) => skill.trim());

      // Validate mode
      if (options.mode !== 'execute' && options.mode !== 'coordinate') {
        console.error('Error: mode must be "execute" or "coordinate"');
        process.exit(1);
      }

      // Validate agent tool
      const validTools = ['claude-code', 'codex', 'gemini'];
      if (options.agentTool && !validTools.includes(options.agentTool)) {
        console.error(`Error: agent-tool must be one of: ${validTools.join(', ')}`);
        process.exit(1);
      }

      // Parse reference task IDs if provided
      const referenceTaskIds = options.referenceTaskIds
        ? options.referenceTaskIds.split(',').map((id: string) => id.trim()).filter(Boolean)
        : undefined;

      // Create and execute command (reads from local storage, no API needed)
      const command = new ManifestGeneratorCLICommand();
      await command.execute({
        mode: options.mode,
        projectId: options.projectId,
        taskIds,
        skills,
        output: options.output,
        strategy: options.strategy,
        model: options.model,
        agentTool: options.agentTool !== 'claude-code' ? options.agentTool : undefined,
        referenceTaskIds,
      });
    });
}
