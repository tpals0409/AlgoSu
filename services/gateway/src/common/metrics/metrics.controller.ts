/**
 * @file Prometheus /metrics 엔드포인트 컨트롤러
 * @domain common
 * @layer controller
 * @related metrics.service.ts
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
