# Stellar Bounty Metrics Documentation

## Overview

Stellar Bounty exposes Prometheus metrics for monitoring application health and performance. Metrics are exposed at the `/metrics` endpoint.

## Available Metrics

### HTTP Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `stellar_bounty_http_requests_total` | Counter | Total HTTP requests | `method`, `route`, `status_code` |
| `stellar_bounty_http_request_duration_seconds` | Histogram | HTTP request duration in seconds | `method`, `route`, `status_code` |

### Database Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `stellar_bounty_database_queries_total` | Counter | Total database queries | `operation` |
| `stellar_bounty_database_query_errors_total` | Counter | Database query errors | `operation` |
| `stellar_bounty_database_query_duration_seconds` | Summary | Database query duration in seconds | - |
| `stellar_bounty_database_slow_queries_total` | Counter | Queries slower than 250ms | - |

### Stellar RPC Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `stellar_bounty_stellar_rpc_failures_total` | Counter | Stellar RPC failures | `operation`, `retryable` |
| `stellar_bounty_stellar_rpc_retries_total` | Counter | Stellar RPC retries | `operation`, `retryable` |

### WebSocket Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `stellar_bounty_websocket_connections_active` | Gauge | Active WebSocket connections | - |

### Process Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `stellar_bounty_process_uptime_seconds` | Gauge | Process uptime in seconds | - |
| `stellar_bounty_process_start_time_seconds` | Gauge | Process start time as Unix timestamp | - |
| `stellar_bounty_process_memory_bytes` | Gauge | Memory usage by type | `type` (rss, heapTotal, heapUsed, external) |
| `stellar_bounty_process_cpu_seconds_total` | Counter | Total CPU time spent | `type` (user, system) |

## Alerting Rules

| Alert Name | Condition | Severity | Description |
|------------|-----------|----------|-------------|
| `HighErrorRate` | Error rate > 5% over 2 minutes | Critical | HTTP 5xx errors exceeded threshold |
| `HighLatency` | p95 latency > 2s over 3 minutes | Warning | API response times are slow |
| `HighDatabaseErrorRate` | DB error rate > 10% over 2 minutes | Critical | Database queries failing |
| `HighSlowQueryRate` | Slow queries > 10% over 3 minutes | Warning | Database performance issues |
| `StellarRPCFailure` | RPC failure rate > 10% over 2 minutes | Critical | Stellar RPC calls failing |
| `HighMemoryUsage` | Memory usage > 80% over 3 minutes | Warning | Memory usage approaching limit |
| `HighWebSocketConnections` | WebSocket > 1000 over 2 minutes | Warning | High number of WebSocket connections |

## Setting Up Monitoring

### Prerequisites

- Prometheus (v2.30+)
- Grafana (v9.0+)
- Alertmanager (v0.23+)

### Prometheus Configuration

Add the following scrape config to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'stellar-bounty'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

