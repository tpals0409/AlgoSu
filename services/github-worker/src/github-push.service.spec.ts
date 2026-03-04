import { GitHubPushService } from './github-push.service';

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

  beforeEach(() => {
    jest.clearAllMocks();

    service = new GitHubPushService();

    // 기본: 레포 존재
    mockReposGet.mockResolvedValue({ data: {} });
    // 기본: 파일 없음 (404)
    mockGetContent.mockRejectedValue(new Error('Not Found'));
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: { content: { sha: 'abc123sha' } },
    });
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
    mockGetContent.mockResolvedValue({
      data: { type: 'file', sha: 'existing-sha-456' },
    });

    await service.push(basePushInput);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        sha: 'existing-sha-456',
      }),
    );
  });

  // 3. 파일 경로 규칙
  it('push() -- 파일 경로: submissions/{problemId}/{submissionId}.{ext}', async () => {
    const result = await service.push(basePushInput);

    const expectedPath = 'submissions/prob-7/sub-001.py';
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
    mockReposGet.mockResolvedValue({ data: {} });
    mockGetContent.mockRejectedValue(new Error('Not Found'));
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: { content: { sha: 'sha-java' } },
    });

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
    expect(result.filePath).toBe('submissions/prob-7/sub-001.txt');
  });

  // 6. 레포 자동 생성
  it('push() -- 레포 없으면 자동 생성', async () => {
    mockReposGet.mockRejectedValue({ status: 404 });

    await service.push(basePushInput);

    expect(mockCreateForAuthenticatedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'algosu-submissions',
        private: true,
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
    mockGetContent.mockResolvedValue({
      data: [{ type: 'file', sha: 'some-sha' }],
    });

    await service.push(basePushInput);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        sha: undefined,
      }),
    );
  });

  // 9. result.content가 null인 경우 sha는 빈 문자열
  it('push() -- result.content가 null: sha 빈 문자열 반환', async () => {
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: { content: null },
    });

    const result = await service.push(basePushInput);

    expect(result.sha).toBe('');
  });
});
