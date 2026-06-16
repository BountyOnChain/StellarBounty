import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { Nonce } from '../entities/nonce.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  private readonly NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly ACCESS_TOKEN_EXPIRES_IN = '15m';

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Nonce)
    private readonly nonceRepository: Repository<Nonce>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
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

  async verify(address: string, signature: string, nonce: string): Promise<AuthTokens> {
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
    return this.issueTokenPair(address);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    await this.pruneExpired();
    const stored = await this.findActiveRefreshToken(refreshToken);
    stored.revokedAt = new Date();
    await this.refreshTokenRepository.save(stored);

    return this.issueTokenPair(stored.address);
  }

  async logout(refreshToken: string): Promise<{ revoked: boolean }> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const stored = await this.refreshTokenRepository.findOne({ where: { tokenHash } });

    if (!stored || stored.revokedAt) {
      return { revoked: false };
    }

    stored.revokedAt = new Date();
    await this.refreshTokenRepository.save(stored);
    return { revoked: true };
  }

  async revokeAll(address: string): Promise<{ revoked: number }> {
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('address = :address', { address })
      .andWhere('"revokedAt" IS NULL')
      .execute();

    return { revoked: result.affected ?? 0 };
  }

  private async pruneExpired(): Promise<void> {
    const now = new Date();
    await this.nonceRepository
      .createQueryBuilder()
      .delete()
      .from(Nonce)
      .where('expiresAt < :now', { now })
      .execute();

    await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('"expiresAt" < :now', { now })
      .execute();
  }

  private async issueTokenPair(address: string): Promise<AuthTokens> {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_TTL_MS);

    const refreshTokenEntity = this.refreshTokenRepository.create({
      address,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });
    await this.refreshTokenRepository.save(refreshTokenEntity);

    const accessToken = this.jwtService.sign(
      { sub: address },
      { expiresIn: this.ACCESS_TOKEN_EXPIRES_IN },
    );
    return { accessToken, refreshToken };
  }

  private async findActiveRefreshToken(refreshToken: string): Promise<RefreshToken> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const stored = await this.refreshTokenRepository.findOne({ where: { tokenHash } });

    if (!stored || stored.revokedAt || Date.now() > stored.expiresAt.getTime()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return stored;
  }

  private hashRefreshToken(refreshToken: string): string {
    return crypto.createHash('sha256').update(refreshToken).digest('hex');
  }
}
