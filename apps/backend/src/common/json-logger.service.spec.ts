import { JsonLoggerService } from './json-logger.service';

describe('JsonLoggerService', () => {
  let writeSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    errSpy.mockRestore();
    process.env = originalEnv;
  });

  function parseLog(call: string): any {
    return JSON.parse(call.replace(/\n$/, ''));
  }

  it('emits a JSON entry with required fields on log()', () => {
    process.env.NODE_ENV = 'production';
    const logger = new JsonLoggerService({ serviceName: 'svc', level: 'log' });
    logger.log('hello', 'TestCtx');

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const entry = parseLog(writeSpy.mock.calls[0][0]);
    expect(entry).toMatchObject({
      level: 'log',
      service: 'svc',
      env: 'production',
      context: 'TestCtx',
      message: 'hello',
    });
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('emits pretty JSON in development', () => {
    process.env.NODE_ENV = 'development';
    const logger = new JsonLoggerService({ level: 'log' });
    logger.log('hi');
    expect(writeSpy.mock.calls[0][0]).toContain('\n  ');
  });

  it('emits compact JSON in production', () => {
    process.env.NODE_ENV = 'production';
    const logger = new JsonLoggerService({ level: 'log' });
    logger.log('hi');
    expect(writeSpy.mock.calls[0][0]).not.toContain('\n  ');
  });

  it('suppresses messages below the configured level', () => {
    process.env.NODE_ENV = 'production';
    const logger = new JsonLoggerService({ level: 'warn' });
    logger.log('info message');
    logger.debug('debug message');
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('routes error and warn to stderr', () => {
    process.env.NODE_ENV = 'production';
    const logger = new JsonLoggerService({ level: 'log' });
    logger.warn('careful');
    logger.error('boom', new Error('stack-here').stack ?? 'trace');
    expect(writeSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(2);
  });

  it('propagates requestId via runWithContext', () => {
    process.env.NODE_ENV = 'production';
    const logger = new JsonLoggerService({ level: 'log' });
    logger.runWithContext({ requestId: 'abc-123', method: 'GET', path: '/foo' }, () => {
      logger.log('inside');
    });
    const entry = parseLog(writeSpy.mock.calls[0][0]);
    expect(entry.requestId).toBe('abc-123');
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/foo');
  });

  it('includes stack and errorName on error()', () => {
    process.env.NODE_ENV = 'production';
    const logger = new JsonLoggerService({ level: 'error' });
    const err = new Error('kaboom');
    logger.error('explosion', err, 'Handler');
    const entry = parseLog(errSpy.mock.calls[0][0]);
    expect(entry.level).toBe('error');
    expect(entry.errorName).toBe('Error');
    expect(entry.stack).toContain('kaboom');
    expect(entry.context).toBe('Handler');
  });

  it('maps "info" alias to log level', () => {
    process.env.NODE_ENV = 'production';
    const logger = new JsonLoggerService({ level: 'info' });
    logger.log('info-msg');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});
