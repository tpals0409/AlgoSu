import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '학습 분석',
  description: '알고리즘 학습 분석 리포트를 확인하세요.',
};

export default function AnalyticsLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
