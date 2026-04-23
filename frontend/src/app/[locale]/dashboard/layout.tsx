import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '대시보드',
  description: '학습 현황과 통계를 확인하세요.',
};

export default function DashboardLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
