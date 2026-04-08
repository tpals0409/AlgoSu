import { ApiError, StudyRequiredError, setCurrentStudyIdForApi, authApi, studyApi, problemApi, submissionApi, draftApi, aiQuotaApi, notificationApi, reviewApi, studyNoteApi, solvedacApi, adminApi } from '@/lib/api';

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
  // 대부분의 테스트에서 멤버십 필수 경로 가드에 걸리지 않도록 기본 studyId 설정
  setCurrentStudyIdForApi('test-study');
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

  it('get은 404가 아닌 에러는 다시 던진다', async () => {
    mockFetch.mockReturnValue(errorResponse(500));
    await expect(studyNoteApi.get('p1')).rejects.toThrow(ApiError);
  });

  it('upsert는 PUT /api/study-notes로 요청한다', async () => {
    const note = { id: 1, publicId: 'n1', problemId: 'p1', studyId: 's1', content: 'hello', createdAt: '', updatedAt: '' };
    mockFetch.mockReturnValue(jsonResponse(note));
    await studyNoteApi.upsert({ problemId: 'p1', content: 'hello' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/study-notes');
    expect(opts.method).toBe('PUT');
  });
});

// ── fetchApi 에러 분기 추가 ──

describe('fetchApi error 분기', () => {
  it('res.json()이 실패하면 HTTP_ERROR_MESSAGES를 사용한다', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.reject(new Error('parse error')),
      }),
    );
    await expect(authApi.getProfile()).rejects.toMatchObject({
      status: 404,
      message: '요청한 리소스를 찾을 수 없습니다.',
    });
  });

  it('알 수 없는 status 코드에 대해 기본 메시지를 사용한다', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 418,
        json: () => Promise.reject(new Error('parse error')),
      }),
    );
    await expect(authApi.getProfile()).rejects.toMatchObject({
      status: 418,
      message: '서버 오류 (418)',
    });
  });

  it('data 키가 없는 객체는 그대로 반환한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ count: 5 }));
    const result = await aiQuotaApi.get();
    expect(result).toEqual({ count: 5 });
  });

  it('null 응답은 그대로 반환한다', async () => {
    mockFetch.mockReturnValue(jsonResponse(null));
    const result = await authApi.getProfile();
    expect(result).toBeNull();
  });

  it('배열 응답은 그대로 반환한다', async () => {
    mockFetch.mockReturnValue(jsonResponse([{ id: '1' }]));
    const result = await studyApi.list();
    expect(result).toEqual([{ id: '1' }]);
  });

  it('X-Study-ID 헤더가 없을 때 비멤버십 경로에서는 헤더에 포함되지 않는다', async () => {
    setCurrentStudyIdForApi(null);
    mockFetch.mockReturnValue(jsonResponse({ email: 'test@test.com' }));
    await authApi.getProfile(); // /auth/profile — 비멤버십 경로
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-Study-ID']).toBeUndefined();
  });
});

// ── StudyRequiredError ──

