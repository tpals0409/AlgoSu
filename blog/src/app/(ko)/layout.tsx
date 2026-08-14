/**
 * @file       layout.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/header.tsx
 *
 * 한국어(ko) route group 레이아웃 — 좌측 persistent 사이드바 3존 셸.
 * (데스크톱: Sidebar 고정 + 콘텐츠 좌측 오프셋 / 모바일: 상단바+드로어)
 */
import type { Metadata } from 'next';
import { Sidebar } from '@/components/sidebar';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'AlgoSu Tech Blog',
  description: 'AlgoSu 프로젝트의 아키텍처 결정과 기술 여정을 기록합니다.',
  alternates: {
    languages: { en: '/en' },
  },
};

export default function KoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-width)]">
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
        <Footer />
      </div>
    </>
  );
}
