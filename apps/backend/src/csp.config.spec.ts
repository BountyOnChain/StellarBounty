import { ConfigService } from '@nestjs/config';
import { createContentSecurityPolicy } from './csp.config';

function createConfig(values: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('createContentSecurityPolicy', () => {
  it('uses restrictive default directives', () => {
    const policy = createContentSecurityPolicy(createConfig());

    expect(policy.directives.defaultSrc).toEqual(["'self'"]);
    expect(policy.directives.scriptSrc).toEqual(["'self'"]);
    expect(policy.directives.styleSrc).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy.directives.frameAncestors).toEqual(["'none'"]);
    expect(policy.directives.reportUri).toEqual(['/csp-report']);
  });

  it('allows configured Stellar RPC endpoints for connect-src', () => {
    const policy = createContentSecurityPolicy(
      createConfig({ STELLAR_RPC_URL: 'https://stellar-rpc.example.com' }),
    );

    expect(policy.directives.connectSrc).toContain("'self'");
    expect(policy.directives.connectSrc).toContain('https://soroban-testnet.stellar.org');
    expect(policy.directives.connectSrc).toContain('https://stellar-rpc.example.com');
  });
});
