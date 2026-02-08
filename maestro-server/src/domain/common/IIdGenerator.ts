/**
 * Interface for generating unique IDs.
 */
export interface IIdGenerator {
  /**
   * Generate a unique ID with optional prefix.
   * @param prefix - Prefix for the ID (e.g., 'proj', 'task', 'sess')
   * @returns A unique ID string
   * @example
   * generate('proj') => 'proj_1706884823456_a1b2c3'
   * generate('task') => 'task_1706884823457_d4e5f6'
   */
  generate(prefix: string): string;

  /**
   * Validate an ID format.
   * @param id - ID to validate
   * @returns true if ID is valid
   */
  validate?(id: string): boolean;
}
