/**
 * @file 문제 목록 SWR 훅
 * @domain problem
 * @layer hook
 * @related problemApi, cacheKeys, ProblemsPage
 */

import useSWR from 'swr';
import { cacheKeys } from '@/lib/swr';
import type { Problem } from '@/lib/api';

interface UseProblemsReturn {
  problems: Problem[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * 문제 목록을 SWR로 조회
 * @param studyId 현재 스터디 ID (null이면 요청하지 않음)
 */
export function useProblems(studyId: string | null): UseProblemsReturn {
  const { data, error, isLoading, mutate } = useSWR<Problem[]>(
    studyId ? cacheKeys.problems.all() : null,
  );

  return {
    problems: data ?? [],
    isLoading,
    error: error ?? null,
    mutate: () => void mutate(),
  };
}
