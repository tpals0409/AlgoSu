import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '제출 목록',
  description: '코드 제출 내역을 확인하세요.',
};

export default function SubmissionsLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
