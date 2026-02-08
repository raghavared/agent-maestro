/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Declare CommonJS `require` so that Zustand stores can use lazy
 * `require()` calls for cross-store references without TS2591 errors.
 *
 * At runtime, Vite's bundler converts these to ESM imports.
 */
declare function require(id: string): any;
