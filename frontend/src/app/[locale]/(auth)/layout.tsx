import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '로그인',
  description: 'AlgoSu에 로그인하세요.',
};

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps): ReactNode {
  return <>{children}</>;
}

