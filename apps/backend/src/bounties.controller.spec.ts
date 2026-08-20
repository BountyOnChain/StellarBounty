import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BountiesController } from './bounties.controller';
import { BountiesService } from './bounties.service';
import { BountyStatus } from './entities/bounty.entity';

const OWNER_ADDRESS = 'GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX';
const NON_OWNER_ADDRESS = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function makeBounty(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bounty-1',
    title: 'Build a Stellar integration',
    description: 'Create a working Stellar integration with tests.',
    rewardAmount: 10000000n,
    deadline: new Date('2026-12-31T00:00:00.000Z'),
    status: BountyStatus.OPEN,
    ownerAddress: OWNER_ADDRESS,
    submissions: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('BountiesController', () => {
  let controller: BountiesController;
  let service: {
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    restore: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    saveBounty: jest.Mock;
    unsaveBounty: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      restore: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      saveBounty: jest.fn(),
      unsaveBounty: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [BountiesController],
      providers: [
        { provide: BountiesService, useValue: service },
      ],
    }).compile();

    controller = moduleRef.get(BountiesController);
  });

  describe('update', () => {
    it('returns 403 when the caller is not the bounty owner', async () => {
      service.update.mockRejectedValue(new ForbiddenException('Not the bounty owner'));

      await expect(
        controller.update('bounty-1', { title: 'Hacked' } as any, { user: { address: NON_OWNER_ADDRESS } }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('passes req.user.address to the service', async () => {
      const bounty = makeBounty();
      service.update.mockResolvedValue(bounty);

      await controller.update('bounty-1', { title: 'Updated' } as any, { user: { address: OWNER_ADDRESS } });

      expect(service.update).toHaveBeenCalledWith('bounty-1', { title: 'Updated' }, OWNER_ADDRESS);
    });
  });

  describe('remove', () => {
    it('returns 404 when the caller is not the bounty owner (existence leak prevention)', async () => {
      service.remove.mockRejectedValue(new ForbiddenException('Not the bounty owner'));

      await expect(
        controller.remove('bounty-1', { user: { address: NON_OWNER_ADDRESS } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 when the bounty does not exist', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Bounty not found'));

      await expect(
        controller.remove('missing', { user: { address: OWNER_ADDRESS } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('passes req.user.address to the service', async () => {
      service.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove('bounty-1', { user: { address: OWNER_ADDRESS } });

      expect(service.remove).toHaveBeenCalledWith('bounty-1', OWNER_ADDRESS);
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('restore', () => {
    it('returns 404 when the caller is not the bounty owner (existence leak prevention)', async () => {
      service.restore.mockRejectedValue(new ForbiddenException('Not the bounty owner'));

      await expect(
        controller.restore('bounty-1', { user: { address: NON_OWNER_ADDRESS } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 when the bounty does not exist', async () => {
      service.restore.mockRejectedValue(new NotFoundException('Bounty not found'));

      await expect(
        controller.restore('missing', { user: { address: OWNER_ADDRESS } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('passes req.user.address to the service', async () => {
      const bounty = makeBounty();
      service.restore.mockResolvedValue(bounty);

      const result = await controller.restore('bounty-1', { user: { address: OWNER_ADDRESS } });

      expect(service.restore).toHaveBeenCalledWith('bounty-1', OWNER_ADDRESS);
      expect(result).toBe(bounty);
    });
  });

  describe('create', () => {
    it('passes req.user.address to the service', async () => {
      const bounty = makeBounty();
      service.create.mockResolvedValue(bounty);

      const dto = {
        title: 'Build a Stellar integration',
        description: 'Create a working Stellar integration with tests.',
        rewardAmount: '10000000',
        ownerAddress: OWNER_ADDRESS,
      };
      const result = await controller.create(dto as any, { user: { address: OWNER_ADDRESS } });

      expect(service.create).toHaveBeenCalledWith(dto, OWNER_ADDRESS);
      expect(result).toBe(bounty);
    });

    it('returns 403 when ownerAddress does not match JWT subject', async () => {
      service.create.mockRejectedValue(
        new ForbiddenException('ownerAddress must match the authenticated user'),
      );

      const dto = {
        title: 'Build a Stellar integration',
        description: 'Create a working Stellar integration with tests.',
        rewardAmount: '10000000',
        ownerAddress: OWNER_ADDRESS,
      };

      await expect(
        controller.create(dto as any, { user: { address: NON_OWNER_ADDRESS } }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
