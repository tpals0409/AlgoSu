import type { Metadata } from 'next';
import type { ReactNode } from 'react';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `문제 ${id}`,
    description: `문제 ${id}번 상세 정보와 코드 제출`,
  };
}

export default function ProblemDetailLayout({ children }: LayoutProps): ReactNode {
  return children;
}
