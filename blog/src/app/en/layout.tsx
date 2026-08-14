/**
 * @file       layout.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/header.tsx
 *
 * 영어(en) route 레이아웃 — 좌측 persistent 사이드바 3존 셸.
 * document.documentElement.lang을 'en'으로 동적 전환한다.
 */
import type { Metadata } from 'next';
import { Sidebar } from '@/components/sidebar';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'AlgoSu Tech Blog',
  description: 'Architecture decisions and engineering journey of AlgoSu.',
  alternates: {
    languages: { ko: '/' },
  },
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang='en'`,
        }}
      />
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-width)]">
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
        <Footer />
      </div>
    </>
  );
}
