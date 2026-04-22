/**
 * @file AI 만족도 기능 단위 테스트 — rateSatisfaction, getSatisfaction, getSatisfactionStats
 * @domain submission
 * @layer test
 * @related AiSatisfaction, SubmissionService
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { SubmissionService } from './submission.service';
import { Submission, SagaStep, GitHubSyncStatus } from './submission.entity';
import { AiSatisfaction } from './ai-satisfaction.entity';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';
import { CreateAiSatisfactionDto } from './dto/create-ai-satisfaction.dto';

// ─── Mock QueryBuilder ──────────────────────────────────────────
const createMockQueryBuilder = () => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  getCount: jest.fn().mockResolvedValue(0),
});

// ─── Mock 팩토리 ────────────────────────────────────────────────
const mockSubmissionRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockSatisfactionRepo = () => ({
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),
  upsert: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockSagaOrchestrator = () => ({
  advanceToGitHubQueued: jest.fn(),
  advanceToDone: jest.fn(),
});

const mockConfigService = () => ({
  getOrThrow: jest.fn((key: string) => {
    const map: Record<string, string> = {
      GATEWAY_INTERNAL_URL: 'http://gateway:3000',
      INTERNAL_KEY_GATEWAY: 'test-internal-key',
      PROBLEM_SERVICE_URL: 'http://problem:3000',
      PROBLEM_SERVICE_KEY: 'test-problem-key',
    };
    return map[key];
  }),
});

const mockDataSource = () => ({
  createQueryRunner: jest.fn(),
});

// ─── 테스트 헬퍼 ────────────────────────────────────────────────
const createMockSubmission = (overrides: Partial<Submission> = {}): Submission => ({
  id: 'sub-uuid-1',
  studyId: 'study-uuid-1',
  userId: 'user-1',
  problemId: 'problem-uuid-1',
  language: 'python',
  code: 'print("hello world")',
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

const createMockSatisfaction = (overrides: Partial<AiSatisfaction> = {}): AiSatisfaction => ({
  id: 1,
  submissionId: 'sub-uuid-1',
  userId: 'user-1',
  rating: 1,
  comment: null,
  createdAt: new Date('2026-02-28T00:00:00Z'),
  submission: createMockSubmission(),
  toJSON: jest.fn(),
  ...overrides,
});

describe('SubmissionService — AI 만족도', () => {
  let service: SubmissionService;
  let submissionRepo: jest.Mocked<Repository<Submission>>;
  let satisfactionRepo: jest.Mocked<Repository<AiSatisfaction>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionService,
        { provide: getRepositoryToken(Submission), useFactory: mockSubmissionRepo },
        { provide: getRepositoryToken(AiSatisfaction), useFactory: mockSatisfactionRepo },
        { provide: SagaOrchestratorService, useFactory: mockSagaOrchestrator },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<SubmissionService>(SubmissionService);
    submissionRepo = module.get(getRepositoryToken(Submission));
    satisfactionRepo = module.get(getRepositoryToken(AiSatisfaction));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── 1. rateSatisfaction() — 신규 생성 (thumbs up) ────────────
  describe('rateSatisfaction() — 신규 생성', () => {
    it('제출이 존재하면 만족도를 생성하고 반환한다 (thumbs up)', async () => {
      // Arrange
      const submission = createMockSubmission({ studyId: 'study-uuid-1' });
      const dto: CreateAiSatisfactionDto = { rating: 1 };
      const saved = createMockSatisfaction({ rating: 1 });

      submissionRepo.findOne.mockResolvedValue(submission);
      satisfactionRepo.upsert.mockResolvedValue(undefined as never);
      satisfactionRepo.findOneOrFail.mockResolvedValue(saved);

      // Act
      const result = await service.rateSatisfaction('sub-uuid-1', 'user-1', 'study-uuid-1', dto);

      // Assert
      expect(submissionRepo.findOne).toHaveBeenCalledWith({ where: { id: 'sub-uuid-1' } });
      expect(satisfactionRepo.upsert).toHaveBeenCalledWith(
        {
          submissionId: 'sub-uuid-1',
          userId: 'user-1',
          rating: 1,
          comment: null,
        },
        { conflictPaths: ['submissionId', 'userId'] },
      );
      expect(satisfactionRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { submissionId: 'sub-uuid-1', userId: 'user-1' },
      });
      expect(result).toEqual(saved);
    });
  });

  // ─── 2. rateSatisfaction() — 기존 평가 변경 (UPSERT) ──────────
  describe('rateSatisfaction() — 기존 평가 변경 (UPSERT)', () => {
    it('기존 thumbs up → thumbs down 으로 변경한다', async () => {
      // Arrange
      const submission = createMockSubmission({ studyId: 'study-uuid-1' });
      const dto: CreateAiSatisfactionDto = { rating: -1, comment: '분석이 부정확합니다' };
      const updated = createMockSatisfaction({
        rating: -1,
        comment: '분석이 부정확합니다',
      });

      submissionRepo.findOne.mockResolvedValue(submission);
      satisfactionRepo.upsert.mockResolvedValue(undefined as never);
      satisfactionRepo.findOneOrFail.mockResolvedValue(updated);

      // Act
      const result = await service.rateSatisfaction('sub-uuid-1', 'user-1', 'study-uuid-1', dto);

      // Assert
      expect(satisfactionRepo.upsert).toHaveBeenCalledWith(
        {
          submissionId: 'sub-uuid-1',
          userId: 'user-1',
          rating: -1,
          comment: '분석이 부정확합니다',
        },
        { conflictPaths: ['submissionId', 'userId'] },
      );
      expect(result.rating).toBe(-1);
      expect(result.comment).toBe('분석이 부정확합니다');
    });
  });

  // ─── 3. rateSatisfaction() — 존재하지 않는 submission ─────────
  describe('rateSatisfaction() — 존재하지 않는 submission', () => {
    it('제출이 없으면 NotFoundException을 던진다', async () => {
      // Arrange
      const dto: CreateAiSatisfactionDto = { rating: 1 };
      submissionRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.rateSatisfaction('non-existent-id', 'user-1', 'study-uuid-1', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── 3b. rateSatisfaction() — 다른 스터디 제출 IDOR 방지 ───────
  describe('rateSatisfaction() — IDOR 방지 (스터디 불일치)', () => {
    it('제출의 studyId가 요청 studyId와 다르면 ForbiddenException을 던진다', async () => {
      // Arrange: 제출은 study-uuid-2 소속인데, 요청은 study-uuid-1로 접근
      const submission = createMockSubmission({ studyId: 'study-uuid-2' });
      const dto: CreateAiSatisfactionDto = { rating: 1 };

      submissionRepo.findOne.mockResolvedValue(submission);

      // Act & Assert
      await expect(
        service.rateSatisfaction('sub-uuid-1', 'user-1', 'study-uuid-1', dto),
      ).rejects.toThrow(ForbiddenException);

      // upsert는 호출되지 않아야 함
      expect(satisfactionRepo.upsert).not.toHaveBeenCalled();
    });
  });

  // ─── 4. getSatisfaction() — 평가 있을 때 반환 ─────────────────
  describe('getSatisfaction() — 평가 있을 때', () => {
    it('기존 만족도 레코드를 반환한다', async () => {
      // Arrange
      const existing = createMockSatisfaction({ rating: 1, comment: '좋은 분석이었습니다' });
      satisfactionRepo.findOne.mockResolvedValue(existing);

      // Act
      const result = await service.getSatisfaction('sub-uuid-1', 'user-1');

      // Assert
      expect(satisfactionRepo.findOne).toHaveBeenCalledWith({
        where: { submissionId: 'sub-uuid-1', userId: 'user-1' },
      });
      expect(result).toEqual(existing);
      expect(result?.rating).toBe(1);
      expect(result?.comment).toBe('좋은 분석이었습니다');
    });
  });

  // ─── 5. getSatisfaction() — 평가 없을 때 null 반환 ────────────
  describe('getSatisfaction() — 평가 없을 때', () => {
    it('null을 반환한다', async () => {
      // Arrange
      satisfactionRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getSatisfaction('sub-uuid-1', 'user-1');

      // Assert
      expect(result).toBeNull();
    });
  });

  // ─── 6. getSatisfactionStats() — up/down 카운트 정확성 ────────
  describe('getSatisfactionStats() — up/down 카운트', () => {
    it('up 3건, down 1건 통계를 정확히 반환한다', async () => {
      // Arrange
      const mockQb = createMockQueryBuilder();
      mockQb.getRawMany.mockResolvedValue([
        { rating: 1, cnt: 3 },
        { rating: -1, cnt: 1 },
      ]);
      satisfactionRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      // Act
      const result = await service.getSatisfactionStats('sub-uuid-1');

      // Assert
      expect(satisfactionRepo.createQueryBuilder).toHaveBeenCalledWith('s');
      expect(mockQb.select).toHaveBeenCalledWith('s.rating', 'rating');
      expect(mockQb.addSelect).toHaveBeenCalledWith('COUNT(*)::int', 'cnt');
      expect(mockQb.where).toHaveBeenCalledWith('s.submission_id = :submissionId', {
        submissionId: 'sub-uuid-1',
      });
      expect(mockQb.groupBy).toHaveBeenCalledWith('s.rating');
      expect(result).toEqual({ up: 3, down: 1 });
    });

    it('평가가 없으면 up=0, down=0을 반환한다', async () => {
      // Arrange
      const mockQb = createMockQueryBuilder();
      mockQb.getRawMany.mockResolvedValue([]);
      satisfactionRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      // Act
      const result = await service.getSatisfactionStats('sub-uuid-1');

      // Assert
      expect(result).toEqual({ up: 0, down: 0 });
    });

    it('up만 있을 때 down=0을 반환한다', async () => {
      // Arrange
      const mockQb = createMockQueryBuilder();
      mockQb.getRawMany.mockResolvedValue([{ rating: 1, cnt: 5 }]);
      satisfactionRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      // Act
      const result = await service.getSatisfactionStats('sub-uuid-1');

      // Assert
      expect(result).toEqual({ up: 5, down: 0 });
    });
  });
});
