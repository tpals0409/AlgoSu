/**
 * @file gateway-context.middleware.spec.ts — GatewayContextMiddleware 단위 테스트
 * @domain common
 * @layer middleware
 * @related GatewayContextMiddleware, StudyMemberGuard
 *
 * 검증 항목:
 * - 프로브 경로(/health, /metrics, /api-docs) → 즉시 통과
 * - X-Internal-Key 누락/불일치 → UnauthorizedException
 * - /internal/* 경로 → 내부 키만 검증, user 미설정
 * - 정상 경로 → X-Internal-Key 검증 + request.user.userId 설정
 * - X-User-ID 누락/UUID 형식 오류 → UnauthorizedException
 */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { GatewayContextMiddleware, GatewayRequest } from './gateway-context.middleware';

// --- StructuredLoggerService 모킹 ---
jest.mock('../logger/structured-logger.service', () => ({
  StructuredLoggerService: jest.fn().mockImplementation(() => ({
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('GatewayContextMiddleware', () => {
  let middleware: GatewayContextMiddleware;

  const VALID_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const VALID_INTERNAL_KEY = 'secret-internal-key';

  function createConfigService(internalKey = VALID_INTERNAL_KEY): ConfigService {
    return {
      getOrThrow: jest.fn().mockReturnValue(internalKey),
    } as unknown as ConfigService;
  }

  function createRequest(overrides: {
    path?: string;
    internalKey?: string | null;
    userId?: string | null;
  } = {}): GatewayRequest {
    const headers: Record<string, string> = {};

    const internalKey =
      overrides.internalKey === undefined
        ? VALID_INTERNAL_KEY
        : overrides.internalKey;
    if (internalKey !== null) headers['x-internal-key'] = internalKey;

    const userId =
      overrides.userId === undefined ? VALID_USER_ID : overrides.userId;
    if (userId !== null) headers['x-user-id'] = userId;

    return {
      path: overrides.path ?? '/submissions',
      headers,
    } as unknown as GatewayRequest;
  }

  const mockNext = jest.fn();
  const mockRes = {} as Response;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new GatewayContextMiddleware(createConfigService());
  });

  // ──────────────────────────────────────────────
  // 프로브 경로 — 즉시 통과
  // ──────────────────────────────────────────────
  describe('프로브 경로 즉시 통과', () => {
    it.each(['/health', '/health/ready', '/metrics', '/api-docs', '/api-docs/json'])(
      '%s → next() 호출, request.user 미설정',
      (path) => {
        const req = createRequest({ path, internalKey: null, userId: null });

        middleware.use(req, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(req.user).toBeUndefined();
      },
    );
  });

  // ──────────────────────────────────────────────
  // X-Internal-Key 검증
  // ──────────────────────────────────────────────
  describe('X-Internal-Key 검증', () => {
    it('X-Internal-Key 헤더 없으면 UnauthorizedException', () => {
      const req = createRequest({ internalKey: null });

      expect(() => middleware.use(req, mockRes, mockNext)).toThrow(
        UnauthorizedException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('X-Internal-Key 불일치면 UnauthorizedException', () => {
      const req = createRequest({ internalKey: 'wrong-key' });

      expect(() => middleware.use(req, mockRes, mockNext)).toThrow(
        UnauthorizedException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('타이밍 어택 방지: 길이 다른 키도 UnauthorizedException', () => {
      const req = createRequest({ internalKey: 'short' });

      expect(() => middleware.use(req, mockRes, mockNext)).toThrow(
        UnauthorizedException,
      );
    });
  });

  // ──────────────────────────────────────────────
  // /internal/* 경로 — 내부 키만 검증
  // ──────────────────────────────────────────────
  describe('/internal/* 경로 처리', () => {
    it('유효한 내부 키 + /internal/* → next() 호출, user 미설정', () => {
      const req = createRequest({ path: '/internal/submissions/abc', userId: null });

      middleware.use(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
    });

    it('내부 키 없는 /internal/* → UnauthorizedException', () => {
      const req = createRequest({ path: '/internal/stats/123', internalKey: null, userId: null });

      expect(() => middleware.use(req, mockRes, mockNext)).toThrow(
        UnauthorizedException,
      );
    });
  });

  // ──────────────────────────────────────────────
  // X-User-ID 검증 및 request.user 설정
  // ──────────────────────────────────────────────
  describe('사용자 컨텍스트 설정', () => {
    it('유효한 키 + UUID userId → request.user.userId 설정 + next() 호출', () => {
      const req = createRequest();

      middleware.use(req, mockRes, mockNext);

      expect(req.user).toEqual({ userId: VALID_USER_ID });
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('X-User-ID 헤더 없으면 UnauthorizedException', () => {
      const req = createRequest({ userId: null });

      expect(() => middleware.use(req, mockRes, mockNext)).toThrow(
        UnauthorizedException,
      );
      expect(mockNext).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('X-User-ID UUID 형식 오류면 UnauthorizedException', () => {
      const req = createRequest({ userId: 'not-a-valid-uuid' });

      expect(() => middleware.use(req, mockRes, mockNext)).toThrow(
        UnauthorizedException,
      );
      expect(req.user).toBeUndefined();
    });

    it('X-User-ID 단순 정수면 UnauthorizedException', () => {
      const req = createRequest({ userId: '12345' });

      expect(() => middleware.use(req, mockRes, mockNext)).toThrow(
        UnauthorizedException,
      );
    });

    it('다양한 일반 경로에서 request.user 정상 설정', () => {
      const paths = ['/submissions', '/review/comments', '/study-notes', '/drafts'];

      paths.forEach((path) => {
        const req = createRequest({ path });
        jest.clearAllMocks();

        middleware.use(req, mockRes, mockNext);

        expect(req.user).toEqual({ userId: VALID_USER_ID });
        expect(mockNext).toHaveBeenCalledTimes(1);
      });
    });
  });
});
