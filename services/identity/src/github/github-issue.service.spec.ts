/**
 * @file GitHub 이슈 서비스 단위 테스트 — createFeedbackIssue 전 분기 커버
 * @domain identity
 * @layer test
 * @related github-issue.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { GithubIssueService } from './github-issue.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { Feedback, FeedbackCategory, FeedbackStatus } from '../feedback/feedback.entity';

// ─── Mock 헬퍼 ───────────────────────────────────────
const mockFeedback = (overrides: Partial<Feedback> = {}): Feedback =>
  ({
    id: 1,
    publicId: 'pub-fb-1',
    userId: 'user-1',
    studyId: null,
    category: FeedbackCategory.GENERAL,
    content: '테스트 피드백입니다.',
    pageUrl: null,
    browserInfo: null,
    screenshot: null,
    status: FeedbackStatus.OPEN,
    githubIssueNumber: null,
    githubIssueUrl: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    resolvedAt: null,
    ...overrides,
  }) as Feedback;

const OK_RESPONSE = {
  ok: true,
  status: 201,
  json: async () => ({
    number: 42,
    html_url: 'https://github.com/tpals0409/AlgoSu/issues/42',
  }),
} as unknown as Response;

const buildService = async (
  mockLogger: Record<string, jest.Mock>,
): Promise<GithubIssueService> => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      GithubIssueService,
      { provide: StructuredLoggerService, useValue: mockLogger },
    ],
  }).compile();
  return module.get(GithubIssueService);
};

describe('GithubIssueService', () => {
  let mockLogger: { setContext: jest.Mock; log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  const originalFetch = global.fetch;
  const originalToken = process.env['GITHUB_FEEDBACK_ISSUE_TOKEN'];
  const originalRepo = process.env['GITHUB_FEEDBACK_REPO'];

  beforeEach(() => {
    process.env['GITHUB_FEEDBACK_ISSUE_TOKEN'] = 'ghp_test_token';
    process.env['GITHUB_FEEDBACK_REPO'] = 'tpals0409/AlgoSu';
    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    const restore = (key: string, val: string | undefined) => {
      if (val !== undefined) process.env[key] = val;
      else delete process.env[key];
    };
    restore('GITHUB_FEEDBACK_ISSUE_TOKEN', originalToken);
    restore('GITHUB_FEEDBACK_REPO', originalRepo);
    jest.clearAllMocks();
  });

  // ─── 정상 생성 ─────────────────────────────────────
  it('토큰/레포 설정 시 GitHub 이슈를 생성하고 number/url을 반환한다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    const result = await service.createFeedbackIssue(mockFeedback());

    expect(result).toEqual({
      number: 42,
      url: 'https://github.com/tpals0409/AlgoSu/issues/42',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/tpals0409/AlgoSu/issues',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_test_token',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        }),
      }),
    );
  });

  it('요청에 AbortSignal을 전달해 타임아웃(hang) 시 Discord 도착 알림 지연을 방지한다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    await service.createFeedbackIssue(mockFeedback());

    const opts = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    expect(opts.signal.aborted).toBe(false);
  });

  it('제한 시간 경과 시 AbortController.abort를 호출해 요청을 취소한다', async () => {
    jest.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    // fetch가 응답하지 않는 상황(hang)을 시뮬레이션 — signal.abort 이벤트로만 종결
    global.fetch = jest.fn().mockImplementation(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          capturedSignal = opts.signal;
          opts.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    );
    const service = await buildService(mockLogger);

    const pending = service.createFeedbackIssue(mockFeedback());
    jest.advanceTimersByTime(10_000);
    const result = await pending;

    expect(capturedSignal?.aborted).toBe(true);
    expect(result).toBeNull();
    jest.useRealTimers();
  });

  it('타임아웃 abort로 fetch가 거부되면 예외 없이 null을 반환한다', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortErr);
    const service = await buildService(mockLogger);

    const result = await service.createFeedbackIssue(mockFeedback());

    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GitHub 이슈 생성 실패: The operation was aborted'),
    );
  });

  it('본문에 재현 맥락(userId·pageUrl·browserInfo·studyId·publicId)과 스크린샷 링크를 담는다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    await service.createFeedbackIssue(
      mockFeedback({
        category: FeedbackCategory.BUG,
        content: '분석 화면이 안 뜸',
        pageUrl: '/submissions/abc/analysis',
        browserInfo: 'Chrome 130 / macOS',
        studyId: 'study-1',
        publicId: 'pub-xyz',
      }),
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.title).toBe('[BUG] 분석 화면이 안 뜸');
    expect(body.body).toContain('user-1');
    expect(body.body).toContain('/submissions/abc/analysis');
    expect(body.body).toContain('Chrome 130 / macOS');
    expect(body.body).toContain('study-1');
    expect(body.body).toContain('pub-xyz');
    expect(body.body).toContain('/admin/feedbacks/pub-xyz');
    expect(body.body).toContain('분석 화면이 안 뜸');
  });

  it('선택 필드가 null이면 본문에 "-"로 표기한다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    await service.createFeedbackIssue(
      mockFeedback({ pageUrl: null, browserInfo: null, studyId: null }),
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.body).toContain('**페이지**: -');
    expect(body.body).toContain('**브라우저**: -');
    expect(body.body).toContain('**스터디 ID**: -');
  });

  it('60자를 초과하는 본문은 제목에서 60자로 잘라 "..."를 붙인다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    const longContent = '가'.repeat(80);
    await service.createFeedbackIssue(mockFeedback({ content: longContent }));

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.title).toBe(`[GENERAL] ${'가'.repeat(60)}...`);
  });

  it('제목의 개행/공백은 단일 공백으로 정규화한다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    await service.createFeedbackIssue(
      mockFeedback({ content: '  줄바꿈\n\n포함  내용  ' }),
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.title).toBe('[GENERAL] 줄바꿈 포함 내용');
  });

  // ─── 라벨 ──────────────────────────────────────────
  it('BUG 카테고리는 [feedback, bug] 라벨을 부여한다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    await service.createFeedbackIssue(mockFeedback({ category: FeedbackCategory.BUG }));

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.labels).toEqual(['feedback', 'bug']);
  });

  it('GENERAL 카테고리는 중복 제거하여 [feedback] 단일 라벨을 부여한다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    await service.createFeedbackIssue(mockFeedback({ category: FeedbackCategory.GENERAL }));

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.labels).toEqual(['feedback']);
  });

  it('알 수 없는 카테고리는 feedback 라벨로 폴백한다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    await service.createFeedbackIssue(
      mockFeedback({ category: 'UNKNOWN' as FeedbackCategory }),
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.labels).toEqual(['feedback']);
  });

  // ─── 미설정 시 skip ────────────────────────────────
  it('토큰 미설정 시 fetch 없이 null을 반환하고 경고를 1회만 남긴다', async () => {
    delete process.env['GITHUB_FEEDBACK_ISSUE_TOKEN'];
    global.fetch = jest.fn();
    const service = await buildService(mockLogger);

    const r1 = await service.createFeedbackIssue(mockFeedback());
    const r2 = await service.createFeedbackIssue(mockFeedback());

    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GITHUB_FEEDBACK_ISSUE_TOKEN/GITHUB_FEEDBACK_REPO 미설정'),
    );
  });

  it('레포만 미설정이어도 fetch 없이 null을 반환한다', async () => {
    delete process.env['GITHUB_FEEDBACK_REPO'];
    global.fetch = jest.fn();
    const service = await buildService(mockLogger);

    const result = await service.createFeedbackIssue(mockFeedback());

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ─── 라벨 미존재(422) 재시도 ───────────────────────
  it('422(라벨 미존재 가능성) 응답 시 라벨 없이 1회 재시도하여 이슈를 생성한다', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 422 } as Response)
      .mockResolvedValueOnce(OK_RESPONSE);
    global.fetch = fetchMock;
    const service = await buildService(mockLogger);

    const result = await service.createFeedbackIssue(
      mockFeedback({ category: FeedbackCategory.BUG }),
    );

    expect(result).toEqual({
      number: 42,
      url: 'https://github.com/tpals0409/AlgoSu/issues/42',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 1차 요청은 라벨 포함, 재시도(2차)는 라벨 제외
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(firstBody.labels).toEqual(['feedback', 'bug']);
    expect(retryBody.labels).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('라벨 미존재 가능성'),
    );
  });

  it('라벨 없이 재시도해도 실패(422)하면 null을 반환한다', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 422 } as Response);
    const service = await buildService(mockLogger);

    const result = await service.createFeedbackIssue(mockFeedback());

    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GitHub 이슈 생성 응답 오류: status=422'),
    );
  });

  // ─── 실패 처리 ─────────────────────────────────────
  it('비정상 HTTP 응답(5xx) 시 경고 로그를 남기고 null을 반환한다', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 } as Response);
    const service = await buildService(mockLogger);

    const result = await service.createFeedbackIssue(mockFeedback());

    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GitHub 이슈 생성 응답 오류: status=500'),
    );
  });

  it('fetch 실패(Error) 시 예외를 던지지 않고 null을 반환한다', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const service = await buildService(mockLogger);

    const result = await service.createFeedbackIssue(mockFeedback());

    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GitHub 이슈 생성 실패: Network error'),
    );
  });

  it('Error가 아닌 값으로 throw 시에도 로그를 남기고 null을 반환한다', async () => {
    global.fetch = jest.fn().mockRejectedValue('string error');
    const service = await buildService(mockLogger);

    const result = await service.createFeedbackIssue(mockFeedback());

    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GitHub 이슈 생성 실패: string error'),
    );
  });

  it('생성 성공 시 number/publicId를 로그로 남긴다', async () => {
    global.fetch = jest.fn().mockResolvedValue(OK_RESPONSE);
    const service = await buildService(mockLogger);

    await service.createFeedbackIssue(mockFeedback({ publicId: 'pub-log' }));

    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('GitHub 이슈 생성: number=42, publicId=pub-log'),
    );
  });
});
