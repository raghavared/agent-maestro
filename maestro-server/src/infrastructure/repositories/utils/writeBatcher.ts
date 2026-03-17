import { atomicWriteFile } from './atomicWrite';

/**
 * Batches and debounces file writes.
 * Marks entities as dirty and flushes on a timer or explicit flush() call.
 */
export class WriteBatcher {
  private dirtyEntities: Map<string, { filePath: string; data: string }> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushIntervalMs: number;

  constructor(options?: { flushIntervalMs?: number }) {
    this.flushIntervalMs = options?.flushIntervalMs ?? 500;
  }

  markDirty(entityId: string, filePath: string, data: string): void {
    this.dirtyEntities.set(entityId, { filePath, data });
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const entries = Array.from(this.dirtyEntities.entries());
    this.dirtyEntities.clear();
    await Promise.allSettled(
      entries.map(([_, { filePath, data }]) => atomicWriteFile(filePath, data))
    );
  }

  async destroy(): Promise<void> {
    await this.flush();
  }
}
