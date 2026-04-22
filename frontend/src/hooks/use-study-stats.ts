/**
 * @file 스터디 통계 SWR 훅
 * @domain study
 * @layer hook
 * @related studyApi, cacheKeys
 */

import useSWR from 'swr';
import { cacheKeys } from '@/lib/swr';
import type { StudyStats } from '@/lib/api';

interface UseStudyStatsReturn {
  stats: StudyStats | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * 스터디 통계를 SWR로 조회
 * @param studyId 스터디 ID (null이면 요청하지 않음)
 * @param weekNumber 주차 필터 (선택)
 */
export function useStudyStats(
  studyId: string | null,
  weekNumber?: string,
): UseStudyStatsReturn {
  const { data, error, isLoading, mutate } = useSWR<StudyStats>(
    studyId ? cacheKeys.studies.stats(studyId, weekNumber) : null,
  );

  return {
    stats: data ?? null,
    isLoading,
    error: error ?? null,
    mutate: () => void mutate(),
  };
}
