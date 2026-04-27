/**
 * @file circuit-breaker.module.ts -- CircuitBreaker NestJS 모듈
 * @domain common
 * @layer module
 * @related circuit-breaker.service.ts, metrics.module.ts
 */

import { Global, Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * Circuit Breaker 글로벌 모듈
 *
 * @Global() 데코레이터로 마킹되어 AppModule/SubmissionModule에서 한 번 import하면
 * 전역 inject 가능. 여러 module에서 중복 import 시 NestJS가 CircuitBreakerService를
 * 별도 인스턴스화하여 prom-client의 duplicate metric registration 에러로 부팅 실패하는
 * 회귀를 차단 (Sprint 135 Wave C Critic 2차 P1).
 */
@Global()
@Module({
  imports: [MetricsModule],
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class CircuitBreakerModule {}
