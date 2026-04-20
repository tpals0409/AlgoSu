import { GitHubPushService, GitHubRateLimitError } from './github-push.service';

// metrics 모킹
jest.mock('./metrics', () => ({
  githubRateLimitWarningsTotal: { inc: jest.fn() },
  githubRateLimitedTotal: { inc: jest.fn() },
}));

// config 모킹
jest.mock('./config', () => ({
  config: {
    rateLimitWarnThreshold: 10,
  },
}));

// Octokit 모킹
const mockGetContent = jest.fn();
const mockCreateOrUpdateFileContents = jest.fn();
const mockReposGet = jest.fn();
const mockCreateForAuthenticatedUser = jest.fn();

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: {
      get: mockReposGet,
      getContent: mockGetContent,
      createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      createForAuthenticatedUser: mockCreateForAuthenticatedUser,
    },
  })),
}));

describe('GitHubPushService', () => {
  let service: GitHubPushService;
  const basePushInput = {
    submissionId: 'sub-001',
    userId: 'user-42',
    problemId: 'prob-7',
    language: 'python',
    code: 'print("hello world")',
    githubUsername: 'test-owner',
    githubToken: 'ghs_mock_token',
  };

  /** OctokitResponse 형태로 래핑 */
  const octokitResp = (data: unknown, headers: Record<string, string> = {}) => ({
    status: 200,
    url: '',
    headers: { 'x-ratelimit-remaining': '100', 'x-ratelimit-limit': '5000', 'x-ratelimit-reset': '9999999999', ...headers },
    data,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    service = new GitHubPushService();

    // 기본: 레포 존재
    mockReposGet.mockResolvedValue(octokitResp({}));
    // 기본: 파일 없음 (404)
    mockGetContent.mockRejectedValue(new Error('Not Found'));
    mockCreateOrUpdateFileContents.mockResolvedValue(
      octokitResp({ content: { sha: 'abc123sha' } }),
    );
  });

  // 1. 새 파일 생성
  it('push() -- 새 파일 생성: createOrUpdateFileContents 호출, base64 인코딩', async () => {
    const result = await service.push(basePushInput);

    // Octokit 생성 시 유저 토큰 전달 확인
    const { Octokit } = require('@octokit/rest');
    expect(Octokit).toHaveBeenCalledWith({ auth: 'ghs_mock_token' });

    // createOrUpdateFileContents 호출 확인
    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'algosu-submissions',
        content: Buffer.from('print("hello world")').toString('base64'),
        sha: undefined,
      }),
    );

    expect(result.sha).toBe('abc123sha');
  });

  // 2. 기존 파일 업데이트
  it('push() -- 기존 파일 업데이트: sha 전달', async () => {
    // getContent가 기존 파일을 반환
    mockGetContent.mockResolvedValue(
      octokitResp({ type: 'file', sha: 'existing-sha-456' }),
    );

    await service.push(basePushInput);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        sha: 'existing-sha-456',
      }),
    );
  });

  // 3. 파일 경로 규칙: {weekFolder}/{fileName}.{ext}
  it('push() -- 파일 경로: {weekFolder}/{title}.{ext} (weekNumber 없으면 etc)', async () => {
    const result = await service.push(basePushInput);

    const expectedPath = 'etc/prob-7.py';
    expect(result.filePath).toBe(expectedPath);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expectedPath,
      }),
    );
  });

  // 4. 언어 -> 확장자 매핑
  it('push() -- 언어 확장자 매핑: python->py, java->java', async () => {
    // python -> py
    const pyResult = await service.push({ ...basePushInput, language: 'python' });
    expect(pyResult.filePath).toMatch(/\.py$/);

    jest.clearAllMocks();
    mockReposGet.mockResolvedValue(octokitResp({}));
    mockGetContent.mockRejectedValue(new Error('Not Found'));
    mockCreateOrUpdateFileContents.mockResolvedValue(
      octokitResp({ content: { sha: 'sha-java' } }),
    );

    // java -> java
    const javaResult = await service.push({ ...basePushInput, language: 'java' });
    expect(javaResult.filePath).toMatch(/\.java$/);
  });

  // 5. 미지원 언어 -> txt 기본값
  it('push() -- 미지원 언어: 확장자 txt 기본값', async () => {
    const result = await service.push({
      ...basePushInput,
      language: 'brainfuck',
    });

    expect(result.filePath).toMatch(/\.txt$/);
    expect(result.filePath).toBe('etc/prob-7.txt');
  });

  // 6. 레포 자동 생성
  it('push() -- 레포 없으면 자동 생성', async () => {
    mockReposGet.mockRejectedValue({ status: 404 });
    mockCreateForAuthenticatedUser.mockResolvedValue(octokitResp({}));

    await service.push(basePushInput);

    expect(mockCreateForAuthenticatedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'algosu-submissions',
        private: false,
        auto_init: true,
      }),
    );
  });

  // 7. 레포 조회 실패 (non-404) -- 에러 재throw
  it('push() -- 레포 조회 실패(non-404): 에러 재throw', async () => {
    const networkError = Object.assign(new Error('Network Error'), { status: 500 });
    mockReposGet.mockRejectedValue(networkError);

    await expect(service.push(basePushInput)).rejects.toThrow('Network Error');

    expect(mockCreateForAuthenticatedUser).not.toHaveBeenCalled();
  });

  // 8. getContent가 배열 반환 (디렉토리) -- sha undefined
  it('push() -- getContent가 배열 반환: sha undefined(새 파일로 처리)', async () => {
    mockGetContent.mockResolvedValue(
      octokitResp([{ type: 'file', sha: 'some-sha' }]),
    );

    await service.push(basePushInput);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        sha: undefined,
      }),
    );
  });

  // 9. result.content가 null인 경우 sha는 빈 문자열
  it('push() -- result.content가 null: sha 빈 문자열 반환', async () => {
    mockCreateOrUpdateFileContents.mockResolvedValue(
      octokitResp({ content: null }),
    );

    const result = await service.push(basePushInput);

    expect(result.sha).toBe('');
  });

  // ─── Rate Limit 테스트 ───────────────────────

  // 10. remaining < threshold 시 경고 로그 + 메트릭
  it('inspectRateLimit() -- remaining < threshold: 경고 메트릭 증가', () => {
    const { githubRateLimitWarningsTotal } = require('./metrics');

    const response = octokitResp({}, { 'x-ratelimit-remaining': '5', 'x-ratelimit-limit': '5000', 'x-ratelimit-reset': '9999999999' });
    service.inspectRateLimit(response as any);

    expect(githubRateLimitWarningsTotal.inc).toHaveBeenCalled();
  });

  // 11. remaining >= threshold 시 경고 없음
  it('inspectRateLimit() -- remaining >= threshold: 경고 없음', () => {
    const { githubRateLimitWarningsTotal } = require('./metrics');

    const response = octokitResp({}, { 'x-ratelimit-remaining': '100' });
    service.inspectRateLimit(response as any);

    expect(githubRateLimitWarningsTotal.inc).not.toHaveBeenCalled();
  });

  // 12. 429 응답 시 GitHubRateLimitError throw
  it('inspectRateLimit() -- 429 응답: GitHubRateLimitError throw', () => {
    const { githubRateLimitedTotal } = require('./metrics');

    const response = {
      status: 429,
      url: '',
      headers: { 'retry-after': '30' },
      data: {},
    };

    expect(() => service.inspectRateLimit(response as any)).toThrow(GitHubRateLimitError);
    expect(githubRateLimitedTotal.inc).toHaveBeenCalled();
  });

  // 13. 429 시 Retry-After 없으면 기본 60초
  it('inspectRateLimit() -- 429 + Retry-After 누락: 기본 60초', () => {
    const response = {
      status: 429,
      url: '',
      headers: {},
      data: {},
    };

    try {
      service.inspectRateLimit(response as any);
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(GitHubRateLimitError);
      expect((err as GitHubRateLimitError).retryAfterMs).toBe(60_000);
    }
  });

  // 14. remaining 헤더 없을 때 경고 없음 (NaN 처리)
  it('inspectRateLimit() -- remaining 헤더 없음: 경고 없음', () => {
    const { githubRateLimitWarningsTotal } = require('./metrics');

    const response = octokitResp({}, {});
    // 기본 헤더 제거
    delete (response as any).headers['x-ratelimit-remaining'];
    service.inspectRateLimit(response as any);

    expect(githubRateLimitWarningsTotal.inc).not.toHaveBeenCalled();
  });

  // 15. push() — createOrUpdate 429 시 재시도 성공
  it('push() -- createOrUpdate 429: 재시도 후 성공', async () => {
    // 첫 createOrUpdate 호출 → 429
    mockCreateOrUpdateFileContents
      .mockResolvedValueOnce({
        status: 429,
        url: '',
        headers: { 'retry-after': '0' },
        data: { content: { sha: 'rate-limited' } },
      })
      // 재시도 → 성공
      .mockResolvedValueOnce(
        octokitResp({ content: { sha: 'retry-sha' } }),
      );

    const result = await service.push(basePushInput);
    expect(result.sha).toBe('retry-sha');
  });

  // 15-b. push() — createOrUpdate에서 non-RateLimit 에러 시 throw
  it('push() -- createOrUpdate에서 non-RateLimit 에러: 그대로 throw', async () => {
    mockCreateOrUpdateFileContents.mockRejectedValueOnce(new Error('Server Error 500'));

    await expect(service.push(basePushInput)).rejects.toThrow('Server Error 500');
  });

  // 15-c. push() — getContent 429 재시도 후 배열 반환 (sha undefined)
  it('push() -- getContent 429 재시도 후 배열 반환: sha undefined', async () => {
    mockGetContent
      .mockResolvedValueOnce({
        status: 429,
        url: '',
        headers: { 'retry-after': '0' },
        data: {},
      })
      .mockResolvedValueOnce(
        octokitResp([{ type: 'file', sha: 'array-sha' }]),
      );

    const result = await service.push(basePushInput);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: undefined }),
    );
    expect(result.sha).toBe('abc123sha');
  });

  // 15-d. inspectRateLimit() — remaining < threshold + reset 헤더 없음 (resetAt = 'unknown')
  it('inspectRateLimit() -- remaining < threshold + reset 헤더 없음: resetAt unknown', () => {
    const { githubRateLimitWarningsTotal } = require('./metrics');

    const response = {
      status: 200,
      url: '',
      headers: { 'x-ratelimit-remaining': '3', 'x-ratelimit-limit': '5000' },
      data: {},
    };
    service.inspectRateLimit(response as any);

    expect(githubRateLimitWarningsTotal.inc).toHaveBeenCalled();
  });

  // 15-e. push() — weekNumber, problemTitle, sourcePlatform, sourceUrl 지정
  it('push() -- 모든 옵션 필드 지정: 올바른 파일 경로 생성', async () => {
    const result = await service.push({
      ...basePushInput,
      problemTitle: '두 수의 합',
      weekNumber: '3월1주차',
      sourcePlatform: 'baekjoon',
      sourceUrl: 'https://www.acmicpc.net/problem/1001',
    });

    expect(result.filePath).toBe('3월1주차/BOJ_1001_두 수의 합.py');
  });

  // 15-g. push() — 프로그래머스 문제: PROGRAMMERS_ 접두 파일 경로 생성
  it('push() -- 프로그래머스 문제: PROGRAMMERS_ 접두 파일 경로 생성', async () => {
    const result = await service.push({
      ...basePushInput,
      problemTitle: '폰켓몬',
      weekNumber: '3월1주차',
      sourcePlatform: 'programmers',
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/1845',
    });

    expect(result.filePath).toBe('3월1주차/PROGRAMMERS_1845_폰켓몬.py');
  });

  // 15-h. push() — 프로그래머스 문제 + 주차 미지정: etc/ 폴더로 생성
  it('push() -- 프로그래머스 문제 + 주차 미지정: etc/ 폴더로 생성', async () => {
    const result = await service.push({
      ...basePushInput,
      problemTitle: '폰켓몬',
      sourcePlatform: 'programmers',
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/1845',
    });

    expect(result.filePath).toBe('etc/PROGRAMMERS_1845_폰켓몬.py');
  });

  // 15-f. push() — sourceUrl 빈 문자열일 때 extractProblemNumber 빈 문자열
  it('push() -- sourceUrl 빈 문자열: 문제 번호 없이 파일명 생성', async () => {
    const result = await service.push({
      ...basePushInput,
      problemTitle: 'Test',
      sourceUrl: '',
      sourcePlatform: '',
    });

    expect(result.filePath).toBe('etc/Test.py');
  });

  // 16. push() — getContent 429 시 재시도 성공 (기존 파일 조회)
  it('push() -- getContent 429: 재시도 후 기존 파일 sha 획득', async () => {
    mockGetContent
      .mockResolvedValueOnce({
        status: 429,
        url: '',
        headers: { 'retry-after': '0' },
        data: {},
      })
      .mockResolvedValueOnce(
        octokitResp({ type: 'file', sha: 'existing-sha-after-retry' }),
      );

    const result = await service.push(basePushInput);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: 'existing-sha-after-retry' }),
    );
    expect(result.sha).toBe('abc123sha');
  });
});
