# Metrics and Alerting

The backend exposes Prometheus text metrics at `/metrics`. Prometheus should scrape the backend service and load the alerting rules in `infrastructure/prometheus/rules.yml`. Alertmanager can start from the email receiver example in `infrastructure/alertmanager/alertmanager.yml`.

## Available Metrics

| Metric                                                | Type      | Labels                           | Description                                          |
| ----------------------------------------------------- | --------- | -------------------------------- | ---------------------------------------------------- |
| `stellar_bounty_process_uptime_seconds`               | gauge     | none                             | Backend process uptime.                              |
| `stellar_bounty_process_start_time_seconds`           | gauge     | none                             | Backend process start time as a Unix timestamp.      |
| `stellar_bounty_process_memory_bytes`                 | gauge     | `type`                           | Node.js process memory usage.                        |
| `stellar_bounty_process_cpu_seconds_total`            | counter   | `type`                           | Node.js user/system CPU time.                        |
| `stellar_bounty_http_requests_total`                  | counter   | `method`, `route`, `status_code` | HTTP request totals.                                 |
| `stellar_bounty_http_request_duration_seconds`        | histogram | `method`, `route`, `status_code` | HTTP request latency.                                |
| `stellar_bounty_database_queries_total`               | counter   | `operation`                      | TypeORM query counts by SQL operation.               |
| `stellar_bounty_database_query_errors_total`          | counter   | `operation`                      | TypeORM query errors by SQL operation.               |
| `stellar_bounty_database_query_duration_seconds`      | summary   | none                             | Slow-query duration samples captured by TypeORM.     |
| `stellar_bounty_database_slow_queries_total`          | counter   | none                             | Queries slower than the configured 250 ms threshold. |
| `stellar_bounty_stellar_rpc_requests_total`           | counter   | `operation`, `status`            | Stellar RPC calls made by backend contract approval. |
| `stellar_bounty_stellar_rpc_request_duration_seconds` | histogram | `operation`, `status`            | Stellar RPC call latency.                            |
| `stellar_bounty_websocket_connections_active`         | gauge     | none                             | Active WebSocket connections.                        |

The Prometheus rule file also includes `StellarBountyDatabasePoolHighUsage`, which expects `stellar_bounty_database_pool_active_connections` and `stellar_bounty_database_pool_max_connections`. If the deployment uses a PostgreSQL exporter or node-postgres pool instrumentation, expose those names to activate the DB pool alert. Until those series exist, the alert remains inactive instead of firing on missing data.

## Alert Rules

`infrastructure/prometheus/rules.yml` defines:

- HTTP 5xx error rate above 5% for 10 minutes.
- API p95 latency above 2 seconds for 10 minutes.
- Database query error rate above 5% for 10 minutes.
- Database pool usage above 80% for 10 minutes when pool usage metrics are available.
- Stellar RPC failure rate above 10% for 10 minutes.
- Backend metrics target down for 5 minutes.

## Grafana Dashboard

Import `infrastructure/grafana/dashboards/stellar-bounty.json` into Grafana and select the Prometheus datasource when prompted. The dashboard includes request rate, error rate, p95 latency, database query activity, database pool usage, Stellar RPC failure rate and latency, process memory, and WebSocket connections.

## Local Validation

Validate rule syntax with Prometheus tooling:

```bash
promtool check rules infrastructure/prometheus/rules.yml
amtool check-config infrastructure/alertmanager/alertmanager.yml
```

A minimal Prometheus scrape job looks like:

```yaml
scrape_configs:
  - job_name: stellar-bounty-backend
    metrics_path: /metrics
    static_configs:
      - targets:
          - backend:4000
rule_files:
  - /etc/prometheus/rules.yml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093
```

To test alert delivery, temporarily lower one threshold in a local copy of `rules.yml`, generate traffic or errors against the backend, and confirm Alertmanager receives the alert. Restore the production thresholds before committing or deploying.
