import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SorobanEventsPoller } from './soroban-events.poller';
import { BountyContract } from '../entities/bounty-contract.entity';
import { EventProjector } from './event-projector';
import { StellarRpcClient } from '../common/stellar-rpc-client';
import { MetricsService } from '../metrics/metrics.service';

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e: unknown) => e),
    createQueryBuilder: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    })),
    ...overrides,
  } as unknown;
}

function makeDataSource(queryResults: Record<string, unknown>[] = [{ acquired: true }]) {
  return {
    createQueryRunner: () => ({
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockImplementation((_sql: string, params?: unknown[]) => {
        if (params?.[0] === 553) return queryResults;
        return [{ ledger: 0 }];
      }),
      release: jest.fn().mockResolvedValue(undefined),
    }),
    query: jest.fn().mockResolvedValue([{ ledger: 0 }]),
  } as unknown as DataSource;
}

function makeMetrics() {
  return {
    recordContractEventsReceived: jest.fn(),
    recordContractEventProcessed: jest.fn(),
  } as unknown as MetricsService;
}

function makeRpcClient(initialized = false) {
  return {
    isInitialized: jest.fn().mockReturnValue(initialized),
    initialize: jest.fn(),
    getServer: jest.fn().mockReturnValue({
      getEvents: jest.fn().mockResolvedValue({ events: [], latestLedger: 100, cursor: '' }),
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 200 }),
    }),
  } as unknown as StellarRpcClient;
}

function makeProjector() {
  return {
    projectPendingEvents: jest.fn().mockResolvedValue(0),
  } as unknown as EventProjector;
}

describe('SorobanEventsPoller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 when advisory lock is not acquired', async () => {
    const poller = new SorobanEventsPoller(
      makeRepo() as never,
      makeRepo() as never,
      makeDataSource([{ acquired: false }]),
      new ConfigService({}),
      makeMetrics(),
      makeRpcClient(),
      makeProjector(),
    );

    const result = await poller.poll();
    expect(result).toEqual({ eventsReceived: 0, eventsProjected: 0 });
  });

  it('returns 0 when no contracts exist', async () => {
    const poller = new SorobanEventsPoller(
      makeRepo() as never,
      makeRepo({ find: jest.fn().mockResolvedValue([]) }) as never,
      makeDataSource(),
      new ConfigService({}),
      makeMetrics(),
      makeRpcClient(),
      makeProjector(),
    );

    const result = await poller.poll();
    expect(result).toEqual({ eventsReceived: 0, eventsProjected: 0 });
  });

  it('returns 0 when latest ledger <= last processed', async () => {
    const dataSource = makeDataSource();
    dataSource.query = jest.fn().mockResolvedValue([{ ledger: 999 }]);

    const poller = new SorobanEventsPoller(
      makeRepo() as never,
      makeRepo({ find: jest.fn().mockResolvedValue([{ contractId: 'CA', network: 'testnet' }]) }) as never,
      dataSource,
      new ConfigService({}),
      makeMetrics(),
      makeRpcClient(true),
      makeProjector(),
    );

    const result = await poller.poll();
    expect(result).toEqual({ eventsReceived: 0, eventsProjected: 0 });
  });

  it('skips event sync when STELLAR_RPC_URL is not set', async () => {
    const contracts = [{ contractId: 'CA', network: 'testnet' }] as BountyContract[];
    const outbox = makeRepo({ find: jest.fn().mockResolvedValue(contracts) });
    const poller = new SorobanEventsPoller(
      outbox as never,
      makeRepo({ find: jest.fn().mockResolvedValue(contracts) }) as never,
      makeDataSource(),
      new ConfigService({}),
      makeMetrics(),
      makeRpcClient(),
      makeProjector(),
    );

    const result = await poller.poll();
    expect(result.eventsReceived).toBe(0);
  });

  it('calls projector after fetching events', async () => {
    const contracts = [{ contractId: 'CA', network: 'testnet' }] as BountyContract[];
    const projector = makeProjector();
    (projector.projectPendingEvents as jest.Mock).mockResolvedValue(3);

    const rpcClient = makeRpcClient(true);
    const dataSource = makeDataSource();
    dataSource.query = jest.fn().mockImplementation((_sql: string, params?: unknown[]) => {
      if (params?.[0] === 553) return [{ acquired: true }];
      return [{ ledger: 0 }];
    });

    const poller = new SorobanEventsPoller(
      makeRepo() as never,
      makeRepo({ find: jest.fn().mockResolvedValue(contracts) }) as never,
      dataSource,
      new ConfigService({ STELLAR_RPC_URL: 'https://rpc.test' }),
      makeMetrics(),
      rpcClient,
      projector,
    );

    await poller.poll();
    expect(projector.projectPendingEvents).toHaveBeenCalled();
  });

  it('reports metrics for received events', async () => {
    const contracts = [{ contractId: 'CA', network: 'testnet' }] as BountyContract[];
    const metrics = makeMetrics();

    const rpcClient = makeRpcClient(true);
    const server = (rpcClient as unknown as { getServer: jest.Mock }).getServer();
    server.getEvents.mockResolvedValue({
      events: [
        {
          id: 'evt-1',
          type: 'contract',
          contractId: 'CA',
          ledger: 101,
          txHash: 'tx1',
          topic: [],
          value: { switch: () => ({ name: 'scvVoid' }) },
        },
      ],
      latestLedger: 101,
      cursor: '',
    });

    const dataSource = makeDataSource();
    dataSource.query = jest.fn().mockImplementation((_sql: string, params?: unknown[]) => {
      if (params?.[0] === 553) return [{ acquired: true }];
      return [{ ledger: 0 }];
    });

    const poller = new SorobanEventsPoller(
      makeRepo() as never,
      makeRepo({ find: jest.fn().mockResolvedValue(contracts) }) as never,
      dataSource,
      new ConfigService({ STELLAR_RPC_URL: 'https://rpc.test' }),
      metrics,
      rpcClient,
      makeProjector(),
    );

    await poller.poll();
    expect(metrics.recordContractEventsReceived).toHaveBeenCalled();
  });

  it('acquires and releases advisory lock', async () => {
    const queryRunner = {
      connect: jest.fn(),
      query: jest.fn().mockImplementation((_sql: string, params?: unknown[]) => {
        if (params?.[0] === 553) return [{ acquired: true }];
        return [{ ledger: 0 }];
      }),
      release: jest.fn(),
    };
    const dataSource = {
      createQueryRunner: () => queryRunner,
      query: jest.fn().mockResolvedValue([{ ledger: 0 }]),
    } as unknown as DataSource;

    const poller = new SorobanEventsPoller(
      makeRepo() as never,
      makeRepo({ find: jest.fn().mockResolvedValue([]) }) as never,
      dataSource,
      new ConfigService({}),
      makeMetrics(),
      makeRpcClient(),
      makeProjector(),
    );

    await poller.poll();

    expect(queryRunner.connect).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });
});
