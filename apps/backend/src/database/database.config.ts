import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Bounty } from './entities/bounty.entity';
import { Submission } from './entities/submission.entity';

/**
 * TypeORM configuration factory.
 * Reads DATABASE_URL from environment and configures the connection.
 *
 * Usage — add to AppModule imports:
 *   TypeOrmModule.forRootAsync({
 *     imports: [ConfigModule],
 *     useClass: DatabaseConfig,
 *   })
 */
@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  private readonly logger = new Logger(DatabaseConfig.name);

  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      this.logger.warn(
        'DATABASE_URL not set — TypeORM will not connect. ' +
        'Set DATABASE_URL in .env or run docker-compose up -d for local Postgres.',
      );
    }

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    return {
      type: 'postgres',
      url: databaseUrl || 'postgres://postgres:postgres@localhost:5432/stellar_bounty',
      entities: [Bounty, Submission],
      synchronize: !isProduction, // auto-sync in dev; use migrations in prod
      migrationsRun: isProduction,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      logging: !isProduction ? ['error', 'warn'] : ['error'],
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    };
  }
}
