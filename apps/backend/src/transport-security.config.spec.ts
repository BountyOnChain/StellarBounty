import { ConfigService } from '@nestjs/config';
import { createHstsConfig, shouldTrustProxy } from './transport-security.config';

function createConfig(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  } as unknown as ConfigService;
}

describe('transport security configuration', () => {
  it('disables HSTS outside production for local HTTP development', () => {
    expect(createHstsConfig(createConfig({ NODE_ENV: 'development' }))).toBe(false);
  });

  it('enables one-year HSTS with subdomains in production', () => {
    expect(createHstsConfig(createConfig({ NODE_ENV: 'production' }))).toEqual({
      maxAge: 31_536_000,
      includeSubDomains: true,
    });
  });

  it('only trusts reverse proxy headers when TRUST_PROXY is true', () => {
    expect(shouldTrustProxy(createConfig({ TRUST_PROXY: true }))).toBe(true);
    expect(shouldTrustProxy(createConfig({ TRUST_PROXY: false }))).toBe(false);
  });
});
