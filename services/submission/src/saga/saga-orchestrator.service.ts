/**
 * @file Saga Orchestrator -- 제출 플로우 상태 전이 + 보상 트랜잭션
 * @domain submission
 * @layer service
 * @related MqPublisherService, SagaQuotaService, SagaTimeoutService, Submission
 * @guard ai-quota
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryRunner } from 'typeorm';
import { Submission, SagaStep, GitHubSyncStatus } from '../submission/submission.entity';
import { MqPublisherService } from './mq-publisher.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { ProblemServiceClient } from '../common/problem-service-client';
import { StatsCacheService } from '../cache/stats-cache.service';
import { SagaQuotaService } from './saga-quota.service';

/**
 * Saga Orchestrator -- 제출 플로우 상태 전이 + 보상 트랜잭션
 *
 * 플로우: DB_SAVED -> GITHUB_QUEUED -> (quota check) -> AI_QUEUED -> DONE (한도 초과 시 DONE 직행, aiSkipped=true)
 *
 * 멱등성 보장 순서 (필수):
 * 1. DB 업데이트 (saga_step 갱신) -- 먼저
 * 2. RabbitMQ 발행 -- 나중
 * -> 역순 시 서비스 재시작 후 중복 발행 위험
 *
 * 책임 분리(ADR-030 Q-2):
 * - AI 한도 체크 + Circuit Breaker -> SagaQuotaService
 * - 미완료 Saga 재개 + 타임아웃 체크 -> SagaTimeoutService
 * - 본 서비스는 advanceTo* / compensate* 상태 전이만 담당
 *
 * 보안: SQL 파라미터 바인딩 (TypeORM), Log Injection 방지
 */
