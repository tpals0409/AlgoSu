import type { Metadata } from 'next';
import type { ReactNode } from 'react';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `스터디 ${id}`,
    description: `스터디 ${id}번 상세 정보를 확인하세요.`,
  };
}

export default function StudyDetailLayout({ children }: LayoutProps): ReactNode {
  return children;
}
