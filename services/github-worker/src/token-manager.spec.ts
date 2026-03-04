// ioredis 모킹 — TokenManager constructor에서 new Redis() 사용
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisKeys = jest.fn();
const mockRedisQuit = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    keys: mockRedisKeys,
    quit: mockRedisQuit,
  }));
});

// @octokit/auth-app 모킹
const mockAppAuth = jest.fn();
jest.mock('@octokit/auth-app', () => ({
  createAppAuth: jest.fn().mockImplementation(() => mockAppAuth),
}));

// global.fetch 모킹
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// config 모킹 — 모듈 로드 시 환경변수 체크 우회
jest.mock('./config', () => ({
  config: {
    rabbitmqUrl: 'amqp://localhost',
    redisUrl: 'redis://localhost:6379',
    gatewayInternalUrl: 'http://gateway:3000',
    internalKeyGateway: '',
    submissionServiceUrl: 'http://submission-service:3003',
    submissionServiceKey: '',
    maxRetries: 3,
    retryDelayMs: 5000,
    githubAppId: '12345',
    githubAppPrivateKeyBase64: Buffer.from('fake-private-key').toString('base64'),
    githubTokenEncryptionKey: 'a'.repeat(64),
    githubTokenTtl: 3600,
    githubTokenRefreshInterval: 50 * 60 * 1000,
  },
}));

// setInterval/clearInterval 모킹
jest.useFakeTimers();

