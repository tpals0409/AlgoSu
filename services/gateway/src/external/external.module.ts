/**
 * @file external.module.ts — 외부 API 연동 모듈 (Solved.ac, 프로그래머스)
 * @domain gateway
 * @layer module
 * @related solvedac.controller.ts, solvedac.service.ts,
 *          programmers.controller.ts, programmers.service.ts
 */
import { Module } from '@nestjs/common';
import { SolvedacController } from './solvedac.controller';
import { SolvedacService } from './solvedac.service';
import { ProgrammersController } from './programmers.controller';
import { ProgrammersService } from './programmers.service';

@Module({
  controllers: [SolvedacController, ProgrammersController],
  providers: [SolvedacService, ProgrammersService],
})
export class ExternalModule {}
