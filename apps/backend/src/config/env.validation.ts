import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(4000),

  // Database
  DATABASE_URL: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': 'DATABASE_URL must be a valid URI (e.g., postgresql://user:pass@localhost:5432/db)',
      'any.required': 'DATABASE_URL is required. Set it in your .env file.',
    }),

  // JWT
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({
      'string.min': 'JWT_SECRET must be at least 32 characters long',
      'any.required': 'JWT_SECRET is required. Generate one with: openssl rand -base64 32',
    }),

  // Stellar
  STELLAR_NETWORK: Joi.string()
    .valid('public', 'testnet', 'futurenet')
    .default('testnet')
    .messages({
      'any.only': 'STELLAR_NETWORK must be one of: public, testnet, futurenet',
    }),

  STELLAR_HORIZON_URL: Joi.string()
    .uri()
    .optional()
    .default('https://horizon-testnet.stellar.org'),

  SOROBAN_RPC_URL: Joi.string()
    .uri()
    .optional()
    .default('https://rpc-futurenet.stellar.org'),

  // Contract
  BOUNTY_CONTRACT_ID: Joi.string()
    .optional()
    .allow('')
    .pattern(/^C[A-Z2-7]{55}$/)
    .messages({
      'string.pattern.base': 'BOUNTY_CONTRACT_ID must be a valid Stellar contract ID (starts with C, 56 chars)',
    }),

  // Frontend URL (for CORS)
  FRONTEND_URL: Joi.string()
    .uri()
    .optional()
    .default('http://localhost:3000'),
});
