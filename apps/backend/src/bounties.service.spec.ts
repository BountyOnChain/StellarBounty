import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BountiesService } from './bounties.service';
import { Bounty, BountyStatus } from './entities/bounty.entity';

type MockRepository<T extends object = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('BountiesService', () => {
  let service: BountiesService;
  let repository: MockRepository<Bounty>;

  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const updatedAt = new Date('2026-01-02T00:00:00.000Z');

  function createBounty(overrides: Partial<Bounty> = {}): Bounty {
    return {
      id: 'bounty-1',
      title: 'Build a Stellar integration',
      description: 'Create a working Stellar integration with tests.',
      rewardAmount: 10000000n,
      deadline: new Date('2026-12-31T00:00:00.000Z'),
      status: BountyStatus.OPEN,
      ownerAddress: 'GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX',
      submissions: [],
      createdAt,
      updatedAt,
      deletedAt: null,
      ...overrides,
    } as Bounty;
  }

  beforeEach(async () => {
    repository = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => createBounty(input)),
      find: jest.fn(),
      findOne: jest.fn(),
      softRemove: jest.fn(async (input) => input),
      restore: jest.fn(async (id) => id),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BountiesService,
        {
          provide: getRepositoryToken(Bounty),
          useValue: repository,
        },
      ],
    }).compile();

    service = moduleRef.get(BountiesService);
  });

  describe('create', () => {
    it('creates a bounty and normalizes the deadline', async () => {
      const result = await service.create({
        title: 'Build a Stellar integration',
        description: 'Create a working Stellar integration with tests.',
        rewardAmount: 10000000n,
        ownerAddress: 'GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX',
        deadline: '2026-12-31T00:00:00.000Z',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rewardAmount: 10000000n,
          deadline: new Date('2026-12-31T00:00:00.000Z'),
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result.rewardAmount).toBe(10000000n);
    });

    it('stores a null deadline when the DTO omits one', async () => {
      await service.create({
        title: 'Build a Stellar integration',
        description: 'Create a working Stellar integration with tests.',
        rewardAmount: 10000000n,
        ownerAddress: 'GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX',
      });

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ deadline: null }));
    });

    it('throws on invalid rewardAmount that cannot be parsed as BigInt', async () => {
      await expect(
        service.create({
          title: 'Bad bounty',
          description: 'Invalid payload',
          rewardAmount: 'not-a-number',
          ownerAddress: 'GABC',
        } as any),
      ).rejects.toThrow();
    });
  });

  it('findAll returns bounties ordered newest first', async () => {
    const bounties = [createBounty({ id: 'new' }), createBounty({ id: 'old' })];
    repository.find!.mockResolvedValueOnce(bounties);

    await expect(service.findAll()).resolves.toBe(bounties);
    expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });

  describe('findOne', () => {
    it('returns an existing bounty', async () => {
      const bounty = createBounty();
      repository.findOne!.mockResolvedValueOnce(bounty);

      await expect(service.findOne('bounty-1')).resolves.toBe(bounty);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'bounty-1' } });
    });

    it('throws NotFoundException when the bounty does not exist', async () => {
      repository.findOne!.mockResolvedValueOnce(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates fields and converts a provided deadline', async () => {
      const existing = createBounty();
      repository.findOne!.mockResolvedValueOnce(existing);
      repository.save!.mockImplementationOnce(async (input) => input);

      const result = await service.update('bounty-1', {
        title: 'Updated title',
        rewardAmount: 25000000n,
        deadline: '2027-01-15T00:00:00.000Z',
      });

      expect(result).toMatchObject({
        title: 'Updated title',
        rewardAmount: 25000000n,
        deadline: new Date('2027-01-15T00:00:00.000Z'),
      });
      expect(repository.save).toHaveBeenCalledWith(existing);
    });

    it('preserves the existing deadline when update deadline is undefined', async () => {
      const existingDeadline = new Date('2026-12-31T00:00:00.000Z');
      const existing = createBounty({ deadline: existingDeadline });
      repository.findOne!.mockResolvedValueOnce(existing);
      repository.save!.mockImplementationOnce(async (input) => input);

      const result = await service.update('bounty-1', { title: 'Updated title' });

      expect(result.deadline).toBe(existingDeadline);
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing bounty', async () => {
      const bounty = createBounty();
      repository.findOne!.mockResolvedValueOnce(bounty);
      repository.softRemove!.mockResolvedValueOnce(bounty);

      await expect(service.remove('bounty-1')).resolves.toEqual({ deleted: true });
      expect(repository.softRemove).toHaveBeenCalledWith(bounty);
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when removing a missing bounty', async () => {
      repository.findOne!.mockResolvedValueOnce(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(repository.softRemove).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('restores a soft-deleted bounty', async () => {
      const deleted = createBounty({ deletedAt: new Date() });
      const restored = createBounty({ deletedAt: null });
      repository.findOne!
        .mockResolvedValueOnce(deleted)
        .mockResolvedValueOnce(restored);
      repository.restore!.mockResolvedValueOnce({ affected: 1 } as any);

      await expect(service.restore('bounty-1')).resolves.toBe(restored);
      expect(repository.restore).toHaveBeenCalledWith('bounty-1');
    });

    it('returns the bounty unchanged when it is not soft-deleted', async () => {
      const existing = createBounty({ deletedAt: null });
      repository.findOne!.mockResolvedValueOnce(existing);

      await expect(service.restore('bounty-1')).resolves.toBe(existing);
      expect(repository.restore).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when restoring a missing bounty', async () => {
      repository.findOne!.mockResolvedValueOnce(null);

      await expect(service.restore('missing')).rejects.toThrow(NotFoundException);
      expect(repository.restore).not.toHaveBeenCalled();
    });
  });
});
