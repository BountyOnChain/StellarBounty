import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { AuditService } from './audit/audit.service';
import { Bounty } from './entities/bounty.entity';

@Injectable()
export class BountiesService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateBountyDto) {
    const bounty = this.bounties.create({
      ...dto,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
    });
    const saved = await this.bounties.save(bounty);
    await this.audit.log(saved.ownerAddress, 'bounty.create', 'bounty', saved.id, {
      status: saved.status,
      rewardAmount: saved.rewardAmount,
    });
    return saved;
  }

  async findAll() {
    return this.bounties.find({ order: { createdAt: 'DESC' } });
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
    const saved = await this.bounties.save(bounty);
    await this.audit.log(saved.ownerAddress, 'bounty.update', 'bounty', saved.id, {
      fields: Object.keys(dto),
      status: saved.status,
    });
    return saved;
  }

  async remove(id: string) {
    const bounty = await this.findOne(id);
    await this.bounties.remove(bounty);
    await this.audit.log(bounty.ownerAddress, 'bounty.delete', 'bounty', bounty.id, {
      status: bounty.status,
    });
    return { deleted: true };
  }
}
