/**
 * @file AlgoSu API 클라이언트
 * @domain common
 * @layer api
 * @related AuthContext, JwtMiddleware
 *
 * Gateway를 통한 모든 API 호출.
 * httpOnly Cookie 인증: credentials: 'include' 필수.
 * Authorization 헤더 수동 설정 불필요.
 */

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_BASE_URL']
    ? process.env['NEXT_PUBLIC_API_BASE_URL']
    : '';

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
  level?: number | null;
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT';
  deadline: string; // ISO 날짜
  description: string;
  weekNumber: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  allowedLanguages: string[];
  tags?: string[] | null;
}

export interface CreateProblemData {
  title: string;
  description?: string;
  weekNumber: string;
  difficulty?: Problem['difficulty'];
  level?: number;
  sourceUrl?: string;
  sourcePlatform?: string;
  deadline?: string;
  allowedLanguages?: string[];
  tags?: string[];
}

export interface UpdateProblemData {
  title?: string;
  description?: string;
  weekNumber?: string;
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
  aiScore?: number | null;
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
  weekNumber?: string;
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
  nickname?: string;
  username?: string;
  email?: string;
  avatar_url?: string | null;
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

/**
 * API 요청 래퍼 — httpOnly Cookie 인증 (credentials: 'include')
 */
async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (_currentStudyId) {
    headers['X-Study-ID'] = _currentStudyId;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
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

  /** 프로필 조회 */
  getProfile: (): Promise<{ email: string; name: string | null; avatar_url: string | null; oauth_provider: string | null }> =>
    fetchApi('/auth/profile'),

  /** 프로필 수정 (닉네임 / 아바타) */
  updateProfile: (data: { name?: string; avatar_url?: string }): Promise<{ name: string; avatar_url: string | null }> =>
    fetchApi('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── Study API ──

export interface MemberStat {
  userId: string;
  isMember: boolean;
  count: number;
  doneCount: number;
}

export interface MemberWeekStat {
  userId: string;
  isMember: boolean;
  count: number;
}

export interface StudyStats {
  totalSubmissions: number;
  byWeek: { week: string; count: number }[];
  byWeekPerUser: { userId: string; week: string; count: number }[];
  byMember: MemberStat[];
  byMemberWeek: MemberWeekStat[] | null;
  recentSubmissions: Submission[];
  solvedProblemIds: string[];
}

export const studyApi = {
  list: (): Promise<Study[]> =>
    fetchApi('/api/studies'),

  create: (data: { name: string; description?: string; githubRepo?: string; nickname?: string }): Promise<Study> =>
    fetchApi('/api/studies', { method: 'POST', body: JSON.stringify(data) }),

  verifyInvite: (code: string): Promise<{ valid: boolean; studyName: string }> =>
    fetchApi('/api/studies/verify-invite', { method: 'POST', body: JSON.stringify({ code }) }),

  join: (code: string, nickname: string): Promise<Study> =>
    fetchApi('/api/studies/join', { method: 'POST', body: JSON.stringify({ code, nickname }) }),

  getStats: (studyId: string, weekNumber?: string): Promise<StudyStats> => {
    const qs = weekNumber ? `?weekNumber=${encodeURIComponent(weekNumber)}` : '';
    return fetchApi(`/api/studies/${studyId}/stats${qs}`);
  },

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

  updateNickname: (studyId: string, nickname: string): Promise<{ nickname: string }> =>
    fetchApi(`/api/studies/${studyId}/nickname`, {
      method: 'PATCH',
      body: JSON.stringify({ nickname }),
    }),

  notifyProblemCreated: (
    studyId: string,
    data: { problemId: string; problemTitle: string; weekNumber: string },
  ): Promise<{ message: string }> =>
    fetchApi(`/api/studies/${studyId}/notify-problem`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Problem API ──

export const problemApi = {
  findAll: (): Promise<Problem[]> =>
    fetchApi('/api/problems/active'),

  /** 전체 문제 목록 (CLOSED 포함) — 대시보드 통계용 */
  findAllIncludingClosed: (): Promise<Problem[]> =>
    fetchApi('/api/problems/all'),

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
    if (params?.weekNumber) query.set('weekNumber', params.weekNumber);
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

// ── Solved.ac API ──

export interface SolvedacProblemInfo {
  problemId: number;
  title: string;
  difficulty: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | null;
  level: number;
  sourceUrl: string;
  tags: string[];
}

export const solvedacApi = {
  search: (problemId: number): Promise<SolvedacProblemInfo> =>
    fetchApi(`/api/external/solvedac/problem/${problemId}`),
};

// ── Notification API ──

export interface Notification {
  id: string;
  userId: string;
  type:
    | 'SUBMISSION_STATUS'
    | 'AI_COMPLETED'
    | 'GITHUB_FAILED'
    | 'ROLE_CHANGED'
    | 'PROBLEM_CREATED'
    | 'DEADLINE_REMINDER'
    | 'MEMBER_JOINED'
    | 'MEMBER_LEFT'
    | 'STUDY_CLOSED';
  title: string;
  message: string;
  link: string | null;
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

  markAllRead: (): Promise<{ message: string }> =>
    fetchApi('/api/notifications/read-all', { method: 'PATCH' }),
};

// ── Review API ──

export interface ReviewComment {
  id: number;
  publicId: string;
  submissionId: string;
  authorId: string;
  studyId: string;
  lineNumber: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  replies?: ReviewReply[];
}

export interface ReviewReply {
  id: number;
  publicId: string;
  commentId: number;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const reviewApi = {
  createComment: (data: {
    submissionId: string;
    lineNumber?: number | null;
    content: string;
  }): Promise<ReviewComment> =>
    fetchApi('/api/reviews/comments', { method: 'POST', body: JSON.stringify(data) }),

  listComments: (submissionId: string): Promise<ReviewComment[]> =>
    fetchApi(`/api/reviews/comments?submissionId=${encodeURIComponent(submissionId)}`),

  updateComment: (id: string, content: string): Promise<ReviewComment> =>
    fetchApi(`/api/reviews/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  deleteComment: (id: string): Promise<void> =>
    fetchApi(`/api/reviews/comments/${id}`, { method: 'DELETE' }),

  createReply: (data: { commentId: number; content: string }): Promise<ReviewReply> =>
    fetchApi('/api/reviews/replies', { method: 'POST', body: JSON.stringify(data) }),

  listReplies: (commentId: number): Promise<ReviewReply[]> =>
    fetchApi(`/api/reviews/replies?commentId=${commentId}`),
};

// ── Study Notes API ──

export interface StudyNote {
  id: number;
  publicId: string;
  problemId: string;
  studyId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const studyNoteApi = {
  upsert: (data: { problemId: string; content: string }): Promise<StudyNote> =>
    fetchApi('/api/study-notes', { method: 'PUT', body: JSON.stringify(data) }),

  get: (problemId: string): Promise<StudyNote | null> =>
    fetchApi<StudyNote>(`/api/study-notes?problemId=${encodeURIComponent(problemId)}`).catch(
      (err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      },
    ),
};
