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
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT';
  deadline: string; // ISO 날짜
  description: string;
  weekNumber: number;
  sourceUrl?: string;
  sourcePlatform?: string;
  allowedLanguages: string[];
}

export interface CreateProblemData {
  title: string;
  description?: string;
  weekNumber: number;
  difficulty?: Problem['difficulty'];
  sourceUrl?: string;
  sourcePlatform?: string;
  deadline?: string;
  allowedLanguages?: string[];
}

export interface UpdateProblemData {
  title?: string;
  description?: string;
  weekNumber?: number;
  difficulty?: Problem['difficulty'];
  sourceUrl?: string;
  sourcePlatform?: string;
  deadline?: string;
  allowedLanguages?: string[];
  status?: Problem['status'];
}

export interface Submission {
  id: string;
  problemId: string;
  problemTitle?: string;
  language: string;
  sagaStep: 'DB_SAVED' | 'GITHUB_QUEUED' | 'AI_QUEUED' | 'DONE' | 'FAILED';
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SubmissionListParams {
  page?: number;
  limit?: number;
  language?: string;
  sagaStep?: string;
  weekNumber?: number;
}

export interface AnalysisResult {
  feedback: string | null;
  score: number | null;
  optimizedCode: string | null;
  analysisStatus: 'pending' | 'completed' | 'delayed' | 'failed';
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
  role: 'ADMIN' | 'MEMBER';
  memberCount?: number;
}

export interface StudyMember {
  id: string;
  study_id: string;
  user_id: string;
  role: 'ADMIN' | 'MEMBER';
  joined_at: string;
  username?: string;
  email?: string;
}

export interface OAuthUrlResponse {
  url: string;
}

// ── API 에러 ──

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: '잘못된 요청입니다.',
  401: '로그인이 필요합니다.',
  403: '접근 권한이 없습니다.',
  404: '요청한 리소스를 찾을 수 없습니다.',
  409: '이미 존재하는 데이터입니다.',
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  502: '서버에 연결할 수 없습니다.',
  503: '서비스가 일시적으로 이용 불가합니다.',
};

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
    throw new ApiError(body.message ?? HTTP_ERROR_MESSAGES[res.status] ?? `서버 오류 (${res.status})`, res.status);
  }

  const json = await res.json();
  // { data: ... } 래퍼 자동 언래핑 — meta가 함께 있으면 페이지네이션 응답이므로 유지
  if (json !== null && typeof json === 'object' && 'data' in json && !('meta' in json)) {
    return (json as { data: T }).data;
  }
  return json as T;
}

// ── Auth API ──

export const authApi = {
  // C1: email/password register/login 제거 (소셜로그인 전용 정책)

  /** OAuth 로그인 URL 조회 — provider: google | naver | kakao */
  getOAuthUrl: (provider: 'google' | 'naver' | 'kakao'): Promise<OAuthUrlResponse> =>
    fetchApi(`/auth/oauth/${provider}`),

  /** GitHub 계정 연동 URL 조회 */
  linkGitHub: (): Promise<OAuthUrlResponse> =>
    fetchApi('/auth/github/link', { method: 'POST' }),

  /** GitHub 연동 해제 */
  unlinkGitHub: (): Promise<{ message: string }> =>
    fetchApi('/auth/github/link', { method: 'DELETE' }),

  /** GitHub 재연동 URL 조회 */
  relinkGitHub: (): Promise<OAuthUrlResponse> =>
    fetchApi('/auth/github/relink', { method: 'POST' }),

  /** 액세스 토큰 갱신 */
  refresh: (): Promise<AuthResponse> =>
    fetchApi('/auth/refresh', { method: 'POST' }),
};

// ── Study API ──

export interface StudyStats {
  totalSubmissions: number;
  byWeek: { week: number; count: number }[];
  byMember: { userId: string; isMember: boolean; count: number; doneCount: number }[];
  recentSubmissions: Submission[];
}

export const studyApi = {
  list: (): Promise<Study[]> =>
    fetchApi('/api/studies'),

  create: (data: { name: string; description?: string; githubRepo?: string }): Promise<Study> =>
    fetchApi('/api/studies', { method: 'POST', body: JSON.stringify(data) }),

  join: (code: string): Promise<Study> =>
    fetchApi('/api/studies/join', { method: 'POST', body: JSON.stringify({ code }) }),

  getStats: (studyId: string): Promise<StudyStats> =>
    fetchApi(`/api/studies/${studyId}/stats`),

  getById: (studyId: string): Promise<Study> =>
    fetchApi(`/api/studies/${studyId}`),

  update: (studyId: string, data: { name?: string; description?: string }): Promise<Study> =>
    fetchApi(`/api/studies/${studyId}`, { method: 'PUT', body: JSON.stringify(data) }),

  getMembers: (studyId: string): Promise<StudyMember[]> =>
    fetchApi(`/api/studies/${studyId}/members`),

  invite: (studyId: string): Promise<{ code: string; expires_at: string }> =>
    fetchApi(`/api/studies/${studyId}/invite`, { method: 'POST' }),

  changeRole: (studyId: string, userId: string, role: 'ADMIN' | 'MEMBER'): Promise<{ message: string }> =>
    fetchApi(`/api/studies/${studyId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeMember: (studyId: string, userId: string): Promise<{ message: string }> =>
    fetchApi(`/api/studies/${studyId}/members/${userId}`, { method: 'DELETE' }),

  delete: (studyId: string): Promise<void> =>
    fetchApi(`/api/studies/${studyId}`, { method: 'DELETE' }),
};

// ── Problem API ──

export const problemApi = {
  findAll: (): Promise<Problem[]> =>
    fetchApi('/api/problems/active'),

  findById: (id: string): Promise<Problem> =>
    fetchApi(`/api/problems/${id}`),

  create: (data: CreateProblemData): Promise<Problem> =>
    fetchApi('/api/problems', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: UpdateProblemData): Promise<Problem> =>
    fetchApi(`/api/problems/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string): Promise<void> =>
    fetchApi(`/api/problems/${id}`, { method: 'DELETE' }),
};

// ── Submission API ──

export const submissionApi = {
  create: (data: { problemId: string; language: string; code: string }): Promise<Submission> =>
    fetchApi('/api/submissions', { method: 'POST', body: JSON.stringify(data) }),

  findById: (id: string): Promise<Submission> =>
    fetchApi(`/api/submissions/${id}`),

  list: (params?: SubmissionListParams): Promise<PaginatedResponse<Submission>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.language) query.set('language', params.language);
    if (params?.sagaStep) query.set('sagaStep', params.sagaStep);
    if (params?.weekNumber) query.set('weekNumber', String(params.weekNumber));
    const qs = query.toString();
    return fetchApi(`/api/submissions${qs ? `?${qs}` : ''}`);
  },

  getAnalysis: (submissionId: string): Promise<AnalysisResult> =>
    fetchApi(`/api/submissions/${submissionId}/analysis`),
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

// ── Notification API ──

export interface Notification {
  id: string;
  userId: string;
  type: 'SUBMISSION_STATUS' | 'GITHUB_FAILED' | 'AI_COMPLETED' | 'ROLE_CHANGED';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const notificationApi = {
  list: (): Promise<Notification[]> =>
    fetchApi('/api/notifications'),

  unreadCount: (): Promise<{ count: number }> =>
    fetchApi('/api/notifications/unread-count'),

  markRead: (id: string): Promise<{ message: string }> =>
    fetchApi(`/api/notifications/${id}/read`, { method: 'PATCH' }),
};
