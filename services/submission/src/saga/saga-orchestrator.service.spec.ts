import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SagaOrchestratorService } from './saga-orchestrator.service';
import { Submission, SagaStep, GitHubSyncStatus } from '../submission/submission.entity';
import { MqPublisherService } from './mq-publisher.service';
import { CircuitBreakerService } from '../common/circuit-breaker';

// ─── Mock 팩토리 ────────────────────────────────────────────────
const mockSubmissionRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockMqPublisher = () => ({
  publishGitHubPush: jest.fn(),
  publishAiAnalysis: jest.fn(),
});

const mockCircuitBreakerService = () => {
  const mockBreaker = { fire: jest.fn().mockResolvedValue(true) };
  return {
    createBreaker: jest.fn().mockReturnValue(mockBreaker),
    getBreaker: jest.fn().mockReturnValue(mockBreaker),
    getState: jest.fn().mockReturnValue('CLOSED'),
    _mockBreaker: mockBreaker,
  };
};

// ─── 테스트 헬퍼 ────────────────────────────────────────────────
const createMockSubmission = (overrides: Partial<Submission> = {}): Submission => ({
  id: 'sub-uuid-1',
  studyId: 'study-uuid-1',
  userId: 'user-1',
  problemId: 'problem-uuid-1',
  language: 'python',
  code: 'print("hello")',
  sagaStep: SagaStep.DB_SAVED,
  githubSyncStatus: GitHubSyncStatus.PENDING,
  githubFilePath: null,
  aiFeedback: null,
  aiScore: null,
  aiOptimizedCode: null,
  aiAnalysisStatus: 'pending',
  weekNumber: null,
  idempotencyKey: null,
  aiSkipped: false,
  isLate: false,
  sagaRetryCount: 0,
  publicId: 'pub-uuid-1',
  createdAt: new Date('2026-02-28T00:00:00Z'),
  updatedAt: new Date('2026-02-28T00:00:00Z'),
  generatePublicId: jest.fn(),
  ...overrides,
});

