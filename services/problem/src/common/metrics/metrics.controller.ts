/**
 * @file metrics.controller.ts — Prometheus /metrics 엔드포인트
 * @domain common
 * @layer controller
 * @related metrics.service.ts, metrics.module.ts
 */

/**
 * AlgoSu — Prometheus Metrics Controller
 * GET /metrics — Prometheus scraper 전용
 * 인증 없이 접근 가능 (JwtMiddleware에서 제외)
 */
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.end(metrics);
  }
}
