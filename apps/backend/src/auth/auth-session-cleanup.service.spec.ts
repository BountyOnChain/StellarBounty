import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuthSessionCleanupService } from './auth-session-cleanup.service';
import { RefreshToken } from '../entities/refresh-token.entity';

type MockRepository<T extends object = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('AuthSessionCleanupService', () => {
  let repository: MockRepository<RefreshToken>;
  let builder: {
    delete: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    orWhere: jest.Mock;
    execute: jest.Mock;
  };
  let service: AuthSessionCleanupService;

  beforeEach(() => {
    builder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 4 }),
    };
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    service = new AuthSessionCleanupService(
      repository as unknown as Repository<RefreshToken>,
      new ConfigService({
        AUTH_SESSION_CLEANUP_ENABLED: false,
        AUTH_SESSION_CLEANUP_INTERVAL_MS: 60000,
      }),
    );
  });

  it('deletes expired or revoked refresh tokens', async () => {
    const now = new Date('2026-06-17T00:00:00.000Z');

    await expect(service.runCleanup(now)).resolves.toBe(4);

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.from).toHaveBeenCalledWith(RefreshToken);
    expect(builder.where).toHaveBeenCalledWith('"expiresAt" < :now', { now });
    expect(builder.orWhere).toHaveBeenCalledWith('"revokedAt" IS NOT NULL');
  });

  it('starts and clears a background cleanup interval when enabled', () => {
    jest.useFakeTimers();
    const enabledService = new AuthSessionCleanupService(
      repository as unknown as Repository<RefreshToken>,
      new ConfigService({
        AUTH_SESSION_CLEANUP_ENABLED: true,
        AUTH_SESSION_CLEANUP_INTERVAL_MS: 60000,
      }),
    );
    const runSpy = jest.spyOn(enabledService, 'runCleanup').mockResolvedValue(0);

    enabledService.onModuleInit();
    jest.advanceTimersByTime(60000);
    enabledService.onModuleDestroy();

    expect(runSpy).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
