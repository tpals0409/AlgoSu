import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QuizRecordController } from './quiz-record.controller';
import { QuizRecordService } from './quiz-record.service';
import { QuizRecordCategory } from './quiz-record.entity';
import { UpsertQuizRecordDto } from './dto/upsert-quiz-record.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockRecord = {
  id: 'rec-1',
  user_id: USER_ID,
  category: QuizRecordCategory.ALGORITHM,
  difficulty: 'ALL',
  best_score_percent: 90,
  played_at: new Date('2026-06-02T00:00:00.000Z'),
  created_at: new Date('2026-06-02T00:00:00.000Z'),
  updated_at: new Date('2026-06-02T00:00:00.000Z'),
};

describe('QuizRecordController', () => {
  let controller: QuizRecordController;
  let service: jest.Mocked<Pick<QuizRecordService, keyof QuizRecordService>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizRecordController],
      providers: [
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-key') },
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        {
          provide: QuizRecordService,
          useValue: {
            upsertBest: jest.fn(),
            findByUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(QuizRecordController);
    service = module.get(QuizRecordService) as unknown as jest.Mocked<
      Pick<QuizRecordService, keyof QuizRecordService>
    >;
  });

  afterEach(() => jest.clearAllMocks());

  describe('POST /api/quiz-records', () => {
    it('upsert 결과를 data로 감싸 반환한다', async () => {
      (service.upsertBest as jest.Mock).mockResolvedValue(mockRecord);
      const dto: UpsertQuizRecordDto = {
        userId: USER_ID,
        category: QuizRecordCategory.ALGORITHM,
        difficulty: 'ALL',
        scorePercent: 90,
        playedAt: '2026-06-02T00:00:00.000Z',
      };

      const result = await controller.upsertBest(dto);

      expect(result).toEqual({ data: mockRecord });
      expect(service.upsertBest).toHaveBeenCalledWith(dto);
    });
  });

  describe('GET /api/quiz-records/by-user/:userId', () => {
    it('사용자 best 목록을 data로 감싸 반환한다', async () => {
      (service.findByUser as jest.Mock).mockResolvedValue([mockRecord]);

      const result = await controller.findByUser(USER_ID);

      expect(result).toEqual({ data: [mockRecord] });
      expect(service.findByUser).toHaveBeenCalledWith(USER_ID);
    });
  });
});
