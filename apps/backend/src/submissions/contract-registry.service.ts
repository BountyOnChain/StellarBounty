import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BountyContract } from '../entities/bounty-contract.entity';

@Injectable()
export class ContractRegistryService {
  private readonly logger = new Logger(ContractRegistryService.name);

  constructor(
    @InjectRepository(BountyContract)
    private readonly bountyContractRepo: Repository<BountyContract>,
    private readonly config: ConfigService,
  ) {}

  async findContractFor(bountyId: string, network: string): Promise<string | null> {
    const normalizedNetwork = network.toLowerCase();

    const registryEntry = await this.bountyContractRepo.findOne({
      where: { bountyId, network: normalizedNetwork },
    });

    if (registryEntry) {
      this.logger.log(
        `Contract resolved from registry: bountyId=${bountyId}, network=${normalizedNetwork}`,
      );
      return registryEntry.contractId;
    }

    const legacyEnvKey = `SOROBAN_CONTRACT_${bountyId.toUpperCase()}`;
    const legacyContractId = this.config.get<string>(legacyEnvKey);
    if (legacyContractId) {
      this.logger.log(
        `Contract resolved from legacy env var: key=${legacyEnvKey}, network=${normalizedNetwork}`,
      );
      return legacyContractId;
    }

    const globalContractId = this.config.get<string>('SOROBAN_CONTRACT_ID');
    if (globalContractId) {
      this.logger.log(
        `Contract resolved from global fallback env var: network=${normalizedNetwork}`,
      );
      return globalContractId;
    }

    return null;
  }
}
