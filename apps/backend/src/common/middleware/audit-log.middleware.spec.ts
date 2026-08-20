import { AuditLogMiddleware } from './audit-log.middleware';
import { jsonLogger } from '../json-logger.service';

jest.mock('../json-logger.service', () => ({
  jsonLogger: {
    log: jest.fn(),
    warn: jest.fn(),
    runWithContext: jest.fn((ctx: unknown, fn: () => void) => fn()),
  },
}));

describe('AuditLogMiddleware', () => {
  let middleware: AuditLogMiddleware;

  beforeEach(() => {
    middleware = new AuditLogMiddleware();
    jest.clearAllMocks();
  });

  it('calls next and attaches finish listener', () => {
    const req = { method: 'GET', originalUrl: '/api/v1/health', ip: '127.0.0.1', get: () => 'test-agent' } as any;
    const res = { on: jest.fn(), statusCode: 200 } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('emits a JSON log entry via jsonLogger on successful response', () => {
    const req = { method: 'GET', originalUrl: '/api/v1/health', ip: '127.0.0.1', get: () => 'test-agent' } as any;
    let finishCallback: () => void = () => {};
    const res = { on: jest.fn((event: string, cb: () => void) => { finishCallback = cb; }), statusCode: 200 } as any;
    const next = jest.fn();

    middleware.use(req, res, next);
    finishCallback();

    expect(jsonLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'http_audit',
        method: 'GET',
        path: '/api/v1/health',
        statusCode: 200,
        durationMs: expect.any(Number),
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      }),
      'AUDIT',
    );
  });

  it('emits a warn-level log for 4xx/5xx status codes', () => {
    const req = { method: 'POST', originalUrl: '/api/v1/auth/verify', ip: '10.0.0.1', get: () => 'test-agent' } as any;
    let finishCallback: () => void = () => {};
    const res = { on: jest.fn((event: string, cb: () => void) => { finishCallback = cb; }), statusCode: 401 } as any;
    const next = jest.fn();

    middleware.use(req, res, next);
    finishCallback();

    expect(jsonLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'http_audit',
        statusCode: 401,
      }),
      'AUDIT',
    );
    expect(jsonLogger.log).not.toHaveBeenCalled();
  });

  it('redacts sensitive query parameters from the logged path', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/auth/challenge?address=GABC&token=secret123&code=xyz',
      ip: '127.0.0.1',
      get: () => 'test-agent',
    } as any;
    let finishCallback: () => void = () => {};
    const res = { on: jest.fn((event: string, cb: () => void) => { finishCallback = cb; }), statusCode: 200 } as any;
    const next = jest.fn();

    middleware.use(req, res, next);
    finishCallback();

    expect(jsonLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining('token=%5BREDACTED%5D'),
      }),
      'AUDIT',
    );
  });

  it('preserves non-sensitive query parameters', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/bounties?limit=10&status=open',
      ip: '127.0.0.1',
      get: () => 'test-agent',
    } as any;
    let finishCallback: () => void = () => {};
    const res = { on: jest.fn((event: string, cb: () => void) => { finishCallback = cb; }), statusCode: 200 } as any;
    const next = jest.fn();

    middleware.use(req, res, next);
    finishCallback();

    expect(jsonLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/v1/bounties?limit=10&status=open',
      }),
      'AUDIT',
    );
  });
});
