import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Repository } from 'typeorm';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { StellarRpcClient } from '../common/stellar-rpc-client';
import { MetricsService } from '../metrics/metrics.service';
import { SubmissionsService } from './submissions.service';

const mockPreparedTransaction = { sign: jest.fn() };
const mockServer = {
  getAccount: jest.fn(),
  simulateTransaction: jest.fn(),
  prepareTransaction: jest.fn(),
  sendTransaction: jest.fn(),
};
const mockContractCall = jest.fn();
const mockTransactionBuilder = {
  addOperation: jest.fn(),
  setTimeout: jest.fn(),
  build: jest.fn(),
};
const mockSigningKeypair = { publicKey: jest.fn() };
const mockStellarRpcClient = {
  initialize: jest.fn(),
  getAccount: jest.fn(),
  prepareTransaction: jest.fn(),
  sendTransaction: jest.fn(),
};

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

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let submissionRepo: MockRepository<Submission>;
  let bountyRepo: MockRepository<Bounty>;
  let config: { get: jest.Mock };
  let metrics: Pick<MetricsService, 'recordStellarRpcFailure' | 'recordStellarRpcRetry'>;

  function createBounty(overrides: Partial<Bounty> = {}): Bounty {
    return {
      id: 'bounty1',
      title: 'Build a Stellar integration',
      description: 'Create a working Stellar integration.',
      rewardAmount: 10000000n,
      deadline: null,
      status: BountyStatus.OPEN,
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
    mockPreparedTransaction.sign.mockClear();
    mockServer.getAccount.mockReset().mockResolvedValue({ accountId: 'GOWNER' });
    mockServer.simulateTransaction.mockReset().mockResolvedValue({
      transactionData: { resourceFee: '100' },
      minResourceFee: '100',
    });
    mockServer.prepareTransaction.mockReset().mockResolvedValue(mockPreparedTransaction);
    mockServer.sendTransaction.mockReset().mockResolvedValue({ status: 'PENDING' });
    mockContractCall.mockReset().mockReturnValue('approve-operation');
    mockTransactionBuilder.addOperation.mockReset().mockReturnValue(mockTransactionBuilder);
    mockTransactionBuilder.setTimeout.mockReset().mockReturnValue(mockTransactionBuilder);
    mockTransactionBuilder.build.mockReset().mockReturnValue('built-transaction');
    jest.clearAllMocks();

    submissionRepo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
      findBy: jest.fn(),
      findOneBy: jest.fn(),
    };
    bountyRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(async (input) => input),
    };
    config = {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    };
    metrics = {
      recordStellarRpcFailure: jest.fn(),
      recordStellarRpcRetry: jest.fn(),
    };

    service = new SubmissionsService(
      submissionRepo as unknown as Repository<Submission>,
      bountyRepo as unknown as Repository<Bounty>,
      config as unknown as ConfigService,
      mockStellarRpcClient as unknown as StellarRpcClient,
      metrics as MetricsService,
    );
  });

  describe('create', () => {
    it('creates a submission with nullable notes for an existing bounty', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());

      const result = await service.create(
        'bounty1',
        { link: 'https://github.com/example/repo/pull/1' },
        'GCONTRIBUTOR',
      );

      expect(submissionRepo.create).toHaveBeenCalledWith({
        bountyId: 'bounty1',
        link: 'https://github.com/example/repo/pull/1',
        notes: null,
        contributorAddress: 'GCONTRIBUTOR',
      });
      expect(submissionRepo.save).toHaveBeenCalledWith(result);
    });

    it('throws NotFoundException when creating for a missing bounty', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(null);

      await expect(
        service.create('missing', { link: 'https://github.com/example/repo/pull/1' }, 'GCONTRIBUTOR'),
      ).rejects.toThrow(NotFoundException);
      expect(submissionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns submissions for the bounty owner', async () => {
      const submissions = [createSubmission()];
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());
      submissionRepo.findBy!.mockResolvedValueOnce(submissions);

      await expect(service.findAll('bounty1', 'GOWNER')).resolves.toBe(submissions);
      expect(submissionRepo.findBy).toHaveBeenCalledWith({ bountyId: 'bounty1' });
    });

    it('throws ForbiddenException when a non-owner lists submissions', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());

      await expect(service.findAll('bounty1', 'GINTRUDER')).rejects.toThrow(ForbiddenException);
      expect(submissionRepo.findBy).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('approves a submission, completes the bounty, and skips contract calls when no contract is configured', async () => {
      const bounty = createBounty();
      const submission = createSubmission();
      bountyRepo.findOneBy!.mockResolvedValueOnce(bounty);
      submissionRepo.findOneBy!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(submission);

      const result = await service.approve('bounty1', 'submission1', 'GOWNER');

      expect(result.status).toBe(SubmissionStatus.APPROVED);
      expect(bounty.status).toBe(BountyStatus.COMPLETED);
      expect(bountyRepo.save).toHaveBeenCalledWith(bounty);
      expect(submissionRepo.save).toHaveBeenCalledWith(submission);
      expect(StellarSdk.rpc.Server).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a non-owner approves', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());

      await expect(service.approve('bounty1', 'submission1', 'GINTRUDER')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('prevents duplicate approvals for the same bounty', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());
      submissionRepo.findOneBy!.mockResolvedValueOnce(
        createSubmission({ status: SubmissionStatus.APPROVED }),
      );

      await expect(service.approve('bounty1', 'submission1', 'GOWNER')).rejects.toThrow(
        BadRequestException,
      );
      expect(bountyRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target submission is missing', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());
      submissionRepo.findOneBy!.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await expect(service.approve('bounty1', 'missing', 'GOWNER')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('simulates transaction before preparing when contract is configured', async () => {
      const bounty = createBounty();
      const submission = createSubmission();
      bountyRepo.findOneBy!.mockResolvedValueOnce(bounty);
      submissionRepo.findOneBy!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(submission);
      config.get = jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string> = {
          SOROBAN_CONTRACT_BOUNTY1: 'contract-id',
          STELLAR_NETWORK: 'mainnet',
          STELLAR_RPC_URL: 'https://rpc.example.com',
          STELLAR_SIGNING_SECRET: 'secret',
        };
        return values[key] ?? defaultValue;
      });

      await service.approve('bounty1', 'submission1', 'GOWNER');

      expect(mockServer.simulateTransaction).toHaveBeenCalledWith('built-transaction');
      expect(mockServer.prepareTransaction).toHaveBeenCalledWith('built-transaction');
      expect(mockServer.sendTransaction).toHaveBeenCalledWith(mockPreparedTransaction);
    });

    it('throws BadRequestException when simulation fails', async () => {
      const bounty = createBounty();
      const submission = createSubmission();
      bountyRepo.findOneBy!.mockResolvedValueOnce(bounty);
      submissionRepo.findOneBy!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(submission);
      mockServer.simulateTransaction.mockResolvedValueOnce({
        error: 'Contract error: bounty not open',
      });
      config.get = jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string> = {
          SOROBAN_CONTRACT_BOUNTY1: 'contract-id',
          STELLAR_NETWORK: 'mainnet',
          STELLAR_RPC_URL: 'https://rpc.example.com',
          STELLAR_SIGNING_SECRET: 'secret',
        };
        return values[key] ?? defaultValue;
      });

      await expect(service.approve('bounty1', 'submission1', 'GOWNER')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockServer.simulateTransaction).toHaveBeenCalledWith('built-transaction');
      expect(mockServer.prepareTransaction).not.toHaveBeenCalled();
      expect(mockServer.sendTransaction).not.toHaveBeenCalled();
    });

    it('does not send transaction when simulation succeeds but no signing secret', async () => {
      const bounty = createBounty();
      const submission = createSubmission();
      bountyRepo.findOneBy!.mockResolvedValueOnce(bounty);
      submissionRepo.findOneBy!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(submission);
      config.get = jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string> = {
          SOROBAN_CONTRACT_BOUNTY1: 'contract-id',
          STELLAR_NETWORK: 'mainnet',
          STELLAR_RPC_URL: 'https://rpc.example.com',
        };
        return values[key] ?? defaultValue;
      });

      await service.approve('bounty1', 'submission1', 'GOWNER');

      expect(mockServer.simulateTransaction).toHaveBeenCalledWith('built-transaction');
      expect(mockServer.prepareTransaction).toHaveBeenCalledWith('built-transaction');
      expect(mockServer.sendTransaction).not.toHaveBeenCalled();
    });

    it('retries retryable Stellar RPC failures before approving', async () => {
      const bounty = createBounty();
      const submission = createSubmission();
      bountyRepo.findOneBy!.mockResolvedValueOnce(bounty);
      submissionRepo.findOneBy!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(submission);
      config.get = jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string | number> = {
          SOROBAN_CONTRACT_BOUNTY1: 'contract-id',
          STELLAR_RPC_URL: 'https://rpc.example.com',
          STELLAR_RPC_RETRY_BASE_DELAY_MS: 0,
        };
        return values[key] ?? defaultValue;
      });
      mockServer.getAccount
        .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValueOnce({ accountId: 'GOWNER' });

      await service.approve('bounty1', 'submission1', 'GOWNER');

      expect(mockServer.getAccount).toHaveBeenCalledTimes(3);
      expect(metrics.recordStellarRpcFailure).toHaveBeenCalledWith({
        operation: 'getAccount',
        retryable: true,
      });
      expect(metrics.recordStellarRpcRetry).toHaveBeenCalledTimes(2);
      expect(bountyRepo.save).toHaveBeenCalledWith(bounty);
      expect(submissionRepo.save).toHaveBeenCalledWith(submission);
    });

    it('does not retry non-retryable Stellar RPC errors', async () => {
      const bounty = createBounty();
      const submission = createSubmission();
      bountyRepo.findOneBy!.mockResolvedValueOnce(bounty);
      submissionRepo.findOneBy!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(submission);
      config.get = jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string | number> = {
          SOROBAN_CONTRACT_BOUNTY1: 'contract-id',
          STELLAR_RPC_URL: 'https://rpc.example.com',
          STELLAR_RPC_RETRY_BASE_DELAY_MS: 0,
        };
        return values[key] ?? defaultValue;
      });
      mockServer.prepareTransaction.mockRejectedValueOnce({ status: 400 });

      await expect(service.approve('bounty1', 'submission1', 'GOWNER')).rejects.toEqual({
        status: 400,
      });

      expect(mockServer.prepareTransaction).toHaveBeenCalledTimes(1);
      expect(metrics.recordStellarRpcFailure).toHaveBeenCalledWith({
        operation: 'prepareTransaction',
        retryable: false,
      });
      expect(metrics.recordStellarRpcRetry).not.toHaveBeenCalled();
      expect(bountyRepo.save).not.toHaveBeenCalled();
      expect(submissionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('rejects an existing submission for the bounty owner', async () => {
      const submission = createSubmission();
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());
      submissionRepo.findOneBy!.mockResolvedValueOnce(submission);

      const result = await service.reject('bounty1', 'submission1', 'GOWNER');

      expect(result.status).toBe(SubmissionStatus.REJECTED);
      expect(submissionRepo.save).toHaveBeenCalledWith(submission);
    });

    it('throws NotFoundException when rejecting a missing submission', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());
      submissionRepo.findOneBy!.mockResolvedValueOnce(null);

      await expect(service.reject('bounty1', 'missing', 'GOWNER')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when a non-owner rejects', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());

      await expect(service.reject('bounty1', 'submission1', 'GINTRUDER')).rejects.toThrow(
        ForbiddenException,
      );
      expect(submissionRepo.save).not.toHaveBeenCalled();
    });
  });
});
