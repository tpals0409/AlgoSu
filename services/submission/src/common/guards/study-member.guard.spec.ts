/**
 * @file study-member.guard.spec.ts — StudyMemberGuard 단위 테스트
 * @domain common
 * @layer guard
 * @related StudyMemberGuard, GatewayContextMiddleware
 *
 * [P0 수정 반영] userId는 request.user.userId에서 읽음 (request.headers['x-user-id'] 직접 신뢰 제거)
 * GatewayContextMiddleware가 X-Internal-Key 검증 후 request.user를 설정하는 전제 하에 동작
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyMemberGuard } from './study-member.guard';
import { GatewayRequest } from '../middleware/gateway-context.middleware';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(() => mockRedis);
  return { __esModule: true, default: MockRedis };
});

// --- StructuredLoggerService 모킹 ---
jest.mock('../logger/structured-logger.service', () => ({
  StructuredLoggerService: jest.fn().mockImplementation(() => ({
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// --- global.fetch 모킹 ---
const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch;

describe('StudyMemberGuard', () => {
  let guard: StudyMemberGuard;

  const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const STUDY_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const GATEWAY_URL = 'http://gateway:3000';
  const INTERNAL_KEY = 'test-internal-key';

  /**
   * 모의 ExecutionContext 생성
   *
   * [P0 수정] userId는 request.user.userId에서 설정 (GatewayContextMiddleware 역할 시뮬레이션)
   * headers['x-user-id']는 더 이상 가드에서 직접 신뢰하지 않음
   */
  function createMockContext(
    overrides: {
      user?: { userId: string } | null;
      studyId?: string | null;
    } = {},
  ): ExecutionContext {
    const headers: Record<string, string> = {};

    const studyId = overrides.studyId === undefined ? STUDY_ID : overrides.studyId;
    if (studyId) headers['x-study-id'] = studyId;

    // request.user: GatewayContextMiddleware가 설정한 신뢰 컨텍스트
    const user =
      overrides.user === undefined ? { userId: USER_ID } : overrides.user;

    const request: Partial<GatewayRequest> = {
      headers,
      path: '/test',
      user: user ?? undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    const configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'GATEWAY_INTERNAL_URL') return GATEWAY_URL;
        if (key === 'INTERNAL_KEY_GATEWAY') return INTERNAL_KEY;
        throw new Error(`Unknown key: ${key}`);
      }),
    } as unknown as ConfigService;

    guard = new StudyMemberGuard(configService);
  });

  // ──────────────────────────────────────────────
  // 사용자 컨텍스트 검증 (P0 수정: request.user 기반)
  // ──────────────────────────────────────────────
  describe('사용자 컨텍스트 검증 (request.user)', () => {
    it('request.user 없으면 ForbiddenException — GatewayContextMiddleware 미실행 시나리오', async () => {
      const ctx = createMockContext({ user: null });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        '사용자 인증 컨텍스트가 없습니다.',
      );
    });

    it('X-User-ID 헤더만 있고 request.user 없으면 ForbiddenException (헤더 직접 신뢰 금지)', async () => {
      // 게이트웨이를 우회한 직접 요청 시뮬레이션: 헤더는 있지만 미들웨어 미실행
      const headers: Record<string, string> = {
        'x-user-id': USER_ID,
        'x-study-id': STUDY_ID,
      };
      const request: Partial<GatewayRequest> = {
        headers,
        path: '/test',
        user: undefined, // request.user 미설정
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        '사용자 인증 컨텍스트가 없습니다.',
      );
    });
  });

  // ──────────────────────────────────────────────
  // X-Study-ID 헤더 검증
  // ──────────────────────────────────────────────
  describe('X-Study-ID 헤더 검증', () => {
    it('X-Study-ID 헤더 없으면 ForbiddenException', async () => {
      const ctx = createMockContext({ studyId: null });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        'X-Study-ID 헤더가 필요합니다.',
      );
    });

    it('X-Study-ID UUID 형식 오류면 ForbiddenException', async () => {
      const ctx = createMockContext({ studyId: 'not-a-uuid' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        'X-Study-ID 형식이 올바르지 않습니다 (UUID 필수).',
      );
    });
  });

  // ──────────────────────────────────────────────
  // Redis 캐시 히트
  // ──────────────────────────────────────────────
  describe('캐시 히트', () => {
    it('Redis 캐시에 MEMBER role 있으면 true 반환', async () => {
      mockRedis.get.mockResolvedValue('MEMBER');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:${USER_ID}`,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('Redis 캐시에 ADMIN role 있으면 true 반환', async () => {
      mockRedis.get.mockResolvedValue('ADMIN');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('Redis 캐시에 유효하지 않은 role이면 ForbiddenException', async () => {
      mockRedis.get.mockResolvedValue('VIEWER');
      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('스터디 멤버가 아닙니다.');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // 캐시 miss → Gateway 호출
  // ──────────────────────────────────────────────
  describe('캐시 miss → Gateway 호출', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
    });

    it('Gateway 200 → true 반환 + Redis 캐시 저장', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ role: 'MEMBER' }),
      });
      mockRedis.set.mockResolvedValue('OK');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${GATEWAY_URL}/internal/studies/${STUDY_ID}/members/${USER_ID}`,
        {
          method: 'GET',
          headers: {
            'x-internal-key': INTERNAL_KEY,
            'Content-Type': 'application/json',
          },
        },
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:${USER_ID}`,
        'MEMBER',
        'EX',
        300,
      );
    });

    it('Gateway 404 → ForbiddenException', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });
      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        '스터디 멤버가 아닙니다.',
      );
    });

    it('Gateway 500 에러 → ForbiddenException', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });
      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        '스터디 멤버가 아닙니다.',
      );
    });

    it('fetch 네트워크 에러 → ForbiddenException', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        '스터디 멤버가 아닙니다.',
      );
    });
  });

  // ──────────────────────────────────────────────
  // Redis 장애 시 Gateway fallback
  // ──────────────────────────────────────────────
  describe('Redis 장애', () => {
    it('Redis get 실패 → Gateway fallback으로 정상 동작', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis timeout'));
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ role: 'OWNER' }),
      });
      mockRedis.set.mockResolvedValue('OK');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('Redis set 실패해도 정상 동작 (캐시 저장 실패 무시)', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ role: 'MEMBER' }),
      });
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });
});
