import type { Metadata } from 'next';
import type { ReactNode } from 'react';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ submissionId: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { submissionId } = await params;
  return {
    title: `코드리뷰 #${submissionId}`,
    description: 'AI 코드리뷰 결과를 확인하세요.',
  };
}

export default function ReviewDetailLayout({ children }: LayoutProps): ReactNode {
  return children;
}
