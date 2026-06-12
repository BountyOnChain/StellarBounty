import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { ListBountiesQueryDto } from './bounties/dto/list-bounties-query.dto';
import { Bounty, BountyCategory } from './entities/bounty.entity';
import { Tag } from './entities/tag.entity';

@Injectable()
export class BountiesService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
    @InjectRepository(Tag)
    private readonly tags: Repository<Tag>,
  ) {}

  async create(dto: CreateBountyDto) {
    const bounty = this.bounties.create({
      ...dto,
      category: dto.category ?? BountyCategory.DEVELOPMENT,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
      tags: await this.resolveTags(dto.tags),
    });
    return this.bounties.save(bounty);
  }

  async findAll(query: ListBountiesQueryDto = {}) {
    const builder = this.bounties
      .createQueryBuilder('bounty')
      .leftJoinAndSelect('bounty.tags', 'tag')
      .orderBy('bounty.createdAt', 'DESC');

    if (query.category) {
      builder.andWhere('bounty.category = :category', { category: query.category });
    }

    if (query.tag) {
      builder.andWhere(
        `EXISTS (
          SELECT 1
          FROM bounties_tags bt
          INNER JOIN tags filter_tag ON filter_tag.id = bt."tagId"
          WHERE bt."bountyId" = bounty.id
          AND filter_tag.name = :tag
        )`,
        { tag: query.tag },
      );
    }

    return builder.getMany();
  }

  async findOne(id: string) {
    const bounty = await this.bounties.findOne({ where: { id }, relations: { tags: true } });
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
    if (dto.tags !== undefined) {
      bounty.tags = await this.resolveTags(dto.tags);
    }
    return this.bounties.save(bounty);
  }

  async remove(id: string) {
    const bounty = await this.findOne(id);
    await this.bounties.remove(bounty);
    return { deleted: true };
  }

  private async resolveTags(tagNames: string[] | undefined): Promise<Tag[]> {
    const normalized = [...new Set((tagNames ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
    return Promise.all(
      normalized.map(async (name) => {
        const existing = await this.tags.findOne({ where: { name } });
        return existing ?? this.tags.create({ name });
      }),
    );
  }
}
