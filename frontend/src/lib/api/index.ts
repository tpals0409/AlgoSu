/**
 * @file API 모듈 barrel export — 기존 `@/lib/api` import 호환 유지
 * @domain common
 * @layer api
 */

// ── 인프라 ──
export { fetchApi, fetchPublicApi, ApiError, StudyRequiredError, setCurrentStudyIdForApi } from './client';

// ── 공유 타입 ──
export type {
  Problem,
  CreateProblemData,
  UpdateProblemData,
  Submission,
  PaginatedResponse,
  SubmissionListParams,
  AnalysisResult,
  Draft,
  AuthResponse,
  Study,
  StudyMember,
  OAuthUrlResponse,
} from './types';

// ── 도메인 API ──
export { authApi } from './auth';
export { settingsApi } from './auth';
export type { ProfileSettings } from './auth';

export { studyApi, shareLinkApi } from './study';
export type { MemberStat, MemberWeekStat, StudyStats, ShareLinkData } from './study';

export { problemApi } from './problem';

export { submissionApi, draftApi, aiQuotaApi } from './submission';
export type { AiQuota } from './submission';

export { solvedacApi, programmersApi } from './external';
export type {
  SolvedacProblemInfo,
  SolvedacSearchItem,
  SolvedacSearchResult,
  ProgrammersProblemInfo,
  ProgrammersSearchItem,
  ProgrammersSearchResult,
} from './external';

export { notificationApi } from './notification';
export type { Notification } from './notification';

export { reviewApi, studyNoteApi } from './review';
export type { ReviewComment, ReviewReply, StudyNote } from './review';

export { publicApi } from './public';
export type { SharedStudyData, PublicProfile } from './public';

export { feedbackApi, adminApi } from './feedback';
export type { AdminFeedback } from './feedback';
