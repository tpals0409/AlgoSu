/**
 * @file problem.module.ts — Problem 도메인 모듈 (Controller·Service·Guard 등록)
 * @domain problem
 * @layer module
 * @related problem.service.ts, problem.controller.ts, internal-problem.controller.ts
 */
import { Module } from '@nestjs/common';
import { ProblemController } from './problem.controller';
import { InternalProblemController } from './internal-problem.controller';
import { ProblemService } from './problem.service';
import { DeadlineSchedulerService } from './deadline-scheduler.service';
import { DeadlineCacheService } from '../cache/deadline-cache.service';
import { StudyMemberGuard } from '../common/guards/study-member.guard';
import { DualWriteModule } from '../database/dual-write.module';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  imports: [DualWriteModule],
  controllers: [ProblemController, InternalProblemController],
  providers: [ProblemService, DeadlineSchedulerService, DeadlineCacheService, StudyMemberGuard, StructuredLoggerService],
  exports: [ProblemService, DeadlineCacheService],
})
export class ProblemModule {}
