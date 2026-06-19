import { Logger } from '@nestjs/common';

type ClosableApp = {
  close(signal?: string): Promise<void>;
};

type ShutdownLogger = Pick<Logger, 'error' | 'log'>;

type ShutdownOptions = {
  logger: ShutdownLogger;
  timeoutMs?: number;
  exit?: (code: number) => never | void;
};

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30_000;

export function createGracefulShutdownHandler(app: ClosableApp, options: ShutdownOptions) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  const exit = options.exit ?? process.exit;
  let isShuttingDown = false;

  return async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    options.logger.log(`Shutting down gracefully after ${signal}...`);

    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Graceful shutdown timed out')), timeoutMs);
      timeout.unref();
    });

    try {
      await Promise.race([app.close(signal), timeoutPromise]);
      options.logger.log('Shutdown complete');
      exit(0);
    } catch (error) {
      options.logger.error(
        'Graceful shutdown failed',
        error instanceof Error ? error.stack : String(error),
      );
      exit(1);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  };
}
