import { ConfigService } from '@nestjs/config';
import { MembershipCacheService } from './membership-cache.service';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValue(['0', []]),
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
    it('SCAN으로 패턴 매칭 키가 있으면 일괄 삭제', async () => {
      mockRedis.scan.mockResolvedValue([
        '0',
        [`membership:${STUDY_ID}:user1`, `membership:${STUDY_ID}:user2`],
      ]);

      await service.invalidateAll(STUDY_ID);

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        `membership:${STUDY_ID}:*`,
        'COUNT',
        100,
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:user1`,
        `membership:${STUDY_ID}:user2`,
      );
    });

    it('SCAN 결과가 비면 del 호출 안 함', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await service.invalidateAll(STUDY_ID);

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        `membership:${STUDY_ID}:*`,
        'COUNT',
        100,
      );
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('커서가 0이 아니면 모든 페이지를 순회하며 삭제', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['42', [`membership:${STUDY_ID}:user1`]])
        .mockResolvedValueOnce(['0', [`membership:${STUDY_ID}:user2`]]);

      await service.invalidateAll(STUDY_ID);

      expect(mockRedis.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        `membership:${STUDY_ID}:*`,
        'COUNT',
        100,
      );
      expect(mockRedis.scan).toHaveBeenNthCalledWith(
        2,
        '42',
        'MATCH',
        `membership:${STUDY_ID}:*`,
        'COUNT',
        100,
      );
      expect(mockRedis.del).toHaveBeenCalledWith(`membership:${STUDY_ID}:user1`);
      expect(mockRedis.del).toHaveBeenCalledWith(`membership:${STUDY_ID}:user2`);
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