describe('SagaOrchestratorService', () => {
  let service: SagaOrchestratorService;
  let repo: jest.Mocked<Repository<Submission>>;
  let mqPublisher: jest.Mocked<MqPublisherService>;
  let cbService: ReturnType<typeof mockCircuitBreakerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SagaOrchestratorService,
        { provide: getRepositoryToken(Submission), useFactory: mockSubmissionRepo },
        { provide: MqPublisherService, useFactory: mockMqPublisher },
        { provide: CircuitBreakerService, useFactory: mockCircuitBreakerService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const map: Record<string, string> = {
                AI_ANALYSIS_SERVICE_URL: 'http://ai-analysis:8000',
                INTERNAL_KEY_AI_ANALYSIS: 'test-ai-key',
              };
              return map[key] ?? defaultValue ?? '';
            }),
            getOrThrow: jest.fn((key: string) => {
              const map: Record<string, string> = {
                AI_ANALYSIS_SERVICE_URL: 'http://ai-analysis:8000',
                INTERNAL_KEY_AI_ANALYSIS: 'test-ai-key',
              };
              const value = map[key];
              if (value === undefined) throw new Error(`Missing config: ${key}`);
              return value;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SagaOrchestratorService>(SagaOrchestratorService);
    repo = module.get(getRepositoryToken(Submission));
    mqPublisher = module.get(MqPublisherService);
    cbService = module.get(CircuitBreakerService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.restoreAllMocks();
  });

  // ─── 1. advanceToGitHubQueued() — 정상 ───────────────────────
  describe('advanceToGitHubQueued() — 정상', () => {
    it('DB 업데이트 먼저 -> MQ 발행 (멱등성 순서)', async () => {
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishGitHubPush.mockResolvedValue(undefined);

      // Act
      await service.advanceToGitHubQueued('sub-uuid-1', 'study-uuid-1');

      // Assert: DB 업데이트가 먼저 호출됨 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.DB_SAVED },
        { sagaStep: SagaStep.GITHUB_QUEUED },
      );
      expect(mqPublisher.publishGitHubPush).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-uuid-1',
          studyId: 'study-uuid-1',
        }),
      );

      // 순서 검증: update가 publishGitHubPush보다 먼저 호출
      const updateOrder = repo.update.mock.invocationCallOrder[0];
      const publishOrder = mqPublisher.publishGitHubPush.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(publishOrder);
    });

    it('affected=0이면 MQ 발행 없이 return한다 (낙관적 락)', async () => {
      repo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      await service.advanceToGitHubQueued('sub-uuid-1', 'study-uuid-1');

      expect(repo.update).toHaveBeenCalled();
      expect(mqPublisher.publishGitHubPush).not.toHaveBeenCalled();
    });
  });

  // ─── 2. advanceToGitHubQueued() — studyId 미전달 ─────────────
  describe('advanceToGitHubQueued() — studyId 미전달', () => {
    it('DB에서 submission을 조회하여 studyId를 사용한다', async () => {
      const submission = createMockSubmission({ studyId: 'study-from-db' });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishGitHubPush.mockResolvedValue(undefined);

      // Act — studyId 미전달
      await service.advanceToGitHubQueued('sub-uuid-1');

      // Assert
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'sub-uuid-1' } });
      expect(mqPublisher.publishGitHubPush).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-uuid-1',
          studyId: 'study-from-db',
        }),
      );
    });
  });

  // ─── 3. advanceToAiQueued() — 정상 ───────────────────────────
  describe('advanceToAiQueued()', () => {
    it('sagaStep=AI_QUEUED, githubSyncStatus=SYNCED로 업데이트 후 MQ 발행', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // Act
      await service.advanceToAiQueued('sub-uuid-1');

      // Assert (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        {
          sagaStep: SagaStep.AI_QUEUED,
          githubSyncStatus: GitHubSyncStatus.SYNCED,
        },
      );
      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-uuid-1',
          studyId: 'study-uuid-1',
        }),
      );
    });

    it('affected=0이면 MQ 발행 없이 return한다 (낙관적 락)', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      await service.advanceToAiQueued('sub-uuid-1');

      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });
  });

  // ─── 4. advanceToDone() — 완료 ───────────────────────────────
  describe('advanceToDone()', () => {
    it('sagaStep=DONE으로 업데이트한다', async () => {
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // Act
      await service.advanceToDone('sub-uuid-1');

      // Assert (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: expect.anything() },
        { sagaStep: SagaStep.DONE },
      );
    });

    it('affected=0이면 로그 warn 후 return한다 (낙관적 락)', async () => {
      repo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      await service.advanceToDone('sub-uuid-1');

      expect(repo.update).toHaveBeenCalled();
    });

    it('QueryRunner 경로에서도 낙관적 락이 적용된다', async () => {
      const mockQr = {
        manager: {
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        },
      } as any;

      await service.advanceToDone('sub-uuid-1', mockQr);

      expect(mockQr.manager.update).toHaveBeenCalledWith(
        Submission,
        { id: 'sub-uuid-1', sagaStep: expect.anything() },
        { sagaStep: SagaStep.DONE },
      );
    });

    it('QueryRunner 경로에서 affected=0이면 return한다', async () => {
      const mockQr = {
        manager: {
          update: jest.fn().mockResolvedValue({ affected: 0 }),
        },
      } as any;

      await service.advanceToDone('sub-uuid-1', mockQr);

      expect(mockQr.manager.update).toHaveBeenCalled();
    });
  });

  // ─── 5. compensateGitHubFailed() — 일반 실패: AI 분석 진행 ───
  describe('compensateGitHubFailed() — 일반 실패', () => {
    it('GitHub FAILED 시 githubSyncStatus 업데이트 후 AI 분석 진행 (githubSyncStatus 보존)', async () => {
      const submission = createMockSubmission();
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // CB fire -> true (기본 mock: quota 허용)

      // Act
      await service.compensateGitHubFailed('sub-uuid-1', GitHubSyncStatus.FAILED);

      // Assert: githubSyncStatus=FAILED 업데이트 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        { githubSyncStatus: GitHubSyncStatus.FAILED },
      );
      // AI 분석 진행 — githubSyncStatus를 SYNCED로 덮어쓰지 않음 (preserveGithubStatus=true)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        { sagaStep: SagaStep.AI_QUEUED },
      );
      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalled();
    });

    it('affected=0이면 AI 분석도 스킵한다 (낙관적 락)', async () => {
      repo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      await service.compensateGitHubFailed('sub-uuid-1', GitHubSyncStatus.FAILED);

      expect(repo.update).toHaveBeenCalledTimes(1);
      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });
  });

  // ─── 6. compensateGitHubFailed() — TOKEN_INVALID: AI 스킵 ────
  describe('compensateGitHubFailed() — TOKEN_INVALID', () => {
    it('TOKEN_INVALID이면 AI 분석을 스킵한다', async () => {
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // Act
      await service.compensateGitHubFailed('sub-uuid-1', GitHubSyncStatus.TOKEN_INVALID);

      // Assert: githubSyncStatus=TOKEN_INVALID 업데이트 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        { githubSyncStatus: GitHubSyncStatus.TOKEN_INVALID },
      );
      // Assert: DONE + AI skipped 처리
      expect(repo.update).toHaveBeenCalledWith('sub-uuid-1', {
        sagaStep: SagaStep.DONE,
        aiAnalysisStatus: 'skipped',
        aiSkipped: true,
      });
      // AI 분석 호출 없음
      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });
  });

  // ─── 7. compensateAiFailed() — DONE 처리 ─────────────────────
  describe('compensateAiFailed()', () => {
    it('AI 실패해도 제출은 DONE 처리한다', async () => {
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // Act
      await service.compensateAiFailed('sub-uuid-1');

      // Assert (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.AI_QUEUED },
        { sagaStep: SagaStep.DONE },
      );
    });

    it('affected=0이면 로그 warn 후 return한다 (낙관적 락)', async () => {
      repo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      await service.compensateAiFailed('sub-uuid-1');

      expect(repo.update).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 8. onModuleInit() — 미완료 Saga 있음: 재개 호출 ─────────
  describe('onModuleInit() — 미완료 Saga 있음', () => {
    it('1시간 이내 미완료 Saga를 찾아 재개한다', async () => {
      const incomplete = createMockSubmission({
        id: 'sub-incomplete',
        sagaStep: SagaStep.DB_SAVED,
        createdAt: new Date(), // 최근 생성
      });

      repo.find.mockResolvedValue([incomplete]);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishGitHubPush.mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert: find 호출 (미완료 Saga 검색)
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sagaStep: expect.anything(), // Not(In([DONE, FAILED]))
          }),
          order: { createdAt: 'ASC' },
        }),
      );
      // DB_SAVED 상태 -> advanceToGitHubQueued 호출됨 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-incomplete', sagaStep: SagaStep.DB_SAVED },
        { sagaStep: SagaStep.GITHUB_QUEUED },
      );
      expect(mqPublisher.publishGitHubPush).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-incomplete',
          studyId: 'study-uuid-1',
        }),
      );
    });
  });

  // ─── 9. onModuleInit() — 미완료 없음 ─────────────────────────
  describe('onModuleInit() — 미완료 없음', () => {
    it('미완료 Saga가 없으면 정상 시작 로그만 남긴다', async () => {
      repo.find.mockResolvedValue([]);

      // Act
      await service.onModuleInit();

      // Assert
      expect(repo.find).toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
      expect(mqPublisher.publishGitHubPush).not.toHaveBeenCalled();
      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });

    it('미완료 Saga가 없어도 타임아웃 체크 타이머를 설정한다', async () => {
      jest.useFakeTimers();

      repo.find.mockResolvedValue([]);

      await service.onModuleInit();

      // 타이머가 설정되었으므로 onModuleDestroy에서 정리됨 (에러 없이 완료)
      await service.onModuleDestroy();

      jest.useRealTimers();
    });
  });

  // ─── 10. resumeSaga (DB_SAVED) — onModuleInit 통해 간접 테스트 ─
  describe('resumeSaga (DB_SAVED)', () => {
    it('DB_SAVED 상태에서 retryCount 갱신 후 advanceToGitHubQueued를 호출한다', async () => {
      const dbSavedSubmission = createMockSubmission({
        id: 'sub-db-saved',
        sagaStep: SagaStep.DB_SAVED,
        studyId: 'study-resume-1',
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([dbSavedSubmission]);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishGitHubPush.mockResolvedValue(undefined);

      // Act (onModuleInit -> resumeSaga 간접 호출)
      await service.onModuleInit();

      // Assert: retryCount 갱신 (updatedAt 자동 갱신)
      expect(repo.update).toHaveBeenCalledWith('sub-db-saved', { sagaRetryCount: 1 });
      // Assert: advanceToGitHubQueued 경로 — DB 업데이트 + MQ 발행 (낙관적 락)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-db-saved', sagaStep: SagaStep.DB_SAVED },
        { sagaStep: SagaStep.GITHUB_QUEUED },
      );
      expect(mqPublisher.publishGitHubPush).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-db-saved',
          studyId: 'study-resume-1',
        }),
      );
    });
  });

  // ─── 11. resumeSaga (GITHUB_QUEUED/AI_QUEUED) — updatedAt 갱신 + MQ 재발행 ────
  describe('resumeSaga (GITHUB_QUEUED / AI_QUEUED)', () => {
    it('GITHUB_QUEUED 상태에서 retryCount 갱신 후 MQ GitHub Push를 재발행한다', async () => {
      const ghQueuedSubmission = createMockSubmission({
        id: 'sub-gh-queued',
        sagaStep: SagaStep.GITHUB_QUEUED,
        studyId: 'study-gh-1',
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([ghQueuedSubmission]);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishGitHubPush.mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert: retryCount 갱신 (updatedAt 자동 갱신으로 다음 주기에 재감지 방지)
      expect(repo.update).toHaveBeenCalledWith('sub-gh-queued', { sagaRetryCount: 1 });
      expect(mqPublisher.publishGitHubPush).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-gh-queued',
          studyId: 'study-gh-1',
        }),
      );
    });

    it('AI_QUEUED 상태에서 retryCount 갱신 후 MQ AI Analysis를 재발행한다', async () => {
      const aiQueuedSubmission = createMockSubmission({
        id: 'sub-ai-queued',
        sagaStep: SagaStep.AI_QUEUED,
        studyId: 'study-ai-1',
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([aiQueuedSubmission]);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert: retryCount 갱신 (updatedAt 자동 갱신으로 다음 주기에 재감지 방지)
      expect(repo.update).toHaveBeenCalledWith('sub-ai-queued', { sagaRetryCount: 1 });
      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-ai-queued',
          studyId: 'study-ai-1',
        }),
      );
    });
  });

  // ─── 12. advanceToAiQueued() — Submission 미발견 ───────────────
  describe('advanceToAiQueued() — Submission 미발견', () => {
    it('submission이 없으면 early return한다', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.advanceToAiQueued('non-existent');

      expect(repo.update).not.toHaveBeenCalled();
      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });
  });

  // ─── 13. advanceToAiQueued() — AI 한도 초과 ───────────────────
  describe('advanceToAiQueued() — AI 한도 초과', () => {
    it('AI 한도 초과 시 DONE으로 직행하고 aiSkipped=true로 표시한다', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // CB fire가 false를 반환하도록 mock (한도 초과)
      cbService._mockBreaker.fire.mockResolvedValueOnce(false);

      await service.advanceToAiQueued('sub-uuid-1');

      // 한도 초과 → DONE 직행 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        expect.objectContaining({
          sagaStep: SagaStep.DONE,
          aiSkipped: true,
          aiAnalysisStatus: 'skipped',
        }),
      );
      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });
  });

  // ─── 14. advanceToAiQueued() — preserveGithubStatus ───────────
  describe('advanceToAiQueued() — preserveGithubStatus=true', () => {
    it('githubSyncStatus를 덮어쓰지 않는다', async () => {
      const submission = createMockSubmission({
        sagaStep: SagaStep.GITHUB_QUEUED,
        githubSyncStatus: GitHubSyncStatus.SKIPPED,
      });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // CB fire -> true (기본 mock: quota 허용)

      await service.advanceToAiQueued('sub-uuid-1', true);

      // githubSyncStatus가 포함되지 않음 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        { sagaStep: SagaStep.AI_QUEUED },
      );
    });
  });

  // ─── 15. compensateGitHubFailed() — SKIPPED ───────────────────
  describe('compensateGitHubFailed() — SKIPPED', () => {
    it('SKIPPED이면 preserveGithubStatus=true로 advanceToAiQueued를 호출한다', async () => {
      const submission = createMockSubmission();
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // CB fire -> true (기본 mock: quota 허용)

      await service.compensateGitHubFailed('sub-uuid-1', GitHubSyncStatus.SKIPPED);

      // githubSyncStatus=SKIPPED 업데이트 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        { githubSyncStatus: GitHubSyncStatus.SKIPPED },
      );
      // AI 분석은 진행됨
      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalled();
    });
  });

  // ─── 16. onModuleDestroy() ────────────────────────────────────
  describe('onModuleDestroy()', () => {
    it('타이머가 있으면 정리한다', async () => {
      // onModuleInit에서 타이머 설정
      repo.find.mockResolvedValue([]);
      await service.onModuleInit();

      // Act
      await service.onModuleDestroy();

      // 에러 없이 완료되면 성공
      expect(true).toBe(true);
    });

    it('타이머가 없으면 에러 없이 완료한다', async () => {
      await service.onModuleDestroy();
      expect(true).toBe(true);
    });
  });

  // ─── 17. checkAiQuota — CB 장애 시 fallback 허용 ───────────────
  describe('advanceToAiQueued() — quota 체크 실패 (CB fallback)', () => {
    it('CB fire 예외 시에도 AI 분석을 허용한다 (방어적 catch)', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // CB fire가 예외를 던지는 경우 (방어적 코드 경로)
      cbService._mockBreaker.fire.mockRejectedValueOnce(new Error('CB error'));

      await service.advanceToAiQueued('sub-uuid-1');

      // 방어적 catch로 AI 분석 허용 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        {
          sagaStep: SagaStep.AI_QUEUED,
          githubSyncStatus: GitHubSyncStatus.SYNCED,
        },
      );
      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalled();
    });

    it('CB fire가 true를 반환하면 AI 분석을 진행한다 (정상 허용)', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // 기본 mock: fire -> true
      await service.advanceToAiQueued('sub-uuid-1');

      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalled();
    });
  });

  // ─── 18. onModuleInit — resumeSaga 실패 시 에러 로그 ──────────
  describe('onModuleInit() — resumeSaga 실패', () => {
    it('개별 Saga 재개 실패 시 에러를 로그하고 나머지를 계속한다', async () => {
      const failSubmission = createMockSubmission({
        id: 'sub-fail',
        sagaStep: SagaStep.DB_SAVED,
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([failSubmission]);
      repo.update.mockRejectedValue(new Error('DB error'));

      // Act — 에러가 발생해도 throw되지 않음
      await service.onModuleInit();

      expect(repo.find).toHaveBeenCalled();
    });
  });

  // ─── 19. onModuleInit — 타이머 설정 및 onModuleDestroy 정리 ───
  describe('onModuleInit() — 미완료 Saga 있음 → 타이머 설정', () => {
    it('미완료 Saga 재개 후 타임아웃 체크 타이머를 설정한다', async () => {
      jest.useFakeTimers();

      const incomplete = createMockSubmission({
        id: 'sub-timer-test',
        sagaStep: SagaStep.DB_SAVED,
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([incomplete]);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishGitHubPush.mockResolvedValue(undefined);

      await service.onModuleInit();

      // 타이머가 설정되었으므로 onModuleDestroy에서 정리됨
      await service.onModuleDestroy();

      jest.useRealTimers();

      // 에러 없이 완료되면 성공
      expect(true).toBe(true);
    });
  });

  // ─── 20. checkSagaTimeouts — 타임아웃 발생 시 재개 ─────────────
  describe('checkSagaTimeouts() — 타임아웃 Saga 재개', () => {
    it('타임아웃된 DB_SAVED Saga를 재개한다', async () => {
      jest.useFakeTimers();

      // 첫 번째 find는 onModuleInit에서 호출 (미완료 없음)
      repo.find
        .mockResolvedValueOnce([]) // onModuleInit - 미완료 없음
        .mockResolvedValueOnce([  // checkSagaTimeouts - DB_SAVED 타임아웃
          createMockSubmission({
            id: 'sub-timeout-db',
            sagaStep: SagaStep.DB_SAVED,
            updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10분 전
          }),
        ])
        .mockResolvedValue([]); // 나머지 step들 — 없음

      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishGitHubPush.mockResolvedValue(undefined);

      // onModuleInit — 미완료 없음이지만 타이머는 항상 설정됨
      await service.onModuleInit();

      // checkSagaTimeouts를 직접 호출하기 위해 private 메서드 접근
      await (service as any).checkSagaTimeouts();

      expect(repo.find).toHaveBeenCalledTimes(4); // onModuleInit 1 + checkSagaTimeouts 3 steps
      // retryCount 갱신 (updatedAt 자동 갱신)
      expect(repo.update).toHaveBeenCalledWith('sub-timeout-db', { sagaRetryCount: 1 });
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-timeout-db', sagaStep: SagaStep.DB_SAVED },
        { sagaStep: SagaStep.GITHUB_QUEUED },
      );
      expect(mqPublisher.publishGitHubPush).toHaveBeenCalledWith(
        expect.objectContaining({ submissionId: 'sub-timeout-db' }),
      );

      jest.useRealTimers();
    });

    it('타임아웃 재개 실패 시 에러 로그 후 계속 진행한다', async () => {
      repo.find
        .mockResolvedValueOnce([]) // onModuleInit - 미완료 없음 (타이머는 항상 설정)
        .mockResolvedValueOnce([  // checkSagaTimeouts - DB_SAVED 타임아웃
          createMockSubmission({
            id: 'sub-timeout-fail',
            sagaStep: SagaStep.DB_SAVED,
            updatedAt: new Date(Date.now() - 10 * 60 * 1000),
          }),
        ])
        .mockResolvedValue([]); // 나머지 step들

      repo.update.mockRejectedValue(new Error('timeout resume error'));

      // checkSagaTimeouts 직접 호출 — 에러가 throw되지 않아야 함
      await expect((service as any).checkSagaTimeouts()).resolves.not.toThrow();
    });
  });

  // ─── 21. resumeSaga — 최대 재시도 초과 시 FAILED ───────────────
  describe('resumeSaga() — 최대 재시도 초과', () => {
    it('retryCount가 3을 초과하면 FAILED로 전이한다', async () => {
      const maxRetriedSubmission = createMockSubmission({
        id: 'sub-max-retry',
        sagaStep: SagaStep.GITHUB_QUEUED,
        sagaRetryCount: 3, // 이미 3회 시도 -> 다음은 4회 -> 초과
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([maxRetriedSubmission]);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // Act (onModuleInit -> resumeSaga 간접 호출)
      await service.onModuleInit();

      // Assert: FAILED 전이 + retryCount 기록
      expect(repo.update).toHaveBeenCalledWith('sub-max-retry', {
        sagaStep: SagaStep.FAILED,
        sagaRetryCount: 4,
      });
      // MQ 재발행 없음
      expect(mqPublisher.publishGitHubPush).not.toHaveBeenCalled();
      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });

    it('retryCount가 정확히 3이면 아직 재시도한다', async () => {
      const retrySubmission = createMockSubmission({
        id: 'sub-retry-3',
        sagaStep: SagaStep.GITHUB_QUEUED,
        sagaRetryCount: 2, // 이미 2회 시도 -> 다음은 3회 -> 허용
        studyId: 'study-retry',
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([retrySubmission]);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishGitHubPush.mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert: retryCount 갱신 후 MQ 재발행
      expect(repo.update).toHaveBeenCalledWith('sub-retry-3', { sagaRetryCount: 3 });
      expect(mqPublisher.publishGitHubPush).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-retry-3',
          studyId: 'study-retry',
        }),
      );
    });
  });

  // ─── 22. resumeSaga — default 분기 (DONE/FAILED/AI_SKIPPED) ───
  describe('resumeSaga() — default 분기', () => {
    it('DONE 상태의 Submission은 아무것도 하지 않는다', async () => {
      const doneSubmission = createMockSubmission({
        id: 'sub-done',
        sagaStep: SagaStep.DONE,
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([doneSubmission]);

      await service.onModuleInit();

      // DONE 상태 → resumeSaga default 분기 → update/publish 없음
      expect(repo.update).not.toHaveBeenCalled();
      expect(mqPublisher.publishGitHubPush).not.toHaveBeenCalled();
      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });
  });

  // ─── 23. CB 통합: AI 서비스 장애 시 fallback → Saga 계속 ────────
  describe('Circuit Breaker 통합', () => {
    it('AI 서비스 장애 시 CB OPEN → fallback true → Saga 계속 진행', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // CB fallback 시뮬레이션: fire가 true 반환 (기본 mock)
      await service.advanceToAiQueued('sub-uuid-1');

      // fallback true → AI 분석 진행
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        {
          sagaStep: SagaStep.AI_QUEUED,
          githubSyncStatus: GitHubSyncStatus.SYNCED,
        },
      );
      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalled();
    });

    it('CB OPEN 상태에서도 submissionRepo.save 정상 실행 (보상 트랜잭션 무관)', async () => {
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // CB 상태와 관계없이 보상 트랜잭션은 정상 동작
      await service.compensateAiFailed('sub-uuid-1');

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.AI_QUEUED },
        { sagaStep: SagaStep.DONE },
      );
    });

    it('onModuleInit에서 CB가 생성된다', async () => {
      repo.find.mockResolvedValue([]);
      await service.onModuleInit();

      expect(cbService.createBreaker).toHaveBeenCalledWith(
        'aiQuotaCheck',
        expect.any(Function),
        expect.objectContaining({ fallback: expect.any(Function) }),
      );
    });
  });

  // ─── 24. fetchAiQuota — CB action 본체 직접 검증 ────────────────
  describe('fetchAiQuota (CB action 본체)', () => {
    it('200 OK + allowed=true 응답 시 true 반환', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { allowed: true, used: 1, limit: 10 } }),
      } as never);

      const result = await (
        service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }
      ).fetchAiQuota('user-1');

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/quota/check?userId=user-1'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Internal-Key': expect.any(String),
          }),
        }),
      );
      fetchSpy.mockRestore();
    });

    it('200 OK + allowed=false 응답 시 false 반환', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { allowed: false, used: 10, limit: 10 } }),
      } as never);

      const result = await (
        service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }
      ).fetchAiQuota('user-2');

      expect(result).toBe(false);
      fetchSpy.mockRestore();
    });

    it('non-2xx 응답 시 throw — CB가 failure로 기록 가능', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as never);

      await expect(
        (service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }).fetchAiQuota(
          'user-3',
        ),
      ).rejects.toThrow('AI quota check failed: status=503');
      fetchSpy.mockRestore();
    });

    it('non-2xx 응답 시 throw된 에러에 status 속성이 첨부된다 (Sprint 135 D8)', async () => {
      // CB DEFAULT_ERROR_FILTER가 status로 분기 가능하도록 buildHttpError 사용
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as never);

      let captured: (Error & { status?: number }) | undefined;
      try {
        await (
          service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }
        ).fetchAiQuota('user-503');
      } catch (e) {
        captured = e as Error & { status?: number };
      }

      expect(captured).toBeInstanceOf(Error);
      expect(captured?.status).toBe(503);
      fetchSpy.mockRestore();
    });

    it('non-2xx 404 응답 시 throw된 에러 status가 404로 첨부 (errorFilter 화이트리스트 통과)', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as never);

      let captured: (Error & { status?: number }) | undefined;
      try {
        await (
          service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }
        ).fetchAiQuota('user-404');
      } catch (e) {
        captured = e as Error & { status?: number };
      }

      expect(captured?.status).toBe(404);
      fetchSpy.mockRestore();
    });

    it('fetch 자체 throw 시 그대로 전파 — CB가 failure로 기록 가능', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch' as never)
        .mockRejectedValueOnce(new Error('network down') as never);

      await expect(
        (service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }).fetchAiQuota(
          'user-4',
        ),
      ).rejects.toThrow('network down');
      fetchSpy.mockRestore();
    });
  });
});
