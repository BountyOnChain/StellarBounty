import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit/audit.service';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { sanitizeDescription } from './common/sanitize-description';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toSkip,
} from './common/pagination.dto';
import { Bounty } from './entities/bounty.entity';

@Injectable()
export class BountiesService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateBountyDto, actorAddress = dto.ownerAddress) {
    // Re-initialization protection: check if bounty with same title already exists
    const existing = await this.bounties.findOne({ where: { title: dto.title } });
    if (existing) {
      return existing;
    }

    const bounty = this.bounties.create({
      ...dto,
      description: sanitizeDescription(dto.description),
      rewardAmount: BigInt(dto.rewardAmount),
      deadline: dto.deadline ? new Date(dto.deadline) : null,
    });
    const saved = await this.bounties.save(bounty);
    await this.audit.log({
      address: actorAddress,
      action: 'bounty.create',
      resourceType: 'bounty',
      resourceId: saved.id,
      metadata: {
        ownerAddress: saved.ownerAddress,
        rewardAmount: saved.rewardAmount.toString(),
      },
    });
    return saved;
  }

  /**
   * List bounties with server-side pagination.
   *
   * Uses `findAndCount` so we can return total metadata without a second
   * query. Backward compatible: when called with no arguments, the response
   * still contains a `data` array (wrapped) but the shape differs from a bare
   * array — controllers that need the bare array should call this with a
   * small helper. The default page size is 20, max 100 (enforced by the
   * PaginationQueryDto via class-validator).
   */
  async findAll(
    pagination: PaginationQueryDto = {},
  ): Promise<PaginatedResponse<Bounty>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [data, total] = await this.bounties.findAndCount({
      order: { createdAt: 'DESC' },
      skip: toSkip(page, limit),
      take: limit,
    });
    return PaginatedResponse.of(data, total, page, limit);
  }

  async findOne(id: string) {
    const bounty = await this.bounties.findOne({ where: { id } });
    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }
    return bounty;
  }

  async update(id: string, dto: UpdateBountyDto, actorAddress?: string) {
    const bounty = await this.findOne(id);
    const changedFields = Object.keys(dto);
    Object.assign(bounty, {
      ...dto,
      description: dto.description === undefined ? bounty.description : sanitizeDescription(dto.description),
      rewardAmount: dto.rewardAmount !== undefined ? BigInt(dto.rewardAmount) : bounty.rewardAmount,
      deadline: dto.deadline === undefined ? bounty.deadline : new Date(dto.deadline),
    });
    const saved = await this.bounties.save(bounty);
    await this.audit.log({
      address: actorAddress ?? bounty.ownerAddress,
      action: 'bounty.update',
      resourceType: 'bounty',
      resourceId: saved.id,
      metadata: { changedFields },
    });
    return saved;
  }

  async remove(id: string, actorAddress?: string) {
    const bounty = await this.findOne(id);
    await this.bounties.softRemove(bounty);
    await this.audit.log({
      address: actorAddress ?? bounty.ownerAddress,
      action: 'bounty.delete',
      resourceType: 'bounty',
      resourceId: bounty.id,
    });
    return { deleted: true };
  }

  async restore(id: string, actorAddress?: string) {
    // softRemove sets deletedAt, restore unsets it
    const bounty = await this.bounties.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }
    if (bounty.deletedAt === null) {
      return bounty;
    }
    await this.bounties.restore(id);
    const restored = await this.findOne(id);
    await this.audit.log({
      address: actorAddress ?? restored.ownerAddress,
      action: 'bounty.restore',
      resourceType: 'bounty',
      resourceId: restored.id,
    });
    return restored;
  }
}
