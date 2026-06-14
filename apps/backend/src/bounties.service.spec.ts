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
      rewardAmount: '10000000',
      deadline: new Date('2026-12-31T00:00:00.000Z'),
      status: BountyStatus.OPEN,
      ownerAddress: 'GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX',
      submissions: [],
      createdAt,
      updatedAt,
      ...overrides,
    };
  }

  beforeEach(async () => {
    repository = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => createBounty(input)),
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
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
        rewardAmount: '10000000',
        ownerAddress: 'GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX',
        deadline: '2026-12-31T00:00:00.000Z',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rewardAmount: '10000000',
          deadline: new Date('2026-12-31T00:00:00.000Z'),
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result.rewardAmount).toBe('10000000');
    });

    it('stores a null deadline when the DTO omits one', async () => {
      await service.create({
        title: 'Build a Stellar integration',
        description: 'Create a working Stellar integration with tests.',
        rewardAmount: '10000000',
        ownerAddress: 'GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX',
      });

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ deadline: null }));
    });

    it('propagates repository errors for invalid persistence input', async () => {
      repository.save!.mockRejectedValueOnce(new Error('invalid bounty'));

      await expect(
        service.create({
          title: 'Bad bounty',
          description: 'Invalid payload',
          rewardAmount: 'bad',
          ownerAddress: 'GABC',
        }),
      ).rejects.toThrow('invalid bounty');
    });
  });

  it('findAll returns paginated bounties ordered newest first', async () => {
    const bounties = [createBounty({ id: 'new' }), createBounty({ id: 'old' })];
    repository.findAndCount!.mockResolvedValueOnce([bounties, 42]);

    await expect(service.findAll({ page: '2', limit: '20' })).resolves.toEqual({
      data: bounties,
      pagination: {
        total: 42,
        page: 2,
        pageSize: 20,
        totalPages: 3,
        next: '/bounties?page=3&limit=20',
        prev: '/bounties?page=1&limit=20',
      },
    });
    expect(repository.findAndCount).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      skip: 20,
      take: 20,
    });
  });

  it('findAll applies default pagination and caps large limits', async () => {
    repository.findAndCount!.mockResolvedValueOnce([[], 0]);

    await expect(service.findAll({ page: 'bad', limit: '1000' })).resolves.toEqual({
      data: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 100,
        totalPages: 0,
        next: null,
        prev: null,
      },
    });
    expect(repository.findAndCount).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 100,
    });
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
        rewardAmount: '25000000',
        deadline: '2027-01-15T00:00:00.000Z',
      });

      expect(result).toMatchObject({
        title: 'Updated title',
        rewardAmount: '25000000',
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
    it('removes an existing bounty', async () => {
      const bounty = createBounty();
      repository.findOne!.mockResolvedValueOnce(bounty);
      repository.remove!.mockResolvedValueOnce(bounty);

      await expect(service.remove('bounty-1')).resolves.toEqual({ deleted: true });
      expect(repository.remove).toHaveBeenCalledWith(bounty);
    });

    it('throws NotFoundException when removing a missing bounty', async () => {
      repository.findOne!.mockResolvedValueOnce(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