describe('StudyRequiredError (멤버십 필수 경로 가드)', () => {
  beforeEach(() => {
    setCurrentStudyIdForApi(null);
    // localStorage도 비워서 fallback 방지
    if (typeof window !== 'undefined') {
      localStorage.removeItem('algosu:current-study-id');
    }
  });

  it('studyId 없이 /api/problems 호출 시 StudyRequiredError를 던진다', async () => {
    await expect(problemApi.findAll()).rejects.toThrow(StudyRequiredError);
    await expect(problemApi.findAll()).rejects.toThrow('스터디를 선택해주세요');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('studyId 없이 /api/submissions 호출 시 StudyRequiredError를 던진다', async () => {
    await expect(submissionApi.list()).rejects.toThrow(StudyRequiredError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('studyId 없이 /api/reviews 호출 시 StudyRequiredError를 던진다', async () => {
    await expect(reviewApi.listComments('s1')).rejects.toThrow(StudyRequiredError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('studyId 없이 /api/study-notes 호출 시 StudyRequiredError를 던진다', async () => {
    await expect(studyNoteApi.upsert({ problemId: 'p1', content: 'test' })).rejects.toThrow(StudyRequiredError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('studyId 없이 /api/analysis 호출 시 StudyRequiredError를 던진다', async () => {
    await expect(aiQuotaApi.get()).rejects.toThrow(StudyRequiredError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('studyId 없이 비멤버십 경로(/auth, /api/studies, /api/notifications)는 정상 동작', async () => {
    mockFetch.mockReturnValue(jsonResponse({ email: 'test@test.com' }));
    await expect(authApi.getProfile()).resolves.toBeDefined();

    mockFetch.mockReturnValue(jsonResponse([]));
    await expect(studyApi.list()).resolves.toBeDefined();

    mockFetch.mockReturnValue(jsonResponse([]));
    await expect(notificationApi.list()).resolves.toBeDefined();
  });

  it('studyId가 있으면 멤버십 경로도 정상 동작', async () => {
    setCurrentStudyIdForApi('study-123');
    mockFetch.mockReturnValue(jsonResponse([]));
    await expect(problemApi.findAll()).resolves.toBeDefined();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-Study-ID']).toBe('study-123');
  });
});

// ── authApi 추가 분기 ──

describe('authApi 추가 분기', () => {
  it('unlinkGitHub은 DELETE /auth/github/link로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ message: 'unlinked' }));
    await authApi.unlinkGitHub();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/github/link');
    expect(opts.method).toBe('DELETE');
  });

  it('relinkGitHub은 POST /auth/github/relink로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ url: 'https://github.com/relink' }));
    await authApi.relinkGitHub();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/github/relink');
    expect(opts.method).toBe('POST');
  });

  it('updateProfile은 PATCH /auth/profile로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ avatar_url: 'https://example.com/avatar.png' }));
    await authApi.updateProfile({ avatar_url: 'https://example.com/avatar.png' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/profile');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ avatar_url: 'https://example.com/avatar.png' });
  });

  it('getOAuthUrl은 naver provider도 올바르게 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ url: 'https://naver.com/oauth' }));
    const result = await authApi.getOAuthUrl('naver');
    expect(mockFetch.mock.calls[0][0]).toContain('/auth/oauth/naver');
    expect(result).toEqual({ url: 'https://naver.com/oauth' });
  });

  it('getOAuthUrl은 kakao provider도 올바르게 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ url: 'https://kakao.com/oauth' }));
    await authApi.getOAuthUrl('kakao');
    expect(mockFetch.mock.calls[0][0]).toContain('/auth/oauth/kakao');
  });
});

// ── studyApi 추가 분기 ──

describe('studyApi 추가 분기', () => {
  it('verifyInvite는 POST body에 code를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ valid: true, studyName: 'TestStudy' }));
    const result = await studyApi.verifyInvite('invite-code-123');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/studies/verify-invite');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ code: 'invite-code-123' });
    expect(result).toEqual({ valid: true, studyName: 'TestStudy' });
  });

  it('join은 POST body에 code와 nickname을 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 's1', name: 'Study', role: 'MEMBER' }));
    await studyApi.join('inv-code', 'nick');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/studies/join');
    expect(JSON.parse(opts.body)).toEqual({ code: 'inv-code', nickname: 'nick' });
  });

  it('update는 PUT body에 데이터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 's1', name: 'New Name', role: 'ADMIN' }));
    await studyApi.update('s1', { name: 'New Name' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/studies/s1');
    expect(opts.method).toBe('PUT');
  });

  it('getMembers는 GET /api/studies/{id}/members로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await studyApi.getMembers('s1');
    expect(mockFetch.mock.calls[0][0]).toContain('/api/studies/s1/members');
  });

  it('invite는 POST /api/studies/{id}/invite로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ code: 'abc123', expires_at: '2026-01-01' }));
    await studyApi.invite('s1');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/studies/s1/invite');
    expect(opts.method).toBe('POST');
  });

  it('changeRole은 PATCH body에 role을 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ message: 'ok' }));
    await studyApi.changeRole('s1', 'u1', 'ADMIN');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/studies/s1/members/u1/role');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ role: 'ADMIN' });
  });

  it('removeMember는 DELETE /api/studies/{id}/members/{userId}로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ message: 'removed' }));
    await studyApi.removeMember('s1', 'u1');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/studies/s1/members/u1');
    expect(opts.method).toBe('DELETE');
  });

  it('delete는 DELETE /api/studies/{id}로 요청하고 204를 반환한다', async () => {
    mockFetch.mockReturnValue(noContentResponse());
    const result = await studyApi.delete('s1');
    expect(result).toBeUndefined();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/studies/s1');
    expect(opts.method).toBe('DELETE');
  });

  it('updateNickname은 PATCH body에 nickname을 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ nickname: 'NewNick' }));
    await studyApi.updateNickname('s1', 'NewNick');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/studies/s1/nickname');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ nickname: 'NewNick' });
  });

  it('notifyProblemCreated는 POST body에 데이터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ message: 'notified' }));
    await studyApi.notifyProblemCreated('s1', { problemId: 'p1', problemTitle: 'Test Problem', weekNumber: 'W1' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/studies/s1/notify-problem');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ problemId: 'p1', problemTitle: 'Test Problem', weekNumber: 'W1' });
  });
});

// ── problemApi 추가 분기 ──

describe('problemApi 추가 분기', () => {
  it('findAll은 GET /api/problems/all로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await problemApi.findAll();
    expect(mockFetch.mock.calls[0][0]).toContain('/api/problems/all');
  });

  it('findById는 GET /api/problems/{id}로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 'p1', title: 'Test' }));
    await problemApi.findById('p1');
    expect(mockFetch.mock.calls[0][0]).toContain('/api/problems/p1');
  });

  it('create는 POST body에 데이터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 'p1', title: 'New Problem' }));
    await problemApi.create({ title: 'New Problem', weekNumber: 'W1' });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toMatchObject({ title: 'New Problem', weekNumber: 'W1' });
  });

  it('update는 PATCH body에 데이터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 'p1', title: 'Updated' }));
    await problemApi.update('p1', { title: 'Updated' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/problems/p1');
    expect(opts.method).toBe('PATCH');
  });
});

// ── submissionApi 추가 분기 ──

describe('submissionApi 추가 분기', () => {
  it('create는 POST body에 데이터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 'sub1' }));
    await submissionApi.create({ problemId: 'p1', language: 'python', code: 'print()' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/submissions');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ problemId: 'p1', language: 'python', code: 'print()' });
  });

  it('findById는 GET /api/submissions/{id}로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 'sub1' }));
    await submissionApi.findById('sub1');
    expect(mockFetch.mock.calls[0][0]).toContain('/api/submissions/sub1');
  });

  it('list는 sagaStep 파라미터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
    await submissionApi.list({ sagaStep: 'DONE' });
    expect(mockFetch.mock.calls[0][0]).toContain('sagaStep=DONE');
  });

  it('list는 weekNumber 파라미터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
    await submissionApi.list({ weekNumber: 'W1' });
    expect(mockFetch.mock.calls[0][0]).toContain('weekNumber=W1');
  });

  it('list는 파라미터가 없으면 쿼리 스트링 없이 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
    await submissionApi.list({});
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).not.toContain('?');
  });

  it('getAnalysis는 GET /api/submissions/{id}/analysis로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ feedback: 'good', score: 90, optimizedCode: null, analysisStatus: 'completed' }));
    await submissionApi.getAnalysis('sub1');
    expect(mockFetch.mock.calls[0][0]).toContain('/api/submissions/sub1/analysis');
  });
});

