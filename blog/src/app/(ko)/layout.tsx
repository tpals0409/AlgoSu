/**
 * @file       layout.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/header.tsx
 *
 * 한국어(ko) route group 레이아웃 — Header + main + footer.
 */
import type { Metadata } from 'next';
import { Header } from '@/components/header';

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
      <Header locale="ko" />
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      <footer className="border-t border-border py-8 text-center text-sm text-text-muted">
        AlgoSu Team
      </footer>
    </>
  );
}
