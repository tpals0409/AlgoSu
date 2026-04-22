/**
 * @file Feedback API + Admin API
 * @domain feedback
 * @layer api
 * @related FeedbackForm, AdminFeedbackPage
 */

import { fetchApi } from './client';

export const feedbackApi = {
  create: (data: {
    category: string;
    content: string;
    studyId?: string;
    pageUrl?: string;
    browserInfo?: string;
    screenshot?: string;
  }): Promise<{ publicId: string }> =>
    fetchApi('/api/feedbacks', { method: 'POST', body: JSON.stringify(data) }),

  mine: (): Promise<
    Array<{
      publicId: string;
      category: string;
      content: string;
      status: string;
      createdAt: string;
    }>
  > => fetchApi('/api/feedbacks/mine'),
};

// ── Admin API ──

export interface AdminFeedback {
  publicId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  studyId: string | null;
  studyName: string | null;
  category: string;
  content: string;
  pageUrl: string | null;
  browserInfo: string | null;
  screenshot: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export const adminApi = {
  feedbacks: (
    page?: number,
    limit?: number,
    category?: string,
    search?: string,
    status?: string,
  ): Promise<{ items: AdminFeedback[]; total: number; counts: Record<string, number> }> => {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const qs = params.toString();
    return fetchApi(`/api/feedbacks${qs ? `?${qs}` : ''}`);
  },

  feedbackDetail: (publicId: string): Promise<AdminFeedback> =>
    fetchApi(`/api/feedbacks/${publicId}/detail`),

  updateFeedbackStatus: (publicId: string, status: string): Promise<AdminFeedback> =>
    fetchApi(`/api/feedbacks/${publicId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