// ── aiQuotaApi ──

describe('aiQuotaApi', () => {
  it('get은 GET /api/analysis/quota로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ used: 3, limit: 10, remaining: 7 }));
    const result = await aiQuotaApi.get();
    expect(mockFetch.mock.calls[0][0]).toContain('/api/analysis/quota');
    expect(result).toEqual({ used: 3, limit: 10, remaining: 7 });
  });
});

// ── draftApi 추가 분기 ──

describe('draftApi 추가 분기', () => {
  it('upsert는 POST body에 problemId와 데이터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 'd1', problemId: 'p1', language: 'python', code: 'pass', savedAt: '' }));
    await draftApi.upsert('p1', { language: 'python', code: 'pass' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/submissions/drafts');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ problemId: 'p1', language: 'python', code: 'pass' });
  });

  it('remove는 DELETE /api/submissions/drafts/{id}로 요청한다', async () => {
    mockFetch.mockReturnValue(noContentResponse());
    await draftApi.remove('p1');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/submissions/drafts/p1');
    expect(opts.method).toBe('DELETE');
  });

  it('find는 성공 시 Draft를 반환한다', async () => {
    const draft = { id: 'd1', problemId: 'p1', language: 'python', code: 'pass', savedAt: '' };
    mockFetch.mockReturnValue(jsonResponse(draft));
    const result = await draftApi.find('p1');
    expect(result).toEqual(draft);
  });
});

// ── solvedacApi ──

describe('solvedacApi', () => {
  it('search는 GET /api/external/solvedac/problem/{id}로 요청한다', async () => {
    const info = { problemId: 1000, title: 'A+B', difficulty: 'BRONZE', level: 1, sourceUrl: 'https://boj.kr/1000', tags: ['math'] };
    mockFetch.mockReturnValue(jsonResponse(info));
    const result = await solvedacApi.search(1000);
    expect(mockFetch.mock.calls[0][0]).toContain('/api/external/solvedac/problem/1000');
    expect(result).toEqual(info);
  });
});

// ── notificationApi 추가 분기 ──

describe('notificationApi 추가 분기', () => {
  it('list는 GET /api/notifications로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await notificationApi.list();
    expect(mockFetch.mock.calls[0][0]).toContain('/api/notifications');
  });

  it('unreadCount는 GET /api/notifications/unread-count로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ count: 3 }));
    const result = await notificationApi.unreadCount();
    expect(mockFetch.mock.calls[0][0]).toContain('/api/notifications/unread-count');
    expect(result).toEqual({ count: 3 });
  });

  it('markRead는 PATCH /api/notifications/{id}/read로 요청한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ message: 'read' }));
    await notificationApi.markRead('n1');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/notifications/n1/read');
    expect(opts.method).toBe('PATCH');
  });
});

