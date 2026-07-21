# Runbook: HighWebSocketConnections

## Alert

- **Name:** `HighWebSocketConnections`
- **Trigger:** Active WebSocket connections >1000, sustained for 2m
- **Severity:** warning
- **Team:** backend

## Summary

WebSocket fanout (likely the live bounty-feed channel) has exceeded
1000 concurrent connections. Front-end may feel sluggish and the
backend is doing more broadcast work per message.

## Impact

- Higher CPU per message due to fanout
- Risk of memory growth per connection (buffering, dedupe maps)
- Eventually may trigger `HighMemoryUsage`

## Triage (first 10 minutes)

1. Grafana → "WebSockets" panel. Note connection rate-of-change.
2. Identify if the spike is geographic (CDN/edge metrics) or tied to a
   specific user cohort.
3. Check correlated `stellar_bounty_http_requests_total` — is there a
   connectivity event?
4. Confirm WebSocket origin in code (`ws` library usage in
   `apps/backend/src/app.controller.ts` and friends).

## Mitigation

- **Auth-failure storm:** tighten WS auth handshake; reject early
  with explicit close-code.
- **Bot/scraper:** enable per-IP WS rate limit at the gateway.
- **Legit traffic:** add a second WS replica and re-balance.

## Post-incident

- Add a load test: 5K concurrent WS connections.
- If this is a recurring pattern, raise the alert threshold to a
  percentile-based value rather than absolute count.
- File an issue to introduce WS message batching if fanout is the
  bottleneck.

## Related

- `apps/backend/src/app.controller.ts`
- `apps/backend/src/metrics/metrics.service.ts`
- `docs/metrics.md`
