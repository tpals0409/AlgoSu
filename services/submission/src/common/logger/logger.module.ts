/**
 * @file 글로벌 로거 모듈 — StructuredLoggerService를 전역 제공
 * @domain common
 * @layer config
 * @related structured-logger.service.ts
 */
import { Global, Module } from '@nestjs/common';
import { StructuredLoggerService } from './structured-logger.service';

@Global()
@Module({
  providers: [StructuredLoggerService],
  exports: [StructuredLoggerService],
})
export class LoggerModule {}
