import { createGracefulShutdownHandler } from './graceful-shutdown';

describe('createGracefulShutdownHandler', () => {
  it('closes the app and exits successfully', async () => {
    const close = jest.fn(async () => undefined);
    const logger = { log: jest.fn(), error: jest.fn() };
    const exit = jest.fn();
    const shutdown = createGracefulShutdownHandler({ close }, { logger, exit });

    await shutdown('SIGTERM');

    expect(close).toHaveBeenCalledWith('SIGTERM');
    expect(logger.log).toHaveBeenCalledWith('Shutting down gracefully after SIGTERM...');
    expect(logger.log).toHaveBeenCalledWith('Shutdown complete');
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('ignores duplicate shutdown signals while a shutdown is in progress', async () => {
    let resolveClose: () => void = () => undefined;
    const close = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const logger = { log: jest.fn(), error: jest.fn() };
    const exit = jest.fn();
    const shutdown = createGracefulShutdownHandler({ close }, { logger, exit });

    const first = shutdown('SIGTERM');
    await shutdown('SIGINT');
    resolveClose();
    await first;

    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits with failure when app.close rejects', async () => {
    const close = jest.fn(async () => {
      throw new Error('close failed');
    });
    const logger = { log: jest.fn(), error: jest.fn() };
    const exit = jest.fn();
    const shutdown = createGracefulShutdownHandler({ close }, { logger, exit });

    await shutdown('SIGTERM');

    expect(logger.error).toHaveBeenCalledWith('Graceful shutdown failed', expect.stringContaining('close failed'));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits with failure when app.close times out', async () => {
    jest.useFakeTimers();
    const close = jest.fn(() => new Promise<void>(() => undefined));
    const logger = { log: jest.fn(), error: jest.fn() };
    const exit = jest.fn();
    const shutdown = createGracefulShutdownHandler({ close }, { logger, exit, timeoutMs: 1000 });

    const shutdownPromise = shutdown('SIGTERM');
    await jest.advanceTimersByTimeAsync(1000);
    await shutdownPromise;

    expect(close).toHaveBeenCalledWith('SIGTERM');
    expect(logger.error).toHaveBeenCalledWith(
      'Graceful shutdown failed',
      expect.stringContaining('Graceful shutdown timed out'),
    );
    expect(exit).toHaveBeenCalledWith(1);
    jest.useRealTimers();
  });
});
