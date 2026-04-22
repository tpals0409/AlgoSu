/**
 * @file Notification API
 * @domain notification
 * @layer api
 * @related NotificationBell, SSE
 */

import { fetchApi } from './client';

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
    | 'STUDY_CLOSED'
    | 'FEEDBACK_RESOLVED';
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
