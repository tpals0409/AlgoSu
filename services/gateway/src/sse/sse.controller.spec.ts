import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { SseController } from './sse.controller';

// --- ioredis 모킹 ---
const mockSubscribe = jest.fn().mockResolvedValue(undefined);
const mockUnsubscribe = jest.fn().mockResolvedValue(undefined);
const mockRedisOn = jest.fn().mockReturnThis();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: mockRedisOn,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  }));
});

// --- global fetch 모킹 ---
const mockFetch = jest.fn();
global.fetch = mockFetch;

// --- jwt 모킹 ---
jest.mock('jsonwebtoken');
const mockVerify = jwt.verify as jest.Mock;

describe('SseController', () => {
  let controller: SseController;
  let notificationService: Record<string, jest.Mock>;
  let loggerService: Record<string, jest.Mock>;

  const JWT_SECRET = 'test-jwt-secret';
  const USER_ID = 'user-id-1';
  const SUBMISSION_ID = '550e8400-e29b-41d4-a716-446655440000';

  function createMockReq(cookieToken?: string) {
    const listeners: Record<string, (() => void)[]> = {};
    return {
      cookies: cookieToken ? { token: cookieToken } : {},
      headers: {},
      query: {},
      on: jest.fn((event: string, cb: () => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      _listeners: listeners,
    };
  }

  function createMockRes() {
    return {
      setHeader: jest.fn(),
      write: jest.fn().mockReturnValue(true),
      end: jest.fn(),
      writableEnded: false,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return JWT_SECRET;
        if (key === 'SUBMISSION_SERVICE_URL') return 'http://submission:3000';
        if (key === 'INTERNAL_KEY_SUBMISSION') return 'internal-key';
        return undefined;
      }),
    };

    notificationService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    loggerService = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    controller = new SseController(
      configService as unknown as ConfigService,
      notificationService as never,
      loggerService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── 인증 ─────────────────────────────────

  describe('streamStatus — 인증', () => {
    it('쿠키 토큰 없으면 UnauthorizedException', async () => {
      const req = createMockReq();
      const res = createMockRes();

      await expect(
        controller.streamStatus(SUBMISSION_ID, req as never, res as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('유효하지 않은 토큰 → UnauthorizedException', async () => {
      mockVerify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const req = createMockReq('bad-token');
      const res = createMockRes();

      await expect(
        controller.streamStatus(SUBMISSION_ID, req as never, res as never),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── 소유권 검증 ──────────────────────────

  describe('streamStatus — 소유권 검증', () => {
    it('소유자가 아닌 경우 ForbiddenException', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: 'different-user' }),
      });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await expect(
        controller.streamStatus(SUBMISSION_ID, req as never, res as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('소유권 검증 API 실패 시 ForbiddenException', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await expect(
        controller.streamStatus(SUBMISSION_ID, req as never, res as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── SSE 연결 설정 ─────────────────────────

  describe('streamStatus — SSE 연결', () => {
    beforeEach(() => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: USER_ID }),
      });
    });

    it('SSE 헤더 설정 + Redis 채널 구독', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockSubscribe).toHaveBeenCalledWith(`submission:status:${SUBMISSION_ID}`);
    });

    it('클라이언트 연결 종료 시 cleanup 실행', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      // 클라이언트 close 이벤트 시뮬레이션
      const closeCb = (req.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;
      expect(closeCb).toBeDefined();

      closeCb();
      expect(res.end).toHaveBeenCalled();
    });
  });

  // ─── 알림 SSE ────────────────────────────

  describe('streamNotifications', () => {
    it('쿠키 토큰 없으면 UnauthorizedException', async () => {
      const req = createMockReq();
      const res = createMockRes();

      await expect(
        controller.streamNotifications(req as never, res as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('인증 성공 시 SSE 헤더 설정 + 알림 채널 구독', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamNotifications(req as never, res as never);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockSubscribe).toHaveBeenCalledWith(`notification:user:${USER_ID}`);
    });
  });
});
