/**
 * @file Gateway Prometheus 메트릭 서비스 — HTTP 히스토그램 + 카운터
 * @domain common
 * @layer service
 * @related metrics.controller.ts
 *
 * 규칙 근거: /docs/monitoring-log-rules.md §9
 *
 * 역할:
 * - prom-client Registry 관리
 * - collectDefaultMetrics 활성화
 * - HTTP 요청 히스토그램: algosu_{service}_http_request_duration_seconds
 * - 네이밍: algosu_{service}_{metric}_{unit}
 *
 * 보안:
 * - /metrics 인증 없이 접근 가능 (Prometheus scraper)
 * - 고카디널리티 라벨 금지: userId, traceId, requestId
 * - path 동적 세그먼트 정규화: /problems/123 → /problems/:id
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  Gauge,
} from 'prom-client';

const UUID_SEGMENT =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_SEGMENT = /\/\d+/g;
const EXCLUDED_PATHS = new Set(['/metrics', '/health']);

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;
  private readonly serviceName: string;

  readonly httpRequestDuration: Histogram<string>;
  readonly httpRequestsTotal: Counter<string>;
  readonly httpActiveRequests: Gauge<string>;
  readonly httpErrorsTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();
    this.serviceName = process.env['SERVICE_NAME'] ?? 'gateway';

    const prefix = `algosu_${this.serviceName}`;

    this.httpRequestDuration = new Histogram({
      name: `${prefix}_http_request_duration_seconds`,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'] as const,
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 2.0, 5.0],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: `${prefix}_http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'] as const,
      registers: [this.registry],
    });

    this.httpActiveRequests = new Gauge({
      name: `${prefix}_http_active_requests`,
      help: 'Number of active HTTP requests',
      registers: [this.registry],
    });

    this.httpErrorsTotal = new Counter({
      name: `${prefix}_http_errors_total`,
      help: 'Total number of HTTP errors (4xx + 5xx)',
      labelNames: ['method', 'path', 'status_code'] as const,
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    collectDefaultMetrics({
      register: this.registry,
      prefix: `algosu_${this.serviceName}_`,
    });
  }

  normalizePath(path: string): string {
    return path
      .split('?')[0]
      .replace(UUID_SEGMENT, '/:id')
      .replace(NUMERIC_SEGMENT, '/:id');
  }

  shouldRecord(path: string): boolean {
    return !EXCLUDED_PATHS.has(path.split('?')[0]);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
