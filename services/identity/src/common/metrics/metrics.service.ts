/**
 * @file metrics.service.ts — prom-client 레지스트리 관리 및 HTTP 히스토그램
 * @domain common
 * @layer service
 * @related metrics.controller.ts, metrics.module.ts
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
    this.serviceName = process.env['SERVICE_NAME'] ?? 'identity';

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
