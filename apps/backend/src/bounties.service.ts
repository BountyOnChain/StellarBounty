import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { Bounty } from './entities/bounty.entity';

type FindAllOptions = {
  page?: string;
  limit?: string;
};

function normalizePositiveInteger(value: string | undefined, fallback: number, max?: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;

  return max ? Math.min(normalized, max) : normalized;
}

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

  async findAll(options: FindAllOptions = {}) {
    const page = normalizePositiveInteger(options.page, 1);
    const pageSize = normalizePositiveInteger(options.limit, 20, 100);
    const [data, total] = await this.bounties.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        next: page < totalPages ? `/bounties?page=${page + 1}&limit=${pageSize}` : null,
        prev: page > 1 ? `/bounties?page=${page - 1}&limit=${pageSize}` : null,
      },
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
}