@Injectable()
export class SagaOrchestratorService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly mqPublisher: MqPublisherService,
    private readonly problemClient: ProblemServiceClient,
    private readonly statsCache: StatsCacheService,
    private readonly quotaService: SagaQuotaService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(SagaOrchestratorService.name);
  }

  /**
   * Step 1: DB 저장 완료 -> GitHub Push 큐 발행
   * MQ 메시지에 studyId 포함 -- Worker가 studies.github_repo 조회하여 SKIPPED 판단
   */
  async advanceToGitHubQueued(submissionId: string, studyId?: string): Promise<void> {
    // studyId 미전달 시 (Saga 재개 경로) DB에서 조회
    let resolvedStudyId = studyId;
    if (!resolvedStudyId) {
      const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
      resolvedStudyId = submission?.studyId;
    }

    // 멱등성 순서: DB 먼저 -> MQ 나중
    // 낙관적 락: WHERE sagaStep = DB_SAVED 조건으로 역진행 방지
    const result = await this.submissionRepo.update(
      { id: submissionId, sagaStep: SagaStep.DB_SAVED },
      { sagaStep: SagaStep.GITHUB_QUEUED },
    );

    if (result.affected === 0) {
      this.logger.warn(
        `Saga 상태 전이 스킵 (낙관적 락): submissionId=${submissionId}, expected=DB_SAVED`,
      );
      return;
    }

    await this.mqPublisher.publishGitHubPush({
      submissionId,
      studyId: resolvedStudyId!,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Saga Step 2 진입: submissionId=${submissionId}, studyId=${resolvedStudyId}, step=GITHUB_QUEUED`);
  }

  /**
   * Step 2 완료: GitHub Push 성공 -> AI 한도 체크 -> AI_QUEUED 또는 DONE(aiSkipped)
   *
   * @guard ai-quota
   * @param submissionId 제출 ID
   * @param preserveGithubStatus true이면 githubSyncStatus를 그대로 유지 (SKIPPED 등)
   */
  async advanceToAiQueued(
    submissionId: string,
    preserveGithubStatus = false,
  ): Promise<void> {
    const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission) {
      this.logger.error(`Submission 미발견: submissionId=${submissionId}`);
      return;
    }

    // AI 일일 한도 체크 (AI Analysis Service 호출 — SagaQuotaService 위임)
    const quotaAllowed = await this.quotaService.checkAiQuota(submission.userId);

    // preserveGithubStatus=true일 때 githubSyncStatus를 덮어쓰지 않음
    const githubStatusUpdate = preserveGithubStatus
      ? {}
      : { githubSyncStatus: GitHubSyncStatus.SYNCED };

    if (!quotaAllowed) {
      // 한도 초과 -> DONE 직행 (aiSkipped=true)
      // 낙관적 락: WHERE sagaStep = GITHUB_QUEUED
      const skipResult = await this.submissionRepo.update(
        { id: submissionId, sagaStep: SagaStep.GITHUB_QUEUED },
        {
          sagaStep: SagaStep.DONE,
          ...githubStatusUpdate,
          aiSkipped: true,
          aiAnalysisStatus: 'skipped',
        },
      );

      if (skipResult.affected === 0) {
        this.logger.warn(
          `Saga 상태 전이 스킵 (낙관적 락): submissionId=${submissionId}, expected=GITHUB_QUEUED (aiSkipped 경로)`,
        );
        return;
      }

      // 통계 캐시 무효화 — DONE 전환으로 통계 변경
      await this.statsCache.invalidate(submission.studyId);

      this.logger.log(
        `AI 한도 초과 -> DONE(aiSkipped): submissionId=${submissionId}, userId=${submission.userId}`,
      );
      return;
    }

    // 한도 내 -> AI 분석 큐 발행
    // 낙관적 락: WHERE sagaStep = GITHUB_QUEUED
    const result = await this.submissionRepo.update(
      { id: submissionId, sagaStep: SagaStep.GITHUB_QUEUED },
      {
        sagaStep: SagaStep.AI_QUEUED,
        ...githubStatusUpdate,
      },
    );

    if (result.affected === 0) {
      this.logger.warn(
        `Saga 상태 전이 스킵 (낙관적 락): submissionId=${submissionId}, expected=GITHUB_QUEUED`,
      );
      return;
    }

    const sourcePlatform = await this.problemClient.getSourcePlatform(
      submission.problemId,
      submission.studyId,
      submission.userId,
    );

    await this.mqPublisher.publishAiAnalysis({
      submissionId,
      studyId: submission.studyId,
      userId: submission.userId,
      sourcePlatform,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Saga Step 3 진입: submissionId=${submissionId}, step=AI_QUEUED`);
  }

  /**
   * Step 3 완료: AI 분석 성공 -> DONE
   * @param queryRunner 외부 트랜잭션 참여 시 전달 (updateAiResult 원자성 보장)
   */
  async advanceToDone(submissionId: string, queryRunner?: QueryRunner): Promise<void> {
    // 낙관적 락: WHERE sagaStep = AI_QUEUED
    const expectedSteps = In([SagaStep.AI_QUEUED]);

    if (queryRunner) {
      const result = await queryRunner.manager.update(
        Submission,
        { id: submissionId, sagaStep: expectedSteps },
        { sagaStep: SagaStep.DONE },
      );

      if (result.affected === 0) {
        this.logger.warn(
          `Saga 상태 전이 스킵 (낙관적 락): submissionId=${submissionId}, expected=AI_QUEUED (QR 경로)`,
        );
        return;
      }
    } else {
      const result = await this.submissionRepo.update(
        { id: submissionId, sagaStep: expectedSteps },
        { sagaStep: SagaStep.DONE },
      );

      if (result.affected === 0) {
        this.logger.warn(
          `Saga 상태 전이 스킵 (낙관적 락): submissionId=${submissionId}, expected=AI_QUEUED`,
        );
        return;
      }
    }

    this.logger.log(`Saga 완료: submissionId=${submissionId}, step=DONE`);
  }

  /**
   * 보상 트랜잭션: GitHub Push 실패
   */
  async compensateGitHubFailed(
    submissionId: string,
    syncStatus: GitHubSyncStatus,
  ): Promise<void> {
    // 낙관적 락: WHERE sagaStep = GITHUB_QUEUED
    const result = await this.submissionRepo.update(
      { id: submissionId, sagaStep: SagaStep.GITHUB_QUEUED },
      { githubSyncStatus: syncStatus },
    );

    if (result.affected === 0) {
      this.logger.warn(
        `Saga 보상 트랜잭션 스킵 (낙관적 락): submissionId=${submissionId}, expected=GITHUB_QUEUED (compensateGitHubFailed)`,
      );
      return;
    }

    // GitHub 실패/스킵해도 AI 분석은 진행 (GitHub 동기화와 독립)
    // TOKEN_INVALID인 경우만 AI 분석도 스킵
    // FAILED/SKIPPED인 경우 githubSyncStatus를 SYNCED로 덮어쓰지 않음
    if (syncStatus !== GitHubSyncStatus.TOKEN_INVALID) {
      await this.advanceToAiQueued(submissionId, true);
    } else {
      // TOKEN_INVALID: sagaStep을 DONE으로 전환하여 타임아웃 재발행 루프 방지
      // ai_analysis_status도 skipped 처리하여 프론트엔드 무한 로딩 방지
      await this.submissionRepo.update(submissionId, {
        sagaStep: SagaStep.DONE,
        aiAnalysisStatus: 'skipped',
        aiSkipped: true,
      });

      // 통계 캐시 무효화 — DONE 전환으로 통계 변경
      const tokenInvalidSub = await this.submissionRepo.findOne({ where: { id: submissionId }, select: ['studyId'] });
      if (tokenInvalidSub) await this.statsCache.invalidate(tokenInvalidSub.studyId);

      this.logger.warn(
        `GitHub TOKEN_INVALID -- AI 분석 스킵, DONE 처리: submissionId=${submissionId}`,
      );
    }
  }

  /**
   * 보상 트랜잭션: AI 분석 실패
   */
  async compensateAiFailed(submissionId: string): Promise<void> {
    // AI 실패해도 제출 자체는 DONE 처리 (분석만 DELAYED)
    // 낙관적 락: WHERE sagaStep = AI_QUEUED
    const result = await this.submissionRepo.update(
      { id: submissionId, sagaStep: SagaStep.AI_QUEUED },
      { sagaStep: SagaStep.DONE },
    );

    if (result.affected === 0) {
      this.logger.warn(
        `Saga 보상 트랜잭션 스킵 (낙관적 락): submissionId=${submissionId}, expected=AI_QUEUED (compensateAiFailed)`,
      );
      return;
    }

    // 통계 캐시 무효화 — DONE 전환으로 통계 변경
    const aiFailedSub = await this.submissionRepo.findOne({ where: { id: submissionId }, select: ['studyId'] });
    if (aiFailedSub) await this.statsCache.invalidate(aiFailedSub.studyId);

    this.logger.warn(`AI 분석 실패 -- 제출은 DONE 처리: submissionId=${submissionId}`);
  }
}
