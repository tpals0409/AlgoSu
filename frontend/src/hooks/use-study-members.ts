/**
 * @file 스터디 멤버 SWR 훅
 * @domain study
 * @layer hook
 * @related studyApi, cacheKeys
 */

import useSWR from 'swr';
import { cacheKeys } from '@/lib/swr';
import type { StudyMember } from '@/lib/api';

interface UseStudyMembersReturn {
  members: StudyMember[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * 스터디 멤버 목록을 SWR로 조회
 * @param studyId 스터디 ID (null이면 요청하지 않음)
 */
export function useStudyMembers(studyId: string | null): UseStudyMembersReturn {
  const { data, error, isLoading, mutate } = useSWR<StudyMember[]>(
    studyId ? cacheKeys.studies.members(studyId) : null,
  );

  return {
    members: data ?? [],
    isLoading,
    error: error ?? null,
    mutate: () => void mutate(),
  };
}
