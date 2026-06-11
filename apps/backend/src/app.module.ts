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
import { InitSchema1747657200000 } from './migrations/1747657200000-InitSchema';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { SubmissionsModule } from './submissions/submissions.module';

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
        PORT: Joi.number().default(4000),
      }),
    }),
    AuthModule,
    SubmissionsModule,
    HealthModule,
    TypeOrmModule.forFeature([Bounty]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Bounty, Submission],
        migrations: [InitSchema1747657200000],
        synchronize: false,
      }),
    }),
  ],
  controllers: [AppController, BountiesController],
  providers: [AppService, BountiesService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
