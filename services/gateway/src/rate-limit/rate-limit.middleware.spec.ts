import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { Request, Response } from 'express';

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;
  let storage: Record<string, jest.Mock>;
  let mockRes: Partial<Response>;
  let next: jest.Mock;

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  function createReq(overrides: Partial<Request> = {}): Request {
    return {
      path: '/api/studies',
      method: 'GET',
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      ...overrides,
    } as unknown as Request;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    storage = {
      increment: jest.fn(),
    };

    mockRes = {
      setHeader: jest.fn(),
    };

    next = jest.fn();

    middleware = new RateLimitMiddleware(
      storage as unknown as RedisThrottlerStorage,
      mockLogger as any,
    );
  });

  // ──────────────────────────────────────────────
  // /health 제외
  // ──────────────────────────────────────────────
  it('/health 요청은 rate limit 제외', async () => {
    const req = createReq({ path: '/health' });

    await middleware.use(req, mockRes as Response, next);

    expect(next).toHaveBeenCalled();
    expect(storage.increment).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // 기본 throttler
  // ──────────────────────────────────────────────
  describe('기본 throttler (600 req/min)', () => {
    it('제한 이내 — next() 호출 + 헤더 설정', async () => {
      storage.increment.mockResolvedValue({ totalHits: 10, timeToExpire: 55000 });
      const req = createReq();

      await middleware.use(req, mockRes as Response, next);

      expect(next).toHaveBeenCalled();
      expect(storage.increment).toHaveBeenCalledWith('rl:default:ip:127.0.0.1', 60000);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 600);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 590);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 55000);
    });

    it('제한 초과 — 429 HttpException', async () => {
      storage.increment.mockResolvedValue({ totalHits: 601, timeToExpire: 30000 });
      const req = createReq();

      await expect(middleware.use(req, mockRes as Response, next)).rejects.toThrow(HttpException);
      try {
        await middleware.use(req, mockRes as Response, next);
      } catch (e) {
        expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
      expect(next).not.toHaveBeenCalled();
    });

    it('인증 사용자 — userId 기반 키 사용', async () => {
      storage.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });
      const req = createReq({ headers: { 'x-user-id': 'user-123' } as any });

      await middleware.use(req, mockRes as Response, next);

      expect(storage.increment).toHaveBeenCalledWith('rl:default:user:user-123', 60000);
    });
  });

  // ──────────────────────────────────────────────
  // Submission throttler
  // ──────────────────────────────────────────────
  describe('Submission throttler (10 req/min)', () => {
    it('POST /api/submissions — 두 번째 throttler도 체크', async () => {
      storage.increment
        .mockResolvedValueOnce({ totalHits: 5, timeToExpire: 55000 })   // default
        .mockResolvedValueOnce({ totalHits: 2, timeToExpire: 50000 });  // submission

      const req = createReq({ path: '/api/submissions', method: 'POST' });

      await middleware.use(req, mockRes as Response, next);

      expect(storage.increment).toHaveBeenCalledTimes(2);
      expect(storage.increment).toHaveBeenCalledWith(expect.stringContaining('rl:submission:'), 60000);
      expect(next).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit-submission', 10);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining-submission', 8);
    });

    it('POST /api/submissions 제한 초과 — 429', async () => {
      storage.increment
        .mockResolvedValueOnce({ totalHits: 5, timeToExpire: 55000 })   // default OK
        .mockResolvedValueOnce({ totalHits: 11, timeToExpire: 45000 }); // submission 초과

      const req = createReq({ path: '/api/submissions', method: 'POST' });

      await expect(middleware.use(req, mockRes as Response, next)).rejects.toThrow(HttpException);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit-submission', 10);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining-submission', 0);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', 45);
    });

    it('GET /api/submissions — submission throttler 미적용', async () => {
      storage.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });
      const req = createReq({ path: '/api/submissions', method: 'GET' });

      await middleware.use(req, mockRes as Response, next);

      expect(storage.increment).toHaveBeenCalledTimes(1); // default만
      expect(next).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // ip fallback 분기
  // ──────────────────────────────────────────────
  describe('IP 식별자 fallback', () => {
    it('ip와 socket.remoteAddress 모두 없으면 unknown 사용', async () => {
      storage.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });
      const req = {
        path: '/api/studies',
        method: 'GET',
        headers: {},
        ip: undefined,
        socket: { remoteAddress: undefined },
      } as unknown as Request;

      await middleware.use(req, mockRes as Response, next);

      expect(storage.increment).toHaveBeenCalledWith('rl:default:ip:unknown', 60000);
      expect(next).toHaveBeenCalled();
    });

    it('socket.remoteAddress 있고 ip 없는 경우 socket 주소 사용', async () => {
      storage.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });
      const req = {
        path: '/api/studies',
        method: 'GET',
        headers: {},
        ip: undefined,
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      await middleware.use(req, mockRes as Response, next);

      expect(storage.increment).toHaveBeenCalledWith('rl:default:ip:10.0.0.1', 60000);
    });
  });
});
