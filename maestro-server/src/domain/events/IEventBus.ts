/**
 * Event handler function type.
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * Interface for event bus implementations.
 * Provides publish-subscribe pattern for domain events.
 */
export interface IEventBus {
  /**
   * Emit an event with data.
   * @param event - Event name/type
   * @param data - Event payload
   */
  emit<T>(event: string, data: T): Promise<void>;

  /**
   * Subscribe to an event.
   * @param event - Event name/type to listen for
   * @param handler - Function to call when event is emitted
   */
  on<T>(event: string, handler: EventHandler<T>): void;

  /**
   * Unsubscribe from an event.
   * @param event - Event name/type
   * @param handler - Handler function to remove
   */
  off(event: string, handler: EventHandler): void;

  /**
   * Subscribe to an event for one-time execution.
   * @param event - Event name/type to listen for
   * @param handler - Function to call once when event is emitted
   */
  once<T>(event: string, handler: EventHandler<T>): void;

  /**
   * Remove all listeners for an event.
   * @param event - Event name/type (optional - if not provided, removes all)
   */
  removeAllListeners(event?: string): void;

  /**
   * Get count of listeners for an event.
   * @param event - Event name/type
   * @returns Number of registered listeners
   */
  listenerCount?(event: string): number;
}
