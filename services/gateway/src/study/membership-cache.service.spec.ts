import { ConfigService } from '@nestjs/config';
import { MembershipCacheService } from './membership-cache.service';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn().mockReturnThis(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('MembershipCacheService', () => {
  let service: MembershipCacheService;
  let configService: Record<string, jest.Mock>;

  const STUDY_ID = 'study-id-1';
  const USER_ID = 'user-id-1';

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    service = new MembershipCacheService(
      configService as unknown as ConfigService,
      mockLogger as any,
    );
  });

  describe('invalidate', () => {
    it('단일 사용자 멤버십 + denied 키 삭제', async () => {
      await service.invalidate(STUDY_ID, USER_ID);

      expect(mockRedis.del).toHaveBeenCalledWith(`membership:${STUDY_ID}:${USER_ID}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`membership:${STUDY_ID}:${USER_ID}:denied`);
    });
  });

  describe('invalidateAll', () => {
    it('패턴 매칭 키가 있으면 일괄 삭제', async () => {
      mockRedis.keys.mockResolvedValue([
        `membership:${STUDY_ID}:user1`,
        `membership:${STUDY_ID}:user2`,
      ]);

      await service.invalidateAll(STUDY_ID);

      expect(mockRedis.keys).toHaveBeenCalledWith(`membership:${STUDY_ID}:*`);
      expect(mockRedis.del).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:user1`,
        `membership:${STUDY_ID}:user2`,
      );
    });

    it('패턴 매칭 키가 없으면 del 호출 안 함', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.invalidateAll(STUDY_ID);

      expect(mockRedis.keys).toHaveBeenCalledWith(`membership:${STUDY_ID}:*`);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('Redis 연결 오류 콜백', () => {
    it('Redis on error 이벤트 발생 시 에러 로깅 (크래시 방지)', () => {
      const errorCall = (mockRedis.on as jest.Mock).mock.calls.find(
        (call: [string, ...unknown[]]) => call[0] === 'error',
      );
      expect(errorCall).toBeDefined();
      const handler = errorCall![1] as (err: Error) => void;
      expect(() => handler(new Error('connection refused'))).not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('Redis 연결을 정상 종료한다', async () => {
      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
