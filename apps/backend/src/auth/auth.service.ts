import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { Nonce } from '../entities/nonce.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

@Injectable()
export class AuthService {
  private readonly NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Nonce)
    private readonly nonceRepository: Repository<Nonce>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
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

  async verify(
    address: string,
    signature: string,
    nonce: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
    const refreshToken = await this.createRefreshToken(address);

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      // Token reuse detected — revoke all tokens for this address
      await this.revokeAllForUser(stored.address);
      throw new UnauthorizedException('Refresh token reuse detected. All sessions revoked.');
    }

    if (Date.now() > stored.expiresAt.getTime()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: revoke old token, issue new one
    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);

    const accessToken = this.jwtService.sign({ sub: stored.address });
    const newRefreshToken = await this.createRefreshToken(stored.address);

    // Link old token to new one for audit trail
    const newHash = this.hashToken(newRefreshToken);
    const newStored = await this.refreshTokenRepo.findOne({ where: { tokenHash: newHash } });
    if (newStored) {
      newStored.replacedByTokenId = newStored.id;
      await this.refreshTokenRepo.save(newStored);
    }

    return { accessToken, refreshToken: newRefreshToken };
  }

  async revokeAllForUser(address: string): Promise<void> {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('address = :address AND revokedAt IS NULL', { address })
      .execute();
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
  }

  private async createRefreshToken(address: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const entity = this.refreshTokenRepo.create({
      address,
      tokenHash,
      expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
    });
    await this.refreshTokenRepo.save(entity);

    return token;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
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
