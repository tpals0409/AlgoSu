import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { OAuthService } from './oauth.service';
import { User, OAuthProvider } from './user.entity';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
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
  let userRepository: Record<string, jest.Mock>;

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

    userRepository = {
      findOne: jest.fn(),
      create: jest.fn((data: Partial<User>) => ({ id: 'new-user-id', ...data }) as User),
      save: jest.fn((user: User) => Promise.resolve(user)),
    };

    service = new OAuthService(
      configService as unknown as ConfigService,
      userRepository as any,
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

    it('무효한 state → BadRequestException (del 반환값 0)', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(service.validateAndConsumeState('invalid-state')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateAndConsumeState('invalid-state')).rejects.toThrow(
        '유효하지 않거나 만료된 OAuth state입니다.',
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

      // 신규 사용자 (기존 유저 없음)
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue({
        id: 'new-user-id',
        email: mockGoogleProfile.email,
        name: mockGoogleProfile.name,
        avatar_url: mockGoogleProfile.picture,
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
      } as User);
      userRepository.save.mockImplementation((user: User) =>
        Promise.resolve({ ...user, id: 'new-user-id' }),
      );

      const result = await service.handleCallback('google', 'auth-code', 'valid-state');

      expect(result.user.email).toBe('user@google.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // JWT 검증 (HS256)
      const decoded = jwt.verify(result.accessToken, JWT_SECRET, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
      expect(decoded.sub).toBe('new-user-id');
    });

    it('기존 사용자 — 프로필 업데이트 + JWT 발급', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-access-token' },
      });
      mockAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

      const existingUser = {
        id: 'existing-user-id',
        email: mockGoogleProfile.email,
        name: 'Old Name',
        avatar_url: null,
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
      } as User;

      userRepository.findOne.mockResolvedValue(existingUser);
      userRepository.save.mockImplementation((user: User) => Promise.resolve(user));

      const result = await service.handleCallback('google', 'auth-code', 'valid-state');

      expect(result.user.name).toBe(mockGoogleProfile.name);
      expect(result.user.avatar_url).toBe(mockGoogleProfile.picture);
    });

    it('미지원 provider → BadRequestException', async () => {
      await expect(
        service.handleCallback('twitter', 'auth-code', 'valid-state'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  // 11-13. linkGitHub
  // ============================
  describe('linkGitHub', () => {
    it('정상 연동 — GitHub user 정보 업데이트', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'github-access-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { id: '12345', login: 'octocat' },
      });

      const existingUser = {
        id: 'user-id-1',
        email: 'user@test.com',
        github_connected: false,
        github_user_id: null,
        github_username: null,
      } as User;

      userRepository.findOne.mockResolvedValue(existingUser);
      userRepository.save.mockImplementation((user: User) => Promise.resolve(user));

      const result = await service.linkGitHub('user-id-1', 'github-code');

      expect(result.github_connected).toBe(true);
      expect(result.github_user_id).toBe('12345');
      expect(result.github_username).toBe('octocat');
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

    it('사용자 없음 → UnauthorizedException', async () => {
      mockAxios.post.mockResolvedValue({
        data: { access_token: 'github-access-token' },
      });
      mockAxios.get.mockResolvedValue({
        data: { id: '12345', login: 'octocat' },
      });

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.linkGitHub('nonexistent-user', 'github-code')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.linkGitHub('nonexistent-user', 'github-code')).rejects.toThrow(
        '사용자를 찾을 수 없습니다.',
      );
    });
  });

  // ============================
  // 14. unlinkGitHub
  // ============================
  describe('unlinkGitHub', () => {
    it('정상 연동 해제 — GitHub 필드 null/false 처리', async () => {
      const existingUser = {
        id: 'user-id-1',
        email: 'user@test.com',
        github_connected: true,
        github_user_id: '12345',
        github_username: 'octocat',
      } as User;

      userRepository.findOne.mockResolvedValue(existingUser);
      userRepository.save.mockImplementation((user: User) => Promise.resolve(user));

      const result = await service.unlinkGitHub('user-id-1');

      expect(result.github_connected).toBe(false);
      expect(result.github_user_id).toBeNull();
      expect(result.github_username).toBeNull();
    });
  });

  // ============================
  // 15-17. refreshAccessToken
  // ============================
  describe('refreshAccessToken', () => {
    it('정상 갱신 — 유효 refreshToken + Redis 일치 → 새 accessToken', async () => {
      const validRefresh = jwt.sign(
        { sub: 'user-id-1', type: 'refresh' },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' },
      );

      mockRedis.get.mockResolvedValue(validRefresh);

      const result = await service.refreshAccessToken(validRefresh);

      expect(result.accessToken).toBeDefined();

      const decoded = jwt.verify(result.accessToken, JWT_SECRET, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
      expect(decoded.sub).toBe('user-id-1');
    });

    it('만료된 refreshToken → UnauthorizedException', async () => {
      // 이미 만료된 토큰 (exp = 과거)
      const expiredToken = jwt.sign(
        { sub: 'user-id-1', type: 'refresh', exp: Math.floor(Date.now() / 1000) - 3600 },
        JWT_SECRET,
        { algorithm: 'HS256' },
      );

      await expect(service.refreshAccessToken(expiredToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('Redis 저장값 불일치 → UnauthorizedException', async () => {
      const validRefresh = jwt.sign(
        { sub: 'user-id-1', type: 'refresh' },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' },
      );

      // Redis에 다른 토큰이 저장되어 있는 경우
      mockRedis.get.mockResolvedValue('different-stored-token');

      await expect(service.refreshAccessToken(validRefresh)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshAccessToken(validRefresh)).rejects.toThrow(
        'Refresh Token이 만료되었거나 무효화되었습니다.',
      );
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

      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue({
        id: 'jwt-user-id',
        email: 'jwt-test@google.com',
        name: 'JWT Tester',
        avatar_url: null,
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
      } as User);
      userRepository.save.mockImplementation((user: User) =>
        Promise.resolve({ ...user, id: 'jwt-user-id' }),
      );

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
});
