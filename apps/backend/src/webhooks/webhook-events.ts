export const WEBHOOK_EVENTS = [
  'bounty.created',
  'bounty.completed',
  'submission.received',
  'submission.approved',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookSubscription = {
  url: string;
  events: WebhookEvent[];
  secret?: string;
};

export type WebhookDeliveryPayload = {
  event: WebhookEvent;
  id: string;
  occurredAt: string;
  data: Record<string, unknown>;
};
