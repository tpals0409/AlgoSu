/**
 * @file 공유 API 타입 정의 — 여러 도메인 API에서 참조하는 인터페이스
 * @domain common
 * @layer api
 */

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
  sourcePlatform?: 'BOJ' | 'PROGRAMMERS';
  allowedLanguages: string[];
  tags?: string[] | null;
  createdAt?: string;
}

export interface CreateProblemData {
  title: string;
  description?: string;
  weekNumber: string;
  difficulty?: Problem['difficulty'];
  level?: number;
  sourceUrl?: string;
  sourcePlatform?: 'BOJ' | 'PROGRAMMERS';
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
  sourcePlatform?: 'BOJ' | 'PROGRAMMERS';
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
