/**
 * AlgoSu — Prometheus Metrics Module (Global)
 * 규칙 근거: /docs/monitoring-log-rules.md §9
 *
 * 글로벌 모듈 — AppModule에 한 번만 import하면
 * 전체 앱에서 MetricsService를 DI 받아 사용 가능
 */
import {
  Module,
  Global,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Injectable,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Injectable()
class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const rawPath = req.route?.path ?? req.path ?? req.url;

    if (!this.metricsService.shouldRecord(rawPath)) {
      return next.handle();
    }

    const normalizedPath = this.metricsService.normalizePath(rawPath);
    const method = req.method;

    this.metricsService.httpActiveRequests.inc();
    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.recordMetrics(context, method, normalizedPath, startTime),
        error: () => this.recordMetrics(context, method, normalizedPath, startTime),
      }),
    );
  }

  private recordMetrics(
    context: ExecutionContext,
    method: string,
    normalizedPath: string,
    startTime: bigint,
  ): void {
    const res = context.switchToHttp().getResponse<Response>();
    const statusCode = String(res.statusCode);
    const durationSeconds =
      Number(process.hrtime.bigint() - startTime) / 1_000_000_000;

    const labels = { method, path: normalizedPath, status_code: statusCode };

    this.metricsService.httpRequestDuration.observe(labels, durationSeconds);
    this.metricsService.httpRequestsTotal.inc(labels);

    if (res.statusCode >= 400) {
      this.metricsService.httpErrorsTotal.inc(labels);
    }

    this.metricsService.httpActiveRequests.dec();
  }
}

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
