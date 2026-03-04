import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyMemberGuard } from './study-member.guard';
import { REDIS_CLIENT } from '../../cache/cache.module';

describe('StudyMemberGuard', () => {
  let guard: StudyMemberGuard;
  let redis: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  const USER_ID = 'user-uuid-001';
  const STUDY_ID = 'study-uuid-001';

  function createMockContext(headers: Record<string, string | undefined> = {}): ExecutionContext {
    const finalHeaders: Record<string, string> = {};
    const userId = 'x-user-id' in headers ? headers['x-user-id'] : USER_ID;
    const studyId = 'x-study-id' in headers ? headers['x-study-id'] : STUDY_ID;
    if (userId) finalHeaders['x-user-id'] = userId;
    if (studyId) finalHeaders['x-study-id'] = studyId;

    const request: Record<string, unknown> = {
      headers: finalHeaders,
      path: '/problems',
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          GATEWAY_INTERNAL_URL: 'http://gateway:3000',
          INTERNAL_KEY_GATEWAY: 'test-key',
        };
        return map[key] ?? defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyMemberGuard,
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    guard = module.get<StudyMemberGuard>(StudyMemberGuard);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────
  // 헤더 검증
  // ──────────────────────────────────────────────
  describe('헤더 검증', () => {
    it('X-User-ID 없으면 ForbiddenException', async () => {
      const ctx = createMockContext({ 'x-user-id': undefined });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('X-User-ID 헤더가 필요합니다.');
    });

    it('X-Study-ID 없으면 ForbiddenException', async () => {
      const ctx = createMockContext({ 'x-study-id': undefined });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('X-Study-ID 헤더가 필요합니다.');
    });
  });

  // ──────────────────────────────────────────────
  // Redis 캐시 히트
  // ──────────────────────────────────────────────
  describe('캐시 히트', () => {
    it('ADMIN 역할 캐시: true 반환 + studyRole 설정', async () => {
      redis.get.mockResolvedValue('ADMIN');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(redis.get).toHaveBeenCalledWith(`study:membership:${STUDY_ID}:${USER_ID}`);
      const req = ctx.switchToHttp().getRequest() as Record<string, unknown>;
      expect(req.studyRole).toBe('ADMIN');
    });

    it('MEMBER 역할 캐시: true 반환', async () => {
      redis.get.mockResolvedValue('MEMBER');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('알 수 없는 역할 캐시: ForbiddenException', async () => {
      redis.get.mockResolvedValue('VIEWER');
      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────
  // Gateway API 폴백
  // ──────────────────────────────────────────────
  describe('Gateway API 폴백', () => {
    beforeEach(() => {
      redis.get.mockResolvedValue(null); // 캐시 미스
    });

    it('Gateway 응답 OK + MEMBER: true 반환 + Redis 캐싱', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ role: 'MEMBER' }),
      } as Response);

      redis.set.mockResolvedValue('OK');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `http://gateway:3000/internal/studies/${STUDY_ID}/members/${USER_ID}`,
        { headers: { 'x-internal-key': 'test-key' } },
      );
      expect(redis.set).toHaveBeenCalledWith(
        `study:membership:${STUDY_ID}:${USER_ID}`,
        'MEMBER',
        'EX',
        600,
      );

      mockFetch.mockRestore();
    });

    it('Gateway 응답 실패 (비멤버): ForbiddenException', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('스터디 멤버가 아닙니다.');

      mockFetch.mockRestore();
    });

    it('Gateway 네트워크 오류: ForbiddenException (fail-close)', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);

      mockFetch.mockRestore();
    });

    it('Redis set 실패해도 정상 동작 (캐시 저장 실패 무시)', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ role: 'ADMIN' }),
      } as Response);

      redis.set.mockRejectedValue(new Error('Redis down'));
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);

      mockFetch.mockRestore();
    });
  });

  // ──────────────────────────────────────────────
  // Redis 조회 실패
  // ──────────────────────────────────────────────
  describe('Redis 조회 실패', () => {
    it('Redis get 실패 시 Gateway 폴백으로 진행', async () => {
      redis.get.mockRejectedValue(new Error('Redis timeout'));

      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ role: 'MEMBER' }),
      } as Response);

      redis.set.mockResolvedValue('OK');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);

      mockFetch.mockRestore();
    });
  });
});
