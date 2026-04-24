/**
 * @file 리다이렉트: /problems/[id]/status?submissionId=xxx → /submissions/xxx/status
 * @deprecated 제출 상태 페이지가 /submissions/[id]/status로 이동됨
 */

'use client';

import { useEffect, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export default function StatusRedirect({ params }: PageProps) {
  const { id: problemId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('submissionId');

  useEffect(() => {
    if (submissionId) {
      router.replace(`/submissions/${submissionId}/status`);
    } else {
      router.replace(`/problems/${problemId}`);
    }
  }, [submissionId, problemId, router]);

  return null;
}
