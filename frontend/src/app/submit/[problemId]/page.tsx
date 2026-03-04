/**
 * @file 리다이렉트: /submit/[problemId] → /problems/[problemId]
 * @deprecated 통합 페이지로 이동됨
 */

import { redirect } from 'next/navigation';

interface PageProps {
  readonly params: Promise<{ problemId: string }>;
}

export default async function SubmitRedirect({ params }: PageProps) {
  const { problemId } = await params;
  redirect(`/problems/${problemId}`);
}
