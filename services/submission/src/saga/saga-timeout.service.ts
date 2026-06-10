/**
 * @file saga-timeout.service.ts -- 미완료 Saga 재개 + 단계별 타임아웃 체크
 * @domain submission
 * @layer service
 * @related saga-orchestrator.service.ts, MqPublisherService, Submission
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In, MoreThan, LessThan } from 'typeorm';
import { Submission, SagaStep } from '../submission/submission.entity';
import { MqPublisherService } from './mq-publisher.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { ProblemServiceClient } from '../common/problem-service-client';
import { SagaOrchestratorService } from './saga-orchestrator.service';

/**
 * Saga Timeout Service -- 미완료 Saga 자동 재개 + 타임아웃 감시
 *
 * SagaOrchestratorService에서 분리(ADR-030 Q-2):
 * - 부팅 시(onModuleInit) 1시간 이내 미완료 Saga 재개
 * - 2분 주기 타임아웃 체크 (DB_SAVED 5분 / GITHUB_QUEUED 15분 / AI_QUEUED 30분)
 * - resumeSaga: 현재 step에 따라 다음 단계 재실행 (DB_SAVED는 Orchestrator 위임)
 *
 * 의존 방향: SagaTimeoutService -> SagaOrchestratorService (단방향, 순환 없음)
 */
