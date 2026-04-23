import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'GitHub 연동',
  description: 'GitHub 계정을 연동하세요.',
};

export default function GitHubLinkLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
