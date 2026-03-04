import { verifyStudyMembership, verifyAdminRole, verifyDeadlinePassed } from '@/lib/guards';
import { ApiError } from '@/lib/api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function errorResponse(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('verifyStudyMembership', () => {
  it('성공 시 true를 반환한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 's1', name: 'study' }));
    const result = await verifyStudyMembership('s1');
    expect(result).toBe(true);
  });

  it('403 에러 시 false를 반환한다', async () => {
    mockFetch.mockReturnValue(errorResponse(403));
    const result = await verifyStudyMembership('s1');
    expect(result).toBe(false);
  });

  it('404 에러 시 false를 반환한다', async () => {
    mockFetch.mockReturnValue(errorResponse(404));
    const result = await verifyStudyMembership('s1');
    expect(result).toBe(false);
  });

  it('500 에러 시 예외를 던진다', async () => {
    mockFetch.mockReturnValue(errorResponse(500));
    await expect(verifyStudyMembership('s1')).rejects.toThrow(ApiError);
  });
});

describe('verifyAdminRole', () => {
  it('ADMIN이면 true를 반환한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: { role: 'ADMIN' } }));
    const result = await verifyAdminRole('s1');
    expect(result).toBe(true);
  });

  it('MEMBER이면 false를 반환한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: { role: 'MEMBER' } }));
    const result = await verifyAdminRole('s1');
    expect(result).toBe(false);
  });

  it('403 에러 시 false를 반환한다', async () => {
    mockFetch.mockReturnValue(errorResponse(403));
    const result = await verifyAdminRole('s1');
    expect(result).toBe(false);
  });

  it('404 에러 시 false를 반환한다', async () => {
    mockFetch.mockReturnValue(errorResponse(404));
    const result = await verifyAdminRole('s1');
    expect(result).toBe(false);
  });

  it('500 에러 시 예외를 던진다', async () => {
    mockFetch.mockReturnValue(errorResponse(500));
    await expect(verifyAdminRole('s1')).rejects.toThrow(ApiError);
  });

  it('data.meta 없이 data만 있는 응답에서 role을 추출한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: { role: 'ADMIN' } }));
    const result = await verifyAdminRole('s1');
    expect(result).toBe(true);
  });

  it('중첩되지 않은 role 응답도 처리한다', async () => {
    mockFetch.mockReturnValue(jsonResponse({ role: 'MEMBER', id: 's1' }));
    const result = await verifyAdminRole('s1');
    expect(result).toBe(false);
  });
});

describe('verifyDeadlinePassed', () => {
  it('마감일이 지나면 true를 반환한다', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockFetch.mockReturnValue(jsonResponse({ data: { deadline: pastDate } }));
    const result = await verifyDeadlinePassed('s1', 'p1');
    expect(result).toBe(true);
  });

  it('마감일이 안 지나면 false를 반환한다', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    mockFetch.mockReturnValue(jsonResponse({ data: { deadline: futureDate } }));
    const result = await verifyDeadlinePassed('s1', 'p1');
    expect(result).toBe(false);
  });

  it('404 에러 시 false를 반환한다', async () => {
    mockFetch.mockReturnValue(errorResponse(404));
    const result = await verifyDeadlinePassed('s1', 'p1');
    expect(result).toBe(false);
  });

  it('500 에러 시 예외를 던진다', async () => {
    mockFetch.mockReturnValue(errorResponse(500));
    await expect(verifyDeadlinePassed('s1', 'p1')).rejects.toThrow(ApiError);
  });

  it('X-Study-ID 헤더를 포함하여 요청한다', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockFetch.mockReturnValue(jsonResponse({ data: { deadline: pastDate } }));
    await verifyDeadlinePassed('study-abc', 'p1');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-Study-ID']).toBe('study-abc');
  });
});