@Injectable()
export class SagaTimeoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: StructuredLoggerService;

  // M3: 단계별 타임아웃 (설계서 기준)
  private static readonly STEP_TIMEOUTS: Record<SagaStep, number> = {
    [SagaStep.DB_SAVED]: 5 * 60 * 1000,       // 5분
    [SagaStep.GITHUB_QUEUED]: 15 * 60 * 1000,  // 15분
    [SagaStep.AI_QUEUED]: 30 * 60 * 1000,      // 30분
    /** @deprecated DB 호환용. 실제 상태 전이에서 사용하지 않음 */
    [SagaStep.AI_SKIPPED]: 0,
    [SagaStep.DONE]: 0,
    [SagaStep.FAILED]: 0,
  };
  private static readonly TIMEOUT_CHECK_INTERVAL = 2 * 60 * 1000; // 2분마다 체크
  /** 최대 재시도 횟수 -- 초과 시 FAILED 전이 */
  private static readonly MAX_SAGA_RETRIES = 3;
  private timeoutTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly mqPublisher: MqPublisherService,
    private readonly problemClient: ProblemServiceClient,
    private readonly orchestrator: SagaOrchestratorService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(SagaTimeoutService.name);
  }

  /**
   * Startup Hook -- 미완료 Saga 자동 재개
   * 서비스 재시작 시 1시간 이내 미완료 Saga를 감지하여 재개
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Saga Orchestrator 초기화 -- 미완료 Saga 검색 중...');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const incompleteSubmissions = await this.submissionRepo.find({
      where: {
        sagaStep: Not(In([SagaStep.DONE, SagaStep.FAILED])),
        createdAt: MoreThan(oneHourAgo),
      },
      order: { createdAt: 'ASC' },
    });

    if (incompleteSubmissions.length === 0) {
      this.logger.log('미완료 Saga 없음 -- 정상 시작');
    } else {
      this.logger.warn(`미완료 Saga ${incompleteSubmissions.length}건 발견 -- 재개 시작`);

      for (const submission of incompleteSubmissions) {
        try {
          await this.resumeSaga(submission);
        } catch (error: unknown) {
          this.logger.error(
            `Saga 재개 실패: submissionId=${submission.id}, step=${submission.sagaStep}, error=${(error as Error).message}`,
          );
        }
      }

      this.logger.log('미완료 Saga 재개 완료');
    }

    // M3: 주기적 타임아웃 체크 시작 (미완료 Saga 유무와 관계없이 항상 등록)
    this.timeoutTimer = setInterval(() => {
      void this.checkSagaTimeouts();
    }, SagaTimeoutService.TIMEOUT_CHECK_INTERVAL);
    this.logger.log('Saga 타임아웃 체크 시작 (2분 주기)');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  /**
   * M3: 단계별 타임아웃 체크 Cron
   * DB_SAVED 5분, GITHUB_QUEUED 15분, AI_QUEUED 30분 초과 시 재개 또는 FAILED 처리
   */
  private async checkSagaTimeouts(): Promise<void> {
    const stepsToCheck = [SagaStep.DB_SAVED, SagaStep.GITHUB_QUEUED, SagaStep.AI_QUEUED];

    for (const step of stepsToCheck) {
      const timeoutMs = SagaTimeoutService.STEP_TIMEOUTS[step];
      const cutoff = new Date(Date.now() - timeoutMs);

      const timedOut = await this.submissionRepo.find({
        where: {
          sagaStep: step,
          updatedAt: LessThan(cutoff),
        },
        take: 50, // 배치 제한
      });

      for (const submission of timedOut) {
        try {
          this.logger.warn(
            `Saga 타임아웃: submissionId=${submission.id}, step=${step}, updatedAt=${submission.updatedAt.toISOString()}`,
          );
          await this.resumeSaga(submission);
        } catch (error: unknown) {
          this.logger.error(
            `타임아웃 재개 실패: submissionId=${submission.id}, error=${(error as Error).message}`,
          );
        }
      }
    }
  }

  /**
   * 미완료 Saga 재개 -- 현재 step에 따라 다음 단계 실행
   * retryCount를 추적하여 MAX_SAGA_RETRIES 초과 시 FAILED로 전이
   */
  private async resumeSaga(submission: Submission): Promise<void> {
    const retryCount = (submission.sagaRetryCount ?? 0) + 1;

    this.logger.log(
      `Saga 재개: submissionId=${submission.id}, currentStep=${submission.sagaStep}, retryCount=${retryCount}/${SagaTimeoutService.MAX_SAGA_RETRIES}`,
    );

    // 최대 재시도 초과 -> FAILED 전이
    if (retryCount > SagaTimeoutService.MAX_SAGA_RETRIES) {
      this.logger.error(
        `Saga 최대 재시도 초과 -> FAILED: submissionId=${submission.id}, step=${submission.sagaStep}, retryCount=${retryCount}`,
      );
      await this.submissionRepo.update(submission.id, {
        sagaStep: SagaStep.FAILED,
        sagaRetryCount: retryCount,
      });
      return;
    }

    switch (submission.sagaStep) {
      case SagaStep.DB_SAVED:
        // advanceToGitHubQueued 내부에서 DB 업데이트 + MQ 발행 수행 (Orchestrator 위임)
        await this.submissionRepo.update(submission.id, { sagaRetryCount: retryCount });
        await this.orchestrator.advanceToGitHubQueued(submission.id, submission.studyId);
        break;
      case SagaStep.GITHUB_QUEUED:
        // updatedAt 갱신 + retryCount 증가 -> 다음 주기에 다시 잡히지 않음
        await this.submissionRepo.update(submission.id, { sagaRetryCount: retryCount });
        await this.mqPublisher.publishGitHubPush({
          submissionId: submission.id,
          studyId: submission.studyId,
          timestamp: new Date().toISOString(),
        });
        break;
      case SagaStep.AI_QUEUED: {
        // updatedAt 갱신 + retryCount 증가
        await this.submissionRepo.update(submission.id, { sagaRetryCount: retryCount });
        const retrySrcPlatform = await this.problemClient.getSourcePlatform(
          submission.problemId,
          submission.studyId,
          submission.userId,
        );
        await this.mqPublisher.publishAiAnalysis({
          submissionId: submission.id,
          studyId: submission.studyId,
          userId: submission.userId,
          sourcePlatform: retrySrcPlatform,
          timestamp: new Date().toISOString(),
        });
        break;
      }
      default:
        break;
    }
  }
}
