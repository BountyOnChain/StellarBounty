import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as StellarSdk from '@stellar/stellar-sdk';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let nonceRepository: any;

  beforeEach(() => {
    jwtService = { sign: jest.fn().mockReturnValue('mock.jwt.token') } as any;

    const mockStore = new Map<string, any>();
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

    service = new AuthService(jwtService, nonceRepository);
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
    it('returns an accessToken on valid signature', async () => {
      const keypair = StellarSdk.Keypair.random();
      const address = keypair.publicKey();

      const { nonce } = await service.getChallenge(address);
      const signatureBytes = keypair.sign(Buffer.from(nonce));
      const signature = Buffer.from(signatureBytes).toString('base64');

      const result = await service.verify(address, signature, nonce);
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: address });
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
});
