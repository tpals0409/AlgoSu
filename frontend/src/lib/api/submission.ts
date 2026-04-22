/**
 * @file Submission API + Draft API + AI Quota API
 * @domain submission
 * @layer api
 * @related SubmissionService, SagaOrchestrator
 */

import { ApiError, fetchApi } from './client';
import type { Submission, PaginatedResponse, SubmissionListParams, AnalysisResult, Draft } from './types';

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

  getSatisfaction: (submissionId: string): Promise<{ rating: 1 | -1 } | null> =>
    fetchApi(`/api/submissions/satisfaction/${submissionId}`),

  rateSatisfaction: (submissionId: string, data: { rating: 1 | -1 }): Promise<void> =>
    fetchApi(`/api/submissions/satisfaction/${submissionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSatisfactionStats: (submissionId: string): Promise<{ up: number; down: number }> =>
    fetchApi(`/api/submissions/satisfaction/${submissionId}/stats`),
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
