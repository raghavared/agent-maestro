/**
 * Log level type.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Log metadata type.
 */
export type LogMetadata = Record<string, any>;

/**
 * Interface for structured logging.
 */
export interface ILogger {
  /**
   * Log an error message.
   * @param message - Error message
   * @param error - Error object (optional)
   * @param meta - Additional metadata (optional)
   */
  error(message: string, error?: Error, meta?: LogMetadata): void;

  /**
   * Log a warning message.
   * @param message - Warning message
   * @param meta - Additional metadata (optional)
   */
  warn(message: string, meta?: LogMetadata): void;

  /**
   * Log an info message.
   * @param message - Info message
   * @param meta - Additional metadata (optional)
   */
  info(message: string, meta?: LogMetadata): void;

  /**
   * Log a debug message.
   * @param message - Debug message
   * @param meta - Additional metadata (optional)
   */
  debug(message: string, meta?: LogMetadata): void;

  /**
   * Create a child logger with additional context.
   * @param context - Additional context to include in all logs
   * @returns A new logger instance with the context
   */
  child?(context: LogMetadata): ILogger;

  /**
   * Set log level dynamically.
   * @param level - New log level
   */
  setLevel?(level: LogLevel): void;
}
