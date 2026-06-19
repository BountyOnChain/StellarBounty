import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Repository } from 'typeorm';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { SubmissionsService } from './submissions.service';

const mockServer = {
  getAccount: jest.fn(),
  prepareTransaction: jest.fn(),
  sendTransaction: jest.fn(),
};

jest.mock('@stellar/stellar-sdk', () => ({
  BASE_FEE: '100',
  Contract: jest.fn(() => ({ call: jest.fn() })),
  nativeToScVal: jest.fn(),
  Networks: {
    PUBLIC: 'PUBLIC',
    TESTNET: 'TESTNET',
  },
  rpc: {
    Server: jest.fn(() => mockServer),
  },
  TransactionBuilder: jest.fn(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn(),
  })),
}));

describe('SubmissionsService contract error handling', () => {
  function createBounty(): Bounty {
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
    };
  }

  function createSubmission(): Submission {
    return {
      id: 'submission1',
      bountyId: 'bounty1',
      bounty: createBounty(),
      contributorAddress: 'GCONTRIBUTOR',
      link: 'https://github.com/example/repo/pull/1',
      notes: null,
      status: SubmissionStatus.PENDING,
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
    };
  }

  it('approves the submission even when Stellar RPC account lookup fails', async () => {
    const bounty = createBounty();
    const submission = createSubmission();
    const submissionRepo = {
      findOneBy: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(submission),
      save: jest.fn(async (input) => input),
    };
    const bountyRepo = {
      findOneBy: jest.fn().mockResolvedValueOnce(bounty),
      save: jest.fn(async (input) => input),
    };
    const config = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string> = {
          SOROBAN_CONTRACT_BOUNTY1: 'contract-id',
          STELLAR_NETWORK: 'testnet',
          STELLAR_RPC_URL: 'https://rpc.example.com',
        };
        return values[key] ?? defaultValue;
      }),
    };
    mockServer.getAccount.mockRejectedValueOnce(new Error('rpc unavailable'));

    const service = new SubmissionsService(
      submissionRepo as unknown as Repository<Submission>,
      bountyRepo as unknown as Repository<Bounty>,
      config as unknown as ConfigService,
    );

    await expect(service.approve('bounty1', 'submission1', 'GOWNER')).resolves.toMatchObject({
      status: SubmissionStatus.APPROVED,
    });
    expect(StellarSdk.rpc.Server).toHaveBeenCalledWith('https://rpc.example.com');
    expect(bounty.status).toBe(BountyStatus.COMPLETED);
    expect(bountyRepo.save).toHaveBeenCalledWith(bounty);
    expect(submissionRepo.save).toHaveBeenCalledWith(submission);
  });
});
