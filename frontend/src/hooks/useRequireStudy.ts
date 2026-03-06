/**
 * @file 스터디 필수 페이지 가드 Hook
 * @domain study
 * @layer hook
 * @related StudyContext, useRequireAuth
 *
 * 스터디가 없는 사용자를 /studies 페이지로 리다이렉트합니다.
 * useRequireAuth와 함께 사용하여 인증 + 스터디 가드를 동시에 적용합니다.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStudy } from '@/contexts/StudyContext';

export function useRequireStudy(): { isStudyReady: boolean } {
  const router = useRouter();
  const { studies, studiesLoaded, currentStudyId } = useStudy();

  const isValidStudy = currentStudyId !== null && studies.some((s) => s.id === currentStudyId);

  useEffect(() => {
    if (studiesLoaded && (studies.length === 0 || !isValidStudy)) {
      router.replace('/studies');
    }
  }, [studiesLoaded, studies, isValidStudy, router]);

  return { isStudyReady: studiesLoaded && studies.length > 0 && isValidStudy };
}
