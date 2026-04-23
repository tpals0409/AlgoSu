import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '문제 생성',
  description: '새로운 알고리즘 문제를 등록하세요.',
};

export default function ProblemCreateLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
