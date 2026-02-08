import { IIdGenerator } from '../../domain/common/IIdGenerator';

/**
 * ID generator that uses timestamps and random strings.
 * Generates IDs in the format: {prefix}_{timestamp}_{random}
 */
export class TimestampIdGenerator implements IIdGenerator {
  /**
   * Generate a unique ID with the given prefix.
   * @param prefix - Prefix for the ID (e.g., 'proj', 'task', 'sess', 'evt')
   * @returns A unique ID string
   */
  generate(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Validate an ID format.
   * @param id - ID to validate
   * @returns true if ID matches expected format
   */
  validate(id: string): boolean {
    // Format: prefix_timestamp_random
    const parts = id.split('_');
    if (parts.length < 3) return false;

    const timestamp = parseInt(parts[1], 10);
    if (isNaN(timestamp)) return false;

    return true;
  }
}
