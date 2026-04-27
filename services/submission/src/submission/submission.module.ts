/**
 * @file submission.module.ts — Submission 도메인 모듈 (Controller·Service·Saga 등록)
 * @domain submission
 * @layer module
 * @related submission.service.ts, submission.controller.ts, saga-orchestrator.service.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './submission.entity';
import { AiSatisfaction } from './ai-satisfaction.entity';
import { Draft } from '../draft/draft.entity';
import { SubmissionController } from './submission.controller';
import { SubmissionInternalController } from './submission-internal.controller';
import { SubmissionService } from './submission.service';
import { DraftService } from '../draft/draft.service';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';
import { MqPublisherService } from '../saga/mq-publisher.service';
import { CircuitBreakerModule } from '../common/circuit-breaker';
import { ProblemServiceClientModule } from '../common/problem-service-client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, AiSatisfaction, Draft]),
    CircuitBreakerModule,
    ProblemServiceClientModule,
  ],
  controllers: [SubmissionController, SubmissionInternalController],
  providers: [
    SubmissionService,
    DraftService,
    SagaOrchestratorService,
    MqPublisherService,
  ],
  exports: [SubmissionService, DraftService, SagaOrchestratorService],
})
export class SubmissionModule {}
