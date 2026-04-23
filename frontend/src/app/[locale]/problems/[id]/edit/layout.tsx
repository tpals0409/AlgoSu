import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '문제 수정',
  description: '문제 정보를 수정하세요.',
};

export default function ProblemEditLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
