/**
 * @file       layout.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(ko)/layout.tsx, src/components/sidebar.tsx
 *
 * ADR 레이아웃 — 글로벌 좌측 사이드바 3존 셸 + 넓은 max-w-6xl 본문.
 * ADR 상세의 우측 TOC/meta-sidebar는 페이지 내부 요소이므로 이 셸이 건드리지 않는다.
 * KR(/adr/...) + EN(/en/adr/...) 두 라우팅 공통 적용 (Sidebar가 pathname으로 locale 판별).
 */
import type { Metadata } from 'next';
import { Sidebar } from '@/components/sidebar';
import { Footer } from '@/components/footer';

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
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-width)]">
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <Footer />
      </div>
    </>
  );
}
