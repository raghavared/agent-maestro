import { readFile, readFileSync, access } from 'fs';
import { constants } from 'fs';
import { promisify } from 'util';
import type { MaestroManifest } from '../types/manifest.js';
import { validateManifest } from '../schemas/manifest-schema.js';
import { normalizeManifest, logManifestNormalizationWarnings } from '../prompting/manifest-normalizer.js';

const readFileAsync = promisify(readFile);
const accessAsync = promisify(access);

/**
 * Result of reading and validating a manifest file
 */
export interface ManifestReadResult {
  success: boolean;
  manifest?: MaestroManifest;
  error?: string;
}

/**
 * Asynchronously reads and validates a manifest file
 *
 * @param filePath - Path to the manifest JSON file
 * @returns ManifestReadResult with success status and manifest or error
 *
 * @example
 * ```typescript
 * const result = await readManifest('./manifest.json');
 * if (result.success) {
 *   console.log('Manifest loaded:', result.manifest);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function readManifest(filePath: string): Promise<ManifestReadResult> {
  try {
    // Check if file exists and is readable
    try {
      await accessAsync(filePath, constants.R_OK);
    } catch (err) {
      return {
        success: false,
        error: `Manifest file not found or not readable: ${filePath}`,
      };
    }

    // Read file contents
    let fileContents: string;
    try {
      fileContents = await readFileAsync(filePath, 'utf-8');
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to read manifest file: ${err.message}`,
      };
    }

    // Parse JSON
    let manifestData: any;
    try {
      manifestData = JSON.parse(fileContents);
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to parse manifest JSON: ${err.message}`,
      };
    }

    // Validate against schema
    const validationResult = validateManifest(manifestData);
    if (!validationResult.valid) {
      return {
        success: false,
        error: `Manifest validation failed: ${validationResult.errors}`,
      };
    }

    // Normalize legacy compatibility fields immediately after read/validate.
    const normalized = normalizeManifest(manifestData as MaestroManifest);
    logManifestNormalizationWarnings(normalized);

    // Return successfully validated and normalized manifest
    return {
      success: true,
      manifest: normalized.manifest,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Unexpected error reading manifest: ${err.message}`,
    };
  }
}

/**
 * Synchronously reads and validates a manifest file
 *
 * @param filePath - Path to the manifest JSON file
 * @returns ManifestReadResult with success status and manifest or error
 *
 * @example
 * ```typescript
 * const result = readManifestSync('./manifest.json');
 * if (result.success) {
 *   console.log('Manifest loaded:', result.manifest);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export function readManifestSync(filePath: string): ManifestReadResult {
  try {
    // Check if file exists and is readable
    try {
      const fs = require('fs');
      fs.accessSync(filePath, constants.R_OK);
    } catch (err) {
      return {
        success: false,
        error: `Manifest file not found or not readable: ${filePath}`,
      };
    }

    // Read file contents
    let fileContents: string;
    try {
      fileContents = readFileSync(filePath, 'utf-8');
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to read manifest file: ${err.message}`,
      };
    }

    // Parse JSON
    let manifestData: any;
    try {
      manifestData = JSON.parse(fileContents);
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to parse manifest JSON: ${err.message}`,
      };
    }

    // Validate against schema
    const validationResult = validateManifest(manifestData);
    if (!validationResult.valid) {
      return {
        success: false,
        error: `Manifest validation failed: ${validationResult.errors}`,
      };
    }

    // Normalize legacy compatibility fields immediately after read/validate.
    const normalized = normalizeManifest(manifestData as MaestroManifest);
    logManifestNormalizationWarnings(normalized);

    // Return successfully validated and normalized manifest
    return {
      success: true,
      manifest: normalized.manifest,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Unexpected error reading manifest: ${err.message}`,
    };
  }
}

/**
 * Reads a manifest from environment variable MAESTRO_MANIFEST_PATH
 *
 * @returns ManifestReadResult with success status and manifest or error
 */
export async function readManifestFromEnv(): Promise<ManifestReadResult> {
  const manifestPath = process.env.MAESTRO_MANIFEST_PATH;

  if (!manifestPath) {
    return {
      success: false,
      error: 'MAESTRO_MANIFEST_PATH environment variable not set',
    };
  }

  return readManifest(manifestPath);
}

/**
 * Validates a manifest object without reading from file
 *
 * @param manifest - Manifest object to validate
 * @returns ManifestReadResult with success status and manifest or error
 */
export function validateManifestObject(manifest: any): ManifestReadResult {
  const validationResult = validateManifest(manifest);

  if (!validationResult.valid) {
    return {
      success: false,
      error: `Manifest validation failed: ${validationResult.errors}`,
    };
  }

  const normalized = normalizeManifest(manifest as MaestroManifest);
  logManifestNormalizationWarnings(normalized);

  return {
    success: true,
    manifest: normalized.manifest,
  };
}
