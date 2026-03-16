import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { ShareLinkGuard } from './share-link.guard';
import { Repository } from 'typeorm';
import { ShareLink } from '../../share/share-link.entity';
import { StructuredLoggerService } from '../logger/structured-logger.service';

describe('ShareLinkGuard', () => {
  let guard: ShareLinkGuard;
  let shareLinkRepo: Record<string, jest.Mock>;

  const VALID_TOKEN = 'a'.repeat(64);
  const STUDY_ID = 'study-uuid-001';
  const CREATED_BY = 'user-uuid-001';

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  function createMockContext(
    token?: string | undefined,
  ): { ctx: ExecutionContext; req: { params: Record<string, string>; headers: Record<string, string> } } {
    const params: Record<string, string> = {};
    if (token !== undefined) params['token'] = token;

    const headers: Record<string, string> = {};
    const req = { params, headers };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
    return { ctx, req };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    shareLinkRepo = {
      findOne: jest.fn(),
    };

    guard = new ShareLinkGuard(
      shareLinkRepo as unknown as Repository<ShareLink>,
      mockLogger as unknown as StructuredLoggerService,
    );
  });

  /* ───────── 토큰 형식 검증 ───────── */
  describe('토큰 형식 검증', () => {
    it('토큰 미존재 — NotFoundException', async () => {
      const { ctx } = createMockContext(undefined);
      // params에 token 없음
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('빈 문자열 — NotFoundException', async () => {
      const { ctx } = createMockContext('');
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('짧은 토큰 — NotFoundException', async () => {
      const { ctx } = createMockContext('abc123');
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('유효하지 않은 hex — NotFoundException', async () => {
      const { ctx } = createMockContext('z'.repeat(64));
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('대문자 hex — NotFoundException', async () => {
      const { ctx } = createMockContext('A'.repeat(64));
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('특수문자 포함 토큰 — NotFoundException', async () => {
      const tokenWithSpecialChars = 'a'.repeat(60) + '!@#$';
      const { ctx } = createMockContext(tokenWithSpecialChars);
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('64자 초과 토큰 — NotFoundException', async () => {
      const { ctx } = createMockContext('a'.repeat(128));
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });
  });

  /* ───────── DB 조회 ───────── */
  describe('DB 조회', () => {
    it('DB에 없는 토큰 — NotFoundException', async () => {
      shareLinkRepo.findOne.mockResolvedValue(null);
      const { ctx } = createMockContext(VALID_TOKEN);

      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('비활성 토큰 — NotFoundException (is_active=true 조건으로 조회되지 않음)', async () => {
      // Guard는 where: { token, is_active: true }로 조회하므로
      // 비활성 토큰은 findOne 결과가 null → NotFoundException
      shareLinkRepo.findOne.mockResolvedValue(null);
      const { ctx } = createMockContext(VALID_TOKEN);

      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
      expect(shareLinkRepo.findOne).toHaveBeenCalledWith({
        where: { token: VALID_TOKEN, is_active: true },
      });
    });

    it('만료된 토큰 — NotFoundException + 경고 로그', async () => {
      shareLinkRepo.findOne.mockResolvedValue({
        token: VALID_TOKEN,
        study_id: STUDY_ID,
        created_by: CREATED_BY,
        is_active: true,
        expires_at: new Date(Date.now() - 1000),
      });
      const { ctx } = createMockContext(VALID_TOKEN);

      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('만료된 공유 링크'),
      );
    });

    it('정보 누출 방지 — 존재하지 않는/비활성/만료 토큰 모두 동일한 404 메시지', async () => {
      // 1) 존재하지 않는 토큰
      shareLinkRepo.findOne.mockResolvedValue(null);
      const { ctx: ctx1 } = createMockContext(VALID_TOKEN);
      try { await guard.canActivate(ctx1); } catch (e: unknown) {
        expect(e).toBeInstanceOf(NotFoundException);
        expect((e as NotFoundException).message).toBe('공유 링크를 찾을 수 없습니다.');
      }

      // 2) 만료된 토큰
      shareLinkRepo.findOne.mockResolvedValue({
        token: VALID_TOKEN,
        study_id: STUDY_ID,
        created_by: CREATED_BY,
        is_active: true,
        expires_at: new Date(Date.now() - 1000),
      });
      const { ctx: ctx2 } = createMockContext(VALID_TOKEN);
      try { await guard.canActivate(ctx2); } catch (e: unknown) {
        expect(e).toBeInstanceOf(NotFoundException);
        expect((e as NotFoundException).message).toBe('공유 링크를 찾을 수 없습니다.');
      }
    });
  });

  /* ───────── 유효 토큰 ───────── */
  describe('유효 토큰', () => {
    it('만료 없는 유효 토큰 — true + 헤더 주입', async () => {
      shareLinkRepo.findOne.mockResolvedValue({
        token: VALID_TOKEN,
        study_id: STUDY_ID,
        created_by: CREATED_BY,
        is_active: true,
        expires_at: null,
      });
      const { ctx, req } = createMockContext(VALID_TOKEN);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.headers['x-share-study-id']).toBe(STUDY_ID);
      expect(req.headers['x-share-created-by']).toBe(CREATED_BY);
    });

    it('만료 전 유효 토큰 — true + 헤더 주입', async () => {
      shareLinkRepo.findOne.mockResolvedValue({
        token: VALID_TOKEN,
        study_id: STUDY_ID,
        created_by: CREATED_BY,
        is_active: true,
        expires_at: new Date(Date.now() + 86400_000),
      });
      const { ctx, req } = createMockContext(VALID_TOKEN);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.headers['x-share-study-id']).toBe(STUDY_ID);
      expect(req.headers['x-share-created-by']).toBe(CREATED_BY);
    });
  });
});
