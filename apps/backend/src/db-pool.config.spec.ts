import { ConfigService } from '@nestjs/config';
import {
  createDbPoolExtra,
  createDbPoolExtraFromEnv,
  DEFAULT_DB_POOL_CONNECT_TIMEOUT_MS,
  DEFAULT_DB_POOL_IDLE_TIMEOUT_MS,
  DEFAULT_DB_POOL_MAX,
} from './db-pool.config';

function createConfig(values: Record<string, number | undefined> = {}): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('database pool configuration', () => {
  it('uses production-safe defaults', () => {
    expect(createDbPoolExtra(createConfig())).toEqual({
      max: DEFAULT_DB_POOL_MAX,
      idleTimeoutMillis: DEFAULT_DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: DEFAULT_DB_POOL_CONNECT_TIMEOUT_MS,
    });
  });

  it('uses configured Nest values', () => {
    expect(
      createDbPoolExtra(
        createConfig({
          DB_POOL_MAX: 12,
          DB_POOL_IDLE_TIMEOUT_MS: 10_000,
          DB_POOL_CONNECT_TIMEOUT_MS: 2_000,
        }),
      ),
    ).toEqual({
      max: 12,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
    });
  });

  it('parses CLI data-source values from environment variables', () => {
    expect(
      createDbPoolExtraFromEnv({
        DB_POOL_MAX: '8',
        DB_POOL_IDLE_TIMEOUT_MS: '9000',
        DB_POOL_CONNECT_TIMEOUT_MS: '1500',
      }),
    ).toEqual({
      max: 8,
      idleTimeoutMillis: 9000,
      connectionTimeoutMillis: 1500,
    });
  });
});
