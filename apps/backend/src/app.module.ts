import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { WebhookModule } from './webhooks/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        STELLAR_NETWORK: Joi.string().valid('testnet', 'mainnet').required(),
        CORS_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
        CORS_ORIGINS: Joi.string().optional(),
        AUTH_RATE_LIMIT_TTL_MS: Joi.number().integer().positive().default(60000),
        AUTH_CHALLENGE_RATE_LIMIT: Joi.number().integer().positive().default(5),
        AUTH_VERIFY_RATE_LIMIT: Joi.number().integer().positive().default(10),
        BOUNTY_DEADLINE_AUTOMATION_ENABLED: Joi.boolean().default(true),
        BOUNTY_DEADLINE_AUTOMATION_INTERVAL_MS: Joi.number().integer().positive().default(900000),
        BOUNTY_DEADLINE_GRACE_PERIOD_MS: Joi.number().integer().min(0).default(86400000),
        BOUNTY_DEADLINE_REMINDER_WINDOW_MS: Joi.number().integer().min(0).default(172800000),
        WEBHOOK_SUBSCRIPTIONS_JSON: Joi.string().default('[]'),
        WEBHOOK_DELIVERY_MAX_ATTEMPTS: Joi.number().integer().positive().default(3),
        WEBHOOK_DELIVERY_BASE_DELAY_MS: Joi.number().integer().min(0).default(250),
        WEBHOOK_DELIVERY_TIMEOUT_MS: Joi.number().integer().positive().default(5000),
        WEBHOOK_ENDPOINT_MIN_INTERVAL_MS: Joi.number().integer().min(0).default(0),
        PORT: Joi.number().default(4000),
      }),
    }),
    AuthModule,
    WebhookModule,
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
      }),
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
