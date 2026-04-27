/**
 * @file problem-service-client.module.ts -- ProblemServiceClient NestJS 모듈
 * @domain common
 * @layer module
 * @related problem-service-client.ts, circuit-breaker.module.ts
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CircuitBreakerModule } from '../circuit-breaker';
import { ProblemServiceClient } from './problem-service-client';

@Module({
  imports: [CircuitBreakerModule, ConfigModule],
  providers: [ProblemServiceClient],
  exports: [ProblemServiceClient],
})
export class ProblemServiceClientModule {}