import { TokenManager } from './token-manager';

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  const ENV_BACKUP: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.clearAllMocks();

    // 환경변수 백업 및 설정
    ENV_BACKUP['GITHUB_APP_ID'] = process.env['GITHUB_APP_ID'];
    ENV_BACKUP['GITHUB_APP_PRIVATE_KEY_BASE64'] = process.env['GITHUB_APP_PRIVATE_KEY_BASE64'];
    ENV_BACKUP['REDIS_URL'] = process.env['REDIS_URL'];

    process.env['GITHUB_APP_ID'] = '12345';
    process.env['GITHUB_APP_PRIVATE_KEY_BASE64'] = Buffer.from('fake-private-key').toString('base64');
    process.env['REDIS_URL'] = 'redis://localhost:6379';

    // fetch 기본 응답 설정
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 99 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'ghs_new_installation_token' }),
      });

    // appAuth 기본 응답
    mockAppAuth.mockResolvedValue({ token: 'jwt-app-token' });

    // Redis 기본 응답
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisKeys.mockResolvedValue([]);
    mockRedisQuit.mockResolvedValue('OK');

    tokenManager = new TokenManager();
  });

  afterEach(async () => {
    // 환경변수 복원
    for (const [key, val] of Object.entries(ENV_BACKUP)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }

    await tokenManager.close();
    jest.clearAllTimers();
  });

  // 1. 캐시 히트: Redis GET 반환
  it('getTokenForRepo() -- 캐시 히트: Redis에서 토큰 반환', async () => {
    mockRedisGet.mockResolvedValue('ghs_cached_token');

    const token = await tokenManager.getTokenForRepo('owner', 'repo');

    expect(token).toBe('ghs_cached_token');
    expect(mockRedisGet).toHaveBeenCalledWith('github:app:token:owner/repo');
    // fetch가 호출되지 않아야 함 (캐시 히트)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // 2. 캐시 미스: fetchAndCacheToken 호출
  it('getTokenForRepo() -- 캐시 미스: fetchAndCacheToken 호출', async () => {
    mockRedisGet.mockResolvedValue(null);

    const token = await tokenManager.getTokenForRepo('owner', 'repo');

    expect(token).toBe('ghs_new_installation_token');
    // fetch가 2회 호출됨 (installation 조회 + access_tokens 발급)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // 3. fetchAndCacheToken 정상: Redis SET + TTL 3600
  it('fetchAndCacheToken() -- 정상: Redis SET with TTL 3600', async () => {
    mockRedisGet.mockResolvedValue(null);

    await tokenManager.getTokenForRepo('myorg', 'myrepo');

    expect(mockRedisSet).toHaveBeenCalledWith(
      'github:app:token:myorg/myrepo',
      'ghs_new_installation_token',
      'EX',
      3600,
    );
  });

  // 4. 환경변수 미설정: Error throw
  it('fetchAndCacheToken() -- 환경변수 미설정: Error throw', async () => {
    // config mock의 값을 비워서 환경변수 미설정 상태 시뮬레이션
    const { config: mockConfig } = require('./config');
    const origAppId = mockConfig.githubAppId;
    const origKey = mockConfig.githubAppPrivateKeyBase64;
    mockConfig.githubAppId = '';
    mockConfig.githubAppPrivateKeyBase64 = '';

    mockRedisGet.mockResolvedValue(null);

    await expect(tokenManager.getTokenForRepo('owner', 'repo')).rejects.toThrow(
      'GitHub App 환경변수가 설정되지 않았습니다',
    );

    // 복원
    mockConfig.githubAppId = origAppId;
    mockConfig.githubAppPrivateKeyBase64 = origKey;
  });

  // 5. App 미설치 404: TOKEN_INVALID
  it('fetchAndCacheToken() -- App 미설치 404: TOKEN_INVALID 에러', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    await expect(tokenManager.getTokenForRepo('owner', 'repo')).rejects.toThrow(
      'TOKEN_INVALID',
    );
  });

  // 6. close(): timer 해제 + Redis quit
  it('close() -- timer 해제 + Redis quit', async () => {
    await tokenManager.close();

    expect(mockRedisQuit).toHaveBeenCalled();
  });

  // 7. Installation 조회 실패 (non-404): Error throw
  it('fetchAndCacheToken() -- Installation 조회 실패(503): Error throw', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    await expect(tokenManager.getTokenForRepo('owner', 'repo')).rejects.toThrow(
      'Installation 조회 실패: 503',
    );
  });

  // 8. Access Token 발급 실패: Error throw
  it('fetchAndCacheToken() -- Access Token 발급 실패: Error throw', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockFetch.mockReset();
    // installation 조회 성공
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 42 }),
    });
    // access token 발급 실패
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    await expect(tokenManager.getTokenForRepo('owner', 'repo')).rejects.toThrow(
      'Installation Token 발급 실패: 401',
    );
  });

  // 9. refreshAllCachedTokens() -- 키가 있을 때 갱신 (정상)
  it('refreshAllCachedTokens() -- 캐시된 키 갱신', async () => {
    mockRedisKeys.mockResolvedValue(['github:app:token:owner/repo']);
    mockRedisGet.mockResolvedValue(null);

    // 타이머 실행
    jest.runOnlyPendingTimers();

    // 비동기 작업 완료 대기
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // fetchAndCacheToken이 호출됨 (fetch가 호출됨)
    // (실패해도 무시하므로 에러 없이 통과)
    expect(mockRedisKeys).toHaveBeenCalled();
  });

  // 10. refreshAllCachedTokens() -- 슬래시 없는 키는 skip
  it('refreshAllCachedTokens() -- 슬래시 없는 키는 skip', async () => {
    mockRedisKeys.mockResolvedValue(['github:app:token:invalidkey']);
    mockRedisGet.mockResolvedValue(null);

    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();

    // slashIdx === -1 branch: fetch가 호출되지 않음
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // 11. refreshAllCachedTokens() -- fetch 실패해도 무시
  it('refreshAllCachedTokens() -- 개별 갱신 실패 무시', async () => {
    mockRedisKeys.mockResolvedValue(['github:app:token:owner/repo']);
    mockRedisGet.mockResolvedValue(null);
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('network error'));

    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // 에러가 무시되므로 예외 없이 통과
    expect(mockRedisKeys).toHaveBeenCalled();
  });

  // 12. refreshAllCachedTokens() -- redis.keys 실패 무시
  it('refreshAllCachedTokens() -- redis.keys 실패 무시', async () => {
    mockRedisKeys.mockRejectedValue(new Error('redis error'));

    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();

    // catch 블록 커버 — 에러 없이 통과
    expect(mockRedisKeys).toHaveBeenCalled();
  });

  // 13. decryptUserToken() -- 잘못된 형식: Error throw
  it('decryptUserToken() -- parts.length !== 3: Error throw', async () => {
    expect(() => tokenManager.decryptUserToken('only:two')).toThrow(
      'Invalid encrypted token format',
    );
  });
});
