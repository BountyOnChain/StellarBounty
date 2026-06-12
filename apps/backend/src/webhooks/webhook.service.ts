import { createHmac, randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WEBHOOK_EVENTS, WebhookDeliveryPayload, WebhookEvent, WebhookSubscription } from './webhook-events';

type DeliveryResult = {
  delivered: number;
  failed: number;
};

const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly endpointDeliveryChains = new Map<string, Promise<void>>();
  private readonly endpointNextDeliveryAt = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  getSubscriptions(): WebhookSubscription[] {
    const raw = this.config.get<string>('WEBHOOK_SUBSCRIPTIONS_JSON', '[]');
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error('WEBHOOK_SUBSCRIPTIONS_JSON must be an array.');
    }

    return parsed.map((item) => this.parseSubscription(item));
  }

  async publish(event: WebhookEvent, data: Record<string, unknown>): Promise<DeliveryResult> {
    const payload: WebhookDeliveryPayload = {
      event,
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      data,
    };
    let subscriptions: WebhookSubscription[];
    try {
      subscriptions = this.getSubscriptions().filter((subscription) => subscription.events.includes(event));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Webhook subscriptions are invalid: ${message}`);
      return { delivered: 0, failed: 0 };
    }
    const results = await Promise.all(subscriptions.map((subscription) => this.deliver(subscription, payload)));

    return results.reduce(
      (total, delivered) => ({
        delivered: total.delivered + (delivered ? 1 : 0),
        failed: total.failed + (delivered ? 0 : 1),
      }),
      { delivered: 0, failed: 0 },
    );
  }

  private async deliver(subscription: WebhookSubscription, payload: WebhookDeliveryPayload): Promise<boolean> {
    const maxAttempts = this.config.get<number>('WEBHOOK_DELIVERY_MAX_ATTEMPTS', 3);
    const baseDelayMs = this.config.get<number>('WEBHOOK_DELIVERY_BASE_DELAY_MS', 250);
    const timeoutMs = this.config.get<number>('WEBHOOK_DELIVERY_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
    const body = JSON.stringify(payload);
    const signature = subscription.secret ? this.signPayload(subscription.secret, body) : undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.reserveEndpointSlot(subscription.url);
        const response = await this.postJson(subscription.url, body, payload.event, signature, timeoutMs);
        if (response.ok) {
          return true;
        }
        this.logger.warn(`Webhook delivery failed with status ${response.status}: ${subscription.url}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Webhook delivery attempt ${attempt} failed for ${subscription.url}: ${message}`);
      }

      if (attempt < maxAttempts) {
        await this.sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }

    return false;
  }

  private async postJson(
    url: string,
    body: string,
    event: WebhookEvent,
    signature: string | undefined,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-stellar-bounty-event': event,
          ...(signature ? { 'x-stellar-bounty-signature': signature } : {}),
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async reserveEndpointSlot(url: string): Promise<void> {
    const minIntervalMs = this.config.get<number>('WEBHOOK_ENDPOINT_MIN_INTERVAL_MS', 0);
    if (minIntervalMs <= 0) {
      return;
    }

    const previous = this.endpointDeliveryChains.get(url) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const nextDeliveryAt = this.endpointNextDeliveryAt.get(url) ?? 0;
        const waitMs = Math.max(0, nextDeliveryAt - Date.now());
        if (waitMs > 0) {
          await this.sleep(waitMs);
        }
        this.endpointNextDeliveryAt.set(url, Date.now() + minIntervalMs);
      });

    this.endpointDeliveryChains.set(url, current);
    await current;
    if (this.endpointDeliveryChains.get(url) === current) {
      this.endpointDeliveryChains.delete(url);
    }
  }

  private signPayload(secret: string, body: string): string {
    return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  private parseSubscription(item: unknown): WebhookSubscription {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Webhook subscription must be an object.');
    }

    const candidate = item as Record<string, unknown>;
    if (typeof candidate.url !== 'string' || !candidate.url.startsWith('https://')) {
      throw new Error('Webhook subscription url must be an HTTPS URL.');
    }
    if (!Array.isArray(candidate.events)) {
      throw new Error('Webhook subscription events must be an array.');
    }

    const events = candidate.events.map((event) => {
      if (typeof event !== 'string' || !WEBHOOK_EVENTS.includes(event as WebhookEvent)) {
        throw new Error(`Unsupported webhook event: ${String(event)}`);
      }
      return event as WebhookEvent;
    });

    return {
      url: candidate.url,
      events,
      secret: typeof candidate.secret === 'string' ? candidate.secret : undefined,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
