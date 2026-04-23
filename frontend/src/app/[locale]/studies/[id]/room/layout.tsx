import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '스터디룸',
  description: '스터디룸에서 문제를 풀고 리뷰하세요.',
};

export default function StudyRoomLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return children;
}
