import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as StellarSdk from '@stellar/stellar-sdk';
import { v4 as uuidv4 } from 'uuid';

interface Challenge {
  nonce: string;
  message: string;
  expiresAt: Date;
}

interface JwtPayload {
  sub: string; // wallet public key
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly challenges = new Map<string, Challenge>();

  // Clean up expired challenges every 5 minutes
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private readonly jwtService: JwtService) {
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  /**
   * Generate a challenge for the user to sign with their Freighter wallet.
   */
  generateChallenge(publicKey: string): { nonce: string; message: string; expiresAt: string } {
    const nonce = uuidv4();
    const message = `StellarBounty Login: ${nonce}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    this.challenges.set(publicKey, { nonce, message, expiresAt });

    return {
      nonce,
      message,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Verify a signed challenge and issue a JWT.
   *
   * The user signs the challenge message with their Stellar private key
   * (via Freighter wallet) and provides the signature + their public key.
   */
  async verifyAndLogin(
    publicKey: string,
    signature: string,
  ): Promise<{ accessToken: string; tokenType: string; expiresIn: number; wallet: string }> {
    const challenge = this.challenges.get(publicKey);

    if (!challenge) {
      throw new UnauthorizedException(
        'No challenge found. Request a challenge first.',
      );
    }

    if (new Date() > challenge.expiresAt) {
      this.challenges.delete(publicKey);
      throw new UnauthorizedException('Challenge has expired. Request a new one.');
    }

    try {
      // Verify the signature using Stellar SDK
      const isValid = this.verifySignature(
        challenge.message,
        signature,
        publicKey,
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid signature.');
      }

      // Clear the used challenge
      this.challenges.delete(publicKey);

      // Issue JWT
      const payload: Partial<JwtPayload> = {
        sub: publicKey,
      };

      const accessToken = this.jwtService.sign(payload);
      const expiresIn = 24 * 60 * 60; // 24 hours in seconds

      return {
        accessToken,
        tokenType: 'Bearer',
        expiresIn,
        wallet: publicKey,
      };
    } catch (error) {
      this.logger.error(`Login verification failed: ${(error as Error).message}`);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Signature verification failed.');
    }
  }

  /**
   * Verify a Stellar signature against the challenge message.
   * Uses Stellar SDK's Keypair to verify the signed payload.
   */
  private verifySignature(
    message: string,
    signature: string,
    publicKey: string,
  ): boolean {
    const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);
    try {
      return keypair.verify(Buffer.from(message, 'utf-8'), Buffer.from(signature, 'base64'));
    } catch {
      this.logger.warn(`Failed to verify signature for public key: ${publicKey}`);
      return false;
    }
  }

  /**
   * Validate a JWT payload (used by JwtStrategy).
   */
  validatePayload(payload: JwtPayload): { wallet: string } {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload.');
    }
    return { wallet: payload.sub };
  }

  private cleanupExpired(): void {
    const now = new Date();
    let count = 0;
    for (const [key, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.challenges.delete(key);
        count++;
      }
    }
    if (count > 0) {
      this.logger.debug(`Cleaned up ${count} expired challenges`);
    }
  }
}
