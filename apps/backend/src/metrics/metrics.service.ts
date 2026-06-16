import { Injectable } from '@nestjs/common';

type RequestMetricLabels = {
  method: string;
  route: string;
  statusCode: number;
};

type RequestMetric = RequestMetricLabels & {
  durationSeconds: number;
};

type DatabaseQueryMetric = {
  operation: string;
  durationSeconds?: number;
  failed?: boolean;
};

type StellarRpcMetricLabels = {
  operation: string;
  status: 'success' | 'error';
};

type StellarRpcMetric = StellarRpcMetricLabels & {
  durationSeconds: number;
};

const LATENCY_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly requestCounts = new Map<string, number>();
  private readonly requestLatencyBuckets = new Map<string, number[]>();
  private readonly requestLatencySums = new Map<string, number>();
  private readonly databaseQueryCounts = new Map<string, number>();
  private readonly databaseQueryErrors = new Map<string, number>();
  private readonly databaseQueryDurations: number[] = [];
  private readonly stellarRpcCounts = new Map<string, number>();
  private readonly stellarRpcLatencyBuckets = new Map<string, number[]>();
  private readonly stellarRpcLatencySums = new Map<string, number>();
  private activeWebSocketConnections = 0;

  recordHttpRequest(metric: RequestMetric): void {
    const key = this.httpKey(metric);
    this.requestCounts.set(key, (this.requestCounts.get(key) ?? 0) + 1);
    this.requestLatencySums.set(
      key,
      (this.requestLatencySums.get(key) ?? 0) + metric.durationSeconds,
    );

    const buckets = this.requestLatencyBuckets.get(key) ?? LATENCY_BUCKETS_SECONDS.map(() => 0);
    LATENCY_BUCKETS_SECONDS.forEach((bucket, index) => {
      if (metric.durationSeconds <= bucket) {
        buckets[index] += 1;
      }
    });
    this.requestLatencyBuckets.set(key, buckets);
  }

  recordDatabaseQuery(metric: DatabaseQueryMetric): void {
    this.databaseQueryCounts.set(
      metric.operation,
      (this.databaseQueryCounts.get(metric.operation) ?? 0) + 1,
    );

    if (metric.failed) {
      this.databaseQueryErrors.set(
        metric.operation,
        (this.databaseQueryErrors.get(metric.operation) ?? 0) + 1,
      );
    }

    if (
      metric.durationSeconds !== undefined &&
      Number.isFinite(metric.durationSeconds) &&
      metric.durationSeconds >= 0
    ) {
      this.databaseQueryDurations.push(metric.durationSeconds);
    }
  }

  setActiveWebSocketConnections(count: number): void {
    this.activeWebSocketConnections = Math.max(0, Math.trunc(count));
  }

  recordStellarRpcRequest(metric: StellarRpcMetric): void {
    const key = this.stellarRpcKey(metric);
    this.stellarRpcCounts.set(key, (this.stellarRpcCounts.get(key) ?? 0) + 1);
    this.stellarRpcLatencySums.set(
      key,
      (this.stellarRpcLatencySums.get(key) ?? 0) + metric.durationSeconds,
    );

    const buckets = this.stellarRpcLatencyBuckets.get(key) ?? LATENCY_BUCKETS_SECONDS.map(() => 0);
    LATENCY_BUCKETS_SECONDS.forEach((bucket, index) => {
      if (metric.durationSeconds <= bucket) {
        buckets[index] += 1;
      }
    });
    this.stellarRpcLatencyBuckets.set(key, buckets);
  }

  incrementActiveWebSocketConnections(): void {
    this.activeWebSocketConnections += 1;
  }

  decrementActiveWebSocketConnections(): void {
    this.activeWebSocketConnections = Math.max(0, this.activeWebSocketConnections - 1);
  }

  renderPrometheus(): string {
    const lines: string[] = [
      '# HELP stellar_bounty_process_uptime_seconds Process uptime in seconds.',
      '# TYPE stellar_bounty_process_uptime_seconds gauge',
      `stellar_bounty_process_uptime_seconds ${this.formatNumber(process.uptime())}`,
      '# HELP stellar_bounty_process_start_time_seconds Process start time as Unix timestamp.',
      '# TYPE stellar_bounty_process_start_time_seconds gauge',
      `stellar_bounty_process_start_time_seconds ${this.formatNumber(this.startedAt / 1000)}`,
    ];

    this.appendMemoryMetrics(lines);
    this.appendCpuMetrics(lines);
    this.appendHttpMetrics(lines);
    this.appendDatabaseMetrics(lines);
    this.appendStellarRpcMetrics(lines);
    this.appendWebSocketMetrics(lines);

    return `${lines.join('\n')}\n`;
  }

  getContentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }

  private appendMemoryMetrics(lines: string[]): void {
    const memoryUsage = process.memoryUsage();
    lines.push(
      '# HELP stellar_bounty_process_memory_bytes Process memory usage in bytes.',
      '# TYPE stellar_bounty_process_memory_bytes gauge',
    );

    Object.entries(memoryUsage).forEach(([type, value]) => {
      lines.push(`stellar_bounty_process_memory_bytes{type="${this.escapeLabel(type)}"} ${value}`);
    });
  }

  private appendCpuMetrics(lines: string[]): void {
    const cpuUsage = process.cpuUsage();
    lines.push(
      '# HELP stellar_bounty_process_cpu_seconds_total Total user and system CPU time spent in seconds.',
      '# TYPE stellar_bounty_process_cpu_seconds_total counter',
      `stellar_bounty_process_cpu_seconds_total{type="user"} ${this.formatNumber(cpuUsage.user / 1_000_000)}`,
      `stellar_bounty_process_cpu_seconds_total{type="system"} ${this.formatNumber(cpuUsage.system / 1_000_000)}`,
    );
  }

  private appendHttpMetrics(lines: string[]): void {
    lines.push(
      '# HELP stellar_bounty_http_requests_total Total HTTP requests by method, route, and status code.',
      '# TYPE stellar_bounty_http_requests_total counter',
    );

    [...this.requestCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, count]) => {
        lines.push(`stellar_bounty_http_requests_total{${key}} ${count}`);
      });

    lines.push(
      '# HELP stellar_bounty_http_request_duration_seconds HTTP request latency in seconds.',
      '# TYPE stellar_bounty_http_request_duration_seconds histogram',
    );

    [...this.requestLatencyBuckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, counts]) => {
        counts.forEach((count, index) => {
          lines.push(
            `stellar_bounty_http_request_duration_seconds_bucket{${key},le="${LATENCY_BUCKETS_SECONDS[index]}"} ${count}`,
          );
        });
        lines.push(
          `stellar_bounty_http_request_duration_seconds_bucket{${key},le="+Inf"} ${this.requestCounts.get(key) ?? 0}`,
        );
        lines.push(
          `stellar_bounty_http_request_duration_seconds_sum{${key}} ${this.formatNumber(this.requestLatencySums.get(key) ?? 0)}`,
        );
        lines.push(
          `stellar_bounty_http_request_duration_seconds_count{${key}} ${this.requestCounts.get(key) ?? 0}`,
        );
      });
  }

  private appendDatabaseMetrics(lines: string[]): void {
    const totalDuration = this.databaseQueryDurations.reduce((sum, duration) => sum + duration, 0);
    const slowQueries = this.databaseQueryDurations.filter((duration) => duration > 0.25).length;

    lines.push(
      '# HELP stellar_bounty_database_queries_total Database queries by SQL operation.',
      '# TYPE stellar_bounty_database_queries_total counter',
    );

    [...this.databaseQueryCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([operation, count]) => {
        lines.push(
          `stellar_bounty_database_queries_total{operation="${this.escapeLabel(operation)}"} ${count}`,
        );
      });

    lines.push(
      '# HELP stellar_bounty_database_query_errors_total Database query errors by SQL operation.',
      '# TYPE stellar_bounty_database_query_errors_total counter',
    );

    [...this.databaseQueryErrors.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([operation, count]) => {
        lines.push(
          `stellar_bounty_database_query_errors_total{operation="${this.escapeLabel(operation)}"} ${count}`,
        );
      });

    lines.push(
      '# HELP stellar_bounty_database_query_duration_seconds Database query duration summary in seconds.',
      '# TYPE stellar_bounty_database_query_duration_seconds summary',
      `stellar_bounty_database_query_duration_seconds_sum ${this.formatNumber(totalDuration)}`,
      `stellar_bounty_database_query_duration_seconds_count ${this.databaseQueryDurations.length}`,
      '# HELP stellar_bounty_database_slow_queries_total Database queries slower than 250ms.',
      '# TYPE stellar_bounty_database_slow_queries_total counter',
      `stellar_bounty_database_slow_queries_total ${slowQueries}`,
    );
  }

  private appendStellarRpcMetrics(lines: string[]): void {
    lines.push(
      '# HELP stellar_bounty_stellar_rpc_requests_total Stellar RPC requests by operation and status.',
      '# TYPE stellar_bounty_stellar_rpc_requests_total counter',
    );

    [...this.stellarRpcCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, count]) => {
        lines.push(`stellar_bounty_stellar_rpc_requests_total{${key}} ${count}`);
      });

    lines.push(
      '# HELP stellar_bounty_stellar_rpc_request_duration_seconds Stellar RPC request latency in seconds.',
      '# TYPE stellar_bounty_stellar_rpc_request_duration_seconds histogram',
    );

    [...this.stellarRpcLatencyBuckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, counts]) => {
        counts.forEach((count, index) => {
          lines.push(
            `stellar_bounty_stellar_rpc_request_duration_seconds_bucket{${key},le="${LATENCY_BUCKETS_SECONDS[index]}"} ${count}`,
          );
        });
        lines.push(
          `stellar_bounty_stellar_rpc_request_duration_seconds_bucket{${key},le="+Inf"} ${this.stellarRpcCounts.get(key) ?? 0}`,
        );
        lines.push(
          `stellar_bounty_stellar_rpc_request_duration_seconds_sum{${key}} ${this.formatNumber(this.stellarRpcLatencySums.get(key) ?? 0)}`,
        );
        lines.push(
          `stellar_bounty_stellar_rpc_request_duration_seconds_count{${key}} ${this.stellarRpcCounts.get(key) ?? 0}`,
        );
      });
  }

  private appendWebSocketMetrics(lines: string[]): void {
    lines.push(
      '# HELP stellar_bounty_websocket_connections_active Active WebSocket connections.',
      '# TYPE stellar_bounty_websocket_connections_active gauge',
      `stellar_bounty_websocket_connections_active ${this.activeWebSocketConnections}`,
    );
  }

  private httpKey(metric: RequestMetricLabels): string {
    return [
      `method="${this.escapeLabel(metric.method)}"`,
      `route="${this.escapeLabel(metric.route)}"`,
      `status_code="${metric.statusCode}"`,
    ].join(',');
  }

  private stellarRpcKey(metric: StellarRpcMetricLabels): string {
    return [
      `operation="${this.escapeLabel(metric.operation)}"`,
      `status="${this.escapeLabel(metric.status)}"`,
    ].join(',');
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  private formatNumber(value: number): string {
    return Number.isFinite(value) ? value.toString() : '0';
  }
}
