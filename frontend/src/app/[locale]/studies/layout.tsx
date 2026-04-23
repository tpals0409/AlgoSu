import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '스터디',
  description: '스터디 그룹을 관리하세요.',
};

export default function StudiesLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
