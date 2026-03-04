import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthController } from './oauth.controller';
import * as jwt from 'jsonwebtoken';

describe('OAuthController', () => {
  let controller: OAuthController;
  let mockOAuthService: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;

  const JWT_SECRET = 'test-jwt-secret';
  const FRONTEND_URL = 'http://localhost:3001';
  const USER_ID = 'user-uuid-1234';

  const mockUser = {
    id: USER_ID,
    email: 'test@test.com',
    name: 'Test User',
    avatar_url: null,
    oauth_provider: 'google',
    github_connected: false,
    github_username: null,
    created_at: new Date('2025-01-01'),
  };

  const createMockReq = (overrides: Record<string, unknown> = {}) => ({
    headers: { 'x-user-id': USER_ID },
    cookies: {},
    ...overrides,
  });

  const createMockRes = () => ({
    redirect: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockOAuthService = {
      getAuthorizationUrl: jest.fn().mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/auth' }),
      handleCallback: jest.fn().mockResolvedValue({
        accessToken: 'jwt-token',
        user: { id: USER_ID, github_connected: false },
      }),
      getGitHubAuthUrl: jest.fn().mockResolvedValue({ url: 'https://github.com/login/oauth/authorize' }),
      validateAndConsumeGitHubLinkState: jest.fn().mockResolvedValue(USER_ID),
      linkGitHub: jest.fn().mockResolvedValue({ github_username: 'testuser' }),
      disconnectGitHub: jest.fn().mockResolvedValue(undefined),
      findUserById: jest.fn().mockResolvedValue(mockUser),
      findUserByIdOrThrow: jest.fn().mockResolvedValue(mockUser),
      updateAvatar: jest.fn().mockResolvedValue(undefined),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      softDeleteAccount: jest.fn().mockResolvedValue(undefined),
      issueAccessToken: jest.fn().mockReturnValue('new-jwt-token'),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          FRONTEND_URL: FRONTEND_URL,
          NODE_ENV: 'development',
        };
        return map[key] ?? defaultVal;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return JWT_SECRET;
        throw new Error(`Missing ${key}`);
      }),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    controller = new OAuthController(
      mockOAuthService as any,
      mockConfigService as unknown as ConfigService,
      mockLogger as any,
    );
  });

  // ============================
  // 1. OAuth 인증 시작
  // ============================
  describe('startOAuth', () => {
    it('프로바이더 인증 URL 반환', async () => {
      const result = await controller.startOAuth('google');

      expect(mockOAuthService.getAuthorizationUrl).toHaveBeenCalledWith('google');
      expect(result).toEqual({ url: 'https://accounts.google.com/o/oauth2/auth' });
    });
  });

  // ============================
  // 2. OAuth 콜백 처리
  // ============================
  describe('handleOAuthCallback', () => {
    it('정상 콜백 -- JWT 쿠키 + 프론트엔드 리다이렉트', async () => {
      const res = createMockRes();
      await controller.handleOAuthCallback('google', 'auth-code', 'state-123', undefined as any, res as any);

      expect(mockOAuthService.handleCallback).toHaveBeenCalledWith('google', 'auth-code', 'state-123');
      expect(res.cookie).toHaveBeenCalledWith('token', 'jwt-token', expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining(`${FRONTEND_URL}/callback#github_connected=false`),
      );
    });

    it('OAuth 제공자 에러 -- 에러 리다이렉트', async () => {
      const res = createMockRes();
      await controller.handleOAuthCallback('google', 'code', 'state', 'access_denied', res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=access_denied'),
      );
    });

    it('code/state 누락 -- missing_params 리다이렉트', async () => {
      const res = createMockRes();
      await controller.handleOAuthCallback('google', undefined as any, undefined as any, undefined as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=missing_params'),
      );
    });

    it('handleCallback 실패 (BadRequest) -- 사용자 메시지 전달', async () => {
      mockOAuthService.handleCallback.mockRejectedValue(
        new BadRequestException('이미 연동된 계정입니다.'),
      );
      const res = createMockRes();
      await controller.handleOAuthCallback('google', 'code', 'state', undefined as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('이미 연동된 계정입니다.')),
      );
    });

    it('handleCallback 실패 (일반 에러) -- auth_failed 리다이렉트', async () => {
      mockOAuthService.handleCallback.mockRejectedValue(new Error('DB error'));
      const res = createMockRes();
      await controller.handleOAuthCallback('google', 'code', 'state', undefined as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=auth_failed'),
      );
    });
  });

  // ============================
  // 3. GitHub 연동
  // ============================
  describe('linkGitHub', () => {
    it('GitHub OAuth URL 반환', async () => {
      const req = createMockReq();
      const result = await controller.linkGitHub(req as any);

      expect(mockOAuthService.getGitHubAuthUrl).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ url: expect.stringContaining('github.com') });
    });
  });

  describe('handleGitHubLinkCallback', () => {
    it('정상 콜백 -- github-link/complete 리다이렉트', async () => {
      const res = createMockRes();
      await controller.handleGitHubLinkCallback('code', 'state', undefined as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('github-link/complete#github_connected=true'),
      );
    });

    it('oauthError 있으면 에러 리다이렉트', async () => {
      const res = createMockRes();
      await controller.handleGitHubLinkCallback('code', 'state', 'access_denied', res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=access_denied'),
      );
    });

    it('code/state 누락 -- missing_params', async () => {
      const res = createMockRes();
      await controller.handleGitHubLinkCallback(undefined as any, undefined as any, undefined as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=missing_params'),
      );
    });

    it('연동 실패 -- link_failed', async () => {
      mockOAuthService.linkGitHub.mockRejectedValue(new Error('fail'));
      const res = createMockRes();
      await controller.handleGitHubLinkCallback('code', 'state', undefined as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=link_failed'),
      );
    });
  });

  describe('unlinkGitHub', () => {
    it('GitHub 연동 해제', async () => {
      const req = createMockReq();
      const result = await controller.unlinkGitHub(req as any);

      expect(mockOAuthService.disconnectGitHub).toHaveBeenCalledWith(USER_ID);
      expect(result.message).toContain('해제');
    });
  });

  describe('relinkGitHub', () => {
    it('GitHub 재연동 URL 반환', async () => {
      const req = createMockReq();
      const result = await controller.relinkGitHub(req as any);

      expect(mockOAuthService.getGitHubAuthUrl).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ url: expect.any(String) });
    });
  });

  // ============================
  // 4. 프로필
  // ============================
  describe('getProfile', () => {
    it('프로필 반환', async () => {
      const req = createMockReq();
      const result = await controller.getProfile(req as any);

      expect(result.email).toBe('test@test.com');
      expect(result.github_connected).toBe(false);
    });

    it('사용자 없음 -- NotFoundException', async () => {
      mockOAuthService.findUserById.mockResolvedValue(null);
      const req = createMockReq();

      await expect(controller.getProfile(req as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('아바타 수정', async () => {
      const req = createMockReq();
      const result = await controller.updateProfile(req as any, 'preset:cat');

      expect(mockOAuthService.updateAvatar).toHaveBeenCalledWith(USER_ID, 'preset:cat');
      expect(result.avatar_url).toBe('preset:cat');
    });

    it('avatar_url 누락 -- BadRequestException', async () => {
      const req = createMockReq();
      await expect(controller.updateProfile(req as any, undefined)).rejects.toThrow(BadRequestException);
    });

    it('유효하지 않은 아바타 형식 -- BadRequestException', async () => {
      const req = createMockReq();
      await expect(controller.updateProfile(req as any, 'http://evil.com/xss')).rejects.toThrow(BadRequestException);
    });

    it('아바타 URL 50자 초과 -- BadRequestException', async () => {
      const req = createMockReq();
      const longAvatar = 'preset:' + 'a'.repeat(50);
      await expect(controller.updateProfile(req as any, longAvatar)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  // 5. JWT 갱신
  // ============================
  describe('refreshToken', () => {
    it('유효한 토큰으로 갱신 성공', async () => {
      const token = jwt.sign({ sub: USER_ID }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
      const req = createMockReq({ cookies: { token } });
      const res = createMockRes();

      const result = await controller.refreshToken(req as any, res as any);

      expect(mockOAuthService.findUserByIdOrThrow).toHaveBeenCalledWith(USER_ID);
      expect(res.cookie).toHaveBeenCalled();
      expect(result.message).toBe('Token refreshed');
    });

    it('쿠키 없음 -- BadRequestException', async () => {
      const req = createMockReq({ cookies: {} });
      const res = createMockRes();

      await expect(controller.refreshToken(req as any, res as any)).rejects.toThrow('인증 쿠키가 없습니다.');
    });

    it('유효하지 않은 토큰 -- BadRequestException', async () => {
      const req = createMockReq({ cookies: { token: 'invalid' } });
      const res = createMockRes();

      await expect(controller.refreshToken(req as any, res as any)).rejects.toThrow(BadRequestException);
    });

    it('토큰에 sub 없으면 BadRequestException', async () => {
      // sub 없이 서명된 토큰 (userId 대신 다른 필드만 있음)
      const token = jwt.sign({ someField: 'value' }, JWT_SECRET, { algorithm: 'HS256' });
      const req = createMockReq({ cookies: { token } });
      const res = createMockRes();

      await expect(controller.refreshToken(req as any, res as any)).rejects.toThrow('토큰에 사용자 ID가 없습니다.');
    });
  });

  // ============================
  // 6. 로그아웃
  // ============================
  describe('logout', () => {
    it('정상 로그아웃 -- 쿠키 삭제 + refresh token 무효화', async () => {
      const token = jwt.sign({ sub: USER_ID }, JWT_SECRET);
      const req = createMockReq({ cookies: { token } });
      const res = createMockRes();

      const result = await controller.logout(req as any, res as any);

      expect(mockOAuthService.revokeRefreshToken).toHaveBeenCalledWith(USER_ID);
      expect(res.clearCookie).toHaveBeenCalledWith('token', expect.objectContaining({ httpOnly: true }));
      expect(result.message).toContain('로그아웃');
    });

    it('토큰 없이 로그아웃 -- 쿠키 삭제만', async () => {
      const req = createMockReq({ cookies: {} });
      const res = createMockRes();

      const result = await controller.logout(req as any, res as any);

      expect(mockOAuthService.revokeRefreshToken).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalled();
      expect(result.message).toContain('로그아웃');
    });

    it('토큰 디코딩 실패 시에도 로그아웃 성공 (쿠키 삭제)', async () => {
      // jwt.decode를 throw하도록 만들기 위해 revokeRefreshToken에서 예외 발생
      // 실제로는 jwt.decode가 예외를 거의 안 throw하지만, try/catch 분기를 커버하기 위해
      // 토큰이 있고 decoded?.['sub']가 falsy(undefined)인 케이스로도 가능
      // decoded가 null이거나 userId가 없으면 revokeRefreshToken 호출 안 함
      const token = jwt.sign({ someField: 'noid' }, JWT_SECRET); // sub 없음
      const req = createMockReq({ cookies: { token } });
      const res = createMockRes();

      const result = await controller.logout(req as any, res as any);

      // sub도 userId도 없으므로 revokeRefreshToken 호출 안 됨
      expect(mockOAuthService.revokeRefreshToken).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalled();
      expect(result.message).toContain('로그아웃');
    });
  });

  // ============================
  // 7. 회원탈퇴
  // ============================
  describe('deleteAccount', () => {
    it('계정 소프트 딜리트 + 쿠키 삭제', async () => {
      const req = createMockReq();
      const res = createMockRes();

      const result = await controller.deleteAccount(req as any, res as any);

      expect(mockOAuthService.softDeleteAccount).toHaveBeenCalledWith(USER_ID);
      expect(mockOAuthService.revokeRefreshToken).toHaveBeenCalledWith(USER_ID);
      expect(res.clearCookie).toHaveBeenCalled();
      expect(result.message).toContain('삭제');
    });
  });
});
