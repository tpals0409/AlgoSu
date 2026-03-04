/**
 * @file 리다이렉트: /submit/[problemId] → /problems/[problemId]
 * @deprecated 통합 페이지로 이동됨
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface MetadataProps {
  readonly params: Promise<{ problemId: string }>;
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { problemId } = await params;
  return {
    title: `제출 - 문제 ${problemId}`,
    description: `문제 ${problemId}번에 코드를 제출하세요.`,
  };
}

interface PageProps {
  readonly params: Promise<{ problemId: string }>;
}

export default async function SubmitRedirect({ params }: PageProps) {
  const { problemId } = await params;
  redirect(`/problems/${problemId}`);
}
