import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { Nonce } from '../entities/nonce.entity';

@Injectable()
export class AuthService {
  private readonly NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Nonce)
    private readonly nonceRepository: Repository<Nonce>,
  ) {}

  async getChallenge(address: string): Promise<{ nonce: string }> {
    await this.pruneExpired();
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.NONCE_TTL_MS);

    // Upsert nonce
    let nonceEntity = await this.nonceRepository.findOne({ where: { address } });
    if (!nonceEntity) {
      nonceEntity = this.nonceRepository.create({ address, nonce, expiresAt });
    } else {
      nonceEntity.nonce = nonce;
      nonceEntity.expiresAt = expiresAt;
    }
    await this.nonceRepository.save(nonceEntity);

    return { nonce };
  }

  async verify(address: string, signature: string, nonce: string): Promise<{ accessToken: string }> {
    await this.pruneExpired();
    const entry = await this.nonceRepository.findOne({ where: { address } });

    if (!entry || entry.nonce !== nonce || Date.now() > entry.expiresAt.getTime()) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    try {
      const keypair = StellarSdk.Keypair.fromPublicKey(address);
      const messageBytes = Buffer.from(nonce);
      const signatureBytes = Buffer.from(signature, 'base64');
      const valid = keypair.verify(messageBytes, signatureBytes);
      if (!valid) throw new Error('Bad signature');
    } catch {
      throw new UnauthorizedException('Signature verification failed');
    }

    await this.nonceRepository.delete({ address });
    const accessToken = this.jwtService.sign({ sub: address });
    return { accessToken };
  }

  private async pruneExpired(): Promise<void> {
    const now = new Date();
    await this.nonceRepository
      .createQueryBuilder()
      .delete()
      .from(Nonce)
      .where('expiresAt < :now', { now })
      .execute();
  }
}
