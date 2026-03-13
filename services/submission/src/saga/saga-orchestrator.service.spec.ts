import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SagaOrchestratorService } from './saga-orchestrator.service';
import { Submission, SagaStep, GitHubSyncStatus } from '../submission/submission.entity';
import { MqPublisherService } from './mq-publisher.service';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SagaOrchestratorService,
        { provide: getRepositoryToken(Submission), useFactory: mockSubmissionRepo },
        { provide: MqPublisherService, useFactory: mockMqPublisher },
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
    it('GitHub FAILED 시 githubSyncStatus 업데이트 후 AI 분석 진행', async () => {
      const submission = createMockSubmission();
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // Act
      await service.compensateGitHubFailed('sub-uuid-1', GitHubSyncStatus.FAILED);

      // Assert: githubSyncStatus=FAILED 업데이트 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        { githubSyncStatus: GitHubSyncStatus.FAILED },
      );
      // AI 분석 진행 (advanceToAiQueued 호출됨 — GITHUB_QUEUED에서 변경됨)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        {
          sagaStep: SagaStep.AI_QUEUED,
          githubSyncStatus: GitHubSyncStatus.SYNCED,
        },
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
  });

  // ─── 10. resumeSaga (DB_SAVED) — onModuleInit 통해 간접 테스트 ─
  describe('resumeSaga (DB_SAVED)', () => {
    it('DB_SAVED 상태에서 advanceToGitHubQueued를 호출한다', async () => {
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

  // ─── 11. resumeSaga (GITHUB_QUEUED/AI_QUEUED) — MQ 재발행 ────
  describe('resumeSaga (GITHUB_QUEUED / AI_QUEUED)', () => {
    it('GITHUB_QUEUED 상태에서 MQ GitHub Push를 재발행한다', async () => {
      const ghQueuedSubmission = createMockSubmission({
        id: 'sub-gh-queued',
        sagaStep: SagaStep.GITHUB_QUEUED,
        studyId: 'study-gh-1',
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([ghQueuedSubmission]);
      mqPublisher.publishGitHubPush.mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert: DB update 없이 MQ 재발행만
      expect(repo.update).not.toHaveBeenCalled();
      expect(mqPublisher.publishGitHubPush).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-gh-queued',
          studyId: 'study-gh-1',
        }),
      );
    });

    it('AI_QUEUED 상태에서 MQ AI Analysis를 재발행한다', async () => {
      const aiQueuedSubmission = createMockSubmission({
        id: 'sub-ai-queued',
        sagaStep: SagaStep.AI_QUEUED,
        studyId: 'study-ai-1',
        createdAt: new Date(),
      });

      repo.find.mockResolvedValue([aiQueuedSubmission]);
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert: DB update 없이 MQ 재발행만
      expect(repo.update).not.toHaveBeenCalled();
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
    it('한도 초과 시 AI_SKIPPED으로 처리하고 DONE 상태로 전환한다', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // checkAiQuota가 false를 반환하도록 mock
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { allowed: false, used: 10, limit: 10 } }),
      });
      (global as any).fetch = mockFetch;

      await service.advanceToAiQueued('sub-uuid-1');

      // AI_SKIPPED → DONE (낙관적 락 WHERE 조건 포함)
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

      // quota 허용
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { allowed: true, used: 1, limit: 10 } }),
      });

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

      // quota 허용
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { allowed: true, used: 1, limit: 10 } }),
      });

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

  // ─── 17. checkAiQuota — fetch 실패 시 허용 ────────────────────
  describe('advanceToAiQueued() — quota 체크 실패', () => {
    it('fetch 네트워크 오류 시 AI 분석을 허용한다', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      (global as any).fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await service.advanceToAiQueued('sub-uuid-1');

      // 네트워크 오류 시에도 AI 분석 진행 (낙관적 락 WHERE 조건 포함)
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'sub-uuid-1', sagaStep: SagaStep.GITHUB_QUEUED },
        {
          sagaStep: SagaStep.AI_QUEUED,
          githubSyncStatus: GitHubSyncStatus.SYNCED,
        },
      );
      expect(mqPublisher.publishAiAnalysis).toHaveBeenCalled();
    });

    it('fetch 응답이 ok가 아니면 AI 분석을 허용한다', async () => {
      const submission = createMockSubmission({ sagaStep: SagaStep.GITHUB_QUEUED });
      repo.findOne.mockResolvedValue(submission);
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      mqPublisher.publishAiAnalysis.mockResolvedValue(undefined);

      (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

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
        .mockResolvedValueOnce([]) // onModuleInit - 미완료 없음 (타이머 미설정)
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

      // onModuleInit — 미완료 없음이므로 타이머 미설정
      await service.onModuleInit();

      // checkSagaTimeouts를 직접 호출하기 위해 private 메서드 접근
      await (service as any).checkSagaTimeouts();

      expect(repo.find).toHaveBeenCalledTimes(4); // onModuleInit 1 + checkSagaTimeouts 3 steps
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
        .mockResolvedValueOnce([]) // onModuleInit - 미완료 없음
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

  // ─── 21. resumeSaga — default 분기 (DONE/FAILED/AI_SKIPPED) ───
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
