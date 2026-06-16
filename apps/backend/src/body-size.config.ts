import { ConfigService } from '@nestjs/config';

export const DEFAULT_MAX_BODY_SIZE = '1mb';

export function getMaxBodySize(config: ConfigService): string {
  return config.get<string>('MAX_BODY_SIZE') ?? DEFAULT_MAX_BODY_SIZE;
}
