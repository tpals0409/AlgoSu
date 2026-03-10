/**
 * @file 게스트 공유 링크 레이아웃 — 인증 불필요, 사이드바 없음
 * @domain share
 * @layer layout
 * @related GuestContext.tsx
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '공유 스터디룸 | AlgoSu',
  description: '알고리즘 스터디 공유 링크를 통한 읽기 전용 뷰',
};

interface SharedLayoutProps {
  readonly children: ReactNode;
}

export default function SharedLayout({ children }: SharedLayoutProps): ReactNode {
  return <>{children}</>;
}
