import { ConfigService } from '@nestjs/config';
import { getJwtSecret, setConfigService } from './get-jwt-secret';

describe('getJwtSecret', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    setConfigService(undefined);
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('prefers an explicit config service over the global config service', () => {
    setConfigService({
      get: jest.fn(() => 'global-secret'),
    } as unknown as ConfigService);

    const explicitConfig = {
      get: jest.fn(() => 'explicit-secret'),
    } as unknown as ConfigService;

    expect(getJwtSecret(explicitConfig)).toBe('explicit-secret');
  });

  it('throws when neither config nor process env provides a secret', () => {
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is required but not set');
  });
});
