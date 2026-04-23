/**
 * @file Public API (인증 불필요)
 * @domain public
 * @layer api
 * @related SharedStudyPage, PublicProfilePage
 */

import { fetchPublicApi } from './client';
import type { Problem, Submission, AnalysisResult } from './types';

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
