import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { BountyFilterDto } from './bounties/dto/filter-bounties.dto';
import { sanitizeDescription } from './common/sanitize-description';
import {
  PaginatedResponse,
  PaginationQueryDto,
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

   * List bounties with server-side filtering, full-text search, and pagination.
   *
   * Query params supported:
   * - q / search: full-text on title+description via Postgres tsvector (plainto_tsquery)
   * - status: exact match
   * - tags: overlap filter (bounty.tags && ARRAY[:tags])
   * - minReward / maxReward: bigint range
   * - sort: newest, oldest, highest_reward, lowest_reward, closest_deadline, farthest_deadline, relevance
   * - page, limit

   * List bounties with server-side pagination and filters (owner, contributor, status).



   * Supports both offset-based (page/limit) and cursor-based (cursor/limit) pagination.

   */
  async findAll(
    filter: BountyFilterDto | PaginationQueryDto = {},
  ): Promise<PaginatedResponse<Bounty>> {


    const pagination = filter as BountyFilterDto;
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    // Normalize query string: q takes precedence, fallback to search for backward compat
    const qRaw = (pagination as BountyFilterDto).q ?? (pagination as BountyFilterDto).search;
    const q = typeof qRaw === 'string' ? qRaw.trim() : undefined;
    const status = (pagination as BountyFilterDto).status;
    const tags = (pagination as BountyFilterDto).tags;
    const minReward = (pagination as BountyFilterDto).minReward;
    const maxReward = (pagination as BountyFilterDto).maxReward;
    const sort = (pagination as BountyFilterDto).sort ?? 'newest';

    const qb: SelectQueryBuilder<Bounty> =
      this.bounties.createQueryBuilder('bounty');

    // Full-text search: use to_tsvector on title || ' ' || description indexed by GIN
    if (q && q.length > 0) {
      // plainto_tsquery is safe for user input and handles phrases like "stellar payment" => 'stellar' & 'payment'
      qb.andWhere(
        `to_tsvector('english', bounty.title || ' ' || bounty.description) @@ plainto_tsquery('english', :q)`,
        { q },
      );
    }

    if (status) {
      qb.andWhere('bounty.status = :status', { status });
    }

    if (tags && tags.length > 0) {
      // tags column is text[] nullable, use overlap operator &&
      // Ensure we pass text[]; Postgres will handle empty/null safely.
      qb.andWhere('bounty.tags && ARRAY[:...tags]::text[]', { tags });
    }

    if (minReward !== undefined) {
      try {
        const min = BigInt(minReward).toString();
        // Cast param to bigint to avoid type mismatch (rewardAmount is BIGINT)
        qb.andWhere('bounty.rewardAmount >= :minReward::bigint', { minReward: min });
      } catch {
        // ignore invalid bigint, validation should have caught it
      }
    }

    if (maxReward !== undefined) {
      try {
        const max = BigInt(maxReward).toString();
        qb.andWhere('bounty.rewardAmount <= :maxReward::bigint', { maxReward: max });
      } catch {
        // ignore
      }
    }

    // Sorting
    // If q is present and sort is relevance, order by ts_rank
    // Otherwise use requested sort; always secondary by createdAt DESC for stability
    if (sort === 'relevance' && q) {
      qb.addSelect(
        `ts_rank(to_tsvector('english', bounty.title || ' ' || bounty.description), plainto_tsquery('english', :qRank))`,
        'rank',
      );
      qb.setParameter('qRank', q);
      qb.orderBy('rank', 'DESC');
      qb.addOrderBy('bounty.createdAt', 'DESC');
    } else if (sort === 'oldest') {
      qb.orderBy('bounty.createdAt', 'ASC');
    } else if (sort === 'highest_reward') {
      qb.orderBy('bounty.rewardAmount', 'DESC');
      qb.addOrderBy('bounty.createdAt', 'DESC');
    } else if (sort === 'lowest_reward') {
      qb.orderBy('bounty.rewardAmount', 'ASC');
      qb.addOrderBy('bounty.createdAt', 'DESC');
    } else if (sort === 'closest_deadline') {
      qb.orderBy('bounty.deadline', 'ASC', 'NULLS LAST');
      qb.addOrderBy('bounty.createdAt', 'DESC');
    } else if (sort === 'farthest_deadline') {
      qb.orderBy('bounty.deadline', 'DESC', 'NULLS LAST');
      qb.addOrderBy('bounty.createdAt', 'DESC');
    } else {
      // newest (default)
      qb.orderBy('bounty.createdAt', 'DESC');
    }

    // When we have a rank select, we also want to ensure we still order correctly if user asked for other sort but also has q.
    // For non-relevance sorts with q present, we optionally boost relevance as secondary? Keep simple: primary is sort, secondary rank if q present.
    // To keep deterministic, if q present and sort !== relevance, also order by rank secondarily for better relevance within same sort bucket.
    if (q && sort !== 'relevance' && sort !== 'newest' && sort !== 'oldest') {
      // we already added primary sort; if we haven't added rank select yet, add it for tie-breaker
      qb.addSelect(
        `ts_rank(to_tsvector('english', bounty.title || ' ' || bounty.description), plainto_tsquery('english', :qRank2))`,
        'rank_secondary',
      );
      qb.setParameter('qRank2', q);
      qb.addOrderBy('rank_secondary', 'DESC');
    }

    qb.skip(toSkip(page, limit)).take(limit);

    const [data, total] = await qb.getManyAndCount();

    const { page = 1, limit = 20, owner, contributor, status } = pagination;

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



    return PaginatedResponse.of(data, total, page, limit);

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
