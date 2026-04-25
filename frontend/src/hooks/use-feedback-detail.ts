/**
 * @file 관리자 피드백 상세 SWR 훅
 * @domain feedback
 * @layer hook
 * @related adminApi, cacheKeys, AdminFeedbacksPage
 */

import useSWR from 'swr';
import { cacheKeys } from '@/lib/swr';
import type { AdminFeedback } from '@/lib/api';

/** optimistic updater — 현재 상세를 받아 새 상세를 반환 */
type DetailUpdater = (
  current: AdminFeedback | undefined,
) => AdminFeedback | undefined;

interface UseFeedbackDetailReturn {
  detail: AdminFeedback | null;
  isLoading: boolean;
  error: Error | null;
  /** 단순 재검증 또는 optimistic updater 전달 가능 */
  mutate: (updater?: DetailUpdater, opts?: { revalidate?: boolean }) => void;
}

/**
 * 피드백 상세를 SWR로 조회 (publicId가 null이면 fetch skip — 모달 닫힘 상태)
 * @param publicId 피드백 식별자 (null이면 요청하지 않음)
 */
export function useFeedbackDetail(publicId: string | null): UseFeedbackDetailReturn {
  const { data, error, isLoading, mutate } = useSWR<AdminFeedback>(
    publicId ? cacheKeys.feedbacks.detail(publicId) : null,
  );

  return {
    detail: data ?? null,
    isLoading,
    error: error ?? null,
    mutate: (updater?: DetailUpdater, opts?: { revalidate?: boolean }) => {
      if (updater) {
        void mutate(updater, opts);
      } else {
        void mutate();
      }
    },
  };
}
