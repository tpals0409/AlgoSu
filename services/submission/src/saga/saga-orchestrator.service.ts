/**
 * @file Saga Orchestrator -- 제출 플로우 상태 관리
 * @domain submission
 * @layer service
 * @related MqPublisherService, Submission, AIAnalysisWorker
 * @guard ai-quota
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, Not, In, MoreThan, LessThan, QueryRunner } from 'typeorm';
import { Submission, SagaStep, GitHubSyncStatus } from '../submission/submission.entity';
import { MqPublisherService } from './mq-publisher.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * Saga Orchestrator -- 제출 플로우 상태 관리
 *
 * 플로우: DB_SAVED -> GITHUB_QUEUED -> (quota check) -> AI_QUEUED | AI_SKIPPED -> DONE
 *
 * 멱등성 보장 순서 (필수):
 * 1. DB 업데이트 (saga_step 갱신) -- 먼저
 * 2. RabbitMQ 발행 -- 나중
 * -> 역순 시 서비스 재시작 후 중복 발행 위험
 *
 * 보안: SQL 파라미터 바인딩 (TypeORM), Log Injection 방지
 */
@Injectable()
export class SagaOrchestratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: StructuredLoggerService;

  // M3: 단계별 타임아웃 (설계서 기준)
  private static readonly STEP_TIMEOUTS: Record<SagaStep, number> = {
    [SagaStep.DB_SAVED]: 5 * 60 * 1000,       // 5분
    [SagaStep.GITHUB_QUEUED]: 15 * 60 * 1000,  // 15분
    [SagaStep.AI_QUEUED]: 30 * 60 * 1000,      // 30분
    [SagaStep.AI_SKIPPED]: 0,
    [SagaStep.DONE]: 0,
    [SagaStep.FAILED]: 0,
  };
  private static readonly TIMEOUT_CHECK_INTERVAL = 2 * 60 * 1000; // 2분마다 체크
  private timeoutTimer: ReturnType<typeof setInterval> | null = null;

  private readonly aiAnalysisServiceUrl: string;
  private readonly aiAnalysisInternalKey: string;

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly mqPublisher: MqPublisherService,
    private readonly configService: ConfigService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(SagaOrchestratorService.name);
    this.aiAnalysisServiceUrl = this.configService.get<string>(
      'AI_ANALYSIS_SERVICE_URL',
      'http://ai-analysis-service:8000',
    );
    this.aiAnalysisInternalKey = this.configService.get<string>(
      'INTERNAL_KEY_AI_ANALYSIS',
      '',
    );
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
        sagaStep: Not(In([SagaStep.DONE, SagaStep.FAILED, SagaStep.AI_SKIPPED])),
        createdAt: MoreThan(oneHourAgo),
      },
      order: { createdAt: 'ASC' },
    });

    if (incompleteSubmissions.length === 0) {
      this.logger.log('미완료 Saga 없음 -- 정상 시작');
      return;
    }

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

    // M3: 주기적 타임아웃 체크 시작
    this.timeoutTimer = setInterval(() => {
      void this.checkSagaTimeouts();
    }, SagaOrchestratorService.TIMEOUT_CHECK_INTERVAL);
    this.logger.log('Saga 타임아웃 체크 시작 (2분 주기)');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = null;
    }
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
   * Step 2 완료: GitHub Push 성공 -> AI 한도 체크 -> AI_QUEUED 또는 AI_SKIPPED
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

    // AI 일일 한도 체크 (AI Analysis Service 호출)
    const quotaAllowed = await this.checkAiQuota(submission.userId);

    // preserveGithubStatus=true일 때 githubSyncStatus를 덮어쓰지 않음
    const githubStatusUpdate = preserveGithubStatus
      ? {}
      : { githubSyncStatus: GitHubSyncStatus.SYNCED };

    if (!quotaAllowed) {
      // 한도 초과 -> AI_SKIPPED (DONE으로 직행)
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
          `Saga 상태 전이 스킵 (낙관적 락): submissionId=${submissionId}, expected=GITHUB_QUEUED (AI_SKIPPED 경로)`,
        );
        return;
      }

      this.logger.log(
        `AI 한도 초과 -> AI_SKIPPED: submissionId=${submissionId}, userId=${submission.userId}`,
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

    await this.mqPublisher.publishAiAnalysis({
      submissionId,
      studyId: submission.studyId,
      userId: submission.userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Saga Step 3 진입: submissionId=${submissionId}, step=AI_QUEUED`);
  }

  /**
   * AI 일일 한도 체크 -- AI Analysis Service /quota/check API 호출
   *
   * @guard ai-quota
   * @param userId 사용자 ID
   * @returns true: 허용, false: 한도 초과
   */
  private async checkAiQuota(userId: string): Promise<boolean> {
    try {
      const resp = await fetch(
        `${this.aiAnalysisServiceUrl}/quota/check?userId=${encodeURIComponent(userId)}`,
        {
          method: 'POST',
          headers: {
            'X-Internal-Key': this.aiAnalysisInternalKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!resp.ok) {
        this.logger.warn(`AI 한도 체크 API 오류: status=${resp.status}`);
        // API 실패 시 허용 (AI 분석 실패보다 나음)
        return true;
      }

      const body = (await resp.json()) as { data: { allowed: boolean; used: number; limit: number } };
      return body.data.allowed;
    } catch (error: unknown) {
      this.logger.error(`AI 한도 체크 실패: ${(error as Error).message}`);
      // 네트워크 오류 시 허용 (AI 분석 실패보다 나음)
      return true;
    }
  }

  /**
   * Step 3 완료: AI 분석 성공 -> DONE
   * @param queryRunner 외부 트랜잭션 참여 시 전달 (updateAiResult 원자성 보장)
   */
  async advanceToDone(submissionId: string, queryRunner?: QueryRunner): Promise<void> {
    // 낙관적 락: WHERE sagaStep IN (AI_QUEUED, AI_SKIPPED)
    const expectedSteps = In([SagaStep.AI_QUEUED, SagaStep.AI_SKIPPED]);

    if (queryRunner) {
      const result = await queryRunner.manager.update(
        Submission,
        { id: submissionId, sagaStep: expectedSteps },
        { sagaStep: SagaStep.DONE },
      );

      if (result.affected === 0) {
        this.logger.warn(
          `Saga 상태 전이 스킵 (낙관적 락): submissionId=${submissionId}, expected=AI_QUEUED|AI_SKIPPED (QR 경로)`,
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
          `Saga 상태 전이 스킵 (낙관적 락): submissionId=${submissionId}, expected=AI_QUEUED|AI_SKIPPED`,
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

    // GitHub 실패해도 AI 분석은 진행 (GitHub 동기화와 독립)
    // TOKEN_INVALID인 경우만 AI 분석도 스킵
    // SKIPPED인 경우 githubSyncStatus를 SYNCED로 덮어쓰지 않음
    if (syncStatus !== GitHubSyncStatus.TOKEN_INVALID) {
      const preserveGithubStatus = syncStatus === GitHubSyncStatus.SKIPPED;
      await this.advanceToAiQueued(submissionId, preserveGithubStatus);
    } else {
      // TOKEN_INVALID: sagaStep을 DONE으로 전환하여 타임아웃 재발행 루프 방지
      await this.submissionRepo.update(submissionId, {
        sagaStep: SagaStep.DONE,
      });
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

    this.logger.warn(`AI 분석 실패 -- 제출은 DONE 처리: submissionId=${submissionId}`);
  }

  /**
   * M3: 단계별 타임아웃 체크 Cron
   * DB_SAVED 5분, GITHUB_QUEUED 15분, AI_QUEUED 30분 초과 시 재개 또는 FAILED 처리
   */
  private async checkSagaTimeouts(): Promise<void> {
    const stepsToCheck = [SagaStep.DB_SAVED, SagaStep.GITHUB_QUEUED, SagaStep.AI_QUEUED];

    for (const step of stepsToCheck) {
      const timeoutMs = SagaOrchestratorService.STEP_TIMEOUTS[step];
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
   */
  private async resumeSaga(submission: Submission): Promise<void> {
    this.logger.log(
      `Saga 재개: submissionId=${submission.id}, currentStep=${submission.sagaStep}`,
    );

    switch (submission.sagaStep) {
      case SagaStep.DB_SAVED:
        await this.advanceToGitHubQueued(submission.id, submission.studyId);
        break;
      case SagaStep.GITHUB_QUEUED:
        // GitHub Push 재시도는 Worker가 처리 -- 여기서는 재발행만
        await this.mqPublisher.publishGitHubPush({
          submissionId: submission.id,
          studyId: submission.studyId,
          timestamp: new Date().toISOString(),
        });
        break;
      case SagaStep.AI_QUEUED:
        // AI 분석 재시도
        await this.mqPublisher.publishAiAnalysis({
          submissionId: submission.id,
          studyId: submission.studyId,
          userId: submission.userId,
          timestamp: new Date().toISOString(),
        });
        break;
      default:
        break;
    }
  }
}
