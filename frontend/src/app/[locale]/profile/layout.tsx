import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '프로필',
  description: '프로필 설정을 관리하세요.',
};

export default function ProfileLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
