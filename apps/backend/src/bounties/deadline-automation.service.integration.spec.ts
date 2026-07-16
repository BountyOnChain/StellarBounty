import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import { DeadlineAutomationService } from './deadline-automation.service';

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration('DeadlineAutomationService multi-replica lock', () => {
  let dataSource: DataSource;
  let bounties: Repository<Bounty>;
  const now = new Date('2026-06-13T00:00:00.000Z');

  function createService(): DeadlineAutomationService {
    return new DeadlineAutomationService(
      bounties,
      dataSource,
      new ConfigService({
        BOUNTY_DEADLINE_GRACE_PERIOD_MS: 24 * 60 * 60 * 1000,
        BOUNTY_DEADLINE_REMINDER_WINDOW_MS: 48 * 60 * 60 * 1000,
      }),
    );
  }

  beforeAll(async () => {
    dataSource = AppDataSource;
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query(`
      ALTER TABLE bounties
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ NULL
    `);
    bounties = dataSource.getRepository(Bounty);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM submissions');
    await dataSource.query('DELETE FROM bounties');
  });

  it('runs deadline automation on only one replica when multiple pods start concurrently', async () => {
    await bounties.save({
      title: 'Expired bounty',
      description: 'Should auto-close once.',
      rewardAmount: 10000000n,
      deadline: new Date('2026-06-10T00:00:00.000Z'),
      status: BountyStatus.OPEN,
      ownerAddress: 'GOWNER',
    });

    const replicaCount = 5;
    const results = await Promise.all(
      Array.from({ length: replicaCount }, () => createService().runDeadlineAutomation(now)),
    );

    const winners = results.filter((result) => result.autoClosed > 0);
    expect(winners).toHaveLength(1);
    expect(results.reduce((total, result) => total + result.autoClosed, 0)).toBe(1);

    const stored = await bounties.find();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.status).toBe(BountyStatus.CANCELLED);
  });
});
