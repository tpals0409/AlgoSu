import { Module } from '@nestjs/common';
import { ProblemController } from './problem.controller';
import { ProblemService } from './problem.service';
import { DeadlineCacheService } from '../cache/deadline-cache.service';
import { StudyMemberGuard } from '../common/guards/study-member.guard';
import { DualWriteModule } from '../database/dual-write.module';

@Module({
  imports: [DualWriteModule],
  controllers: [ProblemController],
  providers: [ProblemService, DeadlineCacheService, StudyMemberGuard],
  exports: [ProblemService, DeadlineCacheService],
})
export class ProblemModule {}
