import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { BOUNTY_AUTOMATION_LOCK_ID } from './bounty-automation-lock.constants';
import { Bounty, BountyStatus } from '../entities/bounty.entity';

type DeadlineAutomationResult = {
  checkedAt: Date;
  autoClosed: number;
  remindersQueued: number;
  escrowExpiriesFlagged: number;
};

@Injectable()
export class DeadlineAutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeadlineAutomationService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('BOUNTY_DEADLINE_AUTOMATION_ENABLED', true)) {
      return;
    }

    const intervalMs = this.config.get<number>('BOUNTY_DEADLINE_AUTOMATION_INTERVAL_MS', 15 * 60 * 1000);
    this.interval = setInterval(() => {
      void this.runDeadlineAutomation().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Deadline automation failed: ${message}`);
      });
    }, intervalMs);
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async runDeadlineAutomation(now = new Date()): Promise<DeadlineAutomationResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let lockAcquired = false;

    try {
      const lockRows: { acquired: boolean }[] = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [BOUNTY_AUTOMATION_LOCK_ID],
      );
      lockAcquired = lockRows[0]?.acquired === true;
      if (!lockAcquired) {
        this.logger.debug('Deadline automation skipped; another replica holds the lock.');
        return {
          checkedAt: now,
          autoClosed: 0,
          remindersQueued: 0,
          escrowExpiriesFlagged: 0,
        };
      }

      const gracePeriodMs = this.config.get<number>('BOUNTY_DEADLINE_GRACE_PERIOD_MS', 24 * 60 * 60 * 1000);
      const reminderWindowMs = this.config.get<number>('BOUNTY_DEADLINE_REMINDER_WINDOW_MS', 48 * 60 * 60 * 1000);
      const closeBefore = new Date(now.getTime() - gracePeriodMs);
      const remindBefore = new Date(now.getTime() + reminderWindowMs);

      const autoClosed = await this.autoCloseExpiredBounties(closeBefore);
      const remindersQueued = await this.queueDeadlineReminders(now, remindBefore);
      const escrowExpiriesFlagged = await this.flagEscrowExpiries(closeBefore);

      return {
        checkedAt: now,
        autoClosed,
        remindersQueued,
        escrowExpiriesFlagged,
      };
    } finally {
      if (lockAcquired) {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [BOUNTY_AUTOMATION_LOCK_ID]);
      }
      await queryRunner.release();
    }
  }

  private async autoCloseExpiredBounties(closeBefore: Date): Promise<number> {
    const expiredBounties = await this.bounties.find({
      where: {
        status: In([BountyStatus.OPEN, BountyStatus.IN_PROGRESS]),
        deadline: LessThanOrEqual(closeBefore),
      },
      relations: { submissions: true },
    });

    const closable = expiredBounties.filter((bounty) => bounty.submissions.length === 0);
    closable.forEach((bounty) => {
      bounty.status = BountyStatus.CANCELLED;
    });

    if (closable.length > 0) {
      await this.bounties.save(closable);
      this.logger.log(`Auto-closed ${closable.length} bounties past deadline with no submissions.`);
    }

    return closable.length;
  }

  private async queueDeadlineReminders(now: Date, remindBefore: Date): Promise<number> {
    const bounties = await this.bounties.find({
      where: {
        status: In([BountyStatus.OPEN, BountyStatus.IN_PROGRESS]),
        deadline: MoreThan(now),
      },
    });
    const reminders = bounties.filter((bounty) => bounty.deadline !== null && bounty.deadline <= remindBefore);

    reminders.forEach((bounty) => {
      this.logger.log(`Deadline reminder queued for bounty ${bounty.id} owner ${bounty.ownerAddress}.`);
    });

    return reminders.length;
  }

  private async flagEscrowExpiries(closeBefore: Date): Promise<number> {
    const expiredFundedBounties = await this.bounties.find({
      where: {
        status: BountyStatus.COMPLETED,
        deadline: LessThanOrEqual(closeBefore),
      },
    });

    expiredFundedBounties.forEach((bounty) => {
      this.logger.log(`Escrow expiry review queued for completed bounty ${bounty.id}.`);
    });

    return expiredFundedBounties.length;
  }
}
