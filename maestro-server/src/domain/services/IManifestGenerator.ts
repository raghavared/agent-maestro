/**
 * Options for manifest generation.
 */
export interface ManifestGenerationOptions {
  /** Agent mode: execute or coordinate */
  mode: 'execute' | 'coordinate';
  /** Project ID to include in manifest */
  projectId: string;
  /** Array of task IDs to include in manifest */
  taskIds: string[];
  /** Array of skill names to load */
  skills: string[];
  /** Session ID for this manifest */
  sessionId: string;
  /** API URL for server communication */
  apiUrl: string;
}

/**
 * Generated manifest result.
 */
export interface GeneratedManifest {
  /** Absolute path to the generated manifest file */
  manifestPath: string;
  /** The manifest object */
  manifest: {
    manifestVersion: string;
    mode: 'execute' | 'coordinate';
    session: {
      id: string;
      model: string;
    };
    project?: {
      id: string;
      name: string;
      workingDir: string;
    };
    tasks?: Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority?: string;
    }>;
    skills?: string[];
    apiUrl: string;
    [key: string]: any;
  };
}

/**
 * Interface for manifest generation services.
 * Implementations can generate manifests via CLI or directly in Node.js.
 */
export interface IManifestGenerator {
  /**
   * Generate a manifest file for session initialization.
   * @param options - Manifest generation options
   * @returns Generated manifest path and content
   * @throws {ValidationError} if options are invalid
   * @throws {NotFoundError} if project or tasks don't exist
   * @throws {ManifestGenerationError} if generation fails
   */
  generate(options: ManifestGenerationOptions): Promise<GeneratedManifest>;

  /**
   * Validate a manifest structure.
   * @param manifest - Manifest object to validate
   * @returns true if valid, false otherwise
   */
  validate(manifest: any): Promise<boolean>;

  /**
   * Clean up old manifest files.
   * @param sessionId - Session ID whose manifest to clean
   */
  cleanup?(sessionId: string): Promise<void>;
}
