import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { SubmissionService } from './submission.service';
import { Submission, SagaStep, GitHubSyncStatus } from './submission.entity';
import { AiSatisfaction } from './ai-satisfaction.entity';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateAiResultDto } from './dto/update-ai-result.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

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
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
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
    };
    return map[key];
  }),
});

const createMockTransactionRunner = () => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    save: jest.fn(),
    update: jest.fn(),
  },
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

describe('SubmissionService', () => {
  let service: SubmissionService;
  let repo: jest.Mocked<Repository<Submission>>;
  let sagaOrchestrator: jest.Mocked<SagaOrchestratorService>;
  let dataSource: jest.Mocked<DataSource>;


  // global.fetch 모킹
  const originalFetch = global.fetch;

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
    repo = module.get(getRepositoryToken(Submission));
    sagaOrchestrator = module.get(SagaOrchestratorService);
    dataSource = module.get(DataSource);
    module.get(ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ─── 1. create() — 정상 제출 ─────────────────────────────────
  describe('create() — 정상 제출', () => {
    it('DB 저장 -> Saga 진행', async () => {
      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("hello world")',
      };
      const saved = createMockSubmission();

      repo.findOne.mockResolvedValue(null); // 멱등성 검사 — 기존 없음
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);
      sagaOrchestrator.advanceToGitHubQueued.mockResolvedValue(undefined);

      // Act
      const result = await service.create(dto, 'user-1', 'study-uuid-1');

      // Assert
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studyId: 'study-uuid-1',
          userId: 'user-1',
          problemId: 'problem-uuid-1',
          language: 'python',
          sagaStep: SagaStep.DB_SAVED,
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(saved);
      expect(sagaOrchestrator.advanceToGitHubQueued).toHaveBeenCalledWith(
        'sub-uuid-1',
        'study-uuid-1',
      );
      expect(result).toEqual(saved);
    });
  });

  // ─── 2. create() — 멱등성 (중복 idempotencyKey) ──────────────
  describe('create() — 멱등성', () => {
    it('중복 idempotencyKey일 때 기존 제출을 반환한다', async () => {
      const existing = createMockSubmission({
        idempotencyKey: 'idem-key-1',
        sagaStep: SagaStep.DONE,
      });

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("hello world")',
        idempotencyKey: 'idem-key-1',
      };

      repo.findOne.mockResolvedValue(existing);

      // Act
      const result = await service.create(dto, 'user-1', 'study-uuid-1');

      // Assert
      expect(result).toEqual(existing);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(sagaOrchestrator.advanceToGitHubQueued).not.toHaveBeenCalled();
    });

    it('멱등성 조회 시 userId를 포함한 3-tuple로 스코핑한다 (IDOR 방지)', async () => {
      // findOne 조회 조건에 userId가 반드시 포함되어야 함을 검증
      const existing = createMockSubmission({
        userId: 'user-1',
        idempotencyKey: 'idem-key-1',
        sagaStep: SagaStep.DONE,
      });

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("hello world")',
        idempotencyKey: 'idem-key-1',
      };

      repo.findOne.mockResolvedValue(existing);

      await service.create(dto, 'user-1', 'study-uuid-1');

      // (studyId, userId, idempotencyKey) 3-tuple 조건 검증
      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          idempotencyKey: 'idem-key-1',
          studyId: 'study-uuid-1',
          userId: 'user-1',
        },
      });
    });

    it('같은 idempotencyKey라도 다른 userId면 신규 제출을 생성한다 (크로스 유저 IDOR 방지)', async () => {
      // user-2가 user-1과 동일한 idempotencyKey를 사용해도 별개의 제출로 처리됨
      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("user-2 code")',
        idempotencyKey: 'idem-key-1',
      };

      // user-2 기준으로는 기존 제출 없음 (null 반환)
      repo.findOne.mockResolvedValue(null);

      const savedForUser2 = createMockSubmission({
        userId: 'user-2',
        idempotencyKey: 'idem-key-1',
        code: 'print("user-2 code")',
      });
      repo.create.mockReturnValue(savedForUser2);
      repo.save.mockResolvedValue(savedForUser2);
      sagaOrchestrator.advanceToGitHubQueued.mockResolvedValue(undefined);

      // user-2로 제출
      const result = await service.create(dto, 'user-2', 'study-uuid-1');

      // user-1 제출이 아닌, user-2의 신규 제출 엔티티를 반환해야 함
      expect(result.userId).toBe('user-2');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2' }),
      );
      // findOne이 userId: 'user-2'로 호출되어야 함 (user-1 데이터 조회 불가)
      expect(repo.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({ userId: 'user-2' }),
      });
    });
  });

  // ─── 4. create() — Saga 진행 실패 ────────────────────────────
  describe('create() — Saga 진행 실패', () => {
    it('Saga 진행 실패해도 DB 저장은 성공한다 (에러 로그만)', async () => {
      const saved = createMockSubmission();
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);
      sagaOrchestrator.advanceToGitHubQueued.mockRejectedValue(
        new Error('RabbitMQ 연결 실패'),
      );

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("hello world")',
      };

      // Act — 에러가 throw되지 않아야 한다
      const result = await service.create(dto, 'user-1', 'study-uuid-1');

      // Assert
      expect(result).toEqual(saved);
      expect(repo.save).toHaveBeenCalled();
      expect(sagaOrchestrator.advanceToGitHubQueued).toHaveBeenCalled();
    });
  });

  // ─── 5. findById() — 정상 조회 ───────────────────────────────
  describe('findById() — 정상 조회', () => {
    it('존재하는 제출을 반환한다', async () => {
      const submission = createMockSubmission();
      repo.findOne.mockResolvedValue(submission);

      const result = await service.findById('sub-uuid-1');

      expect(result).toEqual(submission);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'sub-uuid-1' } });
    });
  });

  // ─── 6. findById() — 미존재 ──────────────────────────────────
  describe('findById() — 미존재', () => {
    it('존재하지 않으면 NotFoundException을 던진다', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── 7. findByStudyAndUser() — 목록 조회 ─────────────────────
  describe('findByStudyAndUser()', () => {
    it('스터디+사용자별 제출 목록을 반환한다', async () => {
      const submissions = [
        createMockSubmission({ id: 'sub-1' }),
        createMockSubmission({ id: 'sub-2' }),
      ];
      repo.find.mockResolvedValue(submissions);

      const result = await service.findByStudyAndUser('study-uuid-1', 'user-1');

      expect(result).toEqual(submissions);
      expect(repo.find).toHaveBeenCalledWith({
        where: { studyId: 'study-uuid-1', userId: 'user-1' },
        order: { createdAt: 'DESC' },
        select: expect.any(Array),
      });
    });
  });

  // ─── 8. findByProblem() — 문제별 목록 조회 ───────────────────
  describe('findByProblem()', () => {
    it('문제별 제출 목록을 반환한다', async () => {
      const submissions = [createMockSubmission()];
      repo.find.mockResolvedValue(submissions);

      const result = await service.findByProblem('study-uuid-1', 'user-1', 'problem-uuid-1');

      expect(result).toEqual(submissions);
      expect(repo.find).toHaveBeenCalledWith({
        where: { studyId: 'study-uuid-1', userId: 'user-1', problemId: 'problem-uuid-1' },
        order: { createdAt: 'DESC' },
        select: expect.any(Array),
      });
    });
  });

  // ─── 9. updateGithubFilePath() — GitHub 파일 경로 업데이트 ────
  describe('updateGithubFilePath()', () => {
    it('제출의 githubFilePath를 업데이트한다', async () => {
      repo.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateGithubFilePath('sub-uuid-1', 'solutions/user-1/problem-1.py');

      expect(repo.update).toHaveBeenCalledWith('sub-uuid-1', {
        githubFilePath: 'solutions/user-1/problem-1.py',
      });
    });
  });

  // ─── 10. findByProblemForStudy() — 스터디 단위 문제별 조회 ────
  describe('findByProblemForStudy()', () => {
    it('스터디 전체의 문제별 제출 목록을 반환한다', async () => {
      const submissions = [
        createMockSubmission({ id: 'sub-1', userId: 'user-1' }),
        createMockSubmission({ id: 'sub-2', userId: 'user-2' }),
      ];
      repo.find.mockResolvedValue(submissions);

      const result = await service.findByProblemForStudy('study-uuid-1', 'problem-uuid-1');

      expect(result).toEqual(submissions);
      expect(repo.find).toHaveBeenCalledWith({
        where: { studyId: 'study-uuid-1', problemId: 'problem-uuid-1' },
        order: { createdAt: 'DESC' },
        select: expect.any(Array),
      });
    });
  });

  // ─── 11. updateAiResult() — AI 분석 결과 저장 ─────────────────
  describe('updateAiResult()', () => {
    it('AI 분석 결과를 저장하고 completed 시 트랜잭션으로 Saga DONE 전환', async () => {
      const submission = createMockSubmission();
      const savedSubmission = createMockSubmission({ aiFeedback: '좋은 코드입니다', aiScore: 85, aiAnalysisStatus: 'completed' });
      repo.findOne.mockResolvedValue(submission);

      const mockQr = createMockTransactionRunner();
      mockQr.manager.save.mockResolvedValue(savedSubmission);
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQr);
      sagaOrchestrator.advanceToDone.mockResolvedValue(undefined);

      const dto: UpdateAiResultDto = {
        feedback: '좋은 코드입니다',
        score: 85,
        optimizedCode: 'print("optimized")',
        analysisStatus: 'completed',
      };

      const result = await service.updateAiResult('sub-uuid-1', dto);

      expect(mockQr.connect).toHaveBeenCalled();
      expect(mockQr.startTransaction).toHaveBeenCalled();
      expect(mockQr.manager.save).toHaveBeenCalled();
      expect(sagaOrchestrator.advanceToDone).toHaveBeenCalledWith('sub-uuid-1', mockQr);
      expect(mockQr.commitTransaction).toHaveBeenCalled();
      expect(mockQr.release).toHaveBeenCalled();
      expect(result.aiScore).toBe(85);
    });

    it('AI 분석 failed 시에도 트랜잭션으로 Saga DONE 전환', async () => {
      const submission = createMockSubmission();
      const savedSubmission = createMockSubmission({ aiAnalysisStatus: 'failed' });
      repo.findOne.mockResolvedValue(submission);

      const mockQr = createMockTransactionRunner();
      mockQr.manager.save.mockResolvedValue(savedSubmission);
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQr);
      sagaOrchestrator.advanceToDone.mockResolvedValue(undefined);

      const dto: UpdateAiResultDto = {
        feedback: '분석 실패',
        score: 0,
        analysisStatus: 'failed',
      };

      await service.updateAiResult('sub-uuid-1', dto);

      expect(sagaOrchestrator.advanceToDone).toHaveBeenCalledWith('sub-uuid-1', mockQr);
      expect(mockQr.commitTransaction).toHaveBeenCalled();
    });

    it('AI 분석 delayed 시 Saga DONE 전환하지 않는다 (트랜잭션 미사용)', async () => {
      const submission = createMockSubmission();
      repo.findOne.mockResolvedValue(submission);
      repo.save.mockResolvedValue(createMockSubmission({ aiAnalysisStatus: 'delayed' }));

      const dto: UpdateAiResultDto = {
        feedback: '분석 대기중',
        score: 0,
        analysisStatus: 'delayed',
      };

      await service.updateAiResult('sub-uuid-1', dto);

      expect(sagaOrchestrator.advanceToDone).not.toHaveBeenCalled();
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('optimizedCode가 null이면 null로 저장', async () => {
      const submission = createMockSubmission();
      repo.findOne.mockResolvedValue(submission);

      const mockQr = createMockTransactionRunner();
      mockQr.manager.save.mockImplementation(async (_entity: any, s: any) => s);
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQr);
      sagaOrchestrator.advanceToDone.mockResolvedValue(undefined);

      const dto: UpdateAiResultDto = {
        feedback: '피드백',
        score: 70,
        analysisStatus: 'completed',
      };

      await service.updateAiResult('sub-uuid-1', dto);

      const savedArg = mockQr.manager.save.mock.calls[0][1] as Submission;
      expect(savedArg.aiOptimizedCode).toBeNull();
    });

    it('존재하지 않는 제출이면 NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);

      const dto: UpdateAiResultDto = {
        feedback: '피드백',
        score: 70,
        analysisStatus: 'completed',
      };

      await expect(service.updateAiResult('non-existent', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('트랜잭션 실패 시 롤백 후 에러를 전파한다', async () => {
      const submission = createMockSubmission();
      repo.findOne.mockResolvedValue(submission);

      const mockQr = createMockTransactionRunner();
      mockQr.manager.save.mockRejectedValue(new Error('DB write failed'));
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQr);

      const dto: UpdateAiResultDto = {
        feedback: '피드백',
        score: 70,
        analysisStatus: 'completed',
      };

      await expect(service.updateAiResult('sub-uuid-1', dto)).rejects.toThrow('DB write failed');
      expect(mockQr.rollbackTransaction).toHaveBeenCalled();
      expect(mockQr.release).toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
    });
  });

  // ─── 12. findByStudyAndUserPaginated() — 페이지네이션 ─────────
  describe('findByStudyAndUserPaginated()', () => {
    let mockQb: ReturnType<typeof createMockQueryBuilder>;

    beforeEach(() => {
      mockQb = createMockQueryBuilder();
      repo.createQueryBuilder.mockReturnValue(mockQb as any);
    });

    it('기본 페이지네이션 파라미터로 조회', async () => {
      const submissions = [createMockSubmission()];
      mockQb.getManyAndCount.mockResolvedValue([submissions, 1]);

      const query: PaginationQueryDto = {};
      const result = await service.findByStudyAndUserPaginated('study-uuid-1', 'user-1', query);

      expect(result.data).toEqual(submissions);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockQb.where).toHaveBeenCalledWith('s.studyId = :studyId', { studyId: 'study-uuid-1' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('s.userId = :userId', { userId: 'user-1' });
    });

    it('커스텀 page, limit, sort로 조회', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 50]);

      const query: PaginationQueryDto = { page: 3, limit: 10, sort: 'createdAt_ASC' };
      const result = await service.findByStudyAndUserPaginated('study-uuid-1', 'user-1', query);

      expect(result.meta).toEqual({
        total: 50,
        page: 3,
        limit: 10,
        totalPages: 5,
      });
      expect(mockQb.orderBy).toHaveBeenCalledWith('s.createdAt', 'ASC');
      expect(mockQb.skip).toHaveBeenCalledWith(20); // (3-1)*10
      expect(mockQb.take).toHaveBeenCalledWith(10);
    });

    it('limit가 100을 초과하면 100으로 제한', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const query: PaginationQueryDto = { limit: 200 };
      await service.findByStudyAndUserPaginated('study-uuid-1', 'user-1', query);

      expect(mockQb.take).toHaveBeenCalledWith(100);
    });

    it('language 필터 적용', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const query: PaginationQueryDto = { language: 'python' };
      await service.findByStudyAndUserPaginated('study-uuid-1', 'user-1', query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('s.language = :language', { language: 'python' });
    });

    it('sagaStep 필터 적용', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const query: PaginationQueryDto = { sagaStep: SagaStep.DONE };
      await service.findByStudyAndUserPaginated('study-uuid-1', 'user-1', query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('s.sagaStep = :sagaStep', { sagaStep: SagaStep.DONE });
    });

    it('weekNumber 필터 적용', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const query: PaginationQueryDto = { weekNumber: '3월1주차' };
      await service.findByStudyAndUserPaginated('study-uuid-1', 'user-1', query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('s.weekNumber = :weekNumber', { weekNumber: '3월1주차' });
    });

    it('허용되지 않은 sortField는 createdAt으로 폴백 (SQL Injection 방지)', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const query: PaginationQueryDto = { sort: 'malicious_DESC' as any };
      await service.findByStudyAndUserPaginated('study-uuid-1', 'user-1', query);

      expect(mockQb.orderBy).toHaveBeenCalledWith('s.createdAt', 'DESC');
    });
  });

  // ─── 13. getStudyStats() — 스터디 통계 ────────────────────────
  describe('getStudyStats()', () => {
    let mockQb: ReturnType<typeof createMockQueryBuilder>;

    beforeEach(() => {
      mockQb = createMockQueryBuilder();
      repo.createQueryBuilder.mockReturnValue(mockQb as any);
    });

    it('기본 통계를 반환한다 (weekNumber/userId 미지정)', async () => {
      repo.count.mockResolvedValue(42);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 30 }])  // uniqueSubmissions
        .mockResolvedValueOnce([{ cnt: 25 }])     // uniqueAnalyzed
        .mockResolvedValueOnce([{ week: '3월1주차', count: 10 }])  // byWeek
        .mockResolvedValueOnce([{ userId: 'u1', week: '3월1주차', count: 3 }]) // byWeekPerUser
        .mockResolvedValueOnce([{ userId: 'u1', count: 10, doneCount: 8, uniqueProblemCount: 5, uniqueDoneCount: 4 }])  // byMember
        .mockResolvedValueOnce([{ problemid: 'p1', cnt: 2, donecnt: 1 }, { problemid: 'p2', cnt: 1, donecnt: 0 }]); // submitterCountByProblem
      repo.find.mockResolvedValue([createMockSubmission()]); // recentSubmissions

      const result = await service.getStudyStats('study-uuid-1');

      expect(result.totalSubmissions).toBe(42);
      expect(result.uniqueSubmissions).toBe(30);
      expect(result.uniqueAnalyzed).toBe(25);
      expect(result.byWeek).toEqual([{ week: '3월1주차', count: 10 }]);
      expect(result.byWeekPerUser).toEqual([{ userId: 'u1', week: '3월1주차', count: 3 }]);
      expect(result.byMember).toEqual([{ userId: 'u1', count: 10, doneCount: 8, uniqueProblemCount: 5, uniqueDoneCount: 4 }]);
      expect(result.byMemberWeek).toBeNull();
      expect(result.solvedProblemIds).toBeNull();
      expect(result.recentSubmissions).toHaveLength(1);
      expect(result.submitterCountByProblem).toEqual([{ problemId: 'p1', count: 2, analyzedCount: 1 }, { problemId: 'p2', count: 1, analyzedCount: 0 }]);
    });

    it('weekNumber 지정 시 byMemberWeek 통계 포함', async () => {
      repo.count.mockResolvedValue(10);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([])  // byWeek
        .mockResolvedValueOnce([])  // byWeekPerUser
        .mockResolvedValueOnce([])  // byMember
        .mockResolvedValueOnce([])  // submitterCountByProblem
        .mockResolvedValueOnce([{ userId: 'u1', count: 5 }]); // byMemberWeek
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1', '3월1주차');

      expect(result.byMemberWeek).toEqual([{ userId: 'u1', count: 5 }]);
    });

    it('userId 지정 시 solvedProblemIds 포함', async () => {
      repo.count.mockResolvedValue(10);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([])  // byWeek
        .mockResolvedValueOnce([])  // byWeekPerUser
        .mockResolvedValueOnce([])  // byMember
        .mockResolvedValueOnce([])  // submitterCountByProblem
        .mockResolvedValueOnce([{ problemId: 'p1' }, { problemId: 'p2' }]); // solvedProblemIds
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1', undefined, 'user-1');

      expect(result.solvedProblemIds).toEqual(['p1', 'p2']);
    });

    it('weekNumber과 userId 모두 지정', async () => {
      repo.count.mockResolvedValue(5);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([])  // byWeek
        .mockResolvedValueOnce([])  // byWeekPerUser
        .mockResolvedValueOnce([])  // byMember
        .mockResolvedValueOnce([])  // submitterCountByProblem
        .mockResolvedValueOnce([{ userId: 'u1', count: 2 }])  // byMemberWeek
        .mockResolvedValueOnce([{ problemId: 'p1' }]); // solvedProblemIds
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1', '3월1주차', 'user-1');

      expect(result.byMemberWeek).toEqual([{ userId: 'u1', count: 2 }]);
      expect(result.solvedProblemIds).toEqual(['p1']);
    });

    it('byWeek 주차 정렬 (parseWeekKey)', async () => {
      repo.count.mockResolvedValue(20);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([
          { week: '3월2주차', count: 5 },
          { week: '2월4주차', count: 8 },
          { week: '3월1주차', count: 7 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // submitterCountByProblem
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1');

      expect(result.byWeek.map((w) => w.week)).toEqual(['2월4주차', '3월1주차', '3월2주차']);
    });

    it('byWeekPerUser 주차 정렬 (parseWeekKey)', async () => {
      repo.count.mockResolvedValue(20);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([])  // byWeek
        .mockResolvedValueOnce([
          { userId: 'u1', week: '3월2주차', count: 3 },
          { userId: 'u2', week: '2월1주차', count: 5 },
          { userId: 'u1', week: '3월1주차', count: 2 },
        ])  // byWeekPerUser
        .mockResolvedValueOnce([])  // byMember
        .mockResolvedValueOnce([]);  // submitterCountByProblem
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1');

      expect(result.byWeekPerUser.map((w) => w.week)).toEqual(['2월1주차', '3월1주차', '3월2주차']);
    });

    it('parseWeekKey — 패턴에 맞지 않는 week 문자열은 0으로 처리한다', async () => {
      repo.count.mockResolvedValue(5);
      // week 값이 정규식 패턴에 맞지 않는 케이스 포함
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([
          { week: 'invalid-format', count: 3 },
          { week: '3월1주차', count: 5 },
        ])  // byWeek (invalid + valid 혼합)
        .mockResolvedValueOnce([])  // byWeekPerUser
        .mockResolvedValueOnce([])  // byMember
        .mockResolvedValueOnce([]);  // submitterCountByProblem
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1');

      // invalid-format 은 parseWeekKey=0 이므로 앞에 정렬됨
      expect(result.byWeek[0].week).toBe('invalid-format');
      expect(result.byWeek[1].week).toBe('3월1주차');
    });
  });

  // ─── 13-extra. getStudyStats() — activeProblemIds 필터링 ────────
  describe('getStudyStats() — activeProblemIds', () => {
    let mockQb: ReturnType<typeof createMockQueryBuilder>;

    beforeEach(() => {
      mockQb = createMockQueryBuilder();
      repo.createQueryBuilder.mockReturnValue(mockQb as any);
    });

    it('activeProblemIds가 빈 배열이면 즉시 빈 결과 반환', async () => {
      const result = await service.getStudyStats('study-uuid-1', undefined, undefined, []);

      expect(result.totalSubmissions).toBe(0);
      expect(result.uniqueSubmissions).toBe(0);
      expect(result.uniqueAnalyzed).toBe(0);
      expect(result.byWeek).toEqual([]);
      expect(result.byMember).toEqual([]);
      expect(result.byMemberWeek).toBeNull();
      expect(result.solvedProblemIds).toBeNull();
      expect(result.recentSubmissions).toEqual([]);
      expect(result.submitterCountByProblem).toEqual([]);
      // DB 쿼리가 호출되지 않아야 함
      expect(repo.count).not.toHaveBeenCalled();
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('activeProblemIds가 빈 배열 + weekNumber/userId 지정 시 빈 결과의 형태', async () => {
      const result = await service.getStudyStats('study-uuid-1', '3월1주차', 'user-1', []);

      expect(result.byMemberWeek).toEqual([]);
      expect(result.solvedProblemIds).toEqual([]);
    });

    it('activeProblemIds 제공 시 andWhere가 호출된다', async () => {
      mockQb.getCount = jest.fn().mockResolvedValue(5);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 3 }])  // uniqueSubmissions
        .mockResolvedValueOnce([{ cnt: 2 }])  // uniqueAnalyzed
        .mockResolvedValueOnce([])             // byWeek
        .mockResolvedValueOnce([])             // byWeekPerUser
        .mockResolvedValueOnce([])             // byMember
        .mockResolvedValueOnce([]);            // submitterCountByProblem
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1', undefined, undefined, ['p1', 'p2']);

      expect(result.totalSubmissions).toBe(5);
      expect(result.uniqueSubmissions).toBe(3);
      // totalSubmissions uses createQueryBuilder+getCount instead of repo.count
      expect(repo.count).not.toHaveBeenCalled();
      // andWhere should be called with activeProblemIds filter
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        's.problem_id IN (:...activeProblemIds)',
        { activeProblemIds: ['p1', 'p2'] },
      );
    });

    it('activeProblemIds undefined이면 기존 동작 (repo.count 사용)', async () => {
      repo.count.mockResolvedValue(42);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 30 }])
        .mockResolvedValueOnce([{ cnt: 25 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1');

      expect(result.totalSubmissions).toBe(42);
      expect(repo.count).toHaveBeenCalled();
    });

    it('activeProblemIds 제공 시 recentSubmissions도 In 필터 적용', async () => {
      mockQb.getCount = jest.fn().mockResolvedValue(3);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 2 }])
        .mockResolvedValueOnce([{ cnt: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const recent = [createMockSubmission({ id: 'sub-recent' })];
      repo.find.mockResolvedValue(recent);

      const result = await service.getStudyStats('study-uuid-1', undefined, undefined, ['p1']);

      expect(result.recentSubmissions).toEqual(recent);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studyId: 'study-uuid-1', problemId: expect.anything() },
        }),
      );
    });
  });

  // ─── 13-extra2. getStudyStats() — 추가 시나리오 ────────────────
  describe('getStudyStats() — 추가 시나리오', () => {
    let mockQb: ReturnType<typeof createMockQueryBuilder>;

    beforeEach(() => {
      mockQb = createMockQueryBuilder();
      repo.createQueryBuilder.mockReturnValue(mockQb as any);
    });

    it('빈 데이터 — 제출이 하나도 없으면 모든 카운트가 0', async () => {
      repo.count.mockResolvedValue(0);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1');

      expect(result.totalSubmissions).toBe(0);
      expect(result.uniqueSubmissions).toBe(0);
      expect(result.uniqueAnalyzed).toBe(0);
      expect(result.byWeek).toEqual([]);
      expect(result.byWeekPerUser).toEqual([]);
      expect(result.byMember).toEqual([]);
      expect(result.recentSubmissions).toEqual([]);
      expect(result.submitterCountByProblem).toEqual([]);
    });

    it('여러 주차 데이터 — 다중 주차 올바르게 정렬', async () => {
      repo.count.mockResolvedValue(30);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 15 }])
        .mockResolvedValueOnce([{ cnt: 10 }])
        .mockResolvedValueOnce([
          { week: '4월2주차', count: 8 },
          { week: '3월4주차', count: 12 },
          { week: '4월1주차', count: 10 },
        ])
        .mockResolvedValueOnce([
          { userId: 'u1', week: '4월2주차', count: 4 },
          { userId: 'u1', week: '3월4주차', count: 6 },
          { userId: 'u2', week: '4월1주차', count: 5 },
        ])
        .mockResolvedValueOnce([
          { userId: 'u1', count: 16, doneCount: 12, uniqueProblemCount: 8, uniqueDoneCount: 6 },
          { userId: 'u2', count: 14, doneCount: 10, uniqueProblemCount: 7, uniqueDoneCount: 5 },
        ])
        .mockResolvedValueOnce([
          { problemid: 'p1', cnt: 2, donecnt: 2 },
          { problemid: 'p2', cnt: 3, donecnt: 1 },
        ]);
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1');

      expect(result.byWeek.map(w => w.week)).toEqual(['3월4주차', '4월1주차', '4월2주차']);
      expect(result.byWeekPerUser.map(w => w.week)).toEqual(['3월4주차', '4월1주차', '4월2주차']);
      expect(result.byMember).toHaveLength(2);
      expect(result.byMember[0].count).toBe(16);
      expect(result.byMember[1].count).toBe(14);
    });

    it('sagaStep별 카운트 — byMember의 doneCount/uniqueDoneCount 정확성', async () => {
      repo.count.mockResolvedValue(20);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 10 }])
        .mockResolvedValueOnce([{ cnt: 7 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { userId: 'u1', count: 12, doneCount: 8, uniqueProblemCount: 6, uniqueDoneCount: 5 },
          { userId: 'u2', count: 8, doneCount: 3, uniqueProblemCount: 4, uniqueDoneCount: 2 },
        ])
        .mockResolvedValueOnce([
          { problemid: 'p1', cnt: 2, donecnt: 2 },
          { problemid: 'p2', cnt: 2, donecnt: 0 },
          { problemid: 'p3', cnt: 1, donecnt: 1 },
        ]);
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1');

      // byMember의 sagaStep 관련 카운트 검증
      expect(result.byMember[0]).toEqual({
        userId: 'u1', count: 12, doneCount: 8, uniqueProblemCount: 6, uniqueDoneCount: 5,
      });
      expect(result.byMember[1]).toEqual({
        userId: 'u2', count: 8, doneCount: 3, uniqueProblemCount: 4, uniqueDoneCount: 2,
      });
      // submitterCountByProblem의 analyzedCount 검증
      expect(result.submitterCountByProblem).toEqual([
        { problemId: 'p1', count: 2, analyzedCount: 2 },
        { problemId: 'p2', count: 2, analyzedCount: 0 },
        { problemId: 'p3', count: 1, analyzedCount: 1 },
      ]);
    });

    it('사용자별 통계 — 여러 멤버의 개별 제출 수 및 고유 문제 수', async () => {
      repo.count.mockResolvedValue(50);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 25 }])
        .mockResolvedValueOnce([{ cnt: 20 }])
        .mockResolvedValueOnce([{ week: '3월1주차', count: 50 }])
        .mockResolvedValueOnce([
          { userId: 'u1', week: '3월1주차', count: 5 },
          { userId: 'u2', week: '3월1주차', count: 4 },
          { userId: 'u3', week: '3월1주차', count: 3 },
        ])
        .mockResolvedValueOnce([
          { userId: 'u1', count: 20, doneCount: 15, uniqueProblemCount: 10, uniqueDoneCount: 8 },
          { userId: 'u2', count: 18, doneCount: 12, uniqueProblemCount: 9, uniqueDoneCount: 7 },
          { userId: 'u3', count: 12, doneCount: 8, uniqueProblemCount: 6, uniqueDoneCount: 4 },
        ])
        .mockResolvedValueOnce([]);
      repo.find.mockResolvedValue([]);

      const result = await service.getStudyStats('study-uuid-1');

      expect(result.byMember).toHaveLength(3);
      expect(result.byMember.map(m => m.userId)).toEqual(['u1', 'u2', 'u3']);
      // byWeekPerUser도 3명 전부 반환
      expect(result.byWeekPerUser).toHaveLength(3);
      // uniqueSubmissions/uniqueAnalyzed 숫자형 변환 확인
      expect(typeof result.uniqueSubmissions).toBe('number');
      expect(typeof result.uniqueAnalyzed).toBe('number');
    });

    it('정상 통계 — activeProblemIds 필터링으로 ACTIVE 문제만 집계', async () => {
      mockQb.getCount = jest.fn().mockResolvedValue(15);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ cnt: 10 }])
        .mockResolvedValueOnce([{ cnt: 8 }])
        .mockResolvedValueOnce([{ week: '3월1주차', count: 15 }])
        .mockResolvedValueOnce([{ userId: 'u1', week: '3월1주차', count: 5 }])
        .mockResolvedValueOnce([{ userId: 'u1', count: 15, doneCount: 8, uniqueProblemCount: 3, uniqueDoneCount: 2 }])
        .mockResolvedValueOnce([{ problemid: 'p1', cnt: 1, donecnt: 1 }]);
      const recentSubs = [createMockSubmission({ id: 'sub-recent-1' })];
      repo.find.mockResolvedValue(recentSubs);

      const result = await service.getStudyStats('study-uuid-1', undefined, undefined, ['p1', 'p2', 'p3']);

      expect(result.totalSubmissions).toBe(15);
      expect(result.uniqueSubmissions).toBe(10);
      expect(result.uniqueAnalyzed).toBe(8);
      expect(result.byWeek).toEqual([{ week: '3월1주차', count: 15 }]);
      expect(result.byMember[0].uniqueProblemCount).toBe(3);
      expect(result.recentSubmissions).toHaveLength(1);
      // repo.count는 사용되지 않아야 함 (activeProblemIds가 있으므로 createQueryBuilder+getCount 사용)
      expect(repo.count).not.toHaveBeenCalled();
    });
  });

  // ─── 14. create() — 지각 제출 (checkLateSubmission) ───────────
  describe('create() — 지각 제출', () => {
    it('마감 시간이 지났으면 isLate=true로 저장', async () => {
      // checkLateSubmission — 마감 시간이 과거
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { deadline: '2020-01-01T00:00:00Z', status: 'active' } }),
      });

      const saved = createMockSubmission({ isLate: true });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);
      sagaOrchestrator.advanceToGitHubQueued.mockResolvedValue(undefined);

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("late")',
      };

      await service.create(dto, 'user-1', 'study-uuid-1');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isLate: true }),
      );
    });

    it('마감 시간 조회 실패 시 isLate=false', async () => {
      // checkLateSubmission — 조회 실패
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 500 });

      const saved = createMockSubmission({ isLate: false });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);
      sagaOrchestrator.advanceToGitHubQueued.mockResolvedValue(undefined);

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("on-time")',
      };

      await service.create(dto, 'user-1', 'study-uuid-1');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isLate: false }),
      );
    });

    it('마감 시간 미설정(null)이면 isLate=false', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { deadline: null, status: 'active' } }),
      });

      const saved = createMockSubmission({ isLate: false });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);
      sagaOrchestrator.advanceToGitHubQueued.mockResolvedValue(undefined);

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("no-deadline")',
      };

      await service.create(dto, 'user-1', 'study-uuid-1');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isLate: false }),
      );
    });

    it('마감 시간 조회 중 네트워크 에러 시 isLate=false', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('network error'));

      const saved = createMockSubmission({ isLate: false });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);
      sagaOrchestrator.advanceToGitHubQueued.mockResolvedValue(undefined);

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("error")',
      };

      await service.create(dto, 'user-1', 'study-uuid-1');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isLate: false }),
      );
    });
  });

  // ─── 16. findByStudyAndUser() — 빈 결과 ──────────────────────
  describe('findByStudyAndUser() — 빈 결과', () => {
    it('제출이 없으면 빈 배열 반환', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findByStudyAndUser('study-uuid-1', 'user-1');

      expect(result).toEqual([]);
    });
  });

  // ─── 18. findAllByStudy() — 스터디 전체 제출 ────────────────────
  describe('findAllByStudy()', () => {
    it('스터디 전체 제출 목록을 반환한다', async () => {
      const submissions = [
        createMockSubmission({ id: 'sub-1', userId: 'user-1' }),
        createMockSubmission({ id: 'sub-2', userId: 'user-2' }),
      ];
      repo.find.mockResolvedValue(submissions);

      const result = await service.findAllByStudy('study-uuid-1');

      expect(result).toEqual(submissions);
      expect(repo.find).toHaveBeenCalledWith({
        where: { studyId: 'study-uuid-1' },
        order: { createdAt: 'DESC' },
        select: expect.any(Array),
      });
    });

    it('제출이 없으면 빈 배열 반환', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findAllByStudy('study-uuid-1');

      expect(result).toEqual([]);
    });
  });

  // ─── 19. findByStudyAndUserPaginated() — problemId 필터 ──────
  describe('findByStudyAndUserPaginated() — problemId 필터', () => {
    it('problemId 필터가 적용된다', async () => {
      const mockQb = createMockQueryBuilder();
      repo.createQueryBuilder.mockReturnValue(mockQb as any);
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const query: PaginationQueryDto = { problemId: 'problem-uuid-1' };
      await service.findByStudyAndUserPaginated('study-uuid-1', 'user-1', query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('s.problemId = :problemId', { problemId: 'problem-uuid-1' });
    });
  });

  // ─── 17. create() — 마감 시간이 미래 (isLate=false) ─────────────
  describe('create() — 마감 시간이 미래인 경우', () => {
    it('마감 시간이 미래이면 isLate=false로 저장', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 1주일 후

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { deadline: futureDate, status: 'active' } }),
      });

      const saved = createMockSubmission({ isLate: false });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);
      sagaOrchestrator.advanceToGitHubQueued.mockResolvedValue(undefined);

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("future")',
      };

      await service.create(dto, 'user-1', 'study-uuid-1');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isLate: false }),
      );
    });
  });
});
