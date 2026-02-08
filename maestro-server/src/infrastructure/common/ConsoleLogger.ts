import { ILogger, LogLevel, LogMetadata } from '../../domain/common/ILogger';

/**
 * Simple console-based logger implementation.
 */
export class ConsoleLogger implements ILogger {
  private level: LogLevel;
  private context: LogMetadata;

  private static readonly LEVELS: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };

  constructor(level: LogLevel = 'info', context: LogMetadata = {}) {
    this.level = level;
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return ConsoleLogger.LEVELS[level] <= ConsoleLogger.LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.context).length > 0
      ? ` [${Object.entries(this.context).map(([k, v]) => `${k}=${v}`).join(' ')}]`
      : '';
    const metaStr = meta && Object.keys(meta).length > 0
      ? ` ${JSON.stringify(meta)}`
      : '';
    return `${timestamp} [${level.toUpperCase()}]${contextStr} ${message}${metaStr}`;
  }

  error(message: string, error?: Error, meta?: LogMetadata): void {
    if (!this.shouldLog('error')) return;
    const fullMeta = error ? { ...meta, error: error.message, stack: error.stack } : meta;
    console.error(this.formatMessage('error', message, fullMeta));
  }

  warn(message: string, meta?: LogMetadata): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('warn', message, meta));
  }

  info(message: string, meta?: LogMetadata): void {
    if (!this.shouldLog('info')) return;
    console.info(this.formatMessage('info', message, meta));
  }

  debug(message: string, meta?: LogMetadata): void {
    if (!this.shouldLog('debug')) return;
    console.debug(this.formatMessage('debug', message, meta));
  }

  child(context: LogMetadata): ILogger {
    return new ConsoleLogger(this.level, { ...this.context, ...context });
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}
