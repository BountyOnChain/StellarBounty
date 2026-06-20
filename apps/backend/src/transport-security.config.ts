import { ConfigService } from '@nestjs/config';

export function isProduction(config: ConfigService): boolean {
  return config.get<string>('NODE_ENV') === 'production';
}

export function shouldTrustProxy(config: ConfigService): boolean {
  return config.get<boolean>('TRUST_PROXY', false) === true;
}

export function createHstsConfig(config: ConfigService) {
  if (!isProduction(config)) {
    return false;
  }

  return {
    maxAge: 31_536_000,
    includeSubDomains: true,
  };
}
