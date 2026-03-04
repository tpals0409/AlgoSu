import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyMemberGuard } from './study-member.guard';

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

  const USER_ID = 'user-uuid-001';
  const STUDY_ID = 'study-uuid-001';
  const GATEWAY_URL = 'http://gateway:3000';
  const INTERNAL_KEY = 'test-internal-key';

  function createMockContext(
    overrides: { userId?: string | null; studyId?: string | null } = {},
  ): ExecutionContext {
    const headers: Record<string, string> = {};

    const userId = overrides.userId === undefined ? USER_ID : overrides.userId;
    const studyId = overrides.studyId === undefined ? STUDY_ID : overrides.studyId;

    if (userId) headers['x-user-id'] = userId;
    if (studyId) headers['x-study-id'] = studyId;

    const request = { headers, path: '/test' };
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
  // 헤더 검증
  // ──────────────────────────────────────────────
  describe('헤더 검증', () => {
    it('X-User-ID 헤더 없으면 ForbiddenException', async () => {
      const ctx = createMockContext({ userId: null });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        'X-User-ID 헤더가 필요합니다.',
      );
    });

    it('X-Study-ID 헤더 없으면 ForbiddenException', async () => {
      const ctx = createMockContext({ studyId: null });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        'X-Study-ID 헤더가 필요합니다.',
      );
    });
  });

  // ──────────────────────────────────────────────
  // Redis 캐시 히트
  // ──────────────────────────────────────────────
  describe('캐시 히트', () => {
    it('Redis 캐시에 role 있으면 true 반환', async () => {
      mockRedis.get.mockResolvedValue('MEMBER');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `study:membership:${STUDY_ID}:${USER_ID}`,
      );
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
        `study:membership:${STUDY_ID}:${USER_ID}`,
        'MEMBER',
        'EX',
        600,
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
