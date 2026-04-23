import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '문제 목록',
  description: '알고리즘 문제를 풀어보세요.',
};

export default function ProblemsLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
