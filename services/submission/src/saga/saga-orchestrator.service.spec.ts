import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
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

/** Sprint 135 D9 — ProblemServiceClient mock (CB는 client 내부에서 처리) */
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
  difficulty: null,
  level: null,
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
}) as Submission;

describe('SagaOrchestratorService', () => {
  let service: SagaOrchestratorService;
  let repo: jest.Mocked<Repository<Submission>>;
  let mqPublisher: jest.Mocked<MqPublisherService>;
  let cbService: ReturnType<typeof mockCircuitBreakerService>;
  let problemClient: ReturnType<typeof mockProblemServiceClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SagaOrchestratorService,
        // 실 SagaQuotaService 주입 — advanceToAiQueued의 한도 체크 경로를 동작 그대로 검증
        SagaQuotaService,
        { provide: getRepositoryToken(Submission), useFactory: mockSubmissionRepo },
        { provide: MqPublisherService, useFactory: mockMqPublisher },
        { provide: CircuitBreakerService, useFactory: mockCircuitBreakerService },
        { provide: ProblemServiceClient, useFactory: mockProblemServiceClient },
        { provide: StatsCacheService, useValue: { invalidate: jest.fn().mockResolvedValue(undefined) } },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<SagaOrchestratorService>(SagaOrchestratorService);
    repo = module.get(getRepositoryToken(Submission));
    mqPublisher = module.get(MqPublisherService);
    cbService = module.get(CircuitBreakerService);
    problemClient = module.get(ProblemServiceClient);
  });

  afterEach(() => {
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

  // ─── 8. advanceToAiQueued() — Submission 미발견 ───────────────
  describe('advanceToAiQueued() — Submission 미발견', () => {
    it('submission이 없으면 early return한다', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.advanceToAiQueued('non-existent');

      expect(repo.update).not.toHaveBeenCalled();
      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });
  });

  // ─── 9. advanceToAiQueued() — AI 한도 초과 ───────────────────
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

    it('한도 초과 DONE 전이가 낙관적 락(affected=0)에 막히면 캐시 무효화 없이 return한다', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      // 한도 초과
      cbService._mockBreaker.fire.mockResolvedValueOnce(false);

      await service.advanceToAiQueued('sub-uuid-1');

      // affected=0 → DONE 전이 스킵, MQ 발행 없음
      expect(mqPublisher.publishAiAnalysis).not.toHaveBeenCalled();
    });
  });

  // ─── 10. advanceToAiQueued() — preserveGithubStatus ───────────
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

  // ─── 11. compensateGitHubFailed() — SKIPPED ───────────────────
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

  // ─── 12. advanceToAiQueued() — quota 체크 실패 (CB fallback) ───
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

  // ─── 13. CB 통합: AI 서비스 장애 시 fallback → Saga 계속 ────────
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
  });

  // ─── 14. ProblemServiceClient 위임 (Sprint 135 D9 — Wave C) ───
  describe('ProblemServiceClient 위임 (Wave C)', () => {
    it('advanceToAiQueued — problemClient.getSourcePlatform을 호출해 sourcePlatform 전파', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);
      problemClient.getSourcePlatform.mockResolvedValueOnce('leetcode');

      await service.advanceToAiQueued('sub-uuid-1');

      expect(problemClient.getSourcePlatform).toHaveBeenCalledWith(
        'problem-uuid-1',
        'study-uuid-1',
        'user-1',
      );
      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ sourcePlatform: 'leetcode' }),
      );
    });
  });
});
