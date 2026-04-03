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
// SSR 환경에서는 null, 클라이언트에서는 localStorage에서 즉시 복원하여 하이드레이션 레이스 방지
let _currentStudyId: string | null =
  typeof window !== 'undefined'
    ? localStorage.getItem('algosu:current-study-id')
    : null;

export function setCurrentStudyIdForApi(id: string | null): void {
  _currentStudyId = id;
}

// ── 타입 정의 ──

export interface Problem {
  id: string;
  title: string;
  difficulty: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'RUBY';
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
  userId?: string;
  problemId: string;
  problemTitle?: string;
  language: string;
  code?: string;
  sagaStep: 'DB_SAVED' | 'GITHUB_QUEUED' | 'AI_QUEUED' | 'DONE' | 'FAILED';
  aiScore?: number | null;
  isLate?: boolean;
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
  problemId?: string;
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
  groundRules?: string | null;
  avatar_url?: string;
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
  deleted_at?: string | null;
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

/** 스터디 미선택 상태에서 멤버십 필수 API를 호출했을 때 발생 */
export class StudyRequiredError extends Error {
  constructor(path: string) {
    super(`스터디를 선택해주세요. (요청 경로: ${path})`);
    this.name = 'StudyRequiredError';
  }
}

// ── 멤버십 필수 경로 판별 ──

const MEMBERSHIP_REQUIRED_PREFIXES = [
  '/api/problems',
  '/api/submissions',
  '/api/reviews',
  '/api/study-notes',
  '/api/analysis',
] as const;

function requiresMembership(path: string): boolean {
  return MEMBERSHIP_REQUIRED_PREFIXES.some((prefix) => path.startsWith(prefix));
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

  const studyId = _currentStudyId
    ?? (typeof window !== 'undefined' ? localStorage.getItem('algosu:current-study-id') : null);
  if (studyId) {
    headers['X-Study-ID'] = studyId;
  } else if (requiresMembership(path)) {
    throw new StudyRequiredError(path);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };

    // 403 데모 모드 쓰기 차단 — 에러 메시지 그대로 전달
    if (res.status === 403 && body.message?.includes('데모 모드')) {
      throw new ApiError(body.message, res.status);
    }

    // 401 세션 만료 시 로그인 페이지로 리다이렉트
    if (res.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/login') && !currentPath.startsWith('/callback') && currentPath !== '/') {
        window.location.href = '/login?error=session_expired';
      }
    }

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

  /** 데모 로그인 — 데모 계정으로 JWT 발급 */
  demoLogin: (): Promise<{ redirect: string }> =>
    fetchApi('/auth/demo', { method: 'POST' }),

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
  getProfile: (): Promise<{ id: string; email: string; name: string | null; avatar_url: string | null; oauth_provider: string | null; github_connected: boolean; github_username: string | null; created_at: string }> =>
    fetchApi('/auth/profile'),

  /** 프로필 수정 (아바타) */
  updateProfile: (data: { avatar_url?: string }): Promise<{ avatar_url: string | null }> =>
    fetchApi('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  /** 계정 삭제 (소프트 딜리트) */
  deleteAccount: (): Promise<{ message: string }> =>
    fetchApi('/auth/account', { method: 'DELETE' }),
};

// ── Study API ──

export interface MemberStat {
  userId: string;
  isMember: boolean;
  count: number;
  doneCount: number;
  uniqueProblemCount: number;
  uniqueDoneCount: number;
}

export interface MemberWeekStat {
  userId: string;
  isMember: boolean;
  count: number;
}

export interface StudyStats {
  totalSubmissions: number;
  uniqueSubmissions: number;
  uniqueAnalyzed: number;
  byWeek: { week: string; count: number }[];
  byWeekPerUser: { userId: string; week: string; count: number }[];
  byMember: MemberStat[];
  byMemberWeek: MemberWeekStat[] | null;
  recentSubmissions: Submission[];
  solvedProblemIds: string[];
  submitterCountByProblem: { problemId: string; count: number; analyzedCount: number }[];
}

export const studyApi = {
  list: (): Promise<Study[]> =>
    fetchApi('/api/studies'),

  create: (data: { name: string; description?: string; githubRepo?: string; nickname?: string; avatarUrl?: string }): Promise<Study> =>
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

  update: (studyId: string, data: { name?: string; description?: string; avatarUrl?: string }): Promise<Study> =>
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

  updateGroundRules: (studyId: string, groundRules: string): Promise<Study> =>
    fetchApi(`/api/studies/${studyId}/ground-rules`, {
      method: 'PATCH',
      body: JSON.stringify({ groundRules }),
    }),

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
    fetchApi('/api/problems/all'),

  /** 전체 문제 목록 (ACTIVE만) — 대시보드·스터디룸 통계용 */
  findAllProblems: (): Promise<Problem[]> =>
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
    if (params?.problemId) query.set('problemId', params.problemId);
    const qs = query.toString();
    return fetchApi(`/api/submissions${qs ? `?${qs}` : ''}`);
  },

