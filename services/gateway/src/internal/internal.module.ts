/**
 * @file internal.module.ts — 내부 서비스 간 통신 모듈
 * @domain gateway
 * @layer module
 * @related internal.controller.ts, internal-key.guard.ts
 */
import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';

@Module({
  controllers: [InternalController],
})
export class InternalModule {}
