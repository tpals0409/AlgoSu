import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { OAuthService } from './oauth.service';
import { OAuthProvider, IdentityUser } from '../../common/types/identity.types';
import { IdentityClientService } from '../../identity-client/identity-client.service';
import { SessionPolicyService } from '../session-policy/session-policy.service';
import {
  OAuthInvalidStateException,
  OAuthTokenExchangeException,
  OAuthProfileFetchException,
  OAuthAccountConflictException,
  OAuthAuthFailedException,
  OAuthCallbackException,
} from './exceptions';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  on: jest.fn().mockReturnThis(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// --- axios 모듈 모킹 ---
jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockAxios = require('axios').default;

// --- crypto.randomUUID 모킹 ---
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('mock-uuid-state-1234'),
}));

describe('OAuthService', () => {
  let service: OAuthService;
  let configService: Record<string, jest.Mock>;
  let identityClient: Record<string, jest.Mock>;
  let sessionPolicy: Record<string, jest.Mock>;

  const JWT_SECRET = 'test-jwt-secret-hs256';
  const CALLBACK_URL = 'https://algosu.test';

  const configMap: Record<string, string> = {
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: JWT_SECRET,
    JWT_EXPIRES_IN: '1h',
    OAUTH_CALLBACK_URL: CALLBACK_URL,
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    NAVER_CLIENT_ID: 'naver-client-id',
    NAVER_CLIENT_SECRET: 'naver-client-secret',
    KAKAO_CLIENT_ID: 'kakao-client-id',
    KAKAO_CLIENT_SECRET: 'kakao-client-secret',
    GITHUB_CLIENT_ID: 'github-client-id',
    GITHUB_CLIENT_SECRET: 'github-client-secret',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string, defaultVal?: string) => configMap[key] ?? defaultVal),
      getOrThrow: jest.fn((key: string) => {
        const val = configMap[key];
        if (!val) throw new Error(`Missing config: ${key}`);
        return val;
      }),
    };

    identityClient = {
      upsertUser: jest.fn(),
      findUserById: jest.fn(),
      updateUser: jest.fn().mockResolvedValue({}),
      softDeleteUser: jest.fn().mockResolvedValue({}),
      updateGitHub: jest.fn().mockResolvedValue({}),
      getGitHubStatus: jest.fn(),
      getGitHubTokenInfo: jest.fn(),
    };

    // Sprint 71-1R: SessionPolicyService SSoT 주입
    sessionPolicy = {
      getAccessTokenTtl: jest.fn().mockReturnValue('1h'),
      getAccessTokenTtlMs: jest.fn().mockReturnValue(60 * 60 * 1000),
      getDemoTokenTtl: jest.fn().mockReturnValue('2h'),
      getDemoTokenTtlMs: jest.fn().mockReturnValue(2 * 60 * 60 * 1000),
    };

    service = new OAuthService(
      configService as unknown as ConfigService,
      identityClient as unknown as IdentityClientService,
      sessionPolicy as unknown as SessionPolicyService,
    );
  });

  // ============================
  // 1. generateState
  // ============================
  describe('generateState', () => {
    it('Redis SET + TTL 300초 + UUID 반환', async () => {
      const state = await service.generateState();

      expect(state).toBe('mock-uuid-state-1234');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'oauth:state:mock-uuid-state-1234',
        '1',
        'EX',
        300,
      );
    });
  });

  // ============================
  // 2-3. validateAndConsumeState
  // ============================
  describe('validateAndConsumeState', () => {
    it('유효한 state → 정상 소비 (del 반환값 1)', async () => {
      mockRedis.del.mockResolvedValue(1);

      await expect(service.validateAndConsumeState('valid-state')).resolves.toBeUndefined();
      expect(mockRedis.del).toHaveBeenCalledWith('oauth:state:valid-state');
    });

    it('무효한 state → OAuthInvalidStateException (del 반환값 0)', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(service.validateAndConsumeState('invalid-state')).rejects.toThrow(
        OAuthInvalidStateException,
      );
      await expect(service.validateAndConsumeState('invalid-state')).rejects.toBeInstanceOf(
        OAuthCallbackException,
      );
    });
  });

  // ============================
  // 4-7. getAuthorizationUrl
  // ============================
  describe('getAuthorizationUrl', () => {
    it('google → Google OAuth URL 반환', async () => {
      const result = await service.getAuthorizationUrl('google');

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('client_id=google-client-id');
      expect(result.url).toContain('state=mock-uuid-state-1234');
      expect(result.url).toContain('scope=openid+email+profile');
    });

    it('naver → Naver OAuth URL 반환', async () => {
      const result = await service.getAuthorizationUrl('naver');

      expect(result.url).toContain('https://nid.naver.com/oauth2.0/authorize');
      expect(result.url).toContain('client_id=naver-client-id');
      expect(result.url).toContain('state=mock-uuid-state-1234');
    });

    it('kakao → Kakao OAuth URL 반환', async () => {
      const result = await service.getAuthorizationUrl('kakao');

      expect(result.url).toContain('https://kauth.kakao.com/oauth/authorize');
      expect(result.url).toContain('client_id=kakao-client-id');
      expect(result.url).toContain('state=mock-uuid-state-1234');
    });

    it('미지원 provider → BadRequestException', async () => {
      await expect(service.getAuthorizationUrl('invalid-provider')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getAuthorizationUrl('invalid-provider')).rejects.toThrow(
        '지원하지 않는 OAuth Provider: invalid-provider',
      );
    });
  });

  // ============================
  // 8-10. handleCallback
  // ============================
  describe('handleCallback', () => {
    const mockGoogleProfile = {
      email: 'user@google.com',
      name: 'Google User',
      picture: 'https://avatar.google.com/photo.jpg',
    };

    beforeEach(() => {
      // validateAndConsumeState 통과
      mockRedis.del.mockResolvedValue(1);
      // storeRefreshToken
      mockRedis.set.mockResolvedValue('OK');
    });

    it('신규 사용자 — Google callback 처리 + JWT 발급', async () => {
      // Google token exchange
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-access-token' },
      });
      // Google user info
      mockAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

      const createdUser: IdentityUser = {
        id: 'new-user-id',
        email: mockGoogleProfile.email,
        name: mockGoogleProfile.name,
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
        github_user_id: null,
        github_username: null,
        github_token: null,
        publicId: 'pub-uuid-1',
        profile_slug: null,
        is_profile_public: false,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      identityClient.upsertUser.mockResolvedValue(createdUser);

      const result = await service.handleCallback('google', 'auth-code', 'valid-state');

      expect(result.user.email).toBe('user@google.com');
      expect(result.accessToken).toBeDefined();

      // JWT 검증 (HS256)
      const decoded = jwt.verify(result.accessToken, JWT_SECRET, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
      expect(decoded.sub).toBe('new-user-id');
    });

    it('기존 사용자 — upsert 후 Identity 결과 반환 + JWT 발급', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-access-token' },
      });
      mockAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

      const updatedUser: IdentityUser = {
        id: 'existing-user-id',
        email: mockGoogleProfile.email,
        name: mockGoogleProfile.name,
        avatar_url: 'preset:cat', // avatar_url은 Identity 서비스에서 보호
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
        github_user_id: null,
        github_username: null,
        github_token: null,
        publicId: 'pub-uuid-1',
        profile_slug: null,
        is_profile_public: false,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      identityClient.upsertUser.mockResolvedValue(updatedUser);

      const result = await service.handleCallback('google', 'auth-code', 'valid-state');

      expect(result.user.name).toBe(mockGoogleProfile.name);
      // avatar_url은 Identity 서비스 upsert에서 보호 → 기존값 유지
      expect(result.user.avatar_url).toBe('preset:cat');
    });

    it('미지원 provider → OAuthAuthFailedException', async () => {
      await expect(
        service.handleCallback('twitter', 'auth-code', 'valid-state'),
      ).rejects.toThrow(OAuthAuthFailedException);
    });
  });

  // ============================
  // 11-13. linkGitHub + connectGitHub
  // ============================
  describe('linkGitHub', () => {
    it('정상 연동 — connectGitHub 호출 + github_username 반환', async () => {
      // GITHUB_TOKEN_ENCRYPTION_KEY 포함한 설정으로 서비스 재생성
      const configMapWithKey = {
        ...configMap,
        GITHUB_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
      };
      const linkSvc = new OAuthService(
        {
          get: jest.fn((key: string, defaultVal?: string) => (configMapWithKey as Record<string, string>)[key] ?? defaultVal),
          getOrThrow: jest.fn((key: string) => {
            const val = (configMapWithKey as Record<string, string>)[key];
            if (!val) throw new Error(`Missing config: ${key}`);
            return val;
          }),
        } as unknown as ConfigService,
        identityClient as unknown as IdentityClientService,
        sessionPolicy as unknown as SessionPolicyService,
      );

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'github-access-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { id: '12345', login: 'octocat' },
      });

      const result = await linkSvc.linkGitHub('user-id-1', 'github-code');

      expect(result.github_username).toBe('octocat');
      expect(identityClient.updateGitHub).toHaveBeenCalledWith(
        'user-id-1',
        expect.objectContaining({
          connected: true,
          user_id: '12345',
          username: 'octocat',
        }),
      );
    });

    it('GitHub 토큰 교환 실패 → BadRequestException', async () => {
      mockAxios.post.mockResolvedValue({
        data: {}, // access_token 없음
      });

      await expect(service.linkGitHub('user-id-1', 'bad-code')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.linkGitHub('user-id-1', 'bad-code')).rejects.toThrow(
        'GitHub 토큰 교환에 실패했습니다.',
      );
    });
  });

  // ============================
  // connectGitHub / disconnectGitHub
  // ============================
  describe('connectGitHub', () => {
    it('identityClient.updateGitHub 호출', async () => {
      await service.connectGitHub('user-id-1', '12345', 'octocat', 'encrypted-token');

      expect(identityClient.updateGitHub).toHaveBeenCalledWith(
        'user-id-1',
        {
          connected: true,
          user_id: '12345',
          username: 'octocat',
          token: 'encrypted-token',
        },
      );
    });
  });

  // ============================
  // 14. disconnectGitHub
  // ============================
  describe('disconnectGitHub', () => {
    it('정상 연동 해제 — identityClient.updateGitHub 호출', async () => {
      await service.disconnectGitHub('user-id-1');

      expect(identityClient.updateGitHub).toHaveBeenCalledWith(
        'user-id-1',
        {
          connected: false,
          user_id: null,
          username: null,
          token: null,
        },
      );
    });
  });

  // ============================
  // softDeleteAccount
  // ============================
  describe('softDeleteAccount', () => {
    it('정상 탈퇴 — Identity 서비스에 위임', async () => {
      identityClient.softDeleteUser.mockResolvedValue({});

      await service.softDeleteAccount('user-to-delete');

      expect(identityClient.softDeleteUser).toHaveBeenCalledWith('user-to-delete');
    });

    it('멱등성 — Identity 서비스에서 처리', async () => {
      identityClient.softDeleteUser.mockResolvedValue({});

      await expect(service.softDeleteAccount('deleted-user')).resolves.toBeUndefined();
      expect(identityClient.softDeleteUser).toHaveBeenCalledWith('deleted-user');
    });

    it('Identity 서비스 에러 시 전파', async () => {
      identityClient.softDeleteUser.mockRejectedValue(new Error('Identity error'));

      await expect(service.softDeleteAccount('user-to-delete')).rejects.toThrow('Identity error');
    });
  });

  // ============================
  // 18. issueJwt (private — handleCallback 간접 검증)
  // ============================
  describe('issueJwt (간접 검증)', () => {
    it('HS256 알고리즘 + sub claim 포함 JWT 발급', async () => {
      // handleCallback을 통해 issueJwt 간접 호출
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-access-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { email: 'jwt-test@google.com', name: 'JWT Tester' },
      });

      const createdUser: IdentityUser = {
        id: 'jwt-user-id',
        email: 'jwt-test@google.com',
        name: 'JWT Tester',
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
        github_user_id: null,
        github_username: null,
        github_token: null,
        publicId: 'pub-uuid-1',
        profile_slug: null,
        is_profile_public: false,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      identityClient.upsertUser.mockResolvedValue(createdUser);

      const result = await service.handleCallback('google', 'code', 'state');

      // accessToken 디코딩
      const decoded = jwt.verify(result.accessToken, JWT_SECRET, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;

      expect(decoded.sub).toBe('jwt-user-id');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();

      // 다른 알고리즘으로는 검증 실패해야 함
      expect(() =>
        jwt.verify(result.accessToken, JWT_SECRET, { algorithms: ['HS384'] }),
      ).toThrow();
    });
  });

  // ============================
  // 19. validateAndConsumeGitHubLinkState (lines 83-89)
  // ============================
  describe('validateAndConsumeGitHubLinkState', () => {
    it('유효한 state → userId 반환 후 삭제 (line 89)', async () => {
      mockRedis.get.mockResolvedValue('user-id-123');
      mockRedis.del.mockResolvedValue(1);

      const userId = await service.validateAndConsumeGitHubLinkState('valid-github-state');

      expect(userId).toBe('user-id-123');
      expect(mockRedis.get).toHaveBeenCalledWith('oauth:github:link:valid-github-state');
      expect(mockRedis.del).toHaveBeenCalledWith('oauth:github:link:valid-github-state');
    });

    it('무효한 state → BadRequestException (line 85-87)', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.validateAndConsumeGitHubLinkState('invalid-state'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validateAndConsumeGitHubLinkState('invalid-state'),
      ).rejects.toThrow('유효하지 않거나 만료된 GitHub 연동 state입니다.');
    });
  });

  // ============================
  // 20. handleCallback — naver/kakao 분기 (lines 163-170)
  // ============================
  describe('handleCallback — naver/kakao 분기', () => {
    beforeEach(() => {
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');
    });

    it('naver callback 처리 (lines 163-165)', async () => {
      // Naver token exchange
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'naver-access-token' },
      });
      // Naver profile
      mockAxios.get.mockResolvedValueOnce({
        data: { response: { email: 'user@naver.com', name: 'Naver User', profile_image: 'https://img.naver.com/photo.jpg' } },
      });

      const naverUser: IdentityUser = {
        id: 'naver-user-id',
        email: 'user@naver.com',
        name: 'Naver User',
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.NAVER,
        github_connected: false,
        github_user_id: null, github_username: null, github_token: null,
        publicId: 'pub-uuid-1', profile_slug: null, is_profile_public: false,
        deleted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };

      identityClient.upsertUser.mockResolvedValue(naverUser);

      const result = await service.handleCallback('naver', 'naver-code', 'valid-state');

      expect(result.user.email).toBe('user@naver.com');
      expect(result.accessToken).toBeDefined();
    });

    it('kakao callback 처리 (lines 167-170)', async () => {
      // Kakao token exchange
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'kakao-access-token' },
      });
      // Kakao profile
      mockAxios.get.mockResolvedValueOnce({
        data: {
          kakao_account: {
            email: 'user@kakao.com',
            profile: { nickname: 'KakaoUser', profile_image_url: 'https://img.kakao.com/photo.jpg' },
          },
        },
      });

      const kakaoUser: IdentityUser = {
        id: 'kakao-user-id',
        email: 'user@kakao.com',
        name: 'KakaoUser',
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.KAKAO,
        github_connected: false,
        github_user_id: null, github_username: null, github_token: null,
        publicId: 'pub-uuid-1', profile_slug: null, is_profile_public: false,
        deleted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };

      identityClient.upsertUser.mockResolvedValue(kakaoUser);

      const result = await service.handleCallback('kakao', 'kakao-code', 'valid-state');

      expect(result.user.email).toBe('user@kakao.com');
      expect(result.accessToken).toBeDefined();
    });
  });

  // ============================
  // 20-a. exchangeGoogleToken — name/picture undefined 분기 (line 210-211)
  // ============================
  describe('exchangeGoogleToken — optional fields null 분기', () => {
    it('name/picture 없으면 null로 처리 (line 210 ?? null 분기)', async () => {
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-access-token' },
      });
      // name, picture 없음
      mockAxios.get.mockResolvedValueOnce({
        data: { email: 'noname@google.com' },
      });

      const createdUser: IdentityUser = {
        id: 'google-noname-id',
        email: 'noname@google.com',
        name: null,
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
        github_user_id: null, github_username: null, github_token: null,
        publicId: 'pub-uuid-1', profile_slug: null, is_profile_public: false,
        deleted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };

      identityClient.upsertUser.mockResolvedValue(createdUser);

      const result = await service.handleCallback('google', 'auth-code', 'valid-state');

      expect(result.user.email).toBe('noname@google.com');
    });
  });

  // ============================
  // 21. exchangeNaverToken — name/profile_image null 분기 (line 242-243)
  // ============================
  describe('exchangeNaverToken — optional fields null 분기', () => {
    it('name/profile_image 없으면 null로 처리', async () => {
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'naver-token' },
      });
      // name, profile_image 없음
      mockAxios.get.mockResolvedValueOnce({
        data: { response: { email: 'noname@naver.com' } },
      });

      const naverUser: IdentityUser = {
        id: 'nv-user-id',
        email: 'noname@naver.com',
        name: null,
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.NAVER,
        github_connected: false,
        github_user_id: null, github_username: null, github_token: null,
        publicId: 'pub-uuid-1', profile_slug: null, is_profile_public: false,
        deleted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };

      identityClient.upsertUser.mockResolvedValue(naverUser);

      const result = await service.handleCallback('naver', 'naver-code', 'state');

      expect(result.user.email).toBe('noname@naver.com');
    });
  });

  // ============================
  // 22. exchangeKakaoToken — email 없는 경우 (line 277-279)
  // ============================
  describe('exchangeKakaoToken — kakao_account.email 없음', () => {
    it('email 없으면 OAuthProfileFetchException', async () => {
      mockRedis.del.mockResolvedValue(1);

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'kakao-token' },
      });
      // kakao_account 없거나 email 없음
      mockAxios.get.mockResolvedValueOnce({
        data: { kakao_account: {} },
      });

      await expect(
        service.handleCallback('kakao', 'kakao-code', 'valid-state'),
      ).rejects.toThrow(OAuthProfileFetchException);
    });

    it('kakao_account 자체가 없으면 OAuthProfileFetchException', async () => {
      mockRedis.del.mockResolvedValue(1);

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'kakao-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: {},
      });

      await expect(
        service.handleCallback('kakao', 'kakao-code', 'valid-state'),
      ).rejects.toThrow(OAuthProfileFetchException);
    });

    it('kakao profile 없으면 name/avatar_url null 처리 (line 283-284)', async () => {
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'kakao-token' },
      });
      // profile 없음
      mockAxios.get.mockResolvedValueOnce({
        data: { kakao_account: { email: 'noprofile@kakao.com' } },
      });

      const kakaoUser: IdentityUser = {
        id: 'kk-user-id',
        email: 'noprofile@kakao.com',
        name: null,
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.KAKAO,
        github_connected: false,
        github_user_id: null, github_username: null, github_token: null,
        publicId: 'pub-uuid-1', profile_slug: null, is_profile_public: false,
        deleted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };

      identityClient.upsertUser.mockResolvedValue(kakaoUser);

      const result = await service.handleCallback('kakao', 'kakao-code', 'state');

      expect(result.user.email).toBe('noprofile@kakao.com');
    });
  });

  // ============================
  // 23. getGitHubAuthUrl (lines 290-307)
  // ============================
  describe('getGitHubAuthUrl', () => {
    it('GitHub OAuth URL 생성 + Redis state 저장', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.getGitHubAuthUrl('user-id-1');

      expect(result.url).toContain('https://github.com/login/oauth/authorize');
      expect(result.url).toContain('client_id=github-client-id');
      expect(result.url).toContain('scope=repo');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'oauth:github:link:mock-uuid-state-1234',
        'user-id-1',
        'EX',
        300,
      );
    });
  });

  // ============================
  // 24. linkGitHub — 추가 분기 (lines 354-369)
  // ============================
  describe('linkGitHub — 추가 분기', () => {
    it('axios.post 예외 (비 BadRequest) → BadRequestException으로 래핑 (line 356)', async () => {
      mockAxios.post.mockRejectedValue(new Error('network error'));

      await expect(service.linkGitHub('user-id-1', 'code')).rejects.toThrow(
        'GitHub 인증 처리 중 오류가 발생했습니다.',
      );
    });

    it('GitHub 사용자 정보 조회 실패 → BadRequestException (line 368-370)', async () => {
      mockAxios.post.mockResolvedValue({
        data: { access_token: 'github-token' },
      });
      mockAxios.get.mockRejectedValue(new Error('GitHub API error'));

      await expect(service.linkGitHub('user-id-1', 'github-code')).rejects.toThrow(
        'GitHub 사용자 정보 조회에 실패했습니다.',
      );
    });

    it('GITHUB_TOKEN_ENCRYPTION_KEY 없으면 InternalServerErrorException (평문 저장 차단)', async () => {
      // configMap에 GITHUB_TOKEN_ENCRYPTION_KEY가 없는 경우 (기본값)
      // service는 beforeEach에서 configMap에 GITHUB_TOKEN_ENCRYPTION_KEY 없이 생성됨
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'github-token-no-encrypt' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { id: '99', login: 'noencrypt-user' },
      });

      await expect(service.linkGitHub('user-id-1', 'code')).rejects.toThrow(
        'GitHub 연동에 필요한 서버 설정이 누락되었습니다. 관리자에게 문의하세요.',
      );
      // Identity 서비스에 평문 토큰이 전달되지 않아야 함
      expect(identityClient.updateGitHub).not.toHaveBeenCalled();
    });

    it('GITHUB_TOKEN_ENCRYPTION_KEY 있으면 encryptToken 호출 (line 374 true 분기)', async () => {
      // GITHUB_TOKEN_ENCRYPTION_KEY 포함한 설정으로 서비스 재생성
      const configMapWithKey = {
        ...configMap,
        GITHUB_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64), // 32바이트 키 (AES-256, 64 hex chars)
      };

      const encryptSvc = new OAuthService(
        {
          get: jest.fn((key: string, defaultVal?: string) => (configMapWithKey as Record<string, string>)[key] ?? defaultVal),
          getOrThrow: jest.fn((key: string) => {
            const val = (configMapWithKey as Record<string, string>)[key];
            if (!val) throw new Error(`Missing config: ${key}`);
            return val;
          }),
        } as unknown as ConfigService,
        identityClient as unknown as IdentityClientService,
        sessionPolicy as unknown as SessionPolicyService,
      );

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'github-access-token-to-encrypt' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { id: '100', login: 'encrypted-user' },
      });

      const result = await encryptSvc.linkGitHub('user-id-1', 'code');

      expect(result.github_username).toBe('encrypted-user');
      // encryptedToken이 null이 아님 (encryptToken이 호출됨)
      expect(identityClient.updateGitHub).toHaveBeenCalledWith(
        'user-id-1',
        expect.objectContaining({ token: expect.any(String) }),
      );
    });
  });

  // ============================
  // 25. relinkGitHub (line 381-383)
  // ============================
  describe('relinkGitHub', () => {
    it('linkGitHub 위임 — 결과 반환', async () => {
      // GITHUB_TOKEN_ENCRYPTION_KEY 포함한 설정으로 서비스 재생성
      const configMapWithKey = {
        ...configMap,
        GITHUB_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
      };
      const relinkSvc = new OAuthService(
        {
          get: jest.fn((key: string, defaultVal?: string) => (configMapWithKey as Record<string, string>)[key] ?? defaultVal),
          getOrThrow: jest.fn((key: string) => {
            const val = (configMapWithKey as Record<string, string>)[key];
            if (!val) throw new Error(`Missing config: ${key}`);
            return val;
          }),
        } as unknown as ConfigService,
        identityClient as unknown as IdentityClientService,
        sessionPolicy as unknown as SessionPolicyService,
      );

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'github-access-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { id: '42', login: 'relink-user' },
      });

      const result = await relinkSvc.relinkGitHub('user-id-1', 'relink-code');

      expect(result.github_username).toBe('relink-user');
    });
  });

  // ============================
  // 26. upsertUser — provider 불일치 분기 (lines 396-405)
  // ============================
  describe('upsertUser — provider 불일치 (ADR-025 정규화)', () => {
    it('다른 provider로 가입된 이메일 → OAuthAccountConflictException', async () => {
      mockRedis.del.mockResolvedValue(1);

      // Google으로 callback, 하지만 기존 유저는 Naver로 가입
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { email: 'existing@naver.com', name: 'Naver User' },
      });

      // Identity 서비스가 provider 불일치로 BadRequestException
      identityClient.upsertUser.mockRejectedValue(
        new BadRequestException('이미 Naver 계정으로 가입된 이메일입니다.'),
      );

      await expect(
        service.handleCallback('google', 'code', 'state'),
      ).rejects.toThrow(OAuthAccountConflictException);
    });

    it('Identity 서비스 ConflictException(409) → OAuthAccountConflictException', async () => {
      mockRedis.del.mockResolvedValue(1);

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { email: 'race@test.com', name: 'Race User' },
      });

      // Identity 서비스가 동시성 race로 ConflictException (HTTP 409)
      identityClient.upsertUser.mockRejectedValue(
        new ConflictException('동시 upsert 충돌'),
      );

      await expect(
        service.handleCallback('google', 'code', 'state'),
      ).rejects.toThrow(OAuthAccountConflictException);
    });

    it('Identity 서비스 비 BadRequest 에러 → OAuthAuthFailedException', async () => {
      mockRedis.del.mockResolvedValue(1);

      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { email: 'db-err@test.com', name: 'DB Error User' },
      });

      identityClient.upsertUser.mockRejectedValue(new Error('DB connection failed'));

      await expect(
        service.handleCallback('google', 'code', 'state'),
      ).rejects.toThrow(OAuthAuthFailedException);
    });
  });

  // ============================
  // 27. updateAvatar (line 429-431)
  // ============================
  describe('updateAvatar', () => {
    it('identityClient.updateUser 호출', async () => {
      identityClient.updateUser.mockResolvedValue({});

      await service.updateAvatar('user-id-1', 'preset:cat');

      expect(identityClient.updateUser).toHaveBeenCalledWith(
        'user-id-1',
        { avatar_url: 'preset:cat' },
      );
    });
  });

  // ============================
  // 28. findUserByIdOrThrow (lines 474-480)
  // ============================
  describe('findUserByIdOrThrow', () => {
    it('사용자 존재 → 반환', async () => {
      const user = { id: 'user-id-1', email: 'test@test.com' } as IdentityUser;
      identityClient.findUserById.mockResolvedValue(user);

      const result = await service.findUserByIdOrThrow('user-id-1');

      expect(result.id).toBe('user-id-1');
    });

    it('사용자 없음 → NotFoundException', async () => {
      identityClient.findUserById.mockRejectedValue(
        new NotFoundException('사용자를 찾을 수 없습니다.'),
      );

      await expect(service.findUserByIdOrThrow('nonexistent')).rejects.toThrow(
        '사용자를 찾을 수 없습니다.',
      );
    });
  });

  // ============================
  // 31. getGitHubStatus (lines 555-566)
  // ============================
  describe('getGitHubStatus', () => {
    it('GitHub 연동 상태 반환', async () => {
      identityClient.getGitHubStatus.mockResolvedValue({
        github_connected: true,
        github_username: 'octocat',
      });

      const result = await service.getGitHubStatus('user-id-1');

      expect(result.github_connected).toBe(true);
      expect(result.github_username).toBe('octocat');
    });

    it('사용자 없음 → Identity 서비스에서 에러 전파', async () => {
      identityClient.getGitHubStatus.mockRejectedValue(
        new NotFoundException('사용자를 찾을 수 없습니다.'),
      );

      await expect(service.getGitHubStatus('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================
  // 32. getGitHubTokenInfo (p0-010 — has_token only)
  // ============================
  describe('getGitHubTokenInfo', () => {
    it('GitHub 토큰 존재 여부 반환 (p0-010)', async () => {
      identityClient.getGitHubTokenInfo.mockResolvedValue({
        github_username: 'octocat',
        has_token: true,
      });

      const result = await service.getGitHubTokenInfo('user-id-1');

      expect(result.github_username).toBe('octocat');
      expect(result.has_token).toBe(true);
    });

    it('사용자 없음 → Identity 서비스에서 에러 전파', async () => {
      identityClient.getGitHubTokenInfo.mockRejectedValue(
        new NotFoundException('사용자를 찾을 수 없습니다.'),
      );

      await expect(service.getGitHubTokenInfo('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================
  // 33. Redis error 콜백 (line 60)
  // ============================
  describe('Redis error 콜백', () => {
    it('Redis on("error") 핸들러 등록 — 예외 없이 로깅 (line 60)', () => {
      const errorCall = (mockRedis.on as jest.Mock).mock.calls.find(
        (call: [string, ...unknown[]]) => call[0] === 'error',
      );
      expect(errorCall).toBeDefined();
      const handler = errorCall![1] as (err: Error) => void;

      // 핸들러 호출 시 process.stdout.write 를 통해 로깅 (예외 없음)
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      expect(() => handler(new Error('Redis down'))).not.toThrow();
      stdoutSpy.mockRestore();
    });
  });

  // ============================
  // 34. issueAccessToken (line 466-468)
  // ============================
  describe('issueAccessToken', () => {
    it('issueJwt 위임 — 유효한 JWT 반환', () => {
      const user = {
        id: 'user-id-1',
        email: 'test@test.com',
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
      } as IdentityUser;

      const token = service.issueAccessToken(user);

      expect(token).toBeDefined();
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      expect(decoded.sub).toBe('user-id-1');
    });
  });

  // ============================
  // 35. issueDemoToken — isDemo: true 클레임 + 2h 만료
  // ============================
  describe('issueDemoToken', () => {
    it('isDemo: true 클레임과 2시간 만료 JWT 반환', () => {
      const user = {
        id: 'demo-user-1',
        email: 'demo@algosu.kr',
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
      } as IdentityUser;

      const token = service.issueDemoToken(user);

      expect(token).toBeDefined();
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      expect(decoded.sub).toBe('demo-user-1');
      expect(decoded.isDemo).toBe(true);
      // 2시간 만료 확인 (7200초 ± 5초 오차)
      const ttl = decoded.exp! - decoded.iat!;
      expect(ttl).toBeGreaterThanOrEqual(7195);
      expect(ttl).toBeLessThanOrEqual(7205);
    });
  });

  // ============================
  // 36. ADR-025 — 토큰 교환 실패 → OAuthTokenExchangeException
  // ============================
  describe('exchangeOAuthToken — 토큰 교환 실패 (ADR-025)', () => {
    beforeEach(() => {
      mockRedis.del.mockResolvedValue(1);
    });

    it('Google 토큰 교환 실패 → OAuthTokenExchangeException', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('Google token endpoint down'));

      await expect(
        service.handleCallback('google', 'code', 'valid-state'),
      ).rejects.toThrow(OAuthTokenExchangeException);
    });

    it('Naver 토큰 교환 실패 → OAuthTokenExchangeException', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('Naver token endpoint down'));

      await expect(
        service.handleCallback('naver', 'code', 'valid-state'),
      ).rejects.toThrow(OAuthTokenExchangeException);
    });

    it('Kakao 토큰 교환 실패 → OAuthTokenExchangeException', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('Kakao token endpoint down'));

      await expect(
        service.handleCallback('kakao', 'code', 'valid-state'),
      ).rejects.toThrow(OAuthTokenExchangeException);
    });
  });

  // ============================
  // 37. ADR-025 — 프로필 조회 실패 → OAuthProfileFetchException
  // ============================
  describe('fetchProfile — 프로필 조회 실패 (ADR-025)', () => {
    beforeEach(() => {
      mockRedis.del.mockResolvedValue(1);
    });

    it('Google 프로필 조회 실패 → OAuthProfileFetchException', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-token' },
      });
      mockAxios.get.mockRejectedValueOnce(new Error('Google userinfo endpoint down'));

      await expect(
        service.handleCallback('google', 'code', 'valid-state'),
      ).rejects.toThrow(OAuthProfileFetchException);
    });

    it('Naver 프로필 조회 실패 → OAuthProfileFetchException', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'naver-token' },
      });
      mockAxios.get.mockRejectedValueOnce(new Error('Naver profile endpoint down'));

      await expect(
        service.handleCallback('naver', 'code', 'valid-state'),
      ).rejects.toThrow(OAuthProfileFetchException);
    });

    it('Kakao 프로필 조회 실패 → OAuthProfileFetchException', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'kakao-token' },
      });
      mockAxios.get.mockRejectedValueOnce(new Error('Kakao profile endpoint down'));

      await expect(
        service.handleCallback('kakao', 'code', 'valid-state'),
      ).rejects.toThrow(OAuthProfileFetchException);
    });
  });

  // ============================
  // 38. ADR-025 — OAuthCallbackException code 필드 검증
  // ============================
  describe('OAuthCallbackException — code 필드 정합성', () => {
    it('각 Exception의 code 필드가 올바른 enum 값을 반환', () => {
      expect(new OAuthInvalidStateException().code).toBe('invalid_state');
      expect(new OAuthTokenExchangeException().code).toBe('token_exchange');
      expect(new OAuthProfileFetchException().code).toBe('profile_fetch');
      expect(new OAuthAccountConflictException().code).toBe('account_conflict');
      expect(new OAuthAuthFailedException().code).toBe('auth_failed');
    });

    it('모든 Exception이 OAuthCallbackException 인스턴스', () => {
      const exceptions = [
        new OAuthInvalidStateException(),
        new OAuthTokenExchangeException(),
        new OAuthProfileFetchException(),
        new OAuthAccountConflictException(),
        new OAuthAuthFailedException(),
      ];
      for (const ex of exceptions) {
        expect(ex).toBeInstanceOf(OAuthCallbackException);
      }
    });
  });
});
