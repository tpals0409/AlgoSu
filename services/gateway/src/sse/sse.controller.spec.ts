import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { SseController } from './sse.controller';

// --- ioredis 모킹 ---
const mockSubscribe = jest.fn().mockResolvedValue(undefined);
const mockUnsubscribe = jest.fn().mockResolvedValue(undefined);
const mockRedisOn = jest.fn().mockReturnThis();

const mockQuit = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: mockRedisOn,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    quit: mockQuit,
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

    it('알림 메시지 수신 시 SSE 이벤트 전송', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamNotifications(req as never, res as never);

      // Redis on('message') 핸들러를 통해 메시지 발송
      const redisMessageHandler = mockRedisOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;
      expect(redisMessageHandler).toBeDefined();

      const channel = `notification:user:${USER_ID}`;
      const notifPayload = JSON.stringify({ id: 'n1', title: '테스트 알림' });
      redisMessageHandler(channel, notifPayload);

      expect(res.write).toHaveBeenCalledWith('event: notification\n');
      expect(res.write).toHaveBeenCalledWith(`data: ${notifPayload}\n\n`);
    });

    it('writableEnded 상태에서 메시지 전송 안 함', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamNotifications(req as never, res as never);

      // writableEnded 상태로 변경
      res.writableEnded = true;

      const redisMessageHandler = mockRedisOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      const channel = `notification:user:${USER_ID}`;
      // write 호출 횟수 기록 (이전 호출 제외)
      const writeCallsBefore = (res.write as jest.Mock).mock.calls.length;
      redisMessageHandler(channel, JSON.stringify({ id: 'n2' }));

      expect((res.write as jest.Mock).mock.calls.length).toBe(writeCallsBefore);
    });

    it('클라이언트 close 이벤트 시 cleanup 실행', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamNotifications(req as never, res as never);

      const closeCb = (req.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;
      expect(closeCb).toBeDefined();

      closeCb();
      expect(res.end).toHaveBeenCalled();
    });

    it('H16: 5분 타임아웃 시 timeout 이벤트 전송 후 cleanup', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamNotifications(req as never, res as never);

      // 5분 타이머 트리거
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(res.write).toHaveBeenCalledWith('event: timeout\n');
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"connection_timeout"'),
      );
      expect(res.end).toHaveBeenCalled();
    });
  });

  // ─── verifyToken 엣지 케이스 ─────────────

  describe('verifyToken — 엣지 케이스', () => {
    it('토큰이 문자열로 디코딩되면 UnauthorizedException', async () => {
      mockVerify.mockReturnValue('string-payload');

      const req = createMockReq('string-token');
      const res = createMockRes();

      await expect(
        controller.streamStatus(SUBMISSION_ID, req as never, res as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('토큰에 sub 필드가 없으면 UnauthorizedException', async () => {
      mockVerify.mockReturnValue({ iat: 123456 }); // sub 없음

      const req = createMockReq('no-sub-token');
      const res = createMockRes();

      await expect(
        controller.streamStatus(SUBMISSION_ID, req as never, res as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('토큰의 sub가 문자열이 아니면 UnauthorizedException', async () => {
      mockVerify.mockReturnValue({ sub: 12345 }); // number

      const req = createMockReq('numeric-sub-token');
      const res = createMockRes();

      await expect(
        controller.streamStatus(SUBMISSION_ID, req as never, res as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('UnauthorizedException 자체가 throw되면 그대로 전파', async () => {
      mockVerify.mockImplementation(() => {
        throw new UnauthorizedException('커스텀 인증 오류');
      });

      const req = createMockReq('custom-error-token');
      const res = createMockRes();

      await expect(
        controller.streamStatus(SUBMISSION_ID, req as never, res as never),
      ).rejects.toThrow('커스텀 인증 오류');
    });
  });

  // ─── 소유권 검증 — 네트워크 오류 ──────────

  describe('streamStatus — 소유권 검증 네트워크 오류', () => {
    it('fetch 네트워크 오류 시 ForbiddenException', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await expect(
        controller.streamStatus(SUBMISSION_ID, req as never, res as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── streamStatus 메시지 핸들링 ──────────

  describe('streamStatus — 메시지 핸들링', () => {
    let redisMessageHandler: (channel: string, message: string) => void;

    beforeEach(() => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: USER_ID }),
      });

      // Redis on('message') 핸들러 추출
      redisMessageHandler = mockRedisOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;
    });

    it('비종료 상태 메시지 → SSE status 이벤트 전송 (스트림 유지)', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      const channel = `submission:status:${SUBMISSION_ID}`;
      const event = {
        submissionId: SUBMISSION_ID,
        status: 'github_pushing',
        timestamp: new Date().toISOString(),
      };
      redisMessageHandler(channel, JSON.stringify(event));

      expect(res.write).toHaveBeenCalledWith('event: status\n');
      expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify(event)}\n\n`);
      // done 이벤트는 전송되지 않아야 함
      expect(res.write).not.toHaveBeenCalledWith('event: done\n');
    });

    it('ai_completed 종료 상태 → done 이벤트 + 알림 생성', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      const channel = `submission:status:${SUBMISSION_ID}`;
      const event = {
        submissionId: SUBMISSION_ID,
        status: 'ai_completed',
        timestamp: new Date().toISOString(),
      };
      redisMessageHandler(channel, JSON.stringify(event));

      expect(res.write).toHaveBeenCalledWith('event: status\n');
      expect(res.write).toHaveBeenCalledWith('event: done\n');
      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ status: 'stream_end' })}\n\n`,
      );

      // 알림 생성 확인
      expect(notificationService.createNotification).toHaveBeenCalledWith({
        userId: USER_ID,
        type: 'AI_COMPLETED',
        title: 'AI 분석 완료',
        message: 'AI 분석 완료',
        link: `/submissions/${SUBMISSION_ID}/analysis`,
      });

      // 500ms 후 cleanup
      jest.advanceTimersByTime(500);
      expect(res.end).toHaveBeenCalled();
    });

    it('ai_failed 종료 상태 → done 이벤트 + AI 분석 실패 알림', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      const channel = `submission:status:${SUBMISSION_ID}`;
      const event = {
        submissionId: SUBMISSION_ID,
        status: 'ai_failed',
        timestamp: new Date().toISOString(),
      };
      redisMessageHandler(channel, JSON.stringify(event));

      expect(notificationService.createNotification).toHaveBeenCalledWith({
        userId: USER_ID,
        type: 'AI_COMPLETED',
        title: 'AI 분석 실패',
        message: 'AI 분석 실패',
        link: `/submissions/${SUBMISSION_ID}/analysis`,
      });
    });

    it('github_token_invalid 종료 상태 → GitHub 토큰 오류 알림', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      const channel = `submission:status:${SUBMISSION_ID}`;
      const event = {
        submissionId: SUBMISSION_ID,
        status: 'github_token_invalid',
        timestamp: new Date().toISOString(),
      };
      redisMessageHandler(channel, JSON.stringify(event));

      expect(notificationService.createNotification).toHaveBeenCalledWith({
        userId: USER_ID,
        type: 'GITHUB_FAILED',
        title: 'GitHub 토큰 오류',
        message: 'GitHub 토큰 오류',
        link: `/submissions/${SUBMISSION_ID}/analysis`,
      });
    });

    it('알림 생성 실패 시 에러 로깅만 하고 스트림은 정상 종료', async () => {
      notificationService.createNotification.mockRejectedValue(
        new Error('DB connection error'),
      );

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      const channel = `submission:status:${SUBMISSION_ID}`;
      const event = {
        submissionId: SUBMISSION_ID,
        status: 'ai_completed',
        timestamp: new Date().toISOString(),
      };
      redisMessageHandler(channel, JSON.stringify(event));

      // done 이벤트는 정상 전송
      expect(res.write).toHaveBeenCalledWith('event: done\n');

      // Promise rejection이 처리될 때까지 대기
      await Promise.resolve();
      await Promise.resolve();

      expect(loggerService.error).toHaveBeenCalledWith(
        '알림 생성 실패',
        expect.any(Error),
      );
    });

    it('메시지 파싱 오류 시 에러 로깅', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      const channel = `submission:status:${SUBMISSION_ID}`;
      redisMessageHandler(channel, 'invalid-json{{{');

      expect(loggerService.error).toHaveBeenCalledWith(
        'SSE 메시지 파싱 오류',
        expect.any(Error),
      );
    });
  });

  // ─── streamStatus 타임아웃 ─────────────────

  describe('streamStatus — H16 타임아웃', () => {
    beforeEach(() => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: USER_ID }),
      });
    });

    it('5분 타임아웃 시 timeout 이벤트 전송 후 cleanup', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(res.write).toHaveBeenCalledWith('event: timeout\n');
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"connection_timeout"'),
      );
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining(`${5 * 60 * 1000}`),
      );
      expect(res.end).toHaveBeenCalled();
    });

    it('writableEnded 상태에서 타임아웃 → write 호출 안 함', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      // 먼저 close로 종료
      const closeCb = (req.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;
      closeCb();

      res.writableEnded = true;
      const writeCallsAfterClose = (res.write as jest.Mock).mock.calls.length;

      jest.advanceTimersByTime(5 * 60 * 1000);

      // 이미 cleanup 되었으므로 추가 write 없음
      expect((res.write as jest.Mock).mock.calls.length).toBe(writeCallsAfterClose);
    });
  });

  // ─── 이중 cleanup 방지 ───────────────────

  describe('streamStatus — 이중 cleanup 방지', () => {
    beforeEach(() => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: USER_ID }),
      });
    });

    it('cleanup 2회 호출 시 res.end는 1회만 실행', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      const closeCb = (req.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;

      closeCb();
      closeCb(); // 2회 호출

      expect(res.end).toHaveBeenCalledTimes(1);
    });
  });

  // ─── heartbeat ──────────────────────────

  describe('streamStatus — heartbeat', () => {
    beforeEach(() => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: USER_ID }),
      });
    });

    it('30초마다 heartbeat 전송', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      jest.advanceTimersByTime(30_000);
      expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');

      jest.advanceTimersByTime(30_000);
      // heartbeat가 2번 호출되었는지 확인
      const heartbeatCalls = (res.write as jest.Mock).mock.calls.filter(
        (call: unknown[]) => call[0] === ': heartbeat\n\n',
      );
      expect(heartbeatCalls.length).toBe(2);
    });

    it('writableEnded 상태에서 heartbeat 전송 안 함', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      res.writableEnded = true;
      const writeCallsBefore = (res.write as jest.Mock).mock.calls.length;

      jest.advanceTimersByTime(30_000);

      expect((res.write as jest.Mock).mock.calls.length).toBe(writeCallsBefore);
    });
  });

  // ─── streamNotifications heartbeat + 이중 cleanup ──

  describe('streamNotifications — heartbeat + 이중 cleanup', () => {
    beforeEach(() => {
      mockVerify.mockReturnValue({ sub: USER_ID });
    });

    it('30초마다 heartbeat 전송', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamNotifications(req as never, res as never);

      jest.advanceTimersByTime(30_000);
      expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');
    });

    it('이중 cleanup 방지', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamNotifications(req as never, res as never);

      const closeCb = (req.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;

      closeCb();
      closeCb();

      expect(res.end).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Redis 공유 subscriber ──────────────

  describe('Redis 공유 subscriber', () => {
    it('Redis error 이벤트 핸들러 등록', () => {
      const errorHandler = mockRedisOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'error',
      );
      expect(errorHandler).toBeDefined();

      // error 핸들러 호출 시 로깅만 수행
      const errCb = errorHandler[1] as (err: Error) => void;
      errCb(new Error('Redis connection lost'));
      expect(loggerService.error).toHaveBeenCalledWith(
        'SSE 공유 Redis subscriber 오류',
        expect.any(Error),
      );
    });

    it('message 핸들러 — 구독 안 된 채널 메시지는 무시', () => {
      const msgHandler = mockRedisOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      // 구독 안 된 채널로 메시지 보내도 오류 없이 무시
      expect(() => {
        msgHandler('unknown:channel', JSON.stringify({ data: 'test' }));
      }).not.toThrow();
    });
  });

  // ─── 채널 리스너 관리 ──────────────────

  describe('채널 리스너 관리 (addChannelListener / removeChannelListener)', () => {
    beforeEach(() => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: USER_ID }),
      });
    });

    it('같은 채널에 2번째 구독 시 Redis subscribe 재호출 안 함', async () => {
      // 첫 번째 연결
      const req1 = createMockReq('valid-token');
      const res1 = createMockRes();
      await controller.streamStatus(SUBMISSION_ID, req1 as never, res1 as never);

      const subscribeCallCount = mockSubscribe.mock.calls.length;

      // 두 번째 연결 (같은 채널)
      const req2 = createMockReq('valid-token');
      const res2 = createMockRes();
      await controller.streamStatus(SUBMISSION_ID, req2 as never, res2 as never);

      // Redis subscribe는 추가 호출 안 함 (이미 구독 중)
      expect(mockSubscribe.mock.calls.length).toBe(subscribeCallCount);
    });

    it('마지막 리스너 제거 시 Redis unsubscribe 호출', async () => {
      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      const closeCb = (req.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;
      closeCb();

      expect(mockUnsubscribe).toHaveBeenCalledWith(
        `submission:status:${SUBMISSION_ID}`,
      );
    });

    it('2개 리스너 중 1개만 제거 시 unsubscribe 호출 안 함', async () => {
      // 첫 번째 연결
      const req1 = createMockReq('valid-token');
      const res1 = createMockRes();
      await controller.streamStatus(SUBMISSION_ID, req1 as never, res1 as never);

      // 두 번째 연결
      const req2 = createMockReq('valid-token');
      const res2 = createMockRes();
      await controller.streamStatus(SUBMISSION_ID, req2 as never, res2 as never);

      // 첫 번째 연결만 종료
      const closeCb1 = (req1.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;
      closeCb1();

      // 아직 리스너가 남아있으므로 unsubscribe 안 함
      expect(mockUnsubscribe).not.toHaveBeenCalled();

      // 두 번째 연결도 종료
      const closeCb2 = (req2.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;
      closeCb2();

      // 이제 unsubscribe 호출
      expect(mockUnsubscribe).toHaveBeenCalledWith(
        `submission:status:${SUBMISSION_ID}`,
      );
    });
  });

  // ─── removeChannelListener — channel 없을 때 early return (line 339) ──────────

  describe('removeChannelListener — channel 없을 때 early return (line 339)', () => {
    beforeEach(() => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: USER_ID }),
      });
    });

    it('두 연결이 같은 채널을 공유할 때 마지막 연결 해제 후 채널 삭제, 잔여 해제 시 early return (line 339)', async () => {
      // 두 번째 USER 연결 (같은 채널)
      const req1 = createMockReq('valid-token');
      const res1 = createMockRes();
      const req2 = createMockReq('valid-token');
      const res2 = createMockRes();

      // 두 SSE 연결을 같은 채널로 등록
      await controller.streamStatus(SUBMISSION_ID, req1 as never, res1 as never);
      await controller.streamStatus(SUBMISSION_ID, req2 as never, res2 as never);

      const closeCb1 = (req1.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;
      const closeCb2 = (req2.on as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'close',
      )?.[1] as () => void;

      // 첫 번째 close: handler1 제거, channelListeners.size=1, 채널 유지
      closeCb1();

      // 두 번째 close: handler2 제거, channelListeners.size=0, 채널 삭제
      closeCb2();

      // 내부 listeners Map에서 채널이 사라진 상태를 확인
      // 컨트롤러 내부 map에 직접 접근하여 채널이 없는 상태에서 removeChannelListener 호출
      const ctrlAny = controller as any;
      const channel = `submission:status:${SUBMISSION_ID}`;
      expect(ctrlAny.listeners.has(channel)).toBe(false); // 채널 삭제 확인

      // 이미 삭제된 채널에 대해 removeChannelListener를 직접 호출 → line 339 early return
      expect(() => ctrlAny.removeChannelListener(channel, () => {})).not.toThrow();
    });
  });

  // ─── streamNotifications messageHandler catch 분기 (line 297) ──────────

  describe('streamNotifications — messageHandler 오류 처리 (line 297)', () => {
    it('res.write가 예외를 던지면 에러 로깅 후 스트림 유지', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      // res.write가 throw하도록 설정
      (res.write as jest.Mock).mockImplementation(() => {
        throw new Error('write error');
      });

      await controller.streamNotifications(req as never, res as never);

      const redisMessageHandler = mockRedisOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;
      expect(redisMessageHandler).toBeDefined();

      const channel = `notification:user:${USER_ID}`;
      // res.writableEnded가 false이므로 write 시도 → throw → catch (line 297)
      redisMessageHandler(channel, JSON.stringify({ id: 'n3', title: '오류 테스트' }));

      expect(loggerService.error).toHaveBeenCalledWith(
        '알림 SSE 메시지 전송 오류',
        expect.any(Error),
      );
    });
  });

  // ─── X-Accel-Buffering 헤더 ──────────────

  describe('X-Accel-Buffering 헤더', () => {
    it('streamStatus — X-Accel-Buffering: no 설정', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: USER_ID }),
      });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamStatus(SUBMISSION_ID, req as never, res as never);

      expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });

    it('streamNotifications — X-Accel-Buffering: no 설정', async () => {
      mockVerify.mockReturnValue({ sub: USER_ID });

      const req = createMockReq('valid-token');
      const res = createMockRes();

      await controller.streamNotifications(req as never, res as never);

      expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });
  });

  // ============================
  // onModuleDestroy
  // ============================
  describe('onModuleDestroy', () => {
    it('Redis subscriber 연결을 정상 종료한다', async () => {
      await controller.onModuleDestroy();

      expect(mockQuit).toHaveBeenCalled();
    });
  });
});
