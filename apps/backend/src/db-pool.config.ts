import { ConfigService } from '@nestjs/config';

export const DEFAULT_DB_POOL_MAX = 20;
export const DEFAULT_DB_POOL_IDLE_TIMEOUT_MS = 30_000;
export const DEFAULT_DB_POOL_CONNECT_TIMEOUT_MS = 5_000;
export const DEFAULT_DB_RETRY_ATTEMPTS = 3;
export const DEFAULT_DB_RETRY_DELAY_MS = 3_000;

export function createDbPoolExtraFromValues(values: {
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}) {
  return {
    max: values.max ?? DEFAULT_DB_POOL_MAX,
    idleTimeoutMillis: values.idleTimeoutMillis ?? DEFAULT_DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: values.connectionTimeoutMillis ?? DEFAULT_DB_POOL_CONNECT_TIMEOUT_MS,
  };
}

export function createDbPoolExtra(config: ConfigService) {
  return createDbPoolExtraFromValues({
    max: config.get<number>('DB_POOL_MAX'),
    idleTimeoutMillis: config.get<number>('DB_POOL_IDLE_TIMEOUT_MS'),
    connectionTimeoutMillis: config.get<number>('DB_POOL_CONNECT_TIMEOUT_MS'),
  });
}

export function createDbPoolExtraFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return createDbPoolExtraFromValues({
    max: env.DB_POOL_MAX ? Number(env.DB_POOL_MAX) : undefined,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS ? Number(env.DB_POOL_IDLE_TIMEOUT_MS) : undefined,
    connectionTimeoutMillis: env.DB_POOL_CONNECT_TIMEOUT_MS ? Number(env.DB_POOL_CONNECT_TIMEOUT_MS) : undefined,
  });
}
