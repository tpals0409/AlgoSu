import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizRecordService } from './quiz-record.service';
import { QuizRecord, QuizRecordCategory } from './quiz-record.entity';
import { UpsertQuizRecordDto } from './dto/upsert-quiz-record.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockRecord = (overrides: Partial<QuizRecord> = {}): QuizRecord =>
  ({
    id: 'rec-1',
    user_id: USER_ID,
    category: QuizRecordCategory.ALGORITHM,
    difficulty: 'ALL',
    best_score_percent: 80,
    played_at: new Date('2026-06-02T00:00:00.000Z'),
    created_at: new Date('2026-06-02T00:00:00.000Z'),
    updated_at: new Date('2026-06-02T00:00:00.000Z'),
    ...overrides,
  }) as QuizRecord;

describe('QuizRecordService', () => {
  let service: QuizRecordService;
  let repo: jest.Mocked<Repository<QuizRecord>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizRecordService,
        {
          provide: getRepositoryToken(QuizRecord),
          useValue: {
            query: jest.fn(),
            find: jest.fn(),
            findOneOrFail: jest.fn(),
          },
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(QuizRecordService);
    repo = module.get(getRepositoryToken(QuizRecord));
  });

  afterEach(() => jest.clearAllMocks());

  describe('upsertBest', () => {
    const dto: UpsertQuizRecordDto = {
      userId: USER_ID,
      category: QuizRecordCategory.ALGORITHM,
      difficulty: 'ALL',
      scorePercent: 90,
      playedAt: '2026-06-02T01:00:00.000Z',
    };

    it('ON CONFLICT 단일 원자 쿼리로 upsert하고 현재 best를 반환한다', async () => {
      const updated = mockRecord({ best_score_percent: 90 });
      (repo.query as jest.Mock).mockResolvedValue(undefined);
      (repo.findOneOrFail as jest.Mock).mockResolvedValue(updated);

      const result = await service.upsertBest(dto);

      expect(result).toEqual(updated);
      // 단일 쿼리 (find→save race 회피)
      expect(repo.query).toHaveBeenCalledTimes(1);
      const [sql, params] = (repo.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('ON CONFLICT (user_id, category, difficulty)');
      // 더 높은 점수만 반영하는 WHERE 가드
      expect(sql).toContain('best_score_percent < EXCLUDED.best_score_percent');
      expect(params).toEqual([USER_ID, 'ALGORITHM', 'ALL', 90, '2026-06-02T01:00:00.000Z']);
    });

    it('동률/낮은 점수는 WHERE 가드로 무시되어 기존 best가 유지된다', async () => {
      // WHERE 절이 false → UPDATE 미발생 → 기존 best 그대로 조회됨
      const existing = mockRecord({ best_score_percent: 90 });
      (repo.query as jest.Mock).mockResolvedValue(undefined);
      (repo.findOneOrFail as jest.Mock).mockResolvedValue(existing);

      const lowerDto: UpsertQuizRecordDto = { ...dto, scorePercent: 70 };
      const result = await service.upsertBest(lowerDto);

      expect(result.best_score_percent).toBe(90);
    });
  });

  describe('findByUser', () => {
    it('사용자의 전체 best 목록을 정렬하여 반환한다', async () => {
      const records = [mockRecord(), mockRecord({ id: 'rec-2', difficulty: 'EASY' })];
      (repo.find as jest.Mock).mockResolvedValue(records);

      const result = await service.findByUser(USER_ID);

      expect(result).toEqual(records);
      expect(repo.find).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
        order: { category: 'ASC', difficulty: 'ASC' },
      });
    });

    it('기록이 없으면 빈 배열을 반환한다', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.findByUser(USER_ID);

      expect(result).toEqual([]);
    });
  });
});
