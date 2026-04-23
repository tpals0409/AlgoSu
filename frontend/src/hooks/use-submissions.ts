/**
 * @file 제출 목록 SWR 훅
 * @domain submission
 * @layer hook
 * @related submissionApi, cacheKeys
 */

import useSWR from 'swr';
import { cacheKeys } from '@/lib/swr';
import type { PaginatedResponse, Submission } from '@/lib/api';

interface UseSubmissionsReturn {
  submissions: Submission[];
  meta: PaginatedResponse<Submission>['meta'] | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * 제출 목록을 SWR로 조회
 * @param studyId 현재 스터디 ID (null이면 요청하지 않음)
 * @param params 페이지네이션 파라미터
 */
export function useSubmissions(
  studyId: string | null,
  params?: { page?: number; limit?: number },
): UseSubmissionsReturn {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Submission>>(
    studyId ? [cacheKeys.submissions.list(query), studyId] : null,
  );

  return {
    submissions: data?.data ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error ?? null,
    mutate: () => void mutate(),
  };
}
