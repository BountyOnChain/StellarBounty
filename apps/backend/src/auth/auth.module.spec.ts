import { ConfigService } from '@nestjs/config';
import { createJwtModuleOptions } from './auth.module';

describe('createJwtModuleOptions', () => {
  it('reads the access-token expiry from config', () => {
    const config = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          JWT_ACCESS_EXPIRES_IN: '60s',
        };
        return values[key] ?? defaultValue;
      }),
    };

    expect(createJwtModuleOptions(config as unknown as ConfigService)).toEqual({
      secret: 'test-secret',
      signOptions: { expiresIn: '60s' },
    });
  });

  it('defaults access-token expiry to the previous 24 hour behavior', () => {
    const config = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string> = {
          JWT_SECRET: 'test-secret',
        };
        return values[key] ?? defaultValue;
      }),
    };

    expect(createJwtModuleOptions(config as unknown as ConfigService)).toEqual({
      secret: 'test-secret',
      signOptions: { expiresIn: '24h' },
    });
  });
});
