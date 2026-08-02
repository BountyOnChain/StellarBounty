import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { DeadlineAutomationService } from './deadline-automation.service';
import { Bounty, BountyStatus } from '../entities/bounty.entity';

type MockRepository<T extends object = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockDataSource(acquired = true) {
  const queryRunner = {
    connect: jest.fn(),
    query: jest.fn(async (sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) {
        return [{ acquired }];
      }
      if (sql.includes('pg_advisory_unlock')) {
        return [{ pg_advisory_unlock: true }];
      }
      return [];
    }),
    release: jest.fn(),
  };

  return {
    createQueryRunner: jest.fn(() => queryRunner),
    queryRunner,
  } as unknown as DataSource & { queryRunner: typeof queryRunner };
}

describe('DeadlineAutomationService', () => {
  let repository: MockRepository<Bounty>;
  let dataSource: DataSource;
  let service: DeadlineAutomationService;
  const now = new Date('2026-06-13T00:00:00.000Z');

  function createBounty(overrides: Partial<Bounty> = {}): Bounty {
    return {
      id: 'bounty-1',
      slug: null,
      title: 'Build automation',
      description: 'Automate bounty deadlines.',
      rewardAmount: 10000000n,
      deadline: new Date('2026-06-10T00:00:00.000Z'),
      status: BountyStatus.OPEN,
      ownerAddress: 'GOWNER',
      submissions: [],
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      save: jest.fn(async (input) => input),
    };
    dataSource = createMockDataSource(true);
    service = new DeadlineAutomationService(
      repository as unknown as Repository<Bounty>,
      dataSource,
      new ConfigService({
        BOUNTY_DEADLINE_AUTOMATION_ENABLED: false,
        BOUNTY_DEADLINE_GRACE_PERIOD_MS: 24 * 60 * 60 * 1000,
        BOUNTY_DEADLINE_REMINDER_WINDOW_MS: 48 * 60 * 60 * 1000,
      }),
    );
  });

  it('auto-closes expired bounties with no submissions after the grace period', async () => {
    const expiredWithoutSubmission = createBounty({ id: 'expired-empty' });
    const expiredWithSubmission = createBounty({
      id: 'expired-submitted',
      submissions: [{} as Bounty['submissions'][number]],
    });
    repository.find!
      .mockResolvedValueOnce([expiredWithoutSubmission, expiredWithSubmission])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.runDeadlineAutomation(now);

    expect(expiredWithoutSubmission.status).toBe(BountyStatus.CANCELLED);
    expect(expiredWithSubmission.status).toBe(BountyStatus.OPEN);
    expect(repository.save).toHaveBeenCalledWith([expiredWithoutSubmission]);
    expect(result.autoClosed).toBe(1);
  });

  it('counts upcoming deadline reminders and completed escrow expiry reviews', async () => {
    repository.find!
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createBounty({ id: 'soon', deadline: new Date('2026-06-14T00:00:00.000Z') }),
        createBounty({ id: 'later', deadline: new Date('2026-06-20T00:00:00.000Z') }),
      ])
      .mockResolvedValueOnce([
        createBounty({
          id: 'completed-expired',
          status: BountyStatus.COMPLETED,
          deadline: new Date('2026-06-10T00:00:00.000Z'),
        }),
      ]);

    const result = await service.runDeadlineAutomation(now);

    expect(result).toMatchObject({
      autoClosed: 0,
      remindersQueued: 1,
      escrowExpiriesFlagged: 1,
      checkedAt: now,
    });
  });

  it('skips work when the advisory lock is held by another replica', async () => {
    const lockedDataSource = createMockDataSource(false);
    service = new DeadlineAutomationService(
      repository as unknown as Repository<Bounty>,
      lockedDataSource,
      new ConfigService({
        BOUNTY_DEADLINE_GRACE_PERIOD_MS: 24 * 60 * 60 * 1000,
        BOUNTY_DEADLINE_REMINDER_WINDOW_MS: 48 * 60 * 60 * 1000,
      }),
    );

    const result = await service.runDeadlineAutomation(now);

    expect(repository.find).not.toHaveBeenCalled();
    expect(lockedDataSource.queryRunner.query).not.toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_unlock'),
      expect.anything(),
    );
    expect(result).toEqual({
      checkedAt: now,
      autoClosed: 0,
      remindersQueued: 0,
      escrowExpiriesFlagged: 0,
    });
  });

  it('starts and clears a background interval when enabled', () => {
    jest.useFakeTimers();
    const enabledService = new DeadlineAutomationService(
      repository as unknown as Repository<Bounty>,
      dataSource,
      new ConfigService({
        BOUNTY_DEADLINE_AUTOMATION_ENABLED: true,
        BOUNTY_DEADLINE_AUTOMATION_INTERVAL_MS: 60000,
      }),
    );
    const runSpy = jest.spyOn(enabledService, 'runDeadlineAutomation').mockResolvedValue({
      checkedAt: now,
      autoClosed: 0,
      remindersQueued: 0,
      escrowExpiriesFlagged: 0,
    });

    enabledService.onModuleInit();
    jest.advanceTimersByTime(60000);
    enabledService.onModuleDestroy();

    expect(runSpy).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
