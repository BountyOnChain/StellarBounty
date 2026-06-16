import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let nonceRepository: any;
  let refreshTokenRepository: any;
  let refreshStore: Map<string, any>;

  function hashRefreshToken(refreshToken: string): string {
    return crypto.createHash('sha256').update(refreshToken).digest('hex');
  }

  beforeEach(() => {
    jwtService = { sign: jest.fn().mockReturnValue('mock.jwt.token') } as any;

    const mockStore = new Map<string, any>();
    refreshStore = new Map<string, any>();
    nonceRepository = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockStore.get(where.address) || null);
      }),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((entity) => {
        mockStore.set(entity.address, entity);
        return Promise.resolve(entity);
      }),
      delete: jest.fn().mockImplementation(({ address }) => {
        mockStore.delete(address);
        return Promise.resolve();
      }),
      createQueryBuilder: jest.fn().mockReturnThis(),
      deleteQuery: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    // Make queryBuilder mock chain work
    nonceRepository.deleteBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    nonceRepository.createQueryBuilder = jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnValue(nonceRepository.deleteBuilder),
    });

    refreshTokenRepository = {
      create: jest.fn().mockImplementation((data) => ({
        id: `refresh-${refreshStore.size + 1}`,
        createdAt: new Date(),
        ...data,
      })),
      save: jest.fn().mockImplementation((entity) => {
        refreshStore.set(entity.tokenHash, entity);
        return Promise.resolve(entity);
      }),
      findOne: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(refreshStore.get(where.tokenHash) || null);
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      }),
    };

    service = new AuthService(jwtService, nonceRepository, refreshTokenRepository);
  });

  describe('getChallenge', () => {
    it('returns a hex nonce for the given address', async () => {
      const result = await service.getChallenge('GABC');
      expect(result.nonce).toMatch(/^[0-9a-f]{64}$/);
    });

    it('overwrites previous nonce for the same address', async () => {
      const first = await service.getChallenge('GABC');
      const second = await service.getChallenge('GABC');
      expect(first.nonce).not.toBe(second.nonce);
    });
  });

  describe('verify', () => {
    it('returns an accessToken and refreshToken on valid signature', async () => {
      const keypair = StellarSdk.Keypair.random();
      const address = keypair.publicKey();

      const { nonce } = await service.getChallenge(address);
      const signatureBytes = keypair.sign(Buffer.from(nonce));
      const signature = Buffer.from(signatureBytes).toString('base64');

      const result = await service.verify(address, signature, nonce);
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.refreshToken.length).toBeGreaterThan(40);
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: address }, { expiresIn: '15m' });

      const storedHash = hashRefreshToken(result.refreshToken);
      expect(refreshStore.get(storedHash)).toMatchObject({
        address,
        tokenHash: storedHash,
        revokedAt: null,
      });
      expect(refreshStore.has(result.refreshToken)).toBe(false);
    });

    it('throws UnauthorizedException for wrong nonce', async () => {
      const keypair = StellarSdk.Keypair.random();
      const address = keypair.publicKey();
      await service.getChallenge(address);

      const wrongNonce = 'deadbeef';
      const sig = Buffer.from(keypair.sign(Buffer.from(wrongNonce))).toString('base64');

      await expect(service.verify(address, sig, wrongNonce)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for invalid signature', async () => {
      const keypair = StellarSdk.Keypair.random();
      const address = keypair.publicKey();
      const { nonce } = await service.getChallenge(address);

      const badSig = Buffer.alloc(64).toString('base64');
      await expect(service.verify(address, badSig, nonce)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when nonce is not found', async () => {
      const keypair = StellarSdk.Keypair.random();
      const address = keypair.publicKey();
      const nonce = 'nonexistent';
      const sig = Buffer.from(keypair.sign(Buffer.from(nonce))).toString('base64');

      await expect(service.verify(address, sig, nonce)).rejects.toThrow(UnauthorizedException);
    });

    it('invalidates nonce after successful verification (replay protection)', async () => {
      const keypair = StellarSdk.Keypair.random();
      const address = keypair.publicKey();
      const { nonce } = await service.getChallenge(address);
      const sig = Buffer.from(keypair.sign(Buffer.from(nonce))).toString('base64');

      await service.verify(address, sig, nonce);
      // Second call with same nonce should fail
      await expect(service.verify(address, sig, nonce)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates refresh tokens and invalidates the previous token', async () => {
      const keypair = StellarSdk.Keypair.random();
      const address = keypair.publicKey();
      const { nonce } = await service.getChallenge(address);
      const signature = Buffer.from(keypair.sign(Buffer.from(nonce))).toString('base64');
      const first = await service.verify(address, signature, nonce);

      const second = await service.refresh(first.refreshToken);

      expect(second.accessToken).toBe('mock.jwt.token');
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(refreshStore.get(hashRefreshToken(first.refreshToken)).revokedAt).toBeInstanceOf(Date);
      expect(refreshStore.get(hashRefreshToken(second.refreshToken))).toMatchObject({
        address,
        revokedAt: null,
      });
    });

    it('rejects refresh token replay after rotation', async () => {
      const keypair = StellarSdk.Keypair.random();
      const address = keypair.publicKey();
      const { nonce } = await service.getChallenge(address);
      const signature = Buffer.from(keypair.sign(Buffer.from(nonce))).toString('base64');
      const first = await service.verify(address, signature, nonce);

      await service.refresh(first.refreshToken);

      await expect(service.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects unknown refresh tokens', async () => {
      await expect(service.refresh('missing-refresh-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the current refresh token', async () => {
      const keypair = StellarSdk.Keypair.random();
      const address = keypair.publicKey();
      const { nonce } = await service.getChallenge(address);
      const signature = Buffer.from(keypair.sign(Buffer.from(nonce))).toString('base64');
      const tokens = await service.verify(address, signature, nonce);

      await expect(service.logout(tokens.refreshToken)).resolves.toEqual({ revoked: true });
      expect(refreshStore.get(hashRefreshToken(tokens.refreshToken)).revokedAt).toBeInstanceOf(
        Date,
      );
      await expect(service.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('is idempotent for missing tokens', async () => {
      await expect(service.logout('missing-refresh-token')).resolves.toEqual({ revoked: false });
    });
  });

  describe('revokeAll', () => {
    it('marks active sessions for an address as revoked', async () => {
      await expect(service.revokeAll('GABC')).resolves.toEqual({ revoked: 2 });
      const builder = refreshTokenRepository.createQueryBuilder.mock.results[0].value;
      expect(builder.update).toHaveBeenCalled();
      expect(builder.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
      expect(builder.where).toHaveBeenCalledWith('address = :address', { address: 'GABC' });
      expect(builder.andWhere).toHaveBeenCalledWith('"revokedAt" IS NULL');
    });
  });
});
