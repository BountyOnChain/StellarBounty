import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { MetricsService } from '../metrics/metrics.service';
import { ContractRegistryService } from './contract-registry.service';
import { SettlementSchedulerService } from './settlement-scheduler.service';

const mockPreparedTransaction = { sign: jest.fn() };
const mockServer = {
  getAccount: jest.fn(),
  simulateTransaction: jest.fn(),
  prepareTransaction: jest.fn(),
  sendTransaction: jest.fn(),
  getFeeStats: jest.fn(),
};
const mockContractCall = jest.fn();
const mockTransactionBuilder = {
  addOperation: jest.fn(),
  setTimeout: jest.fn(),
  build: jest.fn(),
};
const mockSigningKeypair = { publicKey: jest.fn(() => 'GSIGNING_KEY') };

jest.mock('@stellar/stellar-sdk', () => ({
  BASE_FEE: '100',
  Contract: jest.fn(() => ({ call: mockContractCall })),
  Keypair: {
    fromSecret: jest.fn(() => mockSigningKeypair),
  },
  nativeToScVal: jest.fn((value, options) => ({ value, options })),
  Networks: {
    PUBLIC: 'PUBLIC',
    TESTNET: 'TESTNET',
  },
  rpc: {
    Server: jest.fn(() => mockServer),
  },
  TransactionBuilder: jest.fn(() => mockTransactionBuilder),
}));

