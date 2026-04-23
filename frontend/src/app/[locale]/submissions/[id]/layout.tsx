import type { Metadata } from 'next';
import type { ReactNode } from 'react';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `제출 #${id}`,
    description: `제출 ${id}번의 상태와 분석 결과를 확인하세요.`,
  };
}

export default function SubmissionDetailLayout({ children }: LayoutProps): ReactNode {
  return children;
}
