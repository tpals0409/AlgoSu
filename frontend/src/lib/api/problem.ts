/**
 * @file Problem API
 * @domain problem
 * @layer api
 * @related ProblemService
 */

import { fetchApi } from './client';
import type {
  Problem,
  CreateProblemData,
  UpdateProblemData,
  RecommendationItem,
} from './types';

/** 추천 난이도 선택 허용값 — 백엔드 Difficulty enum과 대응 (Sprint 256) */
export type RecommendationDifficulty = NonNullable<Problem['difficulty']>;

/** tags 필터용 쿼리스트링 빌더 — 반복 ?tags=a&tags=b 패턴 (NestJS @Query 배열 파싱 관례) */
function buildTagsQuery(tags: string[]): URLSearchParams {
  const query = new URLSearchParams();
  tags.forEach((tag) => query.append('tags', tag));
  return query;
}

/**
 * 추천 조회용 쿼리스트링 빌더.
 *
 * `exclude`는 sourceUrl 반복 파라미터(`?exclude=a&exclude=b`)로 직렬화한다
 * — {@link buildTagsQuery}와 동일한 NestJS 배열 파싱 관례.
 */
function buildRecommendationQuery(params?: {
  limit?: number;
  exclude?: string[];
  platform?: 'BOJ' | 'PROGRAMMERS';
  difficulty?: RecommendationDifficulty;
}): URLSearchParams {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set('limit', String(params.limit));
  params?.exclude?.forEach((url) => query.append('exclude', url));
  if (params?.platform) query.set('platform', params.platform);
  if (params?.difficulty) query.set('difficulty', params.difficulty);
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

  /**
   * 추천 문제 묶음 조회.
   * @param params.limit 요청할 후보 개수 (기본: 서버 결정)
   * @param params.exclude 이미 노출한 sourceUrl 목록 — 중복 추천 방지
   * @param params.platform 플랫폼 토글(PROGRAMMERS/BOJ) — 지정 시 해당 플랫폼만 추천
   * @param params.difficulty 난이도 선택 — 지정 시 해당 난이도만 추천 (Sprint 256)
   */
  getRecommendations: (params?: {
    limit?: number;
    exclude?: string[];
    platform?: 'BOJ' | 'PROGRAMMERS';
    difficulty?: RecommendationDifficulty;
  }): Promise<RecommendationItem[]> => {
    const query = buildRecommendationQuery(params).toString();
    return fetchApi(`/api/problems/recommendations${query ? `?${query}` : ''}`);
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
