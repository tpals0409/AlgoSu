import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '스터디 생성',
  description: '새로운 스터디 그룹을 만드세요.',
};

export default function StudyCreateLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
