# Runbook — Querying Loki for the StellarBounty Backend

> Companion to docker-compose Loki + Promtail pipeline (#421). Lists the
> canonical LogQL queries used in incident response until Grafana panels
> cover them.

## Acceptance criterion verification

Issue #421 acceptance: query Loki for `level=error` and see aggregate
counts. After installing the stack via either docker-compose or the
Helm chart:

```logql
sum(count_over_time({service="stellar-bounty-backend"}[5m])) by (level)
```

Or, if you prefer an explicit filter:

```logql
sum(rate({service="stellar-bounty-backend"} | json | level="error"[5m]))
```

The second is the canonical "errors per second" query — match it
against the HighErrorRate alert in `infrastructure/prometheus/rules.yml`
to confirm service-vs-logs symmetry on a known incident.

## Common debug queries

### Tailing a single request by `requestId`

The `JsonLoggerService` (`apps/backend/src/common/json-logger.service.ts`)
emits a UUID-ish `requestId` per request. After the
`AsyncLocalStorage` middleware sets it, every log within the request
scope carries the same id.

```logql
{service="stellar-bounty-backend"} | json | requestId="abc-123"
```

### All errors in the last hour grouped by `context`

```logql
{service="stellar-bounty-backend"} | json | level="error" | line_format "{{.context}}: {{.message}}"
```

### Errors per minute by HTTP route

The audit middleware emits a JSON log entry per response with
`method`, `url`, `statusCode`, `duration`:

```logql
sum(count_over_time({service="stellar-bounty-backend"} |= "AuditLog" | json | statusCode=~"5.."[1m])) by (url)
```

### soroban RPC failures (look for circuit-breaker opens)

```logql
{service="stellar-bounty-backend"} | json | context="StellarRpcClient" | level="warn"
```

### Auth failures (nonce reuse / expired challenge)

```logql
{service="stellar-bounty-backend"} | json | context="AuthService" | level="warn"
```

## Pipeline overview

```
┌─────────────────────┐  stdout / stderr        ┌─────────┐
│ apps/backend        │   (JSON, one per line) │ docker  │
│ (JsonLoggerService) │ ────────────────────►  │ json-   │
└─────────────────────┘                        │ file    │
                                               │ driver  │
┌─────────────────────┐                        └────┬────┘
│ apps/frontend       │   json/plaintext            │ /var/lib/docker/containers/*/*.log
│ (Next.js default)   │ ────────────────────►       │
└─────────────────────┘                            │
                                                   ▼
                                          ┌─────────────────┐
                                          │ Promtail        │
                                          │ (k8s DaemonSet  │
                                          │  or compose svc)│
                                          └────────┬────────┘
                                                   │ push
                                                   ▼
                                          ┌─────────────────┐
                                          │ Loki            │
                                          │ (compose or k8s)│
                                          └────────┬────────┘
                                                   │ LogQL
                                                   ▼
                                          ┌─────────────────┐
                                          │ Grafana Explore │
                                          └─────────────────┘
```

## Provisioning

The Grafana datasource is provisioned by
`infrastructure/grafana/datasources/loki.yaml`. Mount it into your
Grafana container with:

```yaml
volumes:
  - ./infrastructure/grafana/datasources:/etc/grafana/provisioning/datasources:ro
```

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Loki empty after deploy | Promtail can't reach Loki | `kubectl logs -l app.kubernetes.io/name=promtail` |
| `parse error` on LogQL | Log line not valid JSON | Check `LOG_FORMAT=json` is set in backend env (see docker-compose.yml) |
| Labels missing on queries | Promtail pipeline stage not applied | Restart Promtail, confirm ConfigMap mounted |
| Old (pre-Loki) lines missing | Retention is 7d | Acceptable, raise `limits_config.retention_period` in `infrastructure/loki/loki-config.yaml` if needed |
