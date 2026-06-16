import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';

@Injectable()
export class AuthSessionCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthSessionCleanupService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('AUTH_SESSION_CLEANUP_ENABLED', true)) {
      return;
    }

    const intervalMs = this.config.get<number>('AUTH_SESSION_CLEANUP_INTERVAL_MS', 60 * 60 * 1000);
    this.interval = setInterval(() => {
      void this.runCleanup().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Refresh-token cleanup failed: ${message}`);
      });
    }, intervalMs);
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async runCleanup(now = new Date()): Promise<number> {
    const result = await this.refreshTokens
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('"expiresAt" < :now', { now })
      .orWhere('"revokedAt" IS NOT NULL')
      .execute();

    return result.affected ?? 0;
  }
}
