import { ConfigService } from '@nestjs/config';
import { createCorsOptions, getAllowedCorsOrigins } from './cors.config';

function createConfig(values: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('CORS configuration', () => {
  it('defaults to the local frontend origin', () => {
    expect(getAllowedCorsOrigins(createConfig())).toEqual(['http://localhost:3000']);
  });

  it('keeps the existing CORS_ORIGIN setting as a fallback', () => {
    expect(getAllowedCorsOrigins(createConfig({ CORS_ORIGIN: 'https://app.example.com' }))).toEqual([
      'https://app.example.com',
    ]);
  });

  it('parses comma-separated origins from CORS_ORIGINS first', () => {
    expect(
      getAllowedCorsOrigins(
        createConfig({
          CORS_ORIGIN: 'https://single.example.com',
          CORS_ORIGINS: 'https://app.example.com, http://localhost:3000, ',
        }),
      ),
    ).toEqual(['https://app.example.com', 'http://localhost:3000']);
  });

  it('allows configured origins and requests without an Origin header', () => {
    const options = createCorsOptions(createConfig({ CORS_ORIGINS: 'https://app.example.com' }));
    const callback = jest.fn();

    options.origin('https://app.example.com', callback);
    options.origin(undefined, callback);

    expect(callback).toHaveBeenNthCalledWith(1, null, true);
    expect(callback).toHaveBeenNthCalledWith(2, null, true);
  });

  it('rejects origins that are not allowlisted', () => {
    const options = createCorsOptions(createConfig({ CORS_ORIGINS: 'https://app.example.com' }));
    const callback = jest.fn();

    options.origin('https://evil.example.com', callback);

    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(callback.mock.calls[0][1]).toBe(false);
  });

  it('allows standard API methods, JWT authorization and Sentry tracing headers', () => {
    const options = createCorsOptions(createConfig());

    expect(options.methods).toEqual(['GET', 'POST', 'PATCH', 'DELETE']);
    expect(options.allowedHeaders).toEqual([
      'Content-Type',
      'Authorization',
      'sentry-trace',
      'baggage',
    ]);
  });
});
