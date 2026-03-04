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
});
