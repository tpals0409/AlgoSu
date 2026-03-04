import { ConfigService } from '@nestjs/config';
import { RedisThrottlerStorage } from './redis-throttler.storage';

// --- ioredis 모듈 모킹 ---
const mockPipeline = {
  zremrangebyscore: jest.fn().mockReturnThis(),
  zadd: jest.fn().mockReturnThis(),
  zcard: jest.fn().mockReturnThis(),
  pexpire: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

const mockRedis = {
  pipeline: jest.fn().mockReturnValue(mockPipeline),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn().mockReturnThis(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let configService: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    storage = new RedisThrottlerStorage(
      configService as unknown as ConfigService,
    );
  });

  // ============================
  // 1. increment — Sliding Window 카운트
  // ============================
  describe('increment', () => {
    it('정상 — sliding window 카운트 반환', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0],    // zremrangebyscore
        [null, 1],    // zadd
        [null, 5],    // zcard (totalHits)
        [null, 1],    // pexpire
      ]);

      const result = await storage.increment('test-key', 60000);

      expect(result.totalHits).toBe(5);
      expect(result.timeToExpire).toBe(60000);
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
        'throttle:test-key',
        0,
        expect.any(Number),
      );
      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        'throttle:test-key',
        expect.any(Number),
        expect.any(String),
      );
      expect(mockPipeline.zcard).toHaveBeenCalledWith('throttle:test-key');
      expect(mockPipeline.pexpire).toHaveBeenCalledWith('throttle:test-key', 60000);
    });

    it('첫 요청 — totalHits 1 반환', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 1],
        [null, 1],    // 첫 요청이므로 1
        [null, 1],
      ]);

      const result = await storage.increment('new-key', 30000);

      expect(result.totalHits).toBe(1);
      expect(result.timeToExpire).toBe(30000);
    });

    it('pipeline 결과 null 경우 — totalHits 0 반환', async () => {
      mockPipeline.exec.mockResolvedValue(null);

      const result = await storage.increment('test-key', 60000);

      expect(result.totalHits).toBe(0);
    });

    it('Redis 장애 시 — fail-open (totalHits 0 반환)', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Redis connection refused'));

      const result = await storage.increment('test-key', 60000);

      expect(result.totalHits).toBe(0);
      expect(result.timeToExpire).toBe(60000);
    });
  });

  // ============================
  // 2. onModuleDestroy — Redis 연결 종료
  // ============================
  describe('onModuleDestroy', () => {
    it('Redis 연결 종료', async () => {
      await storage.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
