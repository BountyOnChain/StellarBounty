# Metrics API Examples

Base URL: `http://localhost:4000/api/v1`

The metrics endpoint exposes Prometheus-compatible metrics for monitoring and alerting. No authentication is required.

---

## 1. Scrape Prometheus Metrics

### cURL

```bash
curl -s "http://localhost:4000/api/v1/metrics" | head -20
```

### node-fetch (Node.js)

```js
const res = await fetch("http://localhost:4000/api/v1/metrics", {
  headers: { Accept: "text/plain" },
});
const text = await res.text();
console.log(text);
```

### Example Response

```
# HELP stellar_bounty_process_uptime_seconds Process uptime in seconds
# TYPE stellar_bounty_process_uptime_seconds gauge
stellar_bounty_process_uptime_seconds 3600.123

# HELP stellar_bounty_process_memory_bytes Process memory usage in bytes
# TYPE stellar_bounty_process_memory_bytes gauge
stellar_bounty_process_memory_bytes 52428800

# HELP stellar_bounty_http_requests_total Total number of HTTP requests
# TYPE stellar_bounty_http_requests_total counter
stellar_bounty_http_requests_total{method="GET",path="/api/v1/bounties",status="200"} 1542

# HELP stellar_bounty_http_request_duration_seconds HTTP request duration histogram
# TYPE stellar_bounty_http_request_duration_seconds histogram
stellar_bounty_http_request_duration_seconds_bucket{method="GET",path="/api/v1/bounties",le="0.01"} 800
stellar_bounty_http_request_duration_seconds_bucket{method="GET",path="/api/v1/bounties",le="0.05"} 1200
stellar_bounty_http_request_duration_seconds_bucket{method="GET",path="/api/v1/bounties",le="0.1"} 1400
stellar_bounty_http_request_duration_seconds_bucket{method="GET",path="/api/v1/bounties",le="0.5"} 1540
stellar_bounty_http_request_duration_seconds_bucket{method="GET",path="/api/v1/bounties",le="+Inf"} 1542
stellar_bounty_http_request_duration_seconds_sum{method="GET",path="/api/v1/bounties"} 45.123
stellar_bounty_http_request_duration_seconds_count{method="GET",path="/api/v1/bounties"} 1542

# HELP stellar_bounty_stellar_rpc_failures_total Stellar RPC failure count
# TYPE stellar_bounty_stellar_rpc_failures_total counter
stellar_bounty_stellar_rpc_failures_total 0

# HELP stellar_bounty_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)
# TYPE stellar_bounty_circuit_breaker_state gauge
stellar_bounty_circuit_breaker_state 0
```

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `stellar_bounty_process_uptime_seconds` | gauge | Process uptime |
| `stellar_bounty_process_memory_bytes` | gauge | Memory usage |
| `stellar_bounty_process_cpu_seconds_total` | counter | CPU time consumed |
| `stellar_bounty_http_requests_total` | counter | HTTP request count (by method, path, status) |
| `stellar_bounty_http_request_duration_seconds` | histogram | Request latency distribution |
| `stellar_bounty_database_queries_total` | counter | Database query count |
| `stellar_bounty_database_query_errors_total` | counter | Database error count |
| `stellar_bounty_database_slow_queries_total` | counter | Slow query count (>250ms) |
| `stellar_bounty_stellar_rpc_failures_total` | counter | Stellar RPC failure count |
| `stellar_bounty_stellar_rpc_retries_total` | counter | Stellar RPC retry count |
| `stellar_bounty_websocket_connections_active` | gauge | Active WebSocket connections |
| `stellar_bounty_circuit_breaker_state` | gauge | Circuit breaker state |

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 200 | Empty response | Metrics may be zero if the server just started; generate some traffic first |
