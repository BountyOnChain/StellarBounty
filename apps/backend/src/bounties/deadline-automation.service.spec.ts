import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { DeadlineAutomationService } from './deadline-automation.service';
import { Bounty, BountyStatus } from '../entities/bounty.entity';

type MockRepository<T extends object = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('DeadlineAutomationService', () => {
  let repository: MockRepository<Bounty>;
  let service: DeadlineAutomationService;
  const now = new Date('2026-06-13T00:00:00.000Z');

  function createBounty(overrides: Partial<Bounty> = {}): Bounty {
    return {
      id: 'bounty-1',
      title: 'Build automation',
      description: 'Automate bounty deadlines.',
      rewardAmount: '10000000',
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
    service = new DeadlineAutomationService(
      repository as unknown as Repository<Bounty>,
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

  it('starts and clears a background interval when enabled', () => {
    jest.useFakeTimers();
    const enabledService = new DeadlineAutomationService(
      repository as unknown as Repository<Bounty>,
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
