import { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('delivers subscribed events with HMAC signature headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;
    const service = new WebhookService(
      new ConfigService({
        WEBHOOK_SUBSCRIPTIONS_JSON: JSON.stringify([
          {
            url: 'https://example.com/webhook',
            events: ['bounty.created'],
            secret: 'secret',
          },
        ]),
      }),
    );

    await expect(service.publish('bounty.created', { bountyId: 'bounty-1' })).resolves.toEqual({
      delivered: 1,
      failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-stellar-bounty-event': 'bounty.created',
          'x-stellar-bounty-signature': expect.stringMatching(/^sha256=[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it('retries failed deliveries with exponential backoff', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    global.fetch = fetchMock;
    const service = new WebhookService(
      new ConfigService({
        WEBHOOK_SUBSCRIPTIONS_JSON: JSON.stringify([
          {
            url: 'https://example.com/webhook',
            events: ['submission.approved'],
          },
        ]),
        WEBHOOK_DELIVERY_BASE_DELAY_MS: 100,
      }),
    );

    const delivery = service.publish('submission.approved', { submissionId: 'sub-1' });
    await jest.advanceTimersByTimeAsync(100);

    await expect(delivery).resolves.toEqual({ delivered: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores unsubscribed events', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const service = new WebhookService(
      new ConfigService({
        WEBHOOK_SUBSCRIPTIONS_JSON: JSON.stringify([
          {
            url: 'https://example.com/webhook',
            events: ['bounty.completed'],
          },
        ]),
      }),
    );

    await expect(service.publish('bounty.created', { bountyId: 'bounty-1' })).resolves.toEqual({
      delivered: 0,
      failed: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits deliveries to the same endpoint', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;
    const service = new WebhookService(
      new ConfigService({
        WEBHOOK_SUBSCRIPTIONS_JSON: JSON.stringify([
          {
            url: 'https://example.com/webhook',
            events: ['bounty.created'],
          },
        ]),
        WEBHOOK_ENDPOINT_MIN_INTERVAL_MS: 100,
      }),
    );

    const first = service.publish('bounty.created', { bountyId: 'bounty-1' });
    const second = service.publish('bounty.created', { bountyId: 'bounty-2' });
    await jest.advanceTimersByTimeAsync(0);
    await expect(first).resolves.toEqual({ delivered: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(100);
    await expect(second).resolves.toEqual({ delivered: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects non-HTTPS webhook URLs', () => {
    const service = new WebhookService(
      new ConfigService({
        WEBHOOK_SUBSCRIPTIONS_JSON: JSON.stringify([
          {
            url: 'http://example.com/webhook',
            events: ['bounty.created'],
          },
        ]),
      }),
    );

    expect(() => service.getSubscriptions()).toThrow('HTTPS');
  });
});
