import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Problem } from './problem.entity';
import { ProblemController } from './problem.controller';
import { ProblemService } from './problem.service';
import { DeadlineCacheService } from '../cache/deadline-cache.service';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Problem])],
  controllers: [ProblemController],
  providers: [ProblemService, DeadlineCacheService, StudyMemberGuard],
  exports: [ProblemService, DeadlineCacheService],
})
export class ProblemModule {}
