import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { Nonce } from '../entities/nonce.entity';

@Injectable()
export class AuthService {

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Nonce)
    private readonly nonceRepository: Repository<Nonce>,
  ) {}

  async getChallenge(address: string): Promise<{ nonce: string }> {
    await this.pruneExpired();
    const nonce = crypto.randomBytes(32).toString('hex');
    const nonceTtlMs = this.configService.get<number>('AUTH_NONCE_TTL_MS', 300000);
    const expiresAt = new Date(Date.now() + nonceTtlMs);

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

  // Session management — token refresh and revocation
  private readonly tokenBlacklist = new Set<string>();

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      if (this.tokenBlacklist.has(refreshToken)) {
        throw new UnauthorizedException('Token has been revoked');
      }
      const accessToken = this.jwtService.sign({ sub: payload.sub });
      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeToken(token: string): Promise<{ revoked: boolean }> {
    this.tokenBlacklist.add(token);
    return { revoked: true };
  }

  isRevoked(token: string): boolean {
    return this.tokenBlacklist.has(token);
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
