/**
 * @file       layout.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(ko)/layout.tsx, src/components/adr/search-box.tsx, src/components/adr/adr-header.tsx
 *
 * ADR 전용 레이아웃 — 네비게이션 헤더(검색/로케일 토글 포함) + 넓은 max-w-7xl 본문.
 * KR(/adr/...) + EN(/en/adr/...) 두 라우팅 공통 적용.
 */
import type { Metadata } from 'next';
import { AdrHeader } from '@/components/adr/adr-header';

export const metadata: Metadata = {
  title: 'AlgoSu ADR',
  description:
    'Architecture Decision Records — AlgoSu architecture decisions and sprint retrospectives.',
  alternates: {
    languages: { ko: '/adr', en: '/en/adr' },
  },
};

/** ADR 라우트 그룹 레이아웃을 렌더링한다. */
export default function AdrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdrHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
      <footer className="border-t border-border py-8 text-center text-sm text-text-muted">
        AlgoSu Team
      </footer>
    </>
  );
}
