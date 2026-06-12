import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { BountySort, ListBountiesQueryDto } from './bounties/dto/list-bounties-query.dto';
import { Bounty } from './entities/bounty.entity';

@Injectable()
export class BountiesService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
  ) {}

  async create(dto: CreateBountyDto) {
    const bounty = this.bounties.create({
      ...dto,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
    });
    return this.bounties.save(bounty);
  }

  async findAll(query: ListBountiesQueryDto = {}) {
    const search = query.search?.trim();
    const builder = this.bounties.createQueryBuilder('bounty');

    if (query.status) {
      builder.andWhere('bounty.status = :status', { status: query.status });
    }

    if (search) {
      builder
        .addSelect(
          `ts_rank_cd(
            to_tsvector('english', coalesce(bounty.title, '') || ' ' || coalesce(bounty.description, '')),
            plainto_tsquery('english', :search)
          )`,
          'search_rank',
        )
        .andWhere(
          `to_tsvector('english', coalesce(bounty.title, '') || ' ' || coalesce(bounty.description, ''))
            @@ plainto_tsquery('english', :search)`,
          { search },
        );
    }

    if (search && (!query.sort || query.sort === BountySort.RELEVANCE)) {
      builder.orderBy('search_rank', 'DESC').addOrderBy('bounty.createdAt', 'DESC');
    } else if (query.sort === BountySort.HIGHEST_REWARD) {
      builder.orderBy('bounty.rewardAmount', 'DESC').addOrderBy('bounty.createdAt', 'DESC');
    } else if (query.sort === BountySort.CLOSEST_DEADLINE) {
      builder
        .orderBy('bounty.deadline', 'ASC', 'NULLS LAST')
        .addOrderBy('bounty.createdAt', 'DESC');
    } else {
      builder.orderBy('bounty.createdAt', 'DESC');
    }

    return builder.getMany();
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
      deadline: dto.deadline === undefined ? bounty.deadline : new Date(dto.deadline),
    });
    return this.bounties.save(bounty);
  }

  async remove(id: string) {
    const bounty = await this.findOne(id);
    await this.bounties.remove(bounty);
    return { deleted: true };
  }
}
