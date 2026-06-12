import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { Bounty } from './entities/bounty.entity';

export type PaginatedBounties = {
  data: Bounty[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

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

  async findAll(pageInput?: string, limitInput?: string): Promise<PaginatedBounties> {
    const page = this.normalizePositiveInteger(pageInput, 1);
    const limit = Math.min(this.normalizePositiveInteger(limitInput, 20), 100);
    const [data, total] = await this.bounties.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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

  private normalizePositiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
