import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async create(dto: CreateBountyDto) {
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
    return this.bounties.save(bounty);
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

  async update(id: string, dto: UpdateBountyDto) {
    const bounty = await this.findOne(id);
    Object.assign(bounty, {
      ...dto,
      description: dto.description === undefined ? bounty.description : sanitizeDescription(dto.description),
      rewardAmount: dto.rewardAmount !== undefined ? BigInt(dto.rewardAmount) : bounty.rewardAmount,
      deadline: dto.deadline === undefined ? bounty.deadline : new Date(dto.deadline),
    });
    return this.bounties.save(bounty);
  }

  async remove(id: string) {
    const bounty = await this.findOne(id);
    await this.bounties.softRemove(bounty);
    return { deleted: true };
  }

  async restore(id: string) {
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
    return this.findOne(id);
  }
}
