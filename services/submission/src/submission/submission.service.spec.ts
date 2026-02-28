import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SubmissionService } from './submission.service';
import { Submission, SagaStep, GitHubSyncStatus } from './submission.entity';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

// ─── Mock 팩토리 ────────────────────────────────────────────────
const mockSubmissionRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockSagaOrchestrator = () => ({
  advanceToGitHubQueued: jest.fn(),
});

const mockConfigService = () => ({
  getOrThrow: jest.fn((key: string) => {
    const map: Record<string, string> = {
      GATEWAY_INTERNAL_URL: 'http://gateway:3000',
      INTERNAL_KEY_GATEWAY: 'test-internal-key',
    };
    return map[key];
  }),
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
  idempotencyKey: null,
  createdAt: new Date('2026-02-28T00:00:00Z'),
  updatedAt: new Date('2026-02-28T00:00:00Z'),
  ...overrides,
});

describe('SubmissionService', () => {
  let service: SubmissionService;
  let repo: jest.Mocked<Repository<Submission>>;
  let sagaOrchestrator: jest.Mocked<SagaOrchestratorService>;
  let configService: jest.Mocked<ConfigService>;

  // global.fetch 모킹
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionService,
        { provide: getRepositoryToken(Submission), useFactory: mockSubmissionRepo },
        { provide: SagaOrchestratorService, useFactory: mockSagaOrchestrator },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<SubmissionService>(SubmissionService);
    repo = module.get(getRepositoryToken(Submission));
    sagaOrchestrator = module.get(SagaOrchestratorService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ─── 1. create() — 정상 제출 ─────────────────────────────────
  describe('create() — 정상 제출', () => {
    it('GitHub 연동 검증 성공 -> DB 저장 -> Saga 진행', async () => {
      // Arrange: fetch로 GitHub 연동 상태 확인 성공
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ github_connected: true, github_username: 'test-user' }),
      });

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
      expect(global.fetch).toHaveBeenCalledWith(
        'http://gateway:3000/internal/users/user-1/github-status',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-internal-key': 'test-internal-key',
          }),
        }),
      );
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
      // Arrange
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ github_connected: true, github_username: 'test-user' }),
      });

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
  });

  // ─── 3. create() — GitHub 미연동 ─────────────────────────────
  describe('create() — GitHub 미연동', () => {
    it('github_connected=false이면 ForbiddenException', async () => {
      // Arrange
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ github_connected: false, github_username: null }),
      });

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("hello world")',
      };

      // Act & Assert
      await expect(service.create(dto, 'user-1', 'study-uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('fetch 응답이 ok=false이면 ForbiddenException', async () => {
      // Arrange
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const dto: CreateSubmissionDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("hello world")',
      };

      // Act & Assert
      await expect(service.create(dto, 'user-1', 'study-uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── 4. create() — Saga 진행 실패 ────────────────────────────
  describe('create() — Saga 진행 실패', () => {
    it('Saga 진행 실패해도 DB 저장은 성공한다 (에러 로그만)', async () => {
      // Arrange
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ github_connected: true, github_username: 'test-user' }),
      });

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
      });
    });
  });
});
