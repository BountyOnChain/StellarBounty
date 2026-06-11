import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties.dto';
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

  async findAll(page: number = 1, limit: number = 20) {
    const [bounties, total] = await this.bounties.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100),
    });
    const totalPages = Math.ceil(total / limit);
    return {
      data: bounties,
      pagination: {
        total,
        page,
        totalPages,
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