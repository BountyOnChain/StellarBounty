import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('renders process, HTTP, database, and websocket metrics in Prometheus format', () => {
    service.recordHttpRequest({
      method: 'GET',
      route: '/bounties',
      statusCode: 200,
      durationSeconds: 0.12,
    });
    service.recordHttpRequest({
      method: 'POST',
      route: '/bounties',
      statusCode: 500,
      durationSeconds: 0.4,
    });
    service.recordDatabaseQuery({ operation: 'SELECT', durationSeconds: 0.08 });
    service.recordDatabaseQuery({ operation: 'INSERT', durationSeconds: 0.35, failed: true });
    service.recordStellarRpcFailure({ operation: 'getAccount', retryable: true });
    service.recordStellarRpcRetry({ operation: 'getAccount', retryable: true });
    service.setActiveWebSocketConnections(3);

    const output = service.renderPrometheus();

    expect(output).toContain('# TYPE stellar_bounty_process_uptime_seconds gauge');
    expect(output).toContain('stellar_bounty_http_requests_total{method="GET",route="/bounties",status_code="200"} 1');
    expect(output).toContain('stellar_bounty_http_requests_total{method="POST",route="/bounties",status_code="500"} 1');
    expect(output).toContain('stellar_bounty_http_request_duration_seconds_bucket{method="GET",route="/bounties",status_code="200",le="0.25"} 1');
    expect(output).toContain('stellar_bounty_database_queries_total{operation="SELECT"} 1');
    expect(output).toContain('stellar_bounty_database_query_errors_total{operation="INSERT"} 1');
    expect(output).toContain('stellar_bounty_database_query_duration_seconds_count 2');
    expect(output).toContain('stellar_bounty_database_slow_queries_total 1');
    expect(output).toContain('stellar_bounty_stellar_rpc_failures_total{operation="getAccount",retryable="true"} 1');
    expect(output).toContain('stellar_bounty_stellar_rpc_retries_total{operation="getAccount",retryable="true"} 1');
    expect(output).toContain('stellar_bounty_websocket_connections_active 3');
  });

  it('escapes label values and never exposes negative websocket counts', () => {
    service.recordHttpRequest({
      method: 'GET',
      route: '/bad"path',
      statusCode: 404,
      durationSeconds: 0.01,
    });
    service.setActiveWebSocketConnections(-2);

    const output = service.renderPrometheus();

    expect(output).toContain('route="/bad\\"path"');
    expect(output).toContain('stellar_bounty_websocket_connections_active 0');
  });
});
