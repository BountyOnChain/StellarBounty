import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    verify: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    revokeAll: jest.Mock;
  };
  let response: Pick<Response, 'cookie' | 'clearCookie'>;

  beforeEach(() => {
    authService = {
      verify: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      revokeAll: jest.fn(),
    };
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Pick<Response, 'cookie' | 'clearCookie'>;
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('sets an httpOnly refresh cookie after verification', async () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    authService.verify.mockResolvedValue(tokens);

    await expect(
      controller.verify(
        { address: 'G'.padEnd(56, 'A'), signature: 'sig', nonce: 'nonce' },
        response as Response,
      ),
    ).resolves.toBe(tokens);

    expect(response.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/auth',
      }),
    );
  });

  it('sets a rotated refresh cookie after refresh', async () => {
    const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
    authService.refresh.mockResolvedValue(tokens);

    await expect(
      controller.refresh({ refreshToken: 'old-refresh' }, response as Response),
    ).resolves.toBe(tokens);

    expect(authService.refresh).toHaveBeenCalledWith('old-refresh');
    expect(response.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'new-refresh',
      expect.objectContaining({ httpOnly: true, path: '/auth' }),
    );
  });

  it('clears the refresh cookie after logout', async () => {
    authService.logout.mockResolvedValue({ revoked: true });

    await expect(
      controller.logout({ refreshToken: 'refresh' }, response as Response),
    ).resolves.toEqual({ revoked: true });

    expect(authService.logout).toHaveBeenCalledWith('refresh');
    expect(response.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/auth' });
  });

  it('revokes all sessions for the authenticated address', async () => {
    authService.revokeAll.mockResolvedValue({ revoked: 3 });

    await expect(controller.revokeAll({ user: { address: 'GOWNER' } } as any)).resolves.toEqual({
      revoked: 3,
    });

    expect(authService.revokeAll).toHaveBeenCalledWith('GOWNER');
  });
});
