import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { QuizRecordController } from './quiz-record.controller';
import { QuizRecordService } from './quiz-record.service';
import { SaveQuizRecordDto } from './dto/save-quiz-record.dto';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockRecord = {
  id: 'rec-1',
  user_id: USER_ID,
  category: 'ALGORITHM',
  difficulty: 'ALL',
  best_score_percent: 90,
};

describe('QuizRecordController', () => {
  let controller: QuizRecordController;
  let service: Record<string, jest.Mock>;

  function createMockReq(headers: Record<string, unknown> = {}) {
    return { headers: { 'x-user-id': USER_ID, ...headers } } as never;
  }

  const dto: SaveQuizRecordDto = {
    category: 'ALGORITHM',
    difficulty: 'ALL',
    scorePercent: 90,
    playedAt: '2026-06-02T00:00:00.000Z',
  };

  beforeEach(async () => {
    service = {
      save: jest.fn(),
      findMine: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizRecordController],
      providers: [{ provide: QuizRecordService, useValue: service }],
    }).compile();

    controller = module.get(QuizRecordController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('POST /api/quiz-records', () => {
    it('헤더 userId로 service.save를 호출한다', async () => {
      service.save.mockResolvedValue(mockRecord);

      const result = await controller.save(createMockReq(), dto);

      expect(result).toEqual(mockRecord);
      expect(service.save).toHaveBeenCalledWith(USER_ID, dto);
    });

    it('X-User-ID 헤더 미존재 시 UnauthorizedException', async () => {
      await expect(
        controller.save(createMockReq({ 'x-user-id': undefined }), dto),
      ).rejects.toThrow(UnauthorizedException);
      expect(service.save).not.toHaveBeenCalled();
    });

    it('X-User-ID 형식 오류(비 UUID) 시 UnauthorizedException', async () => {
      await expect(
        controller.save(createMockReq({ 'x-user-id': 'not-a-uuid' }), dto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('X-User-ID가 배열(비 string)일 때 UnauthorizedException', async () => {
      await expect(
        controller.save(createMockReq({ 'x-user-id': [USER_ID] }), dto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GET /api/quiz-records', () => {
    it('헤더 userId로 service.findMine을 호출한다', async () => {
      service.findMine.mockResolvedValue([mockRecord]);

      const result = await controller.findMine(createMockReq());

      expect(result).toEqual([mockRecord]);
      expect(service.findMine).toHaveBeenCalledWith(USER_ID);
    });

    it('X-User-ID 헤더 미존재 시 UnauthorizedException', async () => {
      await expect(
        controller.findMine(createMockReq({ 'x-user-id': undefined })),
      ).rejects.toThrow(UnauthorizedException);
      expect(service.findMine).not.toHaveBeenCalled();
    });
  });
});
