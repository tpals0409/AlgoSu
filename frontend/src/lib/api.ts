/**
 * AlgoSu API 클라이언트
 *
 * Gateway(localhost:3000)를 통한 모든 API 호출
 * Bearer JWT 자동 첨부, X-Study-ID 자동 첨부, 에러 처리 포함
 */

import { TOKEN_KEY } from '@/lib/auth';

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_BASE_URL']
    ? process.env['NEXT_PUBLIC_API_BASE_URL']
    : 'http://localhost:3000';

// ── 모듈 레벨 현재 스터디 ID (StudyContext에서 설정) ──

let _currentStudyId: string | null = null;

export function setCurrentStudyIdForApi(id: string | null): void {
  _currentStudyId = id;
}

// ── 타입 정의 ──

export interface Problem {
  id: string;
  title: string;
  difficulty: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
  status: 'ACTIVE' | 'CLOSED';
  deadline: string; // ISO 날짜
  description: string;
  allowedLanguages: string[];
}

export interface Submission {
  id: string;
  problemId: string;
  language: string;
  sagaStep: 'DB_SAVED' | 'GITHUB_QUEUED' | 'AI_QUEUED' | 'DONE' | 'FAILED';
  createdAt: string;
}

export interface Draft {
  id: string;
  problemId: string;
  language: string;
  code: string;
  savedAt: string;
}

export interface AuthResponse {
  access_token: string;
  github_connected?: boolean;
}

export interface Study {
  id: string;
  name: string;
  description?: string;
  githubRepo?: string;
  role: 'OWNER' | 'MEMBER';
  memberCount?: number;
}

export interface OAuthUrlResponse {
  url: string;
}

// ── API 에러 ──

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── fetch 래퍼 ──

async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (_currentStudyId) {
    headers['X-Study-ID'] = _currentStudyId;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(body.message ?? `API Error: ${res.status}`, res.status);
  }

  const json = await res.json();
  // { data: ... } 래퍼 자동 언래핑
  return (json !== null && typeof json === 'object' && 'data' in json
    ? (json as { data: T }).data
    : json) as T;
}

// ── Auth API ──

export const authApi = {
  register: (data: { email: string; password: string; username: string }): Promise<AuthResponse> =>
    fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }): Promise<AuthResponse> =>
    fetchApi('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  /** OAuth 로그인 URL 조회 — provider: google | naver | kakao */
  getOAuthUrl: (provider: 'google' | 'naver' | 'kakao'): Promise<OAuthUrlResponse> =>
    fetchApi(`/auth/oauth/${provider}`),

  /** GitHub 계정 연동 URL 조회 */
  linkGitHub: (): Promise<OAuthUrlResponse> =>
    fetchApi('/auth/github/link', { method: 'POST' }),

  /** 액세스 토큰 갱신 */
  refresh: (): Promise<AuthResponse> =>
    fetchApi('/auth/refresh', { method: 'POST' }),
};

// ── Study API ──

export const studyApi = {
  list: (): Promise<Study[]> =>
    fetchApi('/api/studies'),

  create: (data: { name: string; description?: string; githubRepo?: string }): Promise<Study> =>
    fetchApi('/api/studies', { method: 'POST', body: JSON.stringify(data) }),

  join: (code: string): Promise<Study> =>
    fetchApi('/api/studies/join', { method: 'POST', body: JSON.stringify({ code }) }),
};

// ── Problem API ──

export const problemApi = {
  findAll: (): Promise<Problem[]> =>
    fetchApi('/api/problems/active'),

  findById: (id: string): Promise<Problem> =>
    fetchApi(`/api/problems/${id}`),
};

// ── Submission API ──

export const submissionApi = {
  create: (data: { problemId: string; language: string; code: string }): Promise<Submission> =>
    fetchApi('/api/submissions', { method: 'POST', body: JSON.stringify(data) }),

  findById: (id: string): Promise<Submission> =>
    fetchApi(`/api/submissions/${id}`),
};

// ── Draft API ──

export const draftApi = {
  upsert: (problemId: string, data: { language: string; code: string }): Promise<Draft> =>
    fetchApi('/api/submissions/drafts', {
      method: 'POST',
      body: JSON.stringify({ problemId, ...data }),
    }),

  find: (problemId: string): Promise<Draft | null> =>
    fetchApi<Draft>(`/api/submissions/drafts/${problemId}`).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }),

  remove: (problemId: string): Promise<void> =>
    fetchApi(`/api/submissions/drafts/${problemId}`, { method: 'DELETE' }),
};