// ── reviewApi 추가 분기 ──

describe('reviewApi 추가 분기', () => {
  it('updateComment는 PATCH body에 content를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ publicId: 'c1' }));
    await reviewApi.updateComment('c1', 'updated content');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/reviews/comments/c1');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ content: 'updated content' });
  });

  it('deleteComment는 DELETE /api/reviews/comments/{id}로 요청한다', async () => {
    mockFetch.mockReturnValue(noContentResponse());
    await reviewApi.deleteComment('c1');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/reviews/comments/c1');
    expect(opts.method).toBe('DELETE');
  });

  it('createReply는 POST body에 데이터를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ publicId: 'r1' }));
    await reviewApi.createReply({ commentPublicId: 'c1', content: 'reply' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/reviews/replies');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ commentPublicId: 'c1', content: 'reply' });
  });

  it('listReplies는 commentPublicId 쿼리를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await reviewApi.listReplies('c1');
    expect(mockFetch.mock.calls[0][0]).toContain('commentPublicId=c1');
  });
});

// ── submissionApi.getSatisfactionStats ──
describe('submissionApi.getSatisfactionStats', () => {
  it('GET /api/submissions/satisfaction/:submissionId/stats를 호출한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ up: 3, down: 1 }));
    const result = await submissionApi.getSatisfactionStats('sub-1');
    expect(mockFetch.mock.calls[0][0]).toContain('/api/submissions/satisfaction/sub-1/stats');
    expect(result).toEqual({ up: 3, down: 1 });
  });
});

// ── adminApi ──
describe('adminApi', () => {
  it('feedbacks는 category/search 쿼리를 포함한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ items: [], total: 0 }));
    await adminApi.feedbacks(1, 20, 'BUG', '검색어');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('category=BUG');
    expect(url).toContain('search=');
  });

  it('feedbackDetail은 GET /api/feedbacks/:publicId/detail을 호출한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ publicId: 'pub-1', screenshot: 'data:...' }));
    const result = await adminApi.feedbackDetail('pub-1');
    expect(mockFetch.mock.calls[0][0]).toContain('/api/feedbacks/pub-1/detail');
    expect(result).toHaveProperty('screenshot');
  });

  it('updateFeedbackStatus는 PATCH 요청을 보낸다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ publicId: 'pub-1', status: 'RESOLVED' }));
    await adminApi.updateFeedbackStatus('pub-1', 'RESOLVED');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/feedbacks/pub-1/status');
    expect(opts.method).toBe('PATCH');
  });
});
