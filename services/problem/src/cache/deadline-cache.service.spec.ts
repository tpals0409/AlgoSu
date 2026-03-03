import { Test, TestingModule } from '@nestjs/testing';
import { DeadlineCacheService } from './deadline-cache.service';
import { REDIS_CLIENT } from './cache.module';

describe('DeadlineCacheService', () => {
  let service: DeadlineCacheService;
  let redis: Record<string, jest.Mock>;

  const STUDY_ID = 'study-uuid-001';
  const PROBLEM_ID = 'prob-uuid-001';

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadlineCacheService,
        {
          provide: REDIS_CLIENT,
          useValue: redis,
        },
      ],
    }).compile();

    service = module.get<DeadlineCacheService>(DeadlineCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // 1-3. getDeadline()
  // ──────────────────────────────────────────────
  describe('getDeadline()', () => {
    it('캐시 히트: 저장된 deadline 문자열 반환', async () => {
      const cachedValue = '2026-03-07T23:59:59.000Z';
      redis.get.mockResolvedValue(cachedValue);

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      expect(redis.get).toHaveBeenCalledWith(`deadline:${STUDY_ID}:${PROBLEM_ID}`);
      expect(result).toBe(cachedValue);
    });

    it('캐시 미스: null 반환', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      expect(redis.get).toHaveBeenCalledWith(`deadline:${STUDY_ID}:${PROBLEM_ID}`);
      expect(result).toBeNull();
    });

    it('Redis 오류: null 반환 (fall-through)', async () => {
      redis.get.mockRejectedValue(new Error('Redis connection refused'));

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      expect(redis.get).toHaveBeenCalledWith(`deadline:${STUDY_ID}:${PROBLEM_ID}`);
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // 4-5. setDeadline()
  // ──────────────────────────────────────────────
  describe('setDeadline()', () => {
    it('정상 설정: ISO 문자열 + EX 300', async () => {
      const deadline = new Date('2026-03-07T23:59:59.000Z');
      redis.set.mockResolvedValue('OK');

      await service.setDeadline(STUDY_ID, PROBLEM_ID, deadline);

      expect(redis.set).toHaveBeenCalledWith(
        `deadline:${STUDY_ID}:${PROBLEM_ID}`,
        deadline.toISOString(),
        'EX',
        300,
      );
    });

    it('deadline null: value="null" 문자열로 저장', async () => {
      redis.set.mockResolvedValue('OK');

      await service.setDeadline(STUDY_ID, PROBLEM_ID, null);

      expect(redis.set).toHaveBeenCalledWith(
        `deadline:${STUDY_ID}:${PROBLEM_ID}`,
        'null',
        'EX',
        300,
      );
    });
  });

  // ──────────────────────────────────────────────
  // 6. invalidateDeadline()
  // ──────────────────────────────────────────────
  describe('invalidateDeadline()', () => {
    it('캐시 삭제: DEL 호출', async () => {
      redis.del.mockResolvedValue(1);

      await service.invalidateDeadline(STUDY_ID, PROBLEM_ID);

      expect(redis.del).toHaveBeenCalledWith(`deadline:${STUDY_ID}:${PROBLEM_ID}`);
    });
  });

  // ──────────────────────────────────────────────
  // 7. setWeekProblems()
  // ──────────────────────────────────────────────
  describe('setWeekProblems()', () => {
    it('주차별 캐시 설정: TTL 600 확인', async () => {
      const weekNumber = '3월1주차';
      const data = JSON.stringify([{ id: PROBLEM_ID, title: '두 수의 합' }]);
      redis.set.mockResolvedValue('OK');

      await service.setWeekProblems(STUDY_ID, weekNumber, data);

      expect(redis.set).toHaveBeenCalledWith(
        `problem:week:${STUDY_ID}:${weekNumber}`,
        data,
        'EX',
        600,
      );
    });
  });

  // ──────────────────────────────────────────────
  // 8. invalidateWeekProblems()
  // ──────────────────────────────────────────────
  describe('invalidateWeekProblems()', () => {
    it('주차별 캐시 삭제: DEL 호출', async () => {
      const weekNumber = '3월1주차';
      redis.del.mockResolvedValue(1);

      await service.invalidateWeekProblems(STUDY_ID, weekNumber);

      expect(redis.del).toHaveBeenCalledWith(`problem:week:${STUDY_ID}:${weekNumber}`);
    });
  });
});
