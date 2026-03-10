import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { ShareLinkGuard } from './share-link.guard';
import { Repository } from 'typeorm';
import { ShareLink } from '../../share/share-link.entity';

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
  ): { ctx: ExecutionContext; req: Record<string, any> } {
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
      mockLogger as any,
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
  });

  /* ───────── DB 조회 ───────── */
  describe('DB 조회', () => {
    it('DB에 없는 토큰 — NotFoundException', async () => {
      shareLinkRepo.findOne.mockResolvedValue(null);
      const { ctx } = createMockContext(VALID_TOKEN);

      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
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
