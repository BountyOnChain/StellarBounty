import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { Repository } from 'typeorm';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { SubmissionsService, UploadedSubmissionFile } from './submissions.service';

const mockPreparedTransaction = { sign: jest.fn() };
const mockServer = {
  getAccount: jest.fn(),
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
  let uploadDir: string;

  function createBounty(overrides: Partial<Bounty> = {}): Bounty {
    return {
      id: 'bounty1',
      title: 'Build a Stellar integration',
      description: 'Create a working Stellar integration.',
      rewardAmount: '10000000',
      deadline: null,
      status: BountyStatus.OPEN,
      ownerAddress: 'GOWNER',
      submissions: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
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
      attachments: [],
      status: SubmissionStatus.PENDING,
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      ...overrides,
    };
  }

  function createFile(overrides: Partial<UploadedSubmissionFile> = {}): UploadedSubmissionFile {
    const buffer = Buffer.from('file-content');
    return {
      originalname: 'proof.pdf',
      mimetype: 'application/pdf',
      size: buffer.byteLength,
      buffer,
      ...overrides,
    };
  }

  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), 'stellar-submissions-'));
    mockPreparedTransaction.sign.mockClear();
    mockServer.getAccount.mockReset().mockResolvedValue({ accountId: 'GOWNER' });
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
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          JWT_SECRET: 'test-jwt-secret',
          SUBMISSION_UPLOAD_DIR: uploadDir,
        };
        return values[key] ?? defaultValue;
      }),
    };

    service = new SubmissionsService(
      submissionRepo as unknown as Repository<Submission>,
      bountyRepo as unknown as Repository<Bounty>,
      config as unknown as ConfigService,
    );
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
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
        id: expect.any(String),
        bountyId: 'bounty1',
        link: 'https://github.com/example/repo/pull/1',
        notes: null,
        contributorAddress: 'GCONTRIBUTOR',
        attachments: [],
      });
      expect(submissionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ attachments: [] }),
      );
      expect(result.attachments).toEqual([]);
    });

    it('stores supported attachments and returns signed download URLs', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());

      const result = await service.create(
        'bounty1',
        { link: 'https://github.com/example/repo/pull/1', notes: 'See attached proof.' },
        'GCONTRIBUTOR',
        [createFile()],
      );

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0]).toMatchObject({
        originalName: 'proof.pdf',
        mimeType: 'application/pdf',
        size: Buffer.byteLength('file-content'),
      });
      expect(result.attachments[0].downloadUrl).toContain(
        `/bounties/bounty1/submissions/${result.id}/attachments/${result.attachments[0].id}/download?token=`,
      );
      expect(
        existsSync(path.join(uploadDir, result.attachments[0].storageKey)),
      ).toBe(true);
    });

    it('rejects unsupported attachment types', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());

      await expect(
        service.create(
          'bounty1',
          { link: 'https://github.com/example/repo/pull/1' },
          'GCONTRIBUTOR',
          [createFile({ originalname: 'malware.exe', mimetype: 'application/octet-stream' })],
        ),
      ).rejects.toThrow(BadRequestException);
      expect(submissionRepo.create).not.toHaveBeenCalled();
    });

    it('enforces configurable attachment size limits', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());
      config.get = jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          JWT_SECRET: 'test-jwt-secret',
          SUBMISSION_UPLOAD_DIR: uploadDir,
          SUBMISSION_UPLOAD_MAX_FILE_SIZE_BYTES: 4,
        };
        return values[key] ?? defaultValue;
      });

      await expect(
        service.create(
          'bounty1',
          { link: 'https://github.com/example/repo/pull/1' },
          'GCONTRIBUTOR',
          [createFile()],
        ),
      ).rejects.toThrow(BadRequestException);
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

      await expect(service.findAll('bounty1', 'GOWNER')).resolves.toEqual(submissions);
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

    it('prepares, signs, and submits the Stellar contract transaction when configured', async () => {
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

      expect(StellarSdk.rpc.Server).toHaveBeenCalledWith('https://rpc.example.com');
      expect(StellarSdk.Contract).toHaveBeenCalledWith('contract-id');
      expect(StellarSdk.nativeToScVal).toHaveBeenCalledWith('GOWNER', { type: 'address' });
      expect(StellarSdk.TransactionBuilder).toHaveBeenCalledWith(
        { accountId: 'GOWNER' },
        { fee: StellarSdk.BASE_FEE, networkPassphrase: StellarSdk.Networks.PUBLIC },
      );
      expect(mockTransactionBuilder.addOperation).toHaveBeenCalledWith('approve-operation');
      expect(mockServer.prepareTransaction).toHaveBeenCalledWith('built-transaction');
      expect(StellarSdk.Keypair.fromSecret).toHaveBeenCalledWith('secret');
      expect(mockPreparedTransaction.sign).toHaveBeenCalledWith(mockSigningKeypair);
      expect(mockServer.sendTransaction).toHaveBeenCalledWith(mockPreparedTransaction);
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

  describe('resolveAttachmentDownload', () => {
    it('resolves an attachment from a valid signed URL token', async () => {
      bountyRepo.findOneBy!.mockResolvedValueOnce(createBounty());
      const created = await service.create(
        'bounty1',
        { link: 'https://github.com/example/repo/pull/1' },
        'GCONTRIBUTOR',
        [createFile({ originalname: 'screen shot.png', mimetype: 'image/png' })],
      );
      const attachment = created.attachments[0];
      const token = new URL(`http://localhost${attachment.downloadUrl}`).searchParams.get('token');
      submissionRepo.findOneBy!.mockResolvedValueOnce(created);

      await expect(
        service.resolveAttachmentDownload('bounty1', created.id, attachment.id, token ?? ''),
      ).resolves.toMatchObject({
        originalName: 'screen shot.png',
        mimeType: 'image/png',
        size: attachment.size,
      });
    });

    it('rejects tampered attachment tokens', async () => {
      await expect(
        service.resolveAttachmentDownload('bounty1', 'submission1', 'attachment1', 'bad.token'),
      ).rejects.toThrow(ForbiddenException);
      expect(submissionRepo.findOneBy).not.toHaveBeenCalled();
    });
  });
});
