/**
 * @file Problem API
 * @domain problem
 * @layer api
 * @related ProblemService
 */

import { fetchApi } from './client';
import type { Problem, CreateProblemData, UpdateProblemData } from './types';

/** tags 필터용 쿼리스트링 빌더 — 반복 ?tags=a&tags=b 패턴 (NestJS @Query 배열 파싱 관례) */
function buildTagsQuery(tags: string[]): URLSearchParams {
  const query = new URLSearchParams();
  tags.forEach((tag) => query.append('tags', tag));
  return query;
}

export const problemApi = {
  /**
   * 문제 목록 조회
   * @param params.tags 태그 배열 — 지정 시 서버사이드 OR 필터 (`/search/tags`)
   */
  findAll: (params?: { tags?: string[] }): Promise<Problem[]> => {
    const tags = params?.tags;
    if (tags && tags.length > 0) {
      return fetchApi(`/api/problems/search/tags?${buildTagsQuery(tags).toString()}`);
    }
    return fetchApi('/api/problems/all');
  },

  findById: (id: string): Promise<Problem> =>
    fetchApi(`/api/problems/${id}`),

  create: (data: CreateProblemData): Promise<Problem> =>
    fetchApi('/api/problems', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: UpdateProblemData): Promise<Problem> =>
    fetchApi(`/api/problems/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string): Promise<void> =>
    fetchApi(`/api/problems/${id}`, { method: 'DELETE' }),
};
