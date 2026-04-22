/**
 * @file Study API + ShareLink API
 * @domain study
 * @layer api
 * @related StudyContext, GatewayStudyGuard
 */

import { fetchApi } from './client';
import type { Study, StudyMember, Submission } from './types';

// ── Study 전용 타입 ──

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
  userSubmissions: { problemId: string; aiScore: number | null; createdAt: string }[];
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
