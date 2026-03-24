import * as fs from 'fs/promises';
import * as crypto from 'crypto';

/**
 * Atomic file write using write-to-temp + rename pattern.
 * rename() is atomic on POSIX systems.
 */
export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tmpPath, data, 'utf-8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch {}
    throw err;
  }
}