type MockRepository<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('SettlementSchedulerService', () => {
  let service: SettlementSchedulerService;
  let bountyRepo: MockRepository<Bounty>;
  let submissionRepo: MockRepository<Submission>;
  let dataSource: { createQueryRunner: jest.Mock };
  let config: { get: jest.Mock };
  let contractRegistryService: { findContractFor: jest.Mock };
  let metrics: Pick<
    MetricsService,
    'recordSettlementAttempt' | 'recordSettlementSuccess' | 'recordSettlementFailure'
  >;
  let mockQueryRunner: {
    connect: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
  };

  function createBounty(overrides: Partial<Bounty> = {}): Bounty {
    return {
      id: 'bounty1',
      title: 'Build a feature',
      description: 'Create a feature.',
      rewardAmount: 10000000n,
      deadline: null,
      status: BountyStatus.APPROVAL_QUEUED,
      ownerAddress: 'GOWNER',
      submissions: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      deletedAt: null,
      ...overrides,
    };
  }

  function createSubmission(overrides: Partial<Submission> = {}): Submission {
    return {
      id: 'submission1',
      bountyId: 'bounty1',
      bounty: createBounty(),
      contributorAddress: 'GCONTRIBUTOR',
      link: 'https://github.com/example/repo/pull/1',
      notes: null,
      status: SubmissionStatus.PENDING,
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer.getAccount.mockReset().mockResolvedValue({ accountId: 'GSIGNING_KEY' });
    mockServer.simulateTransaction.mockReset().mockResolvedValue({
      transactionData: { resourceFee: '100' },
      minResourceFee: '100',
    });
    mockServer.prepareTransaction.mockReset().mockResolvedValue(mockPreparedTransaction);
    mockServer.sendTransaction.mockReset().mockResolvedValue({ status: 'PENDING' });
    mockServer.getFeeStats.mockReset().mockResolvedValue({
      feeCharged: { p95: '500' },
    });
    mockContractCall.mockReset().mockReturnValue('execute-approve-operation');
    mockTransactionBuilder.addOperation.mockReset().mockReturnValue(mockTransactionBuilder);
    mockTransactionBuilder.setTimeout.mockReset().mockReturnValue(mockTransactionBuilder);
    mockTransactionBuilder.build.mockReset().mockReturnValue('built-transaction');
    mockPreparedTransaction.sign.mockReset();

    bountyRepo = {
      find: jest.fn(),
      save: jest.fn(async (input) => input),
    };
    submissionRepo = {
      save: jest.fn(async (input) => input),
    };
    mockQueryRunner = {
      connect: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };
    config = {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    };
    contractRegistryService = {
      findContractFor: jest.fn(),
    };
    metrics = {
      recordSettlementAttempt: jest.fn(),
      recordSettlementSuccess: jest.fn(),
      recordSettlementFailure: jest.fn(),
    };

    service = new SettlementSchedulerService(
      bountyRepo as unknown as Repository<Bounty>,
      submissionRepo as unknown as Repository<Submission>,
      dataSource as unknown as DataSource,
      config as unknown as ConfigService,
      metrics as MetricsService,
      contractRegistryService as unknown as ContractRegistryService,
    );
  });

  function stubContractConfig(): void {
    config.get = jest.fn((key: string, defaultValue?: unknown) => {
      const values: Record<string, string> = {
        STELLAR_NETWORK: 'mainnet',
        STELLAR_RPC_URL: 'https://rpc.example.com',
        STELLAR_SIGNING_SECRET: 'SCHNOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO',
      };
      return values[key] ?? defaultValue;
    });
  }

  describe('runSettlement', () => {
    it('skips when advisory lock is not acquired', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ acquired: false }]);

      const result = await service.runSettlement();

      expect(result).toEqual({ processedAt: expect.any(Date), attempted: 0, succeeded: 0, failed: 0 });
      expect(bountyRepo.find).not.toHaveBeenCalled();
    });

    it('processes queued bounties and transitions to COMPLETED on success', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(undefined);

      const bounty = createBounty();
      const submission = createSubmission();
      bounty.submissions = [submission];
      bountyRepo.find!.mockResolvedValueOnce([bounty]);
      contractRegistryService.findContractFor!.mockResolvedValue('contract-id');
      stubContractConfig();

      const result = await service.runSettlement();

      expect(result.attempted).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(bounty.status).toBe(BountyStatus.COMPLETED);
      expect(submission.status).toBe(SubmissionStatus.APPROVED);
      expect(bountyRepo.save).toHaveBeenCalledWith(bounty);
      expect(submissionRepo.save).toHaveBeenCalledWith(submission);
      expect(metrics.recordSettlementAttempt).toHaveBeenCalledTimes(1);
      expect(metrics.recordSettlementSuccess).toHaveBeenCalledTimes(1);
    });

    it('records failure when execute_approve call throws', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(undefined);

      const bounty = createBounty();
      const submission = createSubmission();
      bounty.submissions = [submission];
      bountyRepo.find!.mockResolvedValueOnce([bounty]);
      contractRegistryService.findContractFor!.mockResolvedValue(null);

      const result = await service.runSettlement();

      expect(result.attempted).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(bounty.status).toBe(BountyStatus.APPROVAL_QUEUED);
      expect(submission.status).toBe(SubmissionStatus.PENDING);
      expect(metrics.recordSettlementFailure).toHaveBeenCalledTimes(1);
    });

    it('skips bounties with no pending submission', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(undefined);

      const bounty = createBounty();
      const submission = createSubmission({ status: SubmissionStatus.APPROVED });
      bounty.submissions = [submission];
      bountyRepo.find!.mockResolvedValueOnce([bounty]);

      const result = await service.runSettlement();

      expect(result.attempted).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(bountyRepo.save).not.toHaveBeenCalled();
    });

    it('processes multiple bounties independently', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(undefined);

      const bounty1 = createBounty({ id: 'bounty1' });
      const sub1 = createSubmission({ id: 'sub1', bountyId: 'bounty1' });
      bounty1.submissions = [sub1];

      const bounty2 = createBounty({ id: 'bounty2' });
      const sub2 = createSubmission({ id: 'sub2', bountyId: 'bounty2' });
      bounty2.submissions = [sub2];

      bountyRepo.find!.mockResolvedValueOnce([bounty1, bounty2]);
      contractRegistryService.findContractFor!.mockResolvedValue('contract-id');
      stubContractConfig();

      const result = await service.runSettlement();

      expect(result.attempted).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(bounty1.status).toBe(BountyStatus.COMPLETED);
      expect(bounty2.status).toBe(BountyStatus.COMPLETED);
    });

    it('releases advisory lock even when an error occurs', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(undefined);

      bountyRepo.find!.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(service.runSettlement()).rejects.toThrow('DB connection lost');
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock($1)',
        [expect.any(Number)],
      );
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('releases connection when lock is not acquired', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ acquired: false }]);

      await service.runSettlement();

      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('throws BadRequestException when no contract is mapped for a bounty', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(undefined);

      const bounty = createBounty();
      const submission = createSubmission();
      bounty.submissions = [submission];
      bountyRepo.find!.mockResolvedValueOnce([bounty]);
      contractRegistryService.findContractFor!.mockResolvedValue(null);

      const result = await service.runSettlement();

      expect(result.failed).toBe(1);
      expect(bounty.status).toBe(BountyStatus.APPROVAL_QUEUED);
    });
  });
});
