import { createHash } from 'crypto';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { ShareLinkGuard } from './share-link.guard';
import { IdentityClientService } from '../../identity-client/identity-client.service';

describe('ShareLinkGuard', () => {
  let guard: ShareLinkGuard;
  let identityClient: Record<string, jest.Mock>;

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

    identityClient = {
      verifyShareLinkToken: jest.fn(),
    };

    guard = new ShareLinkGuard(
      identityClient as unknown as IdentityClientService,
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
      identityClient.verifyShareLinkToken.mockResolvedValue(null);
      const { ctx } = createMockContext(VALID_TOKEN);

      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('비활성 토큰 — NotFoundException (Identity API에서 null 반환)', async () => {
      // Identity API가 비활성/미존재 토큰에 대해 null 반환
      identityClient.verifyShareLinkToken.mockResolvedValue(null);
      const { ctx } = createMockContext(VALID_TOKEN);

      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
      expect(identityClient.verifyShareLinkToken).toHaveBeenCalledWith(VALID_TOKEN);
    });

    it('만료된 토큰 — NotFoundException + 경고 로그(해시화된 prefix만 노출)', async () => {
      identityClient.verifyShareLinkToken.mockResolvedValue({
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

      // S-8: 토큰 원문(또는 prefix)이 로그에 노출되면 안 된다 — sha256 12자 prefix만 허용
      const expectedHash = createHash('sha256').update(VALID_TOKEN).digest('hex').slice(0, 12);
      const loggedMessage = mockLogger.warn.mock.calls[0][0] as string;
      expect(loggedMessage).toContain(`tokenHash=${expectedHash}`);
      expect(loggedMessage).not.toContain(VALID_TOKEN.slice(0, 8));
      expect(loggedMessage).not.toContain(VALID_TOKEN);
    });

    it('정보 누출 방지 — 존재하지 않는/비활성/만료 토큰 모두 동일한 404 메시지', async () => {
      // 1) 존재하지 않는 토큰
      identityClient.verifyShareLinkToken.mockResolvedValue(null);
      const { ctx: ctx1 } = createMockContext(VALID_TOKEN);
      try { await guard.canActivate(ctx1); } catch (e: any) {
        expect(e).toBeInstanceOf(NotFoundException);
        expect(e.message).toBe('공유 링크를 찾을 수 없습니다.');
      }

      // 2) 만료된 토큰
      identityClient.verifyShareLinkToken.mockResolvedValue({
        token: VALID_TOKEN,
        study_id: STUDY_ID,
        created_by: CREATED_BY,
        is_active: true,
        expires_at: new Date(Date.now() - 1000),
      });
      const { ctx: ctx2 } = createMockContext(VALID_TOKEN);
      try { await guard.canActivate(ctx2); } catch (e: any) {
        expect(e).toBeInstanceOf(NotFoundException);
        expect(e.message).toBe('공유 링크를 찾을 수 없습니다.');
      }
    });
  });

  /* ───────── 유효 토큰 ───────── */
  describe('유효 토큰', () => {
    it('만료 없는 유효 토큰 — true + 헤더 주입', async () => {
      identityClient.verifyShareLinkToken.mockResolvedValue({
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
      identityClient.verifyShareLinkToken.mockResolvedValue({
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
