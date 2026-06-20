import { scrubSensitiveData } from './sentry-scrubber';

describe('scrubSensitiveData', () => {
  it('redacts sensitive keys recursively', () => {
    expect(scrubSensitiveData({
      request: {
        headers: {
          authorization: 'Bearer jwt',
          'x-request-id': 'req-123',
        },
        body: {
          signature: 'signed-message',
          nested: {
            refreshToken: 'raw-refresh-token',
            walletAddress: 'GABC',
          },
        },
      },
    })).toEqual({
      request: {
        headers: {
          authorization: '[Filtered]',
          'x-request-id': 'req-123',
        },
        body: {
          signature: '[Filtered]',
          nested: {
            refreshToken: '[Filtered]',
            walletAddress: 'GABC',
          },
        },
      },
    });
  });
});

