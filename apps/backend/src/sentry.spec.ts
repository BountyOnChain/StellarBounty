import { initSentry, sentryErrorHandler } from '../sentry';

const mockInit = jest.fn();
const mockWithScope = jest.fn();
const mockCaptureException = jest.fn();

jest.mock('@sentry/nestjs', () => ({
  init: (...args: unknown[]) => mockInit(...args),
  withScope: (cb: (scope: any) => void) => mockWithScope(cb),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (values[key] !== undefined) return values[key];
      return defaultValue;
    }),
  } as any;
}

describe('Sentry configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithScope.mockImplementation((cb: (scope: any) => void) => {
      const scope = {
        setTag: jest.fn(),
        setContext: jest.fn(),
        setUser: jest.fn(),
      };
      cb(scope);
    });
  });

  it('initializes Sentry with DSN when provided', () => {
    const config = createConfig({ SENTRY_DSN: 'https://example@sentry.io/123' });
    initSentry(config);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://example@sentry.io/123',
      }),
    );
  });

  it('initializes Sentry without DSN when not configured (gracefully disabled)', () => {
    const config = createConfig({ SENTRY_DSN: '' });
    initSentry(config);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: undefined,
      }),
    );
  });

  it('sets environment from NODE_ENV', () => {
    const config = createConfig({ NODE_ENV: 'production' });
    initSentry(config);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'production',
      }),
    );
  });

  it('defaults environment to development', () => {
    const config = createConfig();
    initSentry(config);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'development',
      }),
    );
  });

  it('sets release from RELEASE config', () => {
    const config = createConfig({ RELEASE: 'abc123' });
    initSentry(config);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        release: 'abc123',
      }),
    );
  });

  it('disables default PII collection', () => {
    const config = createConfig();
    initSentry(config);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        sendDefaultPii: false,
      }),
    );
  });

  it('scrubs PII fields in beforeSend hook', () => {
    const config = createConfig();
    initSentry(config);
    const initCall = mockInit.mock.calls[0][0];
    const beforeSend = initCall.beforeSend;

    const event = {
      request: {
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
          signature: '0xabc',
        },
        data: {
          accessToken: 'secret',
          name: 'test',
        },
      },
    };

    const result = beforeSend(event);
    expect(result.request.headers.authorization).toBe('[REDACTED]');
    expect(result.request.headers.signature).toBe('[REDACTED]');
    expect(result.request.data.accessToken).toBe('[REDACTED]');
    expect(result.request.data.name).toBe('test');
    expect(result.request.headers['content-type']).toBe('application/json');
  });

  it('sentryErrorHandler reports error to Sentry with request context', () => {
    const req = {
      url: '/api/test',
      method: 'POST',
      headers: {},
    } as any;
    const error = new Error('Test error');

    sentryErrorHandler(req, error);

    expect(mockWithScope).toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });
});
