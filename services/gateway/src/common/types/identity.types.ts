/**
 * @file Identity 도메인 타입 정의 — Identity 서비스 응답 타입
 * @domain common
 * @layer type
 */

export enum OAuthProvider {
  GOOGLE = 'google',
  NAVER = 'naver',
  KAKAO = 'kakao',
}

export enum StudyMemberRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum StudyStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

export enum NotificationType {
  SUBMISSION_STATUS = 'SUBMISSION_STATUS',
  AI_COMPLETED = 'AI_COMPLETED',
  GITHUB_FAILED = 'GITHUB_FAILED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  PROBLEM_CREATED = 'PROBLEM_CREATED',
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_LEFT = 'MEMBER_LEFT',
  STUDY_CLOSED = 'STUDY_CLOSED',
  FEEDBACK_RESOLVED = 'FEEDBACK_RESOLVED',
}

// Identity 서비스 응답 타입 (인터페이스)
export interface IdentityUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  oauth_provider: OAuthProvider;
  github_connected: boolean;
  github_user_id: string | null;
  github_username: string | null;
  github_token: string | null;
  publicId: string;
  profile_slug: string | null;
  is_profile_public: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdentityStudy {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  github_repo: string | null;
  status: StudyStatus;
  groundRules: string | null;
  avatar_url: string;
  publicId: string;
  created_at: string;
  updated_at: string;
}

export interface IdentityStudyMember {
  id: string;
  study_id: string;
  user_id: string;
  role: StudyMemberRole;
  nickname: string;
  joined_at: string;
}

export interface IdentityNotification {
  id: string;
  userId: string;
  studyId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  publicId: string;
  createdAt: string;
}
