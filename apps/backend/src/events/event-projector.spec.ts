import { EventProjector } from './event-projector';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { DeadLetterEvent } from '../entities/dead-letter-event.entity';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import { BountyContract } from '../entities/bounty-contract.entity';
import { MetricsService } from '../metrics/metrics.service';

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e: unknown) => e),
    ...overrides,
  } as unknown as import('typeorm').Repository<OutboxEvent | DeadLetterEvent | Bounty | BountyContract>;
}

function makeMetrics() {
  return {
    recordContractEventProcessed: jest.fn(),
    recordContractEventDeadLettered: jest.fn(),
  } as unknown as MetricsService;
}

function createOutboxEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    eventId: 'evt-1',
    contractId: 'CA contract',
    network: 'testnet',
    eventType: 'queueop',
    ledger: 100,
    payload: { txHash: 'tx1', address: 'GADDR', unlockAt: 12345 },
    receivedAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

describe('EventProjector', () => {
  let projector: EventProjector;
  let outbox: ReturnType<typeof makeRepo>;
  let deadLetter: ReturnType<typeof makeRepo>;
  let bounties: ReturnType<typeof makeRepo>;
  let contracts: ReturnType<typeof makeRepo>;
  let metrics: MetricsService;

  beforeEach(() => {
    outbox = makeRepo();
    deadLetter = makeRepo();
    bounties = makeRepo();
    contracts = makeRepo();
    metrics = makeMetrics();
    projector = new EventProjector(outbox as never, deadLetter as never, bounties as never, contracts as never, metrics);
  });

  it('returns 0 when there are no pending events', async () => {
    const count = await projector.projectPendingEvents();
    expect(count).toBe(0);
    expect(outbox.find).toHaveBeenCalled();
  });

  it('projects queueop event to APPROVAL_QUEUED', async () => {
    const bounty = { id: 'bounty-1', status: BountyStatus.OPEN } as Bounty;
    const contract = { bountyId: 'bounty-1', contractId: 'CA', network: 'testnet' } as BountyContract;
    const event = createOutboxEvent({ eventType: 'queueop', payload: { txHash: 'tx1', unlockAt: 99999 } });

    outbox.find = jest.fn().mockResolvedValue([event]);
    contracts.findOne = jest.fn().mockResolvedValue(contract);
    bounties.findOneBy = jest.fn().mockResolvedValue(bounty);

    const count = await projector.projectPendingEvents();

    expect(count).toBe(1);
    expect(bounty.status).toBe(BountyStatus.APPROVAL_QUEUED);
    expect(bounties.save).toHaveBeenCalledWith(bounty);
    expect(event.processedAt).toBeInstanceOf(Date);
    expect(outbox.save).toHaveBeenCalled();
    expect(metrics.recordContractEventProcessed).toHaveBeenCalledWith('queueop');
  });

  it('projects execop/approve to COMPLETED', async () => {
    const bounty = { id: 'bounty-2', status: BountyStatus.APPROVAL_QUEUED } as Bounty;
    const contract = { bountyId: 'bounty-2', contractId: 'CA', network: 'testnet' } as BountyContract;
    const event = createOutboxEvent({
      eventType: 'execop',
      payload: { txHash: 'tx2', operation: 'approve', address: 'GOWNER' },
    });

    outbox.find = jest.fn().mockResolvedValue([event]);
    contracts.findOne = jest.fn().mockResolvedValue(contract);
    bounties.findOneBy = jest.fn().mockResolvedValue(bounty);

    const count = await projector.projectPendingEvents();

    expect(count).toBe(1);
    expect(bounty.status).toBe(BountyStatus.COMPLETED);
  });

  it('projects execop/cancel to CANCELLED', async () => {
    const bounty = { id: 'bounty-3', status: BountyStatus.OPEN } as Bounty;
    const contract = { bountyId: 'bounty-3', contractId: 'CA', network: 'testnet' } as BountyContract;
    const event = createOutboxEvent({
      eventType: 'execop',
      payload: { txHash: 'tx3', operation: 'cancel', address: 'GOWNER' },
    });

    outbox.find = jest.fn().mockResolvedValue([event]);
    contracts.findOne = jest.fn().mockResolvedValue(contract);
    bounties.findOneBy = jest.fn().mockResolvedValue(bounty);

    const count = await projector.projectPendingEvents();

    expect(count).toBe(1);
    expect(bounty.status).toBe(BountyStatus.CANCELLED);
  });

  it('skips projection when bounty contract is not found', async () => {
    const event = createOutboxEvent();

    outbox.find = jest.fn().mockResolvedValue([event]);
    contracts.findOne = jest.fn().mockResolvedValue(null);

    const count = await projector.projectPendingEvents();

    expect(count).toBe(1);
    expect(bounties.findOneBy).not.toHaveBeenCalled();
    expect(bounties.save).not.toHaveBeenCalled();
  });

  it('moves failed events to dead-letter table after projection error', async () => {
    const event = createOutboxEvent({ eventType: 'queueop', payload: { txHash: 'tx' } });

    outbox.find = jest.fn().mockResolvedValue([event]);
    contracts.findOne = jest.fn().mockRejectedValue(new Error('DB connection lost'));

    const count = await projector.projectPendingEvents();

    expect(count).toBe(0);
    expect(deadLetter.save).toHaveBeenCalled();
    expect(metrics.recordContractEventDeadLettered).not.toHaveBeenCalled();
  });

  it('increments attempts for already dead-lettered events', async () => {
    const event = createOutboxEvent({ eventType: 'queueop', payload: { txHash: 'tx' } });
    const existingDead = { eventId: 'evt-1', attempts: 3, lastError: null, failedAt: null } as DeadLetterEvent;

    outbox.find = jest.fn().mockResolvedValue([event]);
    contracts.findOne = jest.fn().mockRejectedValue(new Error('DB error'));
    deadLetter.findOneBy = jest.fn().mockResolvedValue(existingDead);
    deadLetter.save = jest.fn().mockImplementation((e: unknown) => Promise.resolve(e));

    await projector.projectPendingEvents();

    expect(existingDead.attempts).toBe(4);
    expect(existingDead.lastError).toBe('DB error');
    expect(existingDead.failedAt).toBeInstanceOf(Date);
  });

  it('dead-letters and alerts when max attempts exceeded', async () => {
    const event = createOutboxEvent({ eventType: 'queueop', payload: { txHash: 'tx' } });
    const existingDead = { eventId: 'evt-1', attempts: 4, lastError: null, failedAt: null } as DeadLetterEvent;

    outbox.find = jest.fn().mockResolvedValue([event]);
    contracts.findOne = jest.fn().mockRejectedValue(new Error('timeout'));
    deadLetter.findOneBy = jest.fn().mockResolvedValue(existingDead);
    deadLetter.save = jest.fn().mockImplementation((e: unknown) => Promise.resolve(e));

    await projector.projectPendingEvents();

    expect(existingDead.attempts).toBe(5);
    expect(metrics.recordContractEventDeadLettered).toHaveBeenCalledWith('queueop');
  });

  it('dispute events are logged but do not change bounty status', async () => {
    const bounty = { id: 'bounty-4', status: BountyStatus.OPEN } as Bounty;
    const contract = { bountyId: 'bounty-4', contractId: 'CA', network: 'testnet' } as BountyContract;
    const event = createOutboxEvent({
      eventType: 'dispute',
      payload: { txHash: 'tx4', address: 'GDISPUTER' },
    });

    outbox.find = jest.fn().mockResolvedValue([event]);
    contracts.findOne = jest.fn().mockResolvedValue(contract);
    bounties.findOneBy = jest.fn().mockResolvedValue(bounty);

    const count = await projector.projectPendingEvents();

    expect(count).toBe(1);
    expect(bounty.status).toBe(BountyStatus.OPEN);
    expect(bounties.save).not.toHaveBeenCalled();
  });

  it('projects multiple events in sequence', async () => {
    const bounty1 = { id: 'b1', status: BountyStatus.OPEN } as Bounty;
    const bounty2 = { id: 'b2', status: BountyStatus.APPROVAL_QUEUED } as Bounty;
    const contract1 = { bountyId: 'b1', contractId: 'C1', network: 'testnet' } as BountyContract;
    const contract2 = { bountyId: 'b2', contractId: 'C2', network: 'testnet' } as BountyContract;

    const events = [
      createOutboxEvent({ eventId: 'e1', eventType: 'queueop', contractId: 'C1', payload: { txHash: 'tx1', unlockAt: 100 } }),
      createOutboxEvent({ eventId: 'e2', eventType: 'execop', contractId: 'C2', payload: { txHash: 'tx2', operation: 'approve' } }),
    ];

    outbox.find = jest.fn().mockResolvedValue(events);
    contracts.findOne = jest.fn()
      .mockResolvedValueOnce(contract1)
      .mockResolvedValueOnce(contract2);
    bounties.findOneBy = jest.fn()
      .mockResolvedValueOnce(bounty1)
      .mockResolvedValueOnce(bounty2);

    const count = await projector.projectPendingEvents();

    expect(count).toBe(2);
    expect(bounty1.status).toBe(BountyStatus.APPROVAL_QUEUED);
    expect(bounty2.status).toBe(BountyStatus.COMPLETED);
  });
});
