import { Test, TestingModule } from '@nestjs/testing';
import { QuizRecordService } from './quiz-record.service';
import { IdentityClientService } from '../identity-client/identity-client.service';
import { SaveQuizRecordDto } from './dto/save-quiz-record.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockRecord = {
  id: 'rec-1',
  user_id: USER_ID,
  category: 'ALGORITHM',
  difficulty: 'ALL',
  best_score_percent: 90,
};

describe('QuizRecordService', () => {
  let service: QuizRecordService;
  let identityClient: Record<string, jest.Mock>;

  const dto: SaveQuizRecordDto = {
    category: 'ALGORITHM',
    difficulty: 'ALL',
    scorePercent: 90,
    playedAt: '2026-06-02T00:00:00.000Z',
  };

  beforeEach(async () => {
    identityClient = {
      saveQuizRecord: jest.fn(),
      findQuizRecordsByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizRecordService,
        { provide: IdentityClientService, useValue: identityClient },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(QuizRecordService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('save', () => {
    it('IdentityClient.saveQuizRecord에 userId + dto 필드를 위임한다', async () => {
      identityClient.saveQuizRecord.mockResolvedValue(mockRecord);

      const result = await service.save(USER_ID, dto);

      expect(result).toEqual(mockRecord);
      expect(identityClient.saveQuizRecord).toHaveBeenCalledWith(USER_ID, {
        category: 'ALGORITHM',
        difficulty: 'ALL',
        scorePercent: 90,
        playedAt: '2026-06-02T00:00:00.000Z',
      });
    });
  });

  describe('findMine', () => {
    it('IdentityClient.findQuizRecordsByUserId에 userId를 위임한다', async () => {
      identityClient.findQuizRecordsByUserId.mockResolvedValue([mockRecord]);

      const result = await service.findMine(USER_ID);

      expect(result).toEqual([mockRecord]);
      expect(identityClient.findQuizRecordsByUserId).toHaveBeenCalledWith(USER_ID);
    });
  });
});
