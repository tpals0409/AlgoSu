import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InviteThrottleService } from './invite-throttle.service';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn().mockResolvedValue(1),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn().mockReturnThis(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('InviteThrottleService', () => {
  let service: InviteThrottleService;

  const IP = '192.168.1.1';
  const CODE = 'ABCD1234';

  beforeEach(() => {
    jest.clearAllMocks();

    const configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue: unknown) => {
        if (key === 'INVITE_MAX_FAILURES') return 5;
        if (key === 'INVITE_LOCK_SECONDS') return 900;
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        return defaultValue;
      }),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    service = new InviteThrottleService(
      configService as unknown as ConfigService,
      mockLogger as any,
    );
  });

  // ============================
  // recordFailure
  // ============================
  describe('recordFailure', () => {
    it('첫 실패 — 카운터 증가 + expire 설정', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await service.recordFailure(IP, CODE);

      expect(mockRedis.incr).toHaveBeenCalledWith(`invite_fail:${IP}:${CODE}`);
      expect(mockRedis.expire).toHaveBeenCalledWith(`invite_fail:${IP}:${CODE}`, 900);
    });

    it('2회째 실패 — expire 재설정 안 함', async () => {
      mockRedis.incr.mockResolvedValue(2);

      await service.recordFailure(IP, CODE);

      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('5회 실패 도달 → BadRequestException', async () => {
      mockRedis.incr.mockResolvedValue(5);

      await expect(service.recordFailure(IP, CODE)).rejects.toThrow(BadRequestException);
      await expect(service.recordFailure(IP, CODE)).rejects.toThrow(
        '초대코드 입력 횟수를 초과했습니다.',
      );
    });

    it('5회 초과(6회) → BadRequestException', async () => {
      mockRedis.incr.mockResolvedValue(6);

      await expect(service.recordFailure(IP, CODE)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  // checkLock
  // ============================
  describe('checkLock', () => {
    it('잠금 없음 — 정상 통과', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.checkLock(IP, CODE)).resolves.toBeUndefined();
    });

    it('실패 횟수 5 미만 — 정상 통과', async () => {
      mockRedis.get.mockResolvedValue('3');

      await expect(service.checkLock(IP, CODE)).resolves.toBeUndefined();
    });

    it('실패 횟수 5 이상 — 잠금 → BadRequestException', async () => {
      mockRedis.get.mockResolvedValue('5');

      await expect(service.checkLock(IP, CODE)).rejects.toThrow(BadRequestException);
      await expect(service.checkLock(IP, CODE)).rejects.toThrow(
        '초대코드 입력 횟수를 초과했습니다.',
      );
    });

    it('실패 횟수 5 초과 — 잠금 → BadRequestException', async () => {
      mockRedis.get.mockResolvedValue('10');

      await expect(service.checkLock(IP, CODE)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  // clearFailures
  // ============================
  describe('clearFailures', () => {
    it('성공 시 카운터 삭제', async () => {
      await service.clearFailures(IP, CODE);

      expect(mockRedis.del).toHaveBeenCalledWith(`invite_fail:${IP}:${CODE}`);
    });
  });
});
