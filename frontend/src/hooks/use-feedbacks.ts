/**
 * @file 관리자 피드백 목록 SWR 훅
 * @domain feedback
 * @layer hook
 * @related adminApi, cacheKeys, AdminFeedbacksPage
 */

import useSWR, { type MutatorOptions } from 'swr';
import { cacheKeys } from '@/lib/swr';
import type { AdminFeedback } from '@/lib/api';

interface UseFeedbacksParams {
  page: number;
  pageSize: number;
  category?: string;
  search?: string;
  status?: string;
}

interface FeedbacksResponse {
  items: AdminFeedback[];
  total: number;
  counts?: Record<string, number>;
}

/**
 * optimistic updater — 현재 응답을 받아 새 응답을 반환
 */
type FeedbacksUpdater = (
  current: FeedbacksResponse | undefined,
) => FeedbacksResponse | undefined;

interface UseFeedbacksReturn {
  feedbacks: AdminFeedback[];
  total: number;
  counts: Record<string, number>;
  isLoading: boolean;
  error: Error | null;
  /** 단순 재검증 또는 optimistic updater 전달 가능 */
  mutate: (
    updater?: FeedbacksUpdater,
    opts?: MutatorOptions<FeedbacksResponse>,
  ) => void;
}

/**
 * 페이지네이션·필터 파라미터를 URLSearchParams로 직렬화
 * @internal
 */
function buildFeedbackQuery(params: UseFeedbacksParams): URLSearchParams {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('limit', String(params.pageSize));
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  return query;
}

/**
 * 관리자 피드백 목록을 SWR로 조회
 * @param params page/pageSize 필수, category/search/status 선택
 */
export function useFeedbacks(params: UseFeedbacksParams): UseFeedbacksReturn {
  const query = buildFeedbackQuery(params);
  const { data, error, isLoading, mutate } = useSWR<FeedbacksResponse>(
    cacheKeys.feedbacks.list(query),
  );

  return {
    feedbacks: data?.items ?? [],
    total: data?.total ?? 0,
    counts: data?.counts ?? {},
    isLoading,
    error: error ?? null,
    mutate: (updater?: FeedbacksUpdater, opts?: MutatorOptions<FeedbacksResponse>) => {
      if (updater) {
        void mutate(updater, opts);
      } else {
        void mutate();
      }
    },
  };
}
