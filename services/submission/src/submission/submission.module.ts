import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './submission.entity';
import { Draft } from '../draft/draft.entity';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { DraftService } from '../draft/draft.service';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';
import { MqPublisherService } from '../saga/mq-publisher.service';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Draft])],
  controllers: [SubmissionController],
  providers: [
    SubmissionService,
    DraftService,
    SagaOrchestratorService,
    MqPublisherService,
  ],
  exports: [SubmissionService, DraftService, SagaOrchestratorService],
})
export class SubmissionModule {}