  listByProblemForStudy: (problemId: string): Promise<Submission[]> =>
    fetchApi<Submission[]>(`/api/submissions/study-submissions/${problemId}`),

  getAnalysis: (submissionId: string): Promise<AnalysisResult> =>
    fetchApi(`/api/submissions/${submissionId}/analysis`),
};

// ── AI Quota API ──

export interface AiQuota {
  used: number;
  limit: number;
  remaining: number;
}

export const aiQuotaApi = {
  /** AI 일일 사용량 조회 (Gateway 프록시 경유, X-User-ID 자동 주입) */
  get: (): Promise<AiQuota> =>
    fetchApi('/api/analysis/quota'),
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
  publicId: string;
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

  createReply: (data: { commentPublicId: string; content: string }): Promise<ReviewReply> =>
    fetchApi('/api/reviews/replies', { method: 'POST', body: JSON.stringify(data) }),

  listReplies: (commentPublicId: string): Promise<ReviewReply[]> =>
    fetchApi(`/api/reviews/replies?commentPublicId=${encodeURIComponent(commentPublicId)}`),
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

// ── Public API (인증 불필요) ──

/** 공유 스터디 메타 정보 */
export interface SharedStudyData {
  studyName: string;
  memberCount: number;
  createdBy: { id: string; name: string | null; avatarUrl: string | null };
  members: Array<{ userId: string; nickname: string; role: string }>;
}

/** 퍼블릭 프로필 데이터 */
export interface PublicProfile {
  name: string | null;
  avatarUrl: string | null;
  studies: Array<{
    studyName: string;
    memberCount: number;
    shareLink: string | null;
    totalSubmissions: number;
    averageAiScore: number | null;
  }>;
  totalSubmissions: number;
  averageAiScore: number | null;
}

/** 인증 불필요 공개 API fetch */
async function fetchPublicApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(body.message ?? `서버 오류 (${res.status})`, res.status);
  }

  const json = await res.json();
  if (json !== null && typeof json === 'object' && 'data' in json && !('meta' in json)) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export const publicApi = {
  /** 공유 링크 스터디 정보 조회 */
  getSharedStudy: (token: string): Promise<SharedStudyData> =>
    fetchPublicApi(`/api/public/shared/${token}`),

  /** 공유 스터디 문제 목록 */
  getSharedProblems: (token: string): Promise<Problem[]> =>
    fetchPublicApi(`/api/public/shared/${token}/problems`),

  /** 공유 스터디 제출 목록 */
  getSharedSubmissions: (token: string): Promise<Submission[]> =>
    fetchPublicApi(`/api/public/shared/${token}/submissions`),

  /** 공유 AI 분석 결과 */
  getSharedAnalysis: (token: string, submissionId: string): Promise<AnalysisResult> =>
    fetchPublicApi(`/api/public/shared/${token}/analysis/${submissionId}`),

  /** 퍼블릭 프로필 조회 */
  getPublicProfile: (slug: string): Promise<PublicProfile> =>
    fetchPublicApi(`/api/public/profile/${slug}`),
};

// ── ShareLink 관리 API (인증 필수) ──

export interface ShareLinkData {
  id: string;
  token: string;
  study_id: string;
  created_by: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export const shareLinkApi = {
  /** 공유 링크 생성 */
  create: (studyId: string, data?: { expiresAt?: string }): Promise<ShareLinkData> =>
    fetchApi(`/api/studies/${studyId}/share-links`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  /** 스터디별 공유 링크 목록 */
  list: (studyId: string): Promise<ShareLinkData[]> =>
    fetchApi(`/api/studies/${studyId}/share-links`),

  /** 공유 링크 비활성화 */
  deactivate: (studyId: string, linkId: string): Promise<{ message: string }> =>
    fetchApi(`/api/studies/${studyId}/share-links/${linkId}`, { method: 'DELETE' }),
};

// ── Settings API (인증 필수) ──

export interface ProfileSettings {
  profileSlug: string | null;
  isProfilePublic: boolean;
}

export const settingsApi = {
  /** 프로필 설정 조회 */
  getProfile: (): Promise<ProfileSettings> =>
    fetchApi('/api/users/me/settings'),

  /** 프로필 설정 업데이트 */
  updateProfile: (data: { profileSlug?: string; isProfilePublic?: boolean }): Promise<ProfileSettings> =>
    fetchApi('/api/users/me/settings/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
