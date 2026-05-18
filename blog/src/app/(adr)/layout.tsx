/**
 * @file       layout.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(ko)/layout.tsx, src/components/adr/search-box.tsx
 *
 * ADR 전용 레이아웃 — 네비게이션 헤더(검색 포함) + 넓은 max-w-7xl 본문.
 */
import type { Metadata } from 'next';
import { SearchBox } from '@/components/adr/search-box';

export const metadata: Metadata = {
  title: 'AlgoSu ADR',
  description: 'Architecture Decision Records — AlgoSu 프로젝트의 아키텍처 결정 기록.',
};

/** ADR 전용 헤더를 렌더링한다. */
function AdrHeader() {
  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <a href="/adr/" className="text-lg font-bold text-brand">
            AlgoSu ADR
          </a>
          <a
            href="/adr/graph/"
            className="hidden text-sm text-text-muted transition-colors hover:text-brand sm:inline"
          >
            그래프
          </a>
        </div>
        <div className="flex items-center gap-4">
          <SearchBox />
          <a
            href="/"
            className="text-sm text-text-muted transition-colors hover:text-brand"
          >
            블로그
          </a>
        </div>
      </nav>
    </header>
  );
}

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
