import { EventEmitter } from 'events';
import { IEventBus, EventHandler } from '../../domain/events/IEventBus';
import { ILogger } from '../../domain/common/ILogger';

/**
 * In-memory event bus implementation using Node.js EventEmitter.
 * Provides async event emission with error handling.
 */
export class InMemoryEventBus implements IEventBus {
  private emitter: EventEmitter;
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.emitter = new EventEmitter();
    this.logger = logger;

    // Increase max listeners for busy applications
    this.emitter.setMaxListeners(100);
  }

  /**
   * Emit an event with data.
   * Handlers are called asynchronously and errors are caught.
   */
  async emit<T>(event: string, data: T): Promise<void> {
    this.logger.debug(`Event emitted: ${event}`, { event, data });

    // Get all listeners
    const listeners = this.emitter.listeners(event);

    // Execute all handlers, catching errors
    const promises = listeners.map(async (listener) => {
      try {
        await (listener as EventHandler<T>)(data);
      } catch (error) {
        this.logger.error(`Error in event handler for ${event}:`, error as Error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Subscribe to an event.
   */
  on<T>(event: string, handler: EventHandler<T>): void {
    this.emitter.on(event, handler);
    this.logger.debug(`Handler registered for: ${event}`);
  }

  /**
   * Unsubscribe from an event.
   */
  off(event: string, handler: EventHandler): void {
    this.emitter.off(event, handler);
    this.logger.debug(`Handler removed for: ${event}`);
  }

  /**
   * Subscribe to an event for one-time execution.
   */
  once<T>(event: string, handler: EventHandler<T>): void {
    this.emitter.once(event, handler);
    this.logger.debug(`One-time handler registered for: ${event}`);
  }

  /**
   * Remove all listeners for an event, or all events if not specified.
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.emitter.removeAllListeners(event);
      this.logger.debug(`All handlers removed for: ${event}`);
    } else {
      this.emitter.removeAllListeners();
      this.logger.debug('All handlers removed');
    }
  }

  /**
   * Get count of listeners for an event.
   */
  listenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Get the underlying EventEmitter (for backward compatibility).
   * @deprecated Use IEventBus methods instead
   */
  getEmitter(): EventEmitter {
    return this.emitter;
  }
}
