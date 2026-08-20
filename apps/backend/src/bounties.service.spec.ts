import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BountiesService } from './bounties.service';
import { Bounty, BountyStatus } from './entities/bounty.entity';
import { SavedBounty } from './entities/saved-bounty.entity';

type MockRepository<T extends object = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('BountiesService', () => {
  let service: BountiesService;
  let repository: MockRepository<Bounty>;
  let savedRepository: MockRepository<SavedBounty>;

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

  function createMockQueryBuilder(results: Bounty[] = [], total = 0) {
    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(results),
      getCount: jest.fn().mockResolvedValue(total),
    };
    return qb;
  }

  beforeEach(async () => {
    repository = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => createBounty(input)),
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      softRemove: jest.fn(async (input) => input),
      restore: jest.fn(async (id) => id),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    savedRepository = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BountiesService,
        {
          provide: getRepositoryToken(Bounty),
          useValue: repository,
        },
        {
          provide: getRepositoryToken(SavedBounty),
          useValue: savedRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(BountiesService);
  });

  const OWNER_ADDRESS = 'GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX';
  const NON_OWNER_ADDRESS = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

  describe('create', () => {
    it('creates a bounty and normalizes the deadline', async () => {
      const result = await service.create({
        title: 'Build a Stellar integration',
        description: 'Create a working Stellar integration with tests.',
        rewardAmount: 10000000n,
        ownerAddress: OWNER_ADDRESS,
        deadline: '2026-12-31T00:00:00.000Z',
      }, OWNER_ADDRESS);

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
        ownerAddress: OWNER_ADDRESS,
      }, OWNER_ADDRESS);

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ deadline: null }));
    });

    it('sanitizes descriptions before creating a bounty', async () => {
      await service.create({
        title: 'Build a Stellar integration',
        description: 'Safe text <script>alert("xss")</script> [bad](javascript:alert(1))',
        rewardAmount: '10000000',
        ownerAddress: OWNER_ADDRESS,
      }, OWNER_ADDRESS);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Safe text  bad',
        }),
      );
    });

    it('throws on invalid rewardAmount that cannot be parsed as BigInt', async () => {
      await expect(
        service.create({
          title: 'Bad bounty',
          description: 'Invalid payload',
          rewardAmount: 'not-a-number',
          ownerAddress: 'GABC',
        } as any, OWNER_ADDRESS),
      ).rejects.toThrow();
    });

    it('throws ForbiddenException when ownerAddress does not match JWT subject', async () => {
      await expect(
        service.create({
          title: 'Build a Stellar integration',
          description: 'Create a working Stellar integration with tests.',
          rewardAmount: 10000000n,
          ownerAddress: OWNER_ADDRESS,
        }, NON_OWNER_ADDRESS),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('returns paginated bounties ordered newest first with default page=1, limit=20', async () => {
      const bounties = [createBounty({ id: 'new' }), createBounty({ id: 'old' })];
      const qb = createMockQueryBuilder(bounties, 2);
      repository.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.findAll();

      expect(qb.orderBy).toHaveBeenCalledWith('bounty.createdAt', 'DESC');
      expect(qb.take).toHaveBeenCalledWith(21);
      expect(result.data).toEqual(bounties);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.nextCursor).toBeNull();
    });

    it('applies cursor when provided', async () => {
      const bounties = [createBounty({ id: 'b' })];
      const qb = createMockQueryBuilder(bounties, 45);
      repository.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.findAll({ cursor: 'prev-id', limit: 10 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('createdAt <'),
        { cursor: 'prev-id' },
      );
      expect(qb.take).toHaveBeenCalledWith(11);
      expect(result.data).toEqual(bounties);
      expect(result.total).toBe(45);
    });

    it('returns nextCursor when more items exist', async () => {
      const bounties = Array.from({ length: 6 }, (_, i) => createBounty({ id: `item-${i}` }));
      const qb = createMockQueryBuilder(bounties, 100);
      repository.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.findAll({ limit: 5 });

      expect(result.nextCursor).toBe('item-4');
      expect(result.data).toHaveLength(5);
    });

    it('returns totalPages = 1 even when total is 0 (defensive)', async () => {
      const qb = createMockQueryBuilder([], 0);
      repository.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
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
        rewardAmount: 25000000n,
        deadline: '2027-01-15T00:00:00.000Z',
      }, OWNER_ADDRESS);

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

      const result = await service.update('bounty-1', { title: 'Updated title' }, OWNER_ADDRESS);

      expect(result.deadline).toBe(existingDeadline);
    });

    it('sanitizes descriptions when updating a bounty', async () => {
      const existing = createBounty();
      repository.findOne!.mockResolvedValueOnce(existing);
      repository.save!.mockImplementationOnce(async (input) => input);

      const result = await service.update('bounty-1', {
        description: '![x](data:image/svg+xml,<svg></svg>) Keep **markdown**',
      }, OWNER_ADDRESS);

      expect(result.description).toBe('x Keep **markdown**');
    });

    it('throws ForbiddenException when caller is not the bounty owner', async () => {
      const existing = createBounty();
      repository.findOne!.mockResolvedValueOnce(existing);

      await expect(
        service.update('bounty-1', { title: 'Hacked title' }, NON_OWNER_ADDRESS),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing bounty', async () => {
      const bounty = createBounty();
      repository.findOne!.mockResolvedValueOnce(bounty);
      repository.softRemove!.mockResolvedValueOnce(bounty);

      await expect(service.remove('bounty-1', OWNER_ADDRESS)).resolves.toEqual({ deleted: true });
      expect(repository.softRemove).toHaveBeenCalledWith(bounty);
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when removing a missing bounty', async () => {
      repository.findOne!.mockResolvedValueOnce(null);

      await expect(service.remove('missing', OWNER_ADDRESS)).rejects.toThrow(NotFoundException);
      expect(repository.softRemove).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller is not the bounty owner', async () => {
      const bounty = createBounty();
      repository.findOne!.mockResolvedValueOnce(bounty);

      await expect(service.remove('bounty-1', NON_OWNER_ADDRESS)).rejects.toThrow(ForbiddenException);
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

      await expect(service.restore('bounty-1', OWNER_ADDRESS)).resolves.toBe(restored);
      expect(repository.restore).toHaveBeenCalledWith('bounty-1');
    });

    it('returns the bounty unchanged when it is not soft-deleted', async () => {
      const existing = createBounty({ deletedAt: null });
      repository.findOne!.mockResolvedValueOnce(existing);

      await expect(service.restore('bounty-1', OWNER_ADDRESS)).resolves.toBe(existing);
      expect(repository.restore).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when restoring a missing bounty', async () => {
      repository.findOne!.mockResolvedValueOnce(null);

      await expect(service.restore('missing', OWNER_ADDRESS)).rejects.toThrow(NotFoundException);
      expect(repository.restore).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller is not the bounty owner', async () => {
      const deleted = createBounty({ deletedAt: new Date() });
      repository.findOne!.mockResolvedValueOnce(deleted);

      await expect(service.restore('bounty-1', NON_OWNER_ADDRESS)).rejects.toThrow(ForbiddenException);
      expect(repository.restore).not.toHaveBeenCalled();
    });
  });

  describe('re-initialization protection', () => {
    it('should not create duplicate bounty with same id', async () => {
      const existing = createBounty({ id: 'bounty-1' });
      repository.findOne!.mockResolvedValueOnce(existing);

      await service.create({
        title: 'Duplicate bounty',
        description: 'Should not be created',
        rewardAmount: '5000000',
        ownerAddress: OWNER_ADDRESS,
      }, OWNER_ADDRESS);

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should allow creation when no bounty exists with same id', async () => {
      repository.findOne!.mockResolvedValueOnce(null);
      const newBounty = createBounty({ id: 'bounty-2' });
      repository.create!.mockReturnValueOnce(newBounty);
      repository.save!.mockResolvedValueOnce(newBounty);

      await service.create({
        title: 'New bounty',
        description: 'Fresh creation',
        rewardAmount: '10000000',
        ownerAddress: OWNER_ADDRESS,
      }, OWNER_ADDRESS);

      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });
  });
});
