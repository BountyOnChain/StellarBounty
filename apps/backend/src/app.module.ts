import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { BountiesController } from './bounties.controller';
import { BountiesService } from './bounties.service';
import { Bounty } from './entities/bounty.entity';
import { Submission } from './entities/submission.entity';
import { Nonce } from './entities/nonce.entity';
import { InitSchema1747657200000 } from './migrations/1747657200000-InitSchema';
import { AddNoncesTable1747657300000 } from './migrations/1747657300000-AddNoncesTable';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { MetricsMiddleware } from './metrics/metrics.middleware';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsService } from './metrics/metrics.service';
import { TypeOrmMetricsLogger } from './metrics/typeorm-metrics.logger';
import { SubmissionsModule } from './submissions/submissions.module';
import { DeadlineAutomationService } from './bounties/deadline-automation.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        STELLAR_NETWORK: Joi.string().valid('testnet', 'mainnet').required(),
        STELLAR_RPC_URL: Joi.string().uri().optional(),
        STELLAR_RPC_URL_BACKUP: Joi.string().uri().optional(),
        STELLAR_SIGNING_SECRET: Joi.string().optional(),
        CORS_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
        CORS_ORIGINS: Joi.string().optional(),
        AUTH_RATE_LIMIT_TTL_MS: Joi.number().integer().positive().default(60000),
        AUTH_NONCE_TTL_MS: Joi.number().integer().positive().default(300000),
        AUTH_CHALLENGE_RATE_LIMIT: Joi.number().integer().positive().default(5),
        AUTH_VERIFY_RATE_LIMIT: Joi.number().integer().positive().default(10),
        RATE_LIMIT_TTL_MS: Joi.number().integer().positive().default(60000),
        RATE_LIMIT_MAX: Joi.number().integer().positive().default(30),
        BOUNTY_DEADLINE_AUTOMATION_ENABLED: Joi.boolean().default(true),
        BOUNTY_DEADLINE_AUTOMATION_INTERVAL_MS: Joi.number().integer().positive().default(900000),
        BOUNTY_DEADLINE_GRACE_PERIOD_MS: Joi.number().integer().min(0).default(86400000),
        BOUNTY_DEADLINE_REMINDER_WINDOW_MS: Joi.number().integer().min(0).default(172800000),
        PORT: Joi.number().default(4000),
        LOG_LEVEL: Joi.string()
          .valid('debug', 'verbose', 'log', 'info', 'warn', 'warning', 'error')
          .default('log'),
        SERVICE_NAME: Joi.string().default('stellar-bounty-backend'),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get<number>('RATE_LIMIT_TTL_MS', 60000),
        limit: config.get<number>('RATE_LIMIT_MAX', 30),
      }]),
    }),
    AuthModule,
    SubmissionsModule,
    HealthModule,
    MetricsModule,
    TypeOrmModule.forFeature([Bounty, Nonce]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, MetricsModule],
      inject: [ConfigService, MetricsService],
      useFactory: (config: ConfigService, metrics: MetricsService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Bounty, Submission, Nonce],
        migrations: [InitSchema1747657200000, AddNoncesTable1747657300000],
        logger: new TypeOrmMetricsLogger(metrics),
        maxQueryExecutionTime: 250,
        synchronize: false,
        retryAttempts: config.get<number>('DB_RETRY_ATTEMPTS', 5),
        retryDelay: config.get<number>('DB_RETRY_DELAY_MS', 3000),
        extra: {
          max: config.get<number>('DB_POOL_MAX', 10),
          connectionTimeoutMillis: config.get<number>('DB_CONNECTION_TIMEOUT_MS', 30000),
        },
      } as import('typeorm').DataSourceOptions),
    }),
  ],
  controllers: [AppController, BountiesController],
  providers: [AppService, BountiesService, DeadlineAutomationService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware, LoggerMiddleware).forRoutes('*');
  }
}
