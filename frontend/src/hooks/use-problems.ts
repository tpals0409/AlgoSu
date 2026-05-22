/**
 * @file 문제 목록 SWR 훅
 * @domain problem
 * @layer hook
 * @related problemApi, cacheKeys, ProblemsPage
 */

import useSWR from 'swr';
import { cacheKeys } from '@/lib/swr';
import type { Problem } from '@/lib/api';

/** useProblems 옵션 파라미터 */
export interface ProblemListParams {
  /** 서버사이드 태그 필터 — 비어있으면 `/api/problems/all` 경로 유지 */
  tags?: string[];
}

interface UseProblemsReturn {
  problems: Problem[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * tags 배열을 URLSearchParams로 직렬화 (반복 ?tags=a&tags=b 패턴)
 * @returns 태그가 없으면 undefined — 기존 `/api/problems/all` 경로 유지 보장
 */
function buildTagsParams(tags?: string[]): URLSearchParams | undefined {
  if (!tags || tags.length === 0) return undefined;
  const query = new URLSearchParams();
  tags.forEach((tag) => query.append('tags', tag));
  return query;
}

/**
 * 문제 목록을 SWR로 조회
 * @param studyId 현재 스터디 ID (null이면 요청하지 않음)
 * @param params.tags 서버사이드 태그 필터 (OR 기본) — 빈 배열이면 전체 조회
 */
export function useProblems(
  studyId: string | null,
  params?: ProblemListParams,
): UseProblemsReturn {
  const tagParams = buildTagsParams(params?.tags);
  const cacheKey = cacheKeys.problems.all(tagParams);

  const { data, error, isLoading, mutate } = useSWR<Problem[]>(
    studyId ? [cacheKey, studyId] : null,
  );

  return {
    problems: data ?? [],
    isLoading,
    error: error ?? null,
    mutate: () => void mutate(),
  };
}
