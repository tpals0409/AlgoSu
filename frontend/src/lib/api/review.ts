/**
 * @file Review API + Study Notes API
 * @domain review
 * @layer api
 * @related ReviewComment, StudyNoteEditor
 */

import { ApiError, fetchApi } from './client';

// ── Review ──

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

// ── Study Notes ──

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
