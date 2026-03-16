import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudyNoteService } from './study-note.service';
import { StudyNote } from './study-note.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── Mock 팩토리 ────────────────────────────────────────────────
const mockNoteRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

// ─── 테스트 헬퍼 ────────────────────────────────────────────────
const createMockNote = (overrides: Partial<StudyNote> = {}): StudyNote =>
  ({
    id: 1,
    publicId: 'note-pub-1',
    problemId: 'problem-uuid-1',
    studyId: 'study-uuid-1',
    content: '이 문제는 DP로 풀면 됩니다',
    createdAt: new Date('2026-02-28T00:00:00Z'),
    updatedAt: new Date('2026-02-28T00:00:00Z'),
    generatePublicId: jest.fn(),
    ...overrides,
  }) as unknown as StudyNote;

describe('StudyNoteService', () => {
  let service: StudyNoteService;
  let noteRepo: jest.Mocked<Repository<StudyNote>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyNoteService,
        { provide: getRepositoryToken(StudyNote), useFactory: mockNoteRepo },
        { provide: StructuredLoggerService, useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } },
      ],
    }).compile();

    service = module.get<StudyNoteService>(StudyNoteService);
    noteRepo = module.get(getRepositoryToken(StudyNote));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── upsert() ─────────────────────────────────────────────────

  describe('upsert() — 노트 생성', () => {
    it('기존 노트가 없으면 새로 생성한다', async () => {
      noteRepo.findOne.mockResolvedValue(null);
      const saved = createMockNote();
      noteRepo.save.mockResolvedValue(saved);

      const result = await service.upsert(
        { problemId: 'problem-uuid-1', content: '이 문제는 DP로 풀면 됩니다' },
        'user-1',
        'study-uuid-1',
      );

      expect(noteRepo.findOne).toHaveBeenCalledWith({
        where: { problemId: 'problem-uuid-1', studyId: 'study-uuid-1' },
      });
      expect(noteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          problemId: 'problem-uuid-1',
          studyId: 'study-uuid-1',
          content: '이 문제는 DP로 풀면 됩니다',
        }),
      );
      expect(result).toEqual(saved);
    });
  });

  describe('upsert() — 노트 수정 (기존 존재)', () => {
    it('기존 노트가 있으면 content를 업데이트한다', async () => {
      const existing = createMockNote();
      noteRepo.findOne.mockResolvedValue(existing);
      const updated = createMockNote({ content: '수정된 내용' });
      noteRepo.save.mockResolvedValue(updated);

      const result = await service.upsert(
        { problemId: 'problem-uuid-1', content: '수정된 내용' },
        'user-1',
        'study-uuid-1',
      );

      expect(noteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ content: '수정된 내용' }),
      );
      expect(result).toEqual(updated);
    });
  });

  // ─── findByProblemAndStudy() ──────────────────────────────────

  describe('findByProblemAndStudy() — 노트 조회', () => {
    it('존재하는 노트를 반환한다', async () => {
      const note = createMockNote();
      noteRepo.findOne.mockResolvedValue(note);

      const result = await service.findByProblemAndStudy('problem-uuid-1', 'study-uuid-1');

      expect(noteRepo.findOne).toHaveBeenCalledWith({
        where: { problemId: 'problem-uuid-1', studyId: 'study-uuid-1' },
      });
      expect(result).toEqual(note);
    });

    it('노트가 없으면 null을 반환한다', async () => {
      noteRepo.findOne.mockResolvedValue(null);

      const result = await service.findByProblemAndStudy('problem-uuid-1', 'study-uuid-1');

      expect(result).toBeNull();
    });
  });
});
