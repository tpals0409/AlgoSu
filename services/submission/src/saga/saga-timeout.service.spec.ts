import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SagaTimeoutService } from './saga-timeout.service';
import { SagaOrchestratorService } from './saga-orchestrator.service';
import { SagaQuotaService } from './saga-quota.service';
import { Submission, SagaStep, GitHubSyncStatus } from '../submission/submission.entity';
import { MqPublisherService } from './mq-publisher.service';
import { CircuitBreakerService } from '../common/circuit-breaker';
import { ProblemServiceClient } from '../common/problem-service-client';
import { StatsCacheService } from '../cache/stats-cache.service';

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

const mockProblemServiceClient = () => ({
  getSourcePlatform: jest.fn().mockResolvedValue('baekjoon'),
  getDeadline: jest.fn().mockResolvedValue({ isLate: false, weekNumber: null }),
  getProblemInfo: jest.fn().mockResolvedValue({ title: '', description: '' }),
});

const mockConfigService = () => ({
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
});

// ─── 테스트 헬퍼 ────────────────────────────────────────────────
const createMockSubmission = (overrides: Partial<Submission> = {}): Submission => ({
  id: 'sub-uuid-1',
  studyId: 'study-uuid-1',
  userId: 'user-1',
  problemId: 'problem-uuid-1',
  problemTitle: null,
  problemDescription: null,
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

describe('SagaTimeoutService', () => {
  let service: SagaTimeoutService;
  let repo: ReturnType<typeof mockSubmissionRepo>;
  let mqPublisher: ReturnType<typeof mockMqPublisher>;
  let problemClient: ReturnType<typeof mockProblemServiceClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SagaTimeoutService,
        // 실 Orchestrator/Quota 주입 — resumeSaga(DB_SAVED) 위임 경로를 동작 그대로 검증
        SagaOrchestratorService,
        SagaQuotaService,
        { provide: getRepositoryToken(Submission), useFactory: mockSubmissionRepo },
        { provide: MqPublisherService, useFactory: mockMqPublisher },
        { provide: CircuitBreakerService, useFactory: mockCircuitBreakerService },
        { provide: ProblemServiceClient, useFactory: mockProblemServiceClient },
        { provide: StatsCacheService, useValue: { invalidate: jest.fn().mockResolvedValue(undefined) } },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<SagaTimeoutService>(SagaTimeoutService);
    repo = module.get(getRepositoryToken(Submission));
    mqPublisher = module.get(MqPublisherService);
    problemClient = module.get(ProblemServiceClient);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.restoreAllMocks();
    // fake timer를 쓰는 테스트가 본문 중간에 throw해도 다음 테스트로 누수되지 않도록
    // 타이머 복원을 afterEach에서 일괄 보장한다(개별 테스트의 useRealTimers 의존 제거).
    jest.useRealTimers();
  });

  // ─── 1. onModuleInit() — 미완료 Saga 있음: 재개 호출 ─────────
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

  // ─── 2. onModuleInit() — 미완료 없음 ─────────────────────────
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
      // 타이머 복원은 afterEach가 일괄 처리한다.
      await service.onModuleDestroy();
    });

    it('2분 주기 타이머가 발화하면 checkSagaTimeouts를 호출한다', async () => {
      jest.useFakeTimers();
      repo.find.mockResolvedValue([]);

      await service.onModuleInit();
      const findCallsAfterInit = repo.find.mock.calls.length;

      // 타이머 콜백(setInterval arrow) 발화 → checkSagaTimeouts 호출
      jest.advanceTimersByTime(2 * 60 * 1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(repo.find.mock.calls.length).toBeGreaterThan(findCallsAfterInit);

      // 타이머 복원은 afterEach가 일괄 처리한다.
      await service.onModuleDestroy();
    });
  });

  // ─── 3. resumeSaga (DB_SAVED) — onModuleInit 통해 간접 테스트 ─
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

  // ─── 4. resumeSaga (GITHUB_QUEUED/AI_QUEUED) — updatedAt 갱신 + MQ 재발행 ────
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

    it('AI_QUEUED 재개 — getSourcePlatform fallback undefined 시 publish 그대로 진행', async () => {
      const aiQueued = createMockSubmission({
        id: 'sub-resume-ai',
        sagaStep: SagaStep.AI_QUEUED,
        createdAt: new Date(),
      });
      repo.find.mockResolvedValue([aiQueued]);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);
      problemClient.getSourcePlatform.mockResolvedValueOnce(undefined);

      await service.onModuleInit();

      expect(problemClient.getSourcePlatform).toHaveBeenCalled();
      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ sourcePlatform: undefined }),
      );
    });
  });

  // ─── 5. onModuleDestroy() ─────────────────────────────────────
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

  // ─── 6. onModuleInit — resumeSaga 실패 시 에러 로그 ──────────
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

  // ─── 7. onModuleInit — 타이머 설정 및 onModuleDestroy 정리 ───
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
      // 타이머 복원은 afterEach가 일괄 처리한다.
      await service.onModuleDestroy();

      // 에러 없이 완료되면 성공
      expect(true).toBe(true);
    });
  });

  // ─── 8. checkSagaTimeouts — 타임아웃 발생 시 재개 ─────────────
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
      // 타이머 복원은 afterEach가 일괄 처리한다.
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

  // ─── 9. resumeSaga — 최대 재시도 초과 시 FAILED ───────────────
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

  // ─── 10. resumeSaga — default 분기 (DONE/FAILED/AI_SKIPPED) ───
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
});
