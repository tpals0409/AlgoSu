/**
 * @file external.module.ts — 외부 API 연동 모듈 (solved.ac 등)
 * @domain gateway
 * @layer module
 * @related solvedac.controller.ts, solvedac.service.ts
 */
import { Module } from '@nestjs/common';
import { SolvedacController } from './solvedac.controller';
import { SolvedacService } from './solvedac.service';

@Module({
  controllers: [SolvedacController],
  providers: [SolvedacService],
})
export class ExternalModule {}
