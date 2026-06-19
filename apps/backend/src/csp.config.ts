import { ConfigService } from '@nestjs/config';

const STELLAR_RPC_FALLBACKS = [
  'https://soroban-testnet.stellar.org',
  'https://mainnet.stellar.validationcloud.io',
];

export function createContentSecurityPolicy(config: ConfigService) {
  const stellarRpcUrl = config.get<string>('STELLAR_RPC_URL');
  const connectSrc = ["'self'", ...STELLAR_RPC_FALLBACKS];

  if (stellarRpcUrl && !connectSrc.includes(stellarRpcUrl)) {
    connectSrc.push(stellarRpcUrl);
  }

  return {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc,
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      reportUri: ['/csp-report'],
    },
  };
}
