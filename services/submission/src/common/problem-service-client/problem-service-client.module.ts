/**
 * @file problem-service-client.module.ts -- ProblemServiceClient NestJS 모듈
 * @domain common
 * @layer module
 * @related problem-service-client.ts, circuit-breaker.module.ts
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProblemServiceClient } from './problem-service-client';

@Module({
  // CircuitBreakerModule은 @Global() — AppModule/SubmissionModule에서 한 번 import되어 전역 사용 가능
  imports: [ConfigModule],
  providers: [ProblemServiceClient],
  exports: [ProblemServiceClient],
})
export class ProblemServiceClientModule {}
