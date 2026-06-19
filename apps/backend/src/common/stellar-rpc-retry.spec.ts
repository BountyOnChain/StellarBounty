import { isRetryableStellarRpcError, withStellarRpcRetry } from './stellar-rpc-retry';

describe('withStellarRpcRetry', () => {
  it('retries retryable RPC failures with exponential backoff and jitter', async () => {
    const rpcCall = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('socket timeout'), { code: 'ETIMEDOUT' }))
      .mockRejectedValueOnce({ status: 503, message: 'unavailable' })
      .mockResolvedValueOnce('ok');
    const sleep = jest.fn(async () => undefined);
    const logger = { warn: jest.fn() };
    const onFailure = jest.fn();
    const onRetry = jest.fn();

    await expect(
      withStellarRpcRetry('prepareTransaction', rpcCall, {
        sleep,
        logger,
        onFailure,
        onRetry,
        random: () => 0.5,
      }),
    ).resolves.toBe('ok');

    expect(rpcCall).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('fails immediately for non-retryable RPC errors', async () => {
    const error = { status: 400, message: 'bad request' };
    const rpcCall = jest.fn().mockRejectedValue(error);
    const sleep = jest.fn(async () => undefined);

    await expect(withStellarRpcRetry('sendTransaction', rpcCall, { sleep })).rejects.toBe(error);

    expect(rpcCall).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('fails after exhausting all retry attempts', async () => {
    const error = Object.assign(new Error('fetch failed'), { code: 'ECONNRESET' });
    const rpcCall = jest.fn().mockRejectedValue(error);
    const sleep = jest.fn(async () => undefined);

    await expect(
      withStellarRpcRetry('getAccount', rpcCall, {
        maxRetries: 3,
        sleep,
        random: () => 0.5,
      }),
    ).rejects.toBe(error);

    expect(rpcCall).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
    expect(sleep).toHaveBeenNthCalledWith(3, 4000);
  });
});

describe('isRetryableStellarRpcError', () => {
  it('classifies retryable and non-retryable failures', () => {
    expect(isRetryableStellarRpcError({ status: 502 })).toBe(true);
    expect(isRetryableStellarRpcError({ response: { status: 503 } })).toBe(true);
    expect(isRetryableStellarRpcError(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))).toBe(true);
    expect(isRetryableStellarRpcError({ status: 404 })).toBe(false);
    expect(isRetryableStellarRpcError(new Error('invalid transaction'))).toBe(false);
  });
});
