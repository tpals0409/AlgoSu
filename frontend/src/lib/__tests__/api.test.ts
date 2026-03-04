import { ApiError, setCurrentStudyIdForApi, authApi, studyApi, problemApi, submissionApi, draftApi, notificationApi, reviewApi, aiQuotaApi, solvedacApi, studyNoteApi } from '@/lib/api';

// ── fetch mock ──
const mockFetch = jest.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function errorResponse(status: number, message?: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(message ? { message } : {}),
  });
}

function noContentResponse() {
  return Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.reject(new Error('no body')),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  setCurrentStudyIdForApi(null);
});

// ── ApiError ──

describe('ApiError', () => {
  it('status와 message를 포함한다', () => {
    const err = new ApiError('테스트 에러', 401);
    expect(err.status).toBe(401);
    expect(err.message).toBe('테스트 에러');
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });
});

// ── fetchApi 동작 ──

describe('fetchApi (via authApi.getProfile)', () => {
  it('credentials: include로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ email: 'test@test.com', name: null, avatar_url: null, oauth_provider: null, github_connected: false, github_username: null, created_at: '' }));
    await authApi.getProfile();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.credentials).toBe('include');
  });

  it('Content-Type: application/json 헤더를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ email: 'test@test.com' }));
    await authApi.getProfile();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('X-Study-ID 헤더를 설정한다', async () => {
    setCurrentStudyIdForApi('study-123');
    mockFetch.mockReturnValue(jsonResponse({ email: 'test@test.com' }));
    await authApi.getProfile();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-Study-ID']).toBe('study-123');
  });

  it('data 래퍼를 자동 언래핑한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: { id: '1', name: 'test' } }));
    const result = await studyApi.getById('1');
    expect(result).toEqual({ id: '1', name: 'test' });
  });

  it('페이지네이션 응답(data+meta)은 언래핑하지 않는다', async () => {
    const paged = { data: [{ id: '1' }], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } };
    mockFetch.mockReturnValue(jsonResponse(paged));
    const result = await submissionApi.list();
    expect(result).toEqual(paged);
  });

  it('204 응답은 undefined를 반환한다', async () => {
    mockFetch.mockReturnValue(noContentResponse());
    const result = await problemApi.delete('1');
    expect(result).toBeUndefined();
  });

  it('401 에러 시 ApiError를 던진다', async () => {
    mockFetch.mockReturnValue(errorResponse(401));
    await expect(authApi.getProfile()).rejects.toThrow(ApiError);
    await expect(authApi.getProfile()).rejects.toMatchObject({ status: 401 });
  });

  it('500 에러 시 서버 에러 메시지를 사용한다', async () => {
    mockFetch.mockReturnValue(errorResponse(500));
    await expect(authApi.getProfile()).rejects.toThrow('서버 오류가 발생했습니다');
  });

  it('커스텀 에러 메시지가 있으면 우선 사용한다', async () => {
    mockFetch.mockReturnValue(errorResponse(400, '잘못된 파라미터'));
    await expect(authApi.getProfile()).rejects.toThrow('잘못된 파라미터');
  });
});

// ── authApi ──

describe('authApi', () => {
  it('getOAuthUrl은 /auth/oauth/{provider}로 GET 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ url: 'https://google.com/oauth' }));
    const result = await authApi.getOAuthUrl('google');
    expect(mockFetch.mock.calls[0][0]).toContain('/auth/oauth/google');
    expect(result).toEqual({ url: 'https://google.com/oauth' });
  });

  it('linkGitHub는 POST /auth/github/link로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ url: 'https://github.com/login' }));
    await authApi.linkGitHub();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
  });

  it('refresh는 POST /auth/refresh로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ access_token: 'token' }));
    await authApi.refresh();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/refresh');
    expect(opts.method).toBe('POST');
  });

  it('deleteAccount는 DELETE /auth/account로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ message: 'deleted' }));
    await authApi.deleteAccount();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/account');
    expect(opts.method).toBe('DELETE');
  });
});

// ── studyApi ──

describe('studyApi', () => {
  it('list는 GET /api/studies로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await studyApi.list();
    expect(mockFetch.mock.calls[0][0]).toContain('/api/studies');
  });

  it('create는 POST body에 데이터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: '1', name: 'test' }));
    await studyApi.create({ name: 'test' });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ name: 'test' });
  });

  it('getStats는 weekNumber 쿼리를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ totalSubmissions: 0 }));
    await studyApi.getStats('s1', '3월1주차');
    expect(mockFetch.mock.calls[0][0]).toContain('weekNumber=3%EC%9B%941%EC%A3%BC%EC%B0%A8');
  });

  it('getStats는 weekNumber 없이도 동작한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ totalSubmissions: 0 }));
    await studyApi.getStats('s1');
    expect(mockFetch.mock.calls[0][0]).not.toContain('weekNumber');
  });
});

// ── submissionApi ──

describe('submissionApi', () => {
  it('list는 쿼리 파라미터를 올바르게 구성한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
    await submissionApi.list({ page: 2, limit: 20, language: 'python' });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('limit=20');
    expect(url).toContain('language=python');
  });

  it('list는 파라미터 없이도 동작한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
    await submissionApi.list();
    expect(mockFetch.mock.calls[0][0]).toContain('/api/submissions');
  });
});

// ── draftApi ──

describe('draftApi', () => {
  it('find는 404일 때 null을 반환한다', async () => {
    mockFetch.mockReturnValue(errorResponse(404));
    const result = await draftApi.find('p1');
    expect(result).toBeNull();
  });

  it('find는 500일 때 에러를 던진다', async () => {
    mockFetch.mockReturnValue(errorResponse(500));
    await expect(draftApi.find('p1')).rejects.toThrow(ApiError);
  });
});

// ── notificationApi ──

describe('notificationApi', () => {
  it('markAllRead는 PATCH /api/notifications/read-all로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ message: 'ok' }));
    await notificationApi.markAllRead();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/notifications/read-all');
    expect(opts.method).toBe('PATCH');
  });
});

// ── reviewApi ──

describe('reviewApi', () => {
  it('createComment는 POST body에 데이터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ publicId: 'c1' }));
    await reviewApi.createComment({ submissionId: 's1', content: 'good' });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ submissionId: 's1', content: 'good' });
  });

  it('listComments는 submissionId 쿼리를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await reviewApi.listComments('s1');
    expect(mockFetch.mock.calls[0][0]).toContain('submissionId=s1');
  });
});

// ── studyNoteApi ──

describe('studyNoteApi', () => {
  it('get은 404일 때 null을 반환한다', async () => {
    mockFetch.mockReturnValue(errorResponse(404));
    const result = await studyNoteApi.get('p1');
    expect(result).toBeNull();
  });
});
