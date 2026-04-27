/**
 * @file circuit-breaker.module.ts -- CircuitBreaker NestJS 모듈
 * @domain common
 * @layer module
 * @related circuit-breaker.service.ts, metrics.module.ts
 */

import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { CircuitBreakerService } from './circuit-breaker.service';

@Module({
  imports: [MetricsModule],
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class CircuitBreakerModule {}
