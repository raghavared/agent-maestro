import { maestroClient } from './MaestroClient';

/**
 * Maestro Session Helpers
 *
 * Session spawning is handled by the server + CLI architecture:
 *   1. UI calls POST /sessions/spawn on the server
 *   2. Server generates manifest, emits session:spawn via WebSocket
 *   3. MaestroContext receives the event and spawns a terminal running `maestro worker init`
 *   4. CLI reads the manifest, uses ClaudeSpawner to launch Claude with proper --plugin-dir (hooks)
 *
 * This module only contains cleanup helpers.
 */

/**
 * Deletes a Maestro session when terminal closes
 *
 * This ensures proper cleanup of session data from server and UI cache.
 * The session is permanently removed from storage and all task references are cleaned up.
 */
export async function deleteSession(sessionId: string): Promise<void> {
    try {
        await maestroClient.deleteSession(sessionId);
    } catch {
        // Fallback: try to mark as completed if delete fails
        try {
            await maestroClient.updateSession(sessionId, {
                status: 'completed',
                completedAt: Date.now(),
            });
        } catch {
        }
    }
}
