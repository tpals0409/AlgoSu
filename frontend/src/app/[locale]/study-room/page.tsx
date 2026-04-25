/**
 * @file 스터디룸 리다이렉트 페이지
 * @domain study
 * @layer page
 * @related StudyContext, /studies/[id]/room
 *
 * 현재 선택된 스터디의 스터디룸으로 리다이렉트합니다.
 * AppLayout에서 스터디 ID 없이 접근할 수 있도록 중간 라우트 역할.
 */

'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';

export default function StudyRoomRedirectPage(): ReactNode {
  const router = useRouter();
  const { isReady } = useRequireAuth();
  const { isStudyReady } = useRequireStudy();
  const { currentStudyId } = useStudy();

  useEffect(() => {
    if (isReady && isStudyReady && currentStudyId) {
      router.replace(`/studies/${currentStudyId}/room`);
    }
  }, [isReady, isStudyReady, currentStudyId, router]);

  return (
    <AppLayout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <LoadingSpinner size="lg" color="primary" />
        <p className="text-sm text-text-3">스터디룸으로 이동 중...</p>
      </div>
    </AppLayout>
  );
}
