import * as fs from 'fs/promises';

/**
 * Load multiple files in parallel with bounded concurrency.
 * Uses Promise.allSettled to handle individual file failures gracefully.
 */
export async function loadFilesParallel<T>(
  filePaths: string[],
  loader: (filePath: string) => Promise<T>,
  options?: { concurrency?: number }
): Promise<{ successes: T[]; failures: { path: string; error: Error }[] }> {
  const concurrency = options?.concurrency ?? 50;
  const successes: T[] = [];
  const failures: { path: string; error: Error }[] = [];

  for (let i = 0; i < filePaths.length; i += concurrency) {
    const chunk = filePaths.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map(async (filePath) => {
        const result = await loader(filePath);
        return { filePath, result };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        successes.push(r.value.result);
      } else {
        failures.push({
          path: chunk[results.indexOf(r)],
          error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        });
      }
    }
  }

  return { successes, failures };
}
