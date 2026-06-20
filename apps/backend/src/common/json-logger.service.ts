import { AsyncLocalStorage } from 'async_hooks';
import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

/**
 * Allowed application log levels in increasing order of severity.
 * A logger configured at level X will emit logs at level >= X.
 */
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  verbose: 15,
  log: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const LEVEL_ALIASES: Record<string, LogLevel> = {
  debug: 'debug',
  verbose: 'verbose',
  info: 'log',
  log: 'log',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
};

export type LogFormat = 'json' | 'pretty';

/**
 * Per-request context propagated via AsyncLocalStorage so every log
 * emitted while handling a request can be correlated to a requestId.
 */
export interface RequestLogContext {
  requestId?: string;
  method?: string;
  path?: string;
}

@Injectable()
export class JsonLoggerService implements LoggerService {
  private readonly minLevel: number;
  private readonly serviceName: string;
  private readonly env: string;
  private readonly format: LogFormat;
  private readonly als = new AsyncLocalStorage<RequestLogContext>();

  constructor(options: {
    level?: string;
    serviceName?: string;
    env?: string;
    format?: LogFormat;
  } = {}) {
    const configured = (options.level ?? process.env.LOG_LEVEL ?? 'log').toLowerCase();
    const resolved = LEVEL_ALIASES[configured] ?? 'log';
    this.minLevel = LEVEL_ORDER[resolved];
    this.serviceName = options.serviceName ?? process.env.SERVICE_NAME ?? 'stellar-bounty-backend';
    this.env = options.env ?? process.env.NODE_ENV ?? 'development';
    this.format = options.format ?? (this.env === 'production' ? 'json' : 'pretty');
  }

  /** Run `fn` with a request-scoped log context. */
  runWithContext<T>(ctx: RequestLogContext, fn: () => T): T {
    return this.als.run({ ...ctx }, fn);
  }

  /** Merge `patch` into the current request context, if any. */
  mergeContext(patch: RequestLogContext): void {
    const store = this.als.getStore();
    if (store) Object.assign(store, patch);
  }

  get currentContext(): RequestLogContext | undefined {
    return this.als.getStore();
  }

  log(message: unknown, context?: string): void {
    this.emit('log', message, context);
  }

  error(message: unknown, trace?: string | Error, context?: string): void {
    const traceString = typeof trace === 'string' ? trace : trace?.stack;
    const traceError = trace instanceof Error ? trace : undefined;
    const stack = traceString ?? (message instanceof Error ? message.stack : undefined);
    this.emit('error', message, context, {
      stack,
      errorName:
        traceError?.name ?? (message instanceof Error ? message.name : undefined),
    });
  }

  warn(message: unknown, context?: string): void {
    this.emit('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.emit('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.emit('verbose', message, context);
  }

  setLogLevels?(_levels: LogLevel[]): void {
    // No-op: level is fixed at construction time. Kept to satisfy the
    // optional `LoggerService.setLogLevels` interface.
    void _levels;
  }

  private emit(
    level: LogLevel,
    message: unknown,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    if (LEVEL_ORDER[level] < this.minLevel) return;

    const ctx = this.als.getStore();
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      env: this.env,
      requestId: ctx?.requestId,
      context,
      message: this.normalizeMessage(message),
      ...(ctx?.method ? { method: ctx.method } : {}),
      ...(ctx?.path ? { path: ctx.path } : {}),
      ...(extra ?? {}),
    };

    const line = this.format === 'pretty'
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    const sink = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    sink.write(line + '\n');
  }

  private normalizeMessage(message: unknown): unknown {
    if (message instanceof Error) {
      return { name: message.name, message: message.message };
    }
    if (typeof message === 'string') return message;
    return message;
  }
}

/** Module-level singleton, used by the bootstrap and middleware. */
export const jsonLogger = new JsonLoggerService();
