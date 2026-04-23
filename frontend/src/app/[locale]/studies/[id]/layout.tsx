import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '스터디 정보',
  description: '스터디 상세 정보를 확인하세요.',
};

export default function StudyDetailLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
