import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyMemberGuard } from './study-member.guard';
import { Repository } from 'typeorm';
import { StudyMember } from '../../study/study.entity';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('StudyMemberGuard', () => {
  let guard: StudyMemberGuard;
  let memberRepo: Record<string, jest.Mock>;

  const USER_ID = 'user-uuid-001';
  const STUDY_ID = 'study-uuid-001';

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  function createMockContext(
    overrides: { userId?: string | null; studyId?: string | null } = {},
  ): ExecutionContext {
    const headers: Record<string, string> = {};
    const params: Record<string, string> = {};

    const userId = overrides.userId === undefined ? USER_ID : overrides.userId;
    const studyId = overrides.studyId === undefined ? STUDY_ID : overrides.studyId;

    if (userId) headers['x-user-id'] = userId;
    if (studyId) params['id'] = studyId;

    const request = { headers, params };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    memberRepo = {
      findOne: jest.fn(),
    };

    const configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    guard = new StudyMemberGuard(
      configService as unknown as ConfigService,
      memberRepo as unknown as Repository<StudyMember>,
      mockLogger as any,
    );
  });

  // ──────────────────────────────────────────────
  // 헤더/파라미터 검증
  // ──────────────────────────────────────────────
  describe('헤더/파라미터 검증', () => {
    it('x-user-id 없으면 ForbiddenException', async () => {
      const ctx = createMockContext({ userId: null });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('사용자 또는 스터디 정보가 없습니다.');
    });

    it('studyId 없으면 ForbiddenException', async () => {
      const ctx = createMockContext({ studyId: null });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('사용자 또는 스터디 정보가 없습니다.');
    });
  });

  // ──────────────────────────────────────────────
  // Redis 캐시 히트
  // ──────────────────────────────────────────────
  describe('캐시 히트', () => {
    it('캐시 값 "ADMIN" — true 반환 (멤버)', async () => {
      mockRedis.get.mockResolvedValue('ADMIN');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith(`membership:${STUDY_ID}:${USER_ID}`);
      expect(memberRepo.findOne).not.toHaveBeenCalled();
    });

    it('캐시 값 "MEMBER" — true 반환', async () => {
      mockRedis.get.mockResolvedValue('MEMBER');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(memberRepo.findOne).not.toHaveBeenCalled();
    });

    it('denied 키 존재 — ForbiddenException (비멤버 캐시)', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key === `membership:${STUDY_ID}:${USER_ID}`) return Promise.resolve(null);
        if (key === `membership:${STUDY_ID}:${USER_ID}:denied`) return Promise.resolve('1');
        return Promise.resolve(null);
      });
      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('해당 스터디의 멤버가 아닙니다.');
      expect(memberRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // DB 폴백
  // ──────────────────────────────────────────────
  describe('DB 폴백', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null); // 캐시 미스
    });

    it('DB에 멤버 존재 — true 반환 + Redis에 role 캐싱', async () => {
      memberRepo.findOne.mockResolvedValue({ id: 'member-1', study_id: STUDY_ID, user_id: USER_ID, role: 'MEMBER' });
      mockRedis.set.mockResolvedValue('OK');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(memberRepo.findOne).toHaveBeenCalledWith({
        where: { study_id: STUDY_ID, user_id: USER_ID },
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:${USER_ID}`,
        'MEMBER',
        'EX',
        300,
      );
    });

    it('DB에 멤버 없음 — ForbiddenException + denied 키 캐싱 (60초 TTL)', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:${USER_ID}:denied`,
        '1',
        'EX',
        60,
      );
    });
  });

  // ──────────────────────────────────────────────
  // Redis 장애 시 DB 폴백
  // ──────────────────────────────────────────────
  describe('Redis 장애', () => {
    it('Redis get 실패 — DB 폴백으로 진행', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis timeout'));
      memberRepo.findOne.mockResolvedValue({ id: 'member-1', study_id: STUDY_ID, user_id: USER_ID });
      mockRedis.set.mockResolvedValue('OK');
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(memberRepo.findOne).toHaveBeenCalled();
    });

    it('Redis set 실패해도 정상 동작 (캐시 저장 실패 무시)', async () => {
      mockRedis.get.mockResolvedValue(null);
      memberRepo.findOne.mockResolvedValue({ id: 'member-1', study_id: STUDY_ID, user_id: USER_ID });
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });
});
