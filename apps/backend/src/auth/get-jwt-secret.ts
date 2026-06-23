import { ConfigService } from '@nestjs/config';

let configService: ConfigService | undefined;

export function setConfigService(cs?: ConfigService): void {
  configService = cs;
}

export function getJwtSecret(config?: ConfigService): string {
  const source = config ?? configService;
  if (source) {
    const secret = source.get<string>('JWT_SECRET');
    if (secret) return secret;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  return secret;
}
