/**
 * @file crawler.module.ts — Programmers 크롤러 모듈 등록
 * @domain problem
 * @layer module
 * @related crawler.service.ts, problem.module.ts
 */
import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  providers: [CrawlerService, StructuredLoggerService],
  exports: [CrawlerService],
})
export class CrawlerModule {}
