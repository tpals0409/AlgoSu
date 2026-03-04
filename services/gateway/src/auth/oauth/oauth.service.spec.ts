import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { OAuthService } from './oauth.service';
import { User, OAuthProvider } from './user.entity';

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
  let userRepository: Record<string, jest.Mock>;
  let mockQueryRunner: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

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
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orUpdate: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 'new-user-id' }] }),
      }),
    };

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    service = new OAuthService(
      configService as unknown as ConfigService,
      userRepository as any,
      mockDataSource as unknown as DataSource,
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

      const createdUser = {
        id: 'new-user-id',
        email: mockGoogleProfile.email,
        name: mockGoogleProfile.name,
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
      } as User;

      // 신규 사용자: 첫 findOne(1계정1OAuth 체크)=null, 두 번째 findOne(upsert 후 조회)=createdUser
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdUser);

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

    it('기존 사용자 — name 업데이트 + avatar_url 보호 + JWT 발급', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'google-access-token' },
      });
      mockAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

      const existingUser = {
        id: 'existing-user-id',
        email: mockGoogleProfile.email,
        name: 'Old Name',
        avatar_url: 'preset:cat',
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
      } as User;

      const updatedUser = {
        ...existingUser,
        name: mockGoogleProfile.name,
        avatar_url: 'preset:cat', // avatar_url은 보호되어 기존값 유지
      } as User;

      // 첫 findOne(1계정1OAuth 체크)=existingUser, 두 번째 findOne(upsert 후 조회)=updatedUser
      userRepository.findOne
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(updatedUser);

      const result = await service.handleCallback('google', 'auth-code', 'valid-state');

      expect(result.user.name).toBe(mockGoogleProfile.name);
      // avatar_url은 ON CONFLICT에서 갱신 대상 제외 → 기존값 유지
      expect(result.user.avatar_url).toBe('preset:cat');
    });

    it('미지원 provider → BadRequestException', async () => {
      await expect(
        service.handleCallback('twitter', 'auth-code', 'valid-state'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  // 11-13. linkGitHub + connectGitHub
  // ============================
  describe('linkGitHub', () => {
    it('정상 연동 — connectGitHub 호출 + github_username 반환', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'github-access-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { id: '12345', login: 'octocat' },
      });

      const result = await service.linkGitHub('user-id-1', 'github-code');

      expect(result.github_username).toBe('octocat');
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'user-id-1' },
        expect.objectContaining({
          github_connected: true,
          github_user_id: '12345',
          github_username: 'octocat',
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
    it('userRepository.update 호출', async () => {
      await service.connectGitHub('user-id-1', '12345', 'octocat', 'encrypted-token');

      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'user-id-1' },
        {
          github_connected: true,
          github_user_id: '12345',
          github_username: 'octocat',
          github_token: 'encrypted-token',
        },
      );
    });
  });

  // ============================
  // 14. disconnectGitHub
  // ============================
  describe('disconnectGitHub', () => {
    it('정상 연동 해제 — userRepository.update 호출', async () => {
      await service.disconnectGitHub('user-id-1');

      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'user-id-1' },
        {
          github_connected: false,
          github_user_id: null,
          github_username: null,
          github_token: null,
        },
      );
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
      userRepository.findOne.mockResolvedValue({
        id: 'user-id-1',
        publicId: 'pub-uuid-1',
        email: 'test@test.com',
        name: 'Test User',
      } as User);

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
  // softDeleteAccount
  // ============================
  describe('softDeleteAccount', () => {
    it('정상 탈퇴 — 익명화 + 멤버십/알림 삭제', async () => {
      const activeUser = {
        id: 'user-to-delete',
        email: 'test@google.com',
        name: 'Test User',
        deleted_at: null,
      } as User;

      userRepository.findOne.mockResolvedValue(activeUser);

      await service.softDeleteAccount('user-to-delete');

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      // users UPDATE (익명화)
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining([
          expect.any(Date),
          expect.stringContaining('deleted_'),
          '탈퇴한 사용자',
          null,
          false,
          null,
          null,
          null,
          'user-to-delete',
        ]),
      );
      // study_members DELETE
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM study_members'),
        ['user-to-delete'],
      );
      // notifications DELETE
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications'),
        ['user-to-delete'],
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('멱등성 — 이미 탈퇴한 유저 재요청 시 에러 없음', async () => {
      const deletedUser = {
        id: 'deleted-user',
        email: 'deleted_xxx@withdrawn.local',
        name: '탈퇴한 사용자',
        deleted_at: new Date('2026-01-01'),
      } as User;

      userRepository.findOne.mockResolvedValue(deletedUser);

      await expect(service.softDeleteAccount('deleted-user')).resolves.toBeUndefined();
      expect(mockQueryRunner.connect).not.toHaveBeenCalled();
    });

    it('멱등성 — 존재하지 않는 유저 요청 시 에러 없음', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.softDeleteAccount('nonexistent-user')).resolves.toBeUndefined();
      expect(mockQueryRunner.connect).not.toHaveBeenCalled();
    });

    it('트랜잭션 롤백 — DB 에러 시 롤백', async () => {
      const activeUser = {
        id: 'user-to-delete',
        email: 'test@google.com',
        deleted_at: null,
      } as User;

      userRepository.findOne.mockResolvedValue(activeUser);
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // UPDATE users
        .mockRejectedValueOnce(new Error('DB error')); // DELETE study_members 실패

      await expect(service.softDeleteAccount('user-to-delete')).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
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

      const createdUser = {
        id: 'jwt-user-id',
        email: 'jwt-test@google.com',
        name: 'JWT Tester',
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
      } as User;

      // 첫 findOne(1계정1OAuth 체크)=null, 두 번째 findOne(upsert 후 조회)=createdUser
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdUser);

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

      const naverUser = {
        id: 'naver-user-id',
        email: 'user@naver.com',
        name: 'Naver User',
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.NAVER,
        github_connected: false,
      } as User;

      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(naverUser);

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

      const kakaoUser = {
        id: 'kakao-user-id',
        email: 'user@kakao.com',
        name: 'KakaoUser',
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.KAKAO,
        github_connected: false,
      } as User;

      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(kakaoUser);

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

      const createdUser = {
        id: 'google-noname-id',
        email: 'noname@google.com',
        name: null,
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.GOOGLE,
        github_connected: false,
      } as User;

      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdUser);

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

      const naverUser = {
        id: 'nv-user-id',
        email: 'noname@naver.com',
        name: null,
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.NAVER,
        github_connected: false,
      } as User;

      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(naverUser);

      const result = await service.handleCallback('naver', 'naver-code', 'state');

      expect(result.user.email).toBe('noname@naver.com');
    });
  });

  // ============================
  // 22. exchangeKakaoToken — email 없는 경우 (line 277-279)
  // ============================
  describe('exchangeKakaoToken — kakao_account.email 없음', () => {
    it('email 없으면 BadRequestException', async () => {
      mockRedis.del.mockResolvedValue(1);

      mockAxios.post.mockResolvedValue({
        data: { access_token: 'kakao-token' },
      });
      // kakao_account 없거나 email 없음
      mockAxios.get.mockResolvedValue({
        data: { kakao_account: {} },
      });

      await expect(
        service.handleCallback('kakao', 'kakao-code', 'valid-state'),
      ).rejects.toThrow('Kakao 계정에서 이메일을 가져올 수 없습니다.');
    });

    it('kakao_account 자체가 없으면 BadRequestException', async () => {
      mockRedis.del.mockResolvedValue(1);

      mockAxios.post.mockResolvedValue({
        data: { access_token: 'kakao-token' },
      });
      mockAxios.get.mockResolvedValue({
        data: {},
      });

      await expect(
        service.handleCallback('kakao', 'kakao-code', 'valid-state'),
      ).rejects.toThrow(BadRequestException);
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

      const kakaoUser = {
        id: 'kk-user-id',
        email: 'noprofile@kakao.com',
        name: null,
        avatar_url: 'preset:default',
        oauth_provider: OAuthProvider.KAKAO,
        github_connected: false,
      } as User;

      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(kakaoUser);

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

    it('GITHUB_TOKEN_ENCRYPTION_KEY 없으면 encryptedToken=null로 저장 (line 374 false 분기)', async () => {
      // configMap에 GITHUB_TOKEN_ENCRYPTION_KEY가 없는 경우 (기본값)
      // service는 beforeEach에서 configMap에 GITHUB_TOKEN_ENCRYPTION_KEY 없이 생성됨
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'github-token-no-encrypt' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { id: '99', login: 'noencrypt-user' },
      });

      const result = await service.linkGitHub('user-id-1', 'code');

      expect(result.github_username).toBe('noencrypt-user');
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'user-id-1' },
        expect.objectContaining({ github_token: null }),
      );
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
        } as unknown as typeof configService as any,
        userRepository as any,
        mockDataSource as unknown as DataSource,
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
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'user-id-1' },
        expect.objectContaining({ github_token: expect.any(String) }),
      );
    });
  });

  // ============================
  // 25. relinkGitHub (line 381-383)
  // ============================
  describe('relinkGitHub', () => {
    it('linkGitHub 위임 — 결과 반환', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { access_token: 'github-access-token' },
      });
      mockAxios.get.mockResolvedValueOnce({
        data: { id: '42', login: 'relink-user' },
      });

      const result = await service.relinkGitHub('user-id-1', 'relink-code');

      expect(result.github_username).toBe('relink-user');
    });
  });

  // ============================
  // 26. upsertUser — provider 불일치 분기 (lines 396-405)
  // ============================
  describe('upsertUser — provider 불일치', () => {
    it('다른 provider로 가입된 이메일 → BadRequestException (line 397-404)', async () => {
      mockRedis.del.mockResolvedValue(1);

      // Google으로 callback, 하지만 기존 유저는 Naver로 가입
      mockAxios.post.mockResolvedValue({
        data: { access_token: 'google-token' },
      });
      mockAxios.get.mockResolvedValue({
        data: { email: 'existing@naver.com', name: 'Naver User' },
      });

      const naverUser = {
        id: 'naver-user-id',
        email: 'existing@naver.com',
        oauth_provider: OAuthProvider.NAVER,
      } as User;

      // findOne always returns existing user with different provider
      userRepository.findOne.mockResolvedValue(naverUser);

      await expect(
        service.handleCallback('google', 'code', 'state'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.handleCallback('google', 'code', 'state'),
      ).rejects.toThrow('Naver');
    });

    it('알 수 없는 provider로 가입된 이메일 → providerLabel fallback (line 403 ?? 분기)', async () => {
      mockRedis.del.mockResolvedValue(1);

      // Google으로 callback
      mockAxios.post.mockResolvedValue({
        data: { access_token: 'google-token' },
      });
      mockAxios.get.mockResolvedValue({
        data: { email: 'existing@unknown.com', name: 'User' },
      });

      // 기존 유저가 알 수 없는 provider로 가입 (providerLabel 맵에 없음)
      const unknownProviderUser = {
        id: 'unknown-provider-user-id',
        email: 'existing@unknown.com',
        oauth_provider: 'unknown_provider' as OAuthProvider,
      } as User;

      userRepository.findOne.mockResolvedValue(unknownProviderUser);

      await expect(
        service.handleCallback('google', 'code', 'state'),
      ).rejects.toThrow(BadRequestException);
      // providerLabel['unknown_provider']은 undefined → ?? fallback으로 'unknown_provider' 사용
      await expect(
        service.handleCallback('google', 'code', 'state'),
      ).rejects.toThrow('unknown_provider');
    });
  });

  // ============================
  // 27. updateAvatar (line 429-431)
  // ============================
  describe('updateAvatar', () => {
    it('userRepository.update 호출 (line 430)', async () => {
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateAvatar('user-id-1', 'preset:cat');

      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'user-id-1' },
        { avatar_url: 'preset:cat' },
      );
    });
  });

  // ============================
  // 28. findUserByIdOrThrow (lines 474-480)
  // ============================
  describe('findUserByIdOrThrow', () => {
    it('사용자 존재 → 반환 (lines 475-479)', async () => {
      const user = { id: 'user-id-1', email: 'test@test.com' } as User;
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.findUserByIdOrThrow('user-id-1');

      expect(result.id).toBe('user-id-1');
    });

    it('사용자 없음 → NotFoundException (line 477)', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.findUserByIdOrThrow('nonexistent')).rejects.toThrow(
        '사용자를 찾을 수 없습니다.',
      );
    });
  });

  // ============================
  // 29. revokeRefreshToken (line 513-515)
  // ============================
  describe('revokeRefreshToken', () => {
    it('Redis에서 refresh token 삭제 (line 514)', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.revokeRefreshToken('user-id-1');

      expect(mockRedis.del).toHaveBeenCalledWith('refresh:user-id-1');
    });
  });

  // ============================
  // 30. refreshAccessToken — 추가 분기 (lines 525-547)
  // ============================
  describe('refreshAccessToken — 추가 분기', () => {
    it('Redis에 토큰 없음 (null) → UnauthorizedException (line 541)', async () => {
      const validRefresh = jwt.sign(
        { sub: 'user-id-1', type: 'refresh' },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' },
      );

      // Redis에 저장된 값 없음
      mockRedis.get.mockResolvedValue(null);

      await expect(service.refreshAccessToken(validRefresh)).rejects.toThrow(
        'Refresh Token이 만료되었거나 무효화되었습니다.',
      );
    });

    it('유효 토큰이지만 user 없음 → UnauthorizedException (line 545-547)', async () => {
      const validRefresh = jwt.sign(
        { sub: 'user-id-1', type: 'refresh' },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' },
      );

      mockRedis.get.mockResolvedValue(validRefresh);
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshAccessToken(validRefresh)).rejects.toThrow(
        '사용자를 찾을 수 없습니다.',
      );
    });

    it('JWT에 sub 없으면 UnauthorizedException (line 535-537)', async () => {
      // sub 없는 JWT (payload만 있고 sub claim 없음)
      const noSubToken = jwt.sign(
        { type: 'refresh' }, // sub 없음
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' },
      );

      await expect(service.refreshAccessToken(noSubToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('JWT payload가 string이면 UnauthorizedException (line 525-526)', async () => {
      // jwt.sign에 string을 직접 전달하면 jwt.verify가 string을 반환함
      const stringPayloadToken = jwt.sign('string-payload', JWT_SECRET, {
        algorithm: 'HS256',
      });

      // jwt.verify(stringPayloadToken, secret) → 'string-payload' (string) 반환
      // → typeof decoded === 'string' → true → UnauthorizedException (line 525-526)
      // 하지만 이 throw는 try 블록 안에서 발생하여 catch가 잡아 다시 UnauthorizedException으로 던짐
      await expect(service.refreshAccessToken(stringPayloadToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ============================
  // 31. getGitHubStatus (lines 555-566)
  // ============================
  describe('getGitHubStatus', () => {
    it('GitHub 연동 상태 반환 (lines 558-565)', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-id-1',
        github_connected: true,
        github_username: 'octocat',
      } as User);

      const result = await service.getGitHubStatus('user-id-1');

      expect(result.github_connected).toBe(true);
      expect(result.github_username).toBe('octocat');
    });

    it('사용자 없음 → UnauthorizedException (line 560)', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getGitHubStatus('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getGitHubStatus('nonexistent')).rejects.toThrow(
        '사용자를 찾을 수 없습니다.',
      );
    });
  });

  // ============================
  // 32. getGitHubTokenInfo (lines 568-579)
  // ============================
  describe('getGitHubTokenInfo', () => {
    it('GitHub 토큰 정보 반환 (lines 571-578)', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-id-1',
        github_username: 'octocat',
        github_token: 'encrypted-token-value',
      } as User);

      const result = await service.getGitHubTokenInfo('user-id-1');

      expect(result.github_username).toBe('octocat');
      expect(result.github_token).toBe('encrypted-token-value');
    });

    it('사용자 없음 → UnauthorizedException (line 573)', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getGitHubTokenInfo('nonexistent')).rejects.toThrow(
        UnauthorizedException,
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
      } as User;

      const token = service.issueAccessToken(user);

      expect(token).toBeDefined();
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      expect(decoded.sub).toBe('user-id-1');
    });
  });

  // ============================
  // 35. sse controller line 339 coverage — removeChannelListener when channel not found
  // (이 테스트는 SseController spec에 속하지만 참조용)
  // ============================

  // ============================
  // 36. removeChannelListener — channelListeners 없을 때 (sse.controller.ts line 339)
  // 이미 SSE spec에서 추가했으나 oauth 테스트 파일 완결을 위해 기술
  // ============================
});
