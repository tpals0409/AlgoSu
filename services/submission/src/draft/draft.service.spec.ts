import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DraftService } from './draft.service';
import { Draft } from './draft.entity';
import { UpsertDraftDto } from '../submission/dto/create-submission.dto';

// ─── Mock 팩토리 ────────────────────────────────────────────────
const mockDraftRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

// ─── 테스트 헬퍼 ────────────────────────────────────────────────
const createMockDraft = (overrides: Partial<Draft> = {}): Draft => ({
  id: 'draft-uuid-1',
  studyId: 'study-uuid-1',
  userId: 'user-1',
  problemId: 'problem-uuid-1',
  language: 'python',
  code: 'print("draft")',
  savedAt: new Date('2026-02-28T00:00:00Z'),
  createdAt: new Date('2026-02-28T00:00:00Z'),
  updatedAt: new Date('2026-02-28T00:00:00Z'),
  ...overrides,
});

describe('DraftService', () => {
  let service: DraftService;
  let repo: jest.Mocked<Repository<Draft>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftService,
        { provide: getRepositoryToken(Draft), useFactory: mockDraftRepo },
      ],
    }).compile();

    service = module.get<DraftService>(DraftService);
    repo = module.get(getRepositoryToken(Draft));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── 1. upsert() — 신규 생성 ─────────────────────────────────
  describe('upsert() — 신규 생성', () => {
    it('기존 Draft가 없으면 새로 생성한다', async () => {
      const dto: UpsertDraftDto = {
        problemId: 'problem-uuid-1',
        language: 'python',
        code: 'print("new draft")',
      };

      const newDraft = createMockDraft({ code: 'print("new draft")' });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(newDraft);
      repo.save.mockResolvedValue(newDraft);

      // Act
      const result = await service.upsert(dto, 'user-1', 'study-uuid-1');

      // Assert
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { studyId: 'study-uuid-1', userId: 'user-1', problemId: 'problem-uuid-1' },
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studyId: 'study-uuid-1',
          userId: 'user-1',
          problemId: 'problem-uuid-1',
          language: 'python',
          code: 'print("new draft")',
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(newDraft);
      expect(result).toEqual(newDraft);
    });
  });

  // ─── 2. upsert() — 기존 업데이트 ─────────────────────────────
  describe('upsert() — 기존 업데이트', () => {
    it('기존 Draft가 있으면 language/code를 업데이트하고 savedAt을 갱신한다', async () => {
      const existing = createMockDraft({
        language: 'python',
        code: 'print("old")',
        savedAt: new Date('2026-02-27T00:00:00Z'),
      });

      const dto: UpsertDraftDto = {
        problemId: 'problem-uuid-1',
        language: 'java',
        code: 'System.out.println("updated");',
      };

      repo.findOne.mockResolvedValue(existing);

      const updated = {
        ...existing,
        language: 'java',
        code: 'System.out.println("updated");',
        savedAt: expect.any(Date),
      };
      repo.save.mockResolvedValue(updated as Draft);

      // Act
      const result = await service.upsert(dto, 'user-1', 'study-uuid-1');

      // Assert
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { studyId: 'study-uuid-1', userId: 'user-1', problemId: 'problem-uuid-1' },
      });
      expect(repo.create).not.toHaveBeenCalled(); // 기존이 있으므로 create 호출 안 됨
      expect(existing.language).toBe('java');
      expect(existing.code).toBe('System.out.println("updated");');
      expect(existing.savedAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalledWith(existing);
      expect(result).toEqual(updated);
    });
  });

  // ─── 3. findByProblem() — 조회 성공 ──────────────────────────
  describe('findByProblem() — 조회 성공', () => {
    it('스터디+사용자+문제별 Draft를 반환한다', async () => {
      const draft = createMockDraft();
      repo.findOne.mockResolvedValue(draft);

      const result = await service.findByProblem('study-uuid-1', 'user-1', 'problem-uuid-1');

      expect(result).toEqual(draft);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { studyId: 'study-uuid-1', userId: 'user-1', problemId: 'problem-uuid-1' },
      });
    });
  });

  // ─── 4. findByProblem() — 미존재 → null ──────────────────────
  describe('findByProblem() — 미존재', () => {
    it('Draft가 없으면 null을 반환한다', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findByProblem('study-uuid-1', 'user-1', 'problem-uuid-1');

      expect(result).toBeNull();
    });
  });

  // ─── 5. deleteByProblem() — 삭제 ─────────────────────────────
  describe('deleteByProblem()', () => {
    it('스터디+사용자+문제별 Draft를 삭제한다', async () => {
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.deleteByProblem('study-uuid-1', 'user-1', 'problem-uuid-1');

      expect(repo.delete).toHaveBeenCalledWith({
        studyId: 'study-uuid-1',
        userId: 'user-1',
        problemId: 'problem-uuid-1',
      });
    });
  });
});
