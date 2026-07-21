import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
import { SavedBounty } from './entities/saved-bounty.entity';

@Injectable()
export class BountiesService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
    @InjectRepository(SavedBounty)
    private readonly savedBounties: Repository<SavedBounty>,
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
   * List bounties with server-side pagination and filters (owner, contributor, status).
   * Supports both offset-based (page/limit) and cursor-based (cursor/limit) pagination.
   */
  async findAll(
    pagination: PaginationQueryDto = {},
  ): Promise<PaginatedResponse<Bounty>> {
    const { limit = 20, owner, contributor, status, cursor } = pagination;

    const buildWhere = (qb: any) => {
      if (owner) {
        qb.andWhere('bounty.ownerAddress = :owner', { owner });
      }
      if (status) {
        qb.andWhere('bounty.status = :status', { status });
      }
      if (contributor) {
        qb.innerJoin('bounty.submissions', 'submission', 'submission.contributorAddress = :contributor', { contributor });
      }
    };

    // Count total (always the full count for the given filters)
    const countQb = this.bounties.createQueryBuilder('bounty');
    buildWhere(countQb);
    const total = await countQb.getCount();

    // Fetch page data
    const dataQb = this.bounties.createQueryBuilder('bounty');
    buildWhere(dataQb);
    dataQb.orderBy('bounty.createdAt', 'DESC');

    if (cursor) {
      dataQb.andWhere('bounty.createdAt < (SELECT "createdAt" FROM bounties WHERE id = :cursor)', { cursor });
    }

    // Fetch one extra to detect if there is a next page
    const data = await dataQb.take(limit + 1).getMany();
    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;

    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;
    const page = cursor ? undefined : (pagination.page ?? 1);

    return PaginatedResponse.of(items, total, page, limit, nextCursor);
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

  async saveBounty(address: string, bountyId: string) {
    const bounty = await this.bounties.findOne({ where: { id: bountyId } });
    if (!bounty) throw new NotFoundException('Bounty not found');

    const existing = await this.savedBounties.findOne({ where: { address, bountyId } });
    if (existing) return existing;

    try {
      const saved = this.savedBounties.create({ address, bountyId });
      return await this.savedBounties.save(saved);
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('Bounty already saved');
      }
      throw err;
    }
  }

  async unsaveBounty(address: string, bountyId: string) {
    const saved = await this.savedBounties.findOne({ where: { address, bountyId } });
    if (!saved) throw new NotFoundException('Saved bounty not found');
    await this.savedBounties.remove(saved);
    return { deleted: true };
  }
      }
