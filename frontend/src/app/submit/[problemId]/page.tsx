'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * /submit/[problemId] → /problems/[problemId] 리다이렉트
 *
 * 코드 제출은 문제 상세 페이지에서 처리됩니다.
 * 이전 경로 호환을 위한 리다이렉트 래퍼입니다.
 */
export default function SubmitRedirectPage(): ReactNode {
  const params = useParams();
  const router = useRouter();
  const problemId = params?.problemId as string;

  useEffect(() => {
    router.replace(`/problems/${problemId}`);
  }, [router, problemId]);

  return null;
}
